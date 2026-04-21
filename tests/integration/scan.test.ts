import { test } from "bun:test";

const base = String(process.env.VAV_DISCOVERY_API_URL || "").trim();
const scanTest = base ? test : test.skip;

scanTest("scan: discovery endpoints respond", async () => {
  const { discoverPools, getPoolDetail } = await import("../../src/tools/scan");

  const top = await discoverPools({ page_size: 3, timeframe: "24h", category: "top" });
  if (!top || !Array.isArray(top.pools)) {
    throw new Error("discoverPools returned invalid shape");
  }

  if (top.pools.length > 0) {
    const poolAddr = top.pools[0].pool;
    const detail = await getPoolDetail({ pool_address: poolAddr });
    if (!detail) throw new Error("getPoolDetail returned empty");
  }
});
