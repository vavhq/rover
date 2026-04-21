import "dotenv/config";
import { test } from "bun:test";

const key =
  process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY || process.env.LLM_API_KEY || "";

const engineTest = key.trim() ? test : test.skip;

engineTest("engine: agent loop boot (dry-run)", async () => {
  // The OpenAI SDK expects OPENAI_API_KEY. Map other keys to keep tests ergonomic.
  process.env.OPENAI_API_KEY ||= key.trim();
  process.env.DRY_RUN ||= "true";

  const { agentLoop } = await import("../../src/core/engine");

  const result = await agentLoop("Return a one-sentence status report.", 1);
  if (typeof result !== "string" || result.length < 1) {
    throw new Error("agentLoop returned empty result");
  }
});
