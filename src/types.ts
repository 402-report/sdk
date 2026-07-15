/**
 * Result shapes returned by the 402.report MCP spend tools. These are hand-mirrored from the
 * server's wire contract and MUST match it exactly. Amounts are in major token units (e.g.
 * USDC), mirroring the server. (A compile-time guard that asserts these stay structurally
 * compatible with the server's canonical DTOs runs in the 402.report monorepo, not here.)
 */

/** Two kinds of observed x402 activity (a paywall hit vs. an accepted payment). */
export type SpendEventType = "challenge" | "payment";

/**
 * Outcome of a single recorded leg of an x402 attempt:
 *  - "challenged"    — origin returned 402 (a paywall was hit); no payment yet.
 *  - "paid_ok"       — the agent's paid retry succeeded (origin returned 2xx).
 *  - "paid_failed"   — the agent paid, but the origin rejected the retry (still 402, or 4xx/5xx).
 *  - "payment_error" — the paid retry never got a clean answer (timeout/unreachable).
 */
export type AttemptOutcome = "challenged" | "paid_ok" | "paid_failed" | "payment_error";

/** Why an x402 attempt failed — the taxonomy surfaced by the forensics tools. */
export type X402ErrorCode =
  | "challenge_unparseable"
  | "paid_but_origin_402"
  | "paid_but_origin_4xx"
  | "paid_but_origin_5xx"
  | "upstream_timeout"
  | "upstream_unreachable"
  | "payment_header_undecodable"
  | "challenge_amount_mismatch"
  | "forbidden_target"
  | "retry_without_payment";

/** Headline totals over a period — the shape of `get_spend_summary`. */
export interface SpendSummary {
  /** Total paid in major token units (e.g. USDC). */
  totalPaid: number;
  /** Number of observed payments. */
  paymentCount: number;
  /** Number of 402 challenges seen (paywalls hit). */
  paywallsHit: number;
  /** Count of distinct destination domains. */
  distinctDomains: number;
  /** Currency of the amounts (currently always "USDC"). */
  currency: string;
  /** ISO start of the period covered. */
  from: string;
  /** ISO end of the period covered. */
  to: string;
}

/** Spend aggregated per destination domain (one row of `get_spend_by_domain`). */
export interface DomainSpend {
  domain: string;
  paidAmount: number;
  paidCount: number;
  challengedCount: number;
}

/** Spend aggregated per agent / API key (one row of `get_spend_by_agent`). */
export interface AgentSpend {
  apiKeyId: string | null;
  apiKeyPrefix: string | null;
  paidAmount: number;
  paidCount: number;
}

/** One observed event as returned by `list_recent_events` (raw snake_case columns). */
export interface SpendEvent {
  created_at: string;
  type: SpendEventType;
  domain: string;
  amount: number;
  asset: string | null;
  signature: string | null;
}

/**
 * One recorded leg of an x402 attempt (an enriched spend_events row). This is the full
 * per-leg record the server returns inside `Attempt.legs` — note `createdAt` /
 * `upstreamLatencyMs` (not `at` / `latencyMs`).
 */
export interface AttemptLeg {
  id: string;
  tenantId: string;
  apiKeyId: string | null;
  apiKeyPrefix: string | null;
  correlationId: string | null;
  createdAt: string;
  method: string | null;
  domain: string;
  resource: string | null;
  type: SpendEventType;
  outcome: AttemptOutcome | null;
  errorCode: X402ErrorCode | null;
  httpStatus: number | null;
  upstreamLatencyMs: number | null;
  amount: number;
  asset: string | null;
  network: string | null;
  signature: string | null;
  payer: string | null;
}

/** A correlated x402 attempt: the challenge and its (optional) paid retry. */
export interface Attempt {
  correlationId: string;
  method: string | null;
  domain: string;
  resource: string | null;
  /** Overall status: the payment leg's outcome if there is one, else "challenged". */
  status: AttemptOutcome;
  errorCode: X402ErrorCode | null;
  amount: number;
  asset: string | null;
  network: string | null;
  challengedAt: string | null;
  paidAt: string | null;
  totalLatencyMs: number | null;
  apiKeyPrefix: string | null;
  /** The legs in chronological order (challenge, then payment if present). */
  legs: AttemptLeg[];
}

/** Headline payment reliability over a period (the `reliability` field of `get_error_breakdown`). */
export interface ReliabilityStats {
  paidOk: number;
  paidFailed: number;
  paymentError: number;
  /** (paidFailed + paymentError) / all payment attempts; 0 when there are none. */
  failureRate: number;
}

/** Count of failing legs per error code (one row of `get_error_breakdown`'s `errors`). */
export interface ErrorBreakdownEntry {
  errorCode: X402ErrorCode;
  count: number;
}

export interface SpendByDomainResult {
  from: string;
  to: string;
  domains: DomainSpend[];
}

export interface SpendByAgentResult {
  from: string;
  to: string;
  agents: AgentSpend[];
}

export interface RecentEventsResult {
  events: SpendEvent[];
}

export interface FailedPaymentsResult {
  from: string;
  to: string;
  attempts: Attempt[];
}

export interface ErrorBreakdownResult {
  from: string;
  to: string;
  reliability: ReliabilityStats;
  errors: ErrorBreakdownEntry[];
}

/** A time window accepted by most spend queries (ISO 8601). */
export interface RangeInput {
  from?: string;
  to?: string;
}
