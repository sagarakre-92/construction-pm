import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KanbanView } from "./KanbanView";
import type { Task } from "../types";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t-1",
    title: "Sample task",
    assignedTo: "u-1",
    company: "Acme",
    createdDate: "2026-01-01",
    startDate: "2026-01-01",
    originalDueDate: "2026-12-01",
    currentDueDate: "2026-12-01",
    status: "Not Started",
    priority: "medium",
    history: [],
    ...overrides,
  };
}

const baseProps = {
  selectedTaskIds: new Set<string>(),
  onToggleSelect: vi.fn(),
  onTaskClick: vi.fn(),
  onStatusChange: vi.fn(),
  onReorder: vi.fn(),
  getAssigneeName: (id: string) => id,
};

function getColumn(title: string): HTMLElement {
  const heading = screen.getByRole("heading", { name: title });
  // The board column is the heading's grandparent <div> — climb to the
  // wrapper that contains both the header and the body.
  const column = heading.closest("div[data-board-column]");
  if (!column) throw new Error(`Column not found for ${title}`);
  return column as HTMLElement;
}

describe("KanbanView — Overdue swimlane", () => {
  it("renders an 'Overdue' column before 'Not Started'", () => {
    render(<KanbanView tasks={[]} {...baseProps} />);
    const headings = screen
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(headings).toEqual(["Overdue", "Not Started", "In Progress", "Complete"]);
  });

  it("shows overdue tasks in the Overdue column and removes them from Not Started / In Progress", () => {
    const overdueTask = makeTask({
      id: "overdue-1",
      title: "Past-due thing",
      currentDueDate: "2020-01-01",
      status: "In Progress",
    });
    const currentTask = makeTask({
      id: "current-1",
      title: "On-track thing",
      currentDueDate: "2099-01-01",
      status: "In Progress",
    });
    render(<KanbanView tasks={[overdueTask, currentTask]} {...baseProps} />);

    const overdueColumn = getColumn("Overdue");
    expect(within(overdueColumn).getByText("Past-due thing")).toBeInTheDocument();
    expect(within(overdueColumn).queryByText("On-track thing")).not.toBeInTheDocument();

    const inProgressColumn = getColumn("In Progress");
    expect(within(inProgressColumn).getByText("On-track thing")).toBeInTheDocument();
    expect(within(inProgressColumn).queryByText("Past-due thing")).not.toBeInTheDocument();
  });

  it("never shows a Complete-but-past-due task in the Overdue column", () => {
    const completedPastDue = makeTask({
      id: "done-1",
      title: "Finished work",
      currentDueDate: "2020-01-01",
      status: "Complete",
    });
    render(<KanbanView tasks={[completedPastDue]} {...baseProps} />);

    const overdueColumn = getColumn("Overdue");
    expect(within(overdueColumn).queryByText("Finished work")).not.toBeInTheDocument();
    const completeColumn = getColumn("Complete");
    expect(within(completeColumn).getByText("Finished work")).toBeInTheDocument();
  });

  it("dropping a card from another column onto Overdue is a no-op (does not call onStatusChange)", () => {
    const onStatusChange = vi.fn();
    const task = makeTask({
      id: "in-progress-1",
      title: "Live task",
      currentDueDate: "2099-01-01",
      status: "In Progress",
    });
    render(
      <KanbanView
        tasks={[task]}
        {...baseProps}
        onStatusChange={onStatusChange}
      />
    );

    const overdueColumn = getColumn("Overdue");
    const dataTransfer = new Map<string, string>();
    dataTransfer.set("taskId", "in-progress-1");
    dataTransfer.set("sourceStatus", "In Progress");
    const dropEvent = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(dropEvent, "dataTransfer", {
      value: { getData: (k: string) => dataTransfer.get(k) ?? "" },
    });
    overdueColumn.dispatchEvent(dropEvent);

    expect(onStatusChange).not.toHaveBeenCalled();
  });

  it("dragging a card from Overdue onto Complete sets stored status to 'Complete'", () => {
    const onStatusChange = vi.fn();
    const task = makeTask({
      id: "overdue-1",
      title: "Past task",
      currentDueDate: "2020-01-01",
      status: "In Progress",
    });
    render(
      <KanbanView
        tasks={[task]}
        {...baseProps}
        onStatusChange={onStatusChange}
      />
    );

    const completeColumn = getColumn("Complete");
    const dataTransfer = new Map<string, string>();
    dataTransfer.set("taskId", "overdue-1");
    dataTransfer.set("sourceStatus", "Overdue");
    const dropEvent = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(dropEvent, "dataTransfer", {
      value: { getData: (k: string) => dataTransfer.get(k) ?? "" },
    });
    completeColumn.dispatchEvent(dropEvent);

    expect(onStatusChange).toHaveBeenCalledWith("overdue-1", "Complete");
  });
});
