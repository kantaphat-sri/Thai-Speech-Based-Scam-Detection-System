/**
 * pipeline/preprocessor.js — Step 3: Text Preprocessing & Tokenization
 * ======================================================================
 * Thai text does not use spaces between words. This module normalises and
 * tokenises Thai input.
 *
 * Full Thai NLP (dictionary-based word segmentation) requires a native
 * library. This implementation uses a robust fallback that:
 *   1. Strips noise and lowercases
 *   2. Splits on whitespace for Latin/digit runs
 *   3. Uses a character-window slide for Thai script runs
 *
 * Optional: install `node-pythainlp` or call a local PyThaiNLP HTTP
 * micro-service for production-grade tokenisation.
 *
 * [OS CONCEPT]: This module represents SEQUENTIAL EXECUTION.
 * Although it runs inside a Parallel Worker, the internal logic is 
 * deterministic and sequential to ensure predictable Thai tokenization.
 */

"use strict";

// Stop-words: very common Thai particles that carry no semantic weight
const STOPWORDS = new Set([
  "ครับ", "ค่ะ", "คะ", "นะ", "นะครับ", "นะคะ",
  "ก็", "แล้ว", "และ", "ที่", "ใน", "ของ", "กับ",
  "ว่า", "มา", "ได้", "จะ", "เป็น", "คือ",
]);

// Thai Unicode range: U+0E00–U+0E7F
const THAI_RE    = /[\u0E00-\u0E7F]/;
const LATIN_RE   = /^[a-z0-9]+$/;
const NOISE_RE   = /[^\u0E00-\u0E7Fa-z0-9\s]/g;
const SPACE_RE   = /\s+/g;
const HTML_RE    = /<[^>]+>/g;

const WINDOW = 3; // fallback character window size

/**
 * Normalise and tokenise Thai text.
 *
 * @param {string} text
 * @returns {string[]} Array of meaningful tokens
 */
function preprocess(text) {
  text   = normalise(text);
  const tokens = tokenise(text);
  return clean(tokens);
}

// ── Internals ─────────────────────────────────────────────────────────────────

function normalise(text) {
  text = text.toLowerCase();
  text = text.replace(HTML_RE, " ");          // strip HTML tags
  text = text.replace(NOISE_RE, " ");         // keep only Thai + latin + digits
  text = text.replace(SPACE_RE, " ").trim();
  return text;
}

function tokenise(text) {
  const tokens = [];

  for (const chunk of text.split(/\s+/)) {
    if (!chunk) continue;

    // Latin/digit word — keep as-is
    if (LATIN_RE.test(chunk)) {
      tokens.push(chunk);
      continue;
    }

    // Mixed or Thai run — segment by script
    let i = 0;
    while (i < chunk.length) {
      // Collect consecutive Latin/digit characters
      if (LATIN_RE.test(chunk[i])) {
        let j = i;
        while (j < chunk.length && LATIN_RE.test(chunk[j])) j++;
        tokens.push(chunk.slice(i, j));
        i = j;
        continue;
      }

      // Collect Thai characters using sliding window
      if (THAI_RE.test(chunk[i])) {
        let j = i;
        while (j < chunk.length && THAI_RE.test(chunk[j])) j++;
        const thaiRun = chunk.slice(i, j);
        // Slide a window across the Thai run
        for (let k = 0; k < thaiRun.length; k += WINDOW) {
          tokens.push(thaiRun.slice(k, k + WINDOW));
        }
        i = j;
        continue;
      }

      // Skip unknown characters
      i++;
    }
  }

  return tokens;
}

function clean(tokens) {
  return tokens
    .map(t => t.trim())
    .filter(t => t.length > 0)
    .filter(t => !STOPWORDS.has(t))
    .filter(t => !(t.length === 1 && !/[a-z0-9]/.test(t)));
}

module.exports = { preprocess };
