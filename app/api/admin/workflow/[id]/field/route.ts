import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Authenticate } from "@/lib/api-auth";
import {
  handleErrors,
  HttpError,
  isUniqueViolation,
  parseId,
  validationError,
} from "@/lib/http";
import {
  assertStructureEditable,
  fieldKeySchema,
  fieldOptionsSchema,
  fieldTypeSchema,
  serializeField,
} from "@/lib/workflow-admin";

type Ctx = { params: Promise<{ id: string }> };

const createFieldSchema = z
  .object({
    key: fieldKeySchema,
    label: z.string().trim().min(1, "Label wajib diisi").max(100),
    type: fieldTypeSchema,
    required: z.boolean().default(false),
    options: fieldOptionsSchema,
    order: z.number().int().min(0).optional(),
  })
  .refine((v) => v.type !== "SELECT" || (v.options && v.options.length > 0), {
    message: "Field bertipe SELECT wajib punya minimal 1 opsi",
    path: ["options"],
  });

// POST /api/admin/workflow/:id/field — tambah field kustom untuk request di workflow ini
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await Authenticate(req, ["Admin"]);
  if (auth.error) return auth.error;

  try {
    const workflowId = parseId((await params).id);

    const body = createFieldSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!body.success) return validationError(body.error);
    const { key, label, type, required, options, order } = body.data;

    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { id: true },
    });
    if (!workflow) throw new HttpError(404, "Workflow tidak ditemukan");

    await assertStructureEditable(workflowId);

    let nextOrder = order;
    if (nextOrder === undefined) {
      const last = await prisma.workflowField.findFirst({
        where: { workflowId },
        orderBy: { sequenceOrder: "desc" },
        select: { sequenceOrder: true },
      });
      nextOrder = (last?.sequenceOrder ?? -1) + 1;
    }

    try {
      const field = await prisma.workflowField.create({
        data: {
          workflowId,
          key,
          label,
          type,
          isRequired: required,
          options: type === "SELECT" ? options : undefined,
          sequenceOrder: nextOrder,
        },
      });
      return NextResponse.json(
        { field: serializeField(field) },
        { status: 201 },
      );
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new HttpError(409, "Key field sudah dipakai di workflow ini");
      }
      throw e;
    }
  } catch (e) {
    return handleErrors(e);
  }
}
