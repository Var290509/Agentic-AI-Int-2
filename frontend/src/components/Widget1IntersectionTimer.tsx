import React from 'react';
import { Compass, ShieldAlert, RotateCw, Activity } from 'lucide-react';
import { Lane, LightState } from '../simulation/CitySimulation';

interface Widget1Props {
  currentLane: Lane;
  phase: LightState;
  remainingTime: number;
  totalDuration: number;
  vehicleCounts: Record<Lane, number>;
  signalStates: Record<Lane, LightState>;
  isPreempted: boolean;
  preemptedLane: Lane | null;
  pausedState: { lane: Lane; remainingTime: number } | null;
  onSimulateAmbulance: (lane: Lane) => void;
  onForceAdvanceCycle: () => void;
}

export const Widget1IntersectionTimer: React.FC<Widget1Props> = ({
  currentLane,
  phase,
  remainingTime,
  totalDuration,
  vehicleCounts,
  signalStates,
  isPreempted,
  preemptedLane,
  pausedState,
  onSimulateAmbulance,
  onForceAdvanceCycle,
}) => {
  const lanes: Lane[] = ['north', 'east', 'south', 'west'];

  const getSignalColor = (state: LightState) => {
    switch (state) {
      case 'GREEN': return 'text-emerald-400 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]';
      case 'YELLOW': return 'text-amber-400 border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]';
      case 'RED': return 'text-rose-400 border-rose-500 shadow-[0_0_12px_rgba(239,68,68,0.3)]';
    }
  };

  const calculateFormulaGreen = (count: number) => {
    return Math.min(60, Math.max(15, 10 + 2 * count));
  };

  return (
    <div className="glass-panel rounded-xl p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-cyan-400">
            <Compass className="w-4 h-4 animate-spin-slow" />
          </div>
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-bold">
              Widget 1 • Cyclic Signal & Preemption
            </h3>
            <p className="text-[10px] text-gray-400">Member 2 Brain: North → East → South → West</p>
          </div>
        </div>
        {isPreempted && (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500 animate-pulse">
            AMBULANCE PREEMPTION
          </span>
        )}
      </div>

      {/* Main Countdown & State Display */}
      <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-800 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase font-mono text-gray-400">Active Green Phase</div>
          <div className="text-xl font-black font-mono tracking-tight text-white flex items-center gap-2">
            <span className="capitalize text-cyan-300">{currentLane} Lane</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${getSignalColor(phase)}`}>
              {phase}
            </span>
          </div>
          <div className="text-[10px] font-mono text-cyan-400/80 mt-1">
            Allocated: min(60s, max(15s, 10s + 2s × {vehicleCounts[currentLane]})) = {calculateFormulaGreen(vehicleCounts[currentLane])}s
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-black font-mono text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.6)]">
            {remainingTime.toFixed(1)}s
          </div>
          <div className="text-[10px] text-gray-400 font-mono">
            {phase === 'YELLOW' ? 'Clearance Phase' : `Remaining / ${totalDuration}s`}
          </div>
        </div>
      </div>

      {/* Paused State Recovery Status */}
      {isPreempted && pausedState && (
        <div className="bg-amber-950/40 border border-amber-500/50 rounded-lg p-2.5 text-xs text-amber-200 flex items-center justify-between">
          <div>
            <span className="font-bold font-mono">Memory Snapshot:</span> Paused{' '}
            <span className="font-bold capitalize text-amber-300">{pausedState.lane}</span> with{' '}
            <span className="font-bold">{pausedState.remainingTime}s</span> remaining.
          </div>
          <div className="text-[10px] font-mono text-amber-400 animate-pulse">Will Resume Post-Clearance</div>
        </div>
      )}

      {/* 4-Lane Real-time Telemetry Grid */}
      <div className="grid grid-cols-4 gap-2">
        {lanes.map((l) => {
          const isSelected = l === currentLane;
          const sig = signalStates[l];
          const count = vehicleCounts[l];
          return (
            <div
              key={l}
              className={`p-2 rounded-lg border text-center transition-all ${
                isSelected
                  ? 'bg-cyan-950/40 border-cyan-500/60 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                  : 'bg-slate-900/40 border-slate-800'
              }`}
            >
              <div className="text-[10px] font-mono uppercase text-gray-400 flex items-center justify-center gap-1">
                <span>{l}</span>
              </div>
              <div className="text-base font-bold font-mono text-white mt-0.5">{count} <span className="text-[9px] text-gray-400 font-normal">veh</span></div>
              <div className="mt-1">
                <span
                  className={`inline-block w-2.5 h-2.5 rounded-full ${
                    sig === 'GREEN'
                      ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]'
                      : sig === 'YELLOW'
                      ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]'
                      : 'bg-rose-500/70 shadow-[0_0_6px_#ef4444]'
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mt-1">
        <button
          onClick={() => onSimulateAmbulance('east')}
          className="flex-1 py-2 px-3 rounded-lg bg-gradient-to-r from-rose-900/80 to-rose-700/80 hover:from-rose-800 hover:to-rose-600 border border-rose-500/60 text-white font-mono text-xs font-bold flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(239,68,68,0.3)] transition-all"
        >
          <ShieldAlert className="w-4 h-4 text-rose-300 animate-bounce" />
          <span>Simulate Ambulance in East Lane</span>
        </button>
        <button
          onClick={onForceAdvanceCycle}
          title="Force Advance Cycle"
          className="py-2 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-gray-300 hover:text-white transition-all"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
