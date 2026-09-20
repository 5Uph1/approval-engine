import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Authenticate } from "@/lib/api-auth";
import { handleErrors, HttpError, parseId } from "@/lib/http";
import { countInFlight } from "@/lib/workflow-admin";

type Ctx = { params: Promise<{ approverId: string }> };

// DELETE /api/admin/approvers/:approverId
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const auth = await Authenticate(req, ["Admin"]);
  if (auth.error) return auth.error;

  try {
    const approverId = parseId((await params).approverId);

    const approver = await prisma.workflowStageApprover.findUnique({
      where: { id: approverId },
      include: {
        stage: {
          select: {
            id: true,
            isFinal: true,
            workflowId: true,
            workflow: { select: { isActive: true } },
          },
        },
      },
    });
    if (!approver) throw new HttpError(404, "Approver tidak ditemukan");

    const { stage } = approver;

    if (!stage.isFinal) {
      const remaining = await prisma.workflowStageApprover.count({
        where: { stageId: stage.id, id: { not: approverId } },
      });

      if (remaining === 0) {
        const inFlight = await countInFlight(stage.workflowId);
        if (stage.workflow.isActive || inFlight > 0) {
          throw new HttpError(
            409,
            "Ini approver terakhir di stage ini. Tambahkan approver pengganti dulu, atau nonaktifkan workflow dan pastikan tidak ada request berjalan",
          );
        }
      }
    }

    await prisma.workflowStageApprover.delete({ where: { id: approverId } });

    return NextResponse.json({ deleted: true });
  } catch (e) {
    return handleErrors(e);
  }
}
