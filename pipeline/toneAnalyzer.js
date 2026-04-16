/**
 * pipeline/toneAnalyzer.js — Tone / Prosody Analysis
 * ====================================================
 * Extracts acoustic features from raw PCM audio (WAV) to detect
 * vocal signals commonly associated with scam call behaviour:
 *
 *   • High pitch     → urgency / nervousness
 *   • Fast speech    → pressure tactics
 *   • Loud volume    → aggression / threatening
 *   • Voice stress   → jitter (pitch instability)
 *   • Silence ratio  → hesitation vs. relentless pressure
 *
 * Input : raw WAV Buffer (PCM 16-bit LE, any sample rate)
 * Output: { toneScore, signals, features, summary }
 *
 * No external dependencies — pure Node.js Buffer arithmetic.
 *
 * [OS CONCEPT]: PARALLELISM & DSP.
 * Audio analysis involves complex math (RMS, Pitch Detection). By using 
 * Promise.all, we run this in parallel with text analysis for 2x speed.
 */

"use strict";

// ── Tone signal weights (contribute to toneScore 0–100) ───────────────────────
const TONE_SIGNALS = {
  high_pitch:   { weight: 25, label: "High Pitch (urgency/nervousness)" },
  fast_speech:  { weight: 25, label: "Fast Speech Rate (pressure)"      },
  loud_volume:  { weight: 20, label: "High Volume (aggression)"         },
  voice_stress: { weight: 20, label: "Voice Stress / Jitter"            },
  low_silence:  { weight: 10, label: "Relentless Talking (no pauses)"   },
};

// ── Thresholds (tuned for Thai phone call audio) ───────────────────────────────
const THRESHOLDS = {
  // Pitch (estimated fundamental freq in Hz)
  pitch_high_hz:       250,   // above this → high_pitch signal
  pitch_low_hz:        80,    // below this = noise / unvoiced

  // Speech rate: voiced frames per second
  fast_speech_fps:     18,    // voiced frames/s above this → fast_speech

  // Volume: RMS amplitude as fraction of int16 max (32768)
  loud_rms_ratio:      0.18,  // above this → loud_volume

  // Jitter: mean absolute pitch change between consecutive voiced frames
  stress_jitter_hz:    12,    // above this → voice_stress

  // Silence: fraction of frames that are silent
  silence_ratio_low:   0.15,  // below this (almost no pauses) → low_silence
};

const MAX_TONE_SCORE = 100;

/**
 * Analyse audio tone from a WAV Buffer.
 *
 * @param {Buffer} wavBuffer - Raw WAV file bytes
 * @returns {{
 *   toneScore: number,
 *   signals: string[],
 *   features: Object,
 *   summary: string,
 *   error?: string
 * }}
 */
function analyzeTone(wavBuffer) {
  try {
    const pcm      = parsePcmFromWav(wavBuffer);
    const features = extractAcousticFeatures(pcm);
    const { toneScore, signals } = scoreSignals(features);
    const summary  = buildSummary(signals, toneScore);

    return { toneScore, signals, features, summary };
  } catch (err) {
    // Non-fatal — tone analysis is supplementary
    return {
      toneScore: 0,
      signals:   [],
      features:  {},
      summary:   "Tone analysis unavailable",
      error:     err.message,
    };
  }
}

// ── WAV Parsing ───────────────────────────────────────────────────────────────

/**
 * Parse a WAV buffer into a Float32 PCM array and header metadata.
 * Handles 8-bit, 16-bit, and 32-bit PCM WAV files.
 */
function parsePcmFromWav(buf) {
  // Minimal RIFF/WAV header parse
  if (buf.length < 44) throw new Error("Buffer too small to be a WAV file");

  const riff = buf.slice(0, 4).toString("ascii");
  if (riff !== "RIFF") throw new Error("Not a RIFF/WAV file");

  const audioFormat  = buf.readUInt16LE(20);  // 1 = PCM
  const numChannels  = buf.readUInt16LE(22);
  const sampleRate   = buf.readUInt32LE(24);
  const bitsPerSample = buf.readUInt16LE(34);

  // Find 'data' chunk (may not start at offset 36)
  let dataOffset = 36;
  while (dataOffset < buf.length - 8) {
    const chunkId = buf.slice(dataOffset, dataOffset + 4).toString("ascii");
    const chunkSize = buf.readUInt32LE(dataOffset + 4);
    if (chunkId === "data") {
      dataOffset += 8;
      break;
    }
    dataOffset += 8 + chunkSize;
  }

  const dataLength = buf.length - dataOffset;
  const bytesPerSample = bitsPerSample / 8;
  const totalSamples = Math.floor(dataLength / bytesPerSample);

  // Convert to mono Float32 [-1.0, 1.0]
  const samples = new Float32Array(Math.floor(totalSamples / numChannels));
  const maxVal = Math.pow(2, bitsPerSample - 1);

  for (let i = 0; i < samples.length; i++) {
    let sum = 0;
    for (let ch = 0; ch < numChannels; ch++) {
      const offset = dataOffset + (i * numChannels + ch) * bytesPerSample;
      let raw;
      if (bitsPerSample === 16) {
        raw = buf.readInt16LE(offset);
      } else if (bitsPerSample === 8) {
        raw = (buf.readUInt8(offset) - 128);
      } else if (bitsPerSample === 32) {
        raw = buf.readInt32LE(offset);
      } else {
        raw = buf.readInt16LE(offset);
      }
      sum += raw;
    }
    samples[i] = (sum / numChannels) / maxVal;
  }

  return { samples, sampleRate, bitsPerSample };
}

