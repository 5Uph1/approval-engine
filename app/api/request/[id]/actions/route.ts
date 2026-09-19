import { Authenticate } from "@/lib/api-auth";
import { handleErrors, HttpError, parseId, validationError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { isStageApprover } from "@/lib/workflow";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";

type Ctx = { params: Promise<{ id: string }> };

const actionSchema = z.object({
  actionCode: z.string().min(1, "actionCode wajib diisi"),
  comment: z.string().trim().max(1000).optional(),
  version: z.number().int().min(1).optional(),
});

export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await Authenticate(req);
  if (auth.error) return auth.error;

  try {
    const id = parseId((await params).id);
    const userId = auth.user.sub;

    const body = actionSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) return validationError(body.error);
    const { actionCode, comment, version } = body.data;

    const result = await prisma.$transaction(async (tx) => {
      const request = await tx.request.findUnique({ where: { id } });
      if (!request) throw new HttpError(404, "Request tidak ditemukan");

      if (request.status !== "WaitingApproval") {
        throw new HttpError(409, "Request tidak ditemukan");
      }
      if (version !== undefined && version !== request.version) {
        throw new HttpError(409, "Request sudah berubah, muat ulang lalu");
      }

      if (request.requesterId !== userId) {
        throw new HttpError(403, "Tidak boleh memproses request sendiri");
      }
      if (!(await isStageApprover(userId, request.currentStageId))) {
        throw new HttpError(403, "Anda bukan approver di stage ini");
      }

      const action = await tx.workflowAction.findUnique({
        where: {
          stageId_code: { stageId: request.currentStageId, code: actionCode },
        },
      });
      if (!action) {
        throw new HttpError(400, "Action tidak tersedia di stage ini");
      }

      const transition = await tx.workflowTransition.findUnique({
        where: {
          fromStageId_actionId: {
            fromStageId: request.currentStageId,
            actionId: action.id,
          },
        },
        include: { toStage: { select: { id: true, isFinal: true } } },
      });
      if (!transition) {
        throw new HttpError(
          422,
          "Transition untuk action ini belum dikonfigurasi",
        );
      }

      const isRejected = transition.toStage === null;
      const nextStageId = transition.toStage?.id ?? request.currentStageId;
      const nextStatus = isRejected
        ? ("Rejected" as const)
        : transition.toStage!.isFinal
          ? ("Approved" as const)
          : ("WaitingApproval" as const);

      if (isRejected && !comment) {
        throw new HttpError(400, "Komentar wajib diisi saat menolak request");
      }

      const updated = await tx.request.updateMany({
        where: { id, status: "WaitingApproval", version: request.version },
        data: {
          currentStageId: nextStageId,
          status: nextStatus,
          version: { increment: 1 },
        },
      });
      if (updated.count === 0) {
        throw new HttpError(409, "Request sudah diproses oleh pihak lain");
      }

      await tx.requestHistory.create({
        data: {
          requestId: id,
          stageId: request.currentStageId,
          actionId: action.id,
          actorId: userId,
          comment: comment ?? "",
        },
      });

      return tx.request.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          requestNumber: true,
          status: true,
          version: true,
          currentStage: { select: { id: true, name: true } },
        },
      });
    });

    return NextResponse.json({ request: result });
  } catch (error) {
    return handleErrors(error);
  }
}
