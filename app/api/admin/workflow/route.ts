import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Authenticate } from "@/lib/api-auth";
import { handleErrors, validationError } from "@/lib/http";

const listSchema = z.object({
  q: z.string().trim().min(1).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const createSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(100),
  description: z.string().trim().max(500).default(""),
});

const workflowSelect = {
  id: true,
  name: true,
  description: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WorkflowSelect;

/** GET /api/admin/workflows?q=&isActive=&page=&limit= */
export async function GET(req: NextRequest) {
  const auth = await Authenticate(req, ["Admin"]);
  if (auth.error) return auth.error;

  try {
    const query = listSchema.safeParse(
      Object.fromEntries(req.nextUrl.searchParams),
    );
    if (!query.success) return validationError(query.error);
    const { isActive, page, limit } = query.data;

    const where: Prisma.WorkflowWhereInput = {
      ...(isActive !== undefined ? { isActive } : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.workflow.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          ...workflowSelect,
          _count: { select: { stages: true, requests: true } },
        },
      }),
      prisma.workflow.count({ where }),
    ]);

    return NextResponse.json({
      data: items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return handleErrors(error);
  }
}

/** POST /api/admin/workflows — dibuat NONAKTIF; aktifkan setelah struktur valid */
export async function POST(req: NextRequest) {
  const auth = await Authenticate(req, ["Admin"]);
  if (auth.error) return auth.error;

  try {
    const body = createSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) return validationError(body.error);

    const workflow = await prisma.workflow.create({
      data: {
        name: body.data.name,
        description: body.data.description,
        isActive: false,
        createdBy: auth.user.sub,
        updatedBy: auth.user.sub,
      },
      select: workflowSelect,
    });

    return NextResponse.json({ workflow }, { status: 201 });
  } catch (e) {
    return handleErrors(e);
  }
}
