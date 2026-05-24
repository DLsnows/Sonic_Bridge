"use client";

import { useEffect, useRef } from "react";
import { useVstStore } from "@/lib/store/vst";
import { getMicPipeline } from "@/lib/mic-pipeline";

export function MicVolumeBridge() {
  const micVolume = useVstStore((s) => s.micVolume);
  const pipelineRef = useRef(getMicPipeline());

  useEffect(() => {
    pipelineRef.current.setVolume(micVolume);
  }, [micVolume]);

  useEffect(() => {
    return () => {
      useVstStore.getState().setMicMeterLevel(0);
    };
  }, []);

  return null;
}

