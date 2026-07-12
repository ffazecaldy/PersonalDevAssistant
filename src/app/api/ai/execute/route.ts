import { NextRequest, NextResponse } from "next/server";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";

type ActionIntent =
  | "create_task"
  | "create_milestone"
  | "create_project"
  | "create_event"
  | "update_task"
  | "update_project"
  | "complete_task"
  | "unknown";

type ParsedAction = {
  intent: ActionIntent;
  reasoning: string;
  params: Record<string, unknown>;
};

type ActionResult = {
  type: ActionIntent;
  label: string;
  status: "created" | "updated" | "completed" | "skipped" | "error";
  details: Record<string, unknown>;
  error?: string;
};

type AiExecuteSuccess = {
  success: true;
  actions: ActionResult[];
  summary: string;
  raw_response: string;
};

type AiExecuteError = {
  success: false;
  error: string;
  actions: [];
  raw_response?: string;
};

type AiExecuteResponse = AiExecuteSuccess | AiExecuteError;

async function fetchProjects(baseUrl: string): Promise<{ id: string; name: string; color: string | null }[]> {
  const res = await fetch(`${baseUrl}/api/projects`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data.map((p: { id: string; name: string; color?: string | null }) => ({
    id: p.id,
    name: p.name,
    color: p.color || null,
  })) : [];
}

async function callOllama(model: string, systemPrompt: string, userMessage: string): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      stream: false,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const textError = await res.text();
    throw new Error(`Ollama error: ${res.status} — ${textError}`);
  }

  const data = await res.json();
  return data.message?.content || "";
}

function extractJson(raw: string): unknown {
  // Try to find JSON in markdown code fences or plain text
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const content = jsonMatch ? jsonMatch[1] : raw;
  // Try to extract the first JSON object or array
  const objMatch = content.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (objMatch) {
    return JSON.parse(objMatch[1]);
  }
  return JSON.parse(content);
}

