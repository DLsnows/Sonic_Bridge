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
  const sendBufferMs = useMediaSettingsStore((s) => s.audioQuality.sendBufferMs);
  const dawBitrate = useMediaSettingsStore((s) => s.dawAudio.bitrate);
  const publishedTrackRef = useRef<MediaStreamTrack | null>(null);

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

  // Apply send buffer change to audio pipeline
  useEffect(() => {
    if (pipelineRef.current) {
      const samples = msToSamples(sendBufferMs);
    }
  }, [sendBufferMs]);

  // Broadcast toggle: unpublish when disabled, re-publish when enabled
  useEffect(() => {
    if (!broadcastEnabled && publishedTrackRef.current) {
      const track = publishedTrackRef.current;
      participantRef.current.unpublishTrack(track).catch(() => {});
      publishedTrackRef.current = null;
      useVstStore.getState().setAudioTrackPublished(false);
    }
    if (broadcastEnabled && !publishedTrackRef.current) {
      // Small delay to ensure unpublish completed, then try to publish on next PCM frame
      const timer = setTimeout(() => {
        if (!publishedTrackRef.current && pipelineRef.current?.isReady) {
          // Force a new PCM frame to trigger re-publish
          const track = pipelineRef.current.getMediaStreamTrack();
          if (track) {
            participantRef.current.publishTrack(track, {
              name: "DAW Audio (VST)",
              source: Track.Source.Unknown,
              audioBitrate: useMediaSettingsStore.getState().dawAudio.bitrate,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any).then(() => {
              publishedTrackRef.current = track;
              useVstStore.getState().setAudioTrackPublished(true);
            }).catch(() => {});
          }
        }
      }, 500);
      return () => clearTimeout(timer);
    }
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

    let published = false;

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

      // Publish DAW audio as independent channel (not Microphone)
      const store = useVstStore.getState();
      if (
        pipeline.isReady &&
        !publishedTrackRef.current &&
        store.broadcastEnabled
      ) {
        const track = pipeline.getMediaStreamTrack();
        if (track) {
          participantRef.current.publishTrack(track, {
            name: "DAW Audio (VST)",
            source: Track.Source.Unknown,
            audioBitrate: useMediaSettingsStore.getState().dawAudio.bitrate,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any).then(() => {
            publishedTrackRef.current = track;
            store.setAudioTrackPublished(true);
          }).catch((e: unknown) => {
            store.setError(
              `Failed to publish audio track: ${e instanceof Error ? e.message : "Unknown error"}`,
            );
          });
        }
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
