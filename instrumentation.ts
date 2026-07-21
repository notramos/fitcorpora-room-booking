export async function register() {
  // instrumentation.ts's register() also runs under the Edge runtime (e.g.
  // for middleware), where Node-only APIs like `process.on` don't exist.
  // The Node-specific logic lives in its own module and is dynamically
  // imported here so the Edge bundler never statically analyzes it.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
