// Runs in the PAGE's main world at document_start. Tees streamed AI responses so Baton can keep what the
// page received while it streamed (including output that is never persisted or that a share redacts).
// Only response bodies of known conversation-stream endpoints are observed; nothing is modified or sent anywhere.

const STREAM_PATTERNS = [
  /\/backend-api\/(?:f\/)?conversation(?:\?|$)/, // ChatGPT
  /\/api\/organizations\/[^/]+\/chat_conversations\/[^/]+\/(?:completion|retry_completion)/, // Claude
  /BardFrontendService\/StreamGenerate/, // Gemini
  /\/__baton_test_stream/, // test harness
];
const MAX_BODY = 2 * 1024 * 1024;

const w = window as unknown as { __batonTap?: boolean; fetch: typeof fetch };
if (!w.__batonTap) {
  w.__batonTap = true;
  const orig = w.fetch.bind(window);
  w.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await orig(input, init);
    try {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (STREAM_PATTERNS.some((re) => re.test(url))) {
        res
          .clone()
          .text()
          .then((body) => window.postMessage({ source: 'baton-tap', url, status: res.status, at: new Date().toISOString(), body: body.slice(0, MAX_BODY), truncated: body.length > MAX_BODY }, window.location.origin))
          .catch(() => {});
      }
    } catch {
      /* never break the page */
    }
    return res;
  };
}
