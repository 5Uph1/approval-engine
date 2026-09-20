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
import { Checkbox } from "@/components/ui/checkbox";
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

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

type FieldType =
  | "TEXT"
  | "TEXTAREA"
  | "NUMBER"
  | "DATE"
  | "SELECT"
  | "CHECKBOX";

interface WorkflowField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options: string[] | null;
  order: number;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  fields: WorkflowField[];
}

// Teks untuk TEXT/TEXTAREA/NUMBER/DATE/SELECT, boolean untuk CHECKBOX
type FieldValue = string | boolean;
type SubmitMode = "draft" | "submit" | null;

/* -------------------------------------------------------------------------- */
/*                         Input untuk satu field dinamis                     */
/* -------------------------------------------------------------------------- */

function FieldInput({
  field,
  value,
  error,
  disabled,
  onChange,
}: {
  field: WorkflowField;
  value: FieldValue | undefined;
  error?: string;
  disabled: boolean;
  onChange: (value: FieldValue) => void;
}) {
  const id = `field-${field.key}`;
  const requiredMark = field.required && (
    <span className="text-destructive"> *</span>
  );

  if (field.type === "CHECKBOX") {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id={id}
            checked={value === true}
            onCheckedChange={(checked) => onChange(checked === true)}
            disabled={disabled}
          />
          <Label htmlFor={id} className="cursor-pointer font-normal">
            {field.label}
            {requiredMark}
          </Label>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  const text = typeof value === "string" ? value : "";

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {field.label}
        {requiredMark}
      </Label>

      {field.type === "TEXTAREA" ? (
        <Textarea
          id={id}
          rows={4}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      ) : field.type === "SELECT" ? (
        <Select
          value={text}
          onValueChange={(val) => onChange(val ?? "")}
          disabled={disabled}
        >
          <SelectTrigger id={id}>
            <SelectValue placeholder="Pilih salah satu..." />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={id}
          type={
            field.type === "NUMBER"
              ? "number"
              : field.type === "DATE"
                ? "date"
                : "text"
          }
          step={field.type === "NUMBER" ? "any" : undefined}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    Page                                    */
/* -------------------------------------------------------------------------- */

export default function CreateRequestPage() {
  const router = useRouter();

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("");
  const [title, setTitle] = useState("");
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<SubmitMode>(null);

  const selectedWorkflow = workflows.find((w) => w.id === selectedWorkflowId);
  const noWorkflow = workflows.length === 0;
  const busy = submitting !== null;

  const fields = selectedWorkflow
    ? [...(selectedWorkflow.fields ?? [])].sort((a, b) => a.order - b.order)
    : [];

  // Daftar workflow aktif beserta definisi field-nya
  useEffect(() => {
    fetch("/api/workflow")
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.message ?? "Gagal memuat workflow");
        setWorkflows(
          json.data.map((w: Workflow) => ({ ...w, fields: w.fields ?? [] })),
        );
        if (json.data.length > 0) setSelectedWorkflowId(json.data[0].id);
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Ganti workflow -> field-nya berbeda, jadi isian kustom direset
  const handleWorkflowChange = (id: string) => {
    setSelectedWorkflowId(id);
    setValues({});
    setErrors({});
  };

  const setFieldValue = (key: string, value: FieldValue) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // Validasi di sisi client (server tetap memvalidasi ulang)
  const validate = (): Record<string, string> => {
    const result: Record<string, string> = {};

    if (!title.trim()) result.title = "Judul pengajuan wajib diisi";

    for (const f of fields) {
      const v = values[f.key];

      if (f.type === "CHECKBOX") {
        if (f.required && v !== true) result[f.key] = "Wajib dicentang";
        continue;
      }

      const text = typeof v === "string" ? v.trim() : "";
      if (!text) {
        if (f.required) result[f.key] = `${f.label} wajib diisi`;
        continue;
      }
      if (f.type === "NUMBER" && Number.isNaN(Number(text))) {
        result[f.key] = "Harus berupa angka";
      }
      if (f.type === "SELECT" && !(f.options ?? []).includes(text)) {
        result[f.key] = "Pilihan tidak valid";
      }
    }

    return result;
  };

  // Bentuk data yang dikirim ke API:
  // NUMBER -> number, CHECKBOX -> boolean, lainnya -> string.
  // Isian opsional yang kosong tidak dikirim.
  const buildData = (): Record<string, unknown> => {
    const data: Record<string, unknown> = {};

    for (const f of fields) {
      const v = values[f.key];

      if (f.type === "CHECKBOX") {
        data[f.key] = v === true;
        continue;
      }

      const text = typeof v === "string" ? v.trim() : "";
      if (!text) continue;
      data[f.key] = f.type === "NUMBER" ? Number(text) : text;
    }

    data.title = title.trim(); // field bawaan sistem
    return data;
  };

  const handleSave = async (submitNow: boolean) => {
    if (!selectedWorkflow) {
      toast.error("Pilih workflow terlebih dahulu");
      return;
    }

    const clientErrors = validate();
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) {
      toast.error("Periksa kembali isian form");
      return;
    }

    setSubmitting(submitNow ? "submit" : "draft");
    try {
      const created = await fetch("/api/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowId: selectedWorkflow.id,
          data: buildData(),
        }),
      });
      const createdJson = await created.json().catch(() => null);

      if (!created.ok) {
        // Error validasi dari server: { errors: [{ path, message }] }
        const serverErrors: { path: string; message: string }[] =
          createdJson?.errors ?? [];
        if (serverErrors.length > 0) {
          const mapped: Record<string, string> = {};
          for (const e of serverErrors) {
            if (!(e.path in mapped)) mapped[e.path] = e.message;
          }
          setErrors(mapped);
        }
        toast.error(
          serverErrors[0]?.message ??
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
          router.push(`/dashboard/${id}`);
          return;
        }
        toast.success(
          `Request diajukan dengan nomor ${submittedJson.request.requestNumber}`,
        );
      } else {
        toast.success("Draft tersimpan");
      }

      router.push(`/dashboard/${id}`);
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
          onClick={() => router.push("/dashboard")}
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Button>

        <Card>
          <form
            noValidate
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
                  onValueChange={(val) => handleWorkflowChange(val ?? "")}
                  disabled={noWorkflow || busy}
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

              {/* Field bawaan sistem: selalu ada dan wajib */}
              <div className="space-y-2">
                <Label htmlFor="title">
                  Judul pengajuan
                  <span className="text-destructive"> *</span>
                </Label>
                <Input
                  id="title"
                  placeholder="Contoh: Pengajuan reimbursement event X"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setErrors((prev) => {
                      if (!("title" in prev)) return prev;
                      const next = { ...prev };
                      delete next.title;
                      return next;
                    });
                  }}
                  disabled={busy}
                />
                {errors.title && (
                  <p className="text-sm text-destructive">{errors.title}</p>
                )}
              </div>

              {/* Field kustom sesuai konfigurasi admin di workflow terpilih */}
              {fields.map((field) => (
                <FieldInput
                  key={`${selectedWorkflowId}-${field.key}`}
                  field={field}
                  value={values[field.key]}
                  error={errors[field.key]}
                  disabled={busy}
                  onChange={(v) => setFieldValue(field.key, v)}
                />
              ))}
            </CardContent>

            <CardFooter className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={busy || noWorkflow}
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
                disabled={busy || noWorkflow}
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
