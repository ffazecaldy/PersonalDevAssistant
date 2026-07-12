import { NextRequest, NextResponse } from "next/server";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, model } = body as { text: string; model?: string };

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "text è richiesto" },
        { status: 400 }
      );
    }

    const systemPrompt = `Sei un assistente specializzato nel parsing di linguaggio naturale in italiano. Il tuo compito è estrarre informazioni strutturate da frasi in linguaggio naturale relative a task ed eventi.

La frase di input può descrivere:
- Un appuntamento/evento: "riunione con Marco giovedì alle 15 sul progetto sito"
- Un task da fare: "finire la presentazione per venerdì"
- Un promemoria: "chiamare il commercialista domani mattina"

Devi restituire SOLO un JSON valido con questa struttura:
{
  "parsed": {
    "title": "titolo estrapolato o generato",
    "date": "data in formato ISO (YYYY-MM-DD) o null se non specificata",
    "time": "ora in formato HH:mm o null se non specificata",
    "project": "nome del progetto se menzionato, altrimenti null",
    "type": "event" o "task",
    "confidence": numero da 0 a 1 che indica quanto sei sicuro dell'estrazione
  }
}

Non aggiungere testo extra, SOLO il JSON.`;

    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model || "gemma4:31b-cloud",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Testo da analizzare: "${text}"` },
        ],
        stream: false,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const textError = await res.text();
      return NextResponse.json(
        { error: `Ollama error: ${res.status}`, details: textError },
        { status: 502 }
      );
    }

    const data = await res.json();
    const content = data.message?.content || "";

    // Estrai JSON dalla risposta (potrebbe essere incorniciato in markdown)
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = JSON.parse(content);
      }
    } catch {
      return NextResponse.json(
        { error: "Impossibile parsare la risposta AI", raw: content },
        { status: 422 }
      );
    }

    return NextResponse.json({
      parsed: {
        title: parsed.parsed?.title || parsed.title || text,
        date: parsed.parsed?.date || parsed.date || null,
        time: parsed.parsed?.time || parsed.time || null,
        project: parsed.parsed?.project || parsed.project || null,
        type: parsed.parsed?.type || parsed.type || "task",
        confidence: parsed.parsed?.confidence || parsed.confidence || 0.5,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Ollama non raggiungibile", available: false },
      { status: 503 }
    );
  }
}
