const { performance } = require('perf_hooks');

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

  if (bestCorr <= 0 || bestLag === 0) return 0;
  return sampleRate / bestLag;
}

// Create a dummy audio frame (1 second of audio at 16000Hz)
const sampleRate = 16000;
const frame = new Float32Array(16000);
for (let i = 0; i < frame.length; i++) {
  // Generate a sine wave at 440Hz (A4 note)
  frame[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate);
}

console.log("Starting JavaScript Benchmark (estimatePitch)...");
const iterations = 50; // Run 50 times to get a good average

const start = performance.now();
let result = 0;
for (let i = 0; i < iterations; i++) {
  result = estimatePitch(frame, sampleRate);
}
const end = performance.now();

const totalTimeMs = (end - start);
const avgTimeMs = totalTimeMs / iterations;

console.log(`[JavaScript] Result Pitch: ${result.toFixed(2)} Hz`);
console.log(`[JavaScript] Total Time for ${iterations} iterations: ${totalTimeMs.toFixed(2)} ms`);
console.log(`[JavaScript] Average Time per iteration: ${avgTimeMs.toFixed(2)} ms`);
