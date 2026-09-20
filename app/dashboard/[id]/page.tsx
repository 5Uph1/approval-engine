"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, History, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface HistoryItem {
  id: string;
  comment: string;
  createdAt: string;
  stage: { id: string; name: string };
  action: { code: string; label: string } | null; // null = pengajuan
  actor: { id: string; name: string };
}

interface RequestDetail {
  id: string;
  requestNumber: string | null;
  status: string;
  version: number;
  data: Record<string, unknown>;
  createdAt: string;
  workflow: { id: string; name: string };
  requester: { id: string; name: string; email: string };
  currentStage: { id: string; name: string; isFinal: boolean };
  histories: HistoryItem[];
}

interface ActionOption {
  code: string;
  label: string;
  isReject: boolean;
}

interface Permissions {
  canEdit: boolean;
  canSubmit: boolean;
  canAct: boolean;
}

const STATUS: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  Draft: { label: "Draft", variant: "secondary" },
  Submitted: { label: "Diajukan", variant: "default" },
  WaitingApproval: { label: "Menunggu persetujuan", variant: "default" },
  Approved: { label: "Disetujui", variant: "outline" },
  Rejected: { label: "Ditolak", variant: "destructive" },
  Completed: { label: "Selesai", variant: "outline" },
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function labelOf(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("id-ID");
}

