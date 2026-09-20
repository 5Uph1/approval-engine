"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface WorkflowItem {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AdminWorkflowPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [selectedDeleteId, setSelectedDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [loggingOut, setLoggingOut] = useState<boolean>(false);

  const fetchWorkflows = async (pageNumber: number) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/workflow?page=${pageNumber}&limit=10`,
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error?.message ||
            result.message ||
            "Gagal mengambil data workflow",
        );
      }

      setWorkflows(result.data ?? []);
      setMeta(
        result.meta ?? {
          page: pageNumber,
          limit: 10,
          total: result.data?.length ?? 0,
          totalPages: 1,
        },
      );
    } catch (error: any) {
      setError(error.message || "Terjadi kesalahan koneksi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows(meta.page);
  }, [meta.page]);

  const handleDelete = async () => {
    if (!selectedDeleteId) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/workflow/${selectedDeleteId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error?.message || result.message || "Gagal menghapus workflow",
        );
      }

      toast.success("Workflow berhasil dihapus!");
      setSelectedDeleteId(null);

      if (workflows.length === 1 && meta.page > 1) {
        setMeta((prev) => ({ ...prev, page: prev.page - 1 }));
      } else {
        fetchWorkflows(meta.page);
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan saat menghapus data");
    } finally {
      setDeleting(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      // Sesuaikan endpoint API logout dengan yang ada di backend/auth Anda
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success("Berhasil keluar dari akun.");
      router.push("/auth/login");
    } catch (err: any) {
      toast.error("Gagal melakukan logout.");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-10 dark:bg-gray-950">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Top Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Workflow Management
            </h1>
            <p className="text-sm text-muted-foreground">
              Kelola dan atur alur kerja otomatisasi sistem di sini.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Link href={`/admin/configuration/add-workflow`}>
              <Button className="flex items-center gap-2 cursor-pointer">
                <Plus className="h-4 w-4" />
                <span>Tambah Workflow</span>
              </Button>
            </Link>

            <Button
              variant="outline"
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex items-center gap-2 cursor-pointer text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:hover:bg-red-950/50"
            >
              {loggingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              <span>Logout</span>
            </Button>
          </div>
        </div>

        {/* Content Card */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-xl">Daftar Workflow</CardTitle>
                <CardDescription>
                  Total {meta.total} workflow terdaftar dalam sistem
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {error && (
              <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[220px]">Nama Workflow</TableHead>
                    <TableHead>Deskripsi</TableHead>
                    <TableHead className="w-[140px]">Status</TableHead>
                    <TableHead className="w-[120px] text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-32 text-center">
                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span>Memuat data workflow...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : workflows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="h-24 text-center text-muted-foreground"
                      >
                        Belum ada data workflow.
                      </TableCell>
                    </TableRow>
                  ) : (
                    workflows.map((item) => (
                      <TableRow key={item.id}>
                        {/* Name */}
                        <TableCell className="font-semibold text-gray-900 dark:text-gray-100">
                          {item.name}
                        </TableCell>

                        {/* Description */}
                        <TableCell className="text-muted-foreground max-w-xs truncate">
                          {item.description}
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          {item.isActive ? (
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300">
                              Active
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                            >
                              Non Active
                            </Badge>
                          )}
                        </TableCell>

                        {/* Action */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950/50 cursor-pointer"
                              title="Edit Workflow"
                            >
                              <Link href={`/admin/configuration/${item.id}`}>
                                <Pencil className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/50 cursor-pointer"
                              title="Hapus Workflow"
                              onClick={() => setSelectedDeleteId(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Footer */}
            <div className="flex items-center justify-between pt-4 text-xs text-muted-foreground">
              <span>
                Menampilkan {meta.page} dari {meta.totalPages || 1} halaman
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 cursor-pointer"
                  disabled={meta.page <= 1 || loading}
                  onClick={() =>
                    setMeta((prev) => ({ ...prev, page: prev.page - 1 }))
                  }
                >
                  <ChevronLeft className="h-4 w-4" />
                  Sebelumnya
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 cursor-pointer"
                  disabled={meta.page >= meta.totalPages || loading}
                  onClick={() =>
                    setMeta((prev) => ({ ...prev, page: prev.page + 1 }))
                  }
                >
                  <ChevronRight className="h-4 w-4" />
                  Selanjutnya
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal Dialog Konfirmasi Hapus */}
      <AlertDialog
        open={!!selectedDeleteId}
        onOpenChange={(open: boolean) => !open && setSelectedDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Workflow ini akan dihapus
              permanen dari sistem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white dark:bg-red-900 dark:hover:bg-red-800 cursor-pointer"
            >
              {deleting ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Menghapus...</span>
                </div>
              ) : (
                "Hapus Data"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
