import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ArrowDownUp, Loader2, Plus, RefreshCw } from "lucide-react";
import { batchInputClass } from "../styles";
import type { BatchParams, DiaryEntry } from "@/types";
import type { CreateDiaryEntryInput } from "@/lib/schemas/diary-entry";
import { EntryRow } from "./EntryRow";

type SortOrder = "asc" | "desc";

const SORT_STORAGE_KEY = "fermenta:diary-sort-order";

interface DiarySectionProps {
  batchParams: BatchParams;
  batchId: string | null;
  mode: "create" | "edit";
  onLocalEntriesChange?: (entries: CreateDiaryEntryInput[]) => void;
}

function getSortOrder(): SortOrder {
  if (typeof window === "undefined") return "asc";
  const stored = localStorage.getItem(SORT_STORAGE_KEY);
  return stored === "desc" ? "desc" : "asc";
}

function sortEntries(entries: DiaryEntry[], order: SortOrder): DiaryEntry[] {
  return [...entries].sort((a, b) => {
    const cmp = a.entry_date.localeCompare(b.entry_date) || a.created_at.localeCompare(b.created_at);
    return order === "asc" ? cmp : -cmp;
  });
}

type LocalEntry = Required<CreateDiaryEntryInput> & { _localId: string };

export function DiarySection({ batchParams, batchId, mode, onLocalEntriesChange }: DiarySectionProps) {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [localEntries, setLocalEntries] = useState<LocalEntry[]>([]);
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

  // Propagate local entries to parent (create mode), stripping internal IDs
  useEffect(() => {
    onLocalEntriesChange?.(localEntries.map(({ _localId, ...rest }) => rest));
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
      setLocalEntries((prev) => [...prev, { ...entry, completed: false, _localId: crypto.randomUUID() }]);
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

  function handleDeleteLocal(localId: string) {
    setLocalEntries((prev) => prev.filter((e) => e._localId !== localId));
  }

  function handleEditLocal(
    localId: string,
    updates: Partial<Pick<CreateDiaryEntryInput, "description" | "entry_date" | "notes">>,
  ) {
    setLocalEntries((prev) => prev.map((e) => (e._localId === localId ? { ...e, ...updates } : e)));
  }

  function handleToggleCompleteLocal(localId: string) {
    setLocalEntries((prev) => prev.map((e) => (e._localId === localId ? { ...e, completed: !e.completed } : e)));
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
        <div role="list" aria-label="Diary entries" className="pl-1">
          {sorted.map((entry, i) => (
            <EntryRow
              key={entry.id}
              entry={{
                description: entry.description,
                entry_date: entry.entry_date,
                notes: entry.notes ?? null,
                completed: entry.completed,
              }}
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
        <div role="list" className="pl-1">
          {localEntries.map((entry, i) => (
            <EntryRow
              key={entry._localId}
              entry={entry}
              isLast={i === localEntries.length - 1}
              onToggleComplete={() => {
                handleToggleCompleteLocal(entry._localId);
              }}
              onEdit={(updates) => {
                handleEditLocal(entry._localId, updates);
              }}
              onDelete={() => {
                handleDeleteLocal(entry._localId);
              }}
            />
          ))}
        </div>
      )}

      <AddEntryForm onAdd={(entry) => void handleAdd(entry)} defaultDate={batchParams.batch_date} />
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
      entry_date: date.length > 0 ? date : new Date().toISOString().slice(0, 10),
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
        onBlur={(e) => {
          if (!e.target.value) {
            setDate(new Date().toISOString().slice(0, 10));
          }
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
