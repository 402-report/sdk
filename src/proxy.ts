/**
 * Data-plane routing helpers. Route your agent's HTTP through the 402.report proxy so every
 * x402 (HTTP 402) challenge and payment is observed — you set the API key, nothing else
 * changes. 402.report never holds or settles funds; your agent still makes its own payments.
 */

/** Default hosted proxy base URL. */
export const PROXY_URL = "https://proxy.402.report";

/** Header carrying the caller's 402.report API key. `Authorization: Bearer <key>` also works. */
export const API_KEY_HEADER = "x-402report-key";

/** Header naming the real upstream origin when routing through the proxy. */
export const TARGET_HEADER = "x-402report-target";

export interface ProxyFetchOptions {
  /** Your 402.report API key (create one in the dashboard). */
  apiKey: string;
  /** Override the proxy base URL (e.g. a self-hosted / local proxy). */
  proxyUrl?: string;
  /** Underlying fetch implementation. Defaults to the global `fetch`. */
  fetch?: typeof fetch;
}

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

/** Pull the absolute URL string out of whatever `fetch` accepts. */
function inputToUrl(input: FetchInput): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url; // Request
}

/**
 * Build a `fetch`-compatible function that transparently routes every request through the
 * 402.report proxy. Drop it in anywhere a custom `fetch` is accepted (the Vercel AI SDK, the
 * OpenAI SDK, undici, plain code):
 *
 * ```ts
 * const fetch = createProxyFetch({ apiKey: process.env.REPORT402_API_KEY! });
 * await fetch("https://api.example.com/premium"); // observed by 402.report
 * ```
 *
 * The request is sent to the proxy with the real origin in `x-402report-target`; the path and
 * query are preserved. Requests already aimed at the proxy are passed through untouched.
 */
export function createProxyFetch(options: ProxyFetchOptions): typeof fetch {
  const { apiKey } = options;
  if (!apiKey) throw new Error("createProxyFetch: `apiKey` is required.");
  const proxyBase = (options.proxyUrl ?? PROXY_URL).replace(/\/+$/, "");
  const baseFetch = options.fetch ?? fetch;

  const proxyFetch = async (input: FetchInput, init?: FetchInit): Promise<Response> => {
    const target = new URL(inputToUrl(input));

    // Never double-proxy a request already pointed at the proxy.
    if (`${target.protocol}//${target.host}` === new URL(proxyBase).origin) {
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      if (!headers.has(API_KEY_HEADER) && !headers.has("authorization")) {
        headers.set(API_KEY_HEADER, apiKey);
      }
      return baseFetch(input, { ...init, headers });
    }

    const proxied = `${proxyBase}${target.pathname}${target.search}`;
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set(API_KEY_HEADER, apiKey);
    headers.set(TARGET_HEADER, target.origin);

    // Carry over method/body/etc. from a Request input when the caller didn't pass an init.
    const requestInit: FetchInit =
      input instanceof Request && !init ? { ...requestInitFromRequest(input), headers } : { ...init, headers };

    return baseFetch(proxied, requestInit);
  };

  return proxyFetch as typeof fetch;
}

/** Copy the forwardable fields off a Request so we can retarget it at the proxy. */
function requestInitFromRequest(req: Request): FetchInit {
  return {
    method: req.method,
    body: req.body,
    redirect: req.redirect,
    signal: req.signal,
    credentials: req.credentials,
    // Streaming a Request body through fetch requires this in Node/undici.
    ...(req.body ? { duplex: "half" } : {}),
  } as FetchInit;
}

export interface ProxyClientConfigOptions {
  /** Your 402.report API key. */
  apiKey: string;
  /** The upstream origin you want to reach through the proxy, e.g. "https://api.openai.com". */
  target: string;
  /** Override the proxy base URL. */
  proxyUrl?: string;
}

/**
 * For SDK clients that take a `baseURL` + default headers rather than a custom `fetch`
 * (the OpenAI SDK, axios): point the client at the proxy and let these headers do the routing.
 *
 * ```ts
 * const { baseURL, headers } = proxyClientConfig({ apiKey, target: "https://api.openai.com" });
 * const openai = new OpenAI({ apiKey: OPENAI_KEY, baseURL, defaultHeaders: headers });
 * ```
 */
export function proxyClientConfig(options: ProxyClientConfigOptions): {
  baseURL: string;
  headers: Record<string, string>;
} {
  const { apiKey, target } = options;
  if (!apiKey) throw new Error("proxyClientConfig: `apiKey` is required.");
  if (!target) throw new Error("proxyClientConfig: `target` origin is required.");
  const proxyBase = (options.proxyUrl ?? PROXY_URL).replace(/\/+$/, "");
  return {
    baseURL: proxyBase,
    headers: {
      [API_KEY_HEADER]: apiKey,
      [TARGET_HEADER]: new URL(target).origin,
    },
  };
}
