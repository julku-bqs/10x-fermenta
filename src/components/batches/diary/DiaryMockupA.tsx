import { useState } from "react";
import { cn } from "@/lib/utils";
import type { MockDiaryEntry } from "./mockData";

interface DiaryMockupAProps {
  entries: MockDiaryEntry[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function EntryCard({ entry }: { entry: MockDiaryEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn("border-border rounded-lg border transition-colors", entry.completed ? "bg-muted/50" : "bg-card")}
    >
      <button
        type="button"
        onClick={() => {
          setExpanded(!expanded);
        }}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        {/* Completed indicator */}
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs",
            entry.completed ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          {entry.completed ? "✓" : "○"}
        </span>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <span
            className={cn(
              "text-sm font-medium",
              entry.completed ? "text-muted-foreground line-through" : "text-foreground",
            )}
          >
            {entry.description}
          </span>
        </div>

        {/* Date badge */}
        <span className="bg-secondary/50 text-secondary-foreground shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">
          {formatDate(entry.entry_date)}
        </span>

        {/* Expand indicator */}
        {entry.notes && (
          <span className={cn("text-muted-foreground shrink-0 text-xs transition-transform", expanded && "rotate-90")}>
            ▶
          </span>
        )}
      </button>

      {/* Expandable notes */}
      {expanded && entry.notes && (
        <div className="border-border border-t px-4 py-3">
          <p className="text-muted-foreground max-h-24 overflow-y-auto text-sm leading-relaxed">{entry.notes}</p>
        </div>
      )}
    </div>
  );
}

export function DiaryMockupA({ entries }: DiaryMockupAProps) {
  return (
    <div className="space-y-2">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-foreground text-sm font-semibold">Process Diary</h3>
        <span className="text-muted-foreground text-xs">
          {entries.filter((e) => e.completed).length}/{entries.length} completed
        </span>
      </div>
      <div className="space-y-2">
        {entries.map((entry) => (
          <EntryCard key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}
