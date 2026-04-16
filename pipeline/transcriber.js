/**
 * pipeline/transcriber.js — Step 2: Speech-to-Text
 * ==================================================
 * Handles audio transcription. In production, integrate a Thai ASR service
 * such as PyThaiASR (via a local Python micro-service), Google Speech-to-Text,
 * or Azure Cognitive Services.
 *
 * This module provides:
 *   - A stub that returns a helpful message when no ASR is configured
 *   - A hook (TRANSCRIBE_URL env var) to forward audio to an external
 *     PyThaiASR HTTP service
 *
 * To run PyThaiASR as a sidecar service:
 *   pip install pythaiasr flask
 *   python pythaiasr_service.py   # listens on :5001
 *   TRANSCRIBE_URL=http://localhost:5001/transcribe node server.js
 */

"use strict";

const TRANSCRIBE_URL = process.env.TRANSCRIBE_URL || "http://localhost:5001/transcribe";

/**
 * Transcribe raw audio bytes to Thai text.
 *
 * @param {Buffer} audioBuffer  - Raw binary audio content
 * @param {string} suffix       - File extension: ".wav" | ".mp3"
 * @returns {Promise<string>}   - Transcribed Thai text
 */
async function transcribeAudio(audioBuffer, suffix) {
  // ── Option A: Forward to external PyThaiASR service ──────────────────────
  if (TRANSCRIBE_URL) {
    return forwardToAsrService(audioBuffer, suffix);
  }

  // ── Option B: Development stub ───────────────────────────────────────────
  console.warn(
    "[transcriber] No TRANSCRIBE_URL configured. " +
    "Set TRANSCRIBE_URL=http://localhost:5001/transcribe to enable real ASR."
  );
  return (
    "[ASR not configured] " +
    "กรุณาตั้งค่า TRANSCRIBE_URL หรือติดตั้ง PyThaiASR แล้วลองใหม่"
  );
}

/**
 * Forward audio to an external ASR HTTP service.
 * The service should accept multipart/form-data with an 'audio' field
 * and return JSON: { transcript: "..." }
 *
 * @param {Buffer} audioBuffer
 * @param {string} suffix
 * @returns {Promise<string>}
 */
async function forwardToAsrService(audioBuffer, suffix) {
  const http = require("http");
  const https = require("https");
  const { URL } = require("url");

  const mimeType = suffix === ".mp3" ? "audio/mpeg"
                 : suffix === ".m4a" ? "audio/mp4"
                 : suffix === ".ogg" ? "audio/ogg"
                 : "audio/wav";

  // Build multipart/form-data manually using raw Buffers
  // This avoids needing FormData/Blob which are unavailable in some Node builds
  const boundary = "----NodeASRBoundary" + Date.now().toString(16);
  const header = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="audio"; filename="upload${suffix}"\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([header, audioBuffer, footer]);

  const url = new URL(TRANSCRIBE_URL);
  const transport = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const req = transport.request(
      {
        hostname: url.hostname,
        port:     url.port,
        path:     url.pathname,
        method:   "POST",
        headers: {
          "Content-Type":   `multipart/form-data; boundary=${boundary}`,
          "Content-Length":  body.length,
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          try {
            const json = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            if (!json.transcript) {
              return reject(new Error("ASR service response missing 'transcript' field"));
            }
            resolve(json.transcript.trim());
          } catch (e) {
            reject(new Error("Failed to parse ASR response: " + e.message));
          }
        });
      }
    );
    req.on("error", (e) => reject(new Error("ASR service connection failed: " + e.message)));
    req.write(body);
    req.end();
  });
}

module.exports = { transcribeAudio };
