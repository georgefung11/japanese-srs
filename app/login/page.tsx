"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/study");
      router.refresh();
    }
  };

  const handleSignUp = async () => {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      setError("Check your email for confirmation!");
    }
    setLoading(false);
  };

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-md p-8 bg-slate-800 border border-slate-700 rounded-xl shadow-xl">
        <h2 className="text-2xl font-bold mb-6 text-center text-emerald-400">
          Sign In to Japanese SRS
        </h2>
        {error && (
          <div className="mb-4 p-3 bg-red-950/80 border border-red-800 text-red-200 text-sm rounded">
            {error}
          </div>
        )}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 font-semibold rounded transition disabled:opacity-50"
          >
            {loading ? "Processing..." : "Sign In"}
          </button>
        </form>
        <button
          onClick={handleSignUp}
          disabled={loading}
          className="w-full mt-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded transition"
        >
          Create New Account
        </button>
      </div>
    </main>
  );
}
