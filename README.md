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

## Detailed File Architecture

### 1. Root Directory Files

*   **`server.js`**: The main orchestrator. Defines the Express server, API endpoints, manages the LRU cache, and delegates heavy tasks to the Worker Pool.
*   **`thai_scam_detector.html`**: The frontend UI. Handles user interactions, audio recording, and file uploads.
*   **`package.json`**: Project metadata and dependencies (`express`, `multer`, `ffmpeg` wrappers, etc.).

### 2. Pipeline Directory (`pipeline/`)

*   **`transcriber.js`**: Converts audio to text using Google's Web Speech API (Native JS).
*   **`preprocessor.js`**: Normalizes Thai text and segments it using a sliding window.
*   **`extractor.js`**: Scans tokens for scam patterns (OTP, money, urgency, etc.) and calculates a risk score.
*   **`classifier.js`**: Maps the risk score to final verdicts (scam, warning, normal).
*   **`toneAnalyzer.js`**: Performs DSP on raw audio to detect vocal stress signals.
*   **`combinedScorer.js`**: Fuses text and tone scores into a final probability (60% text / 40% tone).
*   **`worker_manager.js`**: Manages a pool of Worker Threads for parallel execution.
*   **`worker.js`**: The script executed by background threads for CPU-intensive tasks.

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

### Benchmark Files
*   **`test_optimize.js`**: Standalone JS benchmark for `estimatePitch`.
*   **`test_optimize.py`**: Standalone Python benchmark for `estimatePitch`.
*   **`run_benchmarks.js`**: Orchestrator to run both tests and compare results.

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

## Development Team (ITCS225)

- 6788138 Tri Trisuthan (server.js & API)
- 6788002 Phon Akkaralwan (Frontend UI)
- 6788080 Nutt Panwaewngam (Preprocessor & Extractor)
- 6788069 Kodchaphan Nikom (Combined Scorer)
- 6788114 Kantaphat Srisala (Tone Analyzer & DSP)
- 6788118 Siwakorn Sukhsaran (Worker Manager)
- 6788024 Sarun Intornphu (Worker Thread, Classifier & Transcriber Stub)
