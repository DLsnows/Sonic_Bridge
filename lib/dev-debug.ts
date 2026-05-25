// Debug instrumentation for diagnosing audio/track state bugs.
// Gate: NODE_ENV === 'development', OR URL contains ?debug=1.
// The ?debug=1 form is what's used on Vercel preview deployments to
// reproduce Bug B without leaking the panel into normal production URLs.

import type {
  LocalParticipant,
  RemoteTrackPublication,
  LocalTrackPublication,
} from "livekit-client";
import { useVstStore } from "@/lib/store/vst";
import { useMediaSettingsStore } from "@/lib/store/media-settings";

export function isDebugEnabled(): boolean {
  if (process.env.NODE_ENV === "development") return true;
  if (typeof window === "undefined") return false;
  try {
    return new URL(window.location.href).searchParams.get("debug") === "1";
  } catch {
    return false;
  }
}

let inited = false;
export function initDevDebug() {
  if (inited) return;
  inited = true;
  if (!isDebugEnabled()) return;

  useVstStore.subscribe((s, prev) => {
    const changed: Record<string, unknown> = {};
    for (const k of Object.keys(s) as (keyof typeof s)[]) {
      if (s[k] !== prev[k]) changed[k as string] = { from: prev[k], to: s[k] };
    }
    if (Object.keys(changed).length) {
      console.log("[dev-debug][vstStore]", changed);
    }
  });

  useMediaSettingsStore.subscribe((s, prev) => {
    if (JSON.stringify(s) !== JSON.stringify(prev)) {
      console.log("[dev-debug][mediaSettings]", {
        audioQuality: s.audioQuality,
        dawAudio: s.dawAudio,
      });
    }
  });
}

export interface PublicationSnapshot {
  source: string;
  sid: string | undefined;
  kind: string;
  trackId: string | undefined;
  muted: boolean | undefined;
  enabled: boolean | undefined;
  readyState: string | undefined;
}

export function snapshotPublications(lp: LocalParticipant): PublicationSnapshot[] {
  const out: PublicationSnapshot[] = [];
  lp.trackPublications.forEach((pub) => {
    const p = pub as LocalTrackPublication | RemoteTrackPublication;
    const t = p.track;
    const mst = t?.mediaStreamTrack;
    out.push({
      source: p.source,
      sid: p.trackSid,
      kind: p.kind,
      trackId: mst?.id,
      muted: mst?.muted,
      enabled: mst?.enabled,
      readyState: mst?.readyState,
    });
  });
  return out;
}
