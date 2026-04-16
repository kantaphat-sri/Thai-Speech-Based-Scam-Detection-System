/**
 * pipeline/worker_manager.js
 * 
 * Manages a pool of Worker Threads to parallelize the NLP pipeline.
 * Implements a simple Round Robin scheduler to balance the load.
 * 
 * [ORCHESTRATOR ROLE]: This module acts as the "Middle Man" or Scheduler.
 * It ensures that tasks are evenly distributed across hardware resources
 * and manages the lifecycle of the background execution threads.
 */

const { Worker } = require('worker_threads');
const path = require('path');
const os = require('os');

class WorkerPool {
    constructor() {
        // Limit threads to CPU count to minimize context switching overhead
        this.numThreads = Math.max(1, os.cpus().length - 1); 
        this.workers = [];
        this.taskQueue = new Map();
        this.taskIdCounter = 0;
        this.currentIndex = 0; // For Round Robin
        
        this.init();
    }

    init() {
        console.log(`[WorkerPool] Initializing ${this.numThreads} workers...`);
        for (let i = 0; i < this.numThreads; i++) {
            const worker = new Worker(path.join(__dirname, 'worker.js'));
            
            worker.on('message', (response) => {
                const { id, status, result, error } = response;
                const callback = this.taskQueue.get(id);
                
                if (callback) {
                    if (status === 'success') {
                        callback.resolve(result);
                    } else {
                        callback.reject(new Error(error));
                    }
                    this.taskQueue.delete(id);
                }
            });

            worker.on('error', (err) => {
                console.error(`[WorkerPool] Worker ${i} Error:`, err);
            });

            this.workers.push(worker);
        }
    }

    /**
     * Run a task on the next available worker (Round Robin).
     */
    runTask(type, data) {
        return new Promise((resolve, reject) => {
            const id = this.taskIdCounter++;
            this.taskQueue.set(id, { resolve, reject });

            const worker = this.workers[this.currentIndex];
            // [SCHEDULER LOGIC]: Round Robin ensures Fairness. Every worker
            // gets a turn, preventing any single thread from being overloaded.
            this.currentIndex = (this.currentIndex + 1) % this.numThreads;

            worker.postMessage({ id, type, data });
        });
    }
}

// Singleton instance
const pool = new WorkerPool();
module.exports = pool;
