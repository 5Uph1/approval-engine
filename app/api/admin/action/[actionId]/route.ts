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
  actionCodeSchema,
  assertStructureEditable,
  assertValidTarget,
  serializeAction,
} from "@/lib/workflow-admin";

type Ctx = { params: Promise<{ actionId: string }> };

const patchSchema = z
  .object({
    code: actionCodeSchema.optional(),
    label: z.string().trim().min(1).max(100).optional(),
    // undefined = tidak diubah, null = jadikan Reject, uuid = stage tujuan baru
    toStageId: z.string().uuid().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Minimal satu field harus diisi");

/** PATCH /api/admin/actions/:actionId */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await Authenticate(req, ["Admin"]);
  if (auth.error) return auth.error;

  try {
    const actionId = parseId((await params).actionId);

    const body = patchSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) return validationError(body.error);
    const { code, label, toStageId } = body.data;

    const action = await prisma.workflowAction.findUnique({
      where: { id: actionId },
      include: {
        stage: { select: { id: true, workflowId: true, sequenceOrder: true } },
      },
    });
    if (!action) throw new HttpError(404, "Action tidak ditemukan");

    await assertStructureEditable(action.stage.workflowId);
    if (toStageId) await assertValidTarget(action.stage, toStageId);

    try {
      const updated = await prisma.$transaction(async (tx) => {
        await tx.workflowAction.update({
          where: { id: actionId },
          data: { code, label },
        });

        if (toStageId !== undefined) {
          await tx.workflowTransition.upsert({
            where: {
              fromStageId_actionId: {
                fromStageId: action.stageId,
                actionId,
              },
            },
            update: { toStageId },
            create: { fromStageId: action.stageId, actionId, toStageId },
          });
        }

        return tx.workflowAction.findUniqueOrThrow({
          where: { id: actionId },
          include: { transitions: { select: { toStageId: true } } },
        });
      });

      return NextResponse.json({ action: serializeAction(updated) });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new HttpError(409, "Kode action sudah dipakai di stage ini");
      }
      throw e;
    }
  } catch (e) {
    return handleErrors(e);
  }
}

/** DELETE /api/admin/actions/:actionId */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const auth = await Authenticate(req, ["Admin"]);
  if (auth.error) return auth.error;

  try {
    const actionId = parseId((await params).actionId);

    const action = await prisma.workflowAction.findUnique({
      where: { id: actionId },
      include: { stage: { select: { workflowId: true } } },
    });
    if (!action) throw new HttpError(404, "Action tidak ditemukan");

    await assertStructureEditable(action.stage.workflowId);

    const usedInHistory = await prisma.requestHistory.count({
      where: { actionId },
    });
    if (usedInHistory > 0) {
      throw new HttpError(
        409,
        "Action sudah dipakai di history request, tidak bisa dihapus",
      );
    }

    await prisma.$transaction([
      prisma.workflowTransition.deleteMany({ where: { actionId } }),
      prisma.workflowAction.delete({ where: { id: actionId } }),
    ]);

    return NextResponse.json({ deleted: true });
  } catch (e) {
    return handleErrors(e);
  }
}
