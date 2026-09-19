"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Layers,
  Loader2,
  Save,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Zap,
  User,
  ShieldCheck,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

interface Approver {
  id: string;
  approverType: "ROLE" | "USER";
  role?: { id: string; name: string } | null;
  user?: { id: string; name: string; email: string } | null;
}

interface ActionItem {
  id: string;
  code: string;
  label: string;
  isReject: boolean;
  toStageId: string | null;
}

interface StageItem {
  id: string;
  name: string;
  sequenceOrder: number;
  isFinal: boolean;
  actions?: ActionItem[];
  approvers?: Approver[];
}

interface WorkflowData {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  activeRequestCount: number;
  stages: StageItem[];
}

interface OptionItem {
  id: string;
  name: string;
  email?: string;
}

/* -------------------------------------------------------------------------- */
/*                              Error extractor                               */
/* -------------------------------------------------------------------------- */

function extractError(result: any, fallback: string): string {
  if (!result) return fallback;

  const issues = result.issues ?? result.error?.issues;
  if (Array.isArray(issues) && issues.length > 0) {
    return issues
      .map((i: any) => {
        const path = Array.isArray(i.path) ? i.path.join(".") : i.path;
        return path ? `${path}: ${i.message}` : i.message;
      })
      .join(" | ");
  }

  return result.error?.message || result.message || fallback;
}

/* -------------------------------------------------------------------------- */
/*                                  Page                                      */
/* -------------------------------------------------------------------------- */

