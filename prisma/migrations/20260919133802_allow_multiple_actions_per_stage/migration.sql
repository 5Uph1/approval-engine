/*
  Warnings:

  - A unique constraint covering the columns `[stage_id,code]` on the table `workflow_actions` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "workflow_actions_stage_id_code_key" ON "workflow_actions"("stage_id", "code");
