import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Authenticate } from "@/lib/api-auth";
import { handleErrors } from "@/lib/http";

/**
 * GET /api/workflow
 * Daftar workflow AKTIF untuk dipilih saat membuat request.
 * Bisa diakses semua user yang login (bukan hanya Admin).
 * Workflow aktif dijamin valid, karena aktivasi hanya berhasil setelah validasi.
 */
export async function GET(req: NextRequest) {
  const auth = await Authenticate(req);
  if (auth.error) return auth.error;

  try {
    const data = await prisma.workflow.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, description: true },
    });

    return NextResponse.json({ data });
  } catch (e) {
    return handleErrors(e);
  }
}
