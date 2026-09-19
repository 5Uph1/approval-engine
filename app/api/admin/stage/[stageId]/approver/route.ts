import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Authenticate } from "@/lib/api-auth";
import { handleErrors, HttpError, parseId, validationError } from "@/lib/http";

type Ctx = { params: Promise<{ stageId: string }> };

// Tepat satu dari roleId / userId, sesuai approverType
const createSchema = z.discriminatedUnion("approverType", [
  z.object({ approverType: z.literal("ROLE"), roleId: z.string().uuid() }),
  z.object({ approverType: z.literal("USER"), userId: z.string().uuid() }),
]);

const approverSelect = {
  id: true,
  stageId: true,
  approverType: true,
  roleId: true,
  userId: true,
} as const;

/** POST /api/admin/stages/:stageId/approvers — boleh kapan saja */
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await Authenticate(req, ["Admin"]);
  if (auth.error) return auth.error;

  try {
    const stageId = parseId((await params).stageId);

    const body = createSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) return validationError(body.error);
    const input = body.data;

    const stage = await prisma.workflowStage.findUnique({
      where: { id: stageId },
      select: { isFinal: true },
    });
    if (!stage) throw new HttpError(404, "Stage tidak ditemukan");
    if (stage.isFinal) {
      throw new HttpError(422, "Stage final tidak memerlukan approver");
    }

    if (input.approverType === "ROLE") {
      const role = await prisma.role.findUnique({
        where: { id: input.roleId },
        select: { id: true },
      });
      if (!role) throw new HttpError(404, "Role tidak ditemukan");

      const duplicate = await prisma.workflowStageApprover.findFirst({
        where: { stageId, approverType: "ROLE", roleId: input.roleId },
        select: { id: true },
      });
      if (duplicate) {
        throw new HttpError(
          409,
          "Role ini sudah menjadi approver di stage ini",
        );
      }

      const approver = await prisma.workflowStageApprover.create({
        data: { stageId, approverType: "ROLE", roleId: input.roleId },
        select: approverSelect,
      });
      return NextResponse.json({ approver }, { status: 201 });
    }

    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true },
    });
    if (!user) throw new HttpError(404, "User tidak ditemukan");

    const duplicate = await prisma.workflowStageApprover.findFirst({
      where: { stageId, approverType: "USER", userId: input.userId },
      select: { id: true },
    });
    if (duplicate) {
      throw new HttpError(409, "User ini sudah menjadi approver di stage ini");
    }

    const approver = await prisma.workflowStageApprover.create({
      data: { stageId, approverType: "USER", userId: input.userId },
      select: approverSelect,
    });
    return NextResponse.json({ approver }, { status: 201 });
  } catch (e) {
    return handleErrors(e);
  }
}
