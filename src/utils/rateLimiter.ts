/**
 * Rate Limiter for CTFile API requests
 * Prevents "请求过于频繁" errors by queuing and throttling requests
 */

interface QueuedRequest<T> {
    fn: () => Promise<T>;
    resolve: (value: T) => void;
    reject: (error: any) => void;
}

export class RateLimiter {
    private queue: QueuedRequest<any>[] = [];
    private processing = false;
    private lastRequestTime = 0;
    private readonly minDelay: number;
    private readonly maxConcurrent: number;
    private readonly maxRetries: number;
    private activeRequests = 0;

    constructor(minDelayMs = 2000, maxConcurrent = 1, maxRetries = 3) {
        this.minDelay = minDelayMs;
        this.maxConcurrent = maxConcurrent;
        this.maxRetries = maxRetries;
    }

    /**
     * Add a request to the queue and process it when ready
     * Automatically retries failed requests with exponential backoff
     */
    async enqueue<T>(fn: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push({ fn, resolve, reject });
            this.processQueue();
        });
    }

    /**
     * Process queued requests with rate limiting and retry logic
     */
    private async processQueue() {
        if (this.processing || this.queue.length === 0 || this.activeRequests >= this.maxConcurrent) {
            return;
        }

        this.processing = true;

        while (this.queue.length > 0 && this.activeRequests < this.maxConcurrent) {
            const request = this.queue.shift();
            if (!request) break;

            // Calculate delay needed
            const now = Date.now();
            const timeSinceLastRequest = now - this.lastRequestTime;
            const delayNeeded = Math.max(0, this.minDelay - timeSinceLastRequest);

            if (delayNeeded > 0) {
                console.log(`[RateLimiter] Waiting ${delayNeeded}ms before next request`);
                await new Promise(resolve => setTimeout(resolve, delayNeeded));
            }

            this.activeRequests++;
            this.lastRequestTime = Date.now();

            // Retry logic with exponential backoff
            let attempts = 0;
            let success = false;

            while (attempts < this.maxRetries && !success) {
                try {
                    const result = await request.fn();
                    request.resolve(result);
                    success = true;
                } catch (error) {
                    attempts++;

                    // Check if it's a rate limit error (in Chinese or English)
                    const isRateLimitError = error instanceof Error &&
                        (error.message.includes('请求过于频繁') ||
                            error.message.includes('too many requests') ||
                            error.message.includes('rate limit'));

                    if (isRateLimitError && attempts < this.maxRetries) {
                        // Exponential backoff: 3s, 6s, 12s
                        const backoffDelay = this.minDelay * Math.pow(2, attempts - 1);
                        console.warn(`[RateLimiter] Rate limited, retrying in ${backoffDelay}ms (attempt ${attempts}/${this.maxRetries})`);
                        await new Promise(resolve => setTimeout(resolve, backoffDelay));
                    } else {
                        // Other error or max retries reached
                        request.reject(error);
                        break;
                    }
                }
            }

            this.activeRequests--;
        }

        this.processing = false;

        // Continue processing if there are more requests
        if (this.queue.length > 0) {
            setTimeout(() => this.processQueue(), this.minDelay);
        }
    }

    /**
     * Get current queue length
     */
    getQueueLength(): number {
        return this.queue.length;
    }

    /**
     * Clear all pending requests
     */
    clear() {
        this.queue = [];
    }
}

// Global rate limiter instance for CTFile API
// 2 seconds between requests, 1 concurrent request max, 3 retry attempts with exponential backoff
export const ctfileRateLimiter = new RateLimiter(2000, 1, 3);
