import { useState } from "react";
import { cn } from "@/lib/utils";
import { MOCK_DIARY_ENTRIES } from "./mockData";
import type { MockDiaryEntry } from "./mockData";
import { DiaryMockupA } from "./DiaryMockupA";
import { DiaryMockupB } from "./DiaryMockupB";
import { DiaryMockupC } from "./DiaryMockupC";
import { DiaryMockupD } from "./DiaryMockupD";

export interface DiaryActions {
  onToggleComplete: (id: string) => void;
  onEdit: (id: string, updates: Partial<Pick<MockDiaryEntry, "description" | "entry_date" | "notes">>) => void;
  onDelete: (id: string) => void;
  onAdd: (entry: Omit<MockDiaryEntry, "id">) => void;
}

const TABS = [
  { id: "a", label: "A: Cards" },
  { id: "b", label: "B: Compact List" },
  { id: "c", label: "C: Timeline" },
  { id: "d", label: "D: Timeline Big" },
] as const;

type TabId = (typeof TABS)[number]["id"];

let nextId = 100;

export function DiaryMockupSwitcher() {
  const [activeTab, setActiveTab] = useState<TabId>("a");
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

  return (
    <div className="space-y-4">
      {/* Tab selector */}
      <div className="border-border flex gap-1 rounded-lg border p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
            }}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              activeTab === tab.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active mockup */}
      {activeTab === "a" && <DiaryMockupA entries={entries} actions={actions} />}
      {activeTab === "b" && <DiaryMockupB entries={entries} actions={actions} />}
      {activeTab === "c" && <DiaryMockupC entries={entries} actions={actions} />}
      {activeTab === "d" && <DiaryMockupD entries={entries} actions={actions} />}
    </div>
  );
}
