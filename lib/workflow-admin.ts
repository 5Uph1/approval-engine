import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/http";

type Db = PrismaClient | Prisma.TransactionClient;

// Kode action: huruf kapital, angka, underscore. Contoh: MANAGER_APPROVE
export const actionCodeSchema = z
  .string()
  .trim()
  .min(1, "Kode wajib diisi")
  .max(50)
  .regex(
    /^[A-Z][A-Z0-9_]*$/,
    "Kode hanya boleh huruf kapital, angka, dan underscore",
  );

// Key field kustom: huruf kecil, angka, underscore. Dipakai sebagai key di JSON `data`.
// "title" dan "notes" dipakai sistem (judul & catatan bawaan), jadi tidak boleh dipakai admin.
export const fieldKeySchema = z
  .string()
  .trim()
  .min(1, "Key wajib diisi")
  .max(50)
  .regex(
    /^[a-z][a-z0-9_]*$/,
    "Key hanya boleh huruf kecil, angka, underscore, dan diawali huruf",
  )
  .refine((v) => !["title", "notes"].includes(v), {
    message: '"title" dan "notes" sudah dipakai sistem, gunakan key lain',
  });

export const fieldTypeSchema = z.enum([
  "TEXT",
  "TEXTAREA",
  "NUMBER",
  "DATE",
  "SELECT",
  "CHECKBOX",
]);

export const fieldOptionsSchema = z
  .array(z.string().trim().min(1))
  .min(1, "Minimal 1 opsi")
  .max(50)
  .optional();

// Jumlah request yang masih berjalan (belum selesai) di workflow ini.
export async function countInFlight(
  workflowId: string,
  db: Db = prisma,
): Promise<number> {
  return db.request.count({
    where: { workflowId, status: { in: ["Submitted", "WaitingApproval"] } },
  });
}

export async function assertStructureEditable(
  workflowId: string,
  db: Db = prisma,
): Promise<void> {
  const workflow = await db.workflow.findUnique({
    where: { id: workflowId },
    select: { isActive: true },
  });
  if (!workflow) throw new HttpError(404, "Workflow tidak ditemukan");

  if (workflow.isActive) {
    throw new HttpError(
      409,
      "Nonaktifkan workflow terlebih dahulu sebelum mengubah struktur (stage, action, transition, field)",
    );
  }

  const inFlight = await countInFlight(workflowId, db);
  if (inFlight > 0) {
    throw new HttpError(
      409,
      `Struktur tidak bisa diubah: masih ada ${inFlight} request yang sedang berjalan`,
    );
  }
}

// Stage tujuan harus satu workflow dan hanya boleh maju (sequenceOrder lebih besar).
export async function assertValidTarget(
  fromStage: { workflowId: string; sequenceOrder: number },
  toStageId: string,
  db: Db = prisma,
): Promise<void> {
  const to = await db.workflowStage.findUnique({
    where: { id: toStageId },
    select: { workflowId: true, sequenceOrder: true },
  });
  if (!to || to.workflowId !== fromStage.workflowId) {
    throw new HttpError(404, "Stage tujuan tidak ditemukan di workflow ini");
  }
  if (to.sequenceOrder <= fromStage.sequenceOrder) {
    throw new HttpError(
      422,
      "Transition hanya boleh menuju stage berikutnya (sequenceOrder lebih besar)",
    );
  }
}

// Bentuk respons action: transition digabung jadi toStageId.
export function serializeAction(a: {
  id: string;
  stageId: string;
  code: string;
  label: string;
  transitions: { toStageId: string | null }[];
}) {
  return {
    id: a.id,
    stageId: a.stageId,
    code: a.code,
    label: a.label,
    toStageId: a.transitions[0]?.toStageId ?? null,
  };
}

// Bentuk respons field: options dinormalisasi jadi string[] | null.
export function serializeField(f: {
  id: string;
  workflowId: string;
  key: string;
  label: string;
  type: string;
  isRequired: boolean;
  options: unknown;
  sequenceOrder: number;
}) {
  return {
    id: f.id,
    workflowId: f.workflowId,
    key: f.key,
    label: f.label,
    type: f.type,
    required: f.isRequired,
    options: Array.isArray(f.options) ? (f.options as string[]) : null,
    order: f.sequenceOrder,
  };
}
