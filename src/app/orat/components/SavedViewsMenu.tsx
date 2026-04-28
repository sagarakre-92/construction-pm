"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Bookmark, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  createSavedView,
  deleteSavedView,
  listSavedViews,
  updateSavedView,
} from "../actions";
import type { SavedView, SavedViewFilters } from "../types";

interface SavedViewsMenuProps {
  /** Snapshot of the current dashboard filters; captured when saving / updating. */
  currentFilters: SavedViewFilters;
  /** Currently active saved view id (from `?view=<id>`), if any. */
  activeViewId: string | null;
  /** The currently active saved view, if it has been loaded. */
  activeView: SavedView | null;
  /** Current user id; used to gate Update / Delete to the view's owner. */
  currentUserId: string | null;
  /** Called when the user picks a saved view from the menu. */
  onSelectView: (view: SavedView) => void;
  /** Called when the active view is deleted (clears `?view=` from URL). */
  onClearActiveView: () => void;
  /** Called after a fresh save/update so the parent can re-fetch state. */
  onViewsChanged?: () => void;
}

function buildShareLink(viewId: string): string {
  if (typeof window === "undefined") return `?view=${viewId}`;
  const url = new URL(window.location.href);
  url.searchParams.set("view", viewId);
  return url.toString();
}

async function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

export function SavedViewsMenu({
  currentFilters,
  activeViewId,
  activeView,
  currentUserId,
  onSelectView,
  onClearActiveView,
  onViewsChanged,
}: SavedViewsMenuProps) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listSavedViews();
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setViews(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSaveAs = useCallback(async () => {
    const name = window.prompt("Name this view");
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const res = await createSavedView(trimmed, currentFilters);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    toast.success(`Saved “${res.data.name}”`);
    await refresh();
    onSelectView(res.data);
    onViewsChanged?.();
  }, [currentFilters, refresh, onSelectView, onViewsChanged]);

  const handleUpdate = useCallback(async () => {
    if (!activeView) return;
    const res = await updateSavedView(activeView.id, {
      filters: currentFilters,
    });
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    toast.success(`Updated “${activeView.name}”`);
    await refresh();
    onViewsChanged?.();
  }, [activeView, currentFilters, refresh, onViewsChanged]);

  const handleCopyShareLink = useCallback(async () => {
    if (!activeViewId) return;
    try {
      await copyToClipboard(buildShareLink(activeViewId));
      toast.success("Share link copied");
    } catch {
      toast.error("Could not copy share link");
    }
  }, [activeViewId]);

  const handleDelete = useCallback(async () => {
    if (!activeView) return;
    if (!window.confirm(`Delete view “${activeView.name}”?`)) return;
    const res = await deleteSavedView(activeView.id);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    toast.success("View deleted");
    onClearActiveView();
    await refresh();
    onViewsChanged?.();
  }, [activeView, onClearActiveView, refresh, onViewsChanged]);

  const isOwner = !!activeView && activeView.userId === currentUserId;
  const triggerLabel = activeView?.name ?? "Saved views";

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 text-xs sm:text-sm"
          aria-label="Saved views menu"
        >
          <Bookmark className="h-4 w-4 shrink-0" />
          <span className="max-w-[140px] truncate">{triggerLabel}</span>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[240px]">
        {loading && views.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-slate-500">Loading…</div>
        ) : views.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-slate-500">
            No saved views yet
          </div>
        ) : (
          views.map((v) => {
            const isActive = v.id === activeViewId;
            return (
              <DropdownMenuItem
                key={v.id}
                onSelect={(e) => {
                  e.preventDefault();
                  onSelectView(v);
                  setOpen(false);
                }}
                className="flex items-center justify-between gap-2"
              >
                <span className="truncate">{v.name}</span>
                {isActive && <Check className="h-3.5 w-3.5 shrink-0 opacity-70" />}
              </DropdownMenuItem>
            );
          })
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            handleSaveAs();
            setOpen(false);
          }}
        >
          Save current as…
        </DropdownMenuItem>
        {activeView && isOwner && (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              handleUpdate();
              setOpen(false);
            }}
          >
            Update view
          </DropdownMenuItem>
        )}
        {activeViewId && (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              handleCopyShareLink();
              setOpen(false);
            }}
          >
            Copy share link
          </DropdownMenuItem>
        )}
        {activeView && isOwner && (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              handleDelete();
              setOpen(false);
            }}
            className="text-red-600 focus:text-red-700"
          >
            Delete view
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
