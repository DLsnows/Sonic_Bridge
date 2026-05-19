"use client";

import { useEffect, useRef } from "react";
import { useVstStore } from "@/lib/store/vst";
import { getMicProcessor } from "@/lib/mic-processor";

export function MicVolumeBridge() {
  const micVolume = useVstStore((s) => s.micVolume);
  const processorRef = useRef(getMicProcessor());

  useEffect(() => {
    processorRef.current.setVolume(micVolume);
  }, [micVolume]);

  useEffect(() => {
    return () => {
      useVstStore.getState().setMicMeterLevel(0);
    };
  }, []);

  return null;
}