export default function DetailWorkflowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [workflow, setWorkflow] = useState<WorkflowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingWorkflow, setSavingWorkflow] = useState(false);
  const [validationIssues, setValidationIssues] = useState<string[]>([]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(false);

  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isApproverModalOpen, setIsApproverModalOpen] = useState(false);

  const [editingStage, setEditingStage] = useState<StageItem | null>(null);
  const [stageName, setStageName] = useState("");
  const [sequenceOrder, setSequenceOrder] = useState<number | undefined>(
    undefined,
  );
  const [isFinal, setIsFinal] = useState(false);
  const [submittingStage, setSubmittingStage] = useState(false);

  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [editingAction, setEditingAction] = useState<ActionItem | null>(null);
  const [actionCode, setActionCode] = useState("");
  const [actionLabel, setActionLabel] = useState("");
  const [actionIsReject, setActionIsReject] = useState(false);
  const [toStageId, setToStageId] = useState<string>("");
  const [submittingAction, setSubmittingAction] = useState(false);

  const [approverType, setApproverType] = useState<"ROLE" | "USER">("ROLE");
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");
  const [rolesList, setRolesList] = useState<OptionItem[]>([]);
  const [usersList, setUsersList] = useState<OptionItem[]>([]);
  const [submittingApprover, setSubmittingApprover] = useState(false);

  const currentStage = workflow?.stages.find((s) => s.id === selectedStageId);

  // Dua alasan struktur (stage/action) terkunci:
  // 1. workflow sedang aktif (isActive), atau
  // 2. masih ada request yang sedang berjalan (activeRequestCount > 0)
  // Server (assertStructureEditable / countInFlight) memakai kombinasi dua
  // kondisi ini juga, jadi UI HARUS pakai keduanya juga — sebelumnya di sini
  // hanya `isActive` yang dipakai, sehingga tombol tetap aktif walau server
  // pasti menolak (409) karena masih ada request berjalan.
  const workflowIsActive = workflow?.isActive ?? false;
  const hasActiveRequests = (workflow?.activeRequestCount ?? 0) > 0;
  const structureLocked = workflowIsActive || hasActiveRequests;

  const lockedReason = workflowIsActive
    ? "Workflow sedang aktif. Nonaktifkan dan simpan dulu sebelum mengubah struktur."
    : hasActiveRequests
      ? `Masih ada ${workflow?.activeRequestCount} request yang sedang berjalan pada workflow ini. Struktur tidak bisa diubah sampai request tersebut selesai.`
      : "";

  const targetStageOptions = (workflow?.stages ?? [])
    .filter((s) => {
      if (!currentStage) return false;
      if (s.id === currentStage.id) return false;
      return s.isFinal || s.sequenceOrder > currentStage.sequenceOrder;
    })
    .sort((a, b) => a.sequenceOrder - b.sequenceOrder);

  const fetchWorkflowDetail = async () => {
    try {
      const res = await fetch(`/api/admin/workflow/${id}`);
      const result = await res.json();
      if (!res.ok) {
        throw new Error(extractError(result, "Gagal mengambil data workflow"));
      }

      const data: WorkflowData = result.workflow;
      setWorkflow(data);
      setName(data.name || "");
      setDescription(data.description || "");
      setIsActive(data.isActive ?? false);
      setValidationIssues([]);
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan saat memuat data");
    } finally {
      setLoading(false);
    }
  };

  const fetchOptionsData = async () => {
    try {
      const [resRoles, resUsers] = await Promise.all([
        fetch("/api/admin/role").catch(() => null),
        fetch("/api/admin/user").catch(() => null),
      ]);

      if (resRoles?.ok) {
        const rolesData = await resRoles.json();
        setRolesList(rolesData.roles || rolesData.data || []);
      }
      if (resUsers?.ok) {
        const usersData = await resUsers.json();
        setUsersList(usersData.users || usersData.data || []);
      }
    } catch {
      // opsional: logging
    }
  };

  useEffect(() => {
    fetchWorkflowDetail();
    fetchOptionsData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleUpdateWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingWorkflow(true);
    setValidationIssues([]);

    try {
      const res = await fetch(`/api/admin/workflow/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, isActive }),
      });

      const result = await res.json();

      if (!res.ok) {
        if (res.status === 422 && result.issues) {
          setValidationIssues(
            result.issues.map((i: { message: string }) => i.message),
          );
          setIsActive(workflow?.isActive ?? false);
        }
        throw new Error(extractError(result, "Gagal memperbarui workflow"));
      }

      toast.success("Informasi workflow berhasil diperbarui");
      await fetchWorkflowDetail();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingWorkflow(false);
    }
  };

  const handleOpenStageModal = (stage?: StageItem) => {
    if (structureLocked) {
      toast.error(lockedReason);
      return;
    }

    if (stage) {
      setEditingStage(stage);
      setStageName(stage.name);
      setSequenceOrder(stage.sequenceOrder);
      setIsFinal(stage.isFinal);
    } else {
      setEditingStage(null);
      setStageName("");
      setSequenceOrder(undefined);
      setIsFinal(false);
    }
    setIsStageModalOpen(true);
  };

  const handleSaveStage = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = stageName.trim();
    if (!trimmedName) {
      toast.error("Nama stage wajib diisi");
      return;
    }

    setSubmittingStage(true);

    const isEdit = !!editingStage;
    const url = isEdit
      ? `/api/admin/stage/${editingStage!.id}`
      : `/api/admin/workflow/${id}/stage`;
    const method = isEdit ? "PATCH" : "POST";

    const payload: {
      name: string;
      isFinal: boolean;
      sequenceOrder?: number;
    } = {
      name: trimmedName,
      isFinal,
    };

    if (
      sequenceOrder !== undefined &&
      Number.isInteger(Number(sequenceOrder)) &&
      Number(sequenceOrder) > 0
    ) {
      payload.sequenceOrder = Number(sequenceOrder);
    }

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(extractError(result, "Gagal menyimpan stage"));
      }

      toast.success(`Stage berhasil ${isEdit ? "diperbarui" : "ditambahkan"}`);
      setIsStageModalOpen(false);
      await fetchWorkflowDetail();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmittingStage(false);
    }
  };

  const handleDeleteStage = async (stageId: string) => {
    if (structureLocked) {
      toast.error(lockedReason);
      return;
    }
    if (!confirm("Apakah Anda yakin ingin menghapus stage ini?")) return;

    try {
      const res = await fetch(`/api/admin/stage/${stageId}`, {
        method: "DELETE",
      });
      const result = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(extractError(result, "Gagal menghapus stage"));
      }

      toast.success("Stage berhasil dihapus");
      await fetchWorkflowDetail();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleOpenActionModal = (stageId: string, action?: ActionItem) => {
    if (structureLocked) {
      toast.error(lockedReason);
      return;
    }

    setSelectedStageId(stageId);
    if (action) {
      setEditingAction(action);
      setActionCode(action.code);
      setActionLabel(action.label);
      setActionIsReject(action.isReject ?? false);
      setToStageId(action.toStageId ?? "");
    } else {
      setEditingAction(null);
      setActionCode("");
      setActionLabel("");
      setActionIsReject(false);
      setToStageId("");
    }
    setIsActionModalOpen(true);
  };

  const handleSaveAction = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!toStageId) {
      toast.error(
        "Target stage wajib dipilih. Untuk action penolakan, pilih stage final 'Rejected'.",
      );
      return;
    }

    setSubmittingAction(true);

    const isEdit = !!editingAction;
    const url = isEdit
      ? `/api/admin/action/${editingAction!.id}`
      : `/api/admin/stage/${selectedStageId}/action`;
    const method = isEdit ? "PATCH" : "POST";

    const payload = {
      code: actionCode.trim(),
      label: actionLabel.trim(),
      isReject: actionIsReject,
      toStageId,
    };

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(extractError(result, "Gagal menyimpan action"));
      }

      toast.success(`Action berhasil ${isEdit ? "diperbarui" : "ditambahkan"}`);
      setIsActionModalOpen(false);
      await fetchWorkflowDetail();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleDeleteAction = async (actionId: string) => {
    if (structureLocked) {
      toast.error(lockedReason);
      return;
    }
    if (!confirm("Hapus action ini?")) return;

    try {
      const res = await fetch(`/api/admin/action/${actionId}`, {
        method: "DELETE",
      });
      const result = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(extractError(result, "Gagal menghapus action"));
      }

      toast.success("Action berhasil dihapus");
      await fetchWorkflowDetail();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Menambah approver diizinkan kapan saja oleh backend (route approver POST
  // tidak memanggil assertStructureEditable), jadi tidak ikut di-disable
  // oleh structureLocked. Yang dibatasi hanya hapus approver TERAKHIR di
  // stage non-final saat workflow aktif / ada request berjalan — itu sudah
  // divalidasi & diberi pesan oleh server sendiri, cukup diteruskan lewat
  // extractError.
  const handleOpenApproverModal = (stageId: string) => {
    setSelectedStageId(stageId);
    setApproverType("ROLE");
    setSelectedTargetId("");
    setIsApproverModalOpen(true);
  };

  const handleSaveApprover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTargetId) {
      toast.error("Silakan pilih Role atau User terlebih dahulu");
      return;
    }

    setSubmittingApprover(true);

    const payload =
      approverType === "ROLE"
        ? { approverType: "ROLE", roleId: selectedTargetId }
        : { approverType: "USER", userId: selectedTargetId };

    try {
      const res = await fetch(`/api/admin/stage/${selectedStageId}/approver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(extractError(result, "Gagal menambahkan approver"));
      }

      toast.success("Approver berhasil ditambahkan");
      setIsApproverModalOpen(false);
      await fetchWorkflowDetail();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmittingApprover(false);
    }
  };

  const handleDeleteApprover = async (approverId: string) => {
    if (!confirm("Hapus approver ini?")) return;

    try {
      const res = await fetch(`/api/admin/approver/${approverId}`, {
        method: "DELETE",
      });
      const result = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(extractError(result, "Gagal menghapus approver"));
      }

      toast.success("Approver berhasil dihapus");
      await fetchWorkflowDetail();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span>Memuat konfigurasi workflow...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-10 dark:bg-gray-950">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="h-9 w-9">
            <Link href="/admin/configuration">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Kelola Workflow
            </h1>
            <p className="text-sm text-muted-foreground">
              Konfigurasi detail workflow, stages, actions, dan approvers.
            </p>
          </div>
        </div>

        {validationIssues.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <span>
                Workflow tidak dapat diaktifkan karena struktur belum lengkap:
              </span>
            </div>
            <ul className="mt-2 list-inside list-disc space-y-1 pl-2 text-sm">
              {validationIssues.map((issue, idx) => (
                <li key={idx}>{issue}</li>
              ))}
            </ul>
          </div>
        )}

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Informasi Utama Workflow</CardTitle>
            <CardDescription>
              Atur nama, deskripsi, dan status keaktifan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateWorkflow} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="wf-name">Nama Workflow *</Label>
                  <Input
                    id="wf-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="wf-desc">Deskripsi</Label>
                  <Input
                    id="wf-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm sm:col-span-2">
                  <div className="space-y-0.5">
                    <Label className="text-base">Status Workflow</Label>
                    <p className="text-xs text-muted-foreground">
                      Aktifkan workflow jika seluruh stage, action, dan approver
                      sudah terkonfigurasi.
                    </p>
                  </div>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={savingWorkflow}
                  className="gap-2"
                >
                  {savingWorkflow ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Simpan Perubahan
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Layers className="h-5 w-5 text-blue-600" />
                Daftar Stage / Tahapan
              </CardTitle>
              <CardDescription>
                Urutan dan hak akses persetujuan pada tiap tahapan.
              </CardDescription>
            </div>
            <Button
              onClick={() => handleOpenStageModal()}
              disabled={structureLocked}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Stage</span>
            </Button>
          </CardHeader>

          <CardContent>
            {workflowIsActive && (
              <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Workflow sedang <strong>aktif</strong>, sehingga strukturnya
                  terkunci. Nonaktifkan status di atas lalu klik{" "}
                  <em>Simpan Perubahan</em> untuk dapat menambah atau mengubah
                  stage, action, dan approver.
                </span>
              </div>
            )}

            {hasActiveRequests && (
              <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Ada <strong>{workflow?.activeRequestCount}</strong> request
                  yang masih berjalan pada workflow ini. Struktur (stage,
                  action, dan penghapusan approver terakhir) tidak bisa diubah
                  sampai seluruh request tersebut selesai diproses.
                </span>
              </div>
            )}

            {!workflow?.stages || workflow.stages.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Belum ada stage yang dibuat di workflow ini.
                </p>
                <Button
                  variant="link"
                  onClick={() => handleOpenStageModal()}
                  disabled={structureLocked}
                  className="mt-2"
                >
                  + Tambah Stage Pertama
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {[...workflow.stages]
                  .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
                  .map((stage) => (
                    <div
                      key={stage.id}
                      className="space-y-4 rounded-lg border bg-card p-5 shadow-sm"
                    >
                      <div className="flex items-center justify-between border-b pb-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white shadow">
                            {stage.sequenceOrder}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-base font-semibold">
                                {stage.name}
                              </h4>
                              {stage.isFinal && (
                                <Badge className="gap-1 bg-emerald-100 text-[10px] text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Final Stage
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Urutan Ke-{stage.sequenceOrder}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                            disabled={structureLocked}
                            onClick={() => handleOpenStageModal(stage)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:bg-red-50"
                            disabled={structureLocked}
                            onClick={() => handleDeleteStage(stage.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-4 pt-1 md:grid-cols-2">
                        <div className="space-y-3 rounded-md border bg-gray-50/50 p-3 dark:bg-gray-900/50">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                              <UserCheck className="h-3.5 w-3.5 text-indigo-600" />
                              Approvers ({stage.approvers?.length || 0})
                            </span>
                            {!stage.isFinal && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1 text-xs"
                                onClick={() =>
                                  handleOpenApproverModal(stage.id)
                                }
                              >
                                <Plus className="h-3 w-3" />
                                Tambah
                              </Button>
                            )}
                          </div>

                          {stage.isFinal ? (
                            <p className="text-xs italic text-muted-foreground">
                              Stage final tidak memerlukan approver.
                            </p>
                          ) : !stage.approvers ||
                            stage.approvers.length === 0 ? (
                            <p className="text-xs italic text-amber-600 dark:text-amber-400">
                              Belum ada approver. Minimal 1 approver wajib
                              diisi.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {stage.approvers.map((app) => (
                                <div
                                  key={app.id}
                                  className="flex items-center justify-between rounded border bg-white p-2 text-xs shadow-2xs dark:bg-gray-800"
                                >
                                  <div className="flex items-center gap-2">
                                    {app.approverType === "ROLE" ? (
                                      <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />
                                    ) : (
                                      <User className="h-3.5 w-3.5 text-emerald-500" />
                                    )}
                                    <span className="font-medium">
                                      {app.approverType === "ROLE"
                                        ? `Role: ${app.role?.name}`
                                        : `User: ${app.user?.name} (${app.user?.email})`}
                                    </span>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-red-500 hover:bg-red-50"
                                    onClick={() => handleDeleteApprover(app.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="space-y-3 rounded-md border bg-gray-50/50 p-3 dark:bg-gray-900/50">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                              <Zap className="h-3.5 w-3.5 text-amber-500" />
                              Actions / Transisi ({stage.actions?.length || 0})
                            </span>
                            {!stage.isFinal && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1 text-xs"
                                disabled={structureLocked}
                                onClick={() => handleOpenActionModal(stage.id)}
                              >
                                <Plus className="h-3 w-3" />
                                Tambah
                              </Button>
                            )}
                          </div>

                          {stage.isFinal ? (
                            <p className="text-xs italic text-muted-foreground">
                              Stage final tidak boleh memiliki action.
                            </p>
                          ) : !stage.actions || stage.actions.length === 0 ? (
                            <p className="text-xs italic text-amber-600 dark:text-amber-400">
                              Belum ada action (tombol keputusan).
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {stage.actions.map((act) => {
                                const targetStage = workflow.stages.find(
                                  (s) => s.id === act.toStageId,
                                );
                                return (
                                  <div
                                    key={act.id}
                                    className="flex items-center justify-between rounded border bg-white p-2 text-xs shadow-2xs dark:bg-gray-800"
                                  >
                                    <div>
                                      <span className="font-semibold">
                                        {act.label}
                                      </span>{" "}
                                      <span className="text-muted-foreground">
                                        ({act.code})
                                      </span>
                                      {act.isReject && (
                                        <Badge
                                          variant="destructive"
                                          className="ml-1.5 text-[10px]"
                                        >
                                          Reject
                                        </Badge>
                                      )}
                                      <p className="text-[10px] text-muted-foreground">
                                        Target:{" "}
                                        <span
                                          className={
                                            act.isReject
                                              ? "font-medium text-red-500"
                                              : "font-medium text-blue-600"
                                          }
                                        >
                                          {targetStage?.name ??
                                            "Stage tidak ditemukan"}
                                        </span>
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-blue-600"
                                        disabled={structureLocked}
                                        onClick={() =>
                                          handleOpenActionModal(stage.id, act)
                                        }
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-red-500 hover:bg-red-50"
                                        disabled={structureLocked}
                                        onClick={() =>
                                          handleDeleteAction(act.id)
                                        }
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isStageModalOpen} onOpenChange={setIsStageModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingStage ? "Edit Stage" : "Tambah Stage Baru"}
            </DialogTitle>
            <DialogDescription>
              Atur nama, urutan sequence, dan status tahap akhir.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveStage} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="stage-name">Nama Stage *</Label>
              <Input
                id="stage-name"
                placeholder="Contoh: Manager Approval, Director Review"
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sequence-order">Urutan (Sequence Order)</Label>
              <Input
                id="sequence-order"
                type="number"
                min={1}
                step={1}
                placeholder="Kosongkan untuk posisi paling akhir"
                value={sequenceOrder ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  setSequenceOrder(raw === "" ? undefined : Number(raw));
                }}
              />
              <p className="text-xs text-muted-foreground">
                Biarkan kosong agar stage ditempatkan di urutan terakhir.
              </p>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="is-final"
                checked={isFinal}
                onCheckedChange={(checked) => setIsFinal(!!checked)}
              />
              <Label
                htmlFor="is-final"
                className="cursor-pointer text-sm font-normal"
              >
                Tandai sebagai <strong>Stage Final</strong> (tahap akhir, mis.
                Approved / Rejected)
              </Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsStageModalOpen(false)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={submittingStage}>
                {submittingStage && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Simpan Stage
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isActionModalOpen} onOpenChange={setIsActionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAction ? "Edit Action" : "Tambah Action Baru"}
            </DialogTitle>
            <DialogDescription>
              Action adalah tombol keputusan (mis. Approve atau Reject) beserta
              alur perpindahan stage-nya.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="action-code">
                Kode Action (unik per stage) *
              </Label>
              <Input
                id="action-code"
                placeholder="Contoh: APPROVE, REJECT, REQUEST_REVISION"
                value={actionCode}
                onChange={(e) =>
                  setActionCode(
                    e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
                  )
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="action-label">Label Tombol *</Label>
              <Input
                id="action-label"
                placeholder="Contoh: Setujui, Tolak Pengajuan"
                value={actionLabel}
                onChange={(e) => setActionLabel(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="action-is-reject"
                checked={actionIsReject}
                onCheckedChange={(checked) => setActionIsReject(!!checked)}
              />
              <Label
                htmlFor="action-is-reject"
                className="cursor-pointer text-sm font-normal"
              >
                Action ini adalah <strong>penolakan</strong> (reject)
              </Label>
            </div>

            <div className="space-y-2">
              <Label>Target Stage Setelah Action Ini Ditekan *</Label>
              <Select
                value={toStageId}
                onValueChange={(val) => setToStageId(val ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih stage tujuan..." />
                </SelectTrigger>
                <SelectContent>
                  {targetStageOptions.length === 0 ? (
                    <div className="px-2 py-3 text-xs text-muted-foreground">
                      Tidak ada stage tujuan yang tersedia. Tambahkan stage
                      berikutnya atau stage final terlebih dahulu.
                    </div>
                  ) : (
                    targetStageOptions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.isFinal ? "🏁 Final: " : "➡️ Lanjut ke: "}
                        {s.name} (Urutan {s.sequenceOrder})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Action penolakan tetap harus menunjuk ke stage final
                &quot;Rejected&quot;, bukan dikosongkan.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsActionModalOpen(false)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={submittingAction || !toStageId}>
                {submittingAction && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Simpan Action
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isApproverModalOpen} onOpenChange={setIsApproverModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Approver untuk Stage Ini</DialogTitle>
            <DialogDescription>
              Tentukan Role atau user spesifik yang dapat melakukan persetujuan.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveApprover} className="space-y-4">
            <div className="space-y-2">
              <Label>Tipe Approver</Label>
              <Select
                value={approverType}
                onValueChange={(val) => {
                  if (!val) return;
                  setApproverType(val as "ROLE" | "USER");
                  setSelectedTargetId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ROLE">
                    Berdasarkan Role (Jabatan)
                  </SelectItem>
                  <SelectItem value="USER">
                    Berdasarkan Spesifik User
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                {approverType === "ROLE" ? "Pilih Role" : "Pilih User"}
              </Label>
              <Select
                value={selectedTargetId}
                onValueChange={(val) => setSelectedTargetId(val ?? "")}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      approverType === "ROLE"
                        ? "Pilih role..."
                        : "Pilih user..."
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {approverType === "ROLE"
                    ? rolesList.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))
                    : usersList.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name} ({u.email})
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsApproverModalOpen(false)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={submittingApprover}>
                {submittingApprover && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Tambah Approver
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
