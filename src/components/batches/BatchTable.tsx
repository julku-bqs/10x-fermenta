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
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {["Name", "Date", "Type", "Volume (L)", "ABV (%)", "Sweetness"].map((h) => (
              <th
                key={h}
                scope="col"
                className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {batches.map((batch) => (
            <tr
              key={batch.id}
              onClick={() => {
                window.location.href = `/batches/${batch.id}`;
              }}
              className="cursor-pointer hover:bg-gray-50"
            >
              <td className="px-4 py-3 font-medium text-gray-900">{batch.name}</td>
              <td className="px-4 py-3 text-gray-600">{batch.batch_date ?? "—"}</td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {PROCESS_LABELS[batch.process_type] ?? batch.process_type}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-600">{batch.target_volume_liters ?? "—"}</td>
              <td className="px-4 py-3 text-gray-600">{batch.target_abv != null ? `${batch.target_abv}%` : "—"}</td>
              <td className="px-4 py-3 text-gray-600">
                {SWEETNESS_LABELS[batch.planned_sweetness] ?? batch.planned_sweetness}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
