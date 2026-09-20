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

type Ctx = { params: Promise<{ id: string }> };

const createStageSchema = z.object({
  name: z.string().trim().min(1, "Nama stage wajib diisi").max(100),
  isFinal: z.boolean().default(false),
  sequenceOrder: z.number().int().min(1).optional(),
});

// POST /api/admin/workflow/:id/stage — buat stage baru di workflow
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await Authenticate(req, ["Admin"]);
  if (auth.error) return auth.error;

  try {
    const workflowId = parseId((await params).id);

    const body = createStageSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!body.success) return validationError(body.error);
    const { name, isFinal, sequenceOrder } = body.data;

    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { id: true },
    });
    if (!workflow) throw new HttpError(404, "Workflow tidak ditemukan");

    await assertStructureEditable(workflowId);

    let nextOrder = sequenceOrder;
    if (nextOrder === undefined) {
      const last = await prisma.workflowStage.findFirst({
        where: { workflowId },
        orderBy: { sequenceOrder: "desc" },
        select: { sequenceOrder: true },
      });
      nextOrder = (last?.sequenceOrder ?? 0) + 1;
    }

    try {
      const stage = await prisma.workflowStage.create({
        data: { workflowId, name, isFinal, sequenceOrder: nextOrder },
        select: {
          id: true,
          workflowId: true,
          name: true,
          sequenceOrder: true,
          isFinal: true,
        },
      });
      return NextResponse.json({ stage }, { status: 201 });
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
