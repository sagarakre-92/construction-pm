"use client";

import { useState } from "react";
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

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  internalUsers: InternalUser[];
  onCreate: (project: Omit<Project, "id" | "createdDate" | "tasks">) => void;
}

const emptyExternal = (projectId: string): ExternalStakeholder => ({
  id: `ex-new-${Date.now()}`,
  firstName: "",
  lastName: "",
  role: "",
  company: "",
  projectId,
});

export function CreateProjectDialog({
  open,
  onOpenChange,
  internalUsers,
  onCreate,
}: CreateProjectDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedInternalIds, setSelectedInternalIds] = useState<Set<string>>(new Set());
  const [externals, setExternals] = useState<ExternalStakeholder[]>([]);

  const reset = () => {
    setName("");
    setDescription("");
    setSelectedInternalIds(new Set());
    setExternals([]);
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const toggleInternal = (id: string) => {
    setSelectedInternalIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addExternal = () => {
    setExternals((prev) => [...prev, emptyExternal("new")]);
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

  const valid = name.trim().length > 0;

  const validExternals = externals.filter(
    (e) => e.firstName.trim() && e.lastName.trim() && e.role.trim() && e.company.trim()
  );

  const handleSave = () => {
    if (!valid) return;
    onCreate({
      name: name.trim(),
      description: description.trim() || undefined,
      internalTeamMembers: Array.from(selectedInternalIds),
      externalStakeholders: validExternals.map((e) => ({ ...e })),
    });
    handleClose(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="details">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Project Details</TabsTrigger>
            <TabsTrigger value="team">Team Members</TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">Project Name (required)</Label>
              <Input
                id="create-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Riverside Tower"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-desc">Project Description</Label>
              <Input
                id="create-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Client name or short description"
              />
              <p className="text-xs text-slate-500">
                You can use this to write a short description of the project or for a client name.
                This will appear as a sub header in the project page.
              </p>
            </div>
          </TabsContent>
          <TabsContent value="team" className="space-y-4 pt-4">
            <div>
              <Label className="mb-2 block">Internal Team Members</Label>
              <div className="space-y-2 rounded-md border border-slate-200 p-3 dark:border-slate-700">
                {internalUsers.map((u) => (
                  <label
                    key={u.id}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
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
              <p className="mt-1 text-xs text-slate-500">
                {selectedInternalIds.size} selected
              </p>
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
                      className="flex-1 min-w-[100px]"
                    />
                    <Input
                      placeholder="Last Name"
                      value={ext.lastName}
                      onChange={(e) => updateExternal(index, "lastName", e.target.value)}
                      className="flex-1 min-w-[100px]"
                    />
                    <Input
                      placeholder="Role"
                      value={ext.role}
                      onChange={(e) => updateExternal(index, "role", e.target.value)}
                      className="flex-1 min-w-[100px]"
                    />
                    <Input
                      placeholder="Company"
                      value={ext.company}
                      onChange={(e) => updateExternal(index, "company", e.target.value)}
                      className="flex-1 min-w-[100px]"
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
          <Button variant="outline" onClick={() => handleClose(false)}>
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
