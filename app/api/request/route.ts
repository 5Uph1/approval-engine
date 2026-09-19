import { Authenticate } from "@/lib/api-auth";
import { handleErrors, HttpError, validationError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";

const createSchema = z.object({
  workflowId: z.string().uuid("workflow tidak valid"),
  data: z.record(z.string(), z.unknown()),
});

const listSchema = z.object({
  status: z
    .enum([
      "Draft",
      "Submitted",
      "WaitingApproval",
      "Approved",
      "Rejected",
      "Completed",
    ])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(1),
});

const requestSummarySelect = {
  id: true,
  requestNumber: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  workflow: { select: { id: true, name: true } },
  currentStage: { select: { id: true, name: true } },
};

export async function POST(req: NextRequest) {
  const auth = await Authenticate(req);
  if (auth.error) return auth.error;

  try {
    const requesterId = auth.user.sub;

    if (!requesterId) {
      throw new Error("User ID is required");
    }

    const body = createSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) return validationError(body.error);
    const { workflowId, data } = body.data;

    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: { stages: { orderBy: { sequenceOrder: "asc" }, take: 1 } },
    });
    if (!workflow || !workflow.isActive) {
      throw new HttpError(404, "Workflow tidak ditemukan atau tidak aktif");
    }

    const firstStage = workflow.stages[0];
    if (!firstStage) {
      throw new HttpError(422, "Workflow belum memiliki stage");
    }

    const created = await prisma.request.create({
      data: {
        workflowId,
        requesterId,
        currentStageId: firstStage.id,
        status: "Draft",
        data: data as Prisma.InputJsonObject,
      },
      select: requestSummarySelect,
    });

    return NextResponse.json({ request: created }, { status: 201 });
  } catch (error) {
    return handleErrors(error);
  }
}

export async function GET(req: NextRequest) {
  const auth = await Authenticate(req);
  if (auth.error) return auth.error;

  try {
    const query = listSchema.safeParse(
      Object.fromEntries(req.nextUrl.searchParams),
    );
    if (!query.success) return validationError(query.error);
    const { status, page, limit } = query.data;

    const where: Prisma.RequestWhereInput = {
      requesterId: auth.user.sub,
      ...(status && { status }),
    };

    const [items, total] = await prisma.$transaction([
      prisma.request.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: requestSummarySelect,
      }),
      prisma.request.count({ where }),
    ]);

    return NextResponse.json({
      data: items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return handleErrors(error);
  }
}
