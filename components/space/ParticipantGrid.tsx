"use client";

import { useEffect, useRef } from "react";
import { useTracks, ParticipantTile, useMaybeRoomContext } from "@livekit/components-react";
import { Track, RoomEvent, type RemoteParticipant } from "livekit-client";
import { useSpaceStore } from "@/lib/store/space";

export function ParticipantGrid() {
  const room = useMaybeRoomContext();
  const videoWatchEnabled = useSpaceStore((s) => s.videoWatchEnabled);
  const prevVideoWatchRef = useRef(videoWatchEnabled);

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: true },
  );

  useEffect(() => {
    if (!room) return;
    if (videoWatchEnabled === prevVideoWatchRef.current) return;
    prevVideoWatchRef.current = videoWatchEnabled;

    for (const [, participant] of room.remoteParticipants) {
      for (const [, pub] of participant.videoTrackPublications) {
        pub.setSubscribed(videoWatchEnabled);
      }
    }
  }, [videoWatchEnabled, room]);

  useEffect(() => {
    if (!room || videoWatchEnabled) return;

    function handleParticipantConnected(participant: RemoteParticipant) {
      for (const [, pub] of participant.videoTrackPublications) {
        pub.setSubscribed(false);
      }
    }

    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    return () => {
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
    };
  }, [videoWatchEnabled, room]);

  if (tracks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="glass-panel text-center py-16 px-12">
          {!videoWatchEnabled ? (
            <>
              <div className="text-5xl mb-4 animate-pulse-amber" style={{ animationDuration: "2s" }}>🔋</div>
              <h3 className="font-['Share_Tech_Mono',monospace] neon-text-cyan text-lg mb-2">
                Video paused — bandwidth saving mode
              </h3>
              <p className="text-[#A0A0B0] text-sm">
                Audio is still active. Click the eye button in the control bar to resume watching.
              </p>
            </>
          ) : (
            <>
              <div className="text-5xl mb-4">◈</div>
              <h3 className="font-['Share_Tech_Mono',monospace] neon-text text-lg mb-2">
                Waiting for collaborators...
              </h3>
              <p className="text-[#A0A0B0] text-sm">
                Share the project ID to invite others to this Creative Space.
              </p>
            </>
          )}
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
