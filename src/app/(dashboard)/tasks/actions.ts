"use server";

import { createClient } from "@/lib/supabase/server";
import type { Task } from "@/types/database";

export async function getTasks(): Promise<
  { data: Task[] | null; error: string | null }
> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: "Not authenticated" };
    }
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load tasks";
    return { data: null, error: message };
  }
}

export async function createTask(formData: FormData): Promise<{
  error: string | null;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { error: "Not authenticated" };
    }
    const title = formData.get("title") as string;
    if (!title?.trim()) {
      return { error: "Title is required" };
    }
    const { error } = await supabase.from("tasks").insert({
      user_id: user.id,
      title: title.trim(),
      description: (formData.get("description") as string) || null,
      status: "todo",
    });
    if (error) return { error: error.message };
    return { error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create task";
    return { error: message };
  }
}

export async function deleteTask(taskId: string): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { error: "Not authenticated" };
    }
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
    return { error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete task";
    return { error: message };
  }
}
