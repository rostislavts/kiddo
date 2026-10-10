// Test process only: imported through NODE_OPTIONS by tests/e2e/server.ts.
// Production code has no test mode or authentication bypass.
const realFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith("https://sandbox-api.paddle.com/")) {
    return realFetch(
      url.replace("https://sandbox-api.paddle.com", "http://127.0.0.1:54329/paddle"),
      init,
    );
  }
  if (url.startsWith("https://api.openai.com/"))
    return realFetch(url.replace("https://api.openai.com", "http://127.0.0.1:54329/openai"), init);
  return realFetch(input, init);
};
