/**
 * pipeline/combinedScorer.js — Tone + Text Combined Scam Score
 * =============================================================
 * Merges the keyword-based text score with the acoustic tone score
 * into a single final scam probability score (0–100).
 *
 * Formula
 * -------
 *   finalScore = (textScore × TEXT_WEIGHT) + (toneScore × TONE_WEIGHT)
 *
 * Weights are configurable. Default: 60% text / 40% tone.
 *
 * Boost rules (multiplicative amplifiers):
 *   • Both scores are HIGH (≥ 50)  → +15 bonus (strong corroboration)
 *   • Tone alone is very HIGH (≥ 70) with any text hit → +10 bonus
 *
 * The combined classifier threshold is kept at 35 (same as text-only),
 * so existing tests stay consistent. The combined score just provides
 * a richer signal.
 */

"use strict";

const TEXT_WEIGHT = 0.60;
const TONE_WEIGHT = 0.40;

const CLASSIFY_THRESHOLD_SCAM = 60;
const CLASSIFY_THRESHOLD_WARNING = 35;

/**
 * Combine text score and tone score into a final verdict.
 *
 * @param {number} textScore  - 0–100 from extractor.js
 * @param {number} toneScore  - 0–100 from toneAnalyzer.js
 * @param {string[]} toneSignals - detected tone signal keys
 * @returns {{
 *   finalScore: number,
 *   isScam: boolean,
 *   label: string,
 *   breakdown: object,
 *   verdict: string
 * }}
 */
function combineScores(textScore, toneScore, toneSignals = []) {
  let combined = (textScore * TEXT_WEIGHT) + (toneScore * TONE_WEIGHT);

  // ── Boost rules ───────────────────────────────────────────────────────────
  const boosts = [];

  if (textScore >= 50 && toneScore >= 50) {
    combined += 15;
    boosts.push("both_high (+15)");
  }

  if (toneScore >= 70 && textScore > 0) {
    combined += 10;
    boosts.push("tone_very_high (+10)");
  }

  const finalScore = Math.min(Math.round(combined), 100);
  let isScam = false;
  let isWarning = false;
  let label = "normal";

  if (finalScore >= CLASSIFY_THRESHOLD_SCAM) {
      isScam = true;
      label = "scam";
  } else if (finalScore > CLASSIFY_THRESHOLD_WARNING) {
      isWarning = true;
      label = "warning";
  }

  const riskLevel  = isScam ? "HIGH" : isWarning ? "MODERATE" : "LOW";

  return {
    finalScore,
    isScam,
    isWarning,
    label,
    breakdown: {
      textScore,
      toneScore,
      toneSignals,
      textContribution:  Math.round(textScore * TEXT_WEIGHT),
      toneContribution:  Math.round(toneScore * TONE_WEIGHT),
      boosts,
    },
    verdict: `${riskLevel} RISK — Combined score ${finalScore}/100`,
  };
}

/**
 * Build a human-readable explanation of the combined result.
 *
 * @param {object} result - return value of combineScores()
 * @param {object} hits   - keyword hits map from extractor.js
 * @param {string} toneSummary - summary string from toneAnalyzer.js
 */
function explainResult(result, hits, toneSummary) {
  const lines = [];
  const { breakdown, finalScore, label } = result;

  lines.push(`📊 Final Score: ${finalScore}/100 → ${label.toUpperCase()}`);
  lines.push(`   Text  (${Math.round(TEXT_WEIGHT * 100)}%): ${breakdown.textScore} pts → contributes ${breakdown.textContribution}`);
  lines.push(`   Tone  (${Math.round(TONE_WEIGHT * 100)}%): ${breakdown.toneScore} pts → contributes ${breakdown.toneContribution}`);

  if (breakdown.boosts.length) {
    lines.push(`   Boosts: ${breakdown.boosts.join(", ")}`);
  }

  if (Object.keys(hits).length) {
    const hitSummary = Object.entries(hits)
      .map(([cat, words]) => `${cat}(${words.length})`)
      .join(", ");
    lines.push(`   Keywords: ${hitSummary}`);
  }

  if (toneSummary) {
    lines.push(`   Tone: ${toneSummary}`);
  }

  return lines.join("\n");
}

module.exports = { combineScores, explainResult, TEXT_WEIGHT, TONE_WEIGHT, CLASSIFY_THRESHOLD_SCAM, CLASSIFY_THRESHOLD_WARNING };
