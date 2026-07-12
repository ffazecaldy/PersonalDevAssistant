import { NextRequest, NextResponse } from "next/server";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tasks, projects, events, model } = body as {
      tasks?: Array<Record<string, unknown>>;
      projects?: Array<Record<string, unknown>>;
      events?: Array<Record<string, unknown>>;
      model?: string;
    };

    const taskSummary =
      tasks && tasks.length > 0
        ? tasks
            .map(
              (t, i) =>
                `${i + 1}. "${t.title}" — stato: ${t.status ?? "N/A"} | priorità: ${t.priority ?? "N/A"} | progetto: ${t.project ?? t.projectId ?? "N/A"}`
            )
            .join("\n")
        : "Nessun task.";

    const projectSummary =
      projects && projects.length > 0
        ? projects
            .map(
              (p, i) =>
                `${i + 1}. "${p.name}" — stato: ${p.status ?? "N/A"}${p.deadline ? " | scadenza: " + new Date(p.deadline as string).toLocaleDateString("it-IT") : ""}`
            )
            .join("\n")
        : "Nessun progetto.";

    const eventsSummary =
      events && events.length > 0
        ? events
            .map(
              (e, i) =>
                `${i + 1}. "${e.title}" — ${e.start ? new Date(e.start as string).toLocaleString("it-IT") : "N/A"} → ${e.end ? new Date(e.end as string).toLocaleString("it-IT") : "N/A"}${e.type ? ` (${e.type})` : ""}`
            )
            .join("\n")
        : "Nessun evento.";

    const systemPrompt = `Sei un assistente che genera riassunti settimanali chiari e professionali in italiano. Analizza i dati forniti (task, progetti, eventi) e produci un riassunto strutturato con:

1. 📊 **Panoramica** — quante cose sono state fatte, quanti task completati, progetti attivi
2. ✅ **Progressi della settimana** — cosa è stato completato o avanzato
3. 🎯 **Priorità per la prossima settimana** — cosa richiede attenzione
4. ⚠️ **Bloccanti e rischi** — eventuali problemi o ritardi
5. 💡 **Suggerimenti** — consigli per migliorare produttività

Usa emoji per rendere il riassunto più leggibile. Rispondi SOLO in italiano.`;

    const userPrompt = `Genera un riassunto settimanale basato su questi dati:

**Task:**
${taskSummary}

**Progetti:**
${projectSummary}

**Eventi:**
${eventsSummary}

Data del riassunto: ${new Date().toLocaleDateString("it-IT", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`;

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
