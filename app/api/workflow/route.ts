import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Authenticate } from "@/lib/api-auth";
import { handleErrors } from "@/lib/http";

/**
 *
 * Daftar workflow AKTIF untuk dipilih saat membuat request.
 * Bisa diakses semua user yang login (bukan hanya Admin).
 * Workflow aktif dijamin valid, karena aktivasi hanya berhasil setelah validasi.
 */

// GET /api/workflow - Daftar workflow AKTIF untuk dipilih saat membuat request.
export async function GET(req: NextRequest) {
  const auth = await Authenticate(req);
  if (auth.error) return auth.error;

  try {
    const data = await prisma.workflow.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        fields: {
          orderBy: { sequenceOrder: "asc" },
          select: {
            key: true,
            label: true,
            type: true,
            isRequired: true,
            options: true,
            sequenceOrder: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: data.map((w) => ({
        id: w.id,
        name: w.name,
        description: w.description,
        fields: w.fields.map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type,
          required: f.isRequired,
          options: Array.isArray(f.options) ? (f.options as string[]) : null,
          order: f.sequenceOrder,
        })),
      })),
    });
  } catch (e) {
    return handleErrors(e);
  }
}
