"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, X, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Task, TaskFilters, Project } from "@/types";
import { formatDate, getPriorityColor, getStatusColor } from "@/lib/utils";

// ─── Quadrant config ───────────────────────────────────────────────
type QuadrantKey = "q1" | "q2" | "q3" | "q4";

const QUADRANTS: Record<QuadrantKey, { label: string; subtitle: string; urgent: boolean; important: boolean; color: string; borderColor: string; bgColor: string }> = {
  q1: {
    label: "Do First",
    subtitle: "Urgent & Importante",
    urgent: true,
    important: true,
    color: "red",
    borderColor: "border-red-500/40",
    bgColor: "bg-red-500/5",
  },
  q2: {
    label: "Schedule",
    subtitle: "Non Urgent & Importante",
    urgent: false,
    important: true,
    color: "blue",
    borderColor: "border-blue-500/40",
    bgColor: "bg-blue-500/5",
  },
  q3: {
    label: "Delegate",
    subtitle: "Urgent & Non Importante",
    urgent: true,
    important: false,
    color: "orange",
    borderColor: "border-orange-500/40",
    bgColor: "bg-orange-500/5",
  },
  q4: {
    label: "Eliminate",
    subtitle: "Non Urgent & Non Importante",
    urgent: false,
    important: false,
    color: "muted",
    borderColor: "border-muted-foreground/20",
    bgColor: "bg-muted/30",
  },
};

function getQuadrantKey(urgent: boolean, important: boolean): QuadrantKey {
  if (urgent && important) return "q1";
  if (!urgent && important) return "q2";
  if (urgent && !important) return "q3";
  return "q4";
}

// ─── Draggable Task Card ───────────────────────────────────────────
const TaskCard = memo(function TaskCard({
  task,
}: {
  task: Task & { project?: { id: string; name: string; color: string } };
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: task,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: isDragging ? 999 : undefined,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-2 p-2.5 rounded-md border border-border bg-card hover:bg-accent/30 transition-colors group cursor-default text-xs"
    >
      <button
        className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground shrink-0 transition-colors"
        {...listeners}
        {...attributes}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`text-xs leading-tight truncate ${
              task.status === "DONE" ? "line-through text-muted-foreground" : ""
            }`}
          >
            {task.title}
          </span>
          <Badge
            variant="outline"
            className={`shrink-0 text-[9px] font-mono border-none leading-none px-1 py-0 ${getPriorityColor(task.priority)}`}
          >
            {task.priority}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {task.project ? (
            <span className="flex items-center gap-1 font-mono truncate">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: task.project.color || '#888' }}
              />
              {task.project.name}
            </span>
          ) : (
            <span className="font-mono text-muted-foreground/50 italic">Nessun progetto</span>
          )}
          {task.dueDate && (
            <span className="font-mono whitespace-nowrap">{formatDate(task.dueDate)}</span>
          )}
        </div>
      </div>
    </div>
  );
});

// ─── Droppable Quadrant ────────────────────────────────────────────
const Quadrant = memo(function Quadrant({
  quadKey,
  tasks,
  onStatusToggle,
  onTaskClick,
}: {
  quadKey: QuadrantKey;
  tasks: Task[];
  onStatusToggle: (task: Task) => void;
  onTaskClick: (task: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: quadKey });
  const q = QUADRANTS[quadKey];

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-lg border ${q.borderColor} ${q.bgColor} ${
        isOver ? "ring-2 ring-primary/40 shadow-lg" : ""
      } transition-all min-h-[300px]`}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full bg-${q.color}-500`} />
          <span className="text-xs font-semibold">{q.label}</span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">{tasks.length}</span>
      </div>
      <div className="px-2 py-1 border-b border-border/30">
        <span className="text-[10px] text-muted-foreground">{q.subtitle}</span>
      </div>
      <div className="flex-1 p-2 space-y-1.5 overflow-y-auto max-h-[400px]">
        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-32 text-[10px] text-muted-foreground/50 italic border-2 border-dashed border-muted-foreground/20 rounded-lg mx-2 my-4">
            Drop here
          </div>
        )}
        {tasks.map((task) => (
          <div key={task.id} className="group relative" onClick={() => onTaskClick(task)}>
            <TaskCard task={task} />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStatusToggle(task);
              }}
              className={`absolute top-2 right-2 text-[9px] font-mono px-1.5 py-0.5 rounded-sm border transition-opacity opacity-0 group-hover:opacity-100 cursor-pointer ${
                task.status === "TODO"
                  ? "border-muted-foreground/20 text-muted-foreground"
                  : task.status === "IN_PROGRESS"
                  ? "border-blue-500/30 text-blue-500 bg-blue-500/10"
                  : task.status === "DONE"
                  ? "border-green-500/30 text-green-500 bg-green-500/10"
                  : "border-red-500/30 text-red-500 bg-red-500/10"
              }`}
            >
              {task.status === "TODO"
                ? "TODO"
                : task.status === "IN_PROGRESS"
                ? "IP"
                : task.status === "DONE"
                ? "DONE"
                : "BLK"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
});

