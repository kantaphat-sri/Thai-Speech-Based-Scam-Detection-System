/**
 * Thai Scam Call Detector — Node.js/Express Backend
 * server.js · Phase 2 of the 5-step NLP pipeline
 *
 * Endpoints
 * ---------
 * GET  /            health check
 * POST /analyze     text → tokens, features, score, verdict
 * POST /transcribe  audio file → transcript, then /analyze pipeline
 * GET  /dataset     return collected dataset as JSON
 * GET  /export      download dataset as CSV (UTF-8 BOM for Excel Thai display)
 * POST /reset       clear in-memory dataset
 * GET  /metrics     precision / recall / F1 over labelled rows
 */

"use strict";

const express  = require("express");
const cors     = require("cors");
const multer   = require("multer");
const path     = require("path");

const { preprocess }       = require("./pipeline/preprocessor");
const { extractFeatures }  = require("./pipeline/extractor");
const { classify }         = require("./pipeline/classifier");
const { transcribeAudio }  = require("./pipeline/transcriber");
const { analyzeTone }      = require("./pipeline/toneAnalyzer");
const { combineScores, explainResult } = require("./pipeline/combinedScorer");

// OS-Optimized Pipeline: Worker Pool
// [MAIN THREAD ROLE]: Orchestrates delegation. It doesn't do the heavy lifting,
// but manages the state and decides when to offload work to background threads.
const workerPool = require("./pipeline/worker_manager");

// OS-Optimized Memory: Simple LRU Cache for tokenized results
// [MAIN THREAD ROLE]: Acts as a Memory Manager. By caching results, we save
// CPU cycles and provide near-instant results for repeated scam messages.
const analysisCache = new Map();
const MAX_CACHE_SIZE = 1000;

function getCachedResult(text) {
  if (analysisCache.has(text)) {
    console.log(`[Cache] HIT: "${text.slice(0, 30)}..."`);
    return analysisCache.get(text);
  }
  return null;
}

function setCacheResult(text, result) {
  if (analysisCache.size >= MAX_CACHE_SIZE) {
    const firstKey = analysisCache.keys().next().value;
    analysisCache.delete(firstKey);
  }
  analysisCache.set(text, result);
}

// ── App setup ─────────────────────────────────────────────────────────────────
const app    = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve OS Simulator files
app.use("/os_sim", express.static(path.join(__dirname, "os_sim")));

// Serve frontend files (HTML, CSS, images) from project root
app.use(express.static(__dirname));

// In-memory dataset (rows appended by /analyze and /transcribe)
let dataset   = [];
let sampleId  = 0;

const nextId = () => ++sampleId;

// Simple console logger
const log = {
  info:  (...args) => console.log(`[${ts()}] INFO `, ...args),
  warn:  (...args) => console.warn(`[${ts()}] WARN `, ...args),
  error: (...args) => console.error(`[${ts()}] ERROR`, ...args),
};
const ts = () => new Date().toTimeString().slice(0, 8);

// ── Routes ────────────────────────────────────────────────────────────────────

/** GET / — health check */
app.get("/", (req, res) => {
  res.json({ status: "ok", version: "2.0", samples: dataset.length });
});


/**
 * POST /analyze
 * Body  : { "text": "...", "source": "text-input" }
 * Return: { tokens, hits, score, is_scam, label, source, elapsed_ms }
 */
app.post("/analyze", async (req, res) => {
  const body   = req.body || {};
  const text   = (body.text   || "").trim();
  const source = (body.source || "api");

  if (!text) {
    return res.status(400).json({ error: "text is required" });
  }

  const t0 = process.hrtime.bigint();

  // ── OS Optimization 1: Cache Lookup ────────────────────────────────────────
  const cached = getCachedResult(text);
  let analysis;
  
  if (cached) {
    analysis = cached;
  } else {
    // ── OS Optimization 2: Parallelism via Worker Threads ──────────────────
    try {
      analysis = await workerPool.runTask('ANALYZE_TEXT', { text });
      setCacheResult(text, analysis);
    } catch (err) {
      log.error("[Worker] Analysis failed:", err.message);
      return res.status(500).json({ error: "Internal processing error" });
    }
  }

  const elapsedMs = Number(process.hrtime.bigint() - t0) / 1e6;

  const row = {
    id:         nextId(),
    transcript: text,
    label:      analysis.label,
    score:      analysis.score,
    source,
    hits:       hitsToString(analysis.hits || {}),
  };
  dataset.push(row);

  log.info(`[analyze] "${text.slice(0, 60)}"  score=${analysis.score}  label=${analysis.label} (elapsed: ${Math.round(elapsedMs)}ms)`);

  res.json({
    tokens:     analysis.tokens,
    hits:       analysis.hits,
    score:      analysis.score,
    is_scam:    analysis.isScam,
    is_warning: analysis.isWarning,
    label:      analysis.label,
    source,
    elapsed_ms: Math.round(elapsedMs * 10) / 10,
    cache_hit:  !!cached
  });
});


