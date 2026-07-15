/**
 * @402report/sdk — route your AI agents' HTTP through 402.report and wire your framework's MCP
 * client to your spend, by setting one API key.
 *
 * - Routing: `createProxyFetch`, `proxyClientConfig`
 * - MCP config for frameworks/clients: `mcpHttpConfig`, `mastraMcpServer`, `aiSdkMcpTransport`,
 *   `mcpClientJson`
 * - Query spend in code: `import { SpendClient } from "@402report/sdk/spend"` (opt-in; needs
 *   `@modelcontextprotocol/sdk`).
 *
 * 402.report is non-custodial: it observes x402 activity, it never holds or settles funds.
 */

export {
  PROXY_URL,
  API_KEY_HEADER,
  TARGET_HEADER,
  createProxyFetch,
  proxyClientConfig,
  type ProxyFetchOptions,
  type ProxyClientConfigOptions,
} from "./proxy.js";

export {
  MCP_URL,
  mcpHttpConfig,
  mastraMcpServer,
  aiSdkMcpTransport,
  mcpClientJson,
  type McpConfigOptions,
} from "./mcp-config.js";

export type * from "./types.js";
