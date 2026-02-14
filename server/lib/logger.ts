/**
 * Centralized logging utility for server-side operations
 * 
 * Provides structured logging with different levels:
 * - error: Critical issues
 * - warn: Warnings
 * - info: General information
 * - debug: Detailed debugging info
 */

export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: Record<string, any>;
}

class Logger {
  private logLevel: LogLevel = LogLevel.INFO;

  constructor() {
    // Set log level from environment
    const envLogLevel = (process.env.LOG_LEVEL || 'info').toUpperCase();
    this.logLevel = (LogLevel[envLogLevel as keyof typeof LogLevel] || LogLevel.INFO);
  }

  /**
   * Format log entry for display
   */
  private formatLog(entry: LogEntry): string {
    const { timestamp, level, module, message, data } = entry;
    const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level}] [${module}] ${message}${dataStr}`;
  }

  /**
   * Get current timestamp
   */
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Check if log should be displayed based on level
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentIndex = levels.indexOf(this.logLevel);
    const levelIndex = levels.indexOf(level);
    return levelIndex >= currentIndex;
  }

  /**
   * Log error
   */
  error(module: string, message: string, data?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const entry: LogEntry = {
        timestamp: this.getTimestamp(),
        level: LogLevel.ERROR,
        module,
        message,
        data,
      };
      console.error('❌', this.formatLog(entry));
    }
  }

  /**
   * Log warning
   */
  warn(module: string, message: string, data?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const entry: LogEntry = {
        timestamp: this.getTimestamp(),
        level: LogLevel.WARN,
        module,
        message,
        data,
      };
      console.warn('⚠️', this.formatLog(entry));
    }
  }

  /**
   * Log info
   */
  info(module: string, message: string, data?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const entry: LogEntry = {
        timestamp: this.getTimestamp(),
        level: LogLevel.INFO,
        module,
        message,
        data,
      };
      console.log('ℹ️', this.formatLog(entry));
    }
  }

  /**
   * Log debug
   */
  debug(module: string, message: string, data?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const entry: LogEntry = {
        timestamp: this.getTimestamp(),
        level: LogLevel.DEBUG,
        module,
        message,
        data,
      };
      console.debug('🔍', this.formatLog(entry));
    }
  }
}

// Export singleton instance
export const logger = new Logger();
export default logger;
