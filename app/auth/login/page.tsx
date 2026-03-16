"use client";

import { createClient } from "@/lib/supabase/client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(searchParams.get("signup") === "1");
  const [loading, setLoading] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const next = searchParams.get("next") ?? "/dashboard";

  const urlError = searchParams.get("error");
  const ERROR_MESSAGES: Record<string, string> = {
    auth_failed: "Authentication failed. Please try again.",
    invite_expired: "That invite link has expired. Ask for a new one.",
  };

  const [error, setError] = useState<string | null>(
    urlError ? (ERROR_MESSAGES[urlError] ?? "Something went wrong. Please try again.") : null
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const callbackUrl = new URL(`${window.location.origin}/auth/callback`);
    if (next !== "/dashboard") callbackUrl.searchParams.set("next", next);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl.toString() },
    });
    if (error) setError(error.message);
    setLoading(false);
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) setError(error.message);
      else setSuccessMessage("Check your email to confirm your account.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else router.push(next);
    }

    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-snow flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="font-sans text-4xl font-black tracking-tight text-ink">
            dinner<span className="text-citrus-dark">club</span>
          </h1>
          <p className="text-ink-muted text-sm mt-2">
            {isSignUp ? "Create your account" : "Welcome back"}
          </p>
        </div>

        {/* Social auth */}
        <div className="flex flex-col gap-3 mb-6">
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="flex items-center justify-center gap-3 w-full py-3 px-4 bg-white border border-black/10 rounded-xl font-semibold text-ink hover:border-black/25 hover:shadow-sm transition-all disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-3.59-13.46-8.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Continue with Google
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-black/10" />
          <span className="text-ink-faint text-xs uppercase tracking-widest">or</span>
          <div className="flex-1 h-px bg-black/10" />
        </div>

        {/* Email toggle */}
        {!showEmail ? (
          <button
            onClick={() => setShowEmail(true)}
            className="w-full py-3 px-4 border border-slate/20 rounded-xl font-semibold text-ink hover:border-slate transition-colors"
          >
            Continue with Email
          </button>
        ) : (
          <form onSubmit={handleEmailAuth} className="flex flex-col gap-3">
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full py-3 px-4 border border-slate/20 rounded-xl text-ink placeholder-ink-faint focus:outline-none focus:border-slate bg-surface"
            />
            <input
              type="password"
              placeholder={isSignUp ? "Create a password" : "Password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full py-3 px-4 border border-slate/20 rounded-xl text-ink placeholder-ink-faint focus:outline-none focus:border-slate bg-surface"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-slate text-white font-bold rounded-xl hover:bg-slate-light transition-colors disabled:opacity-50"
            >
              {loading ? "..." : isSignUp ? "Create Account →" : "Log In →"}
            </button>
          </form>
        )}

        {/* Feedback */}
        {error && (
          <p className="text-red-500 text-sm text-center mt-4">{error}</p>
        )}
        {successMessage && (
          <p className="text-green-600 text-sm text-center mt-4">{successMessage}</p>
        )}

        {/* Switch mode */}
        <p className="text-center text-ink-muted text-sm mt-6">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-citrus-dark font-semibold"
          >
            {isSignUp ? "Log in" : "Sign up free"}
          </button>
        </p>

        {/* Terms */}
        <p className="text-center text-ink-faint text-xs mt-4 leading-relaxed">
          By continuing you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
