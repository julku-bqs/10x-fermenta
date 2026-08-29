/**
 * Cost conversion for the eval harness.
 *
 * The Copilot SDK reports usage in AI credits (AIC), not native USD. USD is
 * derived here by a single linear conversion so the whole harness has exactly
 * one place that encodes the price.
 *
 * `USD_PER_AI_CREDIT` is GitHub's official AI-credit rate — $0.01 per AI credit,
 * the same rate GitHub bills for overage — per the Copilot billing docs:
 * https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing
 * If GitHub's pricing changes, edit this one constant (and re-check the rate).
 */
export const USD_PER_AI_CREDIT = 0.01;

/**
 * Convert SDK-reported AI credits to USD. Tolerates `undefined` (BYOK or
 * unreported usage) by treating it as zero cost rather than throwing.
 */
export function creditsToUsd(aiCredits: number | undefined): number {
  return (aiCredits ?? 0) * USD_PER_AI_CREDIT;
}
