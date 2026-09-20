import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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

type Ctx = { params: Promise<{ fieldId: string }> };

const patchSchema = z
  .object({
    key: fieldKeySchema.optional(),
    label: z.string().trim().min(1).max(100).optional(),
    type: fieldTypeSchema.optional(),
    required: z.boolean().optional(),
    options: fieldOptionsSchema,
    order: z.number().int().min(0).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Minimal satu field harus diisi");

// PATCH /api/admin/field/:fieldId
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await Authenticate(req, ["Admin"]);
  if (auth.error) return auth.error;

  try {
    const fieldId = parseId((await params).fieldId);

    const body = patchSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) return validationError(body.error);
    const { key, label, type, required, options, order } = body.data;

    const existing = await prisma.workflowField.findUnique({
      where: { id: fieldId },
      select: { workflowId: true, type: true, options: true },
    });
    if (!existing) throw new HttpError(404, "Field tidak ditemukan");

    await assertStructureEditable(existing.workflowId);

    const nextType = type ?? existing.type;

    if (nextType === "SELECT") {
      const nextOptions =
        options ??
        (Array.isArray(existing.options)
          ? (existing.options as string[])
          : undefined);
      if (!nextOptions || nextOptions.length === 0) {
        throw new HttpError(
          422,
          "Field bertipe SELECT wajib punya minimal 1 opsi",
        );
      }
    }

    const optionsData = nextType === "SELECT" ? options : Prisma.DbNull;

    try {
      const updated = await prisma.workflowField.update({
        where: { id: fieldId },
        data: {
          key,
          label,
          type,
          isRequired: required,
          options: optionsData,
          sequenceOrder: order,
        },
      });
      return NextResponse.json({ field: serializeField(updated) });
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

// DELETE /api/admin/field/:fieldId
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const auth = await Authenticate(req, ["Admin"]);
  if (auth.error) return auth.error;

  try {
    const fieldId = parseId((await params).fieldId);

    const field = await prisma.workflowField.findUnique({
      where: { id: fieldId },
      select: { workflowId: true },
    });
    if (!field) throw new HttpError(404, "Field tidak ditemukan");

    await assertStructureEditable(field.workflowId);

    await prisma.workflowField.delete({ where: { id: fieldId } });

    return NextResponse.json({ deleted: true });
  } catch (e) {
    return handleErrors(e);
  }
}
