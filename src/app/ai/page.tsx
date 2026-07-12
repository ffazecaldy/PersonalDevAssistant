"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Brain,
  Calendar,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Send,
  RotateCcw,
  ListTodo,
  Flag,
  Clock,
  FolderKanban,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

// ── Types ────────────────────────────────────────────

type AIMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
};

type ActionIntent =
  | "create_task"
  | "create_milestone"
  | "create_project"
  | "create_event"
  | "update_task"
  | "update_project"
  | "complete_task"
  | "unknown";

type ActionResult = {
  type: ActionIntent;
  label: string;
  status: "created" | "updated" | "completed" | "skipped" | "error";
  details: Record<string, unknown>;
  error?: string;
};

type AiExecuteResponse = {
  success?: boolean;
  error?: string;
  actions: ActionResult[];
  summary: string;
  raw_response?: string;
};

// ── Helpers ──────────────────────────────────────────

const intentLabels: Record<ActionIntent, { label: string; icon: string }> = {
  create_task: { label: "Task creato", icon: "📋" },
  create_milestone: { label: "Milestone creata", icon: "🏁" },
  create_project: { label: "Progetto creato", icon: "📁" },
  create_event: { label: "Evento creato", icon: "📅" },
  update_task: { label: "Task aggiornato", icon: "✏️" },
  update_project: { label: "Progetto aggiornato", icon: "📂" },
  complete_task: { label: "Task completato", icon: "✅" },
  unknown: { label: "Non riconosciuto", icon: "❓" },
};

