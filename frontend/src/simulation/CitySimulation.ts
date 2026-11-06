import * as THREE from 'three';

export type Lane = 'north' | 'east' | 'south' | 'west';
export type LightState = 'RED' | 'YELLOW' | 'GREEN';
export type CameraMode = 'orbit' | 'topDown' | 'drone' | 'intersection' | 'follow';

export interface Vehicle {
  mesh: THREE.Group;
  lane: Lane;
  speed: number;
  maxSpeed: number;
  distance: number; // position along lane path
  type: 'sedan' | 'suv' | 'bus' | 'ambulance';
  isAmbulance: boolean;
  strobeTime?: number;
  color: number;
  headlights: THREE.SpotLight[];
}

export interface SimulationConfig {
  vehicleSpeedMultiplier: number;
  spawnRates: Record<Lane, number>; // vehicles per minute
  daylightPercent: number; // 0 to 100
  weather: 'clear' | 'rain' | 'storm';
  cameraMode: CameraMode;
}

export class CitySimulation {
  public container: HTMLElement;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private animationFrameId: number | null = null;
  private clock: THREE.Clock;

  // Environment & Lighting
  private sunLight: THREE.DirectionalLight;
  private ambientLight: THREE.AmbientLight;
  private hemiLight: THREE.HemisphereLight;
  private streetLamps: { post: THREE.Group; light: THREE.PointLight; cone: THREE.Mesh }[] = [];

  // Traffic Lights
  private trafficLightMeshes: Record<Lane, { red: THREE.Mesh; yellow: THREE.Mesh; green: THREE.Mesh }> = {
    north: {} as any,
    east: {} as any,
    south: {} as any,
    west: {} as any,
  };

  // State
  public signalStates: Record<Lane, LightState> = {
    north: 'GREEN',
    east: 'RED',
    south: 'RED',
    west: 'RED',
  };

  public vehicles: Vehicle[] = [];
  public accidentActive: boolean = false;
  private smokeParticles: THREE.Points | null = null;
  private smokeGeo: THREE.BufferGeometry | null = null;

  public config: SimulationConfig = {
    vehicleSpeedMultiplier: 1.0,
    spawnRates: { north: 12, east: 6, south: 10, west: 5 },
    daylightPercent: 85,
    weather: 'clear',
    cameraMode: 'orbit',
  };

  // Camera Orbit Controls
  private isMouseDown: boolean = false;
  private prevMouseX: number = 0;
  private prevMouseY: number = 0;
  private spherical: { radius: number; theta: number; phi: number } = {
    radius: 70,
    theta: Math.PI / 4,
    phi: Math.PI / 3,
  };

  private lastSpawnTimes: Record<Lane, number> = {
    north: 0,
    east: 0,
    south: 0,
    west: 0,
  };

  constructor(container: HTMLElement) {
    this.container = container;
    this.clock = new THREE.Clock();

    const width = container.clientWidth || window.innerWidth || 1280;
    const height = container.clientHeight || window.innerHeight || 800;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050811);
    this.scene.fog = new THREE.FogExp2(0x050811, 0.008);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(
      45,
      width / height,
      0.5,
      500
    );
    this.updateCameraPosition();

    // 3. Renderer with high-graphics shadows & tone mapping
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    
    // Ensure canvas expands full container
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';
    container.appendChild(this.renderer.domElement);

