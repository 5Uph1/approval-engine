import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Authenticate } from "@/lib/api-auth";
import { handleErrors } from "@/lib/http";

// GET /api/admin/users — daftar user (untuk memilih approver), maksimal 200
export async function GET(req: NextRequest) {
  const auth = await Authenticate(req, ["Admin"]);
  if (auth.error) return auth.error;

  try {
    const data = await prisma.user.findMany({
      orderBy: { name: "asc" },
      take: 200,
      select: { id: true, name: true, email: true },
    });
    return NextResponse.json({ data });
  } catch (e) {
    return handleErrors(e);
  }
}
