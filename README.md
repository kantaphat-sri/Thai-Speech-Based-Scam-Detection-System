# Thai Scam Call Detector — Node.js/Express

Converted from the Python/Flask backend. Same 5-step NLP pipeline, same API contract.
This project was developed as part of ITCS225 to demonstrate practical applications of Operating Systems concepts.

## Project Structure

```
thai_scam_detector_js/
├── server.js                 ← Express app (replaces server.py)
├── package.json
├── pipeline/
│   ├── preprocessor.js       ← Step 3: normalise + tokenise
│   ├── extractor.js          ← Step 4: feature extraction (keyword scoring)
│   ├── classifier.js         ← Step 5: scam / normal verdict
│   ├── toneAnalyzer.js       ← Audio DSP (pitch, volume, stress)
│   ├── combinedScorer.js     ← Merges Tone and Text weights
│   ├── worker_manager.js     ← Round-Robin thread pool scheduler
│   ├── worker.js             ← Worker thread handling DSP/NLP tasks
│   └── transcriber.js        ← Step 2: audio → Thai text (native ASR)
├── test_optimize.js          ← JS Performance Benchmark
├── test_optimize.py          ← Python Performance Benchmark
├── run_benchmarks.js         ← Master Benchmarking Runner
└── README.md
```

## Setup & Run

```bash
npm install
npm start          # production
npm run dev        # with auto-reload (nodemon)
```

Default port: **5000** (set `PORT` env var to override).

## Architecture & Operating Systems Concepts Applied

1. **Process & Thread Scheduling**: A Round-Robin worker pool (`worker_manager.js`) distributes CPU-bound DSP/NLP tasks across worker threads (`worker.js`).
2. **Memory Management**: An LRU (Least Recently Used) cache is implemented in `server.js` to store past results, dramatically reducing latency and memory footprint.
3. **Inter-Process Communication (IPC)**: A structured message-passing protocol allows the main thread to securely exchange Buffer data and JSON with worker threads without blocking.

## The NLP & DSP Pipeline

The core of the application analyzes data in multiple sequential steps:
- **Preprocessor**: Splits continuous Thai text into individual tokens using a 3-character sliding window.
- **Extractor**: Matches tokens against a dictionary of scam keywords (OTP, money, urgency, authority).
- **Tone Analyzer**: Uses Digital Signal Processing (DSP) on raw audio to measure speech rate, pitch, volume, and stress.
- **Transcriber**: A stub/service connector for converting voice to text via an ASR model.
- **Scorer & Classifier**: Combines keyword scores and acoustic risks to determine the final verdict.

## API Endpoints

| Method | Path         | Description                              |
|--------|--------------|------------------------------------------|
| GET    | `/`          | Health check                             |
| POST   | `/analyze`   | Text → tokens, hits, score, verdict      |
| POST   | `/transcribe`| Audio file → transcript → analysis      |
| GET    | `/dataset`   | Return collected dataset as JSON         |
| GET    | `/export`    | Download dataset as UTF-8 CSV            |
| POST   | `/reset`     | Clear in-memory dataset                  |
| GET    | `/metrics`   | Precision / Recall / F1 (labelled rows)  |

### POST /analyze

```json
// Request
{ "text": "โอนเงินด่วน รหัส OTP", "source": "text-input" }

// Response
{
  "tokens": ["โอนเงิน", "ด่วน", "รหัส", "otp"],
  "hits": { "otp": ["otp","รหัส"], "money": ["โอนเงิน"], "urgency": ["ด่วน"] },
  "score": 85,
  "is_scam": true,
  "label": "scam",
  "source": "text-input",
  "elapsed_ms": 0.4
}
```

### POST /transcribe

Send multipart/form-data with an `audio` field (.wav or .mp3).

#### Enable real Thai ASR

Set `TRANSCRIBE_URL` to a running PyThaiASR HTTP service:

```bash
# 1. Run the Python ASR sidecar (pythaiasr_service.py)
TRANSCRIBE_URL=http://localhost:5001/transcribe npm start
```

Without this env var, the endpoint returns a development stub message.

## Differences from Python Version & Performance

| Aspect | Python/Flask | Node.js/Express (Current) |
|--------|-------------|-----------------|
| Runtime | Python 3.10+ | Node.js 18+ |
| Framework | Flask + flask-cors | Express + cors |
| File upload | Flask request.files | multer (memory storage) |
| Thai tokeniser | PyThaiNLP (newmm) | Window-based fallback |
| Cold Start | 3-8s | ~200ms |
| /analyze Latency | ~2–5ms | ~0.5–1ms |
| Memory (Idle) | ~180MB | ~35MB |

**Why Node.js?**
- The frontend (`thai_scam_detector.html`) is already JavaScript — same language end-to-end.
- Performance: Worker pools and LRU caching drastically reduced server resources and latency.
- No heavy Python ML dependencies needed for the core keyword-matching pipeline.

## Performance Benchmarking (Node.js vs Python)

To justify the migration to Node.js, we implemented a CPU-intensive benchmark (`estimatePitch` algorithm) to compare the raw execution speed of JavaScript (V8 JIT) against Python.

### Running Benchmarks
```bash
node run_benchmarks.js
```

### Results Summary
For 50 iterations of the Pitch Estimation algorithm (16,000 samples):
- **JavaScript (Node.js):** ~5.8 ms/avg
- **Python 3:** ~188.5 ms/avg
- **Verdict:** **Node.js is ~32x faster** for the core math operations used in this pipeline.

## Development Team (ITCS225)

- 6788138 Tri Trisuthan (server.js & API)
- 6788002 Phon Akkaralwan (Frontend UI)
- 6788080 Nutt Panwaewngam (Preprocessor & Extractor)
- 6788069 Kodchaphan Nikom (Combined Scorer)
- 6788114 Kantaphat Srisala (Tone Analyzer & DSP)
- 6788118 Siwakorn Sukhsaran (Worker Manager)
- 6788024 Sarun Intornphu (Worker Thread, Classifier & Transcriber Stub)
