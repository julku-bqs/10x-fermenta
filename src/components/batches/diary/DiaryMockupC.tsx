import { useState } from "react";
import { cn } from "@/lib/utils";
import { batchInputClass } from "../styles";
import type { MockDiaryEntry } from "./mockData";
import type { DiaryActions } from "./DiaryMockupSwitcher";

interface DiaryMockupCProps {
  entries: MockDiaryEntry[];
  actions: DiaryActions;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function TimelineEntry({ entry, isLast, actions }: { entry: MockDiaryEntry; isLast: boolean; actions: DiaryActions }) {
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
    <div className="relative flex gap-4">
      {/* Timeline line + dot */}
      <div className="flex flex-col items-center">
        <button
          type="button"
          onClick={() => {
            actions.onToggleComplete(entry.id);
          }}
          className={cn(
            "z-10 flex h-3 w-3 shrink-0 items-center justify-center rounded-full ring-2 ring-white transition-colors",
            entry.completed ? "bg-primary hover:bg-primary/80" : "border-border bg-card hover:bg-muted border",
          )}
        />
        {!isLast && <div className="bg-border w-px flex-1" />}
      </div>

      {/* Content */}
      <div className={cn("min-w-0 flex-1 pb-5", isLast && "pb-0")}>
        {editing ? (
          <div className="space-y-2">
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
          <>
            {/* Date label */}
            <span className="text-muted-foreground text-xs font-medium tabular-nums">
              {formatDate(entry.entry_date)}
            </span>

            {/* Entry content */}
            <div className="mt-1 flex items-start gap-2">
              <p
                className={cn(
                  "min-w-0 flex-1 text-sm",
                  entry.completed ? "text-muted-foreground line-through" : "text-foreground font-medium",
                )}
              >
                {entry.completed && <span className="text-primary mr-1.5 inline-block no-underline">✓</span>}
                {entry.description}
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                }}
                className="text-muted-foreground hover:text-foreground shrink-0 text-base leading-none"
              >
                ✎
              </button>
            </div>

            {/* Expandable notes */}
            {expanded && (
              <div className="bg-muted/50 mt-2 rounded-md px-3 py-2">
                <p className="text-muted-foreground max-h-20 overflow-y-auto text-xs leading-relaxed">
                  {entry.notes ?? <span className="italic">No notes</span>}
                </p>
              </div>
            )}

            {/* Notes toggle */}
            <button
              type="button"
              onClick={() => {
                setExpanded(!expanded);
              }}
              className="text-muted-foreground hover:text-foreground mt-1 text-xs"
            >
              {expanded ? "Hide notes ▴" : "Show notes ▾"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function AddEntryTimeline({ onAdd }: { onAdd: DiaryActions["onAdd"] }) {
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
          className="text-primary hover:text-primary/80 text-xs font-medium"
        >
          + Add entry
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

export function DiaryMockupC({ entries, actions }: DiaryMockupCProps) {
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
          <TimelineEntry key={entry.id} entry={entry} isLast={i === entries.length - 1} actions={actions} />
        ))}
      </div>
      <AddEntryTimeline onAdd={actions.onAdd} />
    </div>
  );
}
