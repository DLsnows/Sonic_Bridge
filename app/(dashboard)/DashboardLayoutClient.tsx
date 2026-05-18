"use client";

import { useSidebarStore } from "@/lib/store/sidebar";

export function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
  const collapsed = useSidebarStore((s) => s.collapsed);
  return (
    <main className={`transition-all duration-300 ${collapsed ? "ml-16" : "ml-60"}`}>
      {children}
    </main>
  );
}
