import type {
  InternalUser,
  ExternalStakeholder,
  Task,
  Project,
} from "./types";

export const MOCK_INTERNAL_USERS: InternalUser[] = [
  { id: "iu-1", firstName: "Jane", lastName: "Smith", role: "Project Manager", company: "Acme Construction" },
  { id: "iu-2", firstName: "John", lastName: "Doe", role: "Superintendent", company: "Acme Construction" },
  { id: "iu-3", firstName: "Maria", lastName: "Garcia", role: "Engineer", company: "Acme Construction" },
  { id: "iu-4", firstName: "David", lastName: "Lee", role: "Estimator", company: "Acme Construction" },
];

const today = new Date().toISOString().slice(0, 10);
const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const external1: ExternalStakeholder = {
  id: "ex-1",
  firstName: "Chris",
  lastName: "Owner",
  role: "Owner's Rep",
  company: "Client Co",
  projectId: "proj-1",
};

const external2: ExternalStakeholder = {
  id: "ex-2",
  firstName: "Pat",
  lastName: "Architect",
  role: "Architect",
  company: "Design Firm",
  projectId: "proj-1",
};

const task1: Task = {
  id: "task-1",
  title: "Submit RFI for foundation",
  description: "Get architect response on rebar spacing.",
  assignedTo: "iu-2",
  company: "Acme Construction",
  createdDate: lastWeek,
  startDate: lastWeek,
  originalDueDate: nextWeek,
  currentDueDate: nextWeek,
  status: "In Progress",
  meetingReference: "Weekly 3/1",
  projectId: "proj-1",
  history: [
    { date: lastWeek, action: "Task created", user: "Jane Smith" },
  ],
};

const task2: Task = {
  id: "task-2",
  title: "Schedule concrete pour",
  assignedTo: "iu-2",
  company: "Acme Construction",
  createdDate: lastWeek,
  startDate: today,
  originalDueDate: nextWeek,
  currentDueDate: nextWeek,
  status: "Not Started",
  projectId: "proj-1",
  history: [
    { date: lastWeek, action: "Task created", user: "Jane Smith" },
  ],
};

const task3: Task = {
  id: "task-3",
  title: "Review submittals",
  description: "Structural steel and MEP submittals.",
  assignedTo: "iu-3",
  company: "Acme Construction",
  createdDate: lastWeek,
  startDate: lastWeek,
  originalDueDate: today,
  currentDueDate: today,
  status: "Complete",
  projectId: "proj-1",
  history: [
    { date: lastWeek, action: "Task created", user: "Jane Smith" },
    { date: today, action: "Marked complete", user: "Maria Garcia" },
  ],
};

const task4: Task = {
  id: "task-4",
  title: "Permit approval follow-up",
  assignedTo: "ex-1",
  company: "Client Co",
  createdDate: lastWeek,
  startDate: lastWeek,
  originalDueDate: lastWeek,
  currentDueDate: lastWeek,
  status: "Overdue",
  projectId: "proj-1",
  history: [
    { date: lastWeek, action: "Task created", user: "Jane Smith" },
  ],
};

export const INITIAL_PROJECTS: Project[] = [
  {
    id: "proj-1",
    name: "Riverside Tower",
    description: "Client: Riverside Development LLC",
    createdDate: lastWeek,
    archived: false,
    internalTeamMembers: ["iu-1", "iu-2", "iu-3"],
    externalStakeholders: [external1, external2],
    tasks: [task1, task2, task3, task4],
  },
  {
    id: "proj-2",
    name: "Warehouse Phase 2",
    description: "Client: Logistics Inc",
    createdDate: lastWeek,
    archived: false,
    internalTeamMembers: ["iu-1", "iu-4"],
    externalStakeholders: [],
    tasks: [],
  },
];

export const CURRENT_USER_ID = "iu-1";
