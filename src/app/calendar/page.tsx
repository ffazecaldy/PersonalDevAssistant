"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, DateSelectArg, DatesSetArg } from "@fullcalendar/core";
import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2,
  Calendar as CalendarIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { CalendarEvent, CalendarEventFormData, Task, Project } from "@/types";

/* ─── Helpers ─── */

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function loadColor(mins: number): string {
  const hours = mins / 60;
  if (hours < 6) return "text-green-500 bg-green-500/10 border-green-500/20";
  if (hours <= 8) return "text-yellow-500 bg-yellow-500/10 border-yellow-500/20";
  return "text-red-500 bg-red-500/10 border-red-500/20";
}

function loadBarColor(mins: number): string {
  const hours = mins / 60;
  if (hours < 6) return "bg-green-500";
  if (hours <= 8) return "bg-yellow-500";
  return "bg-red-500";
}

function toLocalDatetimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/* ─── Page ─── */

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const calendarRef = useRef<FullCalendar>(null);

  /* ── Inject FullCalendar CSS ── */
  useEffect(() => {
    const links = [
      "https://cdn.jsdelivr.net/npm/@fullcalendar/core@6.1.21/main.min.css",
      "https://cdn.jsdelivr.net/npm/@fullcalendar/daygrid@6.1.21/main.min.css",
      "https://cdn.jsdelivr.net/npm/@fullcalendar/timegrid@6.1.21/main.min.css",
    ];
    for (const href of links) {
      if (!document.querySelector(`link[href="${href}"]`)) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        document.head.appendChild(link);
      }
    }
  }, []);

  /* ── Dialog state ── */
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<"event" | "task" | null>(null);
  const [form, setForm] = useState<CalendarEventFormData>({
    title: "",
    start: "",
    end: "",
    allDay: false,
    type: "EVENT",
    notes: "",
  });

  /* ── Calendar date range tracking ── */
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(0).toISOString(),
    end: new Date(0).toISOString(),
  });

  /* ── Projects for the project selector ── */
  const { data: projects } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: () => fetch("/api/projects").then((r) => r.json()),
  });

  /* ── Fetch CalendarEvents ── */
  const {
    data: eventsData,
    isLoading: eventsLoading,
  } = useQuery<CalendarEvent[]>({
    queryKey: ["calendar-events", dateRange],
    queryFn: () =>
      fetch(`/api/events?from=${encodeURIComponent(dateRange.start)}&to=${encodeURIComponent(dateRange.end)}`).then(
        (r) => r.json()
      ),
    enabled: !!dateRange.start,
  });

  /* ── Fetch Tasks (for scheduled blocks + weekly load) ── */
  const { data: tasksData, isLoading: tasksLoading } = useQuery<(Task & { project?: { name: string; color: string } })[]>({
    queryKey: ["tasks"],
    queryFn: () => fetch("/api/tasks").then((r) => r.json()),
  });

  /* ── Merge into FullCalendar event objects ── */
  const calendarEvents = useMemo(() => {
    const items: Record<string, unknown>[] = [];

    if (eventsData) {
      for (const ev of eventsData) {
        items.push({
          id: `event-${ev.id}`,
          title: ev.title,
          start: ev.start,
          end: ev.end,
          allDay: ev.allDay,
          backgroundColor:
            ev.type === "TASK_BLOCK"
              ? "var(--color-chart-3, #f59e0b)"
              : "var(--color-primary, #3b82f6)",
          textColor: "var(--primary-foreground, #fff)",
          borderColor: "transparent",
          classNames: ["cal-item"],
          extendedProps: {
            source: "event" as const,
            originalId: ev.id,
            type: ev.type,
            notes: ev.notes,
            linkedProjectId: ev.linkedProjectId,
          },
        });
      }
    }

    if (tasksData) {
      for (const t of tasksData) {
        if (!t.scheduledStart || !t.scheduledEnd) continue;
        const isDone = t.status === "DONE";
        items.push({
          id: `task-${t.id}`,
          title: t.title,
          start: t.scheduledStart,
          end: t.scheduledEnd,
          allDay: false,
          backgroundColor: isDone
            ? "var(--color-chart-1, #22c55e)"
            : "var(--color-chart-2, #a855f7)",
          textColor: "var(--primary-foreground, #fff)",
          borderColor: "transparent",
          classNames: ["cal-item", `task-${t.status?.toLowerCase()}`],
          extendedProps: {
            source: "task" as const,
            originalId: t.id,
            status: t.status,
            priority: t.priority,
            estimatedMinutes: t.estimatedMinutes,
            project: t.project,
          },
        });
      }
    }

    return items;
  }, [eventsData, tasksData]);

  /* ── Mutations ── */
  const createMutation = useMutation({
    mutationFn: (data: CalendarEventFormData) =>
      fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      setDialogOpen(false);
      resetForm();
      toast.success("Evento creato");
    },
    onError: () => toast.error("Errore nella creazione"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CalendarEventFormData }) =>
      fetch(`/api/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      setDialogOpen(false);
      resetForm();
      toast.success("Evento aggiornato");
    },
    onError: () => toast.error("Errore nell'aggiornamento"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/events/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      setDialogOpen(false);
      resetForm();
      toast.success("Evento eliminato");
    },
    onError: () => toast.error("Errore nell'eliminazione"),
  });

  /* ── Handlers ── */
  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    setDateRange({
      start: arg.start.toISOString(),
      end: arg.end.toISOString(),
    });
  }, []);

  const handleDateSelect = useCallback((arg: DateSelectArg) => {
    setDialogMode("create");
    setSelectedEventId(null);
    setSelectedSource(null);
    setForm({
      title: "",
      start: toLocalDatetimeString(arg.start),
      end: toLocalDatetimeString(arg.end),
      allDay: arg.allDay,
      type: "EVENT",
      linkedProjectId: undefined,
      notes: "",
    });
    setDialogOpen(true);
  }, []);

  const handleEventClick = useCallback(
    (arg: EventClickArg) => {
      const ep = arg.event.extendedProps;
      const source = ep.source as "event" | "task";
      const originalId = ep.originalId as string;

      if (source === "task") {
        // Show task info dialog or just toast that it's read-only
        toast.info(
          `Task: ${arg.event.title}${
            ep.estimatedMinutes ? ` (${formatMinutes(ep.estimatedMinutes)})` : ""
          }`
        );
        return;
      }

      setSelectedSource(source);
      setSelectedEventId(originalId);
      setDialogMode("edit");
      setForm({
        title: arg.event.title,
        start: toLocalDatetimeString(arg.event.start!),
        end: toLocalDatetimeString(arg.event.end!),
        allDay: arg.event.allDay,
        type: (ep.type as "EVENT" | "TASK_BLOCK") || "EVENT",
        linkedProjectId: (ep.linkedProjectId as string) || undefined,
        notes: (ep.notes as string) || "",
      });
      setDialogOpen(true);
    },
    []
  );

  const resetForm = () => {
    setForm({
      title: "",
      start: "",
      end: "",
      allDay: false,
      type: "EVENT",
      notes: "",
    });
    setSelectedEventId(null);
    setSelectedSource(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    if (dialogMode === "create") {
      createMutation.mutate(form);
    } else if (dialogMode === "edit" && selectedEventId) {
      updateMutation.mutate({ id: selectedEventId, data: form });
    }
  };

  const handleDelete = () => {
    if (selectedEventId) {
      deleteMutation.mutate(selectedEventId);
    }
  };

  const isMutating = createMutation.isPending || updateMutation.isPending;

  /* ── Weekly load calculation ── */
  const weeklyLoad = useMemo(() => {
    if (!tasksData || !dateRange.start) return [];

    const start = startOfWeek(parseISO(dateRange.start), { weekStartsOn: 1 });
    const end = endOfWeek(parseISO(dateRange.start), { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });

    return days.map((day) => {
      const dayTasks = tasksData.filter((t) => {
        if (!t.scheduledStart || !t.estimatedMinutes) return false;
        return isSameDay(parseISO(t.scheduledStart as unknown as string), day);
      });
      const totalMinutes = dayTasks.reduce(
        (sum, t) => sum + (t.estimatedMinutes || 0),
        0
      );
      return {
        date: day,
        label: format(day, "EEE", { locale: undefined }),
        dayNum: format(day, "d"),
        totalMinutes,
        tasks: dayTasks,
        isToday: isSameDay(day, new Date()),
      };
    });
  }, [tasksData, dateRange]);

  const isLoading = eventsLoading || tasksLoading;

  /* ── Render calendar event content ── */
  const renderEventContent = useCallback(
    (eventInfo: {
      event: {
        title: string;
        start: Date | null;
        end: Date | null;
        allDay: boolean;
        extendedProps: Record<string, unknown>;
      };
      timeText: string;
    }) => {
      const ep = eventInfo.event.extendedProps;
      const isTask = ep.source === "task";
      const isDone = ep.status === "DONE";
      return (
        <div
          className={cn(
            "fc-inner flex items-center gap-1 px-1 py-0.5 text-xs leading-tight truncate",
            isDone && "line-through opacity-70"
          )}
        >
          {!eventInfo.event.allDay && eventInfo.timeText && (
            <span className="shrink-0 opacity-80">{eventInfo.timeText}</span>
          )}
          <span className="truncate">{eventInfo.event.title}</span>
        </div>
      );
    },
    []
  );

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendario</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Eventi e task pianificati
          </p>
        </div>
      </div>

      {/* ── Calendar ── */}
      <div className="calendar-container">
        {isLoading && calendarEvents.length === 0 ? (
          <Skeleton className="h-[600px] w-full rounded-xl" />
        ) : (
          <div className="border rounded-xl overflow-hidden bg-card">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,timeGridWeek,timeGridDay",
              }}
              initialView="timeGridWeek"
              locale="it"
              firstDay={1}
              weekends={true}
              selectable={true}
              selectMirror={true}
              dayMaxEvents={3}
              height="auto"
              events={calendarEvents}
              datesSet={handleDatesSet}
              select={handleDateSelect}
              eventClick={handleEventClick}
              eventContent={renderEventContent}
              slotMinTime="06:00:00"
              slotMaxTime="22:00:00"
              allDaySlot={true}
              nowIndicator={true}
              buttonText={{
                today: "Oggi",
                month: "Mese",
                week: "Settimana",
                day: "Giorno",
              }}
              noEventsText="Nessun evento in questo periodo"
              moreLinkText={(num) => `+${num} altri`}
              editable={false}
              droppable={false}
            />
          </div>
        )}
      </div>

      {/* ── Carico Settimanale ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Carico settimanale
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {weeklyLoad.map((day) => (
              <div
                key={day.date.toISOString()}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-colors",
                  day.isToday && "border-primary ring-1 ring-primary/30",
                  day.totalMinutes === 0 && "opacity-50"
                )}
              >
                <span className="text-[10px] uppercase text-muted-foreground font-medium">
                  {day.label}
                </span>
                <span
                  className={cn(
                    "text-lg font-semibold",
                    day.isToday && "text-primary"
                  )}
                >
                  {day.dayNum}
                </span>
                {day.totalMinutes > 0 ? (
                  <>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-mono border-none mt-1",
                        loadColor(day.totalMinutes)
                      )}
                    >
                      {formatMinutes(day.totalMinutes)}
                    </Badge>
                    {/* Mini progress bar */}
                    <div className="w-full h-1 rounded-full bg-muted mt-1 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          loadBarColor(day.totalMinutes)
                        )}
                        style={{
                          width: `${Math.min((day.totalMinutes / (8 * 60)) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <span className="text-[10px] text-muted-foreground mt-1">
                    —
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500" />{" "}
              &lt; 6h
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-yellow-500" />{" "}
              6-8h
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500" />{" "}
              &gt; 8h
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "create" ? "Nuovo evento" : "Modifica evento"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <Input
              placeholder="Titolo evento"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              autoFocus
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Inizio
                </label>
                <Input
                  type={form.allDay ? "date" : "datetime-local"}
                  value={
                    form.allDay && form.start
                      ? form.start.slice(0, 10)
                      : form.start
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      start: form.allDay
                        ? e.target.value + "T00:00:00"
                        : e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Fine
                </label>
                <Input
                  type={form.allDay ? "date" : "datetime-local"}
                  value={
                    form.allDay && form.end
                      ? form.end.slice(0, 10)
                      : form.end
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      end: form.allDay
                        ? e.target.value + "T23:59:00"
                        : e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Select
                value={form.type || "EVENT"}
                onValueChange={(v: string | null) =>
                  setForm({ ...form, type: (v as "EVENT" | "TASK_BLOCK") || "EVENT" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EVENT">Evento</SelectItem>
                  <SelectItem value="TASK_BLOCK">Task Block</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={form.linkedProjectId || ""}
                onValueChange={(v: string | null) =>
                  setForm({ ...form, linkedProjectId: v || undefined })
                }
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

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="allDay"
                className="rounded border-input"
                checked={form.allDay || false}
                onChange={(e) => setForm({ ...form, allDay: e.target.checked })}
              />
              <label htmlFor="allDay" className="text-sm text-muted-foreground">
                Giornata intera
              </label>
            </div>

            <Textarea
              placeholder="Note (opzionale)"
              value={form.notes || ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
            />

            <div className="flex items-center justify-between gap-3 pt-2 border-t">
              <div>
                {dialogMode === "edit" && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Elimina
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDialogOpen(false)}
                >
                  Annulla
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!form.title.trim() || isMutating}
                >
                  {isMutating && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  )}
                  {dialogMode === "create" ? "Crea" : "Salva"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── FullCalendar Dark Theme Overrides ── */}
      <style jsx global>{`
        .calendar-container {
          --fc-border-color: var(--border);
          --fc-button-text-color: var(--foreground);
          --fc-button-bg-color: var(--secondary);
          --fc-button-border-color: var(--border);
          --fc-button-hover-bg-color: var(--accent);
          --fc-button-hover-border-color: var(--border);
          --fc-button-active-bg-color: var(--accent);
          --fc-button-active-border-color: var(--border);
          --fc-today-bg-color: var(--accent);
          --fc-neutral-bg-color: var(--card);
          --fc-page-bg-color: var(--card);
          --fc-neutral-text-color: var(--foreground);
          --fc-event-bg-color: var(--primary);
          --fc-event-border-color: transparent;
          --fc-event-text-color: var(--primary-foreground);
          --fc-list-event-hover-bg-color: var(--muted);
          --fc-now-indicator-color: var(--destructive);
          --fc-highlight-color: var(--accent);
          --fc-more-link-bg-color: var(--muted);
          --fc-more-link-text-color: var(--foreground);
        }

        .calendar-container .fc {
          font-size: 0.8125rem;
        }

        .calendar-container .fc-toolbar-title {
          font-size: 1rem;
          font-weight: 600;
        }

        .calendar-container .fc-button {
          font-size: 0.75rem;
          font-weight: 500;
          border-radius: var(--radius-md, 0.375rem);
          padding: 0.25rem 0.625rem;
          height: 2rem;
          text-transform: capitalize;
        }

        .calendar-container .fc-button-primary:not(:disabled).fc-button-active,
        .calendar-container .fc-button-primary:not(:disabled):active {
          background-color: var(--primary);
          color: var(--primary-foreground);
          border-color: var(--primary);
        }

        .calendar-container .fc-col-header-cell {
          padding: 0.375rem 0;
        }

        .calendar-container .fc-col-header-cell-cushion {
          font-weight: 500;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--muted-foreground);
        }

        .calendar-container .fc-daygrid-day-number {
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--foreground);
          padding: 0.25rem 0.375rem;
        }

        .calendar-container .fc-timegrid-slot {
          height: 1.75rem;
        }

        .calendar-container .fc-timegrid-slot-label {
          font-size: 0.6875rem;
          color: var(--muted-foreground);
          vertical-align: middle;
        }

        .calendar-container .fc-timegrid-axis {
          font-size: 0.6875rem;
          color: var(--muted-foreground);
        }

        .calendar-container .fc-event {
          border-radius: var(--radius-sm, 0.25rem);
          border: none;
          font-size: 0.75rem;
          margin: 0 1px;
          cursor: pointer;
          transition: opacity 0.15s;
        }

        .calendar-container .fc-event:hover {
          opacity: 0.85;
        }

        .calendar-container .fc-daygrid-event {
          border-radius: var(--radius-sm, 0.25rem);
          padding: 0;
        }

        .calendar-container .fc-daygrid-more-link {
          font-size: 0.6875rem;
          border-radius: var(--radius-sm, 0.25rem);
        }

        .calendar-container .fc-day-today {
          background: transparent !important;
        }

        .calendar-container .fc-timegrid-col.fc-day-today {
          background-color: var(--accent) !important;
        }

        .calendar-container .fc-scrollgrid {
          border-color: var(--border);
          border-radius: inherit;
        }

        .calendar-container .fc-scrollgrid-section > td {
          border-color: var(--border);
        }

        .calendar-container .fc-scrollgrid-section-header > th {
          border-color: var(--border);
        }

        .calendar-container .fc-timegrid-divider {
          border-color: var(--border);
        }

        .calendar-container .fc-popover {
          background-color: var(--popover);
          border-color: var(--border);
          border-radius: var(--radius-md, 0.5rem);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .calendar-container .fc-popover-header {
          background-color: var(--popover);
          color: var(--popover-foreground);
          border-bottom: 1px solid var(--border);
          padding: 0.5rem 0.75rem;
          font-size: 0.8125rem;
          font-weight: 600;
        }

        .calendar-container .fc-popover-body {
          padding: 0.25rem;
        }

        .calendar-container .fc-more-popover .fc-daygrid-event {
          margin: 0.125rem 0.25rem;
        }

        .calendar-container .fc-now-indicator {
          z-index: 5;
        }

        .calendar-container .fc-now-indicator-line {
          border-color: var(--destructive);
          border-width: 1.5px;
        }

        .calendar-container .fc-now-indicator-arrow {
          border-color: var(--destructive);
          fill: var(--destructive);
        }

        .calendar-container .fc-non-business {
          background-color: var(--muted);
          opacity: 0.3;
        }

        .calendar-container .fc-list-day-cushion {
          background-color: var(--muted);
        }

        .calendar-container .fc-list-day-text,
        .calendar-container .fc-list-day-side-text {
          color: var(--foreground);
          font-weight: 600;
        }

        .calendar-container .fc-list-table td {
          border-color: var(--border);
        }

        .calendar-container .fc-list-event:hover td {
          background-color: var(--muted);
        }
      `}</style>
    </div>
  );
}
