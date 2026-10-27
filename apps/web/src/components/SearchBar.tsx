'use client';

import { useEffect, useRef, useState } from 'react';
import { trpc } from '@/lib/trpc';

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder }: SearchBarProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { data: suggestions } = trpc.search.suggestions.useQuery(
    { prefix: value },
    { enabled: value.length > 1 }
  );
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative max-w-xl">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        placeholder={placeholder}
        className="w-full bg-neutral-800 rounded-full px-5 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500"
      />
      {showSuggestions && suggestions && suggestions.length > 0 && (
        <ul className="absolute top-full mt-2 w-full bg-neutral-900 rounded-xl shadow-xl z-10 overflow-hidden">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                onMouseDown={() => onChange(s.text)}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-neutral-800 transition-colors"
              >
                {s.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
