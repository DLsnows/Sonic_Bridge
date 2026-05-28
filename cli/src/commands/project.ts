import pc from "picocolors";
import { apiFetch, formatApiError, wantsJson } from "../api.js";
import { loadConfig, saveConfig } from "../config.js";
import { renderTable } from "../util/table.js";

interface MeResponse {
  user: { id: string; username: string; email: string };
  projects?: Array<{
    id: string;
    customId?: string | null;
    name: string;
    role: string;
  }>;
}

export interface ProjectLsFlags {
  json?: boolean;
}

export async function runProjectLs(flags: ProjectLsFlags): Promise<void> {
  try {
    const me = await apiFetch<MeResponse>("/api/user/me");
    const projects = me.projects ?? [];
    if (wantsJson(flags)) {
      console.log(JSON.stringify({ projects }, null, 2));
      return;
    }
    if (projects.length === 0) {
      console.log(pc.dim("(no project memberships)"));
      return;
    }
    const cfg = await loadConfig();
    const activeId = cfg?.activeProject?.id;
    const rows = projects.map((p) => ({
      active: p.id === activeId ? "*" : "",
      id: p.id.slice(0, 8),
      name: p.name,
      role: p.role,
    }));
    console.log(
      renderTable(
        [
          { header: " ", key: "active", maxWidth: 1 },
          { header: "id", key: "id" },
          { header: "name", key: "name" },
          { header: "role", key: "role" },
        ],
        rows,
      ),
    );
  } catch (err) {
    console.error(pc.red(formatApiError(err)));
    process.exit(1);
  }
}

export async function runProjectUse(idOrCustomId: string): Promise<void> {
  const cfg = await loadConfig();
  if (!cfg?.token) {
    console.error(pc.red("Not logged in. Run `sonicbridge login`."));
    process.exit(1);
  }

  try {
    const me = await apiFetch<MeResponse>("/api/user/me");
    const projects = me.projects ?? [];
    const match = projects.find(
      (p) => p.id === idOrCustomId || p.customId === idOrCustomId,
    );
    if (!match) {
      console.error(
        pc.red(
          `No accessible project matches "${idOrCustomId}". Run \`sonicbridge project ls\`.`,
        ),
      );
      process.exit(1);
    }
    await saveConfig({
      ...cfg,
      activeProject: {
        id: match.id,
        customId: match.customId ?? null,
        name: match.name,
      },
    });
    console.log(
      pc.green(
        `Active project set to ${match.name}${
          match.customId ? ` (${match.customId})` : ""
        }.`,
      ),
    );
  } catch (err) {
    console.error(pc.red(formatApiError(err)));
    process.exit(1);
  }
}