async function executeAction(
  baseUrl: string,
  action: ParsedAction,
): Promise<ActionResult> {
  const { intent, params } = action;

  try {
    switch (intent) {
      case "create_task": {
        const res = await fetch(`${baseUrl}/api/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: params.title,
            description: params.description || undefined,
            priority: params.priority || "MEDIUM",
            urgent: params.urgent ?? false,
            important: params.important ?? false,
            status: params.status || "TODO",
            estimatedMinutes: params.estimatedMinutes || undefined,
            dueDate: params.dueDate || undefined,
            scheduledStart: params.scheduledStart || undefined,
            scheduledEnd: params.scheduledEnd || undefined,
            projectId: params.projectId || undefined,
          }),
          signal: AbortSignal.timeout(10_000),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create task");
        return {
          type: "create_task",
          label: (params.title as string) || "Task",
          status: "created",
          details: { id: data.id, title: data.title, project: data.project?.name || null },
        };
      }

      case "create_milestone": {
        const res = await fetch(`${baseUrl}/api/milestones`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: params.title,
            dueDate: params.dueDate || undefined,
            projectId: params.projectId,
          }),
          signal: AbortSignal.timeout(10_000),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create milestone");
        return {
          type: "create_milestone",
          label: (params.title as string) || "Milestone",
          status: "created",
          details: { id: data.id, title: data.title },
        };
      }

      case "create_project": {
        const res = await fetch(`${baseUrl}/api/projects`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: params.name,
            description: params.description || undefined,
            color: params.color || undefined,
            deadline: params.deadline || undefined,
          }),
          signal: AbortSignal.timeout(10_000),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create project");
        return {
          type: "create_project",
          label: (params.name as string) || "Project",
          status: "created",
          details: { id: data.id, name: data.name },
        };
      }

      case "create_event": {
        const res = await fetch(`${baseUrl}/api/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: params.title,
            start: params.start,
            end: params.end,
            allDay: params.allDay ?? false,
            type: params.type || "EVENT",
            notes: params.notes || undefined,
            linkedTaskId: params.linkedTaskId || undefined,
            linkedProjectId: params.linkedProjectId || undefined,
          }),
          signal: AbortSignal.timeout(10_000),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create event");
        return {
          type: "create_event",
          label: (params.title as string) || "Event",
          status: "created",
          details: { id: data.id, title: data.title, start: data.start },
        };
      }

      case "complete_task": {
        const taskId = params.id as string;
        if (!taskId) throw new Error("Task ID is required for complete_task");
        const res = await fetch(`${baseUrl}/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "DONE" }),
          signal: AbortSignal.timeout(10_000),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to complete task");
        return {
          type: "complete_task",
          label: (params.title as string) || (data.title as string) || "Task",
          status: "completed",
          details: { id: data.id, title: data.title },
        };
      }

      case "update_task": {
        const taskId = params.id as string;
        if (!taskId) throw new Error("Task ID is required for update_task");
        const updateBody: Record<string, unknown> = {};
        const updatableFields = [
          "title", "description", "priority", "urgent", "important",
          "status", "estimatedMinutes", "dueDate", "scheduledStart",
          "scheduledEnd", "projectId",
        ];
        for (const field of updatableFields) {
          if (params[field] !== undefined) {
            updateBody[field] = params[field];
          }
        }
        const res = await fetch(`${baseUrl}/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateBody),
          signal: AbortSignal.timeout(10_000),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update task");
        return {
          type: "update_task",
          label: (params.title as string) || (data.title as string) || "Task",
          status: "updated",
          details: { id: data.id, title: data.title },
        };
      }

      case "update_project": {
        const projectId = params.id as string;
        if (!projectId) throw new Error("Project ID is required for update_project");
        const updateBody: Record<string, unknown> = {};
        const updatableFields = ["name", "description", "status", "color", "deadline"];
        for (const field of updatableFields) {
          if (params[field] !== undefined) {
            updateBody[field] = params[field];
          }
        }
        const res = await fetch(`${baseUrl}/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateBody),
          signal: AbortSignal.timeout(10_000),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update project");
        return {
          type: "update_project",
          label: (params.name as string) || (data.name as string) || "Project",
          status: "updated",
          details: { id: data.id, name: data.name },
        };
      }

      default:
        return {
          type: "unknown",
          label: "Azione sconosciuta",
          status: "skipped",
          details: {},
          error: `Intent sconosciuto: ${intent}`,
        };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    return {
      type: intent,
      label: (params?.title as string) || (params?.name as string) || "Azione",
      status: "error",
      details: {},
      error: message,
    };
  }
}

function buildSummary(actions: ActionResult[]): string {
  const created = actions.filter((a) => a.status === "created").length;
  const updated = actions.filter((a) => a.status === "updated").length;
  const completed = actions.filter((a) => a.status === "completed").length;
  const errors = actions.filter((a) => a.status === "error").length;

  const parts: string[] = [];
  if (created > 0) parts.push(`${created} elemento${created > 1 ? "i" : ""} creat${created > 1 ? "i" : "o"}`);
  if (updated > 0) parts.push(`${updated} aggiornato${updated > 1 ? "i" : ""}`);
  if (completed > 0) parts.push(`${completed} completato${completed > 1 ? "i" : ""}`);
  if (errors > 0) parts.push(`${errors} con error${errors > 1 ? "i" : "e"}`);

  if (parts.length === 0) return "Nessuna azione eseguita.";
  return parts.join(", ") + ".";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, model } = body as { text: string; model?: string };

    if (!text || typeof text !== "string") {
      return NextResponse.json<AiExecuteError>(
        { success: false, error: "Il campo 'text' è richiesto.", actions: [] },
        { status: 400 },
      );
    }

    const selectedModel = model || "gemma4:31b-cloud";
    const baseUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`;

    // Fetch projects for context
    const projects = await fetchProjects(baseUrl);
    const projectsContext = projects.length > 0
      ? `Progetti disponibili:\n${projects.map((p) => `  - "${p.name}" (ID: ${p.id})${p.color ? ` [colore: ${p.color}]` : ""}`).join("\n")}`
      : "Non ci sono progetti disponibili al momento.";

    const systemPrompt = `Sei un assistente AI integrato in un Command Center per la produttività personale. Il tuo compito è analizzare il testo dell'utente e determinare quali azioni eseguire.

Sei in grado di eseguire le seguenti azioni:

1. **create_task** — Crea un nuovo task
   Parametri: title (stringa, obbligatorio), description (stringa, opzionale), priority ("LOW"|"MEDIUM"|"HIGH"|"URGENT", opzionale), urgent (boolean, opzionale), important (boolean, opzionale), dueDate (stringa ISO, opzionale), estimatedMinutes (numero, opzionale), projectId (stringa, opzionale — usa l'ID se il progetto esiste, altrimenti null)

2. **create_milestone** — Crea una nuova milestone
   Parametri: title (stringa, obbligatorio), dueDate (stringa ISO, opzionale), projectId (stringa, obbligatorio)

3. **create_project** — Crea un nuovo progetto
   Parametri: name (stringa, obbligatorio), description (stringa, opzionale), color (stringa, opzionale), deadline (stringa ISO, opzionale)

4. **create_event** — Crea un nuovo evento nel calendario
   Parametri: title (stringa, obbligatorio), start (stringa ISO, obbligatorio), end (stringa ISO, obbligatorio), allDay (boolean, opzionale), type ("EVENT"|"TASK_BLOCK", opzionale), notes (stringa, opzionale)

5. **complete_task** — Segna un task come completato
   Parametri: id (stringa, obbligatorio — ID del task), title (stringa, opzionale — per riferimento)

6. **update_task** — Aggiorna un task esistente
   Parametri: id (stringa, obbligatorio), più qualsiasi campo aggiornabile (title, description, priority, status, etc.)

7. **update_project** — Aggiorna un progetto esistente
   Parametri: id (stringa, obbligatorio), più qualsiasi campo aggiornabile (name, description, status, color, deadline)

${projectsContext}

REGOLE IMPORTANTI:
- Se l'utente menziona un progetto per nome, cerca nella lista dei progetti disponibili. Se il nome corrisponde, usa il suo ID come projectId. Se non corrisponde, imposta projectId a null e menziona nella motivazione che il progetto non è stato trovato.
- Per le date, interpreta espressioni come "domani", "lunedì prossimo", "tra 3 giorni", "venerdì" e convertile in date ISO.
- Per gli orari, interpreta espressioni come "alle 15", "alle 15:30", "a mezzogiorno", "alle 14" e convertile in formato ISO per start/end (assumi durata 1 ora se non specificata).
- Se non riesci a determinare l'intento, usa "unknown".
- Data odierna: ${new Date().toISOString().split("T")[0]}

Rispondi ESCLUSIVAMENTE con un JSON valido in questo formato:
{
  "intent": "create_task",
  "reasoning": "Spiegazione in italiano di cosa deve essere fatto e perché",
  "params": {
    ... campi specifici per l'azione scelta ...
  }
}

NON aggiungere testo extra, spiegazioni, markdown o formattazione. SOLO il JSON.`;

    const ollamaResponse = await callOllama(selectedModel, systemPrompt, text);

    // Parse the structured response from Ollama
    let parsedAction: ParsedAction;
    try {
      const parsed = extractJson(ollamaResponse) as Partial<ParsedAction>;
      if (!parsed.intent || !parsed.params) {
        // Try to handle the case where it might be wrapped in { action: { ... } }
        const wrapped = parsed as Record<string, unknown>;
        const action = wrapped.action || wrapped.azione || null;
        if (action && typeof action === "object") {
          parsedAction = action as ParsedAction;
        } else {
          throw new Error("Risposta AI incompleta: mancano intent o params");
        }
      } else {
        parsedAction = parsed as ParsedAction;
      }
    } catch {
      return NextResponse.json<AiExecuteError>(
        {
          success: false,
          error: "Impossibile interpretare la risposta dell'AI. Riprova con una formulazione diversa.",
          actions: [],
          raw_response: ollamaResponse,
        },
        { status: 422 },
      );
    }

    if (parsedAction.intent === "unknown") {
      return NextResponse.json<AiExecuteResponse>({
        success: true,
        actions: [{
          type: "unknown",
          label: "Richiesta non riconosciuta",
          status: "skipped",
          details: {},
          error: parsedAction.reasoning || "Non ho capito cosa vuoi fare.",
        }],
        summary: parsedAction.reasoning || "Non ho capito cosa vuoi fare.",
        raw_response: ollamaResponse,
      });
    }

    // Execute the action
    const result = await executeAction(baseUrl, parsedAction);

    const allActions = [result];
    const hasError = result.status === "error";
    const summary = hasError
      ? `❌ Errore: ${result.error}`
      : buildSummary(allActions);

    if (hasError) {
      return NextResponse.json<AiExecuteResponse>({
        success: true,
        actions: allActions,
        summary,
        raw_response: ollamaResponse,
      });
    }

    return NextResponse.json<AiExecuteResponse>({
      success: true,
      actions: allActions,
      summary,
      raw_response: ollamaResponse,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";

    if (message.includes("Ollama") || message.includes("fetch")) {
      return NextResponse.json<AiExecuteError>(
        {
          success: false,
          error: "Ollama non raggiungibile. Assicurati che sia in esecuzione su localhost:11434.",
          actions: [],
        },
        { status: 503 },
      );
    }

    return NextResponse.json<AiExecuteError>(
      {
        success: false,
        error: message,
        actions: [],
      },
      { status: 500 },
    );
  }
}
