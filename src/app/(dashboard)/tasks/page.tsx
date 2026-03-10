import { getTasks } from "./actions";
import { TaskList } from "@/components/tasks/TaskList";

export default async function TasksPage() {
  const { data: initialTasks } = await getTasks();

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
        Tasks
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-6">
        Create and manage your construction tasks.
      </p>
      <TaskList initialTasks={initialTasks} />
    </div>
  );
}
