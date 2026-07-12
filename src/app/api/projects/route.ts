import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const includeArchived = searchParams.get("includeArchived") === "true";

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (!includeArchived) where.status = { not: "ARCHIVED" };

    const projects = await prisma.project.findMany({
      where,
      include: { _count: { select: { tasks: true, milestones: true } } },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(projects);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, color, deadline, status } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const project = await prisma.project.create({
      data: {
        name,
        description: description || null,
        color: color || null,
        deadline: deadline ? new Date(deadline) : null,
        status: status || "ACTIVE",
      },
    });
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
