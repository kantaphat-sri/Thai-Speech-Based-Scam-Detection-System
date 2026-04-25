# Thai Scam Detector: Project Summary and File Architecture

This document provides a highly detailed overview of the Thai Scam Detector project's architecture, describing every single file, its function, and why it is essential to the overall system.

The project is built around a Node.js/Express backend that acts as a 5-step NLP pipeline combined with acoustic tone analysis to detect Thai scam calls. It heavily utilizes OS-level optimizations like Worker Threads and caching to achieve high performance.

---

## 1. Root Directory Files

### `package.json` & `package-lock.json`
* **Purpose**: These files handle the Node.js project configuration and dependency management. `package.json` defines the entry point (`server.js`), the start scripts (`npm start` and `npm run dev`), and essential libraries like `express`, `multer` (for file uploads), and `ffmpeg` wrappers (`@ffmpeg-installer/ffmpeg`, `@ffprobe-installer/ffprobe`). `package-lock.json` locks down the exact versions of all installed packages.
* **Importance**: They are the blueprint for building and running the application. Without them, Node.js wouldn't know which libraries to download or how to start the server.

### `server.js`
* **Purpose**: This is the main orchestrator of the backend application. It defines the Express web server and REST API endpoints (`/analyze`, `/transcribe`, `/analyze-audio`, `/dataset`, etc.). It acts as the **Main Thread**, managing HTTP requests, routing, memory caching (LRU Cache), and delegating heavy computational tasks to the Worker Pool.
* **Importance**: It acts as the backbone of the application. It serves the frontend assets, receives incoming data (text and audio), connects all the individual pipeline modules together, caches results for speed optimization, and returns the final response to the client.

### `thai_scam_detector.html`
* **Purpose**: The main frontend user interface. It contains all the HTML structure, CSS styling, and client-side JavaScript required to interact with the system. Users can input text, upload audio files, or use their microphone to record audio for analysis.
* **Importance**: It is the face of the application, providing an accessible and interactive way for users to utilize the backend scam detection API without needing technical knowledge.

### `README.md`
* **Purpose**: The project's documentation file. It typically contains instructions on how to install, configure, and run the project, along with a high-level explanation of its features.
* **Importance**: Essential for onboarding new developers or users, providing the necessary context and commands to get the application up and running.

### `Thai Scam Detector High-Performance Fraud Prevention.pdf`
* **Purpose**: A comprehensive presentation or documentation document outlining the business logic, high-performance architecture, and theoretical fraud prevention mechanisms behind the application.
* **Importance**: Provides the high-level theoretical and architectural justification for the project, making it crucial for presentations, grading, or stakeholder understanding.

### `Untitled diagram-2026-04-22-182834.svg`
* **Purpose**: A scalable vector graphic file, likely a UML, system architecture, or pipeline diagram visualizing the data flow and structure of the application.
* **Importance**: Acts as a visual aid to help developers and reviewers quickly grasp the complex interactions between the frontend, main thread, worker pool, and the various pipeline stages.

---

## 2. Pipeline Directory (`pipeline/`)

This directory contains the core logic for the 5-Step NLP and Acoustic Analysis pipeline.

### `pipeline/transcriber.js` (Step 2: Speech-to-Text)
* **Purpose**: Handles the conversion of raw audio bytes into Thai text. It uses `ffmpeg` to convert incoming audio (WAV, MP3, etc.) into a 16kHz Mono FLAC format, which is then sent to Google's Web Speech API for native transcription without requiring external Python dependencies.
* **Importance**: Crucial for audio-based scam detection. It bridges the gap between acoustic input and the NLP text analysis pipeline.

### `pipeline/preprocessor.js` (Step 3: Text Preprocessing)
* **Purpose**: Cleans and normalizes incoming Thai text. Since Thai lacks spaces between words, it strips out noise/HTML and uses a deterministic character-window sliding approach to segment Thai script, while leaving Latin characters and numbers intact. It also removes meaningless "stop-words" (like ครับ, ค่ะ).
* **Importance**: NLP algorithms rely on clean, segmented tokens. Without this file, the keyword extractor wouldn't be able to accurately identify specific scam-related words hidden in continuous sentences.

