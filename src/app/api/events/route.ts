import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: Record<string, unknown> = {};
    if (from || to) {
      where.start = {};
      if (from) (where.start as Record<string, unknown>).gte = new Date(from);
      if (to) (where.start as Record<string, unknown>).lte = new Date(to);
    }

    const events = await prisma.calendarEvent.findMany({
      where,
      orderBy: { start: "asc" },
    });
    return NextResponse.json(events);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title,
      start,
      end,
      allDay,
      type,
      linkedTaskId,
      linkedProjectId,
      notes,
    } = body;

    if (!title || !start || !end) {
      return NextResponse.json(
        { error: "Title, start, and end are required" },
        { status: 400 }
      );
    }

    const event = await prisma.calendarEvent.create({
      data: {
        title,
        start: new Date(start),
        end: new Date(end),
        allDay: allDay ?? false,
        type: type || "EVENT",
        linkedTaskId: linkedTaskId || null,
        linkedProjectId: linkedProjectId || null,
        notes: notes || null,
      },
    });
    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create event" },
      { status: 500 }
    );
  }
}
