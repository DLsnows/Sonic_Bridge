"use client";

import { useEffect, useRef } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import { Track } from "livekit-client";
import { VstBridge } from "@/lib/vst-bridge";
import { VstAudioPipeline } from "@/lib/audio-pipeline";
import { useVstStore } from "@/lib/store/vst";

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
    let pipelinePromise: Promise<void> | null = null;

    bridge.onAudioPacket(async (packet) => {
      if (!pipelineRef.current) {
        if (!pipelinePromise) {
          pipelineRef.current = new VstAudioPipeline();
          pipelinePromise = pipelineRef.current.initialize(
            packet.sampleRate,
            packet.channels,
          ).then(() => { pipelinePromise = null; });
        }
        await pipelinePromise;
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

    bridge.onMeterUpdate((levels) => {
      useVstStore.getState().setMeterLevels(levels);
    });

    bridge.onSettingsUpdate((settings) => {
      useVstStore.getState().setAudioSettings(settings);
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
