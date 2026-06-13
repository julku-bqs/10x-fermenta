import { useState } from "react";
import { cn } from "@/lib/utils";
import { Check, Pencil, Plus, StickyNote } from "lucide-react";
import { batchInputClass } from "../styles";
import type { MockDiaryEntry } from "./mockData";
import type { DiaryActions } from "./DiaryMockupSwitcher";

interface DiaryMockupBProps {
  entries: MockDiaryEntry[];
  actions: DiaryActions;
}

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

function EntryRow({ entry, actions }: { entry: MockDiaryEntry; actions: DiaryActions }) {
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
      <div className="border-border space-y-2 border-b p-3 last:border-b-0">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input
            type="text"
            value={editDesc}
            onChange={(e) => {
              setEditDesc(e.target.value);
            }}
            className={batchInputClass}
          />
          <input
            type="date"
            value={editDate}
            onChange={(e) => {
              setEditDate(e.target.value);
            }}
            className={cn(batchInputClass, "w-36")}
          />
        </div>
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
    );
  }

  return (
    <div
      className={cn(
        "border-border group border-b transition-colors duration-150 last:border-b-0",
        entry.completed ? "bg-muted/30" : "hover:bg-muted/20",
      )}
    >
      <div className="flex w-full items-center gap-2 px-3 py-2.5">
        {/* Expandable area: date + description */}
        <button
          type="button"
          onClick={() => {
            setExpanded(!expanded);
          }}
          className="grid min-w-0 flex-1 grid-cols-[3rem_1fr] items-center gap-2 text-left"
        >
          <span className="text-muted-foreground text-xs font-medium tabular-nums">{formatDate(entry.entry_date)}</span>
          <span
            className={cn(
              "block text-sm transition-colors duration-150",
              entry.completed ? "text-muted-foreground line-through" : "text-foreground",
              !expanded && "truncate",
            )}
          >
            {entry.description}
          </span>
        </button>

        {/* Actions column */}
        <div className="flex shrink-0 items-center gap-1.5">
          {entry.notes && (
            <button
              type="button"
              onClick={() => {
                setExpanded(!expanded);
              }}
              className="text-muted-foreground hover:text-foreground rounded p-0.5 transition-colors duration-150"
            >
              <StickyNote className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setEditing(true);
            }}
            className="text-muted-foreground hover:text-foreground rounded p-0.5 transition-colors duration-150"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              actions.onToggleComplete(entry.id);
            }}
            className={cn(
              "inline-flex h-5 w-5 items-center justify-center rounded transition-all duration-150",
              entry.completed
                ? "bg-primary/15 text-primary hover:bg-primary/25"
                : "border-border hover:border-primary/40 border",
            )}
          >
            {entry.completed && <Check className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Expandable notes — animated */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="bg-muted/40 px-3 py-2.5 pl-[calc(3rem+1rem)]">
            <p className="text-muted-foreground max-h-20 overflow-y-auto text-xs leading-relaxed">
              {entry.notes ?? <span className="italic">No notes</span>}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddEntryRow({ onAdd }: { onAdd: DiaryActions["onAdd"] }) {
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
      <div className="px-3 py-2">
        <button
          type="button"
          onClick={() => {
            setOpen(true);
          }}
          className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-xs font-medium transition-colors duration-150"
        >
          <Plus className="h-3 w-3" />
          Add entry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-3">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input
          type="text"
          value={desc}
          onChange={(e) => {
            setDesc(e.target.value);
          }}
          placeholder="Description"
          className={batchInputClass}
        />
        <input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
          }}
          className={cn(batchInputClass, "w-36")}
        />
      </div>
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

export function DiaryMockupB({ entries, actions }: DiaryMockupBProps) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-foreground text-sm font-semibold">Process Diary</h3>
        <span className="text-muted-foreground text-xs">
          {entries.filter((e) => e.completed).length}/{entries.length} completed
        </span>
      </div>
      <div className="border-border overflow-hidden rounded-lg border">
        {/* Header */}
        <div className="bg-muted/30 border-border grid grid-cols-[3rem_1fr_auto] gap-2 border-b px-3 py-2">
          <span className="text-muted-foreground text-xs font-medium">Date</span>
          <span className="text-muted-foreground text-xs font-medium">Step</span>
          <span className="text-muted-foreground text-xs font-medium">Done</span>
        </div>
        {/* Rows */}
        {entries.map((entry) => (
          <EntryRow key={entry.id} entry={entry} actions={actions} />
        ))}
        <AddEntryRow onAdd={actions.onAdd} />
      </div>
    </div>
  );
}
