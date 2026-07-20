import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Mail, Lock, Eye, EyeOff, Loader2, MessageSquare } from "lucide-react";
import { logLogin } from "@/lib/audit";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !password) { setError("Please enter your email and password."); return; }
    setLoading(true);
    try {
      await base44.auth.login(email, password);
      await logLogin(email, "success");
      window.location.href = "/";
    } catch (err) {
      await logLogin(email, "failed", err.message || "Invalid credentials");
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="kp-wave-bg min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="kp-panel rounded-2xl shadow-2xl p-7 sm:p-9">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[hsl(var(--kp-teal))] flex items-center justify-center shadow-md">
              <MessageSquare className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-[10px] text-[hsl(var(--kp-teal))] uppercase tracking-wider leading-none mb-1">School</div>
              <div className="text-[hsl(var(--kp-teal))] font-bold text-base leading-none">Keeppeer</div>
            </div>
          </div>

          <h1 className="text-xl font-bold text-[hsl(var(--kp-teal))]">Welcome to Keeppeer</h1>
          <p className="text-sm text-gray-500 mt-1.5 mb-6 leading-relaxed">
            Designed to simplify and streamline daily school operations. Sign in to your account and continue managing your school with ease.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1.5 block">Email or Username</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15 focus:border-[hsl(var(--kp-teal))]"
                  placeholder="Enter email or username"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600 mb-1.5 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15 focus:border-[hsl(var(--kp-teal))]"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-[hsl(var(--kp-teal))] focus:ring-[hsl(var(--kp-teal))]" />
                Remember me
              </label>
              <Link to="/forgot-password" className="text-sm text-[hsl(var(--kp-teal))] font-medium hover:underline">Forgot password?</Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-full bg-[hsl(var(--kp-teal))] text-white font-semibold hover:bg-[hsl(var(--kp-teal-dark))] disabled:opacity-60 transition-colors shadow-md"
            >
              {loading ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Logging in...</span> : "Log in"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Don't have an account? <Link to="/register" className="text-[hsl(var(--kp-teal))] font-medium hover:underline">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}