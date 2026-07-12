import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { title, dueDate, done } = body;

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
    if (done !== undefined) data.done = done;

    const milestone = await prisma.milestone.update({
      where: { id },
      data,
    });

    return NextResponse.json(milestone);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update milestone" },
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

    await prisma.milestone.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete milestone" },
      { status: 500 }
    );
  }
}
