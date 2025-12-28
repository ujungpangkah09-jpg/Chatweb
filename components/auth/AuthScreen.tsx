"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Mail, Lock, User, Eye, EyeOff } from "lucide-react";

type Mode = "login" | "register";

export default function AuthScreen({ initialMode }: { initialMode?: Mode }) {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>(initialMode ?? "login");
  const isLogin = mode === "login";

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const usernameOk = useMemo(() => {
    if (isLogin) return true;
    const v = username.trim().toLowerCase();
    return /^[a-z0-9_]{3,20}$/.test(v);
  }, [username, isLogin]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const eMail = email.trim();
    const pass = password;

    if (!eMail || !pass) {
      setErr("Email dan password wajib diisi.");
      return;
    }

    if (!isLogin) {
      if (!username.trim()) {
        setErr("Username wajib diisi.");
        return;
      }
      if (!usernameOk) {
        setErr("Username harus 3-20 karakter (huruf kecil/angka/underscore).");
        return;
      }
    }

    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: eMail,
          password: pass,
        });
        if (error) throw error;

        setToast("Berhasil masuk!");
        router.replace("/chat");
        return;
      }

      // REGISTER
    // Keep the username as user typed it (for display). You can enforce
    // lowercasing server-side if you need strict uniqueness.
    const uname = username.trim();

      const res = await supabase.auth.signUp({
        email: eMail,
        password: pass,
        options: {
          data: {
            username: uname, // <-- penting: dipakai trigger handle_new_user()
          },
        },
      });

      if (res.error) throw res.error;

      // Kalau email confirmation ON, session bisa null
      if (!res.data.session) {
        setToast("Daftar berhasil. Silakan cek email untuk verifikasi, lalu login.");
        router.replace("/auth/login");
        return;
      }

      // Kalau auto-login aktif
      setToast("Daftar berhasil!");
      router.replace("/chat");
    } catch (e: any) {
      setErr(e?.message ?? "Terjadi error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] px-4">
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 rounded-xl bg-black text-white px-4 py-3 text-sm shadow-xl">
          {toast}
        </div>
      )}

      <div className="w-full max-w-[450px] bg-white rounded-3xl shadow-2xl border border-gray-100 p-8 md:p-10">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#41525d]">
            {isLogin ? "Login" : "Daftar"}
          </h1>
          <p className="text-sm text-[#667781] mt-1">
            {isLogin ? "Masuk untuk lanjut chat." : "Buat akun baru untuk mulai chat."}
          </p>
        </div>

        {err && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-100 text-red-700 px-4 py-3 text-sm">
            {err}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="text-xs font-semibold text-[#667781]">Email</label>
            <div className="mt-2 relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className="w-full rounded-xl border border-gray-200 pl-10 pr-3 py-3 text-sm outline-none focus:border-[#00a884] focus:ring-4 focus:ring-[#00a884]/15 transition"
                placeholder="email@contoh.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
          </div>

          {/* Username (register only) */}
          {!isLogin && (
            <div>
              <label className="text-xs font-semibold text-[#667781]">Username</label>
              <div className="mt-2 relative">
                <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  className={`w-full rounded-xl border pl-10 pr-3 py-3 text-sm outline-none transition ${
                    username.length > 0 && !usernameOk
                      ? "border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-200"
                      : "border-gray-200 focus:border-[#00a884] focus:ring-4 focus:ring-[#00a884]/15"
                  }`}
                  placeholder="misal: apip"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                3-20 karakter, huruf kecil/angka/underscore
              </p>
            </div>
          )}

          {/* Password */}
          <div>
            <label className="text-xs font-semibold text-[#667781]">Password</label>
            <div className="mt-2 relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className="w-full rounded-xl border border-gray-200 pl-10 pr-10 py-3 text-sm outline-none focus:border-[#00a884] focus:ring-4 focus:ring-[#00a884]/15 transition"
                placeholder="••••••••"
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isLogin ? "current-password" : "new-password"}
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                title="Toggle password"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            disabled={loading}
            className="w-full bg-[#00a884] text-white rounded-xl py-3 font-semibold hover:brightness-110 active:scale-95 transition disabled:opacity-70 disabled:active:scale-100"
          >
            {loading ? (isLogin ? "Masuk..." : "Daftar...") : isLogin ? "Masuk" : "Daftar"}
          </button>
        </form>

        <div className="mt-6 text-sm text-[#667781] flex items-center justify-center gap-2">
          {isLogin ? "Belum punya akun?" : "Sudah punya akun?"}
          <button
            className="text-[#00a884] font-semibold hover:underline"
            onClick={() => setMode(isLogin ? "register" : "login")}
            type="button"
          >
            {isLogin ? "Daftar" : "Masuk"}
          </button>
        </div>
      </div>
    </div>
  );
}
