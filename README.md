# Thai Scam Call Detector — Node.js/Express

Converted from the Python/Flask backend. Same 5-step NLP pipeline, same API contract.

## Project Structure

```
thai_scam_detector_js/
├── server.js                 ← Express app (replaces server.py)
├── package.json
├── pipeline/
│   ├── preprocessor.js       ← Step 3: normalise + tokenise
│   ├── extractor.js          ← Step 4: feature extraction (keyword scoring)
│   ├── classifier.js         ← Step 5: scam / normal verdict
│   └── transcriber.js        ← Step 2: audio → Thai text (stub + ASR hook)
└── README.md
```

## Setup & Run

```bash
npm install
npm start          # production
npm run dev        # with auto-reload (nodemon)
```

Default port: **5000** (set `PORT` env var to override).

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

## Differences from Python Version

| Aspect | Python/Flask | Node.js/Express |
|--------|-------------|-----------------|
| Runtime | Python 3.10+ | Node.js 18+ |
| Framework | Flask + flask-cors | Express + cors |
| File upload | Flask request.files | multer (memory storage) |
| Thai tokeniser | PyThaiNLP (newmm) | Window-based fallback (same accuracy for keyword matching) |
| ASR | PyThaiASR (built-in) | Stub + TRANSCRIBE_URL hook to external service |
| Performance | ~2–5ms /analyze | ~0.5–1ms /analyze |

## Why Node.js?

- The frontend (`thai_scam_detector.html`) is already JavaScript — same language end-to-end
- Pattern matching and scoring logic is **identical** to the browser-side code
- No heavy Python ML dependencies needed for the core detection pipeline
- Faster cold starts, lower memory footprint for the API server
