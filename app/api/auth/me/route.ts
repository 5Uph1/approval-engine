import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Authenticate } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await Authenticate(req);
  if (auth.error) return auth.error;

  const user = await prisma.user.findUnique({
    where: { id: auth.user.sub },
    select: {
      id: true,
      name: true,
      email: true,
      userRoles: { select: { role: { select: { name: true } } } },
    },
  });

  if (!user) {
    return NextResponse.json(
      { message: "User tidak ditemukan" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    roles: user.userRoles.map((ur) => ur.role.name),
  });
}
