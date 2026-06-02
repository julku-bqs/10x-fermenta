import { useState } from "react";
import type { BatchListItem } from "@/types";
import { BatchList } from "./BatchList";
import { BatchTable } from "./BatchTable";
import { LayoutToggle } from "./LayoutToggle";

const STORAGE_KEY = "fermenta:batch-list-layout";

interface BatchListPageProps {
  batches: BatchListItem[];
}

export function BatchListPage({ batches }: BatchListPageProps) {
  const [layout, setLayout] = useState<"cards" | "table">(() => {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    return stored === "table" ? "table" : "cards";
  });

  function handleLayoutChange(next: "cards" | "table") {
    setLayout(next);
    localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm">
            {batches.length} {batches.length === 1 ? "batch" : "batches"}
          </span>
          <LayoutToggle layout={layout} onChange={handleLayoutChange} />
        </div>
        <a
          href="/batches/new"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center rounded-md px-4 py-2 text-sm font-medium shadow-xs"
        >
          + New Batch
        </a>
      </div>

      {batches.length === 0 ? (
        <div className="border-border bg-muted rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground">No batches yet.</p>
          <a href="/batches/new" className="text-primary mt-2 inline-block text-sm hover:underline">
            Create your first batch →
          </a>
        </div>
      ) : layout === "cards" ? (
        <BatchList batches={batches} />
      ) : (
        <BatchTable batches={batches} />
      )}
    </div>
  );
}