    // 4. Setup Lighting
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0x7090b0, 0x111122, 0.4);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfffaed, 1.5);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 250;
    this.sunLight.shadow.camera.left = -60;
    this.sunLight.shadow.camera.right = 60;
    this.sunLight.shadow.camera.top = 60;
    this.sunLight.shadow.camera.bottom = -60;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    // 5. Build Environment
    this.buildCity();
    this.setupEventListeners();
    this.updateLighting(this.config.daylightPercent);

    // 6. Spawn initial active vehicles across all 4 lanes so the scene is alive immediately
    this.spawnVehicle('north', 'sedan', -22);
    this.spawnVehicle('north', 'suv', -45);
    this.spawnVehicle('east', 'bus', -28);
    this.spawnVehicle('east', 'sedan', -55);
    this.spawnVehicle('south', 'suv', -18);
    this.spawnVehicle('south', 'sedan', -40);
    this.spawnVehicle('west', 'sedan', -25);
    this.spawnVehicle('west', 'ambulance', -50);

    // 7. Start Loop
    this.animate();
  }

  // --------------------------------------------------------------------------
  // City Environment Construction
  // --------------------------------------------------------------------------
  private buildCity() {
    this.createRoadsAndIntersection();
    this.createSidewalksAndCurbs();
    this.createBuildings();
    this.createStreetLamps();
    this.createTrafficLights();
  }

  private createRoadTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    // Dark asphalt base with subtle noise
    ctx.fillStyle = '#1c212a';
    ctx.fillRect(0, 0, 1024, 1024);

    // Add asphalt aggregate specks
    for (let i = 0; i < 5000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#272d38' : '#141820';
      ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 2, 2);
    }

    // Outer road edges (white lines)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 14;
    ctx.strokeRect(32, 32, 960, 960);

    // Center dividing lines (dashed yellow)
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 12;
    ctx.setLineDash([40, 30]);

    // Vertical lane divider
    ctx.beginPath();
    ctx.moveTo(512, 0);
    ctx.lineTo(512, 1024);
    ctx.stroke();

    // Horizontal lane divider
    ctx.beginPath();
    ctx.moveTo(0, 512);
    ctx.lineTo(1024, 512);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  private createRoadsAndIntersection() {
    const roadWidth = 18;
    const roadLength = 180;
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x1e2430,
      roughness: 0.85,
      metalness: 0.1,
    });

    // North-South Avenue
    const nsRoadGeo = new THREE.PlaneGeometry(roadWidth, roadLength);
    const nsRoad = new THREE.Mesh(nsRoadGeo, roadMat);
    nsRoad.rotation.x = -Math.PI / 2;
    nsRoad.receiveShadow = true;
    this.scene.add(nsRoad);

    // East-West Boulevard
    const ewRoadGeo = new THREE.PlaneGeometry(roadLength, roadWidth);
    const ewRoad = new THREE.Mesh(ewRoadGeo, roadMat);
    ewRoad.rotation.x = -Math.PI / 2;
    ewRoad.position.y = 0.01; // avoid z-fighting
    ewRoad.receiveShadow = true;
    this.scene.add(ewRoad);

    // Ground Plane around roads
    const groundGeo = new THREE.PlaneGeometry(300, 300);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0a0f1d,
      roughness: 0.9,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Road Markings: Crosswalks and Stop Lines
    this.createIntersectionMarkings(roadWidth);
  }

  private createIntersectionMarkings(w: number) {
    const markingMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const stopLineMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b }); // yellow stop bar

    const halfW = w / 2;
    const stopDist = halfW + 3;

    // Crosswalk strip generator
    const addCrosswalk = (cx: number, cz: number, isHorizontal: boolean) => {
      const stripes = 6;
      for (let i = 0; i < stripes; i++) {
        const stripGeo = new THREE.PlaneGeometry(isHorizontal ? 2.5 : 1.2, isHorizontal ? 1.2 : 2.5);
        const strip = new THREE.Mesh(stripGeo, markingMat);
        strip.rotation.x = -Math.PI / 2;
        if (isHorizontal) {
          strip.position.set(cx, 0.03, cz - (stripes / 2) * 2.2 + i * 2.2 + 1.1);
        } else {
          strip.position.set(cx - (stripes / 2) * 2.2 + i * 2.2 + 1.1, 0.03, cz);
        }
        this.scene.add(strip);
      }
    };

    // 4 Crosswalks
    addCrosswalk(0, -stopDist - 1.5, false); // North
    addCrosswalk(0, stopDist + 1.5, false);  // South
    addCrosswalk(stopDist + 1.5, 0, true);   // East
    addCrosswalk(-stopDist - 1.5, 0, true);  // West

    // 4 Stop Lines
    const addStopLine = (cx: number, cz: number, len: number, isHorizontal: boolean) => {
      const geo = new THREE.PlaneGeometry(isHorizontal ? len : 0.8, isHorizontal ? 0.8 : len);
      const mesh = new THREE.Mesh(geo, stopLineMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(cx, 0.04, cz);
      this.scene.add(mesh);
    };

    addStopLine(halfW / 2, -stopDist, halfW - 1, true); // North incoming (right lane)
    addStopLine(-halfW / 2, stopDist, halfW - 1, true); // South incoming (right lane)
    addStopLine(stopDist, halfW / 2, halfW - 1, false);  // East incoming (right lane)
    addStopLine(-stopDist, -halfW / 2, halfW - 1, false); // West incoming (right lane)
  }

  private createSidewalksAndCurbs() {
    const sidewalkMat = new THREE.MeshStandardMaterial({
      color: 0x222a38,
      roughness: 0.7,
      metalness: 0.1,
    });

    const blockWidth = 70;
    const offset = 9 + blockWidth / 2;
    const height = 0.3;

    const corners = [
      { x: offset, z: offset },
      { x: -offset, z: offset },
      { x: offset, z: -offset },
      { x: -offset, z: -offset },
    ];

    corners.forEach((c) => {
      const geo = new THREE.BoxGeometry(blockWidth, height, blockWidth);
      const mesh = new THREE.Mesh(geo, sidewalkMat);
      mesh.position.set(c.x, height / 2, c.z);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      this.scene.add(mesh);
    });
  }

  private createBuildingTexture(floors: number, cols: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Concrete facade
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, 512, 512);

    // Glowing warm/cyan windows
    const padX = 512 / cols;
    const padY = 512 / floors;

    for (let f = 0; f < floors; f++) {
      for (let c = 0; c < cols; c++) {
        const isLit = Math.random() > 0.4;
        if (isLit) {
          ctx.fillStyle = Math.random() > 0.3 ? '#fef08a' : '#38bdf8';
          ctx.shadowColor = ctx.fillStyle;
          ctx.shadowBlur = 4;
        } else {
          ctx.fillStyle = '#0f172a';
          ctx.shadowBlur = 0;
        }
        ctx.fillRect(c * padX + 8, f * padY + 8, padX - 16, padY - 16);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  private createBuildings() {
    const buildingColors = [0x1e293b, 0x0f172a, 0x1e1b4b, 0x111827, 0x18181b];

    const generateCluster = (centerX: number, centerZ: number) => {
      const grid = 3;
      const spacing = 18;
      for (let r = 0; r < grid; r++) {
        for (let c = 0; c < grid; c++) {
          const w = 12 + Math.random() * 6;
          const d = 12 + Math.random() * 6;
          const h = 25 + Math.random() * 45;
          const color = buildingColors[Math.floor(Math.random() * buildingColors.length)];

          const geo = new THREE.BoxGeometry(w, h, d);
          const mat = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.3,
            metalness: 0.6,
          });

          const building = new THREE.Mesh(geo, mat);
          const px = centerX + (c - 1) * spacing + (Math.random() * 4 - 2);
          const pz = centerZ + (r - 1) * spacing + (Math.random() * 4 - 2);
          building.position.set(px, h / 2 + 0.3, pz);
          building.castShadow = true;
          building.receiveShadow = true;
          this.scene.add(building);

          // Rooftop architectural beacon / helipad
          if (Math.random() > 0.4) {
            const roofGeo = new THREE.BoxGeometry(w * 0.4, 3, d * 0.4);
            const roofMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x0891b2, emissiveIntensity: 0.5 });
            const roof = new THREE.Mesh(roofGeo, roofMat);
            roof.position.set(px, h + 1.8, pz);
            this.scene.add(roof);
          }
        }
      }
    };

    generateCluster(35, 35);
    generateCluster(-35, 35);
    generateCluster(35, -35);
    generateCluster(-35, -35);
  }

  private createStreetLamps() {
    const lampPositions = [
      { x: 11, z: 22 }, { x: 11, z: 45 }, { x: 11, z: 68 },
      { x: -11, z: 22 }, { x: -11, z: 45 }, { x: -11, z: 68 },
      { x: 11, z: -22 }, { x: 11, z: -45 }, { x: 11, z: -68 },
      { x: -11, z: -22 }, { x: -11, z: -45 }, { x: -11, z: -68 },
      { x: 22, z: 11 }, { x: 45, z: 11 }, { x: 68, z: 11 },
      { x: -22, z: 11 }, { x: -45, z: 11 }, { x: -68, z: 11 },
      { x: 22, z: -11 }, { x: 45, z: -11 }, { x: 68, z: -11 },
      { x: -22, z: -11 }, { x: -45, z: -11 }, { x: -68, z: -11 },
    ];

    lampPositions.forEach((pos) => {
      const lampGroup = new THREE.Group();
      lampGroup.position.set(pos.x, 0, pos.z);

      // Pole
      const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 8, 8);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.2 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 4;
      pole.castShadow = true;
      lampGroup.add(pole);

      // Arm
      const armGeo = new THREE.BoxGeometry(1.8, 0.1, 0.1);
      const arm = new THREE.Mesh(armGeo, poleMat);
      arm.position.set(pos.x > 0 ? -0.8 : 0.8, 8, 0);
      lampGroup.add(arm);

      // Fixture / Bulb
      const bulbGeo = new THREE.SphereGeometry(0.3, 16, 16);
      const bulbMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xfef08a,
        emissiveIntensity: 1.0,
      });
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      const bulbX = pos.x > 0 ? -1.6 : 1.6;
      bulb.position.set(bulbX, 7.8, 0);
      lampGroup.add(bulb);

      // Emissive downward light cone
      const coneGeo = new THREE.ConeGeometry(4, 7.5, 16, 1, true);
      const coneMat = new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.set(bulbX, 3.8, 0);
      cone.rotation.x = Math.PI;
      lampGroup.add(cone);

      // PointLight
      const pointLight = new THREE.PointLight(0xfef08a, 1.5, 22, 1.8);
      pointLight.position.set(bulbX, 7.5, 0);
      pointLight.castShadow = false;
      lampGroup.add(pointLight);

      this.scene.add(lampGroup);
      this.streetLamps.push({ post: lampGroup, light: pointLight, cone });
    });
  }

  private createTrafficLights() {
    const createPole = (lane: Lane, x: number, z: number, rotY: number) => {
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      group.rotation.y = rotY;

      // Pole
      const poleGeo = new THREE.CylinderGeometry(0.18, 0.22, 7.5, 8);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.3 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 3.75;
      group.add(pole);

      // Overhang mast arm
      const armGeo = new THREE.CylinderGeometry(0.12, 0.12, 4.5, 8);
      const arm = new THREE.Mesh(armGeo, poleMat);
      arm.rotation.z = Math.PI / 2;
      arm.position.set(2.2, 7.2, 0);
      group.add(arm);

      // Signal Housing Box
      const boxGeo = new THREE.BoxGeometry(0.8, 2.4, 0.7);
      const boxMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.5 });
      const box = new THREE.Mesh(boxGeo, boxMat);
      box.position.set(3.8, 6.8, 0);
      group.add(box);

      // 3 Bulbs: Red, Yellow, Green
      const bulbGeo = new THREE.SphereGeometry(0.25, 16, 16);
      const makeBulb = (yOff: number, colorHex: number) => {
        const mat = new THREE.MeshStandardMaterial({
          color: colorHex,
          emissive: colorHex,
          emissiveIntensity: 0.1,
          roughness: 0.2,
        });
        const mesh = new THREE.Mesh(bulbGeo, mat);
        mesh.position.set(3.8, 6.8 + yOff, 0.32);
        group.add(mesh);
        return mesh;
      };

      const red = makeBulb(0.7, 0xef4444);
      const yellow = makeBulb(0, 0xf59e0b);
      const green = makeBulb(-0.7, 0x10b981);

      this.scene.add(group);
      this.trafficLightMeshes[lane] = { red, yellow, green };
    };

    // 4 Traffic Light Poles positioned facing each incoming lane
    createPole('north', 10, -11, Math.PI);        // Facing South
    createPole('south', -10, 11, 0);             // Facing North
    createPole('east', 11, 10, -Math.PI / 2);    // Facing West
    createPole('west', -11, -10, Math.PI / 2);   // Facing East

    this.updateTrafficLightVisuals();
  }

  public updateSignalStates(states: Record<Lane, LightState>) {
    this.signalStates = { ...states };
    this.updateTrafficLightVisuals();
  }

  private updateTrafficLightVisuals() {
    (Object.keys(this.signalStates) as Lane[]).forEach((lane) => {
      const state = this.signalStates[lane];
      const meshes = this.trafficLightMeshes[lane];
      if (!meshes.red) return;

      const setGlow = (mesh: THREE.Mesh, active: boolean, intensity: number = 3.0) => {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = active ? intensity : 0.05;
      };

      setGlow(meshes.red, state === 'RED');
      setGlow(meshes.yellow, state === 'YELLOW');
      setGlow(meshes.green, state === 'GREEN');
    });
  }

  // --------------------------------------------------------------------------
  // Vehicle Generation & Autonomous Simulation
  // --------------------------------------------------------------------------
  public spawnVehicle(
    lane: Lane,
    type: 'sedan' | 'suv' | 'bus' | 'ambulance' = 'sedan',
    initialDistance: number = -75
  ) {
    const group = new THREE.Group();
    const isAmbulance = type === 'ambulance';

    const colors = [0x06b6d4, 0x3b82f6, 0xe2e8f0, 0xef4444, 0x10b981, 0xf59e0b, 0x64748b];
    const carColor = isAmbulance ? 0xffffff : colors[Math.floor(Math.random() * colors.length)];

    let bodyLength = 4.2;
    let bodyWidth = 2.0;
    let bodyHeight = 1.3;

    if (type === 'bus') {
      bodyLength = 9.5;
      bodyWidth = 2.4;
      bodyHeight = 2.8;
    } else if (type === 'suv' || isAmbulance) {
      bodyLength = 4.8;
      bodyWidth = 2.2;
      bodyHeight = 1.8;
    }

    // Chassis / Body
    const bodyGeo = new THREE.BoxGeometry(bodyWidth, bodyHeight, bodyLength);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: carColor,
      roughness: 0.25,
      metalness: 0.75,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = bodyHeight / 2 + 0.35;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Cabin Windows
    const cabinGeo = new THREE.BoxGeometry(bodyWidth * 0.9, bodyHeight * 0.7, bodyLength * 0.55);
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      roughness: 0.1,
      metalness: 0.9,
    });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.y = bodyHeight + 0.25;
    group.add(cabin);

    // Wheels (4)
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });
    const wheelZ = bodyLength * 0.32;
    const wheelX = bodyWidth / 2 + 0.05;

    [
      { x: wheelX, z: wheelZ },
      { x: -wheelX, z: wheelZ },
      { x: wheelX, z: -wheelZ },
      { x: -wheelX, z: -wheelZ },
    ].forEach((wPos) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wPos.x, 0.38, wPos.z);
      wheel.castShadow = true;
      group.add(wheel);
    });

    // Headlights
    const headLightL = new THREE.SpotLight(0xfffbeb, 1.8, 25, Math.PI / 6, 0.3);
    headLightL.position.set(bodyWidth * 0.35, 0.7, bodyLength / 2);
    headLightL.target.position.set(bodyWidth * 0.35, 0.2, bodyLength / 2 + 10);
    group.add(headLightL);
    group.add(headLightL.target);

    const headLightR = new THREE.SpotLight(0xfffbeb, 1.8, 25, Math.PI / 6, 0.3);
    headLightR.position.set(-bodyWidth * 0.35, 0.7, bodyLength / 2);
    headLightR.target.position.set(-bodyWidth * 0.35, 0.2, bodyLength / 2 + 10);
    group.add(headLightR);
    group.add(headLightR.target);

    // Ambulance Strobe Light Bar
    if (isAmbulance) {
      const barGeo = new THREE.BoxGeometry(1.6, 0.25, 0.4);
      const barMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
      const bar = new THREE.Mesh(barGeo, barMat);
      bar.position.set(0, bodyHeight + 0.9, 0);
      group.add(bar);

      // Red Strobe
      const redStrobe = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 4.0 })
      );
      redStrobe.position.set(0.6, bodyHeight + 1.1, 0);
      redStrobe.name = 'redStrobe';
      group.add(redStrobe);

      // Blue Strobe
      const blueStrobe = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x3b82f6, emissiveIntensity: 4.0 })
      );
      blueStrobe.position.set(-0.6, bodyHeight + 1.1, 0);
      blueStrobe.name = 'blueStrobe';
      group.add(blueStrobe);
    }

    this.scene.add(group);

    const vehicle: Vehicle = {
      mesh: group,
      lane,
      speed: 0,
      maxSpeed: isAmbulance ? 16 : 10 + Math.random() * 4,
      distance: initialDistance, // configurable initial distance
      type,
      isAmbulance,
      color: carColor,
      headlights: [headLightL, headLightR],
    };

    this.vehicles.push(vehicle);
    this.updateVehicleTransform(vehicle);
  }

  private updateVehicleTransform(v: Vehicle) {
    const laneOffset = 4.5; // right-hand traffic offset
    let x = 0;
    let z = 0;
    let rotY = 0;

    switch (v.lane) {
      case 'north': // Moving South (+Z)
        x = laneOffset;
        z = v.distance;
        rotY = 0;
        break;
      case 'south': // Moving North (-Z)
        x = -laneOffset;
        z = -v.distance;
        rotY = Math.PI;
        break;
      case 'east': // Moving West (-X)
        x = -v.distance;
        z = laneOffset;
        rotY = -Math.PI / 2;
        break;
      case 'west': // Moving East (+X)
        x = v.distance;
        z = -laneOffset;
        rotY = Math.PI / 2;
        break;
    }

    v.mesh.position.set(x, 0, z);
    v.mesh.rotation.y = rotY;
  }

  public triggerAccident() {
    this.accidentActive = true;

    // Spawn 2 vehicles in conflict zone if needed
    if (this.vehicles.length < 2) {
      this.spawnVehicle('north', 'sedan');
      this.spawnVehicle('east', 'suv');
    }

    // Position two vehicles collided at the intersection center
    const v1 = this.vehicles[0];
    const v2 = this.vehicles[1];

    v1.distance = 2.0;
    v2.distance = 1.5;
    v1.speed = 0;
    v2.speed = 0;

    this.updateVehicleTransform(v1);
    this.updateVehicleTransform(v2);

    // Crash tilt & rotation
    v1.mesh.rotation.z = 0.25;
    v2.mesh.rotation.z = -0.3;
    v2.mesh.position.x += 1.2;

    this.createSmokeParticles(0, 1.5, 0);
  }

  public clearAccident() {
    this.accidentActive = false;
    if (this.smokeParticles) {
      this.scene.remove(this.smokeParticles);
      this.smokeParticles = null;
    }
  }

  private createSmokeParticles(x: number, y: number, z: number) {
    if (this.smokeParticles) return;

    const count = 150;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = x + (Math.random() - 0.5) * 2;
      positions[i * 3 + 1] = y + Math.random() * 4;
      positions[i * 3 + 2] = z + (Math.random() - 0.5) * 2;
    }

    this.smokeGeo = new THREE.BufferGeometry();
    this.smokeGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const smokeMat = new THREE.PointsMaterial({
      color: 0x64748b,
      size: 1.2,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });

    this.smokeParticles = new THREE.Points(this.smokeGeo, smokeMat);
    this.scene.add(this.smokeParticles);
  }

  // --------------------------------------------------------------------------
  // Lighting & Day/Night Transition
  // --------------------------------------------------------------------------
  public updateLighting(daylightPercent: number) {
    this.config.daylightPercent = daylightPercent;
    const norm = daylightPercent / 100;

    // Sun altitude and intensity
    const sunAngle = norm * Math.PI; // 0 to PI
    this.sunLight.position.set(
      Math.cos(sunAngle) * 80,
      Math.sin(sunAngle) * 90 + 5,
      35
    );
    this.sunLight.intensity = Math.max(0.05, norm * 2.2);

    // Sky & Ambient Colors
    if (norm > 0.7) {
      // Midday Clear
      this.scene.background = new THREE.Color(0x0f172a);
      this.ambientLight.intensity = 0.5;
      this.renderer.toneMappingExposure = 1.0;
    } else if (norm >= 0.3) {
      // Twilight / Dusk
      this.scene.background = new THREE.Color(0x180f28);
      this.ambientLight.intensity = 0.3;
      this.renderer.toneMappingExposure = 0.9;
    } else {
      // Deep Night
      this.scene.background = new THREE.Color(0x050811);
      this.ambientLight.intensity = 0.15;
      this.renderer.toneMappingExposure = 0.8;
    }

    // Street Lamps Energy Logic
    let streetLampBrightness = 0;
    if (daylightPercent > 70) {
      streetLampBrightness = 0; // OFF
    } else if (daylightPercent >= 30) {
      streetLampBrightness = (100 - daylightPercent) / 100; // DIM (30% to 70%)
    } else {
      streetLampBrightness = 1.0 - (daylightPercent / 30) * 0.2; // ON (80% to 100%)
    }

    this.streetLamps.forEach((lamp) => {
      lamp.light.intensity = streetLampBrightness * 2.5;
      lamp.cone.visible = streetLampBrightness > 0.05;
      (lamp.cone.material as THREE.MeshBasicMaterial).opacity = streetLampBrightness * 0.15;
    });

    // Vehicle Headlights intensity
    const headlightPower = daylightPercent < 50 ? 2.5 : 0.0;
    this.vehicles.forEach((v) => {
      v.headlights.forEach((h) => {
        h.intensity = headlightPower;
      });
    });
  }

  // --------------------------------------------------------------------------
  // Camera Modes & Controls
  // --------------------------------------------------------------------------
  public setCameraMode(mode: CameraMode) {
    this.config.cameraMode = mode;
    if (mode === 'topDown') {
      this.spherical.theta = 0;
      this.spherical.phi = 0.001; // almost directly above
      this.spherical.radius = 80;
    } else if (mode === 'intersection') {
      this.spherical.theta = Math.PI / 4;
      this.spherical.phi = Math.PI / 2.3;
      this.spherical.radius = 35;
    } else if (mode === 'drone') {
      this.spherical.radius = 65;
    } else {
      this.spherical.radius = 70;
      this.spherical.phi = Math.PI / 3;
    }
    this.updateCameraPosition();
  }

  private updateCameraPosition() {
    const { radius, theta, phi } = this.spherical;
    const x = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.cos(theta);

    this.camera.position.set(x, y, z);
    this.camera.lookAt(0, 1.5, 0);
  }

  private setupEventListeners() {
    const dom = this.renderer.domElement;

    dom.addEventListener('mousedown', (e) => {
      this.isMouseDown = true;
      this.prevMouseX = e.clientX;
      this.prevMouseY = e.clientY;
    });

    window.addEventListener('mouseup', () => {
      this.isMouseDown = false;
    });

    dom.addEventListener('mousemove', (e) => {
      if (!this.isMouseDown || this.config.cameraMode !== 'orbit') return;

      const deltaX = e.clientX - this.prevMouseX;
      const deltaY = e.clientY - this.prevMouseY;

      this.spherical.theta -= deltaX * 0.008;
      this.spherical.phi = Math.max(0.1, Math.min(Math.PI / 2.1, this.spherical.phi - deltaY * 0.008));

      this.prevMouseX = e.clientX;
      this.prevMouseY = e.clientY;
      this.updateCameraPosition();
    });

    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.spherical.radius = Math.max(15, Math.min(150, this.spherical.radius + e.deltaY * 0.05));
      this.updateCameraPosition();
    });

    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  private onWindowResize() {
    if (!this.container) return;
    const width = this.container.clientWidth || window.innerWidth || 1280;
    const height = this.container.clientHeight || window.innerHeight || 800;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  // --------------------------------------------------------------------------
  // Main Animation Loop
  // --------------------------------------------------------------------------
  private animate = () => {
    this.animationFrameId = requestAnimationFrame(this.animate);
    const dt = this.clock.getDelta();
    const elapsedTime = this.clock.getElapsedTime();

    // 1. Camera Drone Patrol Rotation
    if (this.config.cameraMode === 'drone') {
      this.spherical.theta += dt * 0.2;
      this.updateCameraPosition();
    }

    // 2. Spawn Vehicles by Config Rates
    const lanes: Lane[] = ['north', 'east', 'south', 'west'];
    lanes.forEach((lane) => {
      const interval = 60 / Math.max(1, this.config.spawnRates[lane]);
      if (elapsedTime - this.lastSpawnTimes[lane] >= interval) {
        this.spawnVehicle(lane, Math.random() > 0.85 ? 'suv' : 'sedan');
        this.lastSpawnTimes[lane] = elapsedTime;
      }
    });

    // 3. Autonomous Traffic Physics & Lane Clearance
    const stopDistance = -12.5; // distance where stop line sits
    const speedMult = this.config.vehicleSpeedMultiplier;

    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      const light = this.signalStates[v.lane];

      // Ambulance always overrides red lights unless emergency preemption clears lane
      const mustStop = !v.isAmbulance && (light === 'RED' || light === 'YELLOW');

      // Check distance to stopline or vehicle in front
      const distToStop = stopDistance - v.distance;
      const isApproachingStop = distToStop > 0 && distToStop < 20;

      // Check distance to preceding car in same lane
      let carAheadDist = 999;
      for (let j = 0; j < this.vehicles.length; j++) {
        if (i !== j && this.vehicles[j].lane === v.lane) {
          const aheadDist = this.vehicles[j].distance - v.distance;
          if (aheadDist > 0 && aheadDist < carAheadDist) {
            carAheadDist = aheadDist;
          }
        }
      }

      if (this.accidentActive && Math.abs(v.distance) < 5) {
        // Halt at accident
        v.speed = Math.max(0, v.speed - dt * 25);
      } else if (carAheadDist < 8.0) {
        // Vehicle ahead braking
        v.speed = Math.max(0, v.speed - dt * 30);
      } else if (mustStop && isApproachingStop && distToStop < 16) {
        // Smooth deceleration at red signal
        v.speed = Math.max(0, v.speed - dt * (v.speed * 2.5 + 2.0));
      } else {
        // Accelerate to target speed
        v.speed = Math.min(v.maxSpeed * speedMult, v.speed + dt * 12);
      }

      v.distance += v.speed * dt;
      this.updateVehicleTransform(v);

      // Animate Ambulance Strobe Lights
      if (v.isAmbulance) {
        const strobeT = (elapsedTime * 8) % 2;
        const redStrobe = v.mesh.getObjectByName('redStrobe') as THREE.Mesh;
        const blueStrobe = v.mesh.getObjectByName('blueStrobe') as THREE.Mesh;
        if (redStrobe && blueStrobe) {
          (redStrobe.material as THREE.MeshStandardMaterial).emissiveIntensity = strobeT < 1 ? 5.0 : 0.1;
          (blueStrobe.material as THREE.MeshStandardMaterial).emissiveIntensity = strobeT >= 1 ? 5.0 : 0.1;
        }
      }

      // Remove vehicles that left the scene
      if (v.distance > 85) {
        this.scene.remove(v.mesh);
        this.vehicles.splice(i, 1);
      }
    }

    // 4. Smoke Particle Animation
    if (this.smokeParticles && this.smokeGeo) {
      const positions = this.smokeGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < positions.length / 3; i++) {
        positions[i * 3 + 1] += dt * 2.5; // rise up
        positions[i * 3] += (Math.random() - 0.5) * dt * 0.8;
        if (positions[i * 3 + 1] > 8.0) {
          positions[i * 3 + 1] = 1.5;
        }
      }
      this.smokeGeo.attributes.position.needsUpdate = true;
    }

    // 5. Render Scene
    this.renderer.render(this.scene, this.camera);
  };

  public getVehicleCounts(): Record<Lane, number> {
    const counts: Record<Lane, number> = { north: 0, east: 0, south: 0, west: 0 };
    this.vehicles.forEach((v) => {
      if (v.distance < 0) {
        counts[v.lane]++;
      }
    });
    return counts;
  }

  public destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.onWindowResize);
    this.renderer.dispose();
    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
