"use client";

import { useState } from "react";

export function ProjectIdBadge({ projectId }: { projectId: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(projectId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      title="Click to copy project ID"
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md
                 border border-[#00FF41]/10 bg-[#00FF41]/[0.03]
                 hover:bg-[#00FF41]/[0.08] hover:border-[#00FF41]/25
                 transition-all duration-200 cursor-pointer
                 focus-visible:outline-2 focus-visible:outline-[#00FF41] focus-visible:outline-offset-2"
    >
      <span className="font-['Share_Tech_Mono',monospace] text-[10px] text-[#A0A0B0] select-none">
        {copied ? (
          <span className="text-[#00FF41]">Copied!</span>
        ) : (
          <>ID: {projectId.slice(0, 8)}&hellip;</>
        )}
      </span>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 text-[#00FF41]/40"
      >
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
    </button>
  );
}
