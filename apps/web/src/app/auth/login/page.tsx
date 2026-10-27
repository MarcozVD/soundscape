'use client';

import { useRef, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { trpc } from '@/lib/trpc';

gsap.registerPlugin(useGSAP);

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const container = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  const login = trpc.auth.login.useMutation({
    onSuccess(data) {
      localStorage.setItem('access_token', data.accessToken);
      localStorage.setItem('refresh_token', data.refreshToken);
      router.push('/recommendations');
    },
  });

  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

    tl.from('.brand-line', {
      y: 24,
      opacity: 0,
      duration: 0.6,
      stagger: 0.1,
    }).from('.form-field', {
      y: 16,
      opacity: 0,
      duration: 0.45,
      stagger: 0.07,
    }, '-=0.25');
  }, { scope: container });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    login.mutate({ email, password });
  }

  return (
    <div
      ref={container}
      className="min-h-screen flex"
      style={{ background: 'var(--bg)' }}
    >
      {/* Left — branding */}
      <div
        ref={leftRef}
        className="hidden lg:flex flex-col justify-between w-[45%] p-12"
        style={{ borderRight: '1px solid var(--border)' }}
      >
        <span
          className="brand-line font-display font-bold text-sm tracking-[0.2em] uppercase"
          style={{ color: 'var(--accent)' }}
        >
          Soundscape
        </span>

        <div>
          <p
            className="brand-line font-display font-bold leading-[1.1] mb-6"
            style={{ fontSize: 'clamp(36px, 4vw, 52px)', color: 'var(--text)' }}
          >
            Your music,<br />understood.
          </p>
          <p
            className="brand-line leading-relaxed max-w-xs"
            style={{ fontSize: '14px', color: 'var(--text-2)' }}
          >
            Recommendations that actually learn from your taste — not just what's trending.
          </p>
        </div>

        <div className="brand-line flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: 'var(--accent)' }}
          />
          <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>
            Powered by collaborative filtering + content analysis
          </span>
        </div>
      </div>

      {/* Right — form */}
      <div
        ref={rightRef}
        className="flex-1 flex flex-col items-center justify-center px-6 py-12"
      >
        <div className="w-full max-w-[360px]">
          <div className="form-field mb-8">
            <h1
              className="font-display font-bold mb-1"
              style={{ fontSize: '26px', color: 'var(--text)' }}
            >
              Welcome back
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-2)' }}>
              Sign in to your account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-field space-y-1.5">
              <label
                htmlFor="email"
                style={{ fontSize: '12px', color: 'var(--text-2)', letterSpacing: '0.06em' }}
                className="block uppercase tracking-widest font-medium"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg px-4 py-3 text-sm transition-colors duration-150"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-2)',
                  color: 'var(--text)',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-2)')}
              />
            </div>

            <div className="form-field space-y-1.5">
              <label
                htmlFor="password"
                style={{ fontSize: '12px', color: 'var(--text-2)', letterSpacing: '0.06em' }}
                className="block uppercase tracking-widest font-medium"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg px-4 py-3 text-sm transition-colors duration-150"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-2)',
                  color: 'var(--text)',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-2)')}
              />
            </div>

            {login.error && (
              <div
                className="form-field rounded-lg px-4 py-3 text-sm"
                style={{
                  background: 'rgba(239,68,68,0.06)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  color: '#f87171',
                }}
              >
                {login.error.message}
              </div>
            )}

            <button
              type="submit"
              disabled={login.isPending}
              className="form-field w-full rounded-lg py-3 text-sm font-semibold transition-opacity duration-150 active:scale-[0.99]"
              style={{
                background: 'var(--accent)',
                color: 'var(--bg)',
                opacity: login.isPending ? 0.6 : 1,
                letterSpacing: '0.02em',
              }}
            >
              {login.isPending ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p
            className="form-field mt-6 text-center"
            style={{ fontSize: '13px', color: 'var(--text-2)' }}
          >
            No account?{' '}
            <Link
              href="/auth/register"
              className="font-medium transition-colors"
              style={{ color: 'var(--text)' }}
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
