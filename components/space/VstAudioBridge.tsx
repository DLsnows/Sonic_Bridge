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

    bridge.onAudioPacket(async (packet) => {
      if (!pipelineRef.current) {
        pipelineRef.current = new VstAudioPipeline();
        await pipelineRef.current.initialize(
          packet.sampleRate,
          packet.channels,
        );
      }

      pipelineRef.current.feedOpusPacket(packet.data);

      const store = useVstStore.getState();
      if (
        pipelineRef.current.isReady &&
        !published &&
        store.broadcastEnabled
      ) {
        const track = pipelineRef.current.getMediaStreamTrack();
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

  return null;
}
