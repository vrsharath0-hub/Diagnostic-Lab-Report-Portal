import React from 'react';
import { Check } from 'lucide-react';
import { OrderStatus } from '../types/portal.ts';
import { formatDateTime } from '../lib/api.ts';

interface StatusProgressBarProps {
  status: OrderStatus;
  orderedAt: string;
  collectedAt: string | null;
  processingAt: string | null;
  completedAt: string | null;
  compact?: boolean;
}

const STEPS: Array<{
  key: OrderStatus;
  label: string;
}> = [
  { key: 'registered', label: 'Registered' },
  { key: 'sample_collected', label: 'Sample Collected' },
  { key: 'processing', label: 'Processing' },
  { key: 'report_ready', label: 'Report Ready' },
];

const ORDER_INDEX: Record<OrderStatus, number> = {
  registered: 0,
  sample_collected: 1,
  processing: 2,
  report_ready: 3,
};

export const StatusProgressBar: React.FC<StatusProgressBarProps> = ({
  status,
  orderedAt,
  collectedAt,
  processingAt,
  completedAt,
  compact = false,
}) => {
  const activeIdx = ORDER_INDEX[status] ?? 0;
  const timestamps: Record<OrderStatus, string | null> = {
    registered: orderedAt,
    sample_collected: collectedAt,
    processing: processingAt,
    report_ready: completedAt,
  };

  return (
    <div className="w-full" role="list" aria-label="Diagnostic test progress">
      <div className="grid grid-cols-4 gap-2">
        {STEPS.map((step, idx) => {
          const isCompleted = idx < activeIdx || (idx === 3 && activeIdx === 3);
          const isCurrent = idx === activeIdx && activeIdx < 3;
          const timeVal = timestamps[step.key];

          return (
            <div key={step.key} role="listitem" className="min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0 transition-colors ${
                    isCompleted
                      ? 'bg-teal-700 text-white'
                      : isCurrent
                        ? 'bg-amber-100 text-amber-800 border border-amber-400'
                        : 'bg-slate-100 text-slate-400 border border-slate-200'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  ) : (
                    <span className="font-mono tabular-nums">{idx + 1}</span>
                  )}
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`h-px flex-1 ${
                      idx < activeIdx ? 'bg-teal-700' : 'bg-slate-200'
                    }`}
                  />
                )}
              </div>
              <p
                className={`text-xs font-medium truncate ${
                  isCompleted
                    ? 'text-slate-900'
                    : isCurrent
                      ? 'text-amber-800'
                      : 'text-slate-400'
                }`}
              >
                {step.label}
              </p>
              {!compact && (
                <p className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5 truncate">
                  {timeVal ? formatDateTime(timeVal) : 'Pending'}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
