"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  useTracks,
  ParticipantTile,
  useMaybeRoomContext,
} from "@livekit/components-react";
import {
  Track,
  RoomEvent,
  type RemoteParticipant,
  type RemoteTrackPublication,
} from "livekit-client";
import { useSpaceStore } from "@/lib/store/space";
import type { TrackReferenceOrPlaceholder } from "@livekit/components-react";

function makeKey(track: TrackReferenceOrPlaceholder) {
  return `${track.participant.identity}${track.source}`;
}

export function SpotlightView() {
  const room = useMaybeRoomContext();
  const videoWatchEnabled = useSpaceStore((s) => s.videoWatchEnabled);
  const prevVideoWatchRef = useRef(videoWatchEnabled);

  const [spotlightKey, setSpotlightKey] = useState<string | null>(null);
  const manualSpotlightRef = useRef(false);
  const prevScreenShareKey = useRef<string | null>(null);

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: true },
  );

  const spotlightTrack = useMemo(() => {
    if (!spotlightKey) return null;
    return tracks.find((t) => makeKey(t) === spotlightKey) ?? null;
  }, [tracks, spotlightKey]);

  // Auto-spotlight screen share when it appears
  const screenShareTrack = useMemo(
    () => tracks.find((t) => t.source === Track.Source.ScreenShare),
    [tracks],
  );

  useEffect(() => {
    if (screenShareTrack) {
      const key = makeKey(screenShareTrack);
      if (key !== prevScreenShareKey.current && !manualSpotlightRef.current) {
        prevScreenShareKey.current = key;
        if (spotlightKey !== key) {
          requestAnimationFrame(() => {
            setSpotlightKey(key);
            manualSpotlightRef.current = false;
          });
        }
      }
    } else {
      prevScreenShareKey.current = null;
      if (!manualSpotlightRef.current && spotlightKey !== null) {
        requestAnimationFrame(() => {
          setSpotlightKey(null);
        });
      }
    }
  }, [screenShareTrack, spotlightKey]);

  // Subscribe/unsubscribe video tracks based on videoWatchEnabled
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

    function handleTrackPublished(
      publication: RemoteTrackPublication,
      _participant: RemoteParticipant, // eslint-disable-line @typescript-eslint/no-unused-vars
    ) {
      if (publication.kind === Track.Kind.Video) {
        publication.setSubscribed(false);
      }
    }

    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.TrackPublished, handleTrackPublished);
    return () => {
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.TrackPublished, handleTrackPublished);
    };
  }, [videoWatchEnabled, room]);

  const enterSpotlight = useCallback((key: string) => {
    setSpotlightKey(key);
    manualSpotlightRef.current = true;
  }, []);

  const exitSpotlight = useCallback(() => {
    setSpotlightKey(null);
    manualSpotlightRef.current = false;
  }, []);

  const handleDoubleClick = useCallback(
    (key: string) => {
      if (tracks.length <= 2) return;
      if (spotlightKey === key) {
        exitSpotlight();
      } else {
        enterSpotlight(key);
      }
    },
    [spotlightKey, enterSpotlight, exitSpotlight, tracks.length],
  );

  const isSpotlightActive = spotlightKey !== null && tracks.length > 2;

  // Auto-exit spotlight when the pinned track disappears (participant left)
  useEffect(() => {
    if (isSpotlightActive && !spotlightTrack) {
      requestAnimationFrame(() => {
        setSpotlightKey(null);
        manualSpotlightRef.current = false;
      });
    }
  }, [isSpotlightActive, spotlightTrack]);

  // Empty state
  if (tracks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="glass-panel text-center py-16 px-12">
          {!videoWatchEnabled ? (
            <>
              <div
                className="text-5xl mb-4 animate-pulse-amber"
                style={{ animationDuration: "2s" }}
              >
                🔋
              </div>
              <h3 className="font-['Share_Tech_Mono',monospace] neon-text-cyan text-lg mb-2">
                Video paused — bandwidth saving mode
              </h3>
              <p className="text-[#A0A0B0] text-sm">
                Audio is still active. Click the eye button in the control bar
                to resume watching.
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

  // Grid fallback when spotlight not active or ≤2 tracks
  if (!isSpotlightActive) {
    const gridCols =
      tracks.length <= 1
        ? "grid-cols-1"
        : tracks.length <= 2
          ? "grid-cols-1 md:grid-cols-2"
          : tracks.length <= 4
            ? "grid-cols-2"
            : "grid-cols-2 lg:grid-cols-3";

    return (
      <div className={`grid ${gridCols} gap-4 p-4 auto-rows-fr flex-1`}>
        {tracks.map((trackRef) => (
          <div
            key={makeKey(trackRef)}
            className="rounded-xl overflow-hidden cursor-pointer"
            onDoubleClick={() => handleDoubleClick(makeKey(trackRef))}
          >
            <ParticipantTile trackRef={trackRef} />
          </div>
        ))}
      </div>
    );
  }

  // Spotlight mode: main view + thumbnail strip
  const spotlightTracks = tracks.filter((t) => makeKey(t) !== spotlightKey);

  return (
    <div className="flex-1 flex flex-col min-h-0 p-4">
      {/* Main spotlight view */}
      <div className="flex-1 relative rounded-xl overflow-hidden mb-3 min-h-0">
        {spotlightTrack && (
          <ParticipantTile trackRef={spotlightTrack} />
        )}

        {/* Track identity label overlay */}
        {spotlightTrack && (
          <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white text-sm font-medium">
            {spotlightTrack.participant.identity}
            {spotlightTrack.source === Track.Source.ScreenShare
              ? " — Screen"
              : ""}
          </div>
        )}

        {/* Exit spotlight button overlay */}
        <button
          onClick={exitSpotlight}
          className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white text-sm hover:bg-black/80 transition-colors border border-white/10"
        >
          Exit Spotlight
        </button>
      </div>

      {/* Thumbnail strip */}
      <div
        className="flex gap-2 overflow-x-auto pb-1"
        style={{ height: 80 }}
      >
        {spotlightTracks.map((trackRef) => (
          <div
            key={makeKey(trackRef)}
            className="flex-shrink-0 rounded-lg overflow-hidden cursor-pointer border-2 border-transparent hover:border-[#00F0FF]/60 transition-colors"
            style={{ width: 120 }}
            onClick={() => enterSpotlight(makeKey(trackRef))}
          >
            <div className="w-full h-full" style={{ pointerEvents: "none" }}>
              <ParticipantTile trackRef={trackRef} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
