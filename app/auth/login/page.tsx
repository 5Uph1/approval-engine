"use client";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button, Input } from "@base-ui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || data.message || "Gagal melakukan login.");
        setLoading(false);
        return;
      }

      console.log(data.user.roles[0]);

      if (data.user.roles[0] === "Admin") {
        router.push("/admin/configuration");
        router.refresh();
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setError("Terjadi kesalahan sistem. Coba lagi nanti.");
      setLoading(false);
    }
  }

  return (
    // Pembungkus ini yang membuat posisi Card pas di tengah layar
    <div className="flex min-h-screen w-full items-center justify-center bg-gray-50/50 p-4 dark:bg-gray-950">
      <Card className="w-full max-w-xl max-h-lg h-full shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-2xl font-bold">Login</CardTitle>
            <CardDescription>
              Masukkan email dan password untuk melanjutkan.
            </CardDescription>
          </div>

          {/* 1. Tombol Register di Atas Right Header */}
          <Link href="/auth/register">
            <Button className="text-sm border border-input bg-background px-3 py-1.5 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer">
              Register
            </Button>
          </Link>
        </CardHeader>

        {/* Form membungkus Content dan Footer agar tombol Submit berfungsi presisi */}
        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            {/* Tampilkan Pesan Error jika ada */}
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive font-medium text-red-500 bg-red-50 dark:bg-red-950/50">
                {error}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="employee@gmail | admin@gmail.com | manager@gmail.com | finance@gmail.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="password123"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pt-2">
            <Button
              type="submit"
              className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
              disabled={loading}
            >
              {loading ? "Memproses..." : "Masuk"}
            </Button>

            {/* 2. Link Teks Register di Bawah Tombol Masuk */}
            <p className="text-center text-sm text-muted-foreground mt-2">
              Belum punya akun?{" "}
              <Link
                href="/auth/register"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Daftar di sini
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
