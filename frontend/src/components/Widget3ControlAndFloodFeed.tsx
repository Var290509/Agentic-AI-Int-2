import React from 'react';
import { Siren, Waves, MapPin, ExternalLink, Radio, AlertTriangle } from 'lucide-react';

export interface AccidentNotification {
  accident_id: number;
  location: string;
  coordinates: { lat: number; lng: number };
  google_maps_pin: string;
  timestamp: string;
  snapshot: string;
  alert_text: string;
}

export interface FloodAlertEvent {
  sector: string;
  water_level: string;
  alert_message: string;
  recipients_contacted: number;
  channels: string[];
  timestamp: string;
}

interface Widget3Props {
  accidents: AccidentNotification[];
  floodAlerts: FloodAlertEvent[];
  onTriggerFlood: (sector: string) => void;
  onClearAccident: () => void;
  hasActiveAccident: boolean;
}

export const Widget3ControlAndFloodFeed: React.FC<Widget3Props> = ({
  accidents,
  floodAlerts,
  onTriggerFlood,
  onClearAccident,
  hasActiveAccident,
}) => {
  const latestAccident = accidents[0];
  const latestFlood = floodAlerts[0];

  return (
    <div className="glass-panel rounded-xl p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-rose-950/60 border border-rose-500/50 text-rose-400">
            <Siren className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-rose-400 font-bold">
              Widget 3 • Control Forces & Flood Broadcast
            </h3>
            <p className="text-[10px] text-gray-400">Public Safety Microservice (Member 3 API)</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-400">
          <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
          <span>Forces Linked</span>
        </div>
      </div>

      {/* Accident Dispatch Feed */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3">
        <div className="flex items-center justify-between text-xs font-mono mb-1.5">
          <span className="text-gray-300 font-bold flex items-center gap-1.5">
            <AlertTriangle className={`w-3.5 h-3.5 ${hasActiveAccident ? 'text-rose-400 animate-bounce' : 'text-gray-500'}`} />
            Emergency Force Dispatch
          </span>
          {hasActiveAccident ? (
            <button
              onClick={onClearAccident}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-cyan-300 border border-slate-700"
            >
              Clear Scene
            </button>
          ) : (
            <span className="text-[10px] text-emerald-400 font-mono">No Active Collisions</span>
          )}
        </div>

        {latestAccident ? (
          <div className="bg-slate-950/80 rounded p-2.5 border border-rose-950 flex flex-col gap-1.5 text-xs font-mono">
            <div className="text-rose-300 font-bold text-[11px] leading-tight">
              {latestAccident.alert_text}
            </div>
            <div className="flex items-center justify-between text-[10px] text-gray-400">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-cyan-400" />
                {latestAccident.location}
              </span>
              <a
                href={latestAccident.google_maps_pin}
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:underline flex items-center gap-0.5"
              >
                Maps Pin <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <div className="text-[9px] text-gray-500 flex justify-between">
              <span>Snapshot: {latestAccident.snapshot}</span>
              <span>Dispatched: {new Date(latestAccident.timestamp).toLocaleTimeString()}</span>
            </div>
          </div>
        ) : (
          <div className="text-gray-500 text-[11px] font-mono py-1">
            Monitoring intersection collision telemetry via Member 1 vision...
          </div>
        )}
      </div>

      {/* Flood Broadcast Engine */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-mono font-bold text-cyan-300 flex items-center gap-1.5">
            <Waves className="w-3.5 h-3.5 text-cyan-400" />
            <span>Geo-Targeted Flood Alert Engine</span>
          </div>
          <button
            onClick={() => onTriggerFlood('Sector B')}
            className="py-1 px-3 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 text-xs font-mono font-bold flex items-center gap-1 shadow-[0_0_8px_rgba(6,182,212,0.3)] transition-all"
          >
            <span>Trigger Flood in Zone B</span>
          </button>
        </div>

        {latestFlood ? (
          <div className="bg-slate-950/80 rounded p-2.5 border border-cyan-950 text-xs font-mono flex flex-col gap-1">
            <div className="text-amber-300 font-bold text-[11px]">
              ⚠️ {latestFlood.alert_message}
            </div>
            <div className="flex items-center justify-between text-[10px] text-gray-400">
              <span>Recipients Contacted: <strong className="text-emerald-400">{latestFlood.recipients_contacted} residents</strong></span>
              <span>Water: {latestFlood.water_level}</span>
            </div>
            <div className="text-[9px] text-gray-500 flex justify-between">
              <span>Channels: {latestFlood.channels.join(', ')}</span>
              <span>{new Date(latestFlood.timestamp).toLocaleTimeString()}</span>
            </div>
          </div>
        ) : (
          <div className="text-[10px] text-gray-500 font-mono">
            Water level sensors across Sector A, B, and C nominal. Click above to test mass emergency broadcasting.
          </div>
        )}
      </div>
    </div>
  );
};
