import { Authenticate } from "@/lib/api-auth";
import { handleErrors, HttpError, parseId, validationError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { canViewRequest, isStageApprover } from "@/lib/workflow";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  data: z.record(z.string(), z.unknown()),
});

export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = await Authenticate(req);
  if (auth.error) return auth.error;

  try {
    const id = parseId((await params).id);

    const request = await prisma.request.findUnique({
      where: { id },
      include: {
        workflow: { select: { id: true, name: true } },
        requester: { select: { id: true, name: true, email: true } },
        currentStage: {
          select: { id: true, name: true, sequenceOrder: true, isFinal: true },
        },
        histories: {
          orderBy: { createdAt: "asc" },
          include: {
            stage: { select: { id: true, name: true } },
            action: { select: { code: true, label: true } },
            actor: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!request) throw new HttpError(404, "Request tidak ditemukan");

    const viewRequest = await canViewRequest(auth.user, request);
    if (!viewRequest) throw new HttpError(403, "Forbidden");

    const isRequester = request.requesterId === auth.user.sub;
    const canSubmit = isRequester && request.status === "Draft";
    const canAct =
      request.status === "WaitingApproval" &&
      !isRequester &&
      (await isStageApprover(auth.user.sub, request.currentStageId));

    const actions = canAct
      ? (
          await prisma.workflowAction.findMany({
            where: { stageId: request.currentStageId },
            orderBy: { code: "asc" },
            select: {
              code: true,
              label: true,
              isReject: true, // <-- WAJIB di-select, tadinya hilang
            },
          })
        ).map((a) => ({
          code: a.code,
          label: a.label,
          isReject: a.isReject,
        }))
      : [];

    return NextResponse.json({
      request,
      permissions: { canEdit: canSubmit, canSubmit, canAct },
      actions,
    });
  } catch (error) {
    return handleErrors(error);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await Authenticate(req);
  if (auth.error) return auth.error;

  try {
    const id = parseId((await params).id);

    const body = patchSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) return validationError(body.error);

    const existing = await prisma.request.findUnique({
      where: { id },
      select: { requesterId: true, status: true, version: true },
    });
    if (!existing) throw new HttpError(404, "Request tidak ditemukan");
    if (existing.requesterId !== auth.user.sub) {
      throw new HttpError(403, "Forbidden");
    }
    if (existing.status !== "Draft") {
      throw new HttpError(
        409,
        "Hanya request berstatus Draft yang bisa diubah",
      );
    }

    const result = await prisma.request.updateMany({
      where: { id, status: "Draft", version: existing.version },
      data: {
        data: body.data.data as Prisma.InputJsonObject,
        version: { increment: 1 },
      },
    });

    if (result.count === 0) {
      throw new HttpError(
        409,
        "Request sudah berubah, muat ulang lalu coba lagi",
      );
    }

    const updated = await prisma.request.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        version: true,
        data: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ request: updated });
  } catch (error) {
    return handleErrors(error);
  }
}
