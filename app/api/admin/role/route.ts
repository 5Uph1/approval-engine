import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Authenticate } from "@/lib/api-auth";
import { handleErrors } from "@/lib/http";

/** GET /api/admin/roles — daftar role (untuk memilih approver) */
export async function GET(req: NextRequest) {
  const auth = await Authenticate(req, ["Admin"]);
  if (auth.error) return auth.error;

  try {
    const data = await prisma.role.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    return NextResponse.json({ data });
  } catch (e) {
    return handleErrors(e);
  }
}
