"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FolderKanban,
  CheckSquare,
  AlertTriangle,
  Calendar,
  Star,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { formatDate, getProjectStatusColor, getPriorityColor } from "@/lib/utils";
import { Project, Task } from "@/types";

export default function DashboardPage() {
  const { data: projects, isLoading: loadingProjects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => fetch("/api/projects").then((r) => r.json()),
  });

  const { data: tasks, isLoading: loadingTasks } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => fetch("/api/tasks?showArchived=false").then((r) => r.json()),
  });

  const { data: events } = useQuery({
    queryKey: ["events"],
    queryFn: () => {
      const today = new Date().toISOString().split("T")[0];
      return fetch(`/api/events?from=${today}`).then((r) => r.json());
    },
  });

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const todayTasks = (tasks || []).filter((t: Task) => {
    if (!t.dueDate) return false;
    return new Date(t.dueDate).toISOString().split("T")[0] === todayStr;
  });

  const overdueTasks = (tasks || []).filter(
    (t: Task) => t.dueDate && new Date(t.dueDate) < today && t.status !== "DONE"
  );

  const activeProjects = (projects || []).filter(
    (p: Project) => p.status === "ACTIVE"
  );

  const upcomingDeadlines = (projects || [])
    .filter((p: Project) => p.deadline && p.status === "ACTIVE")
    .sort((a: Project, b: Project) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
    .slice(0, 5);

  const urgentImportant = (tasks || []).filter(
    (t: Task) => t.urgent && t.important && t.status !== "DONE"
  );

  const doneToday = (tasks || []).filter((t: Task) => {
    if (!t.completedAt) return false;
    return new Date(t.completedAt).toISOString().split("T")[0] === todayStr;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {today.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Progetti Attivi</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingProjects ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{activeProjects.length}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Task Oggi</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingTasks ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{todayTasks.length}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">In Ritardo</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            {loadingTasks ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-destructive">
                {overdueTasks.length}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Urgente+Importante</CardTitle>
            <Star className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            {loadingTasks ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-red-500">
                {urgentImportant.length}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completati Oggi</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {loadingTasks ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-green-500">
                {doneToday.length}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Task in Scadenza Oggi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loadingTasks ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))
            ) : todayTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun task in scadenza oggi</p>
            ) : (
              todayTasks.slice(0, 5).map((task: Task & { project?: { id: string; name: string; color: string } }) => (
                <Link
                  key={task.id}
                  href={"/tasks"}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm truncate block">{task.title}</span>
                    {task.project && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono mt-0.5">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: task.project.color || '#888' }}
                        />
                        {task.project.name}
                      </span>
                    )}
                  </div>
                  <Badge variant="outline" className={`text-[10px] font-mono border-none ${getPriorityColor(task.priority)}`}>
                    {task.priority}
                  </Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Task in Ritardo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loadingTasks ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))
            ) : overdueTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun task in ritardo</p>
            ) : (
              overdueTasks.slice(0, 5).map((task: Task & { project?: { id: string; name: string; color: string } }) => (
                <Link
                  key={task.id}
                  href={"/tasks"}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors border-l-2 border-destructive"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm truncate block">{task.title}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      {task.project && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: task.project.color || '#888' }}
                          />
                          {task.project.name}
                        </span>
                      )}
                      {task.dueDate && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {formatDate(task.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-[10px] font-mono border-none ${getPriorityColor(task.priority)}`}>
                    {task.priority}
                  </Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scadenze Progetti</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loadingProjects ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))
            ) : upcomingDeadlines.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessuna scadenza imminente</p>
            ) : (
              upcomingDeadlines.map((project: Project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {project.color && (
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                    )}
                    <span className="text-sm truncate">{project.name}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                    {project.deadline ? formatDate(project.deadline) : ""}
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {urgentImportant.length > 0 && (
        <Card className="border-red-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Quadrante Critico — {urgentImportant.length} task da fare subito
            </CardTitle>
            <CardDescription>Task urgenti e importanti (Eisenhower Q1)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {urgentImportant.slice(0, 6).map((task: Task & { project?: { id: string; name: string; color: string } }) => (
                <Link
                  key={task.id}
                  href={"/tasks"}
                  className="flex items-center justify-between p-2 rounded-md bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm truncate block">{task.title}</span>
                    {task.project && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono mt-0.5">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: task.project.color || '#888' }}
                        />
                        {task.project.name}
                      </span>
                    )}
                  </div>
                  <Badge variant="outline" className={`text-[10px] font-mono border-none ${getPriorityColor(task.priority)}`}>
                    {task.priority}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
