"use client";

import { useEffect, useRef } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import { Track } from "livekit-client";
import { VstBridge } from "@/lib/vst-bridge";
import { VstAudioPipeline } from "@/lib/audio-pipeline";
import { useVstStore } from "@/lib/store/vst";
import { useMediaSettingsStore, msToSamples } from "@/lib/store/media-settings";

interface VstAudioBridgeProps {
  projectId: string;
  userId: string;
  username: string;
}

export function VstAudioBridge({
  projectId,
  userId,
  username,
}: VstAudioBridgeProps) {
  const { localParticipant } = useLocalParticipant();
  const bridgeRef = useRef<VstBridge | null>(null);
  const pipelineRef = useRef<VstAudioPipeline | null>(null);
  const participantRef = useRef(localParticipant);
  useEffect(() => { participantRef.current = localParticipant; }, [localParticipant]);
  const triggerReconnect = useVstStore((s) => s.triggerReconnect);
  const broadcastEnabled = useVstStore((s) => s.broadcastEnabled);
  const vstVolume = useVstStore((s) => s.vstVolume);
  const receiveBufferMs = useMediaSettingsStore((s) => s.audioQuality.receiveBufferMs);
  const publishedTrackRef = useRef<MediaStreamTrack | null>(null);
  const pendingPublishRef = useRef(false);
  const tryPublishRef = useRef<() => void>(() => {});

  // Watch for manual reconnect requests
  useEffect(() => {
    if (triggerReconnect > 0 && bridgeRef.current) {
      bridgeRef.current.disconnect();
      bridgeRef.current.setPort(useVstStore.getState().preferredPort);
      bridgeRef.current.connect({ projectId, userId, username });
    }
  }, [triggerReconnect, projectId, userId, username]);

  useEffect(() => {
    pipelineRef.current?.setVolume(vstVolume);
  }, [vstVolume]);

  // Apply receive buffer change to audio pipeline
  useEffect(() => {
    if (pipelineRef.current) {
      const samples = msToSamples(receiveBufferMs);
      pipelineRef.current.setReceiveBufferSize(samples);
    }
  }, [receiveBufferMs]);


  // Broadcast toggle: unpublish when disabled, re-publish when enabled.
  // Single source of truth — PCM callback only feeds PCM and notifies via onReady.
  // Race-safe: publishedTrackRef is cleared synchronously on disable so a rapid
  // re-enable sees a fresh state; pendingPublishRef de-dups in-flight publishes.
  useEffect(() => {
    if (!broadcastEnabled) {
      const track = publishedTrackRef.current;
      if (track) {
        // Clear synchronously so an immediate re-enable doesn't see a stale ref.
        publishedTrackRef.current = null;
        useVstStore.getState().setAudioTrackPublished(false);
        participantRef.current.unpublishTrack(track).catch((e: unknown) => {
          // Unpublish failed; LiveKit may still consider the track published.
          // Surface to the user so they can manually recover (toggle again / reload).
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[vst-bridge] unpublishTrack failed; track may still be live:", msg);
          useVstStore.getState().setError(
            "Failed to fully stop broadcast — try toggling again or reload if the issue persists.",
          );
        });
      }
      // Reset any pending publish that might be in flight (e.g. user toggled
      // off before the deferred onReady-driven publish landed).
      pendingPublishRef.current = false;
      return;
    }

    if (publishedTrackRef.current || pendingPublishRef.current) return;

    const tryPublish = () => {
      if (!useVstStore.getState().broadcastEnabled) {
        // Broadcast went off again while we waited — do nothing.
        pendingPublishRef.current = false;
        return;
      }
      const pipeline = pipelineRef.current;
      if (!pipeline?.isReady) return; // will be retried via onPcmData → onReady
      if (publishedTrackRef.current) {
        pendingPublishRef.current = false;
        return;
      }
      const track = pipeline.refreshTrack();
      if (!track) {
        pendingPublishRef.current = false;
        return;
      }
      participantRef.current.publishTrack(track, {
        name: "DAW Audio (VST)",
        source: Track.Source.Unknown,
        audioBitrate: useMediaSettingsStore.getState().dawAudio.bitrate,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any).then(() => {
        publishedTrackRef.current = track;
        useVstStore.getState().setAudioTrackPublished(true);
      }).catch(() => {}).finally(() => {
        pendingPublishRef.current = false;
      });
    };
    tryPublishRef.current = tryPublish;

    // Only flag in-flight if we actually have somewhere to register —
    // otherwise the PCM callback's `!pendingPublishRef` guard would see
    // a true ref before any onReady was registered, and the publish would
    // deadlock forever (caught by Claude /review on PR #173).
    if (pipelineRef.current?.isReady) {
      pendingPublishRef.current = true;
      tryPublish();
    } else if (pipelineRef.current) {
      pendingPublishRef.current = true;
      pipelineRef.current.onReady(tryPublish);
    }
    // else: pipeline not yet created (no PCM received yet). Leave
    // pendingPublishRef false so the onPcmData callback can pick it up
    // via onReady once it creates the pipeline.
  }, [broadcastEnabled]);

  useEffect(() => {
    if (!VstAudioPipeline.isSupported()) {
      useVstStore.getState().setError(
        "VST audio requires AudioContext + AudioWorklet support",
      );
      return;
    }

    const bridge = new VstBridge();
    bridgeRef.current = bridge;


    bridge.onPcmData((interleaved, sampleRate, channels, numSamples) => {
      if (!pipelineRef.current) {
        pipelineRef.current = new VstAudioPipeline();
        pipelineRef.current.initialize(sampleRate, channels).catch(() => {
          pipelineRef.current = null;
        });
      }

      const pipeline = pipelineRef.current;
      if (!pipeline?.isReady) return;

      pipeline.feedPcm(interleaved, sampleRate, channels, numSamples);

      // If broadcast is enabled and we haven't published yet (e.g. broadcast
      // toggled on before pipeline existed), schedule a publish via onReady.
      // Pipeline is already ready at this point, so onReady fires synchronously.
      if (
        !publishedTrackRef.current &&
        !pendingPublishRef.current &&
        useVstStore.getState().broadcastEnabled
      ) {
        pendingPublishRef.current = true;
        pipeline.onReady(() => tryPublishRef.current());
      }
    });

    bridge.connect({ projectId, userId, username });

    return () => {
      bridge.disconnect();
      bridgeRef.current = null;
      pipelineRef.current?.shutdown();
      pipelineRef.current = null;
      publishedTrackRef.current = null;
    };
  }, [projectId, userId, username]);

  return null; // no UI
}
