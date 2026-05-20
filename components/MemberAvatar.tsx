"use client";

import { useState } from "react";

export function MemberAvatar({
  userId,
  username,
  className,
}: {
  userId: string;
  username: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={className}>
        {username[0].toUpperCase()}
      </div>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={`/api/user/avatar/${userId}`}
      alt={username}
      className={className}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
