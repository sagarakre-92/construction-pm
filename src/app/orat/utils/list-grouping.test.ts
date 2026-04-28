import { describe, it, expect } from "vitest";
import type { Task } from "../types";
import { bucketByDueDate, groupTasksBy } from "./list-grouping";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t-1",
    title: "Sample task",
    assignedTo: "user-1",
    company: "Acme",
    createdDate: "2026-01-01",
    startDate: "2026-01-01",
    originalDueDate: "2026-01-15",
    currentDueDate: "2026-01-15",
    status: "Not Started",
    history: [],
    ...overrides,
  };
}

describe("bucketByDueDate", () => {
  const today = "2026-04-15"; // a Wednesday

  it("returns 'Overdue' when currentDueDate is before today and not Complete", () => {
    const task = makeTask({ currentDueDate: "2026-04-10", status: "In Progress" });
    expect(bucketByDueDate(task, today)).toBe("Overdue");
  });

  it("returns 'Later' when past-due but Complete (Complete is never overdue)", () => {
    const task = makeTask({ currentDueDate: "2026-04-10", status: "Complete" });
    expect(bucketByDueDate(task, today)).toBe("Later");
  });

  it("returns 'Due today' when currentDueDate equals today", () => {
    const task = makeTask({ currentDueDate: "2026-04-15", status: "In Progress" });
    expect(bucketByDueDate(task, today)).toBe("Due today");
  });

  it("returns 'This week' for due dates 1..7 days after today (excluding today)", () => {
    const oneDay = makeTask({ currentDueDate: "2026-04-16" });
    const sevenDays = makeTask({ currentDueDate: "2026-04-22" });
    expect(bucketByDueDate(oneDay, today)).toBe("This week");
    expect(bucketByDueDate(sevenDays, today)).toBe("This week");
  });

  it("returns 'Next week' for due dates 8..14 days after today", () => {
    const eightDays = makeTask({ currentDueDate: "2026-04-23" });
    const fourteenDays = makeTask({ currentDueDate: "2026-04-29" });
    expect(bucketByDueDate(eightDays, today)).toBe("Next week");
    expect(bucketByDueDate(fourteenDays, today)).toBe("Next week");
  });

  it("returns 'Later' for due dates more than 14 days away", () => {
    const task = makeTask({ currentDueDate: "2026-05-01" });
    expect(bucketByDueDate(task, today)).toBe("Later");
  });

  it("returns 'Later' when currentDueDate is empty/null-ish", () => {
    const task = makeTask({ currentDueDate: "" });
    expect(bucketByDueDate(task, today)).toBe("Later");
  });
});

describe("groupTasksBy — due-bucket", () => {
  const today = "2026-04-15";

  it("returns groups in canonical order: Overdue, Due today, This week, Next week, Later", () => {
    const tasks: Task[] = [
      makeTask({ id: "a", currentDueDate: "2026-05-30" }), // Later
      makeTask({ id: "b", currentDueDate: "2026-04-10", status: "In Progress" }), // Overdue
      makeTask({ id: "c", currentDueDate: "2026-04-15" }), // Due today
      makeTask({ id: "d", currentDueDate: "2026-04-25" }), // Next week
      makeTask({ id: "e", currentDueDate: "2026-04-17" }), // This week
    ];
    const groups = groupTasksBy(tasks, "due-bucket", { today });
    expect(groups.map((g) => g.label)).toEqual([
      "Overdue",
      "Due today",
      "This week",
      "Next week",
      "Later",
    ]);
  });

  it("places each task in exactly the right bucket", () => {
    const tasks: Task[] = [
      makeTask({ id: "overdue", currentDueDate: "2026-04-10", status: "In Progress" }),
      makeTask({ id: "today", currentDueDate: "2026-04-15" }),
      makeTask({ id: "thisweek", currentDueDate: "2026-04-20" }),
      makeTask({ id: "nextweek", currentDueDate: "2026-04-25" }),
      makeTask({ id: "later", currentDueDate: "2026-06-01" }),
    ];
    const groups = groupTasksBy(tasks, "due-bucket", { today });
    const byLabel = Object.fromEntries(groups.map((g) => [g.label, g.tasks.map((t) => t.id)]));
    expect(byLabel["Overdue"]).toEqual(["overdue"]);
    expect(byLabel["Due today"]).toEqual(["today"]);
    expect(byLabel["This week"]).toEqual(["thisweek"]);
    expect(byLabel["Next week"]).toEqual(["nextweek"]);
    expect(byLabel["Later"]).toEqual(["later"]);
  });

  it("omits buckets that have no tasks (so the UI doesn't render empty groups)", () => {
    const tasks: Task[] = [
      makeTask({ id: "today", currentDueDate: "2026-04-15" }),
      makeTask({ id: "later", currentDueDate: "2026-06-01" }),
    ];
    const groups = groupTasksBy(tasks, "due-bucket", { today });
    expect(groups.map((g) => g.label)).toEqual(["Due today", "Later"]);
  });
});