export default function RequestDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const requestId = params.id;

  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [permissions, setPermissions] = useState<Permissions>({
    canEdit: false,
    canSubmit: false,
    canAct: false,
  });
  const [actions, setActions] = useState<ActionOption[]>([]);
  const [selectedActionCode, setSelectedActionCode] = useState<string | null>(
    null,
  );
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // "submit" atau kode action

  const fetchDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/request/${requestId}`);
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setError(
          json?.message ?? `Gagal memuat request (status ${res.status})`,
        );
        return;
      }

      setError(null);
      setRequest(json.request);
      setPermissions(json.permissions);
      setActions(json.actions);
    } catch {
      setError("Tidak dapat terhubung ke server");
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // Set pilihan default begitu daftar action datang dari API (approve dipilih duluan)
  useEffect(() => {
    if (actions.length === 0) {
      setSelectedActionCode(null);
      return;
    }
    setSelectedActionCode((current) => {
      if (current && actions.some((a) => a.code === current)) return current;
      const defaultAction = actions.find((a) => !a.isReject) ?? actions[0];
      return defaultAction.code;
    });
  }, [actions]);

  const selectedAction =
    actions.find((a) => a.code === selectedActionCode) ?? null;
  const isRejectSelected = selectedAction?.isReject ?? false;

  // Draft -> WaitingApproval
  const handleSubmit = async () => {
    setBusy("submit");
    try {
      const res = await fetch(`/api/request/${requestId}/submit`, {
        method: "POST",
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(json?.message ?? "Gagal mengajukan request");
      } else {
        toast.success(
          `Request diajukan dengan nomor ${json.request.requestNumber}`,
        );
      }
      await fetchDetail();
    } catch {
      toast.error("Tidak dapat terhubung ke server");
    } finally {
      setBusy(null);
    }
  };

  // Approve / Reject dsb. sesuai action yang dipilih lewat radio
  const handleAction = async (action: ActionOption) => {
    if (!request) return;
    if (action.isReject && !comment.trim()) {
      toast.error("Komentar wajib diisi saat menolak request");
      return;
    }

    setBusy(action.code);
    try {
      const res = await fetch(`/api/request/${requestId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionCode: action.code,
          comment: comment.trim() || undefined,
          version: request.version,
        }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(
          json?.errors?.[0]?.message ?? json?.message ?? "Gagal memproses aksi",
        );
      } else {
        toast.success(`${action.label} berhasil diproses`);
        setComment("");
      }
      await fetchDetail();
    } catch {
      toast.error("Tidak dapat terhubung ke server");
    } finally {
      setBusy(null);
    }
  };

  const handleSubmitDecision = () => {
    if (!selectedAction) {
      toast.error("Pilih Approve atau Reject terlebih dahulu");
      return;
    }
    handleAction(selectedAction);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Memuat detail request...</span>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="min-h-screen bg-muted/40 p-6 md:p-10">
        <div className="mx-auto max-w-4xl space-y-4">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Button>
          <Card>
            <CardContent className="py-10 text-center text-destructive">
              {error ?? "Request tidak ditemukan"}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const status = STATUS[request.status] ?? {
    label: request.status,
    variant: "secondary" as const,
  };
  const title =
    typeof request.data.title === "string" && request.data.title
      ? request.data.title
      : "Tanpa judul";
  const notes =
    typeof request.data.notes === "string" ? request.data.notes : "";
  const extraFields = Object.entries(request.data).filter(
    ([key]) => key !== "title" && key !== "notes",
  );

  return (
    <div className="min-h-screen bg-muted/40 p-6 md:p-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={() => router.push("/dashboard")}
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Button>

        {/* Informasi request */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  {request.workflow.name}
                </p>
                <CardTitle className="text-2xl">{title}</CardTitle>
                <CardDescription>
                  {request.requestNumber ?? "Belum diajukan"}
                </CardDescription>
              </div>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">{notes || "Tidak ada catatan tambahan."}</p>

            {extraFields.length > 0 && (
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                {extraFields.map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-muted-foreground">{labelOf(key)}</dt>
                    <dd className="font-medium">{formatValue(value)}</dd>
                  </div>
                ))}
              </dl>
            )}

            <div className="flex flex-wrap gap-x-6 gap-y-1 border-t pt-4 text-sm text-muted-foreground">
              <span>
                Pemohon:{" "}
                <span className="font-medium text-foreground">
                  {request.requester.name}
                </span>
              </span>
              <span>
                Stage saat ini:{" "}
                <span className="font-medium text-foreground">
                  {request.currentStage.name}
                </span>
              </span>
              <span>Dibuat: {formatDate(request.createdAt)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Ajukan draft (hanya pemilik, hanya saat Draft) */}
        {permissions.canSubmit && (
          <Card>
            <CardContent className="flex items-center justify-between gap-4 py-4">
              <p className="text-sm text-muted-foreground">
                Request ini masih draft dan belum diajukan.
              </p>
              <Button
                className="gap-2"
                disabled={busy !== null}
                onClick={handleSubmit}
              >
                {busy === "submit" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Ajukan request
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Tindakan persetujuan (hanya approver di stage ini) */}
        {permissions.canAct && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tindakan persetujuan</CardTitle>
              <CardDescription>
                Tahap: {request.currentStage.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Pilihan keputusan: Approve / Reject */}
              <div className="space-y-2">
                <Label>Keputusan</Label>
                <div className="space-y-2">
                  {actions.map((action) => {
                    const checked = selectedActionCode === action.code;
                    return (
                      <label
                        key={action.code}
                        htmlFor={`decision-${action.code}`}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition ${
                          checked
                            ? action.isReject
                              ? "border-destructive bg-destructive/5"
                              : "border-primary bg-primary/5"
                            : "border-input"
                        }`}
                      >
                        <input
                          id={`decision-${action.code}`}
                          type="radio"
                          name="approval-decision"
                          value={action.code}
                          checked={checked}
                          onChange={() => setSelectedActionCode(action.code)}
                          disabled={busy !== null}
                          className="h-4 w-4 accent-primary"
                        />
                        <span
                          className={
                            action.isReject
                              ? "font-medium text-destructive"
                              : "font-medium"
                          }
                        >
                          {action.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Komentar, wajib hanya saat Reject dipilih */}
              <div className="space-y-2">
                <Label htmlFor="comment">
                  Komentar
                  {isRejectSelected && (
                    <span className="ml-1 text-destructive">*wajib diisi</span>
                  )}
                </Label>
                <Textarea
                  id="comment"
                  rows={3}
                  placeholder={
                    isRejectSelected
                      ? "Jelaskan alasan penolakan..."
                      : "Berikan komentar (opsional)..."
                  }
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={busy !== null}
                />
                <p className="text-xs text-muted-foreground">
                  Komentar wajib diisi saat menolak.
                </p>
              </div>

              <div className="flex justify-end">
                <Button
                  variant={isRejectSelected ? "destructive" : "default"}
                  disabled={
                    busy !== null ||
                    !selectedAction ||
                    (isRejectSelected && !comment.trim())
                  }
                  onClick={handleSubmitDecision}
                >
                  {busy === selectedActionCode && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Kirim Keputusan
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Riwayat */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5" />
              Riwayat request
            </CardTitle>
            <CardDescription>
              Jejak seluruh tindakan pada request ini.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {request.histories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada riwayat. Riwayat muncul setelah request diajukan.
              </p>
            ) : (
              <ol className="space-y-6 border-l pl-6">
                {request.histories.map((h) => (
                  <li key={h.id} className="relative">
                    <span className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                    <p className="text-sm font-medium">
                      {h.actor.name}{" "}
                      <span className="font-normal text-muted-foreground">
                        · {h.action?.label ?? "Mengajukan request"}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Tahap: {h.stage.name}
                    </p>
                    {h.comment && (
                      <p className="mt-2 rounded-md bg-muted p-3 text-sm">
                        {h.comment}
                      </p>
                    )}
                    <time className="mt-1 block text-xs text-muted-foreground">
                      {formatDate(h.createdAt)}
                    </time>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
