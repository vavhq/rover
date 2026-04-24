import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { paths, workspacePath } from "@/lib/paths";

export type RoverPreset = "conservative" | "moderate" | "aggressive" | "safe" | "degen";

export type RoverConfigFile = {
  // GoRover dashboard fields (auto-generated — do not edit)
  goroverScoutKey?: string;
  goroverSwarmUrl?: string;
  roverId?: string;

  swarmUrl?: string;
  scoutKey?: string;

  dryRun?: boolean;
  preset?: RoverPreset;
  strategyKind?: "official" | "custom" | "legacy";
  strategyId?: string;
  strategySpecVersion?: string;
  protocolVersion?: string;

  // optional operational settings (secrets should stay in .env)
  rpcUrl?: string;
  walletKey?: string;
  llmApiKey?: string;
  llmKey?: string;
  llmBaseUrl?: string;
  llmModel?: string;

  // Safety fields
  minBalanceSol?: number;
  minPositionSol?: number;
  slippageBps?: number;
  maxPositions?: number;
  seekerIntervalMs?: number;
  keeperIntervalMs?: number;
  telegramChatId?: string;
};

export type RoverConfigLoadResult = {
  configPath: string;
  roverConfig: RoverConfigFile;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export async function loadRoverConfig(configPathArg: string): Promise<RoverConfigLoadResult> {
  const abs = path.isAbsolute(configPathArg) ? configPathArg : workspacePath(configPathArg);

  if (!fs.existsSync(abs)) {
    throw new Error(`Config file not found: ${abs}`);
  }

  // bun can import TS directly; for node users this requires a loader.
  const mod = await import(pathToFileURL(abs).href);
  const roverConfig: unknown = (mod && (mod.roverConfig ?? mod.default ?? mod.config)) || null;

  if (!isRecord(roverConfig)) {
    throw new Error("Invalid rover config: expected `export const roverConfig = { ... }`");
  }

  return {
    configPath: abs,
    roverConfig: roverConfig as RoverConfigFile,
  };
}

/**
 * Apply rover.config.ts into env and also persist a local JSON snapshot used by runtime.
 * This keeps runtime synchronous while the canonical user-facing config remains TS.
 */
export function applyRoverConfig({ roverConfig }: { roverConfig: RoverConfigFile }) {
  if (roverConfig.rpcUrl) process.env.RPC_URL ||= String(roverConfig.rpcUrl);
  if (roverConfig.walletKey) process.env.WALLET_PRIVATE_KEY ||= String(roverConfig.walletKey);
  if (roverConfig.llmApiKey) process.env.LLM_API_KEY ||= String(roverConfig.llmApiKey);
  if (roverConfig.llmBaseUrl) process.env.LLM_BASE_URL ||= String(roverConfig.llmBaseUrl);
  if (roverConfig.llmModel) process.env.LLM_MODEL ||= String(roverConfig.llmModel);

  // Safety default (roadmap): DRY_RUN=true unless explicitly disabled.
  if (roverConfig.dryRun === false) {
    process.env.DRY_RUN = "false";
  } else {
    process.env.DRY_RUN ||= "true";
  }

  if (roverConfig.llmKey) process.env.LLM_API_KEY ||= String(roverConfig.llmKey);
  if (roverConfig.telegramChatId)
    process.env.TELEGRAM_CHAT_ID ||= String(roverConfig.telegramChatId);

  if (roverConfig.roverId) process.env.GOROVER_ROVER_ID ||= String(roverConfig.roverId);
  const scoutKey = roverConfig.goroverScoutKey ?? roverConfig.scoutKey;
  if (scoutKey) process.env.GOROVER_SCOUT_KEY ||= String(scoutKey);
  const swarmUrl = roverConfig.goroverSwarmUrl ?? roverConfig.swarmUrl;
  if (swarmUrl) process.env.GOROVER_SWARM_API_BASE ||= String(swarmUrl);
  if (roverConfig.strategyKind) process.env.GOROVER_STRATEGY_KIND ||= String(roverConfig.strategyKind);
  if (roverConfig.strategyId) process.env.GOROVER_STRATEGY_ID ||= String(roverConfig.strategyId);
  if (roverConfig.strategySpecVersion)
    process.env.GOROVER_STRATEGY_SPEC_VERSION ||= String(roverConfig.strategySpecVersion);
  if (roverConfig.protocolVersion)
    process.env.GOROVER_PROTOCOL_VERSION ||= String(roverConfig.protocolVersion);

  // Persist a snapshot for synchronous config loading.
  const jsonPath = workspacePath("rover.config.json");
  try {
    fs.writeFileSync(jsonPath, JSON.stringify(roverConfig, null, 2));
  } catch {
    // ignore
  }

  // Back-compat: runtime config currently reads user-config.json.
  // We keep it internal (gitignored) and regenerate from rover.config.ts as needed.
  const legacy = {
    roverId: roverConfig.roverId,
    rpcUrl: roverConfig.rpcUrl,
    walletKey: roverConfig.walletKey,
    llmApiKey: roverConfig.llmApiKey,
    llmBaseUrl: roverConfig.llmBaseUrl,
    llmModel: roverConfig.llmModel,
    dryRun: roverConfig.dryRun ?? true,
    swarmUrl: roverConfig.swarmUrl,
    scoutKey: roverConfig.scoutKey,
    preset: roverConfig.preset,
    strategyKind: roverConfig.strategyKind,
    strategyId: roverConfig.strategyId,
    strategySpecVersion: roverConfig.strategySpecVersion,
    protocolVersion: roverConfig.protocolVersion,
  };
  try {
    fs.writeFileSync(paths.userConfigJson(), JSON.stringify(legacy, null, 2));
  } catch {
    // ignore
  }
}
