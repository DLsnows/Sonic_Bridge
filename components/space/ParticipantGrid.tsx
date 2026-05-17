"use client";

import { useTracks, ParticipantTile } from "@livekit/components-react";
import { Track } from "livekit-client";

export function ParticipantGrid() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  if (tracks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="glass-panel text-center py-16 px-12">
          <div className="text-5xl mb-4">◈</div>
          <h3 className="font-['Share_Tech_Mono',monospace] neon-text text-lg mb-2">
            Waiting for collaborators...
          </h3>
          <p className="text-[#A0A0B0] text-sm">
            Share the project ID to invite others to this Creative Space.
          </p>
        </div>
      </div>
    );
  }

  const gridCols =
    tracks.length <= 1
      ? "grid-cols-1"
      : tracks.length <= 2
        ? "grid-cols-1 md:grid-cols-2"
        : tracks.length <= 4
          ? "grid-cols-2"
          : "grid-cols-2 lg:grid-cols-3";

  return (
    <div className={`grid ${gridCols} gap-4 p-4 auto-rows-fr`}>
      {tracks.map((trackRef) => (
        <div
          key={trackRef.participant.identity + trackRef.source}
          className="rounded-xl overflow-hidden"
        >
          <ParticipantTile trackRef={trackRef} />
        </div>
      ))}
    </div>
  );
}
