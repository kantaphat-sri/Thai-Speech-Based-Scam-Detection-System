/**
 * pipeline/transcriber.js — Step 2: Speech-to-Text (Native JS Version)
 * ==================================================
 * Handles audio transcription internally using Google's free Web Speech API
 * (matching the Python SpeechRecognition library), eliminating the Python dependency.
 */

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);

// Use the local FFmpeg binary installed via npm
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;

/**
 * Transcribe raw audio bytes to Thai text natively.
 *
 * @param {Buffer} audioBuffer  - Raw binary audio content
 * @param {string} suffix       - File extension: ".wav" | ".mp3" | ".m4a"
 * @returns {Promise<string>}   - Transcribed Thai text
 */
async function transcribeAudio(audioBuffer, suffix) {
  const tempId = Date.now() + "_" + Math.floor(Math.random() * 10000);
  const inputPath = path.join(os.tmpdir(), `input_${tempId}${suffix || ".wav"}`);
  const flacPath = path.join(os.tmpdir(), `output_${tempId}.flac`);

  try {
    // 1. Save buffer to temporary file
    fs.writeFileSync(inputPath, audioBuffer);

    // 2. Convert to 16kHz Mono FLAC (Required by Google Web Speech API)
    // ffmpeg -i <input> -y -ar 16000 -ac 1 -c:a flac <output>
    const cmd = `"${ffmpegPath}" -i "${inputPath}" -y -ar 16000 -ac 1 -c:a flac "${flacPath}"`;
    await execPromise(cmd);

    // 3. Read the converted FLAC file
    const flacBuffer = fs.readFileSync(flacPath);

    // 4. Send to Google Web Speech API (free Chromium endpoint)
    const key = "AIzaSyBOti4mM-6x9WDnZIjIeyEU21OpBXqWBgw";
    const googleUrl = "https://www.google.com/speech-api/v2/recognize?client=chromium&lang=th-TH&key=" + key;
    const response = await fetch(googleUrl, {
      method: "POST",
      headers: {
        "Content-Type": "audio/x-flac; rate=16000",
      },
      body: flacBuffer,
    });

    if (!response.ok) {
      throw new Error(`Google API returned ${response.status}: ${response.statusText}`);
    }

    const responseText = await response.text();

    // 5. Parse the weird multi-line JSON response that Google returns
    // Expected format:
    // {"result":[]}
    // {"result":[{"alternative":[{"transcript":"ข้อความ"}],"final":true}],"result_index":0}
    const lines = responseText.trim().split("\n");
    for (const line of lines) {
      if (!line) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.result && parsed.result.length > 0) {
          const alternatives = parsed.result[0].alternative;
          if (alternatives && alternatives.length > 0) {
            return alternatives[0].transcript.trim();
          }
        }
      } catch (e) {
        // ignore JSON parse errors on partial lines
      }
    }

    return "[เสียงไม่ชัดเจน หรือไม่มีเสียงพูดระดับที่ตรวจจับได้]";
  } catch (error) {
    console.error("[transcriber] STT Error:", error);
    throw new Error("เกิดข้อผิดพลาดในการประมวลผลเสียง: " + error.message);
  } finally {
    // Cleanup Temp Files
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(flacPath)) fs.unlinkSync(flacPath);
  }
}

module.exports = { transcribeAudio };