function intentIcon(intent: ActionIntent) {
  switch (intent) {
    case "create_task": return <ListTodo className="h-3.5 w-3.5 text-blue-500" />;
    case "create_milestone": return <Flag className="h-3.5 w-3.5 text-orange-500" />;
    case "create_project": return <FolderKanban className="h-3.5 w-3.5 text-green-500" />;
    case "create_event": return <Calendar className="h-3.5 w-3.5 text-purple-500" />;
    case "update_task":
    case "update_project": return <span className="text-base">✏️</span>;
    case "complete_task": return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    default: return <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function intentBadgeColor(intent: ActionIntent) {
  switch (intent) {
    case "create_task": return "text-blue-500 bg-blue-500/10 border-blue-500/20";
    case "create_milestone": return "text-orange-500 bg-orange-500/10 border-orange-500/20";
    case "create_project": return "text-green-500 bg-green-500/10 border-green-500/20";
    case "create_event": return "text-purple-500 bg-purple-500/10 border-purple-500/20";
    case "update_task":
    case "update_project": return "text-amber-500 bg-amber-500/10 border-amber-500/20";
    case "complete_task": return "text-green-600 bg-green-600/10 border-green-600/20";
    default: return "text-muted-foreground bg-muted/50";
  }
}

function formatDetails(details: Record<string, unknown>): { label: string; value: string }[] {
  const items: { label: string; value: string }[] = [];
  if (details.title) items.push({ label: "Titolo", value: details.title as string });
  if (details.name) items.push({ label: "Nome", value: details.name as string });
  if (details.project) items.push({ label: "Progetto", value: details.project as string });
  if (details.start) {
    try {
      items.push({ label: "Inizio", value: formatDate(details.start as string) });
    } catch {
      items.push({ label: "Inizio", value: details.start as string });
    }
  }
  return items;
}

// ── Component ────────────────────────────────────────

export default function AiPage() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const [selectedModel, setSelectedModel] = useState("");
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: "welcome",
      role: "system",
      content: "Benvenuto nell'AI Assistant! Scrivi cosa vuoi creare o modificare in linguaggio naturale, oppure usa le azioni rapide a destra.",
      timestamp: new Date(),
    },
  ]);
  const [chatInput, setChatInput] = useState("");

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch Ollama models
  const {
    data: modelsData,
    isLoading: modelsLoading,
  } = useQuery({
    queryKey: ["ai-models"],
    queryFn: () => fetch("/api/ai/models").then((r) => r.json()),
    refetchOnWindowFocus: false,
  });

  const models = modelsData?.models || [];
  const ollamaAvailable = modelsData?.available ?? false;

  // Auto-select first model when loaded
  useEffect(() => {
    if (models.length > 0 && !selectedModel) {
      setSelectedModel(models[0].name);
    }
  }, [models, selectedModel]);

  // Fetch today's tasks and projects for quick actions
  const { data: todayTasks } = useQuery({
    queryKey: ["tasks", "today"],
    queryFn: () => fetch("/api/tasks?status=TODO&status=IN_PROGRESS").then((r) => r.json()),
    enabled: ollamaAvailable,
  });

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const { data: weekTasks } = useQuery({
    queryKey: ["tasks", "week"],
    queryFn: () => fetch("/api/tasks").then((r) => r.json()),
    enabled: ollamaAvailable,
  });

  const { data: weekProjects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => fetch("/api/projects").then((r) => r.json()),
    enabled: ollamaAvailable,
  });

  const { data: weekEvents } = useQuery({
    queryKey: ["events", "week"],
    queryFn: () =>
      fetch(`/api/events?from=${weekStart.toISOString()}&to=${weekEnd.toISOString()}`).then((r) =>
        r.json()
      ),
    enabled: ollamaAvailable,
  });

  // ── Execute mutation ───────────────────────────────────

  const executeMutation = useMutation({
    mutationFn: (content: string) =>
      fetch("/api/ai/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: content, model: selectedModel }),
      }).then((r) => r.json()),
    onSuccess: (data: AiExecuteResponse) => {
      if (data.error) {
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "system",
            content: `❌ ${data.error}`,
            timestamp: new Date(),
          },
        ]);
        toast.error(data.error);
        return;
      }

      // Build a rich assistant message with formatted actions
      const actionBlocks = data.actions
        .map((a) => formatActionBlock(a))
        .join("\n\n");

      const assistantContent = [
        data.summary ? `**${data.summary}**` : "",
        actionBlocks ? `\n\n${actionBlocks}` : "",
        data.raw_response && data.actions.some((a) => a.status === "error")
          ? `\n\n<details><summary>Risposta tecnica</summary>\n\`\`\`\n${data.raw_response}\n\`\`\`\n</details>`
          : "",
      ]
        .filter(Boolean)
        .join("");

      setMessages((prev) => [
        ...prev,
        {
          id: `execute-${Date.now()}`,
          role: "assistant",
          content: assistantContent,
          timestamp: new Date(),
        },
      ]);

      const errorCount = data.actions.filter((a) => a.status === "error").length;
      if (errorCount > 0) {
        toast.error(`${errorCount} azion${errorCount > 1 ? "i" : "e"} con error${errorCount > 1 ? "i" : "e"}`);
      } else if (data.actions.length > 0) {
        toast.success(data.summary);
      }
    },
    onError: () => {
      toast.error("Errore di connessione al server");
    },
  });

  // ── Prioritize mutation ────────────────────────────────

  const prioritizeMutation = useMutation({
    mutationFn: () =>
      fetch("/api/ai/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "Prioritizza i miei task di oggi, dammi un ordine di priorità e suggerimenti su cosa fare prima.",
          model: selectedModel,
          tasks: Array.isArray(todayTasks) ? todayTasks : [],
        }),
      }).then((r) => r.json()),
    onSuccess: (data: AiExecuteResponse) => {
      if (data.error) {
        toast.error(data.error);
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `prioritize-${Date.now()}`,
          role: "assistant",
          content: `## 📋 Prioritizzazione Giornata\n\n${data.summary}\n\n${data.actions.map((a) => formatActionBlock(a)).join("\n\n")}`,
          timestamp: new Date(),
        },
      ]);
      toast.success("Giornata prioritizzata!");
    },
    onError: () => toast.error("Errore durante la prioritizzazione"),
  });

  // ── Summary mutation ───────────────────────────────────

  const summaryMutation = useMutation({
    mutationFn: () =>
      fetch("/api/ai/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          tasks: Array.isArray(weekTasks) ? weekTasks : [],
          projects: Array.isArray(weekProjects) ? weekProjects : [],
          events: Array.isArray(weekEvents) ? weekEvents : [],
        }),
      }).then((r) => r.json()),
    onSuccess: (data) => {
      if (data.error) {
        toast.error(data.error);
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `summary-${Date.now()}`,
          role: "assistant",
          content: `## 📊 Riassunto Settimanale\n\n${data.response}`,
          timestamp: new Date(),
        },
      ]);
      toast.success("Riassunto generato!");
    },
    onError: () => toast.error("Errore durante la generazione del riassunto"),
  });

  // ── Handlers ──────────────────────────────────────────

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    const userMsg: AIMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: chatInput,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    executeMutation.mutate(chatInput);
    setChatInput("");
  };

  // ── Render ────────────────────────────────────────────

  const isProcessing = executeMutation.isPending;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Assistant</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Parla in linguaggio naturale per creare e gestire task, progetti, eventi
          </p>
        </div>
        <div className="flex items-center gap-3">
          {modelsLoading ? (
            <Skeleton className="h-8 w-48" />
          ) : (
            <Select value={selectedModel} onValueChange={(v: string | null) => v && setSelectedModel(v)}>
              <SelectTrigger className="w-56" size="sm">
                <Brain className="h-3.5 w-3.5 mr-1" />
                <SelectValue placeholder="Seleziona modello" />
              </SelectTrigger>
              <SelectContent>
                {models.length === 0 && (
                  <SelectItem value="" disabled>
                    Nessun modello disponibile
                  </SelectItem>
                )}
                {models.map((m: { name: string }) => (
                  <SelectItem key={m.name} value={m.name}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Badge
            variant="outline"
            className={
              ollamaAvailable
                ? "text-green-500 bg-green-500/10 border-green-500/20"
                : "text-red-500 bg-red-500/10 border-red-500/20"
            }
          >
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${
                ollamaAvailable ? "bg-green-500" : "bg-red-500"
              }`}
            />
            {ollamaAvailable ? "Ollama attivo" : "Offline"}
          </Badge>
        </div>
      </div>

      {/* Ollama offline banner */}
      {!ollamaAvailable && !modelsLoading && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-500">Ollama non raggiungibile</p>
            <p className="text-xs text-muted-foreground mt-1">
              Assicurati che Ollama sia in esecuzione su{" "}
              <code className="text-[10px] bg-muted px-1 py-0.5 rounded">http://localhost:11434</code>.
              Le funzionalità AI sono disabilitate fino al ripristino della connessione.
            </p>
          </div>
        </div>
      )}

      {/* Main two-panel layout */}
      <div className="flex gap-4">
        {/* ── LEFT PANEL: Chat ─────────────────────────── */}
        <div className="flex-1 min-w-0">
          <Card className="h-[calc(100vh-16rem)] flex flex-col">
            <CardHeader className="pb-3 shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Conversazione</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() =>
                    setMessages([
                      {
                        id: "welcome",
                        role: "system",
                        content: "Benvenuto nell'AI Assistant! Scrivi cosa vuoi creare o modificare in linguaggio naturale, oppure usa le azioni rapide a destra.",
                        timestamp: new Date(),
                      },
                    ])
                  }
                  disabled={messages.length <= 1}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Cancella
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0 px-6">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-3 py-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${
                        msg.role === "user"
                          ? "justify-end"
                          : msg.role === "system"
                            ? "justify-center"
                            : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[90%] rounded-lg px-3.5 py-2.5 ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : msg.role === "system"
                              ? "bg-muted/50 text-muted-foreground text-center text-xs italic"
                              : "bg-muted text-foreground"
                        }`}
                      >
                        {msg.role !== "system" ? (
                          <div className="text-sm leading-relaxed whitespace-pre-wrap">
                            <FormattedContent content={msg.content} />
                          </div>
                        ) : (
                          <p>{msg.content}</p>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Loading indicator */}
                  {isProcessing && (
                    <div className="flex justify-start">
                      <div className="max-w-[85%] rounded-lg px-4 py-3 bg-muted">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          {selectedModel ? `${selectedModel} sta elaborando...` : "Elaborazione..."}
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
            </CardContent>
            <CardFooter className="border-t shrink-0 px-6 py-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendChat();
                }}
                className="flex w-full gap-2"
              >
                <div className="relative flex-1">
                  <Input
                    ref={chatInputRef}
                    placeholder="Crea un task per il progetto Sito Web con scadenza venerdì..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={!ollamaAvailable || isProcessing}
                    className="w-full pr-10"
                  />
                </div>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!ollamaAvailable || !chatInput.trim() || isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </CardFooter>
          </Card>
        </div>

        {/* ── RIGHT PANEL: Quick actions ──────────────── */}
        <div className="w-64 shrink-0 space-y-3">
          {/* Prioritize */}
          <Card size="sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-500" />
                <CardTitle className="text-sm">Prioritizza giornata</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pb-2">
              <p className="text-xs text-muted-foreground">
                {Array.isArray(todayTasks) ? todayTasks.length : 0} task da processare
              </p>
            </CardContent>
            <CardFooter className="pt-0">
              <Button
                size="sm"
                className="w-full h-7 text-xs"
                disabled={!ollamaAvailable || prioritizeMutation.isPending}
                onClick={() => prioritizeMutation.mutate()}
              >
                {prioritizeMutation.isPending ? (
                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                ) : (
                  <Brain className="h-3 w-3 mr-1.5" />
                )}
                {prioritizeMutation.isPending ? "Analisi..." : "Prioritizza"}
              </Button>
            </CardFooter>
          </Card>

          {/* Weekly Summary */}
          <Card size="sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-green-500" />
                <CardTitle className="text-sm">Riassunto settimanale</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pb-2">
              <p className="text-xs text-muted-foreground">
                {new Date().toLocaleDateString("it-IT", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </CardContent>
            <CardFooter className="pt-0">
              <Button
                size="sm"
                className="w-full h-7 text-xs"
                disabled={!ollamaAvailable || summaryMutation.isPending}
                onClick={() => summaryMutation.mutate()}
              >
                {summaryMutation.isPending ? (
                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                ) : (
                  <Calendar className="h-3 w-3 mr-1.5" />
                )}
                {summaryMutation.isPending ? "Generazione..." : "Genera"}
              </Button>
            </CardFooter>
          </Card>

          {/* Quick NLP input */}
          <Card size="sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-purple-500" />
                <CardTitle className="text-sm">Creazione rapida</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pb-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = (e.target as HTMLFormElement).querySelector("input")?.value;
                  if (input?.trim()) {
                    const userMsg: AIMessage = {
                      id: `user-${Date.now()}`,
                      role: "user",
                      content: input,
                      timestamp: new Date(),
                    };
                    setMessages((prev) => [...prev, userMsg]);
                    executeMutation.mutate(input);
                    (e.target as HTMLFormElement).querySelector("input")!.value = "";
                  }
                }}
              >
                <Input
                  placeholder='es. "riunione domani alle 15"'
                  disabled={!ollamaAvailable || isProcessing}
                  className="text-xs h-8"
                />
              </form>
            </CardContent>
          </Card>

          {/* Quick action suggestions */}
          <Card size="sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Suggerimenti</CardTitle>
            </CardHeader>
            <CardContent className="pb-0 space-y-1">
              {[
                "Crea un task 'Revisare documentazione' per il progetto Sito Web con scadenza venerdì",
                "Aggiungi una milestone 'Completamento design' al progetto principale",
                "Segna come completato il task più urgente di oggi",
                "Programma una riunione di team domani alle 10 per 1 ora",
              ].map((suggestion, i) => (
                <button
                  key={i}
                  type="button"
                  className="w-full text-left text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded hover:bg-muted/50 line-clamp-2"
                  onClick={() => {
                    const userMsg: AIMessage = {
                      id: `user-${Date.now()}`,
                      role: "user",
                      content: suggestion,
                      timestamp: new Date(),
                    };
                    setMessages((prev) => [...prev, userMsg]);
                    executeMutation.mutate(suggestion);
                  }}
                  disabled={!ollamaAvailable || isProcessing}
                >
                  💡 {suggestion}
                </button>
              ))}
            </CardContent>
            <CardFooter className="pt-2" />
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Formatted Content ────────────────────────────────────

function FormattedContent({ content }: { content: string }) {
  // Split on action blocks (lines starting with ✅, ❌, etc.)
  const sections = content.split(/\n\n+/);

  return (
    <>
      {sections.map((section, i) => {
        // Check if section contains action blocks
        if (section.includes("✅") || section.includes("❌") || section.includes("📋") || section.includes("📁")) {
          return <ActionBlockSection key={i} text={section} />;
        }
        // Check if it's a marked-up section with ** **
        if (section.includes("**") || section.startsWith("##") || section.startsWith("#")) {
          return <MarkdownSection key={i} text={section} />;
        }
        return (
          <p key={i} className="text-sm leading-relaxed mb-1">
            {section}
          </p>
        );
      })}
    </>
  );
}

function MarkdownSection({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1 my-1">
      {lines.map((line, j) => {
        if (!line.trim()) return <br key={j} />;

        if (line.startsWith("### ")) {
          return (
            <p key={j} className="text-sm font-semibold mt-2">
              {line.replace("### ", "")}
            </p>
          );
        }
        if (line.startsWith("## ")) {
          return (
            <p key={j} className="text-sm font-semibold mt-2">
              {line.replace("## ", "")}
            </p>
          );
        }
        if (line.startsWith("# ")) {
          return (
            <p key={j} className="text-base font-semibold mt-2">
              {line.replace("# ", "")}
            </p>
          );
        }

        // Bold segments within line
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={j} className="text-sm leading-relaxed">
            {parts.map((part, k) => {
              if (part.startsWith("**") && part.endsWith("**")) {
                return <strong key={k}>{part.slice(2, -2)}</strong>;
              }
              return part;
            })}
          </p>
        );
      })}
    </div>
  );
}

function ActionBlockSection({ text }: { text: string }) {
  const lines = text.split("\n").filter(Boolean);
  return (
    <div className="space-y-2 my-2">
      {lines.map((line, i) => {
        // Detect structured action lines
        if (line.includes("✅") || line.includes("❌")) {
          const isSuccess = line.includes("✅");
          const content = line.replace(/^[✅❌]\s*/, "").trim();
          return (
            <div
              key={i}
              className={`flex items-start gap-2 rounded-md border p-2.5 ${
                isSuccess
                  ? "border-green-500/20 bg-green-500/5"
                  : "border-red-500/20 bg-red-500/5"
              }`}
            >
              {isSuccess ? (
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              )}
              <div className="text-sm">{content}</div>
            </div>
          );
        }

        // Project or scadenza line
        if (line.startsWith("📁") || line.startsWith("⏰") || line.startsWith("📋")) {
          const content = line.replace(/^[^\s]+\s*/, "").trim();
          const [label, ...rest] = content.split(":");
          return (
            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground pl-1">
              <span className="text-foreground font-medium">{label}:</span>
              <span>{rest.join(":").trim()}</span>
            </div>
          );
        }

        // Default: plain line
        return (
          <p key={i} className="text-sm">{line}</p>
        );
      })}
    </div>
  );
}

// ── Format a single action result into display text ─────

function formatActionBlock(action: ActionResult): string {
  const icon = action.status === "created" || action.status === "completed"
    ? "✅"
    : action.status === "error"
      ? "❌"
      : "ℹ️";
  const intentInfo = intentLabels[action.type] || intentLabels.unknown;

  // Build details lines
  const detailLines: string[] = [];
  if (action.details.project) {
    detailLines.push(`📁 Progetto: ${action.details.project}`);
  }
  if (action.details.dueDate) {
    try {
      detailLines.push(`⏰ Scadenza: ${formatDate(action.details.dueDate as string)}`);
    } catch {
      detailLines.push(`⏰ Scadenza: ${action.details.dueDate}`);
    }
  }
  if (action.details.start) {
    try {
      detailLines.push(`📅 Inizio: ${formatDate(action.details.start as string)}`);
    } catch {
      detailLines.push(`📅 Inizio: ${action.details.start}`);
    }
  }

  const errorLine = action.error ? `❌ Errore: ${action.error}` : "";

  return [
    `${icon} ${intentInfo.label}: "${action.label}"`,
    ...detailLines,
    errorLine,
  ]
    .filter(Boolean)
    .join("\n");
}
