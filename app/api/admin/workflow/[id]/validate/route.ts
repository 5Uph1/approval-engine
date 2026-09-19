import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { handleErrors, HttpError, parseId } from "@/lib/http";
import { validateWorkflow } from "@/lib/workflow-validation";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/admin/workflows/:id/validate */
export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(req, ["Admin"]);
  if (auth.error) return auth.error;

  try {
    const id = parseId((await params).id);

    const workflow = await prisma.workflow.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!workflow) throw new HttpError(404, "Workflow tidak ditemukan");

    const issues = await validateWorkflow(id);
    return NextResponse.json({ valid: issues.length === 0, issues });
  } catch (e) {
    return handleErrors(e);
  }
}
