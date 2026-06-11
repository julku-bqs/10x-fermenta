import { useState } from "react";
import { cn } from "@/lib/utils";
import { batchInputClass } from "../styles";
import type { MockDiaryEntry } from "./mockData";
import type { DiaryActions } from "./DiaryMockupSwitcher";

interface DiaryMockupAProps {
  entries: MockDiaryEntry[];
  actions: DiaryActions;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function EntryCard({ entry, actions }: { entry: MockDiaryEntry; actions: DiaryActions }) {
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

  if (editing) {
    return (
      <div className="border-border bg-card space-y-3 rounded-lg border p-4">
        <div>
          <label className="text-muted-foreground mb-1 block text-xs">Description</label>
          <input
            type="text"
            value={editDesc}
            onChange={(e) => {
              setEditDesc(e.target.value);
            }}
            className={batchInputClass}
          />
        </div>
        <div>
          <label className="text-muted-foreground mb-1 block text-xs">Date</label>
          <input
            type="date"
            value={editDate}
            onChange={(e) => {
              setEditDate(e.target.value);
            }}
            className={batchInputClass}
          />
        </div>
        <div>
          <label className="text-muted-foreground mb-1 block text-xs">Notes</label>
          <textarea
            value={editNotes}
            onChange={(e) => {
              setEditNotes(e.target.value);
            }}
            rows={3}
            className={cn(batchInputClass, "resize-y")}
          />
        </div>
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
    );
  }

  return (
    <div
      className={cn("border-border rounded-lg border transition-colors", entry.completed ? "bg-muted/50" : "bg-card")}
    >
      <div className="flex w-full items-center gap-3 p-4">
        {/* Toggle complete */}
        <button
          type="button"
          onClick={() => {
            actions.onToggleComplete(entry.id);
          }}
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs transition-colors",
            entry.completed
              ? "bg-primary/15 text-primary hover:bg-primary/25"
              : "bg-muted text-muted-foreground hover:bg-muted/80",
          )}
        >
          {entry.completed ? "✓" : "○"}
        </button>

        {/* Content — click to expand */}
        <button
          type="button"
          onClick={() => {
            setExpanded(!expanded);
          }}
          className="min-w-0 flex-1 text-left"
        >
          <span
            className={cn(
              "text-sm font-medium",
              entry.completed ? "text-muted-foreground line-through" : "text-foreground",
            )}
          >
            {entry.description}
          </span>
        </button>

        {/* Date badge */}
        <span className="bg-secondary/50 text-secondary-foreground shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">
          {formatDate(entry.entry_date)}
        </span>

        {/* Edit button */}
        <button
          type="button"
          onClick={() => {
            setEditing(true);
          }}
          className="text-muted-foreground hover:text-foreground shrink-0 text-base leading-none"
        >
          ✎
        </button>

        {/* Expand indicator */}
        <button
          type="button"
          className={cn(
            "text-muted-foreground hover:text-foreground shrink-0 cursor-pointer text-base leading-none transition-transform outline-none",
            expanded && "rotate-90",
          )}
          onClick={() => {
            setExpanded(!expanded);
          }}
        >
          ▶
        </button>
      </div>

      {/* Expandable notes */}
      {expanded && (
        <div className="border-border border-t px-4 py-3">
          <p className="text-muted-foreground max-h-24 overflow-y-auto text-sm leading-relaxed">
            {entry.notes ?? <span className="italic">No notes</span>}
          </p>
        </div>
      )}
    </div>
  );
}

function AddEntryForm({ onAdd }: { onAdd: DiaryActions["onAdd"] }) {
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
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
        className="text-primary hover:text-primary/80 text-xs font-medium"
      >
        + Add entry
      </button>
    );
  }

  return (
    <div className="border-border bg-card space-y-3 rounded-lg border p-4">
      <div>
        <label className="text-muted-foreground mb-1 block text-xs">Description</label>
        <input
          type="text"
          value={desc}
          onChange={(e) => {
            setDesc(e.target.value);
          }}
          placeholder="What needs to be done?"
          className={batchInputClass}
        />
      </div>
      <div>
        <label className="text-muted-foreground mb-1 block text-xs">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
          }}
          className={batchInputClass}
        />
      </div>
      <div>
        <label className="text-muted-foreground mb-1 block text-xs">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
          }}
          rows={2}
          className={cn(batchInputClass, "resize-y")}
        />
      </div>
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

export function DiaryMockupA({ entries, actions }: DiaryMockupAProps) {
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
          <EntryCard key={entry.id} entry={entry} actions={actions} />
        ))}
      </div>
      <AddEntryForm onAdd={actions.onAdd} />
    </div>
  );
}
