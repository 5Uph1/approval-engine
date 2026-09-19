"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  Eye,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
} from "lucide-react";

interface RequestItem {
  id: string;
  requestNumber: string;
  status:
    | "Draft"
    | "Submitted"
    | "WaitingApproval"
    | "Approved"
    | "Rejected"
    | "Completed";
  data: { title?: string };
  createdAt: string;
  workflow: { name: string };
  currentStage: { name: string };
}

export default function MyRequestsPage() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetch("/api/requests/me")
      .then((res) => res.json())
      .then((data) => setRequests(data))
      .finally(() => setLoading(false));
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Approved":
      case "Completed":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Approved
          </span>
        );
      case "Rejected":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
            <XCircle className="h-3.5 w-3.5" /> Rejected
          </span>
        );
      case "WaitingApproval":
      case "Submitted":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
            <Clock className="h-3.5 w-3.5" /> Waiting Approval
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            <FileText className="h-3.5 w-3.5" /> Draft
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My Requests</h1>
            <p className="text-sm text-slate-500">
              Daftar permohonan yang telah kamu buat.
            </p>
          </div>
          <Link
            href="/requests/new"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> Buat Request Baru
          </Link>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-6 py-4">Judul & Workflow</th>
                <th className="px-6 py-4">Stage Saat Ini</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Tanggal</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-slate-900">
                      {item.data?.title || "Tanpa Judul"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {item.workflow?.name}
                    </p>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-700">
                    {item.currentStage?.name}
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(item.status)}</td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    {new Date(item.createdAt).toLocaleDateString("id-ID")}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/requests/${item.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      <Eye className="h-3.5 w-3.5" /> Detail
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
