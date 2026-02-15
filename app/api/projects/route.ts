import { NextRequest, NextResponse } from "next/server";
import { getAuthFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseSchema } from "@/lib/project-schema";

function toProjectResponse(p: { inputSchema: string; outputSchema: string; [k: string]: unknown }) {
  return {
    ...p,
    inputSchema: parseSchema(p.inputSchema),
    outputSchema: parseSchema(p.outputSchema),
  };
}

export async function GET() {
  const auth = await getAuthFromCookie();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (auth.role === "admin") {
    const projects = await prisma.project.findMany({ include: { owner: true }, orderBy: { updatedAt: "desc" } });
    return NextResponse.json(projects.map(toProjectResponse));
  }

  const projects = await prisma.project.findMany({
    where: { ownerId: auth.userId! },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(projects.map(toProjectResponse));
}

export async function POST(req: NextRequest) {
  const auth = await getAuthFromCookie();
  if (!auth || auth.role !== "user") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, description, icon, workflowId, apiToken, inputSchema, outputSchema } = body;

  if (!name?.trim() || !workflowId?.trim() || !inputSchema || !outputSchema) {
    return NextResponse.json({ error: "缺少 name / workflowId / inputSchema / outputSchema" }, { status: 400 });
  }

  const owner = await prisma.user.findUnique({
    where: { id: auth.userId! },
    select: { username: true },
  });
  const createdBy = owner ? `Created by @${owner.username}` : "";
  const descTrim = description?.trim() || "";
  const finalDescription = descTrim ? `${descTrim} | ${createdBy}` : createdBy || null;

  const project = await prisma.project.create({
    data: {
      name: name.trim(),
      description: finalDescription || null,
      icon: icon || "Zap",
      ownerId: auth.userId!,
      workflowId: workflowId.trim(),
      apiToken: apiToken?.trim() || null,
      inputSchema: typeof inputSchema === "string" ? inputSchema : JSON.stringify(inputSchema),
      outputSchema: typeof outputSchema === "string" ? outputSchema : JSON.stringify(outputSchema),
    },
  });
  return NextResponse.json(toProjectResponse(project));
}
