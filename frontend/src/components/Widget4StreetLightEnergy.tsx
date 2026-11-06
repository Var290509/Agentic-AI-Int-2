import React from 'react';
import { SunMedium, Moon, Zap, Lightbulb, TrendingUp } from 'lucide-react';

interface Widget4Props {
  daylightPercent: number;
  onDaylightChange: (value: number) => void;
}

export const Widget4StreetLightEnergy: React.FC<Widget4Props> = ({
  daylightPercent,
  onDaylightChange,
}) => {
  // Exact Logic:
  // - > 70% daylight: 0% power (OFF)
  // - 30% - 70% natural light: scale inversely between 30% and 70% brightness
  // - < 30% natural light: 80% to 100% brightness
  let streetLightBrightness = 0;
  let powerState: 'OFF' | 'DIM' | 'ON' = 'OFF';

  if (daylightPercent > 70) {
    streetLightBrightness = 0;
    powerState = 'OFF';
  } else if (daylightPercent >= 30) {
    streetLightBrightness = 100 - daylightPercent;
    powerState = 'DIM';
  } else {
    streetLightBrightness = 100 - (daylightPercent / 30) * 20;
    powerState = 'ON';
  }

  const energySaved = Math.max(0, Math.min(100, 100 - streetLightBrightness));

  return (
    <div className="glass-panel rounded-xl p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-950/60 border border-amber-500/40 text-amber-400">
            <SunMedium className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold">
              Widget 4 • Natural-Light Street Light Energy Agent
            </h3>
            <p className="text-[10px] text-gray-400">Adaptive Ambient Lux Optimization (Member 2 Brain)</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700 text-[10px] font-mono text-emerald-400 font-bold">
          <TrendingUp className="w-3 h-3 text-emerald-400" />
          <span>{energySaved.toFixed(1)}% Energy Saved</span>
        </div>
      </div>

      {/* Interactive Daylight Slider */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-gray-300 flex items-center gap-1.5 font-bold">
            <SunMedium className="w-3.5 h-3.5 text-amber-400" />
            Natural Ambient Daylight Sensor
          </span>
          <span className="text-cyan-300 font-bold text-sm">{daylightPercent}%</span>
        </div>

        <div className="relative flex items-center">
          <Moon className="w-3.5 h-3.5 text-blue-400 mr-2" />
          <input
            type="range"
            min="0"
            max="100"
            value={daylightPercent}
            onChange={(e) => onDaylightChange(Number(e.target.value))}
            className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
          <SunMedium className="w-3.5 h-3.5 text-amber-400 ml-2" />
        </div>

        <div className="flex justify-between text-[9px] font-mono text-gray-500 px-6">
          <span>0% (Night)</span>
          <span>30% (Twilight)</span>
          <span>70% (Cloudy)</span>
          <span>100% (Sunny)</span>
        </div>
      </div>

      {/* Grid of Power Status & Energy Savings Telemetry */}
      <div className="grid grid-cols-3 gap-2 text-center font-mono">
        {/* Street Light Brightness */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2.5">
          <div className="text-[10px] text-gray-400 uppercase">Lamp Brightness</div>
          <div className="text-lg font-black text-amber-300 mt-0.5 flex items-center justify-center gap-1">
            <Lightbulb
              className="w-4 h-4"
              style={{
                opacity: Math.max(0.2, streetLightBrightness / 100),
                filter: streetLightBrightness > 0 ? `drop-shadow(0 0 6px #fef08a)` : 'none',
              }}
            />
            {streetLightBrightness.toFixed(0)}%
          </div>
          <div className="text-[9px] text-gray-500 mt-0.5">Power State: {powerState}</div>
        </div>

        {/* Operating Mode */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2.5">
          <div className="text-[10px] text-gray-400 uppercase">Lighting Phase</div>
          <div className="text-sm font-bold text-cyan-300 mt-1">
            {daylightPercent > 70 ? 'Daylight (OFF)' : daylightPercent >= 30 ? 'Twilight Scaled' : 'Night Maximum'}
          </div>
          <div className="text-[9px] text-gray-500 mt-0.5">
            {daylightPercent > 70 ? '>70% Sun' : daylightPercent >= 30 ? '30%-70% Light' : '<30% Darkness'}
          </div>
        </div>

        {/* Cumulative Energy Saved */}
        <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-lg p-2.5">
          <div className="text-[10px] text-emerald-400 uppercase">Power Saved</div>
          <div className="text-lg font-black text-emerald-400 mt-0.5 flex items-center justify-center gap-1">
            <Zap className="w-4 h-4 text-emerald-400" />
            {energySaved.toFixed(0)}%
          </div>
          <div className="text-[9px] text-emerald-500 mt-0.5">Grid Eco-Saving</div>
        </div>
      </div>
    </div>
  );
};
