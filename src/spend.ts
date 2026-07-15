/**
 * `SpendClient` — query your agents' 402.report x402 spend and forensics in code, by API key.
 * Wraps the read-only MCP tools over Streamable HTTP (the same channel Mastra / the AI SDK use).
 * Import path: `@402report/sdk/spend` (opt-in; requires `@modelcontextprotocol/sdk`).
 *
 * ```ts
 * import { SpendClient } from "@402report/sdk/spend";
 * const spend = new SpendClient({ apiKey: process.env.REPORT402_API_KEY! });
 * const summary = await spend.getSpendSummary();          // last 30 days
 * const failed  = await spend.listFailedPayments({ limit: 20 });
 * await spend.close();
 * ```
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { MCP_URL } from "./mcp-config.js";
import type {
  Attempt,
  ErrorBreakdownResult,
  FailedPaymentsResult,
  RangeInput,
  RecentEventsResult,
  SpendByAgentResult,
  SpendByDomainResult,
  SpendSummary,
} from "./types.js";

export interface SpendClientOptions {
  /** Your 402.report API key. */
  apiKey: string;
  /** Override the MCP endpoint (e.g. a local proxy at http://localhost:8402/mcp). */
  mcpUrl?: string;
}

export class SpendClient {
  private readonly url: string;
  private readonly authHeader: string;
  private client: Client | null = null;
  private connecting: Promise<Client> | null = null;

  constructor(options: SpendClientOptions) {
    if (!options.apiKey) throw new Error("SpendClient: `apiKey` is required.");
    this.url = options.mcpUrl ?? MCP_URL;
    this.authHeader = `Bearer ${options.apiKey}`;
  }

  /** Lazily connect (and dedupe concurrent connects) on first tool call. */
  private ensureConnected(): Promise<Client> {
    if (this.client) return Promise.resolve(this.client);
    if (!this.connecting) {
      this.connecting = (async () => {
        const transport = new StreamableHTTPClientTransport(new URL(this.url), {
          requestInit: { headers: { Authorization: this.authHeader } },
        });
        const client = new Client({ name: "@402report/sdk", version: "0.1.0" });
        await client.connect(transport);
        this.client = client;
        return client;
      })();
    }
    return this.connecting;
  }

  private async call<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const client = await this.ensureConnected();
    const result = await client.callTool({ name, arguments: args });
    const content = result.content as Array<{ type: string; text?: string }> | undefined;
    const text =
      content
        ?.filter((c) => c.type === "text")
        .map((c) => c.text ?? "")
        .join("\n") ?? "";
    if (!text) throw new Error(`402.report MCP tool "${name}" returned no text content.`);
    return JSON.parse(text) as T;
  }

  /** Headline totals over a period (default: last 30 days). */
  getSpendSummary(range: RangeInput = {}): Promise<SpendSummary> {
    return this.call("get_spend_summary", { ...range });
  }

  /** USDC paid, payments, and paywalls hit per destination domain. */
  getSpendByDomain(opts: RangeInput & { limit?: number } = {}): Promise<SpendByDomainResult> {
    return this.call("get_spend_by_domain", { ...opts });
  }

  /** Spend per agent (API key). */
  getSpendByAgent(range: RangeInput = {}): Promise<SpendByAgentResult> {
    return this.call("get_spend_by_agent", { ...range });
  }

  /** The most recent observed events (challenges and/or payments), newest first. */
  listRecentEvents(
    opts: { limit?: number; type?: "challenge" | "payment" } = {},
  ): Promise<RecentEventsResult> {
    return this.call("list_recent_events", { ...opts });
  }

  /** Attempts where the agent PAID but it didn't work (still 402, 4xx/5xx, or never landed). */
  listFailedPayments(opts: RangeInput & { limit?: number } = {}): Promise<FailedPaymentsResult> {
    return this.call("list_failed_payments", { ...opts });
  }

  /** Payment-failure rate + a breakdown by error type over a period. */
  getErrorBreakdown(range: RangeInput = {}): Promise<ErrorBreakdownResult> {
    return this.call("get_error_breakdown", { ...range });
  }

  /**
   * The full timeline of one x402 attempt by its correlation id, or `null` if no attempt
   * exists for that id (the server returns `{ error }` in that case).
   */
  async getAttemptTimeline(correlationId: string): Promise<Attempt | null> {
    const result = await this.call<Attempt | { error: string }>("get_attempt_timeline", {
      correlationId,
    });
    return result && "error" in result ? null : (result as Attempt);
  }

  /** Close the underlying MCP connection. */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.connecting = null;
    }
  }
}
