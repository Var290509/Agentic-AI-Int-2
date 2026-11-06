import React, { useState } from 'react';
import { Scale, CheckCircle2, XCircle, FileText, Camera, ShieldCheck, UserCheck } from 'lucide-react';

export interface ViolationFine {
  id: number;
  violation: string;
  vehicle_plate: string;
  fine_amount: number;
  evidence_image: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  detected_at: string;
  reviewed_at?: string;
  reviewer_id?: string;
  receipt_id?: string;
}

interface Widget2Props {
  fines: ViolationFine[];
  onVerify: (id: number, action: 'APPROVE' | 'REJECT') => void;
}

export const Widget2HITLFineReview: React.FC<Widget2Props> = ({ fines, onVerify }) => {
  const [selectedFineId, setSelectedFineId] = useState<number | null>(fines[0]?.id || null);

  const pendingFines = fines.filter((f) => f.status === 'PENDING');
  const reviewedFines = fines.filter((f) => f.status !== 'PENDING');

  const activeFine = fines.find((f) => f.id === selectedFineId) || pendingFines[0] || reviewedFines[0];

  return (
    <div className="glass-panel rounded-xl p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-agentViolet/20 border border-agentViolet/50 text-agentViolet">
            <Scale className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-agentViolet font-bold">
              Widget 2 • Human-in-the-Loop Fine Queue
            </h3>
            <p className="text-[10px] text-gray-400">Single-Human Verification Guardrail (Member 3 API)</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700 text-[10px] font-mono text-cyan-400">
          <UserCheck className="w-3 h-3 text-cyan-400" />
          <span>Officer #402 Logged In</span>
        </div>
      </div>

      {activeFine ? (
        <div className="flex flex-col gap-3">
          {/* Violation Evidence Card */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3 flex gap-3">
            {/* Mock Camera Snapshot Viewport */}
            <div className="w-32 h-24 bg-slate-950 border border-cyan-500/30 rounded-lg relative overflow-hidden flex flex-col items-center justify-center text-center p-2 group">
              <div className="absolute top-1 left-1 bg-black/60 px-1 py-0.5 rounded text-[8px] font-mono text-cyan-400 flex items-center gap-1">
                <Camera className="w-2.5 h-2.5 text-cyan-400" /> CCTV-CAM-04
              </div>
              <div className="text-2xl mt-2">🚗💨</div>
              <div className="text-[9px] font-mono text-gray-400 mt-1 truncate max-w-full">
                {activeFine.evidence_image}
              </div>
              <div className="absolute bottom-0 inset-x-0 bg-red-950/80 text-[8px] font-mono text-rose-300 py-0.5">
                STOP-LINE CROSSED
              </div>
            </div>

            {/* Violation Details */}
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-rose-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                    {activeFine.violation}
                  </span>
                  <span className="text-sm font-mono font-black text-amber-400">
                    ₹{activeFine.fine_amount}
                  </span>
                </div>
                <div className="text-xs font-mono text-gray-200 mt-1">
                  Plate:{' '}
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300 font-bold tracking-wider">
                    {activeFine.vehicle_plate}
                  </span>
                </div>
                <div className="text-[10px] text-gray-400 font-mono mt-1">
                  Detected: {new Date(activeFine.detected_at).toLocaleTimeString()}
                </div>
              </div>

              {/* Status or Actions */}
              {activeFine.status === 'PENDING' ? (
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => onVerify(activeFine.id, 'APPROVE')}
                    className="flex-1 py-1.5 px-2 rounded bg-emerald-600/80 hover:bg-emerald-500 border border-emerald-400/50 text-white font-mono text-xs font-bold flex items-center justify-center gap-1 shadow-[0_0_8px_rgba(16,185,129,0.3)] transition-all"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve Fine</span>
                  </button>
                  <button
                    onClick={() => onVerify(activeFine.id, 'REJECT')}
                    className="py-1.5 px-3 rounded bg-slate-800 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-500/50 text-gray-300 hover:text-rose-300 font-mono text-xs font-bold flex items-center justify-center gap-1 transition-all"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                </div>
              ) : (
                <div className="mt-2 bg-slate-950/60 rounded p-2 border border-slate-800 text-[10px] font-mono">
                  {activeFine.status === 'APPROVED' ? (
                    <div className="text-emerald-400 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> Approved Receipt:
                      </span>
                      <span className="font-bold text-white">{activeFine.receipt_id}</span>
                    </div>
                  ) : (
                    <div className="text-rose-400 flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" /> Dismissed by Reviewing Officer
                    </div>
                  )}
                  <div className="text-gray-500 mt-0.5">
                    Reviewed: {activeFine.reviewed_at ? new Date(activeFine.reviewed_at).toLocaleTimeString() : 'N/A'} by {activeFine.reviewer_id}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Pending / Processed Selector Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px] font-mono">
            <span className="text-gray-400 uppercase text-[9px] mr-1">Queue:</span>
            {fines.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedFineId(f.id)}
                className={`px-2 py-1 rounded border whitespace-nowrap transition-all ${
                  f.id === activeFine.id
                    ? 'bg-agentViolet/30 border-agentViolet text-cyan-200 font-bold'
                    : f.status === 'PENDING'
                    ? 'bg-slate-900 border-amber-500/40 text-amber-300'
                    : 'bg-slate-950 border-slate-800 text-gray-500'
                }`}
              >
                #{f.id} {f.vehicle_plate} ({f.status})
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-6 text-xs text-gray-500 font-mono">
          No violations currently awaiting officer overview.
        </div>
      )}
    </div>
  );
};
