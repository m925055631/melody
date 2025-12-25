import { useRef, useCallback } from 'react';

/**
 * Throttle hook - limits function execution frequency
 * Useful for high-frequency events like mousemove, scroll, resize
 * 
 * @param callback - Function to throttle
 * @param delay - Minimum delay between executions (ms)
 * @returns Throttled version of the callback
 */
export function useThrottle<T extends (...args: any[]) => any>(
    callback: T,
    delay: number
): T {
    const lastRun = useRef(Date.now());

    return useCallback((...args: Parameters<T>) => {
        const now = Date.now();

        if (now - lastRun.current >= delay) {
            callback(...args);
            lastRun.current = now;
        }
    }, [callback, delay]) as T;
}
