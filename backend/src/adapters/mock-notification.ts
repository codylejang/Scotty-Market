import { NotificationProvider, NotificationPayload } from './types';

const dailyCounts = new Map<string, { count: number; date: string }>();

export class MockNotificationProvider implements NotificationProvider {
  private maxDaily: number;

  constructor(maxDaily = 5) {
    this.maxDaily = maxDaily;
  }

  async schedule(userId: string, payload: NotificationPayload): Promise<void> {
    const allowed = await this.enforceDailyLimit(userId, this.maxDaily);
    if (!allowed) {
      console.log(`[notification] Daily limit reached for user ${userId}, skipping:`, payload.title);
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    const entry = dailyCounts.get(userId);
    if (entry && entry.date === today) {
      entry.count++;
    } else {
      dailyCounts.set(userId, { count: 1, date: today });
    }
    console.log(`[notification] Scheduled for ${userId}:`, payload.title);
  }

  async getDailyCount(userId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const entry = dailyCounts.get(userId);
    if (entry && entry.date === today) return entry.count;
    return 0;
  }

  async enforceDailyLimit(userId: string, limit = this.maxDaily): Promise<boolean> {
    const count = await this.getDailyCount(userId);
    return count < limit;
  }
}
