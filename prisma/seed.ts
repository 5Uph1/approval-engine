import { ApproverType, PrismaClient } from "@prisma/client";
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

  // Stages
  const stageDefs = [
    { seq: 1, name: "Review Manager", isFinal: false },
    { seq: 2, name: "Review Finance", isFinal: false },
    { seq: 3, name: "Selesai", isFinal: true },
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
  const actionDefs = [
    {
      code: "MANAGER_APPROVE",
      label: "Setujui (Manager)",
      fromSeq: 1,
      toSeq: 2,
    },
    {
      code: "FINANCE_APPROVE",
      label: "Setujui (Finance)",
      fromSeq: 2,
      toSeq: 3,
    },
  ];

  for (const a of actionDefs) {
    const action = await prisma.workflowAction.upsert({
      where: { code: a.code },
      update: { label: a.label },
      create: { code: a.code, label: a.label, stageId: stageIds[a.fromSeq] },
    });

    await prisma.workflowTransition.upsert({
      where: {
        fromStageId_actionId: {
          fromStageId: stageIds[a.fromSeq],
          actionId: action.id,
        },
      },
      update: { toStageId: stageIds[a.toSeq] },
      create: {
        fromStageId: stageIds[a.fromSeq],
        actionId: action.id,
        toStageId: stageIds[a.toSeq],
      },
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
