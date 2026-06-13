import { useState } from "react";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Pencil, Plus } from "lucide-react";
import { batchInputClass } from "../styles";
import type { MockDiaryEntry } from "./mockData";
import type { DiaryActions } from "./DiaryMockupSwitcher";

interface DiaryMockupDProps {
  entries: MockDiaryEntry[];
  actions: DiaryActions;
}

// Size presets: [dotSize, dotCheckSize, gap, dateFontSize, descFontSize, actionFontSize, actionIconSize, noteFontSize, entryPadding, lineOffset]
const SIZE_PRESETS = {
  1: {
    dot: "h-4 w-4",
    dotCheck: "h-2.5 w-2.5",
    gap: "gap-3",
    dateClass: "text-xs",
    descClass: "text-sm",
    actionClass: "text-xs",
    actionIcon: "h-3 w-3",
    noteClass: "text-xs",
    entryPb: "pb-5",
    headerClass: "text-sm",
  },
  2: {
    dot: "h-[1.125rem] w-[1.125rem]",
    dotCheck: "h-3 w-3",
    gap: "gap-3.5",
    dateClass: "text-xs",
    descClass: "text-[0.9375rem] leading-snug",
    actionClass: "text-xs",
    actionIcon: "h-3.5 w-3.5",
    noteClass: "text-sm",
    entryPb: "pb-6",
    headerClass: "text-sm",
  },
  3: {
    dot: "h-5 w-5",
    dotCheck: "h-3 w-3",
    gap: "gap-4",
    dateClass: "text-sm",
    descClass: "text-base leading-snug",
    actionClass: "text-sm",
    actionIcon: "h-3.5 w-3.5",
    noteClass: "text-sm",
    entryPb: "pb-7",
    headerClass: "text-base",
  },
  4: {
    dot: "h-[1.375rem] w-[1.375rem]",
    dotCheck: "h-3.5 w-3.5",
    gap: "gap-4",
    dateClass: "text-sm",
    descClass: "text-[1.0625rem] leading-normal",
    actionClass: "text-sm",
    actionIcon: "h-4 w-4",
    noteClass: "text-sm leading-relaxed",
    entryPb: "pb-8",
    headerClass: "text-base",
  },
  5: {
    dot: "h-6 w-6",
    dotCheck: "h-4 w-4",
    gap: "gap-5",
    dateClass: "text-sm",
    descClass: "text-lg leading-normal",
    actionClass: "text-sm",
    actionIcon: "h-4 w-4",
    noteClass: "text-base leading-relaxed",
    entryPb: "pb-9",
    headerClass: "text-lg",
  },
} as const;

type SizeLevel = keyof typeof SIZE_PRESETS;

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

