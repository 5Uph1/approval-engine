"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Clock,
  CheckCircle2,
  Inbox,
  Plus,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

type RequestStatus =
  | "Draft"
  | "Submitted"
  | "WaitingApproval"
  | "Approved"
  | "Rejected"
  | "Completed";

type MyRequestItem = {
  id: string;
  requestNumber: string | null;
  status: RequestStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  workflow: { id: string; name: string };
  currentStage: { id: string; name: string } | null;
};

type ApprovalQueueItem = {
  id: string;
  requestNumber: string | null;
  status: RequestStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  workflow: { id: string; name: string };
  requester: { id: string; name: string };
  currentStage: {
    id: string;
    name: string;
    action: { code: string; label: string }[];
  } | null;
};

type TabKey = "myRequests" | "approvalQueue";

const STATUS_STYLES: Record<RequestStatus, string> = {
  Draft: "bg-slate-100 text-slate-600",
  Submitted: "bg-blue-100 text-blue-700",
  WaitingApproval: "bg-amber-100 text-amber-700",
  Approved: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-red-100 text-red-700",
  Completed: "bg-indigo-100 text-indigo-700",
};

export default function DashboardPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabKey>("myRequests");

  const [myRequests, setMyRequests] = useState<MyRequestItem[]>([]);
  const [myRequestsTotal, setMyRequestsTotal] = useState(0);

  const [approvalQueue, setApprovalQueue] = useState<ApprovalQueueItem[]>([]);
  const [approvalTotal, setApprovalTotal] = useState(0);

  const [approvedTotal, setApprovedTotal] = useState(0);

  const [roles, setRoles] = useState<string[]>([]);
  // Employee-only user tidak pernah jadi approver, jadi bagian approval disembunyikan
  const isEmployeeOnly =
    roles.length > 0 && roles.every((r) => r === "Employee");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const meRes = await fetch("/api/auth/me");
      const meData = meRes.ok ? await meRes.json() : null;
      const currentRoles: string[] = meData?.roles ?? [];
      setRoles(currentRoles);

      const employeeOnly =
        currentRoles.length > 0 && currentRoles.every((r) => r === "Employee");

      const [myRes, approvalRes, approvedRes] = await Promise.all([
        fetch("/api/request?limit=20"),
        // Employee-only tidak perlu fetch approval queue sama sekali
        employeeOnly ? Promise.resolve(null) : fetch("/api/approval?limit=20"),
        fetch("/api/request?status=Approved&limit=1"),
      ]);

      if (!myRes.ok) throw new Error("Gagal memuat request saya");
      if (approvalRes && !approvalRes.ok)
        throw new Error("Gagal memuat approval queue");

      const myData = await myRes.json();
      const approvalData = approvalRes ? await approvalRes.json() : null;
      const approvedData = approvedRes.ok ? await approvedRes.json() : null;

      setMyRequests(myData.data ?? []);
      setMyRequestsTotal(myData.meta?.total ?? myData.data?.length ?? 0);

      setApprovalQueue(approvalData?.data ?? []);
      setApprovalTotal(
        approvalData?.meta?.total ?? approvalData?.data?.length ?? 0,
      );

      setApprovedTotal(approvedData?.meta?.total ?? 0);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Tidak dapat memuat dashboard",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Logout gagal");
      }

      router.push("/auth/login");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    if (isEmployeeOnly && activeTab === "approvalQueue") {
      setActiveTab("myRequests");
    }
  }, [isEmployeeOnly, activeTab]);

  const handleCreateRequest = () => {
    router.push("/dashboard/request/new");
  };

  const handleOpenRequest = (id: string) => {
    router.push(`/dashboard/${id}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-sm text-slate-500">
              Ringkasan request dan approval Anda.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={handleCreateRequest} className="gap-2">
              <Plus className="h-4 w-4" />
              Buat Request
            </Button>

            <Button onClick={handleLogout} variant="outline" className="gap-2">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription className="flex items-center justify-between gap-4">
              <span>{error}</span>
              <Button size="sm" variant="outline" onClick={fetchDashboard}>
                Coba lagi
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <SummaryCard
            icon={<FileText className="h-5 w-5 text-indigo-600" />}
            label="Request Saya"
            value={myRequestsTotal}
            loading={loading}
          />
          {!isEmployeeOnly && (
            <SummaryCard
              icon={<Clock className="h-5 w-5 text-amber-600" />}
              label="Menunggu Approval Saya"
              value={approvalTotal}
              loading={loading}
              highlight
            />
          )}
          <SummaryCard
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
            label="Disetujui"
            value={approvedTotal}
            loading={loading}
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200">
          <TabButton
            active={activeTab === "myRequests"}
            onClick={() => setActiveTab("myRequests")}
            count={myRequests.length}
          >
            Request Saya
          </TabButton>
          {!isEmployeeOnly && (
            <TabButton
              active={activeTab === "approvalQueue"}
              onClick={() => setActiveTab("approvalQueue")}
              count={approvalQueue.length}
            >
              Menunggu Approval Saya
            </TabButton>
          )}
        </div>

        {/* List */}
        <div className="space-y-3">
          {loading && (
            <div className="py-10 text-center text-sm text-slate-400">
              Memuat data...
            </div>
          )}

          {!loading &&
            activeTab === "myRequests" &&
            myRequests.length === 0 && (
              <EmptyState text="Anda belum membuat request apapun." />
            )}
          {!loading &&
            activeTab === "approvalQueue" &&
            approvalQueue.length === 0 && (
              <EmptyState text="Tidak ada request yang menunggu approval Anda." />
            )}

          {!loading &&
            activeTab === "myRequests" &&
            myRequests.map((req) => (
              <Card
                key={req.id}
                className="cursor-pointer transition hover:border-indigo-300 hover:shadow-sm"
                onClick={() => handleOpenRequest(req.id)}
              >
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-indigo-600">
                        {req.workflow?.name}
                      </span>
                      {req.requestNumber && (
                        <span className="text-xs text-slate-400">
                          #{req.requestNumber}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {req.requestNumber ?? "(Draft, belum diajukan)"}
                    </p>
                    {req.currentStage && (
                      <p className="mt-1 text-xs text-slate-400">
                        Stage: {req.currentStage.name}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLES[req.status]}`}
                    >
                      {req.status}
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  </div>
                </CardContent>
              </Card>
            ))}

          {!loading &&
            activeTab === "approvalQueue" &&
            approvalQueue.map((req) => (
              <Card
                key={req.id}
                className="cursor-pointer transition hover:border-indigo-300 hover:shadow-sm"
                onClick={() => handleOpenRequest(req.id)}
              >
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-indigo-600">
                        {req.workflow?.name}
                      </span>
                      {req.requestNumber && (
                        <span className="text-xs text-slate-400">
                          #{req.requestNumber}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                      <span>Pemohon: {req.requester?.name}</span>
                      {req.currentStage && (
                        <span>Stage: {req.currentStage.name}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLES[req.status]}`}
                    >
                      {req.status}
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-400">
      {text}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  loading,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  loading: boolean;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-amber-300 bg-amber-50/40" : ""}>
      <CardContent className="flex items-center gap-3 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-xl font-bold text-slate-900">
            {loading ? "-" : value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function TabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative -mb-px flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium transition ${
        active
          ? "border-indigo-600 text-indigo-600"
          : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
          active
            ? "bg-indigo-100 text-indigo-600"
            : "bg-slate-100 text-slate-500"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
