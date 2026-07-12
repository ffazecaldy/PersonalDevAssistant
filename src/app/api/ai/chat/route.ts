import { NextRequest, NextResponse } from "next/server";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { model, messages, system } = body;

    if (!model || !messages) {
      return NextResponse.json(
        { error: "model e messages sono richiesti" },
        { status: 400 }
      );
    }

    const ollamaPayload: Record<string, unknown> = {
      model,
      messages,
      stream: false,
    };

    if (system) {
      ollamaPayload.system = system;
    }

    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ollamaPayload),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Ollama error: ${res.status}`, details: text },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Ollama non raggiungibile", available: false },
      { status: 503 }
    );
  }
}
