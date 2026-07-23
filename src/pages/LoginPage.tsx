import { useState } from 'react';
import { Hexagon, Mail, Lock, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../lib/auth';

export function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) setError(error);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-ink-50 via-white to-brand-50/30 px-4">
      <div className="w-full max-w-[400px]">
        <div className="flex flex-col items-center mb-8 animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-brand-600 flex items-center justify-center text-white shadow-pop mb-4">
            <Hexagon size={30} strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-semibold text-ink-900 tracking-tight">Mansoura Robotics</h1>
          <p className="text-sm text-ink-500 mt-1">Team Management Portal</p>
        </div>

        <div className="card p-6 shadow-card animate-slide-up">
          <h2 className="text-lg font-semibold text-ink-900 mb-1">Sign in</h2>
          <p className="text-sm text-ink-500 mb-5">Enter your credentials to access your workspace.</p>

          {error && (
            <div className="flex items-center gap-2 px-3 h-10 rounded-xl bg-red-50 border border-red-200 text-sm text-brand-700 mb-4 animate-fade-in">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-ink-600 mb-1.5 block">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@nexus.edu"
                  required
                  autoFocus
                  className="input !pl-10"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-ink-600 mb-1.5 block">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="input !pl-10"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary btn-md w-full justify-center group"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  Sign in
                  <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-ink-100">
            <p className="text-xs text-ink-400 text-center leading-relaxed">
              Default admin: <span className="font-medium text-ink-600">admin@nexus.edu</span> / <span className="font-medium text-ink-600">nexus2026</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
