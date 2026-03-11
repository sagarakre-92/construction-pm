"use client";

import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import type { Project } from "../types";
import { cn } from "@/lib/utils";

interface ProjectsPanelProps {
  projects: Project[];
  currentProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  onCreateProject: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function ProjectsPanel({
  projects,
  currentProjectId,
  onSelectProject,
  onCreateProject,
  mobileOpen = false,
  onMobileClose,
}: ProjectsPanelProps) {
  const activeProjects = projects.filter((p) => !p.archived);

  return (
    <>
      {/* Backdrop on mobile when open */}
      {onMobileClose && (
        <div
          className={cn(
            "fixed inset-0 z-40 bg-slate-900/50 transition-opacity lg:hidden",
            mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
          )}
          onClick={onMobileClose}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          "flex w-[280px] shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800",
          "fixed inset-y-0 left-0 z-50 transform transition-transform lg:static lg:translate-x-0",
          onMobileClose && !mobileOpen && "-translate-x-full"
        )}
      >
        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-white">Projects</h2>
            <div className="flex items-center gap-2">
              {onMobileClose && (
                <Button size="icon" variant="ghost" className="lg:hidden" onClick={onMobileClose} aria-label="Close menu">
                  <X className="h-4 w-4" />
                </Button>
              )}
              <Button size="sm" onClick={onCreateProject}>
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Create Project</span>
              </Button>
            </div>
          </div>
          <nav className="flex flex-col gap-1">
            <button
              onClick={() => {
                onSelectProject("all-projects");
                onMobileClose?.();
              }}
              className={cn(
                "rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                currentProjectId === "all-projects"
                  ? "bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300"
                  : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
              )}
            >
              All Projects
            </button>
            {activeProjects.map((project) => (
              <button
                key={project.id}
                onClick={() => {
                  onSelectProject(project.id);
                  onMobileClose?.();
                }}
                className={cn(
                  "rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                  currentProjectId === project.id
                    ? "bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                )}
              >
                {project.name}
              </button>
            ))}
          </nav>
          <div className="mt-auto pt-4 text-xs text-slate-500 dark:text-slate-400">
            {activeProjects.length} active project{activeProjects.length !== 1 ? "s" : ""}
          </div>
        </div>
      </aside>
    </>
  );
}
