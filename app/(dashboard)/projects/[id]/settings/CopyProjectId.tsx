"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function CopyProjectId({ projectId }: { projectId: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(projectId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-3">
      <code className="flex-1 px-3 py-2 bg-[#0A0A0F] rounded-lg text-xs text-[#00FF41] font-mono border border-[#00FF41]/10">
        {projectId}
      </code>
      <Button variant="secondary" size="sm" onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
