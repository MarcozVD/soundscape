'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import {
  EqIcon, CompassIcon, SearchIcon, ListMusicIcon,
  PersonIcon, LinkIcon, BarChartIcon,
} from './Icons';

gsap.registerPlugin(useGSAP);

const NAV = [
  { href: '/recommendations', label: 'For You',     Icon: EqIcon },
  { href: '/discover',        label: 'Discover',     Icon: CompassIcon },
  { href: '/explore',         label: 'Explore',      Icon: SearchIcon },
  { href: '/playlists',       label: 'Playlists',    Icon: ListMusicIcon },
];

const BOTTOM = [
  { href: '/profile',              label: 'Profile',     Icon: PersonIcon },
  { href: '/settings/connections', label: 'Connections', Icon: LinkIcon },
  { href: '/admin/analytics',      label: 'Analytics',   Icon: BarChartIcon },
];

function logout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('onboarding_complete');
  sessionStorage.clear();
  window.location.href = '/auth/login';
}

export function Sidebar() {
  const pathname = usePathname();
  const container = useRef<HTMLElement>(null);

  useGSAP(() => {
    gsap.from('.nav-item', {
      x: -12,
      opacity: 0,
      duration: 0.35,
      stagger: 0.055,
      ease: 'power2.out',
      delay: 0.1,
    });
    gsap.from('.sidebar-logo', {
      opacity: 0,
      duration: 0.4,
      ease: 'power2.out',
    });
  }, { scope: container });

  return (
    <nav
      ref={container}
      style={{ borderRight: '1px solid var(--border)' }}
      className="w-[220px] shrink-0 flex flex-col h-screen py-5 px-3 bg-[var(--bg)]"
    >
      {/* Logo */}
      <Link
        href="/"
        className="sidebar-logo flex items-center gap-2.5 px-3 mb-8 group"
      >
        <span
          className="font-display font-bold text-[15px] tracking-[0.18em] uppercase"
          style={{ color: 'var(--text)' }}
        >
          Soundscape
        </span>
      </Link>

      {/* Main nav */}
      <div className="flex flex-col gap-0.5">
        {NAV.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="nav-item relative flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors duration-150 group"
              style={{
                color: active ? 'var(--text)' : 'var(--text-2)',
                background: active ? 'var(--surface-2)' : 'transparent',
              }}
            >
              {active && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-full"
                  style={{ background: 'var(--accent)' }}
                />
              )}
              <span
                className="transition-colors duration-150"
                style={{ color: active ? 'var(--accent)' : undefined }}
              >
                <Icon />
              </span>
              <span
                className="font-medium"
                style={{ fontSize: '13px', letterSpacing: '0.01em' }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Bottom nav */}
      <div
        className="mt-auto flex flex-col gap-0.5 pt-4"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        {BOTTOM.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="nav-item relative flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors duration-150"
              style={{
                color: active ? 'var(--text)' : 'var(--text-2)',
                background: active ? 'var(--surface-2)' : 'transparent',
              }}
            >
              {active && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-full"
                  style={{ background: 'var(--accent)' }}
                />
              )}
              <span style={{ color: active ? 'var(--accent)' : undefined }}>
                <Icon />
              </span>
              <span style={{ fontSize: '13px', letterSpacing: '0.01em' }} className="font-medium">
                {label}
              </span>
            </Link>
          );
        })}

        <button
          onClick={logout}
          className="nav-item flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors duration-150 w-full text-left"
          style={{ color: 'var(--text-3)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-3)')}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 2H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3M9 10l3-3-3-3M12 7H5"/>
          </svg>
          <span style={{ fontSize: '13px', letterSpacing: '0.01em' }} className="font-medium">
            Log out
          </span>
        </button>
      </div>
    </nav>
  );
}
