"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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

interface QueueItem {
  id: string;
  requestNumber: string | null;
  version: number;
  createdAt: string;
  updatedAt: string; // waktu request masuk ke stage saat ini
  data: Record<string, unknown>;
  workflow: { id: string; name: string };
  requester: { id: string; name: string };
  currentStage: {
    id: string;
    name: string;
    actions: { code: string; label: string }[];
  };
}

interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const LIMIT = 10;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function ApprovalQueuePage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [meta, setMeta] = useState<Meta>({
    page: 1,
    limit: LIMIT,
    total: 0,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/approval?page=${page}&limit=${LIMIT}`);
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(json?.message ?? "Gagal memuat antrean approval");
        }
        if (cancelled) return;
        setQueue(json.data);
        setMeta(json.meta);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Tidak dapat terhubung ke server",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [page]);

  return (
    <div className="min-h-screen bg-muted/40 p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CheckSquare className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Approval queue
            </h1>
            <p className="text-sm text-muted-foreground">
              Permohonan yang menunggu persetujuan kamu.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Menunggu persetujuan</CardTitle>
            <CardDescription>
              {meta.total} request, diurutkan dari yang paling lama menunggu.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request</TableHead>
                    <TableHead>Workflow</TableHead>
                    <TableHead>Pemohon</TableHead>
                    <TableHead>Tahap</TableHead>
                    <TableHead>Menunggu sejak</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center">
                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span>Memuat antrean...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : queue.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="h-32 text-center text-muted-foreground"
                      >
                        <p>Tidak ada antrean approval saat ini.</p>
                        <p className="text-xs">
                          Request akan muncul di sini saat ada yang menunggu
                          persetujuanmu.
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    queue.map((item) => {
                      const title =
                        typeof item.data?.title === "string" && item.data.title
                          ? item.data.title
                          : "Tanpa judul";

                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="font-medium">{title}</div>
                            <div className="text-xs text-muted-foreground">
                              {item.requestNumber ?? "-"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {item.workflow.name}
                            </Badge>
                          </TableCell>
                          <TableCell>{item.requester.name}</TableCell>
                          <TableCell>{item.currentStage.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(item.updatedAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Link
                              href={`/requests/${item.id}`}
                              className={buttonVariants({
                                size: "sm",
                                className: "gap-2",
                              })}
                            >
                              Proses
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between pt-4 text-xs text-muted-foreground">
              <span>
                Halaman {meta.page} dari {meta.totalPages || 1}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Sebelumnya
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  disabled={page >= meta.totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Selanjutnya
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
