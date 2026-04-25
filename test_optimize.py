import time
import math

def estimate_pitch(frame, sample_rate):
    min_period = int(sample_rate / 600)
    max_period = int(sample_rate / 60)

    best_lag = 0
    best_corr = float('-inf')

    # Ensure lag doesn't exceed frame length
    max_lag = min(max_period, len(frame) - 1)

    for lag in range(min_period, max_lag + 1):
        corr = 0.0
        # for i = 0 to length - lag
        limit = len(frame) - lag
        for i in range(limit):
            corr += frame[i] * frame[i + lag]
            
        if corr > best_corr:
            best_corr = corr
            best_lag = lag

    if best_corr <= 0 or best_lag == 0:
        return 0
    return sample_rate / best_lag

def main():
    sample_rate = 16000
    frame_len = 16000
    frame = [0.0] * frame_len
    
    # Generate a sine wave at 440Hz (A4 note)
    for i in range(frame_len):
        frame[i] = math.sin(2 * math.pi * 440 * i / sample_rate)

    print("Starting Python Benchmark (estimatePitch)...")
    iterations = 50 # Run 50 times to get a good average

    start_time = time.time()
    result = 0
    for _ in range(iterations):
        result = estimate_pitch(frame, sample_rate)
    end_time = time.time()

    total_time_ms = (end_time - start_time) * 1000
    avg_time_ms = total_time_ms / iterations

    print(f"[Python] Result Pitch: {result:.2f} Hz")
    print(f"[Python] Total Time for {iterations} iterations: {total_time_ms:.2f} ms")
    print(f"[Python] Average Time per iteration: {avg_time_ms:.2f} ms")

if __name__ == "__main__":
    main()
