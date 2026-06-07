import { useState } from "react";
import type { ValidationWarning } from "@/lib/services/batch-validation";

interface ValidationWarningsProps {
  warnings: ValidationWarning[];
  onDismiss?: () => void;
}

const COLLAPSE_THRESHOLD = 3;

export function ValidationWarnings({ warnings, onDismiss }: ValidationWarningsProps) {
  const [expanded, setExpanded] = useState(false);

  if (warnings.length === 0) return null;

  const showAll = expanded || warnings.length <= COLLAPSE_THRESHOLD;
  const visibleWarnings = showAll ? warnings : warnings.slice(0, 2);
  const hiddenCount = warnings.length - 2;
  const isCollapsible = warnings.length > COLLAPSE_THRESHOLD;

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 text-amber-600">⚠️</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-amber-800">
            {warnings.length === 1 ? "1 warning" : `${warnings.length} warnings`}
          </p>
          <ul className="mt-1 space-y-1">
            {visibleWarnings.map((w) => (
              <li key={w.id} className="text-xs text-amber-700">
                {w.message}
              </li>
            ))}
          </ul>
          {isCollapsible && !expanded && (
            <button
              type="button"
              onClick={() => {
                setExpanded(true);
              }}
              className="mt-1 text-xs font-medium text-amber-800 hover:underline"
            >
              and {hiddenCount} more…
            </button>
          )}
          {isCollapsible && expanded && (
            <button
              type="button"
              onClick={() => {
                setExpanded(false);
              }}
              className="mt-1 text-xs font-medium text-amber-800 hover:underline"
            >
              Show less
            </button>
          )}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 text-amber-500 hover:text-amber-700"
            aria-label="Dismiss warnings"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
