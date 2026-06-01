import { useState } from "react";
import type { BatchListItem } from "@/types";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

const PROCESS_LABELS: Record<string, string> = { juice: "Juice", pulp: "Pulp" };
const SWEETNESS_LABELS: Record<string, string> = {
  dry: "Dry",
  semi_dry: "Semi-Dry",
  semi_sweet: "Semi-Sweet",
  sweet: "Sweet",
};

function BatchCard({ batch }: { batch: BatchListItem }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-xs transition-shadow hover:shadow-sm">
      <div className="flex items-center justify-between p-4">
        <a href={`/batches/${batch.id}`} className="min-w-0 flex-1">
          <p className="truncate font-medium text-gray-900 hover:text-blue-600">{batch.name}</p>
          <p className="mt-0.5 text-sm text-gray-500">
            {batch.batch_date ?? "No date"} &middot;{" "}
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              {PROCESS_LABELS[batch.process_type] ?? batch.process_type}
            </span>
          </p>
        </a>
        <button
          type="button"
          onClick={() => {
            setExpanded((v) => !v);
          }}
          className="ml-3 shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label={expanded ? "Collapse details" : "Expand details"}
        >
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 pt-3 pb-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-gray-500">Volume</dt>
              <dd className="font-medium text-gray-900">
                {batch.target_volume_liters != null ? `${batch.target_volume_liters} L` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Target ABV</dt>
              <dd className="font-medium text-gray-900">{batch.target_abv != null ? `${batch.target_abv}%` : "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Sweetness</dt>
              <dd className="font-medium text-gray-900">
                {SWEETNESS_LABELS[batch.planned_sweetness] ?? batch.planned_sweetness}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}

interface BatchListProps {
  batches: BatchListItem[];
}

export function BatchList({ batches }: BatchListProps) {
  return (
    <div className={cn("grid gap-4", "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3")}>
      {batches.map((batch) => (
        <BatchCard key={batch.id} batch={batch} />
      ))}
    </div>
  );
}
