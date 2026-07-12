"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, X, AlertTriangle, Star } from "lucide-react";
import { toast } from "sonner";
import { Task, TaskFormData, TaskFilters, Project } from "@/types";
import { formatDate, getPriorityColor, getStatusColor } from "@/lib/utils";

export default function TasksPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<TaskFilters>({});
  const [form, setForm] = useState<TaskFormData>({
    title: "",
    description: "",
    priority: "MEDIUM",
    status: "TODO",
  });

  const queryParams = new URLSearchParams();
  if (filters.projectId) queryParams.set("projectId", filters.projectId);
  if (filters.priority) queryParams.set("priority", filters.priority);
  if (filters.status) queryParams.set("status", filters.status);
  if (filters.search) queryParams.set("search", filters.search);

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["tasks", filters],
    queryFn: () =>
      fetch(`/api/tasks?${queryParams.toString()}`).then((r) => r.json()),
  });

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => fetch("/api/projects").then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: TaskFormData) =>
      fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setOpen(false);
      setForm({ title: "", description: "", priority: "MEDIUM", status: "TODO" });
      toast.success("Task creato");
    },
    onError: () => toast.error("Errore nella creazione"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TaskFormData> }) =>
      fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task aggiornato");
    },
    onError: () => toast.error("Errore aggiornamento"),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task archiviato");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    createMutation.mutate(form);
  };

  const toggleUrgent = useCallback(
    (task: Task) => {
      updateMutation.mutate({
        id: task.id,
        data: { urgent: !task.urgent },
      });
    },
    [updateMutation]
  );

  const toggleImportant = useCallback(
    (task: Task) => {
      updateMutation.mutate({
        id: task.id,
        data: { important: !task.important },
      });
    },
    [updateMutation]
  );

  const cycleStatus = useCallback(
    (task: Task) => {
      const statusCycle: Record<string, string> = {
        TODO: "IN_PROGRESS",
        IN_PROGRESS: "DONE",
        DONE: "TODO",
        BLOCKED: "TODO",
      };
      updateMutation.mutate({
        id: task.id,
        data: { status: statusCycle[task.status] as TaskFormData["status"] },
      });
    },
    [updateMutation]
  );

  const hasFilters = Object.values(filters).some((v) => v !== undefined && v !== "");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Task</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {Array.isArray(tasks) ? tasks.length : 0} task
            {hasFilters && " (filtrati)"}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="h-4 w-4 mr-2" />
            Nuovo Task
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuovo Task</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                placeholder="Titolo task"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                autoFocus
              />
              <Textarea
                placeholder="Descrizione (opzionale)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
              <div className="grid grid-cols-2 gap-4">
                <Select
                  value={form.priority}
                  onValueChange={(v: string | null) =>
                    setForm({ ...form, priority: (v as TaskFormData["priority"]) || "MEDIUM" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={form.projectId || ""}
                  onValueChange={(v: string | null) => setForm({ ...form, projectId: v || undefined })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Progetto" />
                  </SelectTrigger>
                  <SelectContent>
                    {(projects || []).map((p: Project) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Scadenza</label>
                  <Input
                    type="date"
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Minuti stimati</label>
                  <Input
                    type="number"
                    placeholder="es. 60"
                    onChange={(e) =>
                      setForm({ ...form, estimatedMinutes: parseInt(e.target.value) || undefined })
                    }
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={form.urgent ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setForm({ ...form, urgent: !form.urgent })}
                >
                  <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                  Urgente
                </Button>
                <Button
                  type="button"
                  variant={form.important ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setForm({ ...form, important: !form.important })}
                >
                  <Star className="h-3.5 w-3.5 mr-1" />
                  Importante
                </Button>
              </div>
              <Button type="submit" className="w-full" disabled={!form.title.trim()}>
                Crea Task
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca task..."
            className="pl-8 h-9 text-sm"
            value={filters.search || ""}
            onChange={(e) =>
              setFilters({ ...filters, search: e.target.value || undefined })
            }
          />
        </div>
        <Select
          value={filters.status || ""}
          onValueChange={(v: string | null) =>
            setFilters({ ...filters, status: (v !== null && v !== "all" ? v : undefined) as TaskFilters["status"] | undefined })
          }
        >
          <SelectTrigger className="w-[130px] h-9">
            <SelectValue placeholder="Stato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti</SelectItem>
            <SelectItem value="TODO">Todo</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="BLOCKED">Blocked</SelectItem>
            <SelectItem value="DONE">Done</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.priority || ""}
          onValueChange={(v: string | null) =>
            setFilters({ ...filters, priority: (v !== null && v !== "all" ? v : undefined) as TaskFilters["priority"] | undefined })
          }
        >
          <SelectTrigger className="w-[130px] h-9">
            <SelectValue placeholder="Priorità" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte</SelectItem>
            <SelectItem value="URGENT">Urgent</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.projectId || ""}
          onValueChange={(v: string | null) =>
            setFilters({ ...filters, projectId: v || undefined })
          }
        >
          <SelectTrigger className="w-[150px] h-9">
            <SelectValue placeholder="Progetto" />
          </SelectTrigger>
          <SelectContent>
            {(projects || []).map((p: Project) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={filters.urgent ? "default" : "outline"}
          size="sm"
          className="h-9"
          onClick={() =>
            setFilters({ ...filters, urgent: filters.urgent ? undefined : true })
          }
        >
          <AlertTriangle className="h-3.5 w-3.5 mr-1" />
          Urgenti
        </Button>
        <Button
          variant={filters.important ? "default" : "outline"}
          size="sm"
          className="h-9"
          onClick={() =>
            setFilters({ ...filters, important: filters.important ? undefined : true })
          }
        >
          <Star className="h-3.5 w-3.5 mr-1" />
          Importanti
        </Button>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9"
            onClick={() => setFilters({})}
          >
            <X className="h-4 w-4 mr-1" />
            Cancella filtri
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : (
        <div className="border rounded-lg divide-y divide-border">
          {(tasks || []).map((task: Task & { project?: { id: string; name: string; color: string } }) => (
            <div
              key={task.id}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors group"
            >
              <button
                onClick={() => cycleStatus(task)}
                className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  task.status === "DONE"
                    ? "bg-green-500 border-green-500"
                    : task.status === "IN_PROGRESS"
                    ? "border-blue-500"
                    : "border-muted-foreground/30 hover:border-muted-foreground"
                }`}
                title={`Click per: ${task.status === "TODO" ? "iniziare" : task.status === "IN_PROGRESS" ? "completare" : "riaprire"}`}
              >
                {task.status === "DONE" && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm truncate ${
                      task.status === "DONE" ? "line-through text-muted-foreground" : ""
                    }`}
                  >
                    {task.title}
                  </span>
                  <Badge
                    variant="outline"
                    className={`shrink-0 text-[9px] font-mono border-none ${getPriorityColor(task.priority)}`}
                  >
                    {task.priority}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`shrink-0 text-[9px] font-mono border-none ${getStatusColor(task.status)}`}
                  >
                    {task.status.replace("_", " ")}
                  </Badge>
                  {task.urgent && (
                    <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />
                  )}
                  {task.important && (
                    <Star className="h-3 w-3 text-yellow-500 shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {task.project && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {task.project.name}
                    </span>
                  )}
                  {task.dueDate && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {formatDate(task.dueDate)}
                    </span>
                  )}
                  {task.estimatedMinutes && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {task.estimatedMinutes}m
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => toggleUrgent(task)}
                  className={`p-1 rounded transition-colors ${
                    task.urgent ? "text-red-500 hover:bg-red-500/10" : "text-muted-foreground hover:text-red-500 hover:bg-muted"
                  }`}
                  title={task.urgent ? "Rimuovi urgente" : "Segna come urgente"}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => toggleImportant(task)}
                  className={`p-1 rounded transition-colors ${
                    task.important ? "text-yellow-500 hover:bg-yellow-500/10" : "text-muted-foreground hover:text-yellow-500 hover:bg-muted"
                  }`}
                  title={task.important ? "Rimuovi importante" : "Segna come importante"}
                >
                  <Star className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => archiveMutation.mutate(task.id)}
                  className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Archivia task"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          {(!tasks || tasks.length === 0) && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Nessun task trovato
            </div>
          )}
        </div>
      )}
    </div>
  );
}
