import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const search = searchParams.get("search");
    const showArchived = searchParams.get("showArchived") === "true";
    const urgent = searchParams.get("urgent");
    const important = searchParams.get("important");

    const where: Record<string, unknown> = {
      ...(showArchived ? {} : { isArchived: false }),
      ...(projectId && { projectId }),
      ...(status && { status }),
      ...(priority && { priority }),
      ...(urgent !== null && { urgent: urgent === "true" }),
      ...(important !== null && { important: important === "true" }),
      ...(search && {
        title: { contains: search },
      }),
    };

    const tasks = await prisma.task.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, color: true } },
        subTasks: { where: { isArchived: false } },
        _count: { select: { subTasks: true } },
      },
      orderBy: [
        { priority: "desc" },
        { dueDate: "asc" },
        { createdAt: "desc" },
      ],
    });
    return NextResponse.json(tasks);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
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

    if (!title || typeof title !== "string") {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    const task = await prisma.task.create({
      data: {
        title,
        description: description || null,
        priority: priority || "MEDIUM",
        urgent: urgent ?? false,
        important: important ?? false,
        status: status || "TODO",
        estimatedMinutes: estimatedMinutes || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        scheduledStart: scheduledStart ? new Date(scheduledStart) : null,
        scheduledEnd: scheduledEnd ? new Date(scheduledEnd) : null,
        projectId: projectId || null,
        parentTaskId: parentTaskId || null,
      },
      include: {
        project: { select: { id: true, name: true, color: true } },
      },
    });
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}