function TimelineEntry({
  entry,
  isLast,
  actions,
  size,
}: {
  entry: MockDiaryEntry;
  isLast: boolean;
  actions: DiaryActions;
  size: (typeof SIZE_PRESETS)[SizeLevel];
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDesc, setEditDesc] = useState(entry.description);
  const [editDate, setEditDate] = useState(entry.entry_date);
  const [editNotes, setEditNotes] = useState(entry.notes ?? "");

  function handleSave() {
    actions.onEdit(entry.id, {
      description: editDesc,
      entry_date: editDate,
      notes: editNotes.trim() ? editNotes.trim() : null,
    });
    setEditing(false);
  }

  function handleCancel() {
    setEditDesc(entry.description);
    setEditDate(entry.entry_date);
    setEditNotes(entry.notes ?? "");
    setEditing(false);
  }

  return (
    <div className={cn("relative flex", size.gap)}>
      {/* Timeline line + clickable dot */}
      <div className="flex flex-col items-center pt-1">
        <button
          type="button"
          onClick={() => {
            actions.onToggleComplete(entry.id);
          }}
          className={cn(
            "z-10 flex shrink-0 items-center justify-center rounded-full transition-all duration-200",
            size.dot,
            entry.completed
              ? "bg-primary hover:bg-primary/80"
              : "border-border bg-card hover:border-primary/50 border-2",
          )}
        >
          {entry.completed && <Check className={cn("text-white", size.dotCheck)} />}
        </button>
        {!isLast && <div className="bg-border mt-1 w-px flex-1" />}
      </div>

      {/* Content */}
      <div className={cn("min-w-0 flex-1", isLast ? "pb-0" : size.entryPb)}>
        {editing ? (
          <div key="edit" className="animate-in fade-in space-y-2 duration-200">
            <input
              type="date"
              value={editDate}
              onChange={(e) => {
                setEditDate(e.target.value);
              }}
              className={cn(batchInputClass, "w-36")}
            />
            <input
              type="text"
              value={editDesc}
              onChange={(e) => {
                setEditDesc(e.target.value);
              }}
              className={batchInputClass}
            />
            <textarea
              value={editNotes}
              onChange={(e) => {
                setEditNotes(e.target.value);
              }}
              placeholder="Notes (optional)"
              rows={2}
              className={cn(batchInputClass, "resize-y")}
            />
            <div className="flex items-center gap-3">
              <button type="button" onClick={handleSave} className="text-primary text-xs font-medium hover:underline">
                Save
              </button>
              <button type="button" onClick={handleCancel} className="text-muted-foreground text-xs hover:underline">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  actions.onDelete(entry.id);
                }}
                className="text-muted-foreground ml-auto text-xs hover:text-red-600"
              >
                ✕ Delete
              </button>
            </div>
          </div>
        ) : (
          <div key="view" className="animate-in fade-in duration-200">
            {/* Clickable row: date + description → expand notes */}
            <button
              type="button"
              onClick={() => {
                setExpanded(!expanded);
              }}
              className="hover:bg-muted/40 -ml-1 block w-full rounded-md px-1 py-0.5 text-left transition-colors duration-150"
            >
              <span className={cn("text-muted-foreground font-medium tabular-nums", size.dateClass)}>
                {formatDate(entry.entry_date)}
              </span>
              <p
                className={cn(
                  "mt-0.5 transition-colors duration-150",
                  size.descClass,
                  entry.completed ? "text-muted-foreground line-through" : "text-foreground font-medium",
                )}
              >
                {entry.description}
              </p>
            </button>

            {/* Action links — always visible */}
            <div className="mt-1 flex items-center gap-3 pl-1">
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                }}
                className={cn(
                  "text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors duration-150",
                  size.actionClass,
                )}
              >
                <Pencil className={size.actionIcon} />
                Edit
              </button>
              {entry.notes && (
                <button
                  type="button"
                  onClick={() => {
                    setExpanded(!expanded);
                  }}
                  className={cn(
                    "text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors duration-150",
                    size.actionClass,
                  )}
                >
                  <ChevronDown
                    className={cn(size.actionIcon, "transition-transform duration-200", expanded && "rotate-180")}
                  />
                  {expanded ? "Hide notes" : "Show notes"}
                </button>
              )}
            </div>

            {/* Expandable notes — animated */}
            <div
              className={cn(
                "grid transition-[grid-template-rows] duration-200 ease-out",
                expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden">
                <div className="bg-muted/40 mt-2 rounded-md px-3 py-2">
                  <p className={cn("text-muted-foreground max-h-24 overflow-y-auto", size.noteClass)}>
                    {entry.notes ?? <span className="italic">No notes</span>}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AddEntryTimeline({ onAdd, size }: { onAdd: DiaryActions["onAdd"]; size: (typeof SIZE_PRESETS)[SizeLevel] }) {
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  function handleSubmit() {
    if (!desc.trim()) return;
    onAdd({
      description: desc.trim(),
      entry_date: date,
      completed: false,
      notes: notes.trim() ? notes.trim() : null,
      entry_type: "user",
    });
    setDesc("");
    setNotes("");
    setOpen(false);
  }

  if (!open) {
    return (
      <div className="mt-3 pl-7">
        <button
          type="button"
          onClick={() => {
            setOpen(true);
          }}
          className={cn(
            "text-primary hover:text-primary/80 inline-flex items-center gap-1 font-medium transition-colors duration-150",
            size.actionClass,
          )}
        >
          <Plus className={size.actionIcon} />
          Add entry
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2 pl-7">
      <input
        type="date"
        value={date}
        onChange={(e) => {
          setDate(e.target.value);
        }}
        className={cn(batchInputClass, "w-36")}
      />
      <input
        type="text"
        value={desc}
        onChange={(e) => {
          setDesc(e.target.value);
        }}
        placeholder="Description"
        className={batchInputClass}
      />
      <textarea
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
        }}
        placeholder="Notes (optional)"
        rows={2}
        className={cn(batchInputClass, "resize-y")}
      />
      <div className="flex items-center gap-3">
        <button type="button" onClick={handleSubmit} className="text-primary text-xs font-medium hover:underline">
          Add
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
          }}
          className="text-muted-foreground text-xs hover:underline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function DiaryMockupD({ entries, actions }: DiaryMockupDProps) {
  const [level, setLevel] = useState<SizeLevel>(2);
  const size = SIZE_PRESETS[level];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className={cn("text-foreground font-semibold", size.headerClass)}>Process Diary</h3>
        <span className="text-muted-foreground text-xs">
          {entries.filter((e) => e.completed).length}/{entries.length} completed
        </span>
      </div>

      {/* Size slider */}
      <div className="bg-muted/50 border-border mb-4 flex items-center gap-3 rounded-lg border px-3 py-2">
        <span className="text-muted-foreground text-xs font-medium">Size:</span>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={level}
          onChange={(e) => {
            setLevel(Number(e.target.value) as SizeLevel);
          }}
          className="h-1.5 flex-1 cursor-pointer accent-[var(--primary)]"
        />
        <span className="text-foreground w-4 text-center text-sm font-semibold">{level}</span>
      </div>

      <div className="pl-1">
        {entries.map((entry, i) => (
          <TimelineEntry key={entry.id} entry={entry} isLast={i === entries.length - 1} actions={actions} size={size} />
        ))}
      </div>
      <AddEntryTimeline onAdd={actions.onAdd} size={size} />
    </div>
  );
}
