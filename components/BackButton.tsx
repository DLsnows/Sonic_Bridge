"use client";

import { useRouter } from "next/navigation";

export function BackButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className="w-8 h-8 flex items-center justify-center rounded-lg text-[#A0A0B0] hover:text-[#F0F0F0] hover:bg-white/5 transition-all duration-200"
      title="Go back"
      aria-label="Go back"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}
