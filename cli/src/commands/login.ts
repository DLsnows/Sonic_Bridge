import pc from "picocolors";
import { apiFetch, ApiError, formatApiError } from "../api.js";
import {
  DEFAULT_BASE_URL,
  loadConfig,
  saveConfig,
  type CliConfig,
} from "../config.js";
import { promptPassword, promptText } from "../util/prompt.js";

export interface LoginFlags {
  baseUrl?: string;
  token?: string;
}

interface MeResponse {
  user: {
    id: string;
    username: string;
    email: string;
    avatar?: string | null;
  };
  projects?: Array<{
    id: string;
    customId?: string | null;
    name: string;
    role: string;
  }>;
}

export async function runLogin(flags: LoginFlags): Promise<void> {
  const existing = (await loadConfig()) ?? ({} as CliConfig);

  // Resolve baseUrl
  let baseUrl = flags.baseUrl;
  if (!baseUrl) {
    baseUrl = await promptText("Base URL", {
      initial: existing.baseUrl ?? DEFAULT_BASE_URL,
    });
    if (!baseUrl) {
      console.error(pc.red("Login cancelled."));
      process.exit(1);
    }
  }
  baseUrl = baseUrl.replace(/\/+$/, "");

  // Resolve token
  let token = flags.token;
  if (!token) {
    token = await promptPassword("CLI token (input hidden)");
    if (!token) {
      console.error(pc.red("Login cancelled."));
      process.exit(1);
    }
  }

  // Validate via /api/user/me
  try {
    const me = await apiFetch<MeResponse>("/api/user/me", {
      baseUrl,
      token,
    });
    const cfg: CliConfig = {
      ...existing,
      baseUrl,
      token,
    };
    await saveConfig(cfg);
    console.log(
      pc.green(`Logged in as ${me.user.username} (${me.user.email}).`),
    );
    if (me.projects && me.projects.length > 0) {
      console.log(
        pc.dim(
          `Access to ${me.projects.length} project${me.projects.length === 1 ? "" : "s"}. Run \`sonicbridge project ls\` to list.`,
        ),
      );
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      console.error(pc.red("Login failed: invalid token."));
    } else if (err instanceof ApiError && err.status === 404) {
      console.error(
        pc.red(
          "Login failed: /api/user/me not found. Is the server up to date?",
        ),
      );
    } else {
      console.error(pc.red(`Login failed: ${formatApiError(err)}`));
    }
    process.exit(1);
  }
}
