/**
 * pipeline/classifier.js — Step 5: Classification
 * =================================================
 * Rule-based keyword-score classifier.
 *
 * Threshold:  score >= 35  →  SCAM
 *             score <  35  →  NOT SCAM
 *
 * Mirrors the frontend constant THR = 35 so browser-only and
 * API-backed analysis stay consistent.
 *
 * Future extension: replace classify() with an ML model (Naive Bayes,
 * Transformer, etc.) that consumes the same (hits, score) contract.
 */

"use strict";

const SCAM_THRESHOLD = 60;
const WARNING_THRESHOLD = 35;
const LABEL_SCAM   = "scam";
const LABEL_WARNING = "warning";
const LABEL_NORMAL = "normal";

/**
 * Map a numeric risk score to a verdict.
 *
 * @param {number} score - Weighted sum from extractor, capped at 100
 * @returns {{ isScam: boolean, isWarning: boolean, label: string }}
 */
function classify(score) {
  let isScam = false;
  let isWarning = false;
  let label = LABEL_NORMAL;

  if (score >= SCAM_THRESHOLD) {
    isScam = true;
    label = LABEL_SCAM;
  } else if (score > WARNING_THRESHOLD) {
    isWarning = true;
    label = LABEL_WARNING;
  }

  return {
    isScam,
    isWarning,
    label,
  };
}

function getThreshold() {
  return WARNING_THRESHOLD;
}

module.exports = { classify, getThreshold };
