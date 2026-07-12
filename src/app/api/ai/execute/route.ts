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

type ActionResult = {
  type: ActionIntent;
  label: string;
  status: "created" | "updated" | "completed" | "skipped" | "error";
  details: Record<string, unknown>;
  error?: string;
};

async function fetchProjects(baseUrl: string) {
  try {
    const res = await fetch(`${baseUrl}/api/projects`, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch { return []; }
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
  // Remove markdown code fences
  let cleaned = raw.replace(/```(?:json)?\s*([\s\S]*?)```/g, "$1").trim();
  // Remove any text before the first { or [
  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");
  const jsonStart = firstBrace >= 0 && (firstBracket < 0 || firstBrace < firstBracket)
    ? firstBrace : firstBracket;
  if (jsonStart > 0) cleaned = cleaned.slice(jsonStart);
  // Remove any text after the last } or ]
  const lastBrace = cleaned.lastIndexOf("}");
  const lastBracket = cleaned.lastIndexOf("]");
  const jsonEnd = lastBrace >= 0 && (lastBracket < 0 || lastBrace > lastBracket)
    ? lastBrace + 1 : lastBracket + 1;
  if (jsonEnd > 0) cleaned = cleaned.slice(0, jsonEnd);

  return JSON.parse(cleaned);
}

async function executeOne(baseUrl: string, intent: ActionIntent, params: Record<string, unknown>): Promise<ActionResult> {
  const label = (params.title || params.name || "Elemento") as string;
  try {
    switch (intent) {
      case "create_task": {
        const p = params;
        const body: Record<string, unknown> = {
          title: p.title,
          description: p.description || null,
          priority: p.priority || "MEDIUM",
          urgent: !!p.urgent,
          important: !!p.important,
          estimatedMinutes: p.estimatedMinutes ? Number(p.estimatedMinutes) : null,
          dueDate: p.dueDate || null,
          projectId: p.projectId || null,
        };
        const res = await fetch(`${baseUrl}/api/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10_000),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Errore creazione task");
        return { type: "create_task", label, status: "created", details: { id: data.id, title: data.title } };
      }

      case "create_milestone": {
        const res = await fetch(`${baseUrl}/api/milestones`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: params.title, dueDate: params.dueDate || null, projectId: params.projectId || null }),
          signal: AbortSignal.timeout(10_000),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Errore creazione milestone");
        return { type: "create_milestone", label, status: "created", details: { id: data.id, title: data.title } };
      }

      case "create_project": {
        const res = await fetch(`${baseUrl}/api/projects`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: params.name, description: params.description || null, color: params.color || null }),
          signal: AbortSignal.timeout(10_000),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Errore creazione progetto");
        return { type: "create_project", label, status: "created", details: { id: data.id, name: data.name } };
      }

      case "create_event": {
        const res = await fetch(`${baseUrl}/api/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: params.title, start: params.start, end: params.end, allDay: !!params.allDay, type: params.type || "EVENT", notes: params.notes || null }),
          signal: AbortSignal.timeout(10_000),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Errore creazione evento");
        return { type: "create_event", label, status: "created", details: { id: data.id, title: data.title } };
      }

      case "complete_task": {
        const taskId = params.id as string;
        if (!taskId) throw new Error("ID task mancante per completamento");
        const res = await fetch(`${baseUrl}/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "DONE" }),
          signal: AbortSignal.timeout(10_000),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Errore completamento task");
        return { type: "complete_task", label, status: "completed", details: { id: data.id, title: data.title } };
      }

      default:
        return { type: intent, label, status: "skipped", details: {}, error: `Azione non supportata: ${intent}` };
    }
  } catch (err) {
    return { type: intent, label, status: "error", details: {}, error: err instanceof Error ? err.message : "Errore sconosciuto" };
  }
}

function buildSummary(actions: ActionResult[]): string {
  const ok = actions.filter(a => a.status !== "error");
  const err = actions.filter(a => a.status === "error");
  let s = "";
  if (ok.length > 0) s += `${ok.length} operazione${ok.length > 1 ? "i" : ""} completata${ok.length > 1 ? "e" : ""}`;
  if (err.length > 0) s += `${s ? ", " : ""}${err.length} errore${err.length > 1 ? "i" : ""}`;
  return s || "Nessuna operazione eseguita.";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, model } = body as { text: string; model?: string };
    if (!text || typeof text !== "string") {
      return NextResponse.json({ success: false, error: "Il campo 'text' e richiesto.", actions: [] }, { status: 400 });
    }

    const selectedModel = model || "gemma4:31b-cloud";
    const baseUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const projects = await fetchProjects(baseUrl);
    const projectList = projects.map((p: { id: string; name: string; color?: string }) =>
      `  - "${p.name}" (ID: ${p.id})${p.color ? ` [colore: ${p.color}]` : ""}`
    ).join("\n");

    const today = new Date().toISOString().split("T")[0];

    const systemPrompt = `Sei un assistente AI che esegue azioni in un Command Center.

PROGETTI DISPONIBILI:
${projectList || "Nessun progetto. Se l'utente ne menziona uno, crealo."}

AZIONI SUPPORTATE (esegui SEMPRE in batch se richieste multiple):
- create_task(titolo, descrizione?, priorita?, urgente?, importante?, scadenza?, minuti?, projectId?)
- create_milestone(titolo, scadenza?, projectId?)
- create_project(nome, descrizione?, colore?)
- create_event(titolo, inizio, fine, tuttoGiorno?, note?)
- complete_task(id, titolo?)

REGOLE:
- Data odierna: ${today}
- "domani" = ${today} + 1 giorno
- Se un progetto esiste, usa il suo ID. Se non esiste, crealo.
- Se l'utente dice "per ogni progetto" o "a tutti i progetti", crea azioni per OGNI progetto.
- Per "3 task per ogni progetto", genera 3 azioni create_task per ogni progetto con titoli diversi.
- Le date nel formato YYYY-MM-DD, gli orari in formato ISO.

Rispondi SOLO con un JSON in questo formato:
{
  "summary": "Breve riepilogo in italiano di cosa stai per fare",
  "actions": [
    { "intent": "create_task", "params": { "title": "...", "projectId": "..." } },
    { "intent": "create_task", "params": { "title": "...", "projectId": "..." } }
  ]
}

NON scrivere spiegazioni, markdown o testo extra. SOLO JSON valido.`;

    const ollamaResponse = await callOllama(selectedModel, systemPrompt, text);

    // Parse the JSON response
    let actionsList: Array<{ intent: ActionIntent; params: Record<string, unknown> }> = [];
    let summary = "";

    try {
      const parsed = extractJson(ollamaResponse) as Record<string, unknown>;

      // Support both { actions: [...] } and { intent, params } (single) formats
      if (Array.isArray(parsed.actions)) {
        actionsList = parsed.actions as Array<{ intent: ActionIntent; params: Record<string, unknown> }>;
      } else if (parsed.intent) {
        actionsList = [{ intent: parsed.intent as ActionIntent, params: (parsed.params || {}) as Record<string, unknown> }];
      } else if (Array.isArray(parsed)) {
        actionsList = parsed as Array<{ intent: ActionIntent; params: Record<string, unknown> }>;
      } else {
        throw new Error("Formato JSON non valido");
      }

      summary = (parsed.summary as string) || "";
    } catch {
      // Fallback: try to send the raw request to Ollama chat for a simpler response
      try {
        const fallbackRes = await fetch(`${OLLAMA_URL}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: selectedModel,
            messages: [
              { role: "system", content: "Sei un assistente che estrae SOLO JSON da testi. Non rispondere con spiegazioni." },
              { role: "user", content: `Estrai un JSON con { "actions": [{ "intent": "...", "params": { "title": "..." } }] } da questo testo. Se non puoi, restituisci { "actions": [] }.\n\n${ollamaResponse}` },
            ],
            stream: false,
          }),
          signal: AbortSignal.timeout(15_000),
        });
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          const fallbackText = fallbackData.message?.content || "";
          try {
            const parsed = extractJson(fallbackText) as Record<string, unknown>;
            if (Array.isArray(parsed.actions)) {
              actionsList = parsed.actions as Array<{ intent: ActionIntent; params: Record<string, unknown> }>;
            }
          } catch {}
        }
      } catch {}

      if (actionsList.length === 0) {
        return NextResponse.json({
          success: false,
          error: "Non ho capito la richiesta. Puoi essere piu specifico? Es: 'crea un task Revisione per il progetto Sito Web'",
          actions: [],
          raw_response: ollamaResponse,
        }, { status: 422 });
      }
    }

    // Resolve project names to IDs
    for (const action of actionsList) {
      const pName = action.params.projectName as string | undefined;
      if (pName && !action.params.projectId) {
        const found = projects.find((p: { name: string; id: string }) =>
          p.name.toLowerCase() === pName.toLowerCase()
        );
        if (found) action.params.projectId = found.id;
      }
    }

    // Execute all actions
    const results: ActionResult[] = [];
    for (const action of actionsList) {
      if (action.intent === "unknown" || !action.params) {
        results.push({ type: "unknown", label: "Richiesta non valida", status: "skipped", details: {}, error: "Azione non riconosciuta" });
        continue;
      }
      const result = await executeOne(baseUrl, action.intent, action.params);
      results.push(result);
    }

    const finalSummary = summary || buildSummary(results);
    const hasErrors = results.some(a => a.status === "error");

    return NextResponse.json({
      success: true,
      actions: results,
      summary: hasErrors ? `⚠️ ${finalSummary}` : `✅ ${finalSummary}`,
      raw_response: ollamaResponse,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    if (message.includes("Ollama") || message.includes("fetch")) {
      return NextResponse.json(
        { success: false, error: "Ollama non raggiungibile. Verifica che sia in esecuzione su localhost:11434.", actions: [] },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { success: false, error: message, actions: [] },
      { status: 500 }
    );
  }
}
