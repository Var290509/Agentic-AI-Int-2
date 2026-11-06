import React from 'react';
import { Sliders, Gauge, Eye, CloudRain, Flame, ShieldAlert, Video, RefreshCw } from 'lucide-react';
import { Lane, CameraMode } from '../simulation/CitySimulation';

interface ControlPanelProps {
  vehicleSpeed: number;
  onVehicleSpeedChange: (speed: number) => void;
  spawnRates: Record<Lane, number>;
  onSpawnRateChange: (lane: Lane, rate: number) => void;
  cameraMode: CameraMode;
  onCameraModeChange: (mode: CameraMode) => void;
  weather: 'clear' | 'rain' | 'storm';
  onWeatherChange: (w: 'clear' | 'rain' | 'storm') => void;
  onTriggerAccident: () => void;
  onSpawnAmbulance: (lane: Lane) => void;
  onForceAdvanceCycle: () => void;
}

export const SimulationControlPanel: React.FC<ControlPanelProps> = ({
  vehicleSpeed,
  onVehicleSpeedChange,
  spawnRates,
  onSpawnRateChange,
  cameraMode,
  onCameraModeChange,
  weather,
  onWeatherChange,
  onTriggerAccident,
  onSpawnAmbulance,
  onForceAdvanceCycle,
}) => {
  const lanes: Lane[] = ['north', 'east', 'south', 'west'];

  return (
    <div className="glass-panel rounded-xl p-4 flex flex-col gap-3 font-mono text-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-cyan-400">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs uppercase tracking-wider text-cyan-400 font-bold">
              Simulation Controller & 3D Director
            </h3>
            <p className="text-[10px] text-gray-400">Real-Time Traffic, Physics & Multi-Angle Camera Controls</p>
          </div>
        </div>
      </div>

      {/* 1. Camera View Director */}
      <div className="flex flex-col gap-1.5">
        <div className="text-[10px] text-gray-400 uppercase flex items-center gap-1">
          <Eye className="w-3 h-3 text-cyan-400" />
          Camera Director Mode
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {(
            [
              { id: 'orbit', label: '3D Orbit' },
              { id: 'topDown', label: "Bird's-Eye" },
              { id: 'drone', label: 'Drone Patrol' },
              { id: 'intersection', label: 'CCTV Angle' },
            ] as { id: CameraMode; label: string }[]
          ).map((c) => (
            <button
              key={c.id}
              onClick={() => onCameraModeChange(c.id)}
              className={`py-1.5 px-2 rounded border text-center transition-all ${
                cameraMode === c.id
                  ? 'bg-cyan-950 border-cyan-400 text-cyan-300 font-bold shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                  : 'bg-slate-900/60 border-slate-800 text-gray-400 hover:text-white'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Global Vehicle Speed Slider */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-2.5 flex flex-col gap-1">
        <div className="flex justify-between items-center text-[10px]">
          <span className="text-gray-300 flex items-center gap-1 font-bold">
            <Gauge className="w-3 h-3 text-cyan-400" /> Vehicle Speed Multiplier
          </span>
          <span className="text-cyan-300 font-bold">{vehicleSpeed.toFixed(1)}x</span>
        </div>
        <input
          type="range"
          min="0.2"
          max="3.0"
          step="0.1"
          value={vehicleSpeed}
          onChange={(e) => onVehicleSpeedChange(Number(e.target.value))}
          className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-cyan-400"
        />
        <div className="flex justify-between text-[8px] text-gray-500">
          <span>0.2x (Slow-Mo)</span>
          <span>1.0x (Standard)</span>
          <span>3.0x (Hyper)</span>
        </div>
      </div>

      {/* 3. Lane Spawn Densities (North, East, South, West) */}
      <div className="flex flex-col gap-1.5">
        <div className="text-[10px] text-gray-400 uppercase">Lane Spawn Densities (Vehicles / Min)</div>
        <div className="grid grid-cols-4 gap-2">
          {lanes.map((l) => (
            <div key={l} className="bg-slate-900/60 border border-slate-800 rounded p-1.5 text-center">
              <div className="text-[9px] uppercase text-gray-400">{l}</div>
              <div className="text-xs font-bold text-white my-0.5">{spawnRates[l]}</div>
              <input
                type="range"
                min="0"
                max="25"
                value={spawnRates[l]}
                onChange={(e) => onSpawnRateChange(l, Number(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-cyan-400"
              />
            </div>
          ))}
        </div>
      </div>

      {/* 4. Incident Triggers & Emergency Injection */}
      <div className="flex flex-col gap-1.5">
        <div className="text-[10px] text-gray-400 uppercase">Simulate Critical Events</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onSpawnAmbulance('west')}
            className="py-1.5 px-2 rounded bg-rose-950/70 hover:bg-rose-900 border border-rose-500/50 text-rose-300 font-bold flex items-center justify-center gap-1.5 shadow-[0_0_8px_rgba(239,68,68,0.25)] transition-all"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Spawn Ambulance (West)</span>
          </button>
          <button
            onClick={onTriggerAccident}
            className="py-1.5 px-2 rounded bg-amber-950/70 hover:bg-amber-900 border border-amber-500/50 text-amber-300 font-bold flex items-center justify-center gap-1.5 shadow-[0_0_8px_rgba(245,158,11,0.25)] transition-all"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Trigger Junction Accident</span>
          </button>
        </div>
      </div>
    </div>
  );
};
