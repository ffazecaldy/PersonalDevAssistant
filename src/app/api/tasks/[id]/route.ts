import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true, color: true } },
        subTasks: {
          where: { isArchived: false },
          orderBy: { createdAt: "asc" },
        },
        parentTask: { select: { id: true, title: true } },
      },
    });
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json(task);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch task" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      title,
      description,
      priority,
      urgent,
      important,
      status,
      estimatedMinutes,
      dueDate,
      scheduledStart,
      scheduledEnd,
      projectId,
      parentTaskId,
    } = body;

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (priority !== undefined) data.priority = priority;
    if (urgent !== undefined) data.urgent = urgent;
    if (important !== undefined) data.important = important;
    if (status !== undefined) data.status = status;
    if (estimatedMinutes !== undefined) data.estimatedMinutes = estimatedMinutes;
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
    if (scheduledStart !== undefined)
      data.scheduledStart = scheduledStart ? new Date(scheduledStart) : null;
    if (scheduledEnd !== undefined)
      data.scheduledEnd = scheduledEnd ? new Date(scheduledEnd) : null;
    if (projectId !== undefined) data.projectId = projectId || null;
    if (parentTaskId !== undefined) data.parentTaskId = parentTaskId || null;

    if (status === "DONE") data.completedAt = new Date();

    const task = await prisma.task.update({
      where: { id },
      data,
      include: {
        project: { select: { id: true, name: true, color: true } },
      },
    });
    return NextResponse.json(task);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update task" },
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
    // Soft-delete: archivia invece di eliminare
    await prisma.task.update({
      where: { id },
      data: { isArchived: true },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to archive task" },
      { status: 500 }
    );
  }
}
