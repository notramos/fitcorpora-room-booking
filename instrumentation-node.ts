// Node's built-in fetch() emits a DEP0108 deprecation warning internally
// while gzip-decompressing responses (triggered by the Google Sheets API
// calls in lib/sheetsDb.ts) — it's not caused by our code and there's
// nothing to fix on our end, so only this specific warning is filtered
// out. All other process warnings still print normally.
process.on("warning", (warning) => {
  if (
    warning.name === "DeprecationWarning" &&
    warning.message.includes("zlib.bytesRead")
  ) {
    return;
  }
  console.warn(warning);
});

export {};
