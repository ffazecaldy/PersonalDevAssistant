import { NextRequest, NextResponse } from "next/server";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";

interface TaskItem {
  title: string;
  priority: string;
  estimatedMinutes?: number | null;
  dueDate?: string | null;
  project?: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tasks, model } = body as {
      tasks: TaskItem[];
      model?: string;
    };

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json(
        { error: "tasks array è richiesto" },
        { status: 400 }
      );
    }

    const tasksList = tasks
      .map(
        (t, i) =>
          `${i + 1}. "${t.title}" | priorità: ${t.priority} | tempo stimato: ${t.estimatedMinutes ?? "N/A"}m | scadenza: ${t.dueDate ? new Date(t.dueDate).toLocaleDateString("it-IT") : "N/A"} | progetto: ${t.project ?? "N/A"}`
      )
      .join("\n");

    const systemPrompt = `Sei un assistente esperto in produttività e time management. Il tuo compito è prioritizzare la giornata lavorativa dell'utente.

Regole:
- Analizza i task in base a urgenza, importanza, scadenze e tempo stimato
- Riordina i task in ordine di esecuzione consigliato
- Per ogni task spiega brevemente PERCHÉ è stato posizionato lì (in italiano)
- Se un task è urgente e in scadenza oggi, deve essere in cima
- Raggruppa task simili dello stesso progetto
- Considera il carico di lavoro: non accumulare più di 4-5 ore di lavoro consecutive senza una pausa
- Rispondi SOLO in italiano
- Usa un formato chiaro: una lista numerata con task, orario suggerito e motivazione`;

    const userPrompt = `Ecco i miei task per oggi:\n\n${tasksList}\n\nPuoi prioritizzare la mia giornata?`;

    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model || "gemma4:31b-cloud",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: false,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Ollama error: ${res.status}`, details: text },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json({
      response: data.message?.content || "",
      model: data.model || model,
      done: data.done,
    });
  } catch {
    return NextResponse.json(
      { error: "Ollama non raggiungibile", available: false },
      { status: 503 }
    );
  }
}
