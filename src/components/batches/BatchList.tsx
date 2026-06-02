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
    <div className="bg-card rounded-lg shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between p-4">
        <a href={`/batches/${batch.id}`} className="min-w-0 flex-1">
          <p className="text-foreground hover:text-primary truncate font-medium">{batch.name}</p>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {batch.batch_date ?? "No date"} &middot;{" "}
            <span className="bg-secondary/50 text-secondary-foreground inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium">
              {PROCESS_LABELS[batch.process_type] ?? batch.process_type}
            </span>
          </p>
        </a>
        <button
          type="button"
          onClick={() => {
            setExpanded((v) => !v);
          }}
          className="text-muted-foreground hover:bg-muted hover:text-foreground ml-3 shrink-0 rounded p-1"
          aria-label={expanded ? "Collapse details" : "Expand details"}
        >
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
      </div>

      {expanded && (
        <div className="border-border border-t px-4 pt-3 pb-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Volume</dt>
              <dd className="text-foreground font-medium">
                {batch.target_volume_liters != null ? `${batch.target_volume_liters} L` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Target ABV</dt>
              <dd className="text-foreground font-medium">{batch.target_abv != null ? `${batch.target_abv}%` : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Sweetness</dt>
              <dd className="text-foreground font-medium">
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
    // grid-template-rows:masonry is intentionally experimental — works in Firefox natively, silently ignored elsewhere (accepted)
    <div
      className={cn("grid [grid-template-rows:masonry] items-start gap-4", "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3")}
    >
      {batches.map((batch) => (
        <BatchCard key={batch.id} batch={batch} />
      ))}
    </div>
  );
}
