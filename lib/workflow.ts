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
    .format(new Date())
    .replace(/-/g, "");
}

// Generate request number diambil dari tanggal hari ini dan nomor urut
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

/* -------------------------------------------------------------------------- */
/*                     Validasi data request vs field kustom                  */
/* -------------------------------------------------------------------------- */

export type RequestFieldDef = {
  key: string;
  label: string;
  type: "TEXT" | "TEXTAREA" | "NUMBER" | "DATE" | "SELECT" | "CHECKBOX";
  required: boolean;
  options: string[] | null;
};

export type FieldValidationIssue = { path: string; message: string };

// Validasi `data` yang dikirim user saat membuat/mengedit request, terhadap
// field kustom yang didefinisikan admin di workflow tersebut.
export function validateRequestData(
  fields: RequestFieldDef[],
  data: Record<string, unknown>,
): FieldValidationIssue[] {
  const issues: FieldValidationIssue[] = [];

  for (const field of fields) {
    const value = data[field.key];
    const isEmpty =
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "");

    if (field.required && isEmpty) {
      issues.push({ path: field.key, message: `${field.label} wajib diisi` });
      continue;
    }
    if (isEmpty) continue;

    switch (field.type) {
      case "NUMBER":
        if (typeof value !== "number" || !Number.isFinite(value)) {
          issues.push({
            path: field.key,
            message: `${field.label} harus berupa angka`,
          });
        }
        break;
      case "DATE":
        if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
          issues.push({
            path: field.key,
            message: `${field.label} harus berupa tanggal yang valid`,
          });
        }
        break;
      case "SELECT":
        if (
          typeof value !== "string" ||
          !(field.options ?? []).includes(value)
        ) {
          issues.push({
            path: field.key,
            message: `${field.label} harus salah satu opsi yang tersedia`,
          });
        }
        break;
      case "CHECKBOX":
        if (typeof value !== "boolean") {
          issues.push({
            path: field.key,
            message: `${field.label} harus bernilai true/false`,
          });
        }
        break;
      case "TEXT":
      case "TEXTAREA":
        if (typeof value !== "string") {
          issues.push({
            path: field.key,
            message: `${field.label} harus berupa teks`,
          });
        }
        break;
    }
  }

  return issues;
}
