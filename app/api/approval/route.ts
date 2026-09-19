import { Authenticate } from "@/lib/api-auth";
import { handleErrors, validationError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";

const querySchema = z.object({
  workflowId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const queueSelect = {
  id: true,
  requestNumber: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  workflow: {
    select: {
      id: true,
      name: true,
    },
  },
  requester: {
    select: {
      id: true,
      name: true,
    },
  },
  currentStage: {
    select: {
      id: true,
      name: true,
      action: {
        select: {
          code: true,
          label: true,
        },
      },
    },
  },
} satisfies Prisma.RequestSelect;

export async function GET(req: NextRequest) {
  const auth = await Authenticate(req);
  if (auth.error) return auth.error;

  try {
    const query = querySchema.safeParse(
      Object.fromEntries(req.nextUrl.searchParams),
    );
    if (!query.success) return validationError(query.error);
    const { workflowId, page, limit } = query.data;

    const userId = auth.user.sub;

    const where: Prisma.RequestWhereInput = {
      status: "WaitingApproval",
      requesterId: { not: userId },
      ...(workflowId && { workflowId }),
      currentStage: {
        approvers: {
          some: {
            OR: [
              { approverType: "USER", userId },
              {
                approverType: "ROLE",
                role: { userRoles: { some: { userId } } },
              },
            ],
          },
        },
      },
    };

    const [items, total] = await prisma.$transaction([
      prisma.request.findMany({
        where,
        orderBy: { updatedAt: "asc" },
        skip: (page - 1) * limit,
        take: limit,
        select: queueSelect,
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
