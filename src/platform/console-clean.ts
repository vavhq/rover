// @ts-nocheck
/**
 * Console hygiene for production deployments.
 *
 * Must be imported before any other modules that might emit noisy warnings.
 */

const _warn = console.warn.bind(console);
console.warn = (...args) => {
  try {
    const msg = String(args?.[0] ?? "");
    // bigint-buffer optional native addon warning (harmless, noisy in containers)
    if (msg.includes("bigint: Failed to load bindings, pure JS will be used")) return;
  } catch {
    // ignore
  }
  _warn(...args);
};

