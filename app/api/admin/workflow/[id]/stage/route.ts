import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import {
  handleErrors,
  HttpError,
  isUniqueViolation,
  parseId,
  validationError,
} from "@/lib/http";
import { assertStructureEditable } from "@/lib/workflow-admin";

type Ctx = { params: Promise<{ id: string }> };

const createSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(100),
  // Kosong = ditaruh di urutan paling akhir
  sequenceOrder: z.number().int().min(1).optional(),
  isFinal: z.boolean().default(false),
});

/** POST /api/admin/workflows/:id/stages */
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(req, ["Admin"]);
  if (auth.error) return auth.error;

  try {
    const workflowId = parseId((await params).id);

    const body = createSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) return validationError(body.error);
    const { name, isFinal } = body.data;

    await assertStructureEditable(workflowId);

    let sequenceOrder = body.data.sequenceOrder;
    if (sequenceOrder === undefined) {
      const last = await prisma.workflowStage.aggregate({
        where: { workflowId },
        _max: { sequenceOrder: true },
      });
      sequenceOrder = (last._max.sequenceOrder ?? 0) + 1;
    }

    try {
      const stage = await prisma.workflowStage.create({
        data: { workflowId, name, sequenceOrder, isFinal },
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