/**
 * POST /transcribe
 * Multipart form-data with field 'audio' (.wav or .mp3).
 * Returns { transcript, tokens, hits, score, is_scam, label }
 */
app.post("/transcribe", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "audio file required" });
  }

  const suffix = path.extname(req.file.originalname).toLowerCase(); // .wav / .mp3
  log.info(`[transcribe] Received file: ${req.file.originalname} (${req.file.size} bytes)`);

  const t0 = process.hrtime.bigint();
  let transcript;
  try {
    transcript = await transcribeAudio(req.file.buffer, suffix);
  } catch (err) {
    log.error("[transcribe] STT failed:", err.message);
    return res.status(500).json({ error: err.message });
  }

  // ── OS Optimization 1: Cache Lookup ────────────────────────────────────────
  const cached = getCachedResult(transcript);
  let analysis;
  let toneResult;

  if (cached && analysisCache.get(`${transcript}_tone`)) {
    analysis = cached;
    toneResult = analysisCache.get(`${transcript}_tone`);
    log.info(`[Cache] Full HIT for transcription result`);
  } else {
    // ── OS Optimization 2: Parallelism (Worker Threads) ──────────────────────
    try {
      // Run NLP analysis and Audio Tone analysis in Parallel threads
      [analysis, toneResult] = await Promise.all([
        workerPool.runTask('ANALYZE_TEXT', { text: transcript }),
        workerPool.runTask('ANALYZE_TONE', { buffer: req.file.buffer })
      ]);
      
      setCacheResult(transcript, analysis);
      setCacheResult(`${transcript}_tone`, toneResult);
    } catch (err) {
      log.error("[Worker] Transcription analysis failed:", err.message);
      return res.status(500).json({ error: "Internal processing error" });
    }
  }

  const { hits, score: textScore } = analysis;

  // ── Combine results ───────────────────────────────────────────────────────
  const combined    = combineScores(textScore, toneResult.toneScore, toneResult.signals);
  const explanation = explainResult(combined, hits, toneResult.summary);
  const elapsedMs   = Number(process.hrtime.bigint() - t0) / 1e6;

  const row = {
    id:         nextId(),
    transcript,
    label:      combined.label,
    score:      combined.finalScore,
    text_score: textScore,
    tone_score: toneResult.toneScore,
    source:     "pythaiasr",
    hits:       hitsToString(hits),
    tone_signals: toneResult.signals.join(","),
  };
  dataset.push(row);

  log.info(`[transcribe] "${transcript.slice(0, 60)}" label=${combined.label} final=${combined.finalScore} (elapsed: ${Math.round(elapsedMs)}ms)`);

  res.json({
    transcript,
    tokens:     analysis.tokens,
    hits,
    text_score: textScore,
    tone: {
      score:    toneResult.toneScore,
      signals:  toneResult.signals,
      features: toneResult.features,
      summary:  toneResult.summary,
    },
    score:      combined.finalScore,
    is_scam:    combined.isScam,
    is_warning: combined.isWarning,
    label:      combined.label,
    verdict:    combined.verdict,
    breakdown:  combined.breakdown,
    explanation,
    source:     "pythaiasr",
    cache_hit:  !!cached,
    elapsed_ms: Math.round(elapsedMs * 10) / 10
  });
});


/**
 * POST /analyze-audio
 * Tone-only analysis — no transcription needed.
 */
