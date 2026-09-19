import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const uuidSchema = z.string().uuid();

// Error yang bisa dilempar dari mana saja (termasuk dalam transaction).
export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Validasi param `id` agar Prisma tidak error 500 saat diberi UUID rusak.
export function parseId(id: string): string {
  const result = uuidSchema.safeParse(id);
  if (!result.success) throw new HttpError(400, "ID tidak valid");
  return result.data;
}

export function validationError(error: z.ZodError) {
  return NextResponse.json(
    {
      message: "Validasi gagal",
      errors: error.issues.map((i) => ({
        path: i.path.map(String).join("."),
        message: i.message,
      })),
    },
    { status: 400 },
  );
}

export function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
  );
}

// Dipakai di blok catch semua route handler.
export function handleErrors(e: unknown) {
  if (e instanceof HttpError) {
    return NextResponse.json(
      { message: e.message, ...e.details },
      { status: e.status },
    );
  }

  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") {
      return NextResponse.json(
        { message: "Data duplikat: nilai unik sudah dipakai" },
        { status: 409 },
      );
    }

    if (e.code === "P2003") {
      return NextResponse.json(
        { message: "Referensi tidak valid, atau data masih dipakai data lain" },
        { status: 409 },
      );
    }

    if (e.code === "P2025") {
      return NextResponse.json(
        { message: "Data tidak ditemukan" },
        { status: 404 },
      );
    }
  }

  console.error(e);

  return NextResponse.json(
    { message: "Internal server error" },
    { status: 500 },
  );
}
