import { Prisma, RequestStatus } from "@prisma/client";
import { prisma } from "./prisma";

// Tanggal hari ini dalam format zona Asia/Jakarta, YYYYMMDD
function todayJakarta(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date()) // 2026 - 09 - 19
    .replace(/-/g, "");
}

// Generate request number diambil dari tanggal hari ini dan nomor urut
// Jadi REQ-YYYYMMDD-0001.
// Jika terjadi double request, request yang terkena unique violation akan mengulang proses transaction
export async function generateRequestNumber(
  tx: Prisma.TransactionClient,
): Promise<string> {
  const prefix = `REQ-${todayJakarta()}-`;

  const last = await tx.request.findFirst({
    where: { requestNumber: { startsWith: prefix } },
    orderBy: { requestNumber: "desc" },
    select: { requestNumber: true },
  });

  const lastSeq = last?.requestNumber
    ? parseInt(last.requestNumber.slice(prefix.length), 10)
    : 0;

  return `${prefix}${String(lastSeq + 1).padStart(4, "0")}`;
}

// Apakah user berhak menyetujui/approve di stage ini?
export async function isStageApprover(
  userId: string,
  stageId: string,
): Promise<boolean> {
  const count = await prisma.workflowStageApprover.count({
    where: {
      stageId,
      OR: [
        { approverType: "USER", userId },
        { approverType: "ROLE", role: { userRoles: { some: { userId } } } },
      ],
    },
  });
  return count > 0;
}

// Orang yang boleh melihat request-an dari user
export async function canViewRequest(
  user: { sub: string; roles: string[] },
  request: {
    id: string;
    requesterId: string;
    currentStageId: string;
    status: RequestStatus;
  },
): Promise<boolean> {
  if (request.requesterId == user.sub) return true;
  if (user.roles.includes("Admin")) return true;

  if (request.status !== "Draft") {
    return true;
  }

  const isApprover = await isStageApprover(user.sub, request.currentStageId);

  if (isApprover) {
    return true;
  }

  const acted = await prisma.requestHistory.count({
    where: { requestId: request.id, actorId: user.sub },
  });

  return acted > 0;
}
