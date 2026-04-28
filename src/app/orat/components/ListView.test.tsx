import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ListView } from "./ListView";
import type { Task } from "../types";

// jsdom lacks pointer-capture and scrollIntoView APIs that Radix Select uses
// internally; stub them so the trigger can be opened in tests.
beforeAll(() => {
  if (!("hasPointerCapture" in HTMLElement.prototype)) {
    Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
      value: () => false,
      writable: true,
    });
  }
  if (!("releasePointerCapture" in HTMLElement.prototype)) {
    Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
      value: () => {},
      writable: true,
    });
  }
  if (!("scrollIntoView" in HTMLElement.prototype)) {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      value: () => {},
      writable: true,
    });
  }
});

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
    history: [],
    ...overrides,
  };
}

const baseProps = {
  selectedTaskIds: new Set<string>(),
  onToggleSelect: vi.fn(),
  onTaskClick: vi.fn(),
  getAssigneeName: (id: string) => {
    if (id === "u-1") return "Alice Anderson";
    if (id === "u-2") return "Bob Brown";
    return id;
  },
};

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("ListView — group-by control", () => {
  it("defaults to ungrouped (a single sortable table)", () => {
    const tasks = [
      makeTask({ id: "a", title: "Alpha" }),
      makeTask({ id: "b", title: "Beta" }),
    ];
    render(<ListView tasks={tasks} {...baseProps} />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByLabelText(/group by/i)).toBeInTheDocument();
  });

  it("groups by Assignee when chosen, with collapsible headers and counts", async () => {
    const user = userEvent.setup();
    const tasks = [
      makeTask({ id: "a", title: "Alpha", assignedTo: "u-1" }),
      makeTask({ id: "b", title: "Beta", assignedTo: "u-2" }),
      makeTask({ id: "c", title: "Charlie", assignedTo: "u-1" }),
    ];
    render(<ListView tasks={tasks} {...baseProps} />);

    await user.click(screen.getByLabelText(/group by/i));
    await user.click(await screen.findByRole("option", { name: /assignee/i }));

    const aliceHeader = await screen.findByRole("button", {
      name: /alice anderson.*\(2\)/i,
    });
    expect(aliceHeader).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /bob brown.*\(1\)/i })
    ).toBeInTheDocument();
  });

  it("collapsing a group hides its tasks but keeps the count visible", async () => {
    const user = userEvent.setup();
    const tasks = [
      makeTask({ id: "a", title: "Alpha", assignedTo: "u-1" }),
      makeTask({ id: "b", title: "Beta", assignedTo: "u-2" }),
    ];
    render(<ListView tasks={tasks} {...baseProps} />);

    await user.click(screen.getByLabelText(/group by/i));
    await user.click(await screen.findByRole("option", { name: /assignee/i }));

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    const header = await screen.findByRole("button", {
      name: /alice anderson.*\(1\)/i,
    });
    await user.click(header);

    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /alice anderson.*\(1\)/i })
    ).toBeInTheDocument();
  });

  it("buckets tasks with no assignee under 'Unassigned'", async () => {
    const user = userEvent.setup();
    const tasks = [
      makeTask({ id: "a", title: "Alpha", assignedTo: "u-1" }),
      makeTask({ id: "u", title: "UnownedTask", assignedTo: "" }),
    ];
    render(<ListView tasks={tasks} {...baseProps} />);

    await user.click(screen.getByLabelText(/group by/i));
    await user.click(await screen.findByRole("option", { name: /assignee/i }));

    expect(
      await screen.findByRole("button", { name: /unassigned.*\(1\)/i })
    ).toBeInTheDocument();
  });

  it("persists the selected group-by to localStorage", async () => {
    const user = userEvent.setup();
    const tasks = [makeTask({ id: "a" })];
    render(<ListView tasks={tasks} {...baseProps} />);

    await user.click(screen.getByLabelText(/group by/i));
    await user.click(await screen.findByRole("option", { name: /project/i }));

    expect(window.localStorage.getItem("orat:list:groupBy")).toBe("project");
  });

  it("restores the previously chosen group-by from localStorage on mount", async () => {
    window.localStorage.setItem("orat:list:groupBy", "assignee");
    const tasks = [
      makeTask({ id: "a", title: "Alpha", assignedTo: "u-1" }),
      makeTask({ id: "b", title: "Beta", assignedTo: "u-2" }),
    ];
    render(<ListView tasks={tasks} {...baseProps} />);

    expect(
      await screen.findByRole("button", { name: /alice anderson.*\(1\)/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /bob brown.*\(1\)/i })
    ).toBeInTheDocument();
  });
});

describe("ListView — group-by due date", () => {
  it("renders due-bucket groups in canonical order", async () => {
    const user = userEvent.setup();
    const tasks = [
      makeTask({ id: "later", title: "FarFuture", currentDueDate: "2099-01-01" }),
      makeTask({
        id: "overdue",
        title: "PastTask",
        status: "In Progress",
        currentDueDate: "2020-01-01",
      }),
    ];
    render(<ListView tasks={tasks} {...baseProps} />);

    await user.click(screen.getByLabelText(/group by/i));
    await user.click(await screen.findByRole("option", { name: /due date/i }));

    const headerButtons = screen
      .getAllByRole("button")
      .map((b) => b.textContent ?? "")
      .filter((t) => /Overdue|Due today|This week|Next week|Later/.test(t));
    expect(headerButtons[0]).toMatch(/Overdue/);
    const overdueGroup = screen.getByRole("button", { name: /^Overdue.*\(1\)/i });
    const overdueRegion = overdueGroup.closest("section, div") as HTMLElement;
    expect(within(overdueRegion).getByText("PastTask")).toBeInTheDocument();
  });
});
