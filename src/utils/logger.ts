/**
 * Logger utility - Development vs Production logging
 * In development: all log levels enabled
 * In production: only errors and warnings
 */

type LogLevel = 'log' | 'warn' | 'error' | 'info' | 'debug';

class Logger {
    private isDev = import.meta.env.DEV;
    private enabledLevels: Set<LogLevel>;

    constructor() {
        // Development: enable all logs
        // Production: only errors and warnings
        this.enabledLevels = new Set(
            this.isDev
                ? ['log', 'warn', 'error', 'info', 'debug']
                : ['error', 'warn']
        );
    }

    private shouldLog(level: LogLevel): boolean {
        return this.enabledLevels.has(level);
    }

    log(...args: any[]) {
        if (this.shouldLog('log')) console.log(...args);
    }

    warn(...args: any[]) {
        if (this.shouldLog('warn')) console.warn(...args);
    }

    error(...args: any[]) {
        if (this.shouldLog('error')) console.error(...args);
    }

    info(...args: any[]) {
        if (this.shouldLog('info')) console.info(...args);
    }

    debug(...args: any[]) {
        if (this.shouldLog('debug')) console.debug(...args);
    }
}

export const logger = new Logger();
export default logger;
