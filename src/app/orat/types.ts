export type TaskStatus = "Not Started" | "In Progress" | "Complete" | "Overdue";

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
  meetingReference?: string;
  projectName?: string;
  projectId?: string;
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
  internalTeamMembers: string[];
  externalStakeholders: ExternalStakeholder[];
  tasks: Task[];
};
