"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Supabase fires an auth state change with event "PASSWORD_RECOVERY"
  // when the user arrives via a reset link. Wait for that before showing the form.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });

    // Also check if there's already an active recovery session (page reload)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen bg-snow flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="font-sans text-4xl font-black tracking-tight text-ink">
            dinner<span className="text-citrus-dark">club</span>
          </h1>
          <p className="text-ink-muted text-sm mt-2">Set a new password</p>
        </div>

        {!ready ? (
          <div className="text-center text-ink-muted text-sm">Verifying your reset link…</div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full py-3 px-4 border border-slate/20 rounded-xl text-ink placeholder-ink-faint focus:outline-none focus:border-slate bg-surface"
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="w-full py-3 px-4 border border-slate/20 rounded-xl text-ink placeholder-ink-faint focus:outline-none focus:border-slate bg-surface"
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-slate text-white font-bold rounded-xl hover:bg-slate-light transition-colors disabled:opacity-50"
            >
              {loading ? "Saving…" : "Set new password →"}
            </button>
          </form>
        )}

        <p className="text-center mt-6">
          <a href="/auth/login" className="text-ink-muted text-sm hover:text-ink transition-colors">
            Back to log in
          </a>
        </p>
      </div>
    </main>
  );
}
