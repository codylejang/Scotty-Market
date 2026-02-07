import { BankDataProvider, BudgetProvider, CancellationProvider, NotificationProvider } from './types';
import { MockBankDataProvider } from './mock-bank';
import { MockBudgetProvider } from './mock-budget';
import { MockNotificationProvider } from './mock-notification';

export type { BankDataProvider, BudgetProvider, CancellationProvider, NotificationProvider };

export interface Adapters {
  bank: BankDataProvider;
  budget: BudgetProvider;
  cancellation: CancellationProvider | null;
  notification: NotificationProvider;
}

export function createAdapters(): Adapters {
  return {
    bank: new MockBankDataProvider(),
    budget: new MockBudgetProvider(),
    cancellation: null, // No cancellation provider; use "verify by absence" approach
    notification: new MockNotificationProvider(),
  };
}
