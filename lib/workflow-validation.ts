import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type WorkflowIssue = {
  code: string;
  message: string;
  stageId?: string;
};

type Db = PrismaClient | Prisma.TransactionClient;

export async function validateWorkflow(
  workflowId: string,
  db: Db = prisma,
): Promise<WorkflowIssue[]> {
  const issues: WorkflowIssue[] = [];

  const stages = await db.workflowStage.findMany({
    where: { workflowId },
    orderBy: { sequenceOrder: "asc" },
    include: {
      action: {
        include: {
          transitions: true,
        },
      },
      approvers: true,
    },
  });

  if (stages.length === 0) {
    return [{ code: "NO_STAGES", message: "Workflow belum memiliki stage" }];
  }
  if (stages.length < 2) {
    issues.push({
      code: "TOO_FEW_STAGES",
      message: "Workflow minimal memiliki 2 stage",
    });
  }

  // Stage final
  const finals = stages.filter((s) => s.isFinal);
  if (finals.length === 0) {
    issues.push({ code: "NO_FINAL_STAGE", message: "Belum ada stage final" });
  } else if (finals.length > 1) {
    issues.push({
      code: "MULTIPLE_FINAL_STAGES",
      message: "Hanya boleh ada satu stage final",
    });
  } else if (finals[0].id !== stages[stages.length - 1].id) {
    issues.push({
      code: "FINAL_NOT_LAST",
      message: "Stage final harus berada di urutan terakhir",
      stageId: finals[0].id,
    });
  }

  const byId = new Map(stages.map((s) => [s.id, s]));

  for (const stage of stages) {
    const label = `Stage "${stage.name}"`;

    // Integritas approver: tepat salah satu dari roleId / userId
    for (const ap of stage.approvers) {
      const valid =
        ap.approverType === "ROLE"
          ? ap.roleId !== null && ap.userId === null
          : ap.userId !== null && ap.roleId === null;
      if (!valid) {
        issues.push({
          code: "APPROVER_INVALID",
          message: `${label} punya approver yang tidak konsisten dengan tipenya`,
          stageId: stage.id,
        });
      }
    }

    if (stage.isFinal) {
      if (stage.action.length > 0) {
        issues.push({
          code: "FINAL_HAS_ACTIONS",
          message: `${label} adalah stage final dan tidak boleh punya action`,
          stageId: stage.id,
        });
      }
      continue;
    }

    if (stage.approvers.length === 0) {
      issues.push({
        code: "STAGE_NO_APPROVER",
        message: `${label} belum memiliki approver`,
        stageId: stage.id,
      });
    }

    let hasForwardAction = false;
    for (const action of stage.action) {
      const transition = action.transitions[0];

      if (!transition) {
        issues.push({
          code: "ACTION_NO_TRANSITION",
          message: `Action "${action.code}" di ${label} belum punya transition`,
          stageId: stage.id,
        });
        continue;
      }

      if (transition.toStageId === null) continue; // reject: valid

      const target = byId.get(transition.toStageId);
      if (!target) {
        issues.push({
          code: "TRANSITION_INVALID_TARGET",
          message: `Action "${action.code}" di ${label} menuju stage di luar workflow`,
          stageId: stage.id,
        });
      } else if (target.sequenceOrder <= stage.sequenceOrder) {
        issues.push({
          code: "TRANSITION_NOT_FORWARD",
          message: `Action "${action.code}" di ${label} tidak menuju stage berikutnya`,
          stageId: stage.id,
        });
      } else {
        hasForwardAction = true;
      }
    }

    if (!hasForwardAction) {
      issues.push({
        code: "STAGE_NO_FORWARD_ACTION",
        message: `${label} belum punya action yang maju ke stage berikutnya`,
        stageId: stage.id,
      });
    }
  }

  // Keterjangkauan dari stage pertama (BFS)
  const reachable = new Set<string>([stages[0].id]);
  const queue = [stages[0]];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const action of current.action) {
      const toId = action.transitions[0]?.toStageId;
      const next = toId ? byId.get(toId) : undefined;
      if (next && !reachable.has(next.id)) {
        reachable.add(next.id);
        queue.push(next);
      }
    }
  }
  for (const stage of stages) {
    if (!reachable.has(stage.id)) {
      issues.push({
        code: "UNREACHABLE_STAGE",
        message: `Stage "${stage.name}" tidak bisa dicapai dari stage pertama`,
        stageId: stage.id,
      });
    }
  }

  return issues;
}
