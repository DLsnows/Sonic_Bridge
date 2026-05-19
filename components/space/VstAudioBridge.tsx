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
  participantRef.current = localParticipant;
  const triggerReconnect = useVstStore((s) => s.triggerReconnect);
  const vstVolume = useVstStore((s) => s.vstVolume);
  const audioBitrate = useMediaSettingsStore((s) => s.audioQuality.bitrate);
  const sendBufferMs = useMediaSettingsStore((s) => s.audioQuality.sendBufferMs);
  const receiveBufferMs = useMediaSettingsStore((s) => s.audioQuality.receiveBufferMs);

  // Watch for manual reconnect requests (triggerReconnect > 0 guards against mount-time fire)
  useEffect(() => {
    if (triggerReconnect > 0 && bridgeRef.current) {
      bridgeRef.current.disconnect();
      bridgeRef.current.connect({ projectId, userId, username });
    }
  }, [triggerReconnect, projectId, userId, username]);

  useEffect(() => {
    pipelineRef.current?.setVolume(vstVolume);
  }, [vstVolume]);

  // Apply audio bitrate change to VST plugin
  useEffect(() => {
    if (bridgeRef.current) {
      bridgeRef.current.sendBitrateChange(audioBitrate);
    }
  }, [audioBitrate]);

  // Apply send buffer change to VST plugin
  useEffect(() => {
    if (bridgeRef.current) {
      const samples = msToSamples(sendBufferMs);
      bridgeRef.current.sendBufferChange(samples);
    }
  }, [sendBufferMs]);

  // Apply receive buffer change to audio pipeline
  useEffect(() => {
    if (pipelineRef.current) {
      const samples = msToSamples(receiveBufferMs);
      pipelineRef.current.setReceiveBufferSize(samples);
    }
  }, [receiveBufferMs]);

  useEffect(() => {
    if (!VstAudioPipeline.isSupported()) {
      useVstStore.getState().setError(
        "VST audio requires Chrome or Edge (WebCodecs AudioDecoder not available)",
      );
      return;
    }

    const bridge = new VstBridge();
    bridgeRef.current = bridge;

    let published = false;
    let initializing = false;

    bridge.onAudioPacket(async (packet) => {
      if (!pipelineRef.current && !initializing) {
        initializing = true;
        pipelineRef.current = new VstAudioPipeline();
        try {
          await pipelineRef.current.initialize(
            packet.sampleRate,
            packet.channels,
          );
        } catch {
          pipelineRef.current = null;
          initializing = false;
          return;
        }
        initializing = false;
      }

      const pipeline = pipelineRef.current!;

      pipeline.feedOpusPacket(packet.data);

      // Publish audio track to LiveKit once the pipeline produces a track
      const store = useVstStore.getState();
      if (
        pipeline.isReady &&
        !published &&
        store.broadcastEnabled
      ) {
        const track = pipeline.getMediaStreamTrack();
        if (track) {
          try {
            await participantRef.current.publishTrack(track, {
              name: "DAW Audio (VST)",
              source: Track.Source.Microphone,
            });
            published = true;
            store.setAudioTrackPublished(true);
          } catch (e) {
            store.setError(
              `Failed to publish audio track: ${e instanceof Error ? e.message : "Unknown error"}`,
            );
          }
        }
      }
    });

    bridge.connect({ projectId, userId, username });

    return () => {
      bridge.disconnect();
      bridgeRef.current = null;
      pipelineRef.current?.shutdown();
      pipelineRef.current = null;
      published = false;
    };
  }, [projectId, userId, username]);

  return null; // no UI — managed by VstConnectionPanel
}