// ── Acoustic Feature Extraction ───────────────────────────────────────────────

/**
 * Extract pitch, RMS, speech rate, jitter, and silence ratio
 * from a mono Float32 PCM signal.
 */
function extractAcousticFeatures({ samples, sampleRate }) {
  const frameSize   = Math.floor(sampleRate * 0.025);  // 25ms frame
  const frameStep   = Math.floor(sampleRate * 0.010);  // 10ms hop
  const numFrames   = Math.floor((samples.length - frameSize) / frameStep);

  if (numFrames < 5) {
    throw new Error("Audio too short for tone analysis (< 0.1s)");
  }

  const pitchValues  = [];
  const rmsValues    = [];
  let   silentFrames = 0;

  for (let f = 0; f < numFrames; f++) {
    const start  = f * frameStep;
    const frame  = samples.slice(start, start + frameSize);

    // ── RMS amplitude ───────────────────────────────────────────────────────
    const rms = computeRms(frame);
    rmsValues.push(rms);

    // ── Voiced / Silence detection (energy threshold) ──────────────────────
    const silenceThreshold = 0.01;
    if (rms < silenceThreshold) {
      silentFrames++;
      continue;  // don't attempt pitch on silent frames
    }

    // ── Pitch via Autocorrelation (AMDF simplified) ─────────────────────────
    const pitch = estimatePitch(frame, sampleRate);
    if (pitch > THRESHOLDS.pitch_low_hz && pitch < 800) {
      pitchValues.push(pitch);
    }
  }

  // ── Derived statistics ────────────────────────────────────────────────────
  const meanPitch    = pitchValues.length ? mean(pitchValues) : 0;
  const meanRms      = mean(rmsValues);
  const silenceRatio = silentFrames / numFrames;
  const durationSec  = samples.length / sampleRate;

  // Speech rate: voiced frames per second
  const voicedFrames = numFrames - silentFrames;
  const speechRate   = durationSec > 0 ? voicedFrames / durationSec : 0;

  // Jitter: mean absolute difference between consecutive pitch values
  let jitter = 0;
  if (pitchValues.length > 1) {
    let totalDiff = 0;
    for (let i = 1; i < pitchValues.length; i++) {
      totalDiff += Math.abs(pitchValues[i] - pitchValues[i - 1]);
    }
    jitter = totalDiff / (pitchValues.length - 1);
  }

  return {
    meanPitch:    Math.round(meanPitch),
    meanRms:      +meanRms.toFixed(4),
    speechRate:   +speechRate.toFixed(1),
    jitter:       +jitter.toFixed(2),
    silenceRatio: +silenceRatio.toFixed(3),
    durationSec:  +durationSec.toFixed(2),
    pitchSamples: pitchValues.length,
  };
}

// ── Signal Scoring ────────────────────────────────────────────────────────────

function scoreSignals(features) {
  const signals = [];
  let toneScore = 0;

  if (features.meanPitch > THRESHOLDS.pitch_high_hz) {
    signals.push("high_pitch");
    toneScore += TONE_SIGNALS.high_pitch.weight;
  }

  if (features.speechRate > THRESHOLDS.fast_speech_fps) {
    signals.push("fast_speech");
    toneScore += TONE_SIGNALS.fast_speech.weight;
  }

  if (features.meanRms > THRESHOLDS.loud_rms_ratio) {
    signals.push("loud_volume");
    toneScore += TONE_SIGNALS.loud_volume.weight;
  }

  if (features.jitter > THRESHOLDS.stress_jitter_hz) {
    signals.push("voice_stress");
    toneScore += TONE_SIGNALS.voice_stress.weight;
  }

  if (features.silenceRatio < THRESHOLDS.silence_ratio_low && features.durationSec > 1) {
    signals.push("low_silence");
    toneScore += TONE_SIGNALS.low_silence.weight;
  }

  return { toneScore: Math.min(toneScore, MAX_TONE_SCORE), signals };
}

// ── Summary ───────────────────────────────────────────────────────────────────

function buildSummary(signals, toneScore) {
  if (signals.length === 0) return "Calm, natural tone — no vocal stress signals detected";

  const labels = signals.map(s => TONE_SIGNALS[s].label);
  const level  = toneScore >= 60 ? "HIGH" : toneScore >= 30 ? "MODERATE" : "LOW";
  return `${level} tone risk (${toneScore}/100): ${labels.join(", ")}`;
}

// ── DSP Helpers ───────────────────────────────────────────────────────────────

/** Compute Root Mean Square of a Float32 frame. */
function computeRms(frame) {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
  return Math.sqrt(sum / frame.length);
}

/**
 * Estimate fundamental frequency (pitch) using autocorrelation.
 * Returns Hz, or 0 if no clear periodicity is found.
 */
function estimatePitch(frame, sampleRate) {
  const minPeriod = Math.floor(sampleRate / 600);  // 600 Hz max
  const maxPeriod = Math.floor(sampleRate / 60);   // 60 Hz min

  let bestLag    = 0;
  let bestCorr   = -Infinity;

  for (let lag = minPeriod; lag <= maxPeriod && lag < frame.length; lag++) {
    let corr = 0;
    for (let i = 0; i < frame.length - lag; i++) {
      corr += frame[i] * frame[i + lag];
    }
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag  = lag;
    }
  }

  // Sanity check: correlation must be positive (voiced) 
  if (bestCorr <= 0 || bestLag === 0) return 0;
  return sampleRate / bestLag;
}

/** Arithmetic mean of a numeric array. */
function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

module.exports = { analyzeTone, TONE_SIGNALS };
