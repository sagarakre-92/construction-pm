import { describe, it, expect } from "vitest";
import type { Task, TaskStatus } from "../types";
import {
  isOverdue,
  getEffectiveStatus,
  getKanbanColumnStatus,
  formatDate,
  getStatusBadgeVariant,
} from "./task-utils";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Sample task",
    assignedTo: "user-1",
    company: "Acme",
    createdDate: "2025-01-01",
    startDate: "2025-01-01",
    originalDueDate: "2025-01-15",
    currentDueDate: "2025-01-15",
    status: "Not Started",
    priority: "medium",
    history: [],
    ...overrides,
  };
}

describe("isOverdue", () => {
  it("returns true when currentDueDate is before today and status is not Complete", () => {
    const task = makeTask({ currentDueDate: "2025-01-10", status: "In Progress" });
    expect(isOverdue(task, "2025-01-15")).toBe(true);
  });

  it("returns false when currentDueDate equals today", () => {
    const task = makeTask({ currentDueDate: "2025-01-15", status: "In Progress" });
    expect(isOverdue(task, "2025-01-15")).toBe(false);
  });

  it("returns false when currentDueDate is in the future", () => {
    const task = makeTask({ currentDueDate: "2025-02-01", status: "Not Started" });
    expect(isOverdue(task, "2025-01-15")).toBe(false);
  });

  it("returns false when past-due but status is Complete", () => {
    const task = makeTask({ currentDueDate: "2025-01-10", status: "Complete" });
    expect(isOverdue(task, "2025-01-15")).toBe(false);
  });

  it("accepts an explicit today parameter (date injection)", () => {
    const task = makeTask({ currentDueDate: "2025-06-01", status: "In Progress" });
    expect(isOverdue(task, "2025-05-31")).toBe(false);
    expect(isOverdue(task, "2025-06-02")).toBe(true);
  });
});

describe("getKanbanColumnStatus", () => {
  it("maps stored columns 1:1 except legacy Overdue → In Progress", () => {
    expect(getKanbanColumnStatus(makeTask({ status: "Not Started" }))).toBe("Not Started");
    expect(getKanbanColumnStatus(makeTask({ status: "In Progress" }))).toBe("In Progress");
    expect(getKanbanColumnStatus(makeTask({ status: "Complete" }))).toBe("Complete");
    expect(getKanbanColumnStatus(makeTask({ status: "Overdue" }))).toBe("In Progress");
  });
});

describe("getEffectiveStatus", () => {
  it("returns Complete when status is Complete even if past-due", () => {
    const task = makeTask({ currentDueDate: "2020-01-01", status: "Complete" });
    expect(getEffectiveStatus(task, "2025-01-15")).toBe("Complete");
  });

  it("returns Overdue when past-due and not complete", () => {
    const task = makeTask({ currentDueDate: "2025-01-10", status: "In Progress" });
    expect(getEffectiveStatus(task, "2025-01-15")).toBe("Overdue");
  });

  it("returns the underlying status when not overdue and not complete", () => {
    const inProgress = makeTask({
      currentDueDate: "2025-02-01",
      status: "In Progress",
    });
    const notStarted = makeTask({
      currentDueDate: "2025-01-15",
      status: "Not Started",
    });
    expect(getEffectiveStatus(inProgress, "2025-01-15")).toBe("In Progress");
    expect(getEffectiveStatus(notStarted, "2025-01-15")).toBe("Not Started");
  });

  it("accepts an explicit today parameter (date injection)", () => {
    const task = makeTask({ currentDueDate: "2025-06-01", status: "Not Started" });
    expect(getEffectiveStatus(task, "2025-05-31")).toBe("Not Started");
    expect(getEffectiveStatus(task, "2025-06-02")).toBe("Overdue");
  });
});

describe("formatDate", () => {
  it("formats a YYYY-MM-DD string in en-US 'Mon D, YYYY' form", () => {
    // formatDate parses input as UTC midnight and renders in the runtime
    // timezone, so the day may shift +/- 1. Pin to a mid-month date to
    // avoid month/year rollover, then assert format + year.
    const result = formatDate("2025-06-15");
    expect(result).toMatch(/^Jun (14|15|16), 2025$/);
  });

  it("handles different months and years correctly", () => {
    expect(formatDate("2024-08-20")).toMatch(/^Aug (19|20|21), 2024$/);
    expect(formatDate("2026-03-10")).toMatch(/^Mar (9|10|11), 2026$/);
  });
});

describe("getStatusBadgeVariant", () => {
  it("maps each TaskStatus to its expected variant", () => {
    expect(getStatusBadgeVariant("Not Started")).toBe("not-started");
    expect(getStatusBadgeVariant("In Progress")).toBe("in-progress");
    expect(getStatusBadgeVariant("Complete")).toBe("complete");
    expect(getStatusBadgeVariant("Overdue")).toBe("overdue");
  });

  it("returns 'default' for an unknown status value", () => {
    expect(getStatusBadgeVariant("Unknown" as TaskStatus)).toBe("default");
  });
});
