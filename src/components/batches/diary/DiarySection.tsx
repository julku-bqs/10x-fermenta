import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ArrowDownUp, Check, ChevronDown, Loader2, Pencil, Plus, RefreshCw } from "lucide-react";
import { batchInputClass } from "../styles";
import type { BatchParams, DiaryEntry } from "@/types";

type SortOrder = "asc" | "desc";

const SORT_STORAGE_KEY = "fermenta:diary-sort-order";

interface DiarySectionProps {
  batchParams: BatchParams;
  batchId: string | null;
  mode: "create" | "edit";
  onLocalEntriesChange?: (entries: LocalDiaryEntry[]) => void;
}

export interface LocalDiaryEntry {
  description: string;
  entry_date: string;
  notes: string | null;
}

function getSortOrder(): SortOrder {
  if (typeof window === "undefined") return "asc";
  const stored = localStorage.getItem(SORT_STORAGE_KEY);
  return stored === "desc" ? "desc" : "asc";
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

function sortEntries(entries: DiaryEntry[], order: SortOrder): DiaryEntry[] {
  return [...entries].sort((a, b) => {
    const cmp = a.entry_date.localeCompare(b.entry_date) || a.created_at.localeCompare(b.created_at);
    return order === "asc" ? cmp : -cmp;
  });
}

export function DiarySection({ batchParams, batchId, mode, onLocalEntriesChange }: DiarySectionProps) {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [localEntries, setLocalEntries] = useState<LocalDiaryEntry[]>([]);
  const [loading, setLoading] = useState(mode === "edit");
  const [error, setError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>(getSortOrder);
  const [regenerating, setRegenerating] = useState(false);
  const fetchedRef = useRef(false);

  // Fetch entries in edit mode
  useEffect(() => {
    if (mode !== "edit" || !batchId || fetchedRef.current) return;
    fetchedRef.current = true;

    async function fetchEntries() {
      try {
        const res = await fetch(`/api/batches/${batchId}/diary`);
        if (!res.ok) throw new Error("Failed to load diary entries");
        const json = (await res.json()) as { data: DiaryEntry[] };
        setEntries(json.data);
      } catch {
        setError("Failed to load diary entries");
      } finally {
        setLoading(false);
      }
    }
    void fetchEntries();
  }, [mode, batchId]);

  // Propagate local entries to parent (create mode)
  useEffect(() => {
    onLocalEntriesChange?.(localEntries);
  }, [localEntries, onLocalEntriesChange]);

  const toggleSort = useCallback(() => {
    setSortOrder((prev) => {
      const next = prev === "asc" ? "desc" : "asc";
      localStorage.setItem(SORT_STORAGE_KEY, next);
      return next;
    });
  }, []);

  async function handleToggleComplete(entry: DiaryEntry) {
    const updated = { ...entry, completed: !entry.completed };
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? updated : e)));
    try {
      const res = await fetch(`/api/batches/${batchId}/diary/${entry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !entry.completed }),
      });
      if (!res.ok) {
        setEntries((prev) => prev.map((e) => (e.id === entry.id ? entry : e)));
      }
    } catch {
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? entry : e)));
    }
  }

  async function handleEdit(
    entryId: string,
    updates: Partial<Pick<DiaryEntry, "description" | "entry_date" | "notes">>,
  ) {
    const res = await fetch(`/api/batches/${batchId}/diary/${entryId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error("Failed to update entry");
    const json = (await res.json()) as { data: DiaryEntry };
    setEntries((prev) => prev.map((e) => (e.id === entryId ? json.data : e)));
  }

  async function handleDelete(entryId: string) {
    const res = await fetch(`/api/batches/${batchId}/diary/${entryId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error("Failed to delete entry");
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
  }

  async function handleAdd(entry: { description: string; entry_date: string; notes: string | null }) {
    if (mode === "create") {
      setLocalEntries((prev) => [...prev, entry]);
      return;
    }
    const res = await fetch(`/api/batches/${batchId}/diary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    if (!res.ok) throw new Error("Failed to add entry");
    const json = (await res.json()) as { data: DiaryEntry };
    setEntries((prev) => [...prev, json.data]);
  }

  async function handleRegenerate() {
    if (!batchId) return;
    setRegenerating(true);
    try {
      const res = await fetch(`/api/batches/${batchId}/diary/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) throw new Error("Failed to regenerate");
      const json = (await res.json()) as { data: DiaryEntry[] };
      setEntries(json.data);
    } catch {
      setError("Failed to regenerate diary entries");
    } finally {
      setRegenerating(false);
    }
  }

  function handleDeleteLocal(index: number) {
    setLocalEntries((prev) => prev.filter((_, i) => i !== index));
  }

  function handleEditLocal(
    index: number,
    updates: Partial<Pick<LocalDiaryEntry, "description" | "entry_date" | "notes">>,
  ) {
    setLocalEntries((prev) => prev.map((e, i) => (i === index ? { ...e, ...updates } : e)));
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6">
        <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        <span className="text-muted-foreground text-sm">Loading diary…</span>
      </div>
    );
  }

  if (error) {
    return <p className="text-destructive py-4 text-sm">{error}</p>;
  }

  const sorted = sortEntries(entries, sortOrder);
  const completedCount = entries.filter((e) => e.completed).length;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-foreground text-base font-semibold">Process Diary</h3>
          <button
            type="button"
            onClick={toggleSort}
            className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
            title={`Sort ${sortOrder === "asc" ? "newest first" : "oldest first"}`}
          >
            <ArrowDownUp className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-3">
          {mode === "edit" && entries.length > 0 && (
            <span className="text-muted-foreground text-sm">
              {completedCount}/{entries.length}
            </span>
          )}
          {mode === "edit" && (
            <button
              type="button"
              onClick={() => void handleRegenerate()}
              disabled={regenerating}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", regenerating && "animate-spin")} />
              {entries.length === 0 ? "Generate Plan" : "Regenerate"}
            </button>
          )}
        </div>
      </div>

      {entries.length === 0 && localEntries.length === 0 && (
        <p className="text-muted-foreground py-4 text-sm">
          {mode === "edit" ? "No diary entries yet." : "Diary entries will be generated automatically after creation."}
        </p>
      )}

      {/* Edit mode: API-backed entries */}
      {sorted.length > 0 && (
        <div className="pl-1">
          {sorted.map((entry, i) => (
            <TimelineEntry
              key={entry.id}
              entry={entry}
              isLast={i === sorted.length - 1 && localEntries.length === 0}
              onToggleComplete={() => void handleToggleComplete(entry)}
              onEdit={(updates) => void handleEdit(entry.id, updates)}
              onDelete={() => void handleDelete(entry.id)}
            />
          ))}
        </div>
      )}

      {/* Create mode: local entries */}
      {localEntries.length > 0 && (
        <div className="pl-1">
          {localEntries.map((entry, i) => (
            <LocalEntryRow
              key={`local-${i.toString()}`}
              entry={entry}
              isLast={i === localEntries.length - 1}
              onEdit={(updates) => {
                handleEditLocal(i, updates);
              }}
              onDelete={() => {
                handleDeleteLocal(i);
              }}
            />
          ))}
        </div>
      )}

      <AddEntryForm onAdd={(entry) => void handleAdd(entry)} defaultDate={batchParams.batch_date} />
    </div>
  );
}

// --- TimelineEntry (edit mode, API-backed) ---

function TimelineEntry({
  entry,
  isLast,
  onToggleComplete,
  onEdit,
  onDelete,
}: {
  entry: DiaryEntry;
  isLast: boolean;
  onToggleComplete: () => void;
  onEdit: (updates: Partial<Pick<DiaryEntry, "description" | "entry_date" | "notes">>) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDesc, setEditDesc] = useState(entry.description);
  const [editDate, setEditDate] = useState(entry.entry_date);
  const [editNotes, setEditNotes] = useState(entry.notes ?? "");

  function handleSave() {
    onEdit({
      description: editDesc,
      entry_date: editDate,
      notes: editNotes.trim() || null,
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
                {formatDate(entry.entry_date)}
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

// --- LocalEntryRow (create mode, not yet saved — same UX as edit mode) ---

function LocalEntryRow({
  entry,
  isLast,
  onEdit,
  onDelete,
}: {
  entry: LocalDiaryEntry;
  isLast: boolean;
  onEdit: (updates: Partial<Pick<LocalDiaryEntry, "description" | "entry_date" | "notes">>) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDesc, setEditDesc] = useState(entry.description);
  const [editDate, setEditDate] = useState(entry.entry_date);
  const [editNotes, setEditNotes] = useState(entry.notes ?? "");

  function handleSave() {
    onEdit({
      description: editDesc,
      entry_date: editDate,
      notes: editNotes.trim() || null,
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
      <div className="flex flex-col items-center pt-1">
        <div className="border-border bg-card z-10 h-5 w-5 shrink-0 rounded-full border-2" />
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
                {formatDate(entry.entry_date)}
              </span>
              <p className="text-foreground mt-0.5 text-base leading-snug font-medium">{entry.description}</p>
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

            {entry.notes && (
              <div
                className={cn(
                  "grid transition-[grid-template-rows] duration-200 ease-out",
                  expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <div className="overflow-hidden">
                  <div className="bg-muted/40 mt-2 rounded-md px-3 py-2">
                    <p className="text-muted-foreground max-h-20 overflow-y-auto text-sm leading-relaxed">
                      {entry.notes}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- AddEntryForm ---

function AddEntryForm({
  onAdd,
  defaultDate,
}: {
  onAdd: (entry: { description: string; entry_date: string; notes: string | null }) => void;
  defaultDate: string;
}) {
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState(defaultDate || new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  function handleSubmit() {
    if (!desc.trim()) return;
    onAdd({
      description: desc.trim(),
      entry_date: date,
      notes: notes.trim() || null,
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
          className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-sm font-medium transition-colors duration-150"
        >
          <Plus className="h-3.5 w-3.5" />
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
        className={cn(batchInputClass, "w-40 text-base")}
      />
      <input
        type="text"
        value={desc}
        onChange={(e) => {
          setDesc(e.target.value);
        }}
        placeholder="Description"
        className={cn(batchInputClass, "text-base")}
      />
      <textarea
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
        }}
        placeholder="Notes (optional)"
        rows={2}
        className={cn(batchInputClass, "resize-y text-base")}
      />
      <div className="flex items-center gap-3">
        <button type="button" onClick={handleSubmit} className="text-primary text-sm font-medium hover:underline">
          Add
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
          }}
          className="text-muted-foreground text-sm hover:underline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
