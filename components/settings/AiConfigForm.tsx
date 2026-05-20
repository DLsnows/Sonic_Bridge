"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";


interface AiConfigData {
  configured: boolean;
  apiUrl?: string;
  model?: string;
  hasKey?: boolean;
}

export function AiConfigForm({ projectId }: { projectId: string }) {
  const [config, setConfig] = useState<AiConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/ai-config`);
        if (!ignore && res.ok) {
          const data = await res.json();
          setConfig(data);
          if (data.configured) {
            setApiUrl(data.apiUrl || "");
            setModel(data.model || "gpt-4o-mini");
            setApiKey("");
          }
        }
      } catch {
        // silently fail on load
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [projectId]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const body: Record<string, string> = { apiUrl, model };
      if (apiKey) body.apiKey = apiKey;
      const res = await fetch(`/api/projects/${projectId}/ai-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save");
      }
      const data = await res.json();
      setConfig(data);
      setApiKey("");
      setSuccess("AI configuration saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!confirm("Remove AI formatting configuration for this project?")) return;
    setClearing(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/ai-config`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to clear");
      }
      setConfig({ configured: false });
      setApiUrl("");
      setApiKey("");
      setModel("gpt-4o-mini");
      setSuccess("AI configuration removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear");
    } finally {
      setClearing(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-[#A0A0B0]">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${
            config?.configured ? "bg-[#00FF41]" : "bg-[#FF8C00]"
          }`}
        />
        <span className="text-sm text-[#D0D0D0]">
          {config?.configured ? "Configured" : "Not configured"}
        </span>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-[#A0A0B0] mb-1">API URL</label>
          <input
            type="text"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="https://api.openai.com/v1/chat/completions"
            className="w-full bg-[#09090B] border border-[#FF8C00]/10 rounded px-3 py-2 text-sm text-[#F0F0F0] placeholder:text-[#A0A0B0]/40 focus:outline-none focus:border-[#FF8C00]/40"
          />
        </div>

        <div>
          <label className="block text-xs text-[#A0A0B0] mb-1">API Key</label>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={config?.hasKey ? "Leave blank to keep existing key" : "Enter API key"}
              className="w-full bg-[#09090B] border border-[#FF8C00]/10 rounded px-3 py-2 pr-16 text-sm text-[#F0F0F0] placeholder:text-[#A0A0B0]/40 focus:outline-none focus:border-[#FF8C00]/40"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#A0A0B0] hover:text-[#F0F0F0]"
            >
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs text-[#A0A0B0] mb-1">Model</label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="gpt-4o-mini"
            className="w-full bg-[#09090B] border border-[#FF8C00]/10 rounded px-3 py-2 text-sm text-[#F0F0F0] placeholder:text-[#A0A0B0]/40 focus:outline-none focus:border-[#FF8C00]/40"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          loading={saving}
          onClick={handleSave}
        >
          Save
        </Button>
        {config?.configured && (
          <Button
            variant="ghost"
            size="sm"
            loading={clearing}
            onClick={handleClear}
            className="hover:text-[#FF4444]"
          >
            Clear
          </Button>
        )}
      </div>

      {error && (
        <div className="p-2 rounded bg-[#FF4444]/10 border border-[#FF4444]/30 text-xs text-[#FF4444]">
          {error}
        </div>
      )}

      {success && (
        <div className="p-2 rounded bg-[#00FF41]/10 border border-[#00FF41]/30 text-xs text-[#00FF41]">
          {success}
        </div>
      )}
    </div>
  );
}
