import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

interface LayoutToggleProps {
  layout: "cards" | "table";
  onChange: (layout: "cards" | "table") => void;
}

export function LayoutToggle({ layout, onChange }: LayoutToggleProps) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 p-0.5">
      <button
        type="button"
        onClick={() => {
          onChange("cards");
        }}
        aria-label="Card view"
        className={cn(
          "rounded p-1.5 transition-colors",
          layout === "cards" ? "bg-white text-blue-600 shadow-xs" : "text-gray-500 hover:text-gray-700",
        )}
      >
        <LayoutGrid className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => {
          onChange("table");
        }}
        aria-label="Table view"
        className={cn(
          "rounded p-1.5 transition-colors",
          layout === "table" ? "bg-white text-blue-600 shadow-xs" : "text-gray-500 hover:text-gray-700",
        )}
      >
        <List className="size-4" />
      </button>
    </div>
  );
}
