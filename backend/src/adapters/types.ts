import { Transaction, RecurringCandidate } from '../schemas';

export interface BankDataProvider {
  listTransactions(
    userId: string,
    start: string,
    end: string,
    includePending: boolean
  ): Promise<Transaction[]>;

  syncTransactions(
    userId: string,
    cursor?: string
  ): Promise<{ transactions: Transaction[]; cursor: string }>;

  listRecurringCandidates(
    userId: string,
    lookbackDays: number
  ): Promise<RecurringCandidate[]>;
}

export interface Budget {
  category: string;
  amount: number;
  period: 'monthly' | 'weekly';
}

export interface BudgetProvider {
  getBudgets(userId: string): Promise<Budget[]>;
  setBudget(userId: string, category: string, amount: number): Promise<void>;
}

export interface CancellationResult {
  success: boolean;
  message: string;
  confirmationId?: string;
}

export interface CancellationProvider {
  initiateCancel(userId: string, merchantKey: string): Promise<CancellationResult>;
}

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface NotificationProvider {
  schedule(userId: string, payload: NotificationPayload): Promise<void>;
  getDailyCount(userId: string): Promise<number>;
  enforceDailyLimit(userId: string, limit?: number): Promise<boolean>;
}
