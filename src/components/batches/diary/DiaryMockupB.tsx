import { useState } from "react";
import { cn } from "@/lib/utils";
import type { MockDiaryEntry } from "./mockData";

interface DiaryMockupBProps {
  entries: MockDiaryEntry[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function EntryRow({ entry }: { entry: MockDiaryEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn("border-border border-b last:border-b-0", entry.completed && "bg-muted/30")}>
      <button
        type="button"
        onClick={() => {
          setExpanded(!expanded);
        }}
        className="grid w-full grid-cols-[3rem_1fr_auto] items-center gap-3 px-3 py-2.5 text-left"
      >
        {/* Date column */}
        <span className="text-muted-foreground text-xs font-medium tabular-nums">{formatDate(entry.entry_date)}</span>

        {/* Description column */}
        <span
          className={cn("truncate text-sm", entry.completed ? "text-muted-foreground line-through" : "text-foreground")}
        >
          {entry.description}
        </span>

        {/* Status column */}
        <div className="flex items-center gap-2">
          {entry.notes && <span className="text-muted-foreground text-xs">📝</span>}
          <span
            className={cn(
              "inline-flex h-5 w-5 items-center justify-center rounded text-xs",
              entry.completed ? "bg-primary/15 text-primary" : "border-border border",
            )}
          >
            {entry.completed && "✓"}
          </span>
        </div>
      </button>

      {/* Expandable notes */}
      {expanded && entry.notes && (
        <div className="bg-muted/50 px-3 py-2.5 pl-[calc(3rem+0.75rem)]">
          <p className="text-muted-foreground max-h-20 overflow-y-auto text-xs leading-relaxed">{entry.notes}</p>
        </div>
      )}
    </div>
  );
}

export function DiaryMockupB({ entries }: DiaryMockupBProps) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-foreground text-sm font-semibold">Process Diary</h3>
        <span className="text-muted-foreground text-xs">
          {entries.filter((e) => e.completed).length}/{entries.length} completed
        </span>
      </div>
      <div className="border-border rounded-lg border">
        {/* Header */}
        <div className="border-border grid grid-cols-[3rem_1fr_auto] gap-3 border-b px-3 py-2">
          <span className="text-muted-foreground text-xs font-medium">Date</span>
          <span className="text-muted-foreground text-xs font-medium">Step</span>
          <span className="text-muted-foreground text-xs font-medium">Done</span>
        </div>
        {/* Rows */}
        {entries.map((entry) => (
          <EntryRow key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}
