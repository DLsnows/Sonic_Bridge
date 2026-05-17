"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "./ui/Button";

const navItems = [
  { href: "/", label: "Projects", icon: "◈" },
];

export function Sidebar({ username }: { username?: string }) {
  const pathname = usePathname();

  return (
    <aside className="w-60 h-screen fixed left-0 top-0 flex flex-col bg-[#0A0A0F] border-r border-[#00FF41]/10 z-30">
      {/* Logo */}
      <div className="p-5 border-b border-[#00FF41]/10">
        <Link href="/" className="font-['Share_Tech_Mono',monospace] text-lg neon-text">
          SONICBRIDGE
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200
                ${isActive
                  ? "bg-[#00FF41]/10 text-[#00FF41] border border-[#00FF41]/20"
                  : "text-[#A0A0B0] hover:text-[#F0F0F0] hover:bg-white/5"}`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-[#00FF41]/10 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#00FF41]/20 flex items-center justify-center text-xs text-[#00FF41] font-['Share_Tech_Mono',monospace]">
          {(username ?? "U")[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[#F0F0F0] truncate">{username ?? "User"}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/login" })}
          title="Sign out"
        >
          ⏻
        </Button>
      </div>
    </aside>
  );
}
