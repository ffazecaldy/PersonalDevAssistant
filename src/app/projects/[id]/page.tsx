"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Check, Plus, Trash2, Clock, Calendar } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, getStatusColor, getPriorityColor } from "@/lib/utils";
import { Task, Milestone } from "@/types";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [newMilestoneDate, setNewMilestoneDate] = useState("");

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => fetch(`/api/projects/${id}`).then((r) => r.json()),
    enabled: !!id,
  });

  const toggleMilestone = useMutation({
    mutationFn: (milestone: Milestone) =>
      fetch(`/api/milestones/${milestone.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !milestone.done }),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed to update milestone");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      toast.success("Milestone aggiornato");
    },
    onError: () => {
      toast.error("Errore nell'aggiornamento del milestone");
    },
  });

  const deleteMilestone = useMutation({
    mutationFn: (milestoneId: string) =>
      fetch(`/api/milestones/${milestoneId}`, {
        method: "DELETE",
      }).then((r) => {
        if (!r.ok) throw new Error("Failed to delete milestone");
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      toast.success("Milestone eliminato");
    },
    onError: () => {
      toast.error("Errore nell'eliminazione del milestone");
    },
  });

  const createMilestone = useMutation({
    mutationFn: () =>
      fetch("/api/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newMilestoneTitle,
          dueDate: newMilestoneDate || null,
          projectId: id,
        }),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed to create milestone");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      toast.success("Milestone creato");
      setShowAddMilestone(false);
      setNewMilestoneTitle("");
      setNewMilestoneDate("");
    },
    onError: () => {
      toast.error("Errore nella creazione del milestone");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!project) {
    return <div>Progetto non trovato</div>;
  }

  const tasksByStatus = {
    TODO: (project.tasks || []).filter((t: Task) => t.status === "TODO"),
    IN_PROGRESS: (project.tasks || []).filter((t: Task) => t.status === "IN_PROGRESS"),
    BLOCKED: (project.tasks || []).filter((t: Task) => t.status === "BLOCKED"),
    DONE: (project.tasks || []).filter((t: Task) => t.status === "DONE"),
  };

  const totalTasks = project.tasks?.length || 0;
  const doneTasks = tasksByStatus.DONE.length;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const milestones: Milestone[] = project.milestones || [];
  const doneMilestones = milestones.filter((m: Milestone) => m.done).length;
  const milestoneProgress = milestones.length > 0 ? Math.round((doneMilestones / milestones.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            <Badge variant="outline" className="text-xs font-mono">
              {project.status}
            </Badge>
          </div>
          {project.description && (
            <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground font-mono">
            <span>{totalTasks} task</span>
            <span>{milestones.length} milestone</span>
            {project.deadline && <span>Scadenza: {formatDate(project.deadline)}</span>}
          </div>
        </div>
      </div>

      <div className="w-full bg-muted rounded-full h-2">
        <div
          className="bg-primary h-2 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground font-mono">{progress}% completato</p>

      {/* Milestones Section */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-mono flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Milestone
            {milestones.length > 0 && (
              <span className="text-xs text-muted-foreground font-normal">
                ({doneMilestones}/{milestones.length})
              </span>
            )}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddMilestone(!showAddMilestone)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Aggiungi
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {milestones.length > 0 && (
            <div className="w-full bg-muted rounded-full h-1.5 mb-3">
              <div
                className="bg-green-500 h-1.5 rounded-full transition-all"
                style={{ width: `${milestoneProgress}%` }}
              />
            </div>
          )}

          {showAddMilestone && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-muted/30 border border-border/50 mb-2">
              <Input
                placeholder="Titolo milestone..."
                value={newMilestoneTitle}
                onChange={(e) => setNewMilestoneTitle(e.target.value)}
                className="flex-1 text-sm h-9"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newMilestoneTitle.trim()) {
                    createMilestone.mutate();
                  }
                }}
              />
              <Input
                type="date"
                value={newMilestoneDate}
                onChange={(e) => setNewMilestoneDate(e.target.value)}
                className="w-40 text-sm h-9"
              />
              <Button
                size="sm"
                onClick={() => createMilestone.mutate()}
                disabled={!newMilestoneTitle.trim() || createMilestone.isPending}
              >
                {createMilestone.isPending ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-background border-r-transparent" />
                ) : (
                  "Crea"
                )}
              </Button>
            </div>
          )}

          {milestones.map((milestone: Milestone) => (
            <div
              key={milestone.id}
              className={`flex items-center gap-3 p-3 rounded-md border transition-colors ${
                milestone.done
                  ? "bg-green-500/5 border-green-500/20"
                  : "bg-muted/30 border-border/50"
              }`}
            >
              <button
                onClick={() => toggleMilestone.mutate(milestone)}
                disabled={toggleMilestone.isPending}
                className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  milestone.done
                    ? "bg-green-500 border-green-500 text-white"
                    : "border-muted-foreground/30 hover:border-muted-foreground/60"
                }`}
              >
                {milestone.done && <Check className="h-3 w-3" />}
              </button>
              <div className="flex-1 min-w-0">
                <span
                  className={`text-sm block truncate ${
                    milestone.done ? "line-through text-muted-foreground" : ""
                  }`}
                >
                  {milestone.title}
                </span>
                {milestone.dueDate && (
                  <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3" />
                    {formatDate(milestone.dueDate)}
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  if (confirm("Eliminare questo milestone?")) {
                    deleteMilestone.mutate(milestone.id);
                  }
                }}
                disabled={deleteMilestone.isPending}
                className="shrink-0 text-muted-foreground hover:text-red-500 transition-colors p-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {milestones.length === 0 && !showAddMilestone && (
            <p className="text-xs text-muted-foreground py-4 text-center">
              Nessun milestone. Aggiungine uno per tracciare gli obiettivi del progetto.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Tasks Columns */}
      <div className="grid grid-cols-4 gap-4">
        {(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const).map((status) => (
          <Card key={status} className={status === "DONE" ? "border-green-500/20" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono flex items-center justify-between">
                <span className={getStatusColor(status)}>{status.replace("_", " ")}</span>
                <span className="text-muted-foreground">{tasksByStatus[status].length}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {tasksByStatus[status].slice(0, 5).map((task: Task & { project?: { id: string; name: string; color: string } }) => (
                <div
                  key={task.id}
                  className="p-2 rounded-md bg-muted/30 border border-border/50 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{task.title}</span>
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-[9px] font-mono ${getPriorityColor(task.priority)}`}
                    >
                      {task.priority}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
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
              ))}
              {tasksByStatus[status].length === 0 && (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  Nessun task
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
