import path from "node:path";

/**
 * Workspace root: the rover package directory (run CLI/runtime with `cwd` here).
 */
export const WORKSPACE_ROOT = process.cwd();

export function workspacePath(...segments: string[]): string {
  return path.join(WORKSPACE_ROOT, ...segments);
}

/** Well-known files at repo root (not inside src/). */
export const paths = {
  root: WORKSPACE_ROOT,
  packageJson: () => workspacePath("package.json"),
  env: () => workspacePath(".env"),
  /** Legacy JSON config; prefer `rover.config.ts` + env. */
  userConfigJson: () => workspacePath("user-config.json"),
  roverConfigTs: () => workspacePath("rover.config.ts"),
};
