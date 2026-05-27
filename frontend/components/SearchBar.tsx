'use client';
import { useState, useEffect, useRef } from 'react';

const PLACEHOLDERS = ['torvalds', 'gvanrossum', 'addyosmani', 'sindresorhus', 'tj', 'yyx990803', 'nicolo-ribaudo'];

interface SearchBarProps {
  onSearch: (username: string) => void;
}

export default function SearchBar({ onSearch }: SearchBarProps) {
  const [value, setValue] = useState('');
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Cycle placeholder
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % PLACEHOLDERS.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || isSubmitting) return;
    setIsSubmitting(true);
    onSearch(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl">
      <div className="relative flex items-center border border-white/10 rounded-sm bg-[#111] transition-all hover:border-white/15">
        <span className="absolute left-4 text-[#444] select-none font-mono">@</span>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={PLACEHOLDERS[placeholderIdx]}
          maxLength={39}
          className="flex-1 bg-transparent pl-8 pr-4 py-4 font-mono text-lg text-[#f0ece3] placeholder:text-[#2a2a2a] outline-none"
        />
        <button
          type="submit"
          disabled={isSubmitting || !value.trim()}
          className="m-1.5 px-5 py-2.5 bg-amber-400 text-black font-mono text-sm rounded-sm hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
        >
          {isSubmitting ? (
            <span className="inline-flex items-center gap-2">
              <span className="w-3 h-3 border border-black border-t-transparent rounded-full animate-spin" />
              Scanning
            </span>
          ) : 'Analyze →'}
        </button>
      </div>
    </form>
  );
}
