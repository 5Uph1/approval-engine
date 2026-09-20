import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Authenticate } from "@/lib/api-auth";
import { handleErrors, HttpError, parseId, validationError } from "@/lib/http";
import { validateWorkflow } from "@/lib/workflow-validation";
import { countInFlight } from "@/lib/workflow-admin";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(500).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Minimal satu field harus diisi");

// GET /api/admin/workflows/:id — detail lengkap (stage, action, transition, approver, field)
export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = await Authenticate(req, ["Admin"]);
  if (auth.error) return auth.error;

  try {
    const id = parseId((await params).id);

    const [workflow, activeRequestCount] = await Promise.all([
      prisma.workflow.findUnique({
        where: { id },
        include: {
          stages: {
            orderBy: { sequenceOrder: "asc" },
            include: {
              action: {
                orderBy: { code: "asc" },
                include: {
                  transitions: true,
                },
              },
              approvers: {
                include: {
                  role: { select: { id: true, name: true } },
                  user: { select: { id: true, name: true, email: true } },
                },
              },
            },
          },
          fields: {
            orderBy: { sequenceOrder: "asc" },
          },
        },
      }),
      countInFlight(id),
    ]);

    if (!workflow) throw new HttpError(404, "Workflow tidak ditemukan");

    return NextResponse.json({
      workflow: {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        isActive: workflow.isActive,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
        activeRequestCount,
        stages: workflow.stages.map((s) => ({
          id: s.id,
          name: s.name,
          sequenceOrder: s.sequenceOrder,
          isFinal: s.isFinal,
          actions: s.action.map((a) => ({
            id: a.id,
            code: a.code,
            label: a.label,
            isReject: a.isReject,
            toStageId: a.transitions[0]?.toStageId ?? null,
          })),
          approvers: s.approvers.map((ap) => ({
            id: ap.id,
            approverType: ap.approverType,
            role: ap.role,
            user: ap.user,
          })),
        })),
        fields: workflow.fields.map((f) => ({
          id: f.id,
          key: f.key,
          label: f.label,
          type: f.type,
          required: f.isRequired,
          options: Array.isArray(f.options) ? (f.options as string[]) : null,
          order: f.sequenceOrder,
        })),
      },
    });
  } catch (e) {
    return handleErrors(e);
  }
}

// PATCH /api/admin/workflows/:id — ubah nama/deskripsi, aktifkan/nonaktifkan
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await Authenticate(req, ["Admin"]);
  if (auth.error) return auth.error;

  try {
    const id = parseId((await params).id);

    const body = patchSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) return validationError(body.error);
    const { name, description, isActive } = body.data;

    const existing = await prisma.workflow.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new HttpError(404, "Workflow tidak ditemukan");

    if (isActive === true) {
      const issues = await validateWorkflow(id);
      if (issues.length > 0) {
        throw new HttpError(
          422,
          "Workflow belum valid, tidak bisa diaktifkan",
          { issues },
        );
      }
    }

    const workflow = await prisma.workflow.update({
      where: { id },
      data: { name, description, isActive, updatedBy: auth.user.sub },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ workflow });
  } catch (e) {
    return handleErrors(e);
  }
}

// DELETE /api/admin/workflows/:id
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const auth = await Authenticate(req, ["Admin"]);
  if (auth.error) return auth.error;

  try {
    const id = parseId((await params).id);

    const existing = await prisma.workflow.findUnique({
      where: { id },
      select: { id: true, _count: { select: { requests: true } } },
    });
    if (!existing) throw new HttpError(404, "Workflow tidak ditemukan");

    if (existing._count.requests > 0) {
      await prisma.workflow.update({
        where: { id },
        data: { isActive: false, updatedBy: auth.user.sub },
      });
      return NextResponse.json({ deleted: false, deactivated: true });
    }

    await prisma.$transaction([
      prisma.workflowTransition.deleteMany({
        where: {
          OR: [
            { fromStage: { workflowId: id } },
            { toStage: { workflowId: id } },
          ],
        },
      }),
      prisma.workflowAction.deleteMany({
        where: { stage: { workflowId: id } },
      }),
      prisma.workflowStageApprover.deleteMany({
        where: { stage: { workflowId: id } },
      }),
      prisma.workflowField.deleteMany({ where: { workflowId: id } }),
      prisma.workflowStage.deleteMany({ where: { workflowId: id } }),
      prisma.workflow.delete({ where: { id } }),
    ]);

    return NextResponse.json({ deleted: true, deactivated: false });
  } catch (e) {
    return handleErrors(e);
  }
}
