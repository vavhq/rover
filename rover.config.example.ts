export type RoverPreset = "conservative" | "moderate" | "aggressive";

export type RoverConfig = {
  /**
   * Swarm (Beacon) base URL.
   * Production: https://swarm.vav.sh
   */
  swarmUrl: string;

  /**
   * Scout key generated in vav.sh dashboard (starts with `sc_`).
   * Used for:
   * - auth header: x-vav-scout-key
   * - HMAC signing key for Beacon.signature
   */
  scoutKey: string;

  /**
   * Safety default. Keep true until you're confident.
   * You can also use DRY_RUN=true in `.env`.
   */
  dryRun: true;

  preset: RoverPreset;

  /**
   * Optional: dedicated Jupiter referral wallet.
   * Public builds embed vav.sh referral by default.
   */
  referralWallet?: string;
};

export const roverConfig: RoverConfig = {
  swarmUrl: "https://swarm.vav.sh",
  scoutKey: "sc_xxx",
  dryRun: true,
  preset: "conservative",
};
