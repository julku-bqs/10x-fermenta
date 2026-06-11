import { useState } from "react";
import { cn } from "@/lib/utils";
import type { MockDiaryEntry } from "./mockData";

interface DiaryMockupCProps {
  entries: MockDiaryEntry[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function TimelineEntry({ entry, isLast }: { entry: MockDiaryEntry; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative flex gap-4">
      {/* Timeline line + dot */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "z-10 flex h-3 w-3 shrink-0 items-center justify-center rounded-full ring-2 ring-white",
            entry.completed ? "bg-primary" : "border-border bg-card border",
          )}
        />
        {!isLast && <div className="bg-border w-px flex-1" />}
      </div>

      {/* Content */}
      <div className={cn("pb-5", isLast && "pb-0")}>
        {/* Date label */}
        <span className="text-muted-foreground text-xs font-medium tabular-nums">{formatDate(entry.entry_date)}</span>

        {/* Entry card */}
        <button
          type="button"
          onClick={() => {
            setExpanded(!expanded);
          }}
          className={cn("mt-1 block w-full text-left", entry.notes && "cursor-pointer")}
        >
          <p
            className={cn(
              "text-sm",
              entry.completed ? "text-muted-foreground line-through" : "text-foreground font-medium",
            )}
          >
            {entry.completed && <span className="text-primary mr-1.5 inline-block no-underline">✓</span>}
            {entry.description}
          </p>
        </button>

        {/* Expandable notes */}
        {expanded && entry.notes && (
          <div className="bg-muted/50 mt-2 rounded-md px-3 py-2">
            <p className="text-muted-foreground max-h-20 overflow-y-auto text-xs leading-relaxed">{entry.notes}</p>
          </div>
        )}

        {/* Notes indicator */}
        {!expanded && entry.notes && (
          <button
            type="button"
            onClick={() => {
              setExpanded(true);
            }}
            className="text-muted-foreground hover:text-foreground mt-1 text-xs"
          >
            Show notes ▾
          </button>
        )}
      </div>
    </div>
  );
}

export function DiaryMockupC({ entries }: DiaryMockupCProps) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-foreground text-sm font-semibold">Process Diary</h3>
        <span className="text-muted-foreground text-xs">
          {entries.filter((e) => e.completed).length}/{entries.length} completed
        </span>
      </div>
      <div className="pl-1">
        {entries.map((entry, i) => (
          <TimelineEntry key={entry.id} entry={entry} isLast={i === entries.length - 1} />
        ))}
      </div>
    </div>
  );
}
