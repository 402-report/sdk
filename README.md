# @402report/sdk

Route your AI agents' HTTP through [402.report](https://402.report) so every **x402** (HTTP 402)
challenge and payment is observed — and query that spend in code. Set one API key and go.

402.report is **non-custodial**: it observes your agents' x402 activity, it never holds or
settles funds. Your agent still makes its own payments.

```bash
npm install @402report/sdk
```

Create an API key in the 402.report dashboard, then set it (e.g. `REPORT402_API_KEY`).

## 1. Route your agent's HTTP

`createProxyFetch` returns a drop-in `fetch` that transparently routes every request through the
proxy. Use it anywhere a custom `fetch` is accepted:

```ts
import { createProxyFetch } from "@402report/sdk";

const fetch = createProxyFetch({ apiKey: process.env.REPORT402_API_KEY! });

// Observed by 402.report — the real request still goes to api.example.com.
const res = await fetch("https://api.example.com/premium");
```

For SDK clients that take a `baseURL` + headers instead of a `fetch` (the OpenAI SDK, axios):

```ts
import { proxyClientConfig } from "@402report/sdk";
import OpenAI from "openai";

const { baseURL, headers } = proxyClientConfig({
  apiKey: process.env.REPORT402_API_KEY!,
  target: "https://api.openai.com",
});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY!, baseURL, defaultHeaders: headers });
```

## 2. Give your agent its spend as MCP tools

The 402.report MCP server exposes your spend + forensics as read-only tools. These helpers return
the exact config shapes each framework/client expects (no framework imports):

```ts
import { mastraMcpServer, aiSdkMcpTransport, mcpClientJson } from "@402report/sdk";

// Mastra
import { MCPClient } from "@mastra/mcp";
const mcp = new MCPClient({ servers: { report402: mastraMcpServer({ apiKey }) } });
const tools = await mcp.getTools();

// Vercel AI SDK
import { experimental_createMCPClient as createMCPClient } from "ai";
const client = await createMCPClient({ transport: aiSdkMcpTransport({ apiKey }) });

// Claude Desktop / Cursor / VS Code / Windsurf — write this JSON into their MCP config:
console.log(JSON.stringify(mcpClientJson({ apiKey }), null, 2));
```

## 3. Query spend in code

```ts
import { SpendClient } from "@402report/sdk/spend";

const spend = new SpendClient({ apiKey: process.env.REPORT402_API_KEY! });
const summary = await spend.getSpendSummary();            // last 30 days
const failed = await spend.listFailedPayments({ limit: 20 }); // paid-but-failed attempts
await spend.close();
```

`SpendClient` speaks MCP over Streamable HTTP and needs `@modelcontextprotocol/sdk` (installed as
a dependency). The routing/config helpers above have no runtime dependencies.

## API

| Export | What it does |
| --- | --- |
| `createProxyFetch({ apiKey, proxyUrl? })` | A `fetch` that routes requests through the proxy. |
| `proxyClientConfig({ apiKey, target, proxyUrl? })` | `{ baseURL, headers }` for baseURL-style clients. |
| `mcpHttpConfig` / `mastraMcpServer` / `aiSdkMcpTransport` / `mcpClientJson` | MCP connection config per framework/client. |
| `SpendClient` (`@402report/sdk/spend`) | Typed spend + forensics queries by API key. |
| `PROXY_URL`, `MCP_URL` | Hosted endpoint defaults. |

## Self-hosting / local dev

Point at a local proxy with `proxyUrl` / `mcpUrl` (e.g. `http://localhost:8402` and
`http://localhost:8402/mcp`).
