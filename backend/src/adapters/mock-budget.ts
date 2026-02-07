import { v4 as uuid } from 'uuid';
import { BudgetProvider, Budget } from './types';
import { getDb } from '../db/database';

export class MockBudgetProvider implements BudgetProvider {
  async getBudgets(userId: string): Promise<Budget[]> {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM budget WHERE user_id = ?').all(userId) as any[];
    return rows.map(r => ({
      category: r.category,
      amount: r.amount,
      period: r.period as 'monthly' | 'weekly',
    }));
  }

  async setBudget(userId: string, category: string, amount: number): Promise<void> {
    const db = getDb();
    db.prepare(`
      INSERT INTO budget (id, user_id, category, amount)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, category) DO UPDATE SET amount = ?, updated_at = datetime('now')
    `).run(uuid(), userId, category, amount, amount);
  }
}

export function seedDefaultBudgets(userId: string): void {
  const db = getDb();
  const defaults: Budget[] = [
    { category: 'Food & Drink', amount: 400, period: 'monthly' },
    { category: 'Shopping', amount: 200, period: 'monthly' },
    { category: 'Transportation', amount: 150, period: 'monthly' },
    { category: 'Entertainment', amount: 100, period: 'monthly' },
  ];

  const insert = db.prepare(`
    INSERT OR IGNORE INTO budget (id, user_id, category, amount, period)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const b of defaults) {
    insert.run(uuid(), userId, b.category, b.amount, b.period);
  }
}
