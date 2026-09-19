"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Workflow {
  id: string;
  name: string;
  description: string;
}

type SubmitMode = "draft" | "submit" | null;

export default function CreateRequestPage() {
  const router = useRouter();

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<SubmitMode>(null);

  const selectedWorkflow = workflows.find((w) => w.id === selectedWorkflowId);
  const noWorkflow = workflows.length === 0;

  // Daftar workflow aktif
  useEffect(() => {
    fetch("/api/workflow")
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.message ?? "Gagal memuat workflow");
        setWorkflows(json.data);
        if (json.data.length > 0) setSelectedWorkflowId(json.data[0].id);
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  /**
   * Buat draft; kalau submitNow, lanjut ajukan.
   * Kalau pengajuan gagal, draft tetap tersimpan dan dibuka di halaman detail.
   */
  const handleSave = async (submitNow: boolean) => {
    if (!selectedWorkflowId) {
      toast.error("Pilih workflow terlebih dahulu");
      return;
    }
    if (!title.trim()) {
      toast.error("Judul pengajuan wajib diisi");
      return;
    }

    setSubmitting(submitNow ? "submit" : "draft");
    try {
      const created = await fetch("/api/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowId: selectedWorkflowId,
          data: { title: title.trim(), notes: notes.trim() },
        }),
      });
      const createdJson = await created.json().catch(() => null);
      if (!created.ok) {
        toast.error(
          createdJson?.errors?.[0]?.message ??
            createdJson?.message ??
            "Gagal membuat request",
        );
        return;
      }
      const id = createdJson.request.id;

      if (submitNow) {
        const submitted = await fetch(`/api/request/${id}/submit`, {
          method: "POST",
        });
        const submittedJson = await submitted.json().catch(() => null);
        if (!submitted.ok) {
          toast.error(
            `Draft tersimpan, tapi gagal diajukan: ${
              submittedJson?.message ?? "terjadi kesalahan"
            }`,
          );
          router.push(`dashboard/request/${id}`);
          return;
        }
        toast.success(
          `Request diajukan dengan nomor ${submittedJson.request.requestNumber}`,
        );
      } else {
        toast.success("Draft tersimpan");
      }

      router.push(`dashboard/request/${id}`);
    } catch {
      toast.error("Tidak dapat terhubung ke server");
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Memuat workflow...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40 p-6 md:p-10">
      <div className="mx-auto max-w-3xl space-y-4">
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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave(true);
            }}
          >
            <CardHeader>
              <CardTitle className="text-2xl">Buat request baru</CardTitle>
              <CardDescription>
                Pilih alur persetujuan dan lengkapi rincian pengajuan kamu.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Workflow</Label>
                <Select
                  value={selectedWorkflowId}
                  onValueChange={(val) => setSelectedWorkflowId(val ?? "")}
                  disabled={noWorkflow}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih workflow...">
                      {selectedWorkflow?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {workflows.map((wf) => (
                      <SelectItem key={wf.id} value={wf.id}>
                        {wf.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {noWorkflow ? (
                  <p className="text-sm text-muted-foreground">
                    Belum ada workflow aktif. Hubungi admin untuk
                    mengaktifkannya.
                  </p>
                ) : (
                  selectedWorkflow?.description && (
                    <p className="text-sm text-muted-foreground">
                      {selectedWorkflow.description}
                    </p>
                  )
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Judul pengajuan</Label>
                <Input
                  id="title"
                  placeholder="Contoh: Pengajuan reimbursement event X"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={submitting !== null}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Catatan / detail</Label>
                <Textarea
                  id="notes"
                  rows={4}
                  placeholder="Jelaskan kebutuhan pengajuan..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={submitting !== null}
                />
              </div>
            </CardContent>

            <CardFooter className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={submitting !== null || noWorkflow}
                onClick={() => handleSave(false)}
              >
                {submitting === "draft" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                Simpan draft
              </Button>
              <Button
                type="submit"
                className="gap-2"
                disabled={submitting !== null || noWorkflow}
              >
                {submitting === "submit" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Ajukan request
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
