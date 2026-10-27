'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

export default function Home() {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    tl.from('.hero-label', { y: 12, opacity: 0, duration: 0.5 })
      .from('.hero-title', { y: 32, opacity: 0, duration: 0.7, stagger: 0.08 }, '-=0.2')
      .from('.hero-sub', { y: 16, opacity: 0, duration: 0.5 }, '-=0.3')
      .from('.hero-cta', { y: 12, opacity: 0, duration: 0.45, stagger: 0.07 }, '-=0.2')
      .from('.hero-footer', { opacity: 0, duration: 0.4 }, '-=0.1');
  }, { scope: container });

  return (
    <div
      ref={container}
      className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden"
      style={{ background: 'var(--bg)' }}
    >
      {/* Subtle radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 60%, rgba(200,255,87,0.04) 0%, transparent 70%)',
        }}
      />

      {/* Horizontal rule top */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, var(--border), transparent)' }}
      />

      {/* Content */}
      <div className="relative z-10 text-center max-w-[640px]">
        <p
          className="hero-label inline-flex items-center gap-2 mb-8 px-3 py-1.5 rounded-full font-medium"
          style={{
            fontSize: '11px',
            letterSpacing: '0.1em',
            color: 'var(--accent)',
            background: 'var(--accent-dim)',
            border: '1px solid rgba(200,255,87,0.15)',
            textTransform: 'uppercase',
          }}
        >
          <span className="w-1 h-1 rounded-full bg-current" />
          Music Recommendations
        </p>

        <h1 className="font-display font-bold leading-[1.05] mb-6" style={{ fontSize: 'clamp(44px, 7vw, 80px)' }}>
          <span className="hero-title block" style={{ color: 'var(--text)' }}>Your music,</span>
          <span className="hero-title block" style={{ color: 'var(--text-2)' }}>understood.</span>
        </h1>

        <p
          className="hero-sub mx-auto mb-10 leading-relaxed"
          style={{ fontSize: '16px', color: 'var(--text-2)', maxWidth: '400px' }}
        >
          Recommendations that actually learn from what you listen to — not just what's popular.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/auth/register"
            className="hero-cta px-7 py-3 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 active:scale-[0.98]"
            style={{ background: 'var(--accent)', color: 'var(--bg)', letterSpacing: '0.02em' }}
          >
            Get started free
          </Link>
          <Link
            href="/auth/login"
            className="hero-cta px-7 py-3 rounded-lg text-sm font-medium transition-colors"
            style={{
              border: '1px solid var(--border-2)',
              color: 'var(--text-2)',
            }}
          >
            Sign in
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div
        className="hero-footer absolute bottom-6 left-0 right-0 flex justify-center"
        style={{ fontSize: '12px', color: 'var(--text-3)' }}
      >
        Import your Spotify history · Collaborative filtering · 30s previews
      </div>

      {/* Horizontal rule bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, var(--border), transparent)' }}
      />
    </div>
  );
}
