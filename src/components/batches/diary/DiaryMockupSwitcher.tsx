import { useState } from "react";
import { cn } from "@/lib/utils";
import { MOCK_DIARY_ENTRIES } from "./mockData";
import { DiaryMockupA } from "./DiaryMockupA";
import { DiaryMockupB } from "./DiaryMockupB";
import { DiaryMockupC } from "./DiaryMockupC";

const TABS = [
  { id: "a", label: "A: Cards" },
  { id: "b", label: "B: Compact List" },
  { id: "c", label: "C: Timeline" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function DiaryMockupSwitcher() {
  const [activeTab, setActiveTab] = useState<TabId>("a");

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
      {activeTab === "a" && <DiaryMockupA entries={MOCK_DIARY_ENTRIES} />}
      {activeTab === "b" && <DiaryMockupB entries={MOCK_DIARY_ENTRIES} />}
      {activeTab === "c" && <DiaryMockupC entries={MOCK_DIARY_ENTRIES} />}
    </div>
  );
}