describe("groupTasksBy — assignee", () => {
  const getName = (id: string, company: string): string => {
    if (id === "u-1") return "Alice Anderson";
    if (id === "u-2") return "Bob Brown";
    return company || id;
  };

  it("creates one group per unique assignee, alphabetised by display name", () => {
    const tasks: Task[] = [
      makeTask({ id: "t1", assignedTo: "u-2" }),
      makeTask({ id: "t2", assignedTo: "u-1" }),
      makeTask({ id: "t3", assignedTo: "u-2" }),
    ];
    const groups = groupTasksBy(tasks, "assignee", { getAssigneeName: getName });
    expect(groups.map((g) => g.label)).toEqual(["Alice Anderson", "Bob Brown"]);
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["t2"]);
    expect(groups[1].tasks.map((t) => t.id)).toEqual(["t1", "t3"]);
  });

  it("buckets tasks with no assignee under 'Unassigned' and sorts it last", () => {
    const tasks: Task[] = [
      makeTask({ id: "t1", assignedTo: "" }),
      makeTask({ id: "t2", assignedTo: "u-1" }),
    ];
    const groups = groupTasksBy(tasks, "assignee", { getAssigneeName: getName });
    expect(groups.map((g) => g.label)).toEqual(["Alice Anderson", "Unassigned"]);
    expect(groups[1].tasks.map((t) => t.id)).toEqual(["t1"]);
  });
});

describe("groupTasksBy — project", () => {
  it("creates one group per project name, alphabetised, with '(No project)' last", () => {
    const tasks: Task[] = [
      makeTask({ id: "t1", projectName: "Tower B" }),
      makeTask({ id: "t2", projectName: "Atrium" }),
      makeTask({ id: "t3", projectName: "Tower B" }),
      makeTask({ id: "t4" }), // no projectName
    ];
    const groups = groupTasksBy(tasks, "project");
    expect(groups.map((g) => g.label)).toEqual(["Atrium", "Tower B", "(No project)"]);
    const tower = groups.find((g) => g.label === "Tower B")!;
    expect(tower.tasks.map((t) => t.id)).toEqual(["t1", "t3"]);
  });
});

describe("groupTasksBy — status (effective)", () => {
  it("groups by effective status with canonical order (Overdue, Not Started, In Progress, Complete)", () => {
    const tasks: Task[] = [
      makeTask({ id: "complete", status: "Complete" }),
      makeTask({
        id: "overdue",
        status: "In Progress",
        currentDueDate: "2026-04-10",
      }),
      makeTask({ id: "notstarted", status: "Not Started", currentDueDate: "2026-05-01" }),
      makeTask({ id: "inprogress", status: "In Progress", currentDueDate: "2026-05-01" }),
    ];
    const groups = groupTasksBy(tasks, "status", { today: "2026-04-15" });
    expect(groups.map((g) => g.label)).toEqual([
      "Overdue",
      "Not Started",
      "In Progress",
      "Complete",
    ]);
  });

  it("omits status groups with zero tasks", () => {
    const tasks: Task[] = [
      makeTask({ id: "ns", status: "Not Started", currentDueDate: "2026-05-01" }),
    ];
    const groups = groupTasksBy(tasks, "status", { today: "2026-04-15" });
    expect(groups.map((g) => g.label)).toEqual(["Not Started"]);
  });
});

describe("groupTasksBy — none", () => {
  it("returns a single group containing every task in input order", () => {
    const tasks: Task[] = [
      makeTask({ id: "a" }),
      makeTask({ id: "b" }),
      makeTask({ id: "c" }),
    ];
    const groups = groupTasksBy(tasks, "none");
    expect(groups).toHaveLength(1);
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });
});
