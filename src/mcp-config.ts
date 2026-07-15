/**
 * MCP connection config builders. The 402.report MCP server exposes your agents' x402 spend +
 * forensics as read-only tools; these helpers return the exact config shapes popular agent
 * frameworks and MCP clients expect. They import no framework — just plain objects.
 */

import { PROXY_URL } from "./proxy.js";

/** Default hosted MCP endpoint (Streamable HTTP). */
export const MCP_URL = `${PROXY_URL}/mcp`;

export interface McpConfigOptions {
  /** Your 402.report API key. */
  apiKey: string;
  /** Override the MCP endpoint URL (e.g. a local proxy at http://localhost:8402/mcp). */
  mcpUrl?: string;
}

function resolve(options: McpConfigOptions): { url: string; authHeader: string } {
  if (!options.apiKey) throw new Error("402.report MCP config: `apiKey` is required.");
  return { url: options.mcpUrl ?? MCP_URL, authHeader: `Bearer ${options.apiKey}` };
}

/** Generic bits: the endpoint URL and the Authorization header. */
export function mcpHttpConfig(options: McpConfigOptions): {
  url: string;
  headers: { Authorization: string };
} {
  const { url, authHeader } = resolve(options);
  return { url, headers: { Authorization: authHeader } };
}

/**
 * A Mastra `MCPClient` server entry:
 *
 * ```ts
 * import { MCPClient } from "@mastra/mcp";
 * import { mastraMcpServer } from "@402report/sdk";
 * const mcp = new MCPClient({ servers: { report402: mastraMcpServer({ apiKey }) } });
 * const tools = await mcp.getTools(); // hand to your agent
 * ```
 */
export function mastraMcpServer(options: McpConfigOptions): {
  url: URL;
  requestInit: { headers: { Authorization: string } };
} {
  const { url, authHeader } = resolve(options);
  return { url: new URL(url), requestInit: { headers: { Authorization: authHeader } } };
}

/**
 * A Vercel AI SDK MCP transport config (for `createMCPClient` / `experimental_createMCPClient`):
 *
 * ```ts
 * import { experimental_createMCPClient as createMCPClient } from "ai";
 * import { aiSdkMcpTransport } from "@402report/sdk";
 * const client = await createMCPClient({ transport: aiSdkMcpTransport({ apiKey }) });
 * const tools = await client.tools();
 * ```
 */
export function aiSdkMcpTransport(options: McpConfigOptions): {
  type: "http";
  url: string;
  headers: { Authorization: string };
} {
  const { url, authHeader } = resolve(options);
  return { type: "http", url, headers: { Authorization: authHeader } };
}

/**
 * A standard MCP client JSON config block (Claude Desktop, Cursor, VS Code, Windsurf, …):
 *
 * ```jsonc
 * { "mcpServers": { "402report": { "type": "http", "url": "…/mcp", "headers": { … } } } }
 * ```
 */
export function mcpClientJson(options: McpConfigOptions): {
  mcpServers: Record<string, { type: "http"; url: string; headers: { Authorization: string } }>;
} {
  const { url, authHeader } = resolve(options);
  return {
    mcpServers: {
      "402report": { type: "http", url, headers: { Authorization: authHeader } },
    },
  };
}
