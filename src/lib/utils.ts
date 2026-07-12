import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isOverdue(date: Date | string): boolean {
  return new Date(date) < new Date();
}

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case "URGENT": return "text-red-500 bg-red-500/10 border-red-500/20";
    case "HIGH":   return "text-orange-500 bg-orange-500/10 border-orange-500/20";
    case "MEDIUM": return "text-yellow-500 bg-yellow-500/10 border-yellow-500/20";
    case "LOW":    return "text-green-500 bg-green-500/10 border-green-500/20";
    default:       return "text-muted-foreground bg-muted/50";
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "DONE":        return "text-green-500 bg-green-500/10";
    case "IN_PROGRESS": return "text-blue-500 bg-blue-500/10";
    case "BLOCKED":     return "text-red-500 bg-red-500/10";
    case "TODO":        return "text-muted-foreground bg-muted/50";
    default:            return "text-muted-foreground bg-muted/50";
  }
}

export function getProjectStatusColor(status: string): string {
  switch (status) {
    case "ACTIVE":    return "text-green-500";
    case "PAUSED":    return "text-yellow-500";
    case "COMPLETED": return "text-blue-500";
    case "ARCHIVED":  return "text-muted-foreground";
    default:          return "text-muted-foreground";
  }
}
