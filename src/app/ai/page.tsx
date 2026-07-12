"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Brain,
  Calendar,
  MessageSquarePlus,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Send,
  RotateCcw,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

type AIMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
};

type ParsedNLP = {
  title: string;
  date: string | null;
  time: string | null;
  project: string | null;
  type: "event" | "task";
  confidence: number;
};

export default function AiPage() {
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedModel, setSelectedModel] = useState("");
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: "welcome",
      role: "system",
      content: "Benvenuto nell'AI Assistant! Seleziona una funzionalità qui sotto o scrivi un messaggio per chattare con l'assistente.",
      timestamp: new Date(),
    },
  ]);

  // NLP state
  const [nlpInput, setNlpInput] = useState("");
  const [parsedResult, setParsedResult] = useState<ParsedNLP | null>(null);

  // Chat input state
  const [chatInput, setChatInput] = useState("");

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch Ollama models
  const {
    data: modelsData,
    isLoading: modelsLoading,
    isError: modelsError,
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

  // Fetch today's tasks
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

  const { data: todayTasks } = useQuery({
    queryKey: ["tasks", "today"],
    queryFn: () =>
      fetch(`/api/tasks?status=TODO&status=IN_PROGRESS`).then((r) => r.json()),
    enabled: ollamaAvailable,
  });

  // Fetch week data for summary
  const weekStart = new Date(today);
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

  // Chat mutation
  const chatMutation = useMutation({
    mutationFn: (params: { content: string }) =>
      fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            ...messages
              .filter((m) => m.role !== "system")
              .slice(-10)
              .map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: params.content },
          ],
          system:
            "Sei un assistente AI integrato in un Command Center per la produttività personale. Rispondi in italiano in modo chiaro e conciso.",
        }),
      }).then((r) => r.json()),
    onSuccess: (data) => {
      if (data.error) {
        toast.error(data.error);
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "system",
            content: `❌ ${data.error}`,
            timestamp: new Date(),
          },
        ]);
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: data.message?.content || "Nessuna risposta.",
          timestamp: new Date(),
        },
      ]);
    },
    onError: () => {
      toast.error("Ollama non raggiungibile");
    },
  });

  // Prioritize mutation
  const prioritizeMutation = useMutation({
    mutationFn: () =>
      fetch("/api/ai/prioritize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          tasks: Array.isArray(todayTasks) ? todayTasks : [],
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
          id: `prioritize-${Date.now()}`,
          role: "assistant",
          content: `## 📋 Prioritizzazione Giornata\n\n${data.response}`,
          timestamp: new Date(),
        },
      ]);
      toast.success("Giornata prioritizzata!");
    },
    onError: () => toast.error("Errore durante la prioritizzazione"),
  });

  // Summary mutation
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

  // NLP mutation
  const nlpMutation = useMutation({
    mutationFn: (text: string) =>
      fetch("/api/ai/nlp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: selectedModel, text }),
      }).then((r) => r.json()),
    onSuccess: (data) => {
      if (data.error) {
        toast.error(data.error);
        return;
      }
      setParsedResult(data.parsed);
    },
    onError: () => toast.error("Errore durante il parsing"),
  });

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    const userMsg: AIMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: chatInput,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    chatMutation.mutate({ content: chatInput });
    setChatInput("");
  };

  const handleNlpParse = () => {
    if (!nlpInput.trim()) return;
    setParsedResult(null);
    nlpMutation.mutate(nlpInput);
  };

  const handleNlpConfirm = () => {
    if (!parsedResult) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `nlp-${Date.now()}`,
        role: "assistant",
        content: `✅ **Elemento creato con successo!**\n\n- **Titolo:** ${parsedResult.title}\n- **Data:** ${parsedResult.date || "Non specificata"}\n- **Ora:** ${parsedResult.time || "Non specificata"}\n- **Progetto:** ${parsedResult.project || "Nessuno"}\n- **Tipo:** ${parsedResult.type === "event" ? "Evento" : "Task"}\n- **Confidenza:** ${Math.round(parsedResult.confidence * 100)}%`,
        timestamp: new Date(),
      },
    ]);
    setParsedResult(null);
    setNlpInput("");
    toast.success("Elemento creato!");
  };

  const handleNlpCancel = () => {
    setParsedResult(null);
    setNlpInput("");
    toast.info("Operazione annullata");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Assistant</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Integrazione Ollama — modello predefinito: gemma4:31b-cloud
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Model selector */}
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

      {/* Ollama non raggiungibile banner */}
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

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Prioritizza giornata */}
        <Card size="sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-500" />
              <CardTitle>Prioritizza la mia giornata</CardTitle>
            </div>
            <CardDescription>
              Analizza i task di oggi e li riordina per priorità
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {Array.isArray(todayTasks) ? todayTasks.length : 0} task da processare
            </p>
          </CardContent>
          <CardFooter>
            <Button
              size="sm"
              className="w-full"
              disabled={!ollamaAvailable || prioritizeMutation.isPending}
              onClick={() => prioritizeMutation.mutate()}
            >
              {prioritizeMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              ) : (
                <Brain className="h-3.5 w-3.5 mr-2" />
              )}
              {prioritizeMutation.isPending ? "Analisi in corso..." : "Prioritizza"}
            </Button>
          </CardFooter>
        </Card>

        {/* Card 2: Riassunto settimanale */}
        <Card size="sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-green-500" />
              <CardTitle>Riassunto settimanale</CardTitle>
            </div>
            <CardDescription>
              Genera un resoconto della settimana con progressi e suggerimenti
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {today.toLocaleDateString("it-IT", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
          </CardContent>
          <CardFooter>
            <Button
              size="sm"
              className="w-full"
              disabled={!ollamaAvailable || summaryMutation.isPending}
              onClick={() => summaryMutation.mutate()}
            >
              {summaryMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              ) : (
                <Calendar className="h-3.5 w-3.5 mr-2" />
              )}
              {summaryMutation.isPending ? "Generazione..." : "Genera riassunto"}
            </Button>
          </CardFooter>
        </Card>

        {/* Card 3: Creazione rapida NLP */}
        <Card size="sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquarePlus className="h-4 w-4 text-purple-500" />
              <CardTitle>Creazione rapida</CardTitle>
            </div>
            <CardDescription>
              Descrivi in linguaggio naturale cosa devi creare
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder='es. "riunione con Marco giovedì alle 15"'
              value={nlpInput}
              onChange={(e) => setNlpInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleNlpParse();
                }
              }}
              disabled={!ollamaAvailable || nlpMutation.isPending}
              className="text-sm"
            />

            {/* Parsed result */}
            {nlpMutation.isPending && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Analisi in corso...
              </div>
            )}

            {parsedResult && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <p className="text-xs font-medium text-foreground">Risultato analisi:</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Titolo:</span>
                    <span className="font-medium">{parsedResult.title}</span>
                  </div>
                  {parsedResult.date && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Data:</span>
                      <span>{parsedResult.date}</span>
                    </div>
                  )}
                  {parsedResult.time && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ora:</span>
                      <span>{parsedResult.time}</span>
                    </div>
                  )}
                  {parsedResult.project && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Progetto:</span>
                      <span>{parsedResult.project}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tipo:</span>
                    <Badge
                      variant="outline"
                      className={`text-[9px] font-mono ${
                        parsedResult.type === "event"
                          ? "text-blue-500 bg-blue-500/10 border-blue-500/20"
                          : "text-purple-500 bg-purple-500/10 border-purple-500/20"
                      }`}
                    >
                      {parsedResult.type === "event" ? "Evento" : "Task"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Confidenza:</span>
                    <span>{Math.round(parsedResult.confidence * 100)}%</span>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="default"
                    className="flex-1 h-7 text-xs"
                    onClick={handleNlpConfirm}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Conferma
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={handleNlpCancel}
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    Annulla
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button
              size="sm"
              className="w-full"
              disabled={!ollamaAvailable || !nlpInput.trim() || nlpMutation.isPending}
              onClick={handleNlpParse}
              variant="secondary"
            >
              {nlpMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5 mr-2" />
              )}
              Analizza testo
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Chat / AI Responses Area */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Conversazione AI</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() =>
                setMessages([
                  {
                    id: "welcome",
                    role: "system",
                    content:
                      "Benvenuto nell'AI Assistant! Seleziona una funzionalità qui sotto o scrivi un messaggio per chattare con l'assistente.",
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
          <CardDescription>
            {selectedModel
              ? `Modello attivo: ${selectedModel}`
              : "Nessun modello selezionato"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
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
                    className={`max-w-[85%] rounded-lg px-4 py-2.5 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : msg.role === "system"
                          ? "bg-muted/50 text-muted-foreground text-center text-xs italic"
                          : "bg-muted text-foreground"
                    }`}
                  >
                    {msg.role !== "system" ? (
                      <div className="text-sm prose prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-headings:mt-2 prose-headings:mb-1 prose-strong:text-foreground whitespace-pre-wrap">
                        {renderMarkdown(msg.content)}
                      </div>
                    ) : (
                      <p>{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}

              {/* Loading indicator */}
              {chatMutation.isPending && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-lg px-4 py-3 bg-muted">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {selectedModel ? `${selectedModel} sta pensando...` : "Elaborazione..."}
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </CardContent>
        <CardFooter className="border-t">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendChat();
            }}
            className="flex w-full gap-2"
          >
            <Input
              placeholder="Scrivi un messaggio all'assistente AI..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={!ollamaAvailable || chatMutation.isPending}
              className="flex-1"
            />
            <Button
              type="submit"
              size="sm"
              disabled={
                !ollamaAvailable || !chatInput.trim() || chatMutation.isPending
              }
            >
              {chatMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}

/** Simple markdown renderer for AI responses */
function renderMarkdown(content: string) {
  // Split on code blocks
  const parts = content.split(/(```[\s\S]*?```)/g);

  return parts.map((part, i) => {
    // Code blocks
    if (part.startsWith("```")) {
      const code = part.replace(/```\w*\n?/g, "").trim();
      return (
        <pre
          key={i}
          className="bg-background border border-border rounded-md p-3 my-2 overflow-x-auto text-xs font-mono"
        >
          <code>{code}</code>
        </pre>
      );
    }

    // Split on lines and render line-by-line with basic markdown
    const lines = part.split("\n");
    return (
      <div key={i} className="space-y-1">
        {lines.map((line, j) => {
          if (!line.trim()) return <br key={j} />;

          // Bold text with ** **
          let rendered = line;

          // Headers
          if (line.startsWith("### ")) {
            return (
              <p key={j} className="text-sm font-semibold mt-2">
                {line.replace("### ", "")}
              </p>
            );
          }
          if (line.startsWith("## ")) {
            return (
              <p key={j} className="text-base font-semibold mt-3">
                {line.replace("## ", "")}
              </p>
            );
          }
          if (line.startsWith("# ")) {
            return (
              <p key={j} className="text-lg font-semibold mt-3">
                {line.replace("# ", "")}
              </p>
            );
          }

          // List items
          if (line.match(/^[\d]+\.\s/)) {
            return (
              <p key={j} className="text-sm ml-4">
                {line}
              </p>
            );
          }
          if (line.startsWith("- ") || line.startsWith("* ")) {
            return (
              <p key={j} className="text-sm ml-4">
                {line}
              </p>
            );
          }

          // Inline code
          const withInlineCode = line
            .split(/(`[^`]+`)/g)
            .map((seg, k) => {
              if (seg.startsWith("`") && seg.endsWith("`")) {
                return (
                  <code
                    key={k}
                    className="bg-background px-1 py-0.5 rounded text-[11px] font-mono"
                  >
                    {seg.slice(1, -1)}
                  </code>
                );
              }
              return seg;
            });

          return (
            <p key={j} className="text-sm leading-relaxed">
              {withInlineCode}
            </p>
          );
        })}
      </div>
    );
  });
}
