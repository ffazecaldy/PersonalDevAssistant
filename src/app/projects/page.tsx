"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Plus, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Project, ProjectFormData } from "@/types";
import { formatDate, getProjectStatusColor } from "@/lib/utils";
import Link from "next/link";

export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProjectFormData>({
    name: "",
    description: "",
    status: "ACTIVE" as const,
    color: "",
    deadline: "",
  });

  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => fetch("/api/projects").then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: ProjectFormData) =>
      fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setOpen(false);
      setForm({ name: "", description: "", status: "ACTIVE", color: "" });
      toast.success("Progetto creato");
    },
    onError: () => toast.error("Errore nella creazione"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    createMutation.mutate(form);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Progetti</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {Array.isArray(projects) ? projects.length : 0} progetti totali
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="h-4 w-4 mr-2" />
            Nuovo Progetto
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuovo Progetto</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Input
                  placeholder="Nome progetto"
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  autoFocus
                />
              </div>
              <div>
                <Textarea
                  placeholder="Descrizione (opzionale)"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Select
                    value={form.color || ""}
                    onValueChange={(v) => setForm({ ...form, color: v ?? "" })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Colore" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blue">Blu</SelectItem>
                      <SelectItem value="green">Verde</SelectItem>
                      <SelectItem value="purple">Viola</SelectItem>
                      <SelectItem value="orange">Arancione</SelectItem>
                      <SelectItem value="red">Rosso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Input
                    type="date"
                    placeholder="Scadenza"
                    onChange={(e) =>
                      setForm({ ...form, deadline: e.target.value })
                    }
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={!form.name.trim()}>
                Crea Progetto
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(projects || []).map((project: Project & { _count?: { tasks: number; milestones: number } }) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="hover:bg-muted/30 transition-colors cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {project.color && (
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: project.color }}
                        />
                      )}
                      <CardTitle className="text-sm font-medium leading-tight">
                        {project.name}
                      </CardTitle>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-mono ${getProjectStatusColor(project.status)}`}
                    >
                      {project.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {project.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                      {project.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                    <span>{project._count?.tasks ?? 0} task</span>
                    {project.deadline && (
                      <span>Scad. {formatDate(project.deadline)}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
