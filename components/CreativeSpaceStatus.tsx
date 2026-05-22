"use client";

import { useEffect, useState } from "react";

export function CreativeSpaceStatus({ projectId }: { projectId: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let ignore = false;
    fetch(`/api/projects/${projectId}/space/status`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!ignore && d) setCount(d.participantCount ?? 0);
      })
      .catch(() => { if (!ignore) setCount(0); });
    const interval = setInterval(() => {
      fetch(`/api/projects/${projectId}/space/status`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!ignore && d) setCount(d.participantCount ?? 0);
        })
        .catch(() => { if (!ignore) setCount(0); });
    }, 30000);
    return () => { ignore = true; clearInterval(interval); };
  }, [projectId]);

  if (count === null) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#A0A0B0]" />
        <span className="text-[10px] text-[#A0A0B0]">Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${count > 0 ? "bg-[#00FF41]" : "bg-[#A0A0B0]"}`} />
      <span className="text-[10px] text-[#A0A0B0]">
        {count > 0 ? `${count} online` : "Empty"}
      </span>
    </div>
  );
}
