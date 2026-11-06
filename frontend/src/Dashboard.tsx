import React, { useEffect, useRef, useState } from 'react';
import { CitySimulation, Lane, LightState, CameraMode } from './simulation/CitySimulation';
import { Widget1IntersectionTimer } from './components/Widget1IntersectionTimer';
import { Widget2HITLFineReview, ViolationFine } from './components/Widget2HITLFineReview';
import { Widget3ControlAndFloodFeed, AccidentNotification, FloodAlertEvent } from './components/Widget3ControlAndFloodFeed';
import { Widget4StreetLightEnergy } from './components/Widget4StreetLightEnergy';
import { SimulationControlPanel } from './components/SimulationControlPanel';
import {
  Activity,
  Layers,
  ChevronDown,
  ChevronUp,
  Cpu,
  Wifi,
  Radio,
  Sliders,
  Maximize2
} from 'lucide-react';

const CYCLE_ORDER: Lane[] = ['north', 'east', 'south', 'west'];

export const Dashboard: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<CitySimulation | null>(null);

  // Simulation Controls State
  const [vehicleSpeed, setVehicleSpeed] = useState<number>(1.0);
  const [spawnRates, setSpawnRates] = useState<Record<Lane, number>>({
    north: 14,
    east: 6,
    south: 12,
    west: 5,
  });
  const [daylightPercent, setDaylightPercent] = useState<number>(85);
  const [cameraMode, setCameraMode] = useState<CameraMode>('orbit');
  const [weather, setWeather] = useState<'clear' | 'rain' | 'storm'>('clear');

  // Traffic Agent State (Member 2 Brain)
  const [cycleIndex, setCycleIndex] = useState<number>(0);
  const [phase, setPhase] = useState<LightState>('GREEN');
  const [remainingTime, setRemainingTime] = useState<number>(18.0);
  const [totalDuration, setTotalDuration] = useState<number>(20.0);
  const [isPreempted, setIsPreempted] = useState<boolean>(false);
  const [preemptedLane, setPreemptedLane] = useState<Lane | null>(null);
  const [pausedState, setPausedState] = useState<{ lane: Lane; remainingTime: number } | null>(null);

  const [vehicleCounts, setVehicleCounts] = useState<Record<Lane, number>>({
    north: 19,
    east: 4,
    south: 11,
    west: 3,
  });

  const [signalStates, setSignalStates] = useState<Record<Lane, LightState>>({
    north: 'GREEN',
    east: 'RED',
    south: 'RED',
    west: 'RED',
  });

  // Public Safety & HITL State (Member 3)
  const [fines, setFines] = useState<ViolationFine[]>([
    {
      id: 101,
      violation: 'Red Light Jump',
      vehicle_plate: 'AP-39-BK-4021',
      fine_amount: 1000,
      evidence_image: 'violation_12.jpg',
      status: 'PENDING',
      detected_at: new Date(Date.now() - 120000).toISOString(),
    },
    {
      id: 102,
      violation: 'Helmetless Riding',
      vehicle_plate: 'MH-12-DE-1492',
      fine_amount: 500,
      evidence_image: 'violation_08.jpg',
      status: 'PENDING',
      detected_at: new Date(Date.now() - 60000).toISOString(),
    },
    {
      id: 103,
      violation: 'Wrong-Way Driving',
      vehicle_plate: 'KA-04-MB-8820',
      fine_amount: 1500,
      evidence_image: 'violation_03.jpg',
      status: 'PENDING',
      detected_at: new Date(Date.now() - 30000).toISOString(),
    },
  ]);

  const [accidents, setAccidents] = useState<AccidentNotification[]>([]);
  const [floodAlerts, setFloodAlerts] = useState<FloodAlertEvent[]>([]);
  const [hasActiveAccident, setHasActiveAccident] = useState<boolean>(false);

  // Collapsible UI Trays
  const [showLeftDrawer, setShowLeftDrawer] = useState<boolean>(true);
  const [showRightDrawer, setShowRightDrawer] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'widgets' | 'controls'>('widgets');

  // 1. Initialize 3D City Simulation
  useEffect(() => {
    if (!mountRef.current) return;
    const sim = new CitySimulation(mountRef.current);
    simRef.current = sim;

    return () => {
      sim.destroy();
      simRef.current = null;
    };
  }, []);

  // 2. Member 2 Dynamic Formula: min(60s, max(15s, 10s + 2s * Vehicle Count))
  const calculateGreenDuration = (lane: Lane, count: number): number => {
    return Math.min(60, Math.max(15, 10 + 2 * count));
  };

  // 3. Main Traffic Agent Timer Loop (100ms tick)
  useEffect(() => {
    const timer = setInterval(() => {
      // Read latest counts from simulation if active
      if (simRef.current) {
        const liveCounts = simRef.current.getVehicleCounts();
        setVehicleCounts({
          north: Math.max(liveCounts.north, 4),
          east: Math.max(liveCounts.east, 2),
          south: Math.max(liveCounts.south, 3),
          west: Math.max(liveCounts.west, 2),
        });
      }

      setRemainingTime((prev) => {
        if (isPreempted) {
          // Preemption countdown
          if (prev <= 0.1) {
            handleResumeAfterAmbulance();
            return 15.0;
          }
          return Math.max(0, prev - 0.1);
        }

        if (prev <= 0.1) {
          // Transition phase
          if (phase === 'GREEN') {
            setPhase('YELLOW');
            return 3.0; // yellow clearance
          } else {
            // Advance to next lane in cyclic sequence: North -> East -> South -> West
            const nextIdx = (cycleIndex + 1) % CYCLE_ORDER.length;
            const nextLane = CYCLE_ORDER[nextIdx];
            setCycleIndex(nextIdx);
            setPhase('GREEN');
            const nextGreen = calculateGreenDuration(nextLane, vehicleCounts[nextLane]);
            setTotalDuration(nextGreen);
            return nextGreen;
          }
        }
        return Math.max(0, prev - 0.1);
      });
    }, 100);

    return () => clearInterval(timer);
  }, [cycleIndex, phase, isPreempted, vehicleCounts]);

  // 4. Synchronize Signals with 3D Simulation
  useEffect(() => {
    const activeLane = isPreempted && preemptedLane ? preemptedLane : CYCLE_ORDER[cycleIndex];
    const newSignals: Record<Lane, LightState> = {
      north: 'RED',
      east: 'RED',
      south: 'RED',
      west: 'RED',
    };
    newSignals[activeLane] = phase;
    setSignalStates(newSignals);

    if (simRef.current) {
      simRef.current.updateSignalStates(newSignals);
    }
  }, [cycleIndex, phase, isPreempted, preemptedLane]);

  // 5. Member 2: Ambulance Preemption (Step 1 & 2)
  const handleSimulateAmbulance = (lane: Lane) => {
    if (isPreempted) return;

    const currentLane = CYCLE_ORDER[cycleIndex];
    // Step 1: Save state in memory
    setPausedState({
      lane: currentLane,
      remainingTime: Math.round(remainingTime * 10) / 10,
    });

    // Step 2: Preempt all other lanes Red, set ambulance lane Green
    setIsPreempted(true);
    setPreemptedLane(lane);
    setPhase('GREEN');
    setRemainingTime(16.0); // preemption duration
    setTotalDuration(16.0);

    // Spawn 3D Ambulance in simulation
    if (simRef.current) {
      simRef.current.spawnVehicle(lane, 'ambulance');
    }
  };

  // 6. Member 2: Resume Normal Cycle (Step 3)
  const handleResumeAfterAmbulance = () => {
    if (pausedState) {
      const restoredIdx = CYCLE_ORDER.indexOf(pausedState.lane);
      setCycleIndex(restoredIdx !== -1 ? restoredIdx : 0);
      setRemainingTime(pausedState.remainingTime);
      setTotalDuration(pausedState.remainingTime);
      setPhase('GREEN');
    }
    setIsPreempted(false);
    setPreemptedLane(null);
    setPausedState(null);
  };

  const handleForceAdvanceCycle = () => {
    const nextIdx = (cycleIndex + 1) % CYCLE_ORDER.length;
    const nextLane = CYCLE_ORDER[nextIdx];
    setCycleIndex(nextIdx);
    setPhase('GREEN');
    const greenT = calculateGreenDuration(nextLane, vehicleCounts[nextLane]);
    setTotalDuration(greenT);
    setRemainingTime(greenT);
  };

  // 7. Member 3: HITL Verification
  const handleVerifyFine = async (fineId: number, action: 'APPROVE' | 'REJECT') => {
    const nowStr = new Date().toISOString();
    const receiptId = `REC-TN-2026-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    // Try posting to real backend, fallback to local state
    try {
      await fetch(`http://localhost:8000/api/fines/${fineId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reviewer_id: 'OFFICER_PATROL_402' }),
      });
    } catch {
      // Backend not running; fallback succeeds
    }

    setFines((prev) =>
      prev.map((f) => {
        if (f.id === fineId) {
          return {
            ...f,
            status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
            reviewed_at: nowStr,
            reviewer_id: 'OFFICER_PATROL_402',
            receipt_id: action === 'APPROVE' ? receiptId : undefined,
          };
        }
        return f;
      })
    );
  };

  // 8. Member 3: Accident Trigger & Dispatch API
  const handleTriggerAccident = async () => {
    setHasActiveAccident(true);
    if (simRef.current) {
      simRef.current.triggerAccident();
    }

    const payload: AccidentNotification = {
      accident_id: Date.now(),
      location: 'Junction 4 - Main Rd (13.556° N, 80.026° E)',
      coordinates: { lat: 13.556, lng: 80.026 },
      google_maps_pin: 'https://www.google.com/maps?q=13.556,80.026',
      timestamp: new Date().toISOString(),
      snapshot: 'frame_04.jpg',
      alert_text: '🚨 CODE RED ACCIDENT DISPATCH: Stalled/Crashed vehicles reported at Junction 4. Emergency units en route.',
    };

    try {
      await fetch('http://localhost:8000/api/accidents/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accident_detected: true,
          location: payload.location,
          snapshot: payload.snapshot,
        }),
      });
    } catch {
      // Local fallback
    }

    setAccidents((prev) => [payload, ...prev]);
  };

  const handleClearAccident = () => {
    setHasActiveAccident(false);
    if (simRef.current) {
      simRef.current.clearAccident();
    }
  };

  // 9. Member 3: Flood Alert Trigger
  const handleTriggerFlood = async (sector: string) => {
    const payload: FloodAlertEvent = {
      sector,
      water_level: '1.45 meters',
      alert_message: `Rising water (1.45m) detected in ${sector}. Move to higher ground immediately.`,
      recipients_contacted: 42,
      channels: ['SMS (Twilio)', 'Mobile Push', 'City Siren Alert'],
      timestamp: new Date().toISOString(),
    };

    try {
      await fetch('http://localhost:8000/api/safety/flood-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sector, water_level_meters: 1.45 }),
      });
    } catch {
      // Local fallback
    }

    setFloodAlerts((prev) => [payload, ...prev]);
  };

  // 10. Member 2: Daylight Change Handler
  const handleDaylightChange = (value: number) => {
    setDaylightPercent(value);
    if (simRef.current) {
      simRef.current.updateLighting(value);
    }
  };

  // 11. Vehicle Speed & Spawn Handler
  const handleVehicleSpeedChange = (speed: number) => {
    setVehicleSpeed(speed);
    if (simRef.current) {
      simRef.current.config.vehicleSpeedMultiplier = speed;
    }
  };

  const handleSpawnRateChange = (lane: Lane, rate: number) => {
    const updated = { ...spawnRates, [lane]: rate };
    setSpawnRates(updated);
    if (simRef.current) {
      simRef.current.config.spawnRates = updated;
    }
  };

  const handleCameraModeChange = (mode: CameraMode) => {
    setCameraMode(mode);
    if (simRef.current) {
      simRef.current.setCameraMode(mode);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#050811] text-gray-100 font-sans">
      {/* 3D WebGL Canvas Layer (Full Screen) */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full z-0 cursor-grab active:cursor-grabbing" />

      {/* Top Floating Telemetry Status Bar */}
      <header className="absolute top-4 inset-x-4 z-20 flex items-center justify-between pointer-events-none">
        <div className="glass-panel rounded-xl px-4 py-2.5 flex items-center gap-3 pointer-events-auto shadow-cyan-glow">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-agentViolet flex items-center justify-center text-white font-black text-sm shadow-[0_0_12px_#06B6D4]">
            TM
          </div>
          <div>
            <h1 className="text-sm font-bold font-mono tracking-tight text-white flex items-center gap-2">
              TEAM MIRAI <span className="text-cyan-400 font-normal">| PS-4 Smart City Platform</span>
            </h1>
            <p className="text-[10px] text-gray-400 font-mono">
              Autonomous Traffic • Emergency Preemption • HITL Fines • Adaptive Energy
            </p>
          </div>
        </div>

        {/* System Health Status Pills */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="glass-panel px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-mono text-cyan-300">
            <Cpu className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>AI Brain: Active</span>
          </div>
          <div className="glass-panel px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-mono text-emerald-400">
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <span>Telemetry: 60 FPS</span>
          </div>
          <button
            onClick={() => {
              setShowLeftDrawer(!showLeftDrawer);
              setShowRightDrawer(!showRightDrawer);
            }}
            className="glass-panel p-2 rounded-lg text-gray-300 hover:text-white transition-all pointer-events-auto"
            title="Toggle All Panels"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Left Collapsible Drawer: Operational Widgets (Widget 1 & Widget 4) */}
      {showLeftDrawer && (
        <aside className="absolute top-20 left-4 bottom-4 w-96 z-10 flex flex-col gap-3 overflow-y-auto pr-1 pointer-events-auto transition-all">
          <Widget1IntersectionTimer
            currentLane={isPreempted && preemptedLane ? preemptedLane : CYCLE_ORDER[cycleIndex]}
            phase={phase}
            remainingTime={remainingTime}
            totalDuration={totalDuration}
            vehicleCounts={vehicleCounts}
            signalStates={signalStates}
            isPreempted={isPreempted}
            preemptedLane={preemptedLane}
            pausedState={pausedState}
            onSimulateAmbulance={handleSimulateAmbulance}
            onForceAdvanceCycle={handleForceAdvanceCycle}
          />
          <Widget4StreetLightEnergy
            daylightPercent={daylightPercent}
            onDaylightChange={handleDaylightChange}
          />
        </aside>
      )}

      {/* Right Collapsible Drawer: Governance & Safety Widgets (Widget 2 & Widget 3) or Simulation Controls */}
      {showRightDrawer && (
        <aside className="absolute top-20 right-4 bottom-4 w-[420px] z-10 flex flex-col gap-3 overflow-y-auto pl-1 pointer-events-auto transition-all">
          {/* Tab Switcher: Operations vs Simulation Controls */}
          <div className="glass-panel rounded-lg p-1 flex gap-1 font-mono text-xs">
            <button
              onClick={() => setActiveTab('widgets')}
              className={`flex-1 py-1.5 rounded text-center transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'widgets'
                  ? 'bg-cyan-950 border border-cyan-400/60 text-cyan-300 font-bold shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Safety & Governance</span>
            </button>
            <button
              onClick={() => setActiveTab('controls')}
              className={`flex-1 py-1.5 rounded text-center transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'controls'
                  ? 'bg-cyan-950 border border-cyan-400/60 text-cyan-300 font-bold shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Simulation Controls</span>
            </button>
          </div>

          {activeTab === 'widgets' ? (
            <>
              <Widget2HITLFineReview fines={fines} onVerify={handleVerifyFine} />
              <Widget3ControlAndFloodFeed
                accidents={accidents}
                floodAlerts={floodAlerts}
                onTriggerFlood={handleTriggerFlood}
                onClearAccident={handleClearAccident}
                hasActiveAccident={hasActiveAccident}
              />
            </>
          ) : (
            <SimulationControlPanel
              vehicleSpeed={vehicleSpeed}
              onVehicleSpeedChange={handleVehicleSpeedChange}
              spawnRates={spawnRates}
              onSpawnRateChange={handleSpawnRateChange}
              cameraMode={cameraMode}
              onCameraModeChange={handleCameraModeChange}
              weather={weather}
              onWeatherChange={setWeather}
              onTriggerAccident={handleTriggerAccident}
              onSpawnAmbulance={handleSimulateAmbulance}
              onForceAdvanceCycle={handleForceAdvanceCycle}
            />
          )}
        </aside>
      )}

      {/* Bottom Floating Navigation Hint */}
      <footer className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 glass-panel px-4 py-1.5 rounded-full text-[11px] font-mono text-gray-400 flex items-center gap-3 pointer-events-none">
        <span>🎮 Left-Drag: Orbit 3D</span>
        <span className="text-cyan-500">•</span>
        <span>Scroll: Zoom</span>
        <span className="text-cyan-500">•</span>
        <span>Current Camera: <strong className="text-cyan-300 uppercase">{cameraMode}</strong></span>
      </footer>
    </div>
  );
};
