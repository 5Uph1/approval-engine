"use client";

import Link from "next/link";
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
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Info, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CreateWorkflowPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validasi sederhana di sisi client
    if (!formData.name.trim()) {
      setError("Nama workflow wajib diisi.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/workflow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error?.message ||
            result.message ||
            "Gagal menambahkan workflow baru",
        );
      }

      // Berhasil disimpan -> Redirect ke halaman daftar workflow
      router.push("/admin/configuration");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan pada koneksi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-10 dark:bg-gray-950">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header & Back Button */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 cursor-pointer"
          >
            <Link href="/admin/configuration">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Tambah Workflow Baru
            </h1>
            <p className="text-sm text-muted-foreground">
              Buat alur kerja baru untuk otomatisasi sistem.
            </p>
          </div>
        </div>

        {/* Form Card */}
        <Card className="shadow-sm">
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle className="text-lg">Detail Workflow</CardTitle>
              <CardDescription>
                Isi informasi dasar workflow di bawah ini.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Notifikasi Error jika ada */}
              {error && (
                <div className="rounded-md bg-red-50 p-4 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">
                  {error}
                </div>
              )}

              {/* Input Nama Workflow */}
              <div className="space-y-2">
                <Label htmlFor="name">
                  Nama Workflow <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Contoh: Approval Pengajuan Cuti"
                  disabled={loading}
                  required
                />
              </div>

              {/* Input Deskripsi Workflow */}
              <div className="space-y-2">
                <Label htmlFor="description">Deskripsi</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Jelaskan fungsi atau tujuan dari workflow ini..."
                  rows={4}
                  disabled={loading}
                />
              </div>

              {/* Information Callout untuk Default Status */}
              <div className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50/50 p-3 text-xs text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
                <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div>
                  <p className="font-semibold">Informasi Status</p>
                  <p className="text-muted-foreground dark:text-blue-300/80">
                    Workflow baru akan dibuat secara otomatis dengan status{" "}
                    <strong>Non-Active</strong>. Kamu dapat mengaktifkannya
                    setelah menambahkan tahapan (stages).
                  </p>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex items-center justify-end gap-3 border-t bg-gray-50/50 px-6 py-4 dark:bg-gray-900/50">
              <Button variant="outline" className="cursor-pointer">
                <Link href="/admin/configuration">Batal</Link>
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Simpan Workflow</span>
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
