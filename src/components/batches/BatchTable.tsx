import type { BatchListItem } from "@/types";

const PROCESS_LABELS: Record<string, string> = { juice: "Juice", pulp: "Pulp" };
const SWEETNESS_LABELS: Record<string, string> = {
  dry: "Dry",
  semi_dry: "Semi-Dry",
  semi_sweet: "Semi-Sweet",
  sweet: "Sweet",
};

interface BatchTableProps {
  batches: BatchListItem[];
}

export function BatchTable({ batches }: BatchTableProps) {
  return (
    <div className="border-border overflow-x-auto rounded-lg border">
      <table className="divide-border min-w-full divide-y text-sm">
        <thead className="bg-muted">
          <tr>
            {["Name", "Date", "Type", "Volume (L)", "ABV (%)", "Sweetness"].map((h) => (
              <th
                key={h}
                scope="col"
                className="text-muted-foreground px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-border bg-card divide-y">
          {batches.map((batch) => (
            <tr
              key={batch.id}
              onClick={() => {
                window.location.href = `/batches/${batch.id}`;
              }}
              className="hover:bg-muted cursor-pointer"
            >
              <td className="text-foreground px-4 py-3 font-medium">{batch.name}</td>
              <td className="text-muted-foreground px-4 py-3">{batch.batch_date ?? "—"}</td>
              <td className="px-4 py-3">
                <span className="bg-secondary/50 text-secondary-foreground inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium">
                  {PROCESS_LABELS[batch.process_type] ?? batch.process_type}
                </span>
              </td>
              <td className="text-muted-foreground px-4 py-3">{batch.target_volume_liters ?? "—"}</td>
              <td className="text-muted-foreground px-4 py-3">
                {batch.target_abv != null ? `${batch.target_abv}%` : "—"}
              </td>
              <td className="text-muted-foreground px-4 py-3">
                {SWEETNESS_LABELS[batch.planned_sweetness] ?? batch.planned_sweetness}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
