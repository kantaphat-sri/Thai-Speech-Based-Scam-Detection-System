/**
 * pipeline/worker.js
 * 
 * Worker thread script to handle CPU-intensive Thai NLP tasks.
 * This implements Parallelism by offloading work from the main event loop.
 * 
 * [WORKER ROLE]: These are the "Heavy Lifters." They perform the actual 
 * computation (sliding window tokenization, acoustic feature extraction)
 * in isolation, ensuring the main server never freezes.
 */

const { parentPort } = require('worker_threads');
const { preprocess } = require('./preprocessor');
const { extractFeatures } = require('./extractor');
const { classify } = require('./classifier');
const { analyzeTone } = require('./toneAnalyzer');

// Listen for tasks from the main thread
parentPort.on('message', (task) => {
    const { id, type, data } = task;
    
    try {
        let result;
        
        switch (type) {
            case 'ANALYZE_TEXT':
                // [HEAVY LIFTER]: Sliding window character analysis for Thai text.
                // This is CPU-bound work that would block the main event loop.
                const tokens = preprocess(data.text);
                const { hits, score } = extractFeatures(tokens, data.text);
                const { isScam, isWarning, label } = classify(score);
                
                result = { tokens, hits, score, isScam, isWarning, label };
                break;
                
            case 'ANALYZE_TONE':
                // [HEAVY LIFTER]: Digital Signal Processing (DSP) for audio.
                // Calculates pitch, RMS, and jitter directly from binary buffers.
                result = analyzeTone(Buffer.from(data.buffer));
                break;
                
            default:
                throw new Error(`Unknown task type: ${type}`);
        }
        
        // Send the result back
        parentPort.postMessage({ id, status: 'success', result });
    } catch (error) {
        parentPort.postMessage({ id, status: 'error', error: error.message });
    }
});
