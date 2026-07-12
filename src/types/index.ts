export type {
  Project,
  Task,
  Milestone,
  CalendarEvent,
  ProjectStatus,
  Priority,
  TaskStatus,
  EventType,
} from "@prisma/client";

export type ProjectFormData = {
  name: string;
  description?: string;
  status?: "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
  color?: string;
  deadline?: string;
};

export type TaskFormData = {
  title: string;
  description?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  urgent?: boolean;
  important?: boolean;
  status?: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
  estimatedMinutes?: number;
  dueDate?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  projectId: string;
  parentTaskId?: string;
};

export type CalendarEventFormData = {
  title: string;
  start: string;
  end: string;
  allDay?: boolean;
  type?: "EVENT" | "TASK_BLOCK";
  linkedTaskId?: string;
  linkedProjectId?: string;
  notes?: string;
};

export type TaskFilters = {
  projectId?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status?: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
  urgent?: boolean;
  important?: boolean;
  search?: string;
  showArchived?: boolean;
};
