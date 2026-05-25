"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import {
  initDevDebug,
  isDebugEnabled,
  snapshotPublications,
  type PublicationSnapshot,
} from "@/lib/dev-debug";

const subscribeNoop = () => () => {};
const getClientSnapshot = () => isDebugEnabled();
const getServerSnapshot = () => false;

export function DevDebugPanel() {
  const { localParticipant } = useLocalParticipant();
  const [snap, setSnap] = useState<PublicationSnapshot[]>([]);
  const [open, setOpen] = useState(true);
  const enabled = useSyncExternalStore(subscribeNoop, getClientSnapshot, getServerSnapshot);

  useEffect(() => {
    if (enabled) initDevDebug();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (!localParticipant) return;
    const update = () => {
      const s = snapshotPublications(localParticipant);
      setSnap(s);
      console.log("[dev-debug][publications]", s);
    };
    update();
    const events: string[] = [
      "trackPublished",
      "trackUnpublished",
      "trackMuted",
      "trackUnmuted",
      "localTrackPublished",
      "localTrackUnpublished",
    ];
    for (const ev of events) {
      // @ts-expect-error event names dynamic
      localParticipant.on(ev, update);
    }
    const id = window.setInterval(update, 1500);
    return () => {
      for (const ev of events) {
        // @ts-expect-error event names dynamic
        localParticipant.off(ev, update);
      }
      window.clearInterval(id);
    };
  }, [localParticipant, enabled]);

  if (!enabled) return null;
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          bottom: 8,
          right: 8,
          zIndex: 9999,
          padding: "4px 8px",
          fontSize: 10,
          background: "#000",
          color: "#0f0",
          border: "1px solid #0f0",
        }}
      >
        debug
      </button>
    );
  }
  return (
    <div
      style={{
        position: "fixed",
        bottom: 8,
        right: 8,
        zIndex: 9999,
        width: 360,
        maxHeight: 260,
        overflow: "auto",
        padding: 8,
        background: "rgba(0,0,0,0.85)",
        color: "#0f0",
        fontFamily: "monospace",
        fontSize: 10,
        border: "1px solid #0f0",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <strong>dev-debug · publications</strong>
        <button
          onClick={() => setOpen(false)}
          style={{
            color: "#0f0",
            background: "transparent",
            border: 0,
            cursor: "pointer",
          }}
        >
          x
        </button>
      </div>
      {snap.length === 0 && <div>(no publications)</div>}
      {snap.map((p, i) => (
        <div
          key={i}
          style={{
            borderTop: "1px dashed #044",
            paddingTop: 2,
            marginTop: 2,
          }}
        >
          <div>
            source={p.source} kind={p.kind}
          </div>
          <div>sid={p.sid ?? "-"}</div>
          <div>
            muted={String(p.muted)} enabled={String(p.enabled)} state=
            {p.readyState ?? "-"}
          </div>
        </div>
      ))}
    </div>
  );
}
