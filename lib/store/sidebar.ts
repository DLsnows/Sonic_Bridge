import { create } from "zustand";

export interface SidebarProject {
  id: string;
  name: string;
  status: string;
}

interface SidebarState {
  collapsed: boolean;
  projects: SidebarProject[];
  setProjects: (projects: SidebarProject[]) => void;
  refreshProjects: () => Promise<void>;
  toggle: () => void;
  setCollapsed: (collapsed: boolean) => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  collapsed: false,
  projects: [],
  setProjects: (projects) => set({ projects }),
  refreshProjects: async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        set({
          projects: data.map((p: { id: string; name: string; status: string }) => ({
            id: p.id,
            name: p.name,
            status: p.status,
          })),
        });
      }
    } catch { /* network error - ignore */ }
  },
  toggle: () => set((s) => ({ collapsed: !s.collapsed })),
  setCollapsed: (collapsed) => set({ collapsed }),
}));
