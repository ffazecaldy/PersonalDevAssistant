import { NextRequest, NextResponse } from "next/server";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";

export async function GET(_req: NextRequest) {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json({ models: [], available: false });
    }

    const data = await res.json();
    const models = (data.models || []).map((m: { name: string; size?: number; modified_at?: string }) => ({
      name: m.name,
      size: m.size || 0,
      modifiedAt: m.modified_at || null,
    }));

    return NextResponse.json({ models, available: true });
  } catch {
    // Ollama non raggiungibile — non crashare
    return NextResponse.json({ models: [], available: false });
  }
}
