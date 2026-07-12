import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { title, start, end, allDay, type, linkedTaskId, linkedProjectId, notes } = body;

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (start !== undefined) data.start = new Date(start);
    if (end !== undefined) data.end = new Date(end);
    if (allDay !== undefined) data.allDay = allDay;
    if (type !== undefined) data.type = type;
    if (linkedTaskId !== undefined) data.linkedTaskId = linkedTaskId || null;
    if (linkedProjectId !== undefined) data.linkedProjectId = linkedProjectId || null;
    if (notes !== undefined) data.notes = notes;

    const event = await prisma.calendarEvent.update({
      where: { id },
      data,
    });
    return NextResponse.json(event);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update event" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.calendarEvent.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete event" },
      { status: 500 }
    );
  }
}
