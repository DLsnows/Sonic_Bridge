"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ProjectStatusBadge } from "@/components/ProjectStatusBadge";
import { projectHref } from "@/lib/project-utils";

interface Project {
  id: string;
  customId: string | null;
  name: string;
  description: string | null;
  status: string;
  role: string;
}

export function InactiveProjectsSection({ projects: inactiveProjects }: { projects: Project[] }) {
  const [open, setOpen] = useState(false);

  if (inactiveProjects.length === 0) return null;

  return (
    <div className="mb-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm text-[#A0A0B0] hover:text-[#F0F0F0] transition-colors mb-3"
      >
        <span className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}>&#9654;</span>
        <span>Archived / Paused ({inactiveProjects.length})</span>
      </button>
      {open && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {inactiveProjects.map((project) => (
            <Link key={project.id} href={projectHref(project)}>
              <Card hover glow="green" className="h-full opacity-60 hover:opacity-100 transition-opacity">
                <h3 className="font-['Share_Tech_Mono',monospace] text-[#F0F0F0] text-lg mb-1">
                  {project.name}
                </h3>
                {project.description && (
                  <p className="text-sm text-[#A0A0B0] line-clamp-2">
                    {project.description}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-4">
                  <ProjectStatusBadge status={project.status} isAdmin={false} />
                  <span className="text-xs text-[#A0A0B0]">{project.role === "admin" ? "Admin" : "Member"}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
