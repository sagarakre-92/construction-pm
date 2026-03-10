import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TaskItem } from "./TaskItem";
import type { Task } from "@/types/database";

const mockTask: Task = {
  id: "1",
  user_id: "user-1",
  title: "Install foundation",
  description: "Concrete pour",
  status: "todo",
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

describe("TaskItem", () => {
  it("renders task title and description", () => {
    const onDelete = vi.fn().mockResolvedValue({ error: null });
    render(<TaskItem task={mockTask} onDelete={onDelete} />);
    expect(screen.getByText("Install foundation")).toBeInTheDocument();
    expect(screen.getByText("Concrete pour")).toBeInTheDocument();
  });

  it("calls onDelete when Delete is clicked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue({ error: null });
    render(<TaskItem task={mockTask} onDelete={onDelete} />);
    await user.click(screen.getByRole("button", { name: /delete task/i }));
    expect(onDelete).toHaveBeenCalledWith("1");
  });
});
