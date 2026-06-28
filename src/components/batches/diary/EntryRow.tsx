import { useState } from "react";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Pencil } from "lucide-react";
import { batchInputClass } from "../styles";
import type { CreateDiaryEntryInput } from "@/lib/schemas/diary-entry";

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

interface EntryRowProps {
  entry: Required<CreateDiaryEntryInput>;
  isLast: boolean;
  onToggleComplete: () => void;
  onEdit: (updates: Partial<Pick<CreateDiaryEntryInput, "description" | "entry_date" | "notes">>) => void;
  onDelete: () => void;
}

export function EntryRow({ entry, isLast, onToggleComplete, onEdit, onDelete }: EntryRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDesc, setEditDesc] = useState(entry.description);
  const [editDate, setEditDate] = useState(entry.entry_date ?? "");
  const [editNotes, setEditNotes] = useState(entry.notes ?? "");

  function handleSave() {
    const resolvedDate = editDate.length > 0 ? editDate : new Date().toISOString().slice(0, 10);
    setEditDate(resolvedDate);
    onEdit({
      description: editDesc,
      entry_date: resolvedDate,
      notes: editNotes.trim() || null,
    });
    setEditing(false);
  }

  function handleCancel() {
    setEditDesc(entry.description);
    setEditDate(entry.entry_date ?? "");
    setEditNotes(entry.notes ?? "");
    setEditing(false);
  }

  return (
    <div className="relative flex gap-4">
      <div className="flex flex-col items-center pt-1">
        <button
          type="button"
          onClick={onToggleComplete}
          className={cn(
            "z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all duration-200",
            entry.completed
              ? "bg-primary hover:bg-primary/80"
              : "border-border bg-card hover:border-primary/50 border-2",
          )}
        >
          {entry.completed && <Check className="h-3 w-3 text-white" />}
        </button>
        {!isLast && <div className="bg-border mt-1 w-px flex-1" />}
      </div>

      <div className={cn("min-w-0 flex-1 pb-7", isLast && "pb-0")}>
        {editing ? (
          <div className="animate-in fade-in space-y-2 duration-200">
            <input
              type="date"
              value={editDate}
              onChange={(e) => {
                setEditDate(e.target.value);
              }}
              onBlur={(e) => {
                if (!e.target.value) {
                  setEditDate(new Date().toISOString().slice(0, 10));
                }
              }}
              className={cn(batchInputClass, "w-40 text-base")}
            />
            <input
              type="text"
              value={editDesc}
              onChange={(e) => {
                setEditDesc(e.target.value);
              }}
              className={cn(batchInputClass, "text-base")}
            />
            <textarea
              value={editNotes}
              onChange={(e) => {
                setEditNotes(e.target.value);
              }}
              placeholder="Notes (optional)"
              rows={2}
              className={cn(batchInputClass, "resize-y text-base")}
            />
            <div className="flex items-center gap-3">
              <button type="button" onClick={handleSave} className="text-primary text-sm font-medium hover:underline">
                Save
              </button>
              <button type="button" onClick={handleCancel} className="text-muted-foreground text-sm hover:underline">
                Cancel
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="text-muted-foreground ml-auto text-sm hover:text-red-600"
              >
                ✕ Delete
              </button>
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in duration-200">
            <button
              type="button"
              onClick={() => {
                setExpanded(!expanded);
              }}
              className="hover:bg-muted/40 -ml-1 block w-full rounded-md px-1 py-0.5 text-left transition-colors duration-150"
            >
              <span className="text-muted-foreground text-sm font-medium tabular-nums">
                {formatDate(entry.entry_date ?? "")}
              </span>
              <p
                className={cn(
                  "mt-0.5 text-base leading-snug transition-colors duration-150",
                  entry.completed ? "text-muted-foreground line-through" : "text-foreground font-medium",
                )}
              >
                {entry.description}
              </p>
            </button>

            <div className="mt-1 flex items-center gap-3 pl-1">
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                }}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors duration-150"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
              {entry.notes && (
                <button
                  type="button"
                  onClick={() => {
                    setExpanded(!expanded);
                  }}
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors duration-150"
                >
                  <ChevronDown
                    className={cn("h-3.5 w-3.5 transition-transform duration-200", expanded && "rotate-180")}
                  />
                  {expanded ? "Hide notes" : "Show notes"}
                </button>
              )}
            </div>

            <div
              className={cn(
                "grid transition-[grid-template-rows] duration-200 ease-out",
                expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden">
                <div className="bg-muted/40 mt-2 rounded-md px-3 py-2">
                  <p className="text-muted-foreground max-h-20 overflow-y-auto text-sm leading-relaxed">
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
