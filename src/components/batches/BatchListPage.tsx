import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { BatchListItem } from "@/types";
import { Button } from "@/components/ui/button";
import { BatchList } from "./BatchList";
import { BatchTable } from "./BatchTable";
import { LayoutToggle } from "./LayoutToggle";

const STORAGE_KEY = "fermenta:batch-list-layout";

type State = { status: "loading" } | { status: "error" } | { status: "ready"; batches: BatchListItem[] };

export function BatchListPage() {
  const [layout, setLayout] = useState<"cards" | "table">(() => {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    return stored === "table" ? "table" : "cards";
  });
  const [state, setState] = useState<State>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const fetchedKeyRef = useRef<number | null>(null);

  useEffect(() => {
    // Guard against React StrictMode's double effect-invoke firing two requests
    // (dev-only). Keyed on reloadKey so Retry still re-fetches. Mirrors DiarySection.
    if (fetchedKeyRef.current === reloadKey) return;
    fetchedKeyRef.current = reloadKey;

    async function fetchBatches() {
      try {
        const res = await fetch("/api/batches");
        // Session lapsed mid-view: the protected route 302s /api/batches -> /auth/signin,
        // and fetch follows it. Route to sign-in rather than showing a (looping) load error.
        if (res.redirected) {
          window.location.href = res.url;
          return;
        }
        if (!res.ok) {
          setState({ status: "error" });
          return;
        }
        const body = (await res.json()) as { data?: BatchListItem[] };
        setState({ status: "ready", batches: body.data ?? [] });
      } catch {
        setState({ status: "error" });
      }
    }
    void fetchBatches();
  }, [reloadKey]);

  function retry() {
    setState({ status: "loading" });
    setReloadKey((k) => k + 1);
  }

  function handleLayoutChange(next: "cards" | "table") {
    setLayout(next);
    localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {state.status === "ready" && (
            <>
              <span className="text-muted-foreground text-sm">
                {state.batches.length} {state.batches.length === 1 ? "batch" : "batches"}
              </span>
              <LayoutToggle layout={layout} onChange={handleLayoutChange} />
            </>
          )}
        </div>
        <a
          href="/batches/new"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center rounded-md px-4 py-2 text-sm font-medium shadow-xs"
        >
          + New Batch
        </a>
      </div>

      {state.status === "loading" ? (
        <div className="text-muted-foreground flex items-center justify-center gap-2 py-16">
          <Loader2 className="animate-spin" />
          <span>Loading your batches…</span>
        </div>
      ) : state.status === "error" ? (
        <div className="border-destructive/50 bg-destructive/10 text-destructive rounded-lg border border-dashed py-16 text-center">
          <p>We couldn&apos;t load your batches. Please try again.</p>
          <Button variant="destructive" size="sm" className="mt-4" onClick={retry}>
            Try again
          </Button>
        </div>
      ) : state.batches.length === 0 ? (
        <div className="border-border bg-muted rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground">No batches yet.</p>
          <a href="/batches/new" className="text-primary mt-2 inline-block text-sm hover:underline">
            Create your first batch →
          </a>
        </div>
      ) : layout === "cards" ? (
        <BatchList batches={state.batches} />
      ) : (
        <BatchTable batches={state.batches} />
      )}
    </div>
  );
}
