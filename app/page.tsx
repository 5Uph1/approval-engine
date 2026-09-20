"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (cancelled) return;
        router.replace(res.ok ? "/dashboard" : "/auth/login");
      } catch {
        if (!cancelled) router.replace("/auth/login");
      }
    }

    checkAuth();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center gap-2 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span>Memuat...</span>
    </div>
  );
}
