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
import { assertStructureEditable } from "@/lib/workflow-admin";

type Ctx = { params: Promise<{ stageId: string }> };

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    sequenceOrder: z.number().int().min(1).optional(),
    isFinal: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Minimal satu field harus diisi");

/** PATCH /api/admin/stages/:stageId */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await Authenticate(req, ["Admin"]);
  if (auth.error) return auth.error;

  try {
    const stageId = parseId((await params).stageId);

    const body = patchSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) return validationError(body.error);
    const { name, sequenceOrder, isFinal } = body.data;

    const stage = await prisma.workflowStage.findUnique({
      where: { id: stageId },
      select: {
        workflowId: true,
        _count: {
          select: {
            action: true,
          },
        },
      },
    });
    if (!stage) throw new HttpError(404, "Stage tidak ditemukan");

    await assertStructureEditable(stage.workflowId);

    if (isFinal === true && stage._count.action > 0) {
      throw new HttpError(
        422,
        "Stage final tidak boleh punya action; hapus action-nya dulu",
      );
    }

    try {
      const updated = await prisma.workflowStage.update({
        where: { id: stageId },
        data: { name, sequenceOrder, isFinal },
        select: {
          id: true,
          workflowId: true,
          name: true,
          sequenceOrder: true,
          isFinal: true,
        },
      });
      return NextResponse.json({ stage: updated });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new HttpError(
          409,
          "sequenceOrder sudah dipakai stage lain di workflow ini",
        );
      }
      throw e;
    }
  } catch (e) {
    return handleErrors(e);
  }
}

/** DELETE /api/admin/stages/:stageId */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const auth = await Authenticate(req, ["Admin"]);
  if (auth.error) return auth.error;

  try {
    const stageId = parseId((await params).stageId);

    const stage = await prisma.workflowStage.findUnique({
      where: { id: stageId },
      select: { workflowId: true },
    });
    if (!stage) throw new HttpError(404, "Stage tidak ditemukan");

    await assertStructureEditable(stage.workflowId);

    const [requests, histories, incoming] = await Promise.all([
      prisma.request.count({ where: { currentStageId: stageId } }),
      prisma.requestHistory.count({ where: { stageId } }),
      prisma.workflowTransition.count({ where: { toStageId: stageId } }),
    ]);

    if (requests > 0 || histories > 0) {
      throw new HttpError(
        409,
        "Stage sudah dirujuk oleh request atau history, tidak bisa dihapus",
      );
    }
    if (incoming > 0) {
      throw new HttpError(
        409,
        "Masih ada action yang menuju stage ini; ubah atau hapus action tersebut dulu",
      );
    }

    await prisma.$transaction([
      prisma.workflowTransition.deleteMany({ where: { fromStageId: stageId } }),
      prisma.workflowAction.deleteMany({ where: { stageId } }),
      prisma.workflowStageApprover.deleteMany({ where: { stageId } }),
      prisma.workflowStage.delete({ where: { id: stageId } }),
    ]);

    return NextResponse.json({ deleted: true });
  } catch (e) {
    return handleErrors(e);
  }
}
