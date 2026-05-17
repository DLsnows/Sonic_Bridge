"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function GenerateToken() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setLoading(true);
    const res = await fetch("/api/user/token", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setToken(data.token);
    }
    setLoading(false);
  };

  const copy = async () => {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      {token ? (
        <div className="space-y-3">
          <code className="block w-full px-3 py-2 bg-[#0A0A0F] rounded-lg text-xs text-[#00F0FF] font-mono border border-[#00F0FF]/20 break-all">
            {token}
          </code>
          <p className="text-xs text-[#FFB800]">
            Save this token now — it won&apos;t be shown again.
          </p>
          <Button variant="secondary" size="sm" onClick={copy}>
            {copied ? "Copied" : "Copy Token"}
          </Button>
        </div>
      ) : (
        <Button onClick={generate} loading={loading} variant="secondary">
          Generate API Token
        </Button>
      )}
    </div>
  );
}
