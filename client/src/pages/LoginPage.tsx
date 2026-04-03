import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', remember: false });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigate('/dashboard');
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-atmospheric flex flex-col relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary-container/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-secondary-container/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <header className="fixed top-0 w-full z-50 glass-panel flex justify-between items-center px-8 py-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-[18px]">wifi</span>
          </div>
          <span className="text-xl font-bold text-primary font-headline">WowWay</span>
          <span className="text-xs text-on-surface-variant ml-1 hidden sm:block">Command Horizon</span>
        </div>
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-1.5 text-on-surface-variant hover:text-primary transition-colors text-sm font-medium px-3 py-1.5 rounded-full hover:bg-surface-container">
            <span className="material-symbols-outlined text-[18px]">help</span>
            <span>Help</span>
          </button>
          <button className="flex items-center gap-1.5 text-on-surface-variant hover:text-primary transition-colors text-sm font-medium px-3 py-1.5 rounded-full hover:bg-surface-container">
            <span className="material-symbols-outlined text-[18px]">language</span>
            <span>EN</span>
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-grow flex items-center justify-center pt-24 pb-16 px-6 z-10">
        <div className="w-full max-w-[480px]">
          {/* Card */}
          <div className="glass-panel rounded-3xl shadow-ambient p-10 md:p-12 animate-fade-in">
            {/* Header */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
                <span className="material-symbols-outlined text-primary text-3xl material-symbols-filled">lock</span>
              </div>
              <h1 className="text-3xl font-extrabold font-headline text-primary tracking-tight mb-2">Welcome Back</h1>
              <p className="text-on-surface-variant font-medium text-sm">Sign in to your WowWay agent portal</p>
            </div>

            {/* Form */}
            <form className="space-y-5" onSubmit={handleSubmit}>
              {/* Username */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-on-surface ml-1" htmlFor="username">Agent Username</label>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline group-focus-within:text-primary transition-colors text-[22px]">badge</span>
                  <input
                    id="username"
                    type="text"
                    placeholder="agent.001"
                    value={form.username}
                    onChange={e => setForm({ ...form, username: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 bg-surface-container-highest border-none rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all text-on-surface placeholder:text-outline-variant text-sm"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="block text-sm font-semibold text-on-surface" htmlFor="password">Password</label>
                  <button type="button" className="text-sm font-semibold text-secondary hover:underline">Forgot Password?</button>
                </div>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline group-focus-within:text-primary transition-colors text-[22px]">key</span>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    className="w-full pl-12 pr-12 py-4 bg-surface-container-highest border-none rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all text-on-surface placeholder:text-outline-variant text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-colors"
                  >
                    <span className="material-symbols-outlined text-[22px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center gap-3 ml-1">
                <input
                  id="remember"
                  type="checkbox"
                  checked={form.remember}
                  onChange={e => setForm({ ...form, remember: e.target.checked })}
                  className="w-5 h-5 rounded accent-primary"
                />
                <label htmlFor="remember" className="text-sm font-medium text-on-surface-variant">Remember me for 30 days</label>
              </div>

              {/* Submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 px-6 gradient-primary text-white font-bold rounded-full shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 font-headline disabled:opacity-70"
                >
                  {loading ? (
                    <>
                      <span className="material-symbols-outlined text-xl animate-spin">progress_activity</span>
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to Portal</span>
                      <span className="material-symbols-outlined text-xl">arrow_forward</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Secure Badge */}
            <div className="mt-8 flex items-center justify-center gap-2 py-2.5 px-4 bg-tertiary/5 rounded-full">
              <span className="material-symbols-outlined text-tertiary text-sm material-symbols-filled">verified_user</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-on-tertiary-fixed-variant font-label">Secure 256-bit Encrypted Session</span>
            </div>
          </div>

          {/* Bento sub-cards */}
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="bg-surface-container-low rounded-2xl p-4 flex flex-col gap-1">
              <span className="material-symbols-outlined text-primary text-2xl">insights</span>
              <p className="text-xs font-bold text-primary font-headline">Real-time Intelligence</p>
              <p className="text-[11px] text-on-surface-variant">Live call transcription and AI-driven sentiment analysis.</p>
            </div>
            <div className="bg-surface-container-low rounded-2xl p-4 flex flex-col gap-1">
              <span className="material-symbols-outlined text-secondary text-2xl">psychology</span>
              <p className="text-xs font-bold text-primary font-headline">Smart Assistance</p>
              <p className="text-[11px] text-on-surface-variant">AI knowledge base suggestions delivered in real time.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 w-full flex justify-center gap-6 pb-6 opacity-70 hover:opacity-100 transition-opacity z-10">
        <span className="text-xs text-on-surface-variant">© 2024 WowWay. All rights reserved.</span>
        <a href="#" className="text-xs text-on-surface-variant hover:text-primary underline">Privacy</a>
        <a href="#" className="text-xs text-on-surface-variant hover:text-primary underline">Terms</a>
        <a href="#" className="text-xs text-on-surface-variant hover:text-primary underline">Support</a>
      </footer>
    </div>
  );
}
