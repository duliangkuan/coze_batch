import { NextRequest, NextResponse } from "next/server";
import { getAuthFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseSchema } from "@/lib/project-schema";

async function getProject(id: string) {
  return prisma.project.findUnique({ where: { id } });
}

function toProjectResponse(p: { inputSchema: string; outputSchema: string; [k: string]: unknown }) {
  return {
    ...p,
    inputSchema: parseSchema(p.inputSchema),
    outputSchema: parseSchema(p.outputSchema),
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthFromCookie();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (auth.role === "user" && project.ownerId !== auth.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(toProjectResponse(project));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthFromCookie();
  if (!auth || auth.role !== "user") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (project.ownerId !== auth.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, description, icon, workflowId, apiToken, inputSchema, outputSchema } = body;

  const updated = await prisma.project.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(icon !== undefined && { icon: icon || "Zap" }),
      ...(workflowId !== undefined && { workflowId: workflowId.trim() }),
      ...(apiToken !== undefined && { apiToken: apiToken?.trim() || null }),
      ...(inputSchema !== undefined && {
        inputSchema: typeof inputSchema === "string" ? inputSchema : JSON.stringify(inputSchema),
      }),
      ...(outputSchema !== undefined && {
        outputSchema: typeof outputSchema === "string" ? outputSchema : JSON.stringify(outputSchema),
      }),
    },
  });
  return NextResponse.json(toProjectResponse(updated));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthFromCookie();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
