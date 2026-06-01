export interface ExpiryScheduleResult {
  jobId: string;
  expiresAt: Date;
  delayMs: number;
}

export class ExpiryManager {
  shouldScheduleExpiry(accessEnd: Date | undefined | null): boolean {
    if (!accessEnd) return false;
    return accessEnd > new Date();
  }

  computeDelay(accessEnd: Date, now: Date = new Date()): number {
    return Math.max(0, accessEnd.getTime() - now.getTime());
  }

  isExpired(accessEnd: Date, now: Date = new Date()): boolean {
    return now >= accessEnd;
  }

  generateJobId(requestId: string): string {
    return `expiry:${requestId}`;
  }
}
