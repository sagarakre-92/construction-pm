"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import type { Project, InternalUser, ExternalStakeholder } from "../types";
import { Plus, Trash2 } from "lucide-react";

interface EditProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
  internalUsers: InternalUser[];
  onSave: (project: Project) => void;
}

export function EditProjectDialog({
  open,
  onOpenChange,
  project,
  internalUsers,
  onSave,
}: EditProjectDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedInternalIds, setSelectedInternalIds] = useState<Set<string>>(new Set());
  const [externals, setExternals] = useState<ExternalStakeholder[]>([]);

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description ?? "");
      setSelectedInternalIds(new Set(project.internalTeamMembers));
      setExternals(project.externalStakeholders.map((e) => ({ ...e })));
    }
  }, [project, open]);

  const toggleInternal = (id: string) => {
    setSelectedInternalIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addExternal = () => {
    if (!project) return;
    setExternals((prev) => [
      ...prev,
      {
        id: `ex-temp-${Date.now()}`,
        firstName: "",
        lastName: "",
        role: "",
        company: "",
        projectId: project.id,
      },
    ]);
  };

  const updateExternal = (index: number, field: keyof ExternalStakeholder, value: string) => {
    setExternals((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeExternal = (index: number) => {
    setExternals((prev) => prev.filter((_, i) => i !== index));
  };

  const valid =
    name.trim().length > 0 &&
    (selectedInternalIds.size > 0 || externals.some((e) => e.firstName && e.lastName && e.role && e.company));

  const validExternals = externals.filter(
    (e) => e.firstName.trim() && e.lastName.trim() && e.role.trim() && e.company.trim()
  );

  const handleSave = () => {
    if (!project || !valid) return;
    onSave({
      ...project,
      name: name.trim(),
      description: description.trim() || undefined,
      internalTeamMembers: Array.from(selectedInternalIds),
      externalStakeholders: validExternals,
    });
    onOpenChange(false);
  };

  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Project Details</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="details">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Project Details</TabsTrigger>
            <TabsTrigger value="team">Team Members</TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Project Name (required)</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Project Description</Label>
              <Input
                id="edit-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <p className="text-xs text-slate-500">
                You can use this to write a short description of the project or for a client name.
              </p>
            </div>
          </TabsContent>
          <TabsContent value="team" className="space-y-4 pt-4">
            <div>
              <Label className="mb-2 block">Internal Team Members</Label>
              <div className="space-y-2 rounded-md border border-slate-200 p-3 dark:border-slate-700">
                {internalUsers.map((u) => (
                  <label key={u.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedInternalIds.has(u.id)}
                      onCheckedChange={() => toggleInternal(u.id)}
                    />
                    <span>
                      {u.firstName} {u.lastName} – {u.role}
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-slate-500">{selectedInternalIds.size} selected</p>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>External Stakeholders</Label>
                <Button type="button" size="sm" variant="outline" onClick={addExternal}>
                  <Plus className="h-4 w-4" />
                  Add External Member
                </Button>
              </div>
              <div className="space-y-3">
                {externals.map((ext, index) => (
                  <div
                    key={index}
                    className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700"
                  >
                    <Input
                      placeholder="First Name"
                      value={ext.firstName}
                      onChange={(e) => updateExternal(index, "firstName", e.target.value)}
                      className="min-w-[100px] flex-1"
                    />
                    <Input
                      placeholder="Last Name"
                      value={ext.lastName}
                      onChange={(e) => updateExternal(index, "lastName", e.target.value)}
                      className="min-w-[100px] flex-1"
                    />
                    <Input
                      placeholder="Role"
                      value={ext.role}
                      onChange={(e) => updateExternal(index, "role", e.target.value)}
                      className="min-w-[100px] flex-1"
                    />
                    <Input
                      placeholder="Company"
                      value={ext.company}
                      onChange={(e) => updateExternal(index, "company", e.target.value)}
                      className="min-w-[100px] flex-1"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeExternal(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!valid}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
