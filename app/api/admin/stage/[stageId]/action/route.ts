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

type Ctx = { params: Promise<{ stageId: string }> };

const createSchema = z.object({
  code: actionCodeSchema,
  label: z.string().trim().min(1, "Label wajib diisi").max(100),
  // Stage tujuan. null = Reject (request berakhir sebagai Rejected)
  toStageId: z.string().uuid().nullable(),
});

/** POST /api/admin/stages/:stageId/actions — membuat action + transition sekaligus */
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await Authenticate(req, ["Admin"]);
  if (auth.error) return auth.error;

  try {
    const stageId = parseId((await params).stageId);

    const body = createSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) return validationError(body.error);
    const { code, label, toStageId } = body.data;

    const stage = await prisma.workflowStage.findUnique({
      where: { id: stageId },
      select: { workflowId: true, sequenceOrder: true, isFinal: true },
    });
    if (!stage) throw new HttpError(404, "Stage tidak ditemukan");

    await assertStructureEditable(stage.workflowId);

    if (stage.isFinal) {
      throw new HttpError(422, "Stage final tidak boleh memiliki action");
    }
    if (toStageId) await assertValidTarget(stage, toStageId);

    try {
      const action = await prisma.workflowAction.create({
        data: {
          stageId,
          code,
          label,
          transitions: { create: { fromStageId: stageId, toStageId } },
        },
        include: { transitions: { select: { toStageId: true } } },
      });
      return NextResponse.json(
        { action: serializeAction(action) },
        { status: 201 },
      );
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
