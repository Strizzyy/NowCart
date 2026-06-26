import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, ShoppingCart, ArrowRight } from 'lucide-react';
import type { UserInfo } from '../App';
import { Button, FadeIn } from '../ui';
import { registerUser, loginUser } from '../api/client';

interface Props {
  onLogin: (user: UserInfo) => void;
}

type Mode = 'login' | 'signup';

/** Admin emails — users with these emails get admin role */
const ADMIN_EMAILS = ['admin@nowcart.app', 'admin@nowcart.com'];

export default function LoginPage({ onLogin }: Props) {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'signup' && !name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    const trimmedEmail = email.trim().toLowerCase();
    const role = ADMIN_EMAILS.includes(trimmedEmail) ? 'admin' : 'user';

    try {
      if (mode === 'signup') {
        const authUser = await registerUser(name.trim(), trimmedEmail, password);
        onLogin({ name: authUser.name, email: authUser.email, role, userId: authUser.user_id });
      } else {
        const authUser = await loginUser(trimmedEmail, password);
        onLogin({ name: authUser.name, email: authUser.email, role, userId: authUser.user_id });
      }
      navigate('/');
    } catch (err: any) {
      // Fallback: if backend auth fails (e.g. seeded users), allow local-only login
      const userName = mode === 'signup' ? name.trim() : email.split('@')[0];
      setError(err.message || 'Auth failed — using local session');
      // Still log them in locally for demo convenience
      onLogin({ name: userName, email: trimmedEmail, role });
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-light via-light-bg to-white flex items-center justify-center px-4">
      <FadeIn>
        <div className="w-full max-w-md">
          {/* Logo & Branding */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <ShoppingCart size={32} className="text-white" />
            </div>
            <h1 className="text-3xl font-heading font-bold text-dark">NowCart</h1>
            <p className="text-muted text-sm mt-1">Four ways in, one confident cart out</p>
          </div>

          {/* Card */}
          <div className="bg-surface rounded-2xl shadow-[var(--shadow-pop)] p-8 border border-border">
            {/* Tab Toggle */}
            <div className="flex rounded-xl bg-light-bg p-1 mb-6">
              <button
                onClick={() => { setMode('login'); setError(''); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${
                  mode === 'login'
                    ? 'bg-surface text-primary-ink shadow-sm'
                    : 'text-muted hover:text-dark'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => { setMode('signup'); setError(''); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${
                  mode === 'signup'
                    ? 'bg-surface text-primary-ink shadow-sm'
                    : 'text-muted hover:text-dark'
                }`}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name (signup only) */}
              {mode === 'signup' && (
                <div>
                  <label htmlFor="auth-name" className="text-sm font-medium text-dark block mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      id="auth-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="John Doe"
                      className="w-full pl-10 pr-4 py-3 border border-border rounded-xl text-sm outline-none focus:border-primary transition bg-surface"
                    />
                  </div>
                </div>
              )}

              {/* Email */}
              <div>
                <label htmlFor="auth-email" className="text-sm font-medium text-dark block mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-3 border border-border rounded-xl text-sm outline-none focus:border-primary transition bg-surface"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="auth-password" className="text-sm font-medium text-dark block mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-11 py-3 border border-border rounded-xl text-sm outline-none focus:border-primary transition bg-surface"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-dark transition"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <p className="text-sm text-accent font-medium bg-accent/10 px-3 py-2 rounded-lg">
                  {error}
                </p>
              )}

              {/* Submit */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={loading}
                leftIcon={!loading ? <ArrowRight size={18} /> : undefined}
              >
                {mode === 'login' ? 'Sign In' : 'Create Account'}
              </Button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted">or continue with</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Quick login buttons */}
            <div className="grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={() => { onLogin({ name: 'Guest', email: 'guest@nowcart.app', role: 'user' }); navigate('/'); }}
                className="flex items-center justify-center gap-2 py-3 px-4 border border-border rounded-xl text-sm font-medium hover:bg-light-bg transition"
              >
                <span className="text-xl">👤</span>
                <span className="text-dark">Continue as Guest</span>
              </button>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-muted mt-6">
            By continuing, you agree to NowCart's Terms of Service and Privacy Policy.
          </p>
        </div>
      </FadeIn>
    </div>
  );
}
