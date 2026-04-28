export type TaskStatus = "Not Started" | "In Progress" | "Complete" | "Overdue";

export type Organization = {
  id: string;
  name: string;
  slug: string;
};

export type InternalUser = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  company: string;
};

export type ExternalStakeholder = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  company: string;
  projectId: string;
};

export type Task = {
  id: string;
  title: string;
  description?: string;
  assignedTo: string;
  company: string;
  createdDate: string;
  startDate: string;
  originalDueDate: string;
  currentDueDate: string;
  status: TaskStatus;
  sortOrder?: number;
  meetingReference?: string;
  projectName?: string;
  projectId?: string;
  organizationId?: string;
  history: {
    date: string;
    action: string;
    user: string;
  }[];
};

export type Project = {
  id: string;
  name: string;
  description?: string;
  createdDate: string;
  archived?: boolean;
  organizationId: string;
  internalTeamMembers: string[];
  externalStakeholders: ExternalStakeholder[];
  tasks: Task[];
};

/**
 * Per-project membership role (gates UI capabilities for project-scoped collaborators).
 * Org owner/admin override is reflected by `getProjectRole` returning "owner" or "admin".
 */
export type ProjectMembershipRole = "owner" | "admin" | "editor" | "viewer";

/**
 * An invitation to join an organization (org-wide) or a single project (project-scoped).
 * When `projectId` is set, accepting it grants the invitee access to only that project
 * with the given `projectRole`. When `projectId` is undefined, it's the existing
 * org-wide invitation (grants membership to every project on accept).
 */
export type Invitation = {
  id: string;
  email: string;
  /** Organization-level role on accept (org-wide invitations). Always 'member' for project-scoped invites. */
  role: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  firstName: string;
  lastName: string;
  title: string;
  /** Set when the invitation is project-scoped. */
  projectId?: string;
  /** Project membership role granted on accept (project-scoped invitations only). */
  projectRole?: "editor" | "viewer";
  /** Display name of the project for project-scoped invitations. */
  projectName?: string;
};
