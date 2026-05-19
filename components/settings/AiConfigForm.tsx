"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface AiConfig {
  configured: boolean;
  apiUrl?: string;
  model?: string;
  hasKey?: boolean;
}

interface AiConfigFormProps {
  projectId: string;
}

export function AiConfigForm({ projectId }: AiConfigFormProps) {
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showKey, setShowKey] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/ai-config`);
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        if (data.configured) {
          setApiUrl(data.apiUrl ?? "");
          setModel(data.model ?? "gpt-4o-mini");
        }
      }
    } catch {
      // ignore fetch errors on load
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    setError("");
    setSuccess("");

    if (!apiUrl.trim()) {
      setError("API URL is required.");
      return;
    }
    if (!config?.hasKey && !apiKey.trim()) {
      setError("API key is required.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/ai-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiUrl: apiUrl.trim(),
          apiKey: apiKey.trim() || undefined,
          model: model.trim() || "gpt-4o-mini",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
        return;
      }
      setConfig(data);
      setApiKey("");
      setSuccess("AI configuration saved.");
    } catch {
      setError("Failed to reach server.");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!confirm("Remove AI configuration for this project?")) return;
    setError("");
    setSuccess("");
    setClearing(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/ai-config`, {
        method: "DELETE",
      });
      if (res.ok) {
        setConfig({ configured: false });
        setApiUrl("");
        setApiKey("");
        setModel("gpt-4o-mini");
        setSuccess("AI configuration removed.");
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to remove");
      }
    } catch {
      setError("Failed to reach server.");
    } finally {
      setClearing(false);
    }
  };

  if (loading) {
    return (
      <p className="text-xs text-[#A0A0B0] animate-pulse">
        Loading configuration...
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{
            backgroundColor: config?.configured ? "#00FF41" : "#FF8C00",
            boxShadow: config?.configured
              ? "0 0 12px rgba(0,255,65,0.5)"
              : "0 0 12px rgba(255,140,0,0.5)",
          }}
        />
        <span className="text-sm text-[#F0F0F0] font-['Share_Tech_Mono',monospace]">
          {config?.configured ? "Configured" : "Not configured"}
        </span>
      </div>

      <div className="space-y-3">
        <Input
          label="API URL"
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          placeholder="https://api.openai.com/v1/chat/completions"
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-[#A0A0B0] font-medium uppercase tracking-wider">
            API Key
          </label>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={config?.hasKey ? "Leave blank to keep current key" : "sk-your-api-key"}
              className="w-full px-3 py-2 pr-10 bg-[#0F0F13] border border-white/10 rounded-lg text-sm text-[#F0F0F0]
                placeholder:text-[#A0A0B0]/50 font-['Fira_Code',monospace]
                transition-all duration-200
                focus:outline-none focus:border-[#00FF41]/50 focus:shadow-[0_0_15px_rgba(0,255,65,0.1)]
                hover:border-white/20"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#A0A0B0] hover:text-[#F0F0F0] transition-colors"
            >
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <Input
          label="Model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="gpt-4o-mini"
        />
      </div>

      {error && (
        <p className="text-xs text-[#FF4444]">{error}</p>
      )}
      {success && (
        <p className="text-xs text-[#00FF41]">{success}</p>
      )}

      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
          Save
        </Button>
        {config?.configured && (
          <Button variant="ghost" size="sm" onClick={handleClear} loading={clearing}>
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
