'use client';

import { useRef, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { trpc } from '@/lib/trpc';

gsap.registerPlugin(useGSAP);

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const container = useRef<HTMLDivElement>(null);

  const register = trpc.auth.register.useMutation({
    onSuccess(data) {
      localStorage.setItem('access_token', data.accessToken);
      localStorage.setItem('refresh_token', data.refreshToken);
      router.push('/onboarding');
    },
  });

  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
    tl.from('.brand-line', { y: 24, opacity: 0, duration: 0.6, stagger: 0.1 })
      .from('.form-field', { y: 16, opacity: 0, duration: 0.45, stagger: 0.07 }, '-=0.25');
  }, { scope: container });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    register.mutate({ displayName: name, email, password });
  }

  return (
    <div ref={container} className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
      {/* Left */}
      <div
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
            Music that<br />knows you.
          </p>
          <ul className="space-y-3">
            {[
              'ML recommendations trained on your taste',
              'Import your Spotify history instantly',
              'Create and export playlists anywhere',
            ].map((text) => (
              <li key={text} className="brand-line flex items-start gap-2.5">
                <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ background: 'var(--accent)' }} />
                <span style={{ fontSize: '14px', color: 'var(--text-2)' }}>{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="brand-line flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
          <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>Free to use · No credit card required</span>
        </div>
      </div>

      {/* Right */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-[360px]">
          <div className="form-field mb-8">
            <h1 className="font-display font-bold mb-1" style={{ fontSize: '26px', color: 'var(--text)' }}>
              Create account
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-2)' }}>
              Start discovering music you actually love
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {([
              { id: 'name',     label: 'Name',     type: 'text',     value: name,     set: setName,     ph: 'Your name',       ac: 'name' },
              { id: 'email',    label: 'Email',    type: 'email',    value: email,    set: setEmail,    ph: 'you@example.com', ac: 'email' },
              { id: 'password', label: 'Password', type: 'password', value: password, set: setPassword, ph: '8+ characters',   ac: 'new-password' },
            ] as const).map(({ id, label, type, value, set, ph, ac }) => (
              <div key={id} className="form-field space-y-1.5">
                <label htmlFor={id} className="block uppercase font-medium" style={{ fontSize: '11px', color: 'var(--text-2)', letterSpacing: '0.08em' }}>
                  {label}
                </label>
                <input
                  id={id}
                  type={type}
                  required
                  autoComplete={ac}
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  placeholder={ph}
                  className="w-full rounded-lg px-4 py-3 text-sm"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)', transition: 'border-color 0.15s' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-2)')}
                />
              </div>
            ))}

            {register.error && (
              <div className="form-field rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                {register.error.message}
              </div>
            )}

            <button
              type="submit"
              disabled={register.isPending}
              className="form-field w-full rounded-lg py-3 text-sm font-semibold active:scale-[0.99] transition-transform"
              style={{ background: 'var(--accent)', color: 'var(--bg)', opacity: register.isPending ? 0.6 : 1 }}
            >
              {register.isPending ? 'Creating account…' : 'Get started'}
            </button>
          </form>

          <p className="form-field mt-6 text-center" style={{ fontSize: '13px', color: 'var(--text-2)' }}>
            Already have an account?{' '}
            <Link href="/auth/login" className="font-medium" style={{ color: 'var(--text)' }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