// ─── Drag Overlay Card ─────────────────────────────────────────────
function DragOverlayCard({ task }: { task: Task & { project?: { id: string; name: string; color: string } } }) {
  return (
    <div className="flex items-start gap-2 p-2.5 rounded-md border-2 border-primary bg-card shadow-xl text-xs max-w-[260px]">
      <div className="mt-0.5 text-muted-foreground">
        <GripVertical className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs leading-tight truncate">{task.title}</span>
          <Badge
            variant="outline"
            className={`shrink-0 text-[9px] font-mono border-none leading-none px-1 py-0 ${getPriorityColor(task.priority)}`}
          >
            {task.priority}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {task.project ? (
            <span className="flex items-center gap-1 font-mono truncate">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: task.project.color || '#888' }}
              />
              {task.project.name}
            </span>
          ) : (
            <span className="font-mono text-muted-foreground/50 italic">Nessun progetto</span>
          )}
          {task.dueDate && (
            <span className="font-mono whitespace-nowrap">{formatDate(task.dueDate)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Quick Edit Dialog ─────────────────────────────────────────────
function QuickEditDialog({
  task,
  open,
  onOpenChange,
  onSave,
  projects,
}: {
  task: (Task & { project?: { id: string; name: string; color: string } }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, data: Partial<Task>) => void;
  projects: Project[];
}) {
  const [form, setForm] = useState<Partial<Task>>({});

  // Reset form when task changes
  useEffect(() => {
    if (task) setForm({ ...task });
  }, [task]);

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-base">Modifica Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Titolo"
            value={form.title ?? task.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">Priorità</label>
              <Select
                value={form.priority ?? task.priority}
                onValueChange={(v: string | null) => setForm({ ...form, priority: (v ?? "MEDIUM") as Task["priority"] })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">Stato</label>
              <Select
                value={form.status ?? task.status}
                onValueChange={(v: string | null) => setForm({ ...form, status: (v ?? "TODO") as Task["status"] })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODO">Todo</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="BLOCKED">Blocked</SelectItem>
                  <SelectItem value="DONE">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">Progetto</label>
              <Select
                value={form.projectId ?? task.projectId ?? ""}
                onValueChange={(v: string | null) => setForm({ ...form, projectId: v || null })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Nessuno" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nessuno</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">Scadenza</label>
              <Input
                type="date"
                className="h-8 text-xs"
                value={
                  form.dueDate
                    ? (typeof form.dueDate === "string"
                        ? form.dueDate
                        : new Date(form.dueDate).toISOString().split("T")[0])
                    : task.dueDate
                    ? new Date(task.dueDate).toISOString().split("T")[0]
                    : ""
                }
                onChange={(e) => setForm({ ...form, dueDate: e.target.value ? new Date(e.target.value) : null })}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              variant="default"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => {
                const patch: Record<string, unknown> = {};
                if (form.title !== undefined && form.title !== task.title) patch.title = form.title;
                if (form.priority !== undefined && form.priority !== task.priority) patch.priority = form.priority;
                if (form.status !== undefined && form.status !== task.status) patch.status = form.status;
                if (form.projectId !== undefined && form.projectId !== task.projectId) patch.projectId = form.projectId;
                if (form.dueDate !== undefined) {
                  const origDate = task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : null;
                  const formDate = form.dueDate instanceof Date ? form.dueDate.toISOString().split("T")[0] : null;
                  if (formDate !== origDate) patch.dueDate = form.dueDate;
                }
                if (Object.keys(patch).length > 0) {
                  onSave(task.id, patch as Partial<Task>);
                }
                onOpenChange(false);
              }}
            >
              Salva
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Annulla
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────
export default function EisenhowerPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<TaskFilters>({});
  const [activeDragTask, setActiveDragTask] = useState<Task | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  // Build query params
  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.projectId) p.set("projectId", filters.projectId);
    if (filters.priority) p.set("priority", filters.priority);
    if (filters.status) p.set("status", filters.status);
    if (filters.search) p.set("search", filters.search);
    return p.toString();
  }, [filters]);

  // Fetch tasks
  const { data: tasks, isLoading } = useQuery({
    queryKey: ["tasks", filters],
    queryFn: () =>
      fetch(`/api/tasks?${queryParams}`).then((r) => r.json()),
  });

  // Fetch projects
  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => fetch("/api/projects").then((r) => r.json()),
  });

  // Categorize tasks into quadrants
  const { q1, q2, q3, q4 } = useMemo(() => {
    const q = { q1: [] as Task[], q2: [] as Task[], q3: [] as Task[], q4: [] as Task[] };
    (tasks ?? []).forEach((t: Task) => {
      if (t.isArchived) return;
      q[getQuadrantKey(t.urgent, t.important)].push(t);
    });
    return q;
  }, [tasks]);

  // Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Update quadrant mutation
  const updateQuadrantMutation = useMutation({
    mutationFn: ({ id, urgent, important }: { id: string; urgent: boolean; important: boolean }) =>
      fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urgent, important }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task spostato");
    },
    onError: () => toast.error("Errore nello spostamento"),
  });

  // Status toggle mutation
  const statusToggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Stato aggiornato");
    },
    onError: () => toast.error("Errore nell'aggiornamento"),
  });

  // Quick edit mutation
  const quickEditMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<Task>) =>
      fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task aggiornato");
    },
    onError: () => toast.error("Errore nell'aggiornamento"),
  });

  // Drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = event.active.data.current as Task;
    if (task) setActiveDragTask(task);
  }, []);

  // Drag end — update quadrant assignment
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragTask(null);
      const { active, over } = event;
      if (!over || !active) return;

      const task = active.data.current as Task;
      const targetQuadrant = over.id as QuadrantKey;
      if (!task || !QUADRANTS[targetQuadrant]) return;

      const currentQuadrant = getQuadrantKey(task.urgent, task.important);
      if (currentQuadrant === targetQuadrant) return;

      // Determine new urgent/important values
      const q = QUADRANTS[targetQuadrant];

      updateQuadrantMutation.mutate({
        id: task.id,
        urgent: q.urgent,
        important: q.important,
      });
    },
    [updateQuadrantMutation]
  );

  // Status cycle: TODO → IN_PROGRESS → DONE → TODO
  const handleStatusToggle = useCallback(
    (task: Task) => {
      const nextStatus =
        task.status === "TODO"
          ? "IN_PROGRESS"
          : task.status === "IN_PROGRESS"
          ? "DONE"
          : "TODO";
      statusToggleMutation.mutate({ id: task.id, status: nextStatus });
    },
    [statusToggleMutation]
  );

  const handleTaskClick = useCallback((task: Task) => {
    setEditTask(task);
    setEditOpen(true);
  }, []);

  const handleQuickSave = useCallback(
    (id: string, data: Partial<Task>) => {
      quickEditMutation.mutate({ id, ...data });
    },
    [quickEditMutation]
  );

  const hasFilters = Object.values(filters).some((v) => v !== undefined && v !== "");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Eisenhower Matrix</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {(Array.isArray(tasks) ? tasks.length : 0)} task
            {hasFilters && " (filtrati)"}
          </p>
        </div>
      </div>

      {/* Filters */}
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
            setFilters({
              ...filters,
              status: (v !== null && v !== "all" ? v : undefined) as TaskFilters["status"] | undefined,
            })
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
            setFilters({
              ...filters,
              priority: (v !== null && v !== "all" ? v : undefined) as TaskFilters["priority"] | undefined,
            })
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

      {/* Matrix Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[300px] w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-2 gap-4">
            <Quadrant
              quadKey="q1"
              tasks={q1}
              onStatusToggle={handleStatusToggle}
              onTaskClick={handleTaskClick}
            />
            <Quadrant
              quadKey="q2"
              tasks={q2}
              onStatusToggle={handleStatusToggle}
              onTaskClick={handleTaskClick}
            />
            <Quadrant
              quadKey="q3"
              tasks={q3}
              onStatusToggle={handleStatusToggle}
              onTaskClick={handleTaskClick}
            />
            <Quadrant
              quadKey="q4"
              tasks={q4}
              onStatusToggle={handleStatusToggle}
              onTaskClick={handleTaskClick}
            />
          </div>

          <DragOverlay>
            {activeDragTask ? (
              <DragOverlayCard task={activeDragTask} />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Quick Edit Dialog */}
      <QuickEditDialog
        task={editTask}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={handleQuickSave}
        projects={projects ?? []}
      />
    </div>
  );
}