app.post("/analyze-audio", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "audio file required" });
  }

  log.info(`[analyze-audio] ${req.file.originalname} (${req.file.size} bytes)`);

  const t0 = process.hrtime.bigint();
  const text = (req.body?.text || "").trim();
  
  let toneResult;
  let analysis;
  let combined;
  let explanation;

  try {
    if (text) {
      // Parallelize tone and text analysis
      [toneResult, analysis] = await Promise.all([
        workerPool.runTask('ANALYZE_TONE', { buffer: req.file.buffer }),
        workerPool.runTask('ANALYZE_TEXT', { text })
      ]);
      combined    = combineScores(analysis.score, toneResult.toneScore, toneResult.signals);
      explanation = explainResult(combined, analysis.hits, toneResult.summary);
    } else {
      // Audio only
      toneResult = await workerPool.runTask('ANALYZE_TONE', { buffer: req.file.buffer });
      const { isScam, isWarning, label } = classify(toneResult.toneScore);
      combined = {
        finalScore: toneResult.toneScore,
        isScam,
        isWarning,
        label,
        verdict: `Tone-only: ${toneResult.summary}`,
        breakdown: { textScore: 0, toneScore: toneResult.toneScore, boosts: [] },
      };
    }
  } catch (err) {
    log.error("[Worker] Audio-analysis failed:", err.message);
    return res.status(500).json({ error: "Internal processing error" });
  }

  const elapsedMs = Number(process.hrtime.bigint() - t0) / 1e6;

  const row = {
    id:           nextId(),
    transcript:   text || "[audio-only]",
    label:        combined.label,
    score:        combined.finalScore,
    text_score:   text ? analysis.score : 0,
    tone_score:   toneResult.toneScore,
    source:       "analyze-audio",
    hits:         text ? hitsToString(analysis.hits) : "",
    tone_signals: toneResult.signals.join(","),
  };
  dataset.push(row);

  res.json({
    tone: {
      score:    toneResult.toneScore,
      signals:  toneResult.signals,
      features: toneResult.features,
      summary:  toneResult.summary,
    },
    ...(text ? { transcript: text, tokens: analysis.tokens, text_score: analysis.score, hits: analysis.hits } : {}),
    score:      combined.finalScore,
    is_scam:    combined.isScam,
    is_warning: combined.isWarning,
    label:      combined.label,
    verdict:    combined.verdict,
    breakdown:  combined.breakdown,
    ...(explanation ? { explanation } : {}),
    elapsed_ms: Math.round(elapsedMs * 10) / 10
  });
});


/** GET /dataset — return collected dataset as JSON */
app.get("/dataset", (req, res) => {
  res.json({ count: dataset.length, rows: dataset });
});


/** GET /export — stream a UTF-8 CSV download of the dataset */
app.get("/export", (req, res) => {
  const fields = ["id", "transcript", "label", "score", "source", "hits"];
  const header = fields.join(",") + "\n";

  const rows = dataset.map(row =>
    fields.map(f => csvEscape(String(row[f] ?? ""))).join(",")
  ).join("\n");

  // UTF-8 BOM so Excel displays Thai characters correctly
  const bom = "\uFEFF";
  const csv = bom + header + rows;

  res
    .setHeader("Content-Type", "text/csv; charset=utf-8")
    .setHeader("Content-Disposition", "attachment; filename=thai_scam_dataset.csv")
    .send(Buffer.from(csv, "utf8"));
});


/** POST /reset — clear in-memory dataset */
app.post("/reset", (req, res) => {
  dataset  = [];
  sampleId = 0;
  res.json({ status: "ok", message: "dataset cleared" });
});


/**
 * GET /metrics
 * Compute precision, recall, F1 over labelled rows
 * (requires rows with a 'true_label' field to have been POSTed via /analyze)
 */
app.get("/metrics", (req, res) => {
  const labelled = dataset.filter(r => r.true_label != null);

  if (labelled.length === 0) {
    return res.status(400).json({
      error: "No labelled rows. POST /analyze with a true_label field.",
    });
  }

  const tp = labelled.filter(r => r.label === "scam"   && r.true_label === "scam").length;
  const fp = labelled.filter(r => r.label === "scam"   && r.true_label === "normal").length;
  const fn = labelled.filter(r => r.label === "normal" && r.true_label === "scam").length;
  const tn = labelled.filter(r => r.label === "normal" && r.true_label === "normal").length;

  const precision = (tp + fp) ? tp / (tp + fp) : 0;
  const recall    = (tp + fn) ? tp / (tp + fn) : 0;
  const f1        = (precision + recall) ? 2 * precision * recall / (precision + recall) : 0;
  const accuracy  = (tp + tn) / labelled.length;

  res.json({
    samples:  labelled.length,
    tp, fp, fn, tn,
    precision: +precision.toFixed(4),
    recall:    +recall.toFixed(4),
    f1:        +f1.toFixed(4),
    accuracy:  +accuracy.toFixed(4),
  });
});


// ── Helpers ───────────────────────────────────────────────────────────────────

/** Serialize hits map to a human-readable string (mirrors Python format). */
function hitsToString(hits) {
  return Object.entries(hits)
    .map(([cat, words]) => `${cat}:${words.join(",")}`)
    .join("; ");
}

/** Escape a value for CSV (wrap in quotes if it contains comma/quote/newline). */
function csvEscape(value) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}


// ── Entry point ───────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || "5000", 10);
app.listen(PORT, "0.0.0.0", () => {
  log.info(`Thai Scam Detector API running on http://localhost:${PORT}`);
});

module.exports = app; // for testing
