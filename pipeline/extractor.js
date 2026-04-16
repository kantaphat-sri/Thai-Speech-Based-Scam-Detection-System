/**
 * pipeline/extractor.js — Step 4: Feature Extraction
 * ====================================================
 * Scans tokenised Thai text for four scam-signal categories and returns
 * a hit-map and a weighted risk score (0–100).
 *
 * Pattern dictionary mirrors the frontend PATTERNS object so that
 * browser-fallback analysis and Node.js analysis produce identical scores.
 *
 * [OS CONCEPT]: CPU-BOUND WORK. 
 * This file performs the intensive keyword-matching and scoring. By running 
 * this in a Worker Thread, we avoid blocking the Main Thread's I/O operations.
 */

"use strict";

// ── Pattern Dictionary ────────────────────────────────────────────────────────
// Each category: weight (points added when any keyword is found), label, words
const PATTERNS = {
  otp: {
    weight: 35,
    label: "OTP / รหัส",
    words: [
      "otp", "รหัส", "pin", "รหัสผ่าน", "ยืนยัน", "ยืนยันบัญชี",
      "รหัสลับ", "รหัสธุรกรรม", "รหัสsms", "รหัส6หลัก",
      "ยืนยันตัวตน", "ยืนยันรหัส", "รหัสอ้างอิง",
    ],
  },
  money: {
    weight: 30,
    label: "โอนเงิน / ธุรกรรม",
    words: [
      "โอนเงิน", "โอน", "เงิน", "บาท", "ธุรกรรม", "ระงับ", "ถอน",
      "บัญชี", "ประกัน", "ค่าปรับ", "ชำระ", "จ่าย", "หลักทรัพย์",
      "ค้ำประกัน", "เงินสด", "หนี้", "ยอดเงิน",
    ],
  },
  urgency: {
    weight: 20,
    label: "ความเร่งด่วน",
    words: [
      "ด่วน", "ทันที", "รีบ", "เดี๋ยวนี้", "ภายใน", "นาที",
      "ไม่งั้น", "มิเช่นนั้น", "ก่อน", "เร็ว", "หมดเวลา",
      "ก่อนที่จะสายเกินไป", "วันนี้เท่านั้น", "ตอนนี้",
    ],
  },
  authority: {
    weight: 15,
    label: "อ้างอำนาจ",
    words: [
      "ตำรวจ", "ธนาคาร", "กสิกร", "กรุงไทย", "ไทยพาณิชย์",
      "ศาล", "ดีเอสไอ", "เจ้าหน้าที่", "ไซเบอร์", "กรมสรรพากร",
      "กระทรวง", "สำนักงาน", "ราชการ", "อัยการ", "ป.ป.ช",
      "ออมสิน", "กรุงศรี", "บัวหลวง", "ทหารไทย", "ธนาคารแห่งประเทศไทย",
    ],
  },
};

const MAX_SCORE = 100;

/**
 * Scan tokens and original text for pattern keywords.
 *
 * @param {string[]} tokens      - Tokenised word list from preprocessor
 * @param {string}   originalText - Raw text (for substring matching safety net)
 * @returns {{ hits: Object.<string, string[]>, score: number }}
 */
function extractFeatures(tokens, originalText) {
  const textLower = originalText.toLowerCase();
  const tokenSet  = new Set(tokens);

  const hits  = {};
  let   score = 0;

  for (const [category, cfg] of Object.entries(PATTERNS)) {
    const matched = [];

    for (const kw of cfg.words) {
      // Match if keyword appears as a full token OR as a substring
      if (tokenSet.has(kw) || textLower.includes(kw)) {
        matched.push(kw);
      }
    }

    if (matched.length > 0) {
      hits[category] = deduplicate(matched);
      score         += cfg.weight;
    }
  }

  score = Math.min(score, MAX_SCORE);
  return { hits, score };
}

/** Preserve order while removing duplicates. */
function deduplicate(words) {
  const seen = new Set();
  return words.filter(w => {
    if (seen.has(w)) return false;
    seen.add(w);
    return true;
  });
}

module.exports = { extractFeatures, PATTERNS };
