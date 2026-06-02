import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

interface LayoutToggleProps {
  layout: "cards" | "table";
  onChange: (layout: "cards" | "table") => void;
}

export function LayoutToggle({ layout, onChange }: LayoutToggleProps) {
  return (
    <div className="border-border bg-muted flex items-center gap-1 rounded-md border p-0.5">
      <button
        type="button"
        onClick={() => {
          onChange("cards");
        }}
        aria-label="Card view"
        className={cn(
          "rounded p-1.5 transition-colors",
          layout === "cards" ? "bg-card text-primary shadow-xs" : "text-muted-foreground hover:text-foreground",
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
          layout === "table" ? "bg-card text-primary shadow-xs" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <List className="size-4" />
      </button>
    </div>
  );
}
