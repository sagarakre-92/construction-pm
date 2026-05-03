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
  const column = heading.closest("div[data-board-column]");
  if (!column) throw new Error(`Column not found for ${title}`);
  return column as HTMLElement;
}

describe("KanbanView — columns and overdue chip", () => {
  it("renders three workflow columns without an Overdue swimlane", () => {
    render(<KanbanView tasks={[]} {...baseProps} />);
    const headings = screen
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(headings).toEqual(["Not Started", "In Progress", "Complete"]);
  });

  it("keeps past-due tasks in their stored status column and shows an Overdue chip", () => {
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

    expect(screen.queryByRole("heading", { name: "Overdue" })).not.toBeInTheDocument();

    const inProgressColumn = getColumn("In Progress");
    expect(within(inProgressColumn).getByText("Past-due thing")).toBeInTheDocument();
    expect(within(inProgressColumn).getByText("On-track thing")).toBeInTheDocument();
    expect(within(inProgressColumn).getByLabelText("Overdue")).toBeInTheDocument();
    expect(within(inProgressColumn).getAllByLabelText("Overdue")).toHaveLength(1);
  });

  it("does not show Overdue chip on Complete tasks that are past due", () => {
    const completedPastDue = makeTask({
      id: "done-1",
      title: "Finished work",
      currentDueDate: "2020-01-01",
      status: "Complete",
    });
    render(<KanbanView tasks={[completedPastDue]} {...baseProps} />);

    expect(screen.queryByLabelText("Overdue")).not.toBeInTheDocument();
    const completeColumn = getColumn("Complete");
    expect(within(completeColumn).getByText("Finished work")).toBeInTheDocument();
  });

  it("does not show Overdue chip when due date is today or later", () => {
    const today = new Date().toISOString().slice(0, 10);
    const onTrack = makeTask({
      id: "today-1",
      title: "Due today",
      currentDueDate: today,
      status: "Not Started",
    });
    render(<KanbanView tasks={[onTrack]} {...baseProps} />);

    expect(screen.queryByLabelText("Overdue")).not.toBeInTheDocument();
    const notStartedColumn = getColumn("Not Started");
    expect(within(notStartedColumn).getByText("Due today")).toBeInTheDocument();
  });

  it("dragging a past-due In Progress card onto Complete sets stored status to Complete", () => {
    const onStatusChange = vi.fn();
    const task = makeTask({
      id: "overdue-1",
      title: "Past task",
      currentDueDate: "2020-01-01",
      status: "In Progress",
    });
    render(
      <KanbanView tasks={[task]} {...baseProps} onStatusChange={onStatusChange} />
    );

    const completeColumn = getColumn("Complete");
    const dataTransfer = new Map<string, string>();
    dataTransfer.set("taskId", "overdue-1");
    dataTransfer.set("sourceStatus", "In Progress");
    const dropEvent = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(dropEvent, "dataTransfer", {
      value: { getData: (k: string) => dataTransfer.get(k) ?? "" },
    });
    completeColumn.dispatchEvent(dropEvent);

    expect(onStatusChange).toHaveBeenCalledWith("overdue-1", "Complete");
  });
});
