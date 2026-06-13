import { useState } from "react";
import { MOCK_DIARY_ENTRIES } from "./mockData";
import type { MockDiaryEntry } from "./mockData";
import { DiaryMockupC } from "./DiaryMockupC";

export interface DiaryActions {
  onToggleComplete: (id: string) => void;
  onEdit: (id: string, updates: Partial<Pick<MockDiaryEntry, "description" | "entry_date" | "notes">>) => void;
  onDelete: (id: string) => void;
  onAdd: (entry: Omit<MockDiaryEntry, "id">) => void;
}

let nextId = 100;

export function DiaryMockupSwitcher() {
  const [entries, setEntries] = useState<MockDiaryEntry[]>(() => [...MOCK_DIARY_ENTRIES]);

  const actions: DiaryActions = {
    onToggleComplete: (id) => {
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, completed: !e.completed } : e)));
    },
    onEdit: (id, updates) => {
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
    },
    onDelete: (id) => {
      setEntries((prev) => prev.filter((e) => e.id !== id));
    },
    onAdd: (entry) => {
      nextId++;
      setEntries((prev) => [...prev, { ...entry, id: String(nextId) }]);
    },
  };

  return <DiaryMockupC entries={entries} actions={actions} />;
}
