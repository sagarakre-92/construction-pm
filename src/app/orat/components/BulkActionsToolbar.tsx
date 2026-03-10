"use client";

import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface BulkActionsToolbarProps {
  selectedCount: number;
  onCopyToClipboard: () => void;
  onClearSelection: () => void;
}

export function BulkActionsToolbar({
  selectedCount,
  onCopyToClipboard,
  onClearSelection,
}: BulkActionsToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-lg dark:border-slate-700 dark:bg-slate-800">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {selectedCount} task{selectedCount !== 1 ? "s" : ""} selected
      </span>
      <Button size="sm" variant="outline" onClick={onCopyToClipboard}>
        Copy Tasks to Clipboard ({selectedCount})
      </Button>
      <Button size="icon" variant="ghost" onClick={onClearSelection} aria-label="Clear selection">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
