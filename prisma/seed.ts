import { ApproverType, FieldType, Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seed() {
  const passwordHash = await bcrypt.hash("password123", 10);

  // Seed Role
  const roleIds: Record<string, string> = {};
  for (const name of ["Admin", "Employee", "Manager", "Finance"]) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    roleIds[name] = role.id;
  }

  const userSeeds = [
    { name: "Admin", email: "admin@gmail.com", role: "Admin" },
    { name: "Andi Pratama", email: "employee@gmail.com", role: "Employee" },
    { name: "Helio Warno", email: "manager@gmail.com", role: "Manager" },
    { name: "Farid Zulkarnain", email: "finance@gmail.com", role: "Finance" },
  ];

  // Seed User per Role
  const userIds: Record<string, string> = {};
  for (const u of userSeeds) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { name: u.name, email: u.email, passwordHash },
    });
    userIds[u.role] = user.id;

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: roleIds[u.role] } },
      update: {},
      create: { userId: user.id, roleId: roleIds[u.role] },
    });
  }

  // Workflow Seed
  const workflowName = "Pengajuan Pembelian";
  let workflow = await prisma.workflow.findFirst({
    where: { name: workflowName },
  });
  if (!workflow) {
    workflow = await prisma.workflow.create({
      data: {
        name: workflowName,
        description: "Alur persetujuan pengajuan pembelian barang",
        isActive: true,
        createdBy: userIds["Admin"],
        updatedBy: userIds["Admin"],
      },
    });
  }

  // Field form request (isian tambahan yang dilihat pemohon saat membuat request).
  // Judul pengajuan sudah bawaan sistem, jadi tidak perlu didefinisikan di sini.
  // Satu field per tipe supaya form dinamis mudah didemokan.
  const fieldDefs: {
    key: string;
    label: string;
    type: FieldType;
    required: boolean;
    options?: string[];
  }[] = [
    {
      key: "nominal",
      label: "Nominal pengajuan (Rp)",
      type: FieldType.NUMBER,
      required: true,
    },
    {
      key: "kategori",
      label: "Kategori",
      type: FieldType.SELECT,
      required: true,
      options: ["Peralatan kantor", "Perangkat IT", "Konsumsi", "Lainnya"],
    },
    {
      key: "vendor",
      label: "Vendor / toko",
      type: FieldType.TEXT,
      required: false,
    },
    {
      key: "tanggal_dibutuhkan",
      label: "Tanggal dibutuhkan",
      type: FieldType.DATE,
      required: false,
    },
    {
      key: "mendesak",
      label: "Pengajuan mendesak",
      type: FieldType.CHECKBOX,
      required: false,
    },
    {
      // Key "notes" ditampilkan sebagai keterangan di halaman detail request
      key: "notes",
      label: "Catatan / detail",
      type: FieldType.TEXTAREA,
      required: false,
    },
  ];

  for (let i = 0; i < fieldDefs.length; i++) {
    const f = fieldDefs[i];
    const fieldData = {
      label: f.label,
      type: f.type,
      isRequired: f.required,
      // Kolom Json nullable: pakai Prisma.DbNull, bukan null biasa
      options: f.options ?? Prisma.DbNull,
      sequenceOrder: i,
    };

    await prisma.workflowField.upsert({
      where: { workflowId_key: { workflowId: workflow.id, key: f.key } },
      update: fieldData,
      create: { workflowId: workflow.id, key: f.key, ...fieldData },
    });
  }

  // Stages
  // Ada dua stage final: "Approved" (jalur setuju) dan "Rejected" (jalur tolak).
  const stageDefs = [
    { seq: 1, name: "Review Manager", isFinal: false },
    { seq: 2, name: "Review Finance", isFinal: false },
    { seq: 3, name: "Approved", isFinal: true },
    { seq: 4, name: "Rejected", isFinal: true },
  ];

  const stageIds: Record<number, string> = {};
  for (const s of stageDefs) {
    const stage = await prisma.workflowStage.upsert({
      where: {
        workflowId_sequenceOrder: {
          workflowId: workflow.id,
          sequenceOrder: s.seq,
        },
      },
      update: { name: s.name, isFinal: s.isFinal },
      create: {
        workflowId: workflow.id,
        name: s.name,
        sequenceOrder: s.seq,
        isFinal: s.isFinal,
      },
    });
    stageIds[s.seq] = stage.id;
  }

  // Actions + Transitions
  // - Kode action unik per stage (bukan global), jadi upsert memakai stageId_code.
  // - isReject = true menandai penolakan; target-nya stage final "Rejected".
  const actionDefs = [
    {
      code: "MANAGER_APPROVE",
      label: "Setujui (Manager)",
      fromSeq: 1,
      toSeq: 2,
      isReject: false,
    },
    {
      code: "MANAGER_REJECT",
      label: "Tolak (Manager)",
      fromSeq: 1,
      toSeq: 4,
      isReject: true,
    },
    {
      code: "FINANCE_APPROVE",
      label: "Setujui (Finance)",
      fromSeq: 2,
      toSeq: 3,
      isReject: false,
    },
    {
      code: "FINANCE_REJECT",
      label: "Tolak (Finance)",
      fromSeq: 2,
      toSeq: 4,
      isReject: true,
    },
  ];

  for (const a of actionDefs) {
    const fromStageId = stageIds[a.fromSeq];
    const toStageId = stageIds[a.toSeq];

    const action = await prisma.workflowAction.upsert({
      where: { stageId_code: { stageId: fromStageId, code: a.code } },
      update: { label: a.label, isReject: a.isReject },
      create: {
        stageId: fromStageId,
        code: a.code,
        label: a.label,
        isReject: a.isReject,
      },
    });

    await prisma.workflowTransition.upsert({
      where: {
        fromStageId_actionId: { fromStageId, actionId: action.id },
      },
      update: { toStageId },
      create: { fromStageId, actionId: action.id, toStageId },
    });
  }

  // Approvers
  const approverDefs = [
    // Stage 1: siapa pun ber-role Manager
    { seq: 1, approverType: ApproverType.ROLE, roleId: roleIds["Manager"] },
    // Stage 2: siapa pun ber-role Finance
    { seq: 2, approverType: ApproverType.ROLE, roleId: roleIds["Finance"] },
    // Stage 2: contoh approver tipe USER (Admin ditunjuk langsung)
    { seq: 2, approverType: ApproverType.USER, userId: userIds["Admin"] },
  ];

  for (const ap of approverDefs) {
    const where = {
      stageId: stageIds[ap.seq],
      approverType: ap.approverType,
      roleId: ap.roleId ?? null,
      userId: ap.userId ?? null,
    };
    const exists = await prisma.workflowStageApprover.findFirst({ where });
    if (!exists) {
      await prisma.workflowStageApprover.create({ data: where });
    }
  }

  console.log("Seed selesai.");
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
