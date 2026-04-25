---
name: add-task-view
description: Add a new task visualization view (alongside Board, List, and Gantt) in the ORAT dashboard at /orat. Use when the user asks for a new way to display tasks — calendar view, swimlane view, matrix view, by-assignee view, etc.
---

# Add a new task view

ORAT has three views over the same task list: **Board** (Kanban), **List**
(table), **Timeline** (Gantt). Add a new view by mirroring the existing
shape — they all consume the same `Task[]` and helpers.

## Workflow

```
- [ ] 1. Create src/app/orat/components/<NewName>View.tsx (copy KanbanView.tsx as scaffold)
- [ ] 2. Use shared helpers from utils/task-utils.ts (status, dates, badges)
- [ ] 3. Wire the view into the tab switcher in src/app/orat/page.tsx
- [ ] 4. Add an icon from lucide-react and a tab label
- [ ] 5. Make sure selection + edit + status-change callbacks pass through
- [ ] 6. (Optional) Add a Vitest snapshot or Playwright visit test
```

## Step 1 — Scaffold the component

Copy `src/app/orat/components/KanbanView.tsx` and rename it. Keep the same
props interface so it slots in cleanly:

```tsx
"use client";

import type { Task, TaskStatus } from "../types";

interface MyNewViewProps {
  tasks: Task[];
  selectedTaskIds: Set<string>;
  onToggleSelect: (taskId: string) => void;
  onTaskClick: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  getAssigneeName: (id: string, company: string) => string;
}

export function MyNewView({ tasks, … }: MyNewViewProps) {
  // …render…
}
```

## Step 2 — Use shared utilities

Always derive task display state from `src/app/orat/utils/task-utils.ts`:
- `getEffectiveStatus(task)` — accounts for overdue
- `getStatusBadgeVariant(status)` — color of the status pill
- `formatDate(iso)` — human-readable date

Don't reinvent overdue/status logic in the view. Don't mutate task dates
client-side; that's a server action's job.

## Step 3 — Empty state

Use `<EmptyState />` from the same components folder when `tasks.length === 0`.

## Step 4 — Wire into the tab switcher

In `src/app/orat/page.tsx`, find the existing view switcher (Tabs) and add
a new tab. Match the pattern already there — don't introduce a different
state shape.

```tsx
import { MyNewView } from "./components/MyNewView";
import { CalendarDays } from "lucide-react";

// in JSX:
<TabsTrigger value="my-new"><CalendarDays className="h-4 w-4" /> My View</TabsTrigger>
…
<TabsContent value="my-new">
  <MyNewView
    tasks={filteredTasks}
    selectedTaskIds={selectedTaskIds}
    onToggleSelect={toggleSelect}
    onTaskClick={openTaskDialog}
    onStatusChange={handleStatusChange}
    getAssigneeName={getAssigneeName}
  />
</TabsContent>
```

## Step 5 — Don't break the others

The same `tasks`, `filteredTasks`, and selection state flow into all views.
If you find yourself wanting to fetch differently, **stop** — change the
upstream data flow once, not per-view.

## Step 6 — Style

- Use Tailwind + `cn()` from `@/lib/utils`.
- Use existing UI primitives (`Badge`, `Checkbox`, `Card`-style divs).
- Match spacing/typography of `KanbanView` for visual consistency.

## Anti-patterns

- ❌ A new view that calls `createClient` and fetches its own tasks.
  Tasks come in as props from the page.
- ❌ Changing `Task` type just to fit a view. Add a derived value in
  `task-utils.ts` instead.
- ❌ Calling a server action directly from the view component for status
  changes. Use the `onStatusChange` callback the page passes in.
- ❌ Adding a new charting / calendar dependency without checking whether
  `recharts` (already installed) can do it.