### `pipeline/extractor.js` (Step 4: Feature Extraction)
* **Purpose**: Scans the cleaned tokens against a dictionary of known scam patterns across multiple categories (OTP, money transfer, urgency, authority impersonation, bait/rewards). It assigns weighted scores based on the hits it finds.
* **Importance**: This is the core logic that identifies *why* a message might be a scam. It translates raw text into quantifiable risk metrics. It represents CPU-bound work and relies heavily on parallel processing to avoid blocking the server.

### `pipeline/classifier.js` (Step 5: Classification)
* **Purpose**: Takes the numerical risk score generated by the extractor and maps it against predefined thresholds (`SCAM_THRESHOLD = 60`, `WARNING_THRESHOLD = 35`) to determine the final text-based verdict (`scam`, `warning`, or `normal`).
* **Importance**: It translates raw numerical scores into human-readable labels and actionable verdicts, forming the final step of the text-only NLP pipeline.

### `pipeline/toneAnalyzer.js` (Acoustic Analysis)
* **Purpose**: Performs Digital Signal Processing (DSP) directly on raw WAV PCM buffers. It calculates acoustic features like Root Mean Square (RMS) for volume, fundamental frequency via autocorrelation for pitch, and jitter for voice stress.
* **Importance**: Scammers often use pressure tactics that are detectable via tone (speaking fast, loud, or nervously). This module adds an entirely independent layer of acoustic verification that catches scammers even if they avoid specific keywords.

### `pipeline/combinedScorer.js` (Fusion Scorer)
* **Purpose**: Merges the text-based risk score from `extractor.js` with the acoustic risk score from `toneAnalyzer.js`. It applies a weighted formula (60% text, 40% tone) and includes synergistic boost rules (e.g., if both text and tone show high risk, an extra bonus penalty is applied).
* **Importance**: By fusing multiple dimensions of data (what is said vs. how it is said), this file significantly increases the accuracy of the system and reduces false positives. It is the ultimate decision-maker for audio inputs.

### `pipeline/worker_manager.js` (Thread Orchestrator)
* **Purpose**: Initializes and manages a pool of Worker Threads based on the machine's available CPU cores. It acts as a scheduler, using a Round-Robin algorithm to distribute incoming analysis tasks fairly among the workers.
* **Importance**: Crucial for high performance and scalability. Node.js is naturally single-threaded; without this manager, heavy NLP or DSP tasks would freeze the server. This file guarantees non-blocking, asynchronous execution.

### `pipeline/worker.js` (The Heavy Lifter)
* **Purpose**: The actual script run by the background threads. It listens for messages from the `worker_manager.js`, executes the CPU-intensive tasks (`ANALYZE_TEXT` or `ANALYZE_TONE`) in complete isolation, and returns the result to the main thread.
* **Importance**: Enables true parallel execution. By offloading the heavy lifting of sliding-window text parsing and complex audio math to background threads, it keeps the main server responsive to new web requests at all times.

---

## 3. Optimization & Benchmarking Files

### `test_optimize.js`
* **Purpose**: A standalone performance test for the JavaScript implementation of the `estimatePitch` algorithm. It measures how long it takes Node.js to perform 50 iterations of complex audio correlation math.
* **Importance**: Demonstrates the speed of the V8 JIT engine for CPU-bound Digital Signal Processing (DSP) tasks.

### `test_optimize.py`
* **Purpose**: An equivalent performance test written in Python for the same `estimatePitch` algorithm. It serves as the baseline for comparing interpreted vs. JIT-compiled performance.
* **Importance**: Highlights the performance bottlenecks of standard Python loops when handling heavy mathematical operations without C-extensions like NumPy.

### `run_benchmarks.js`
* **Purpose**: A master orchestrator script that runs both the JavaScript and Python tests and generates a side-by-side comparison report.
* **Importance**: Provides an automated, easy-to-use tool to prove the performance advantages of the Node.js migration. It calculates the speed ratio (typically showing Node.js is ~30x faster) to justify the architectural choice.

