import { v4 as uuid } from 'uuid';
import { Transaction } from '../../src/schemas';

const USER_ID = 'test-user-1';

/**
 * A week of transactions with dining spikes
 */
export function diningSpikesFixture(): Transaction[] {
  const txns: Transaction[] = [];
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - 7);

  for (let d = 0; d < 7; d++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + d);
    const dateStr = date.toISOString().split('T')[0];

    // Normal dining on most days
    txns.push({
      id: uuid(), user_id: USER_ID, provider: 'plaid',
      provider_txn_id: `dining_${d}_1_${uuid()}`, date: dateStr,
      amount: -12.50, currency: 'USD', name: 'Chipotle',
      merchant_name: 'Chipotle', category_primary: 'Food & Drink',
      category_detailed: 'Restaurants', pending: false,
      pending_transaction_id: null, metadata: {},
    });

    // Spike on days 3-5 (lots of dining out)
    if (d >= 3 && d <= 5) {
      txns.push({
        id: uuid(), user_id: USER_ID, provider: 'plaid',
        provider_txn_id: `dining_${d}_2_${uuid()}`, date: dateStr,
        amount: -45.00, currency: 'USD', name: 'DoorDash',
        merchant_name: 'DoorDash', category_primary: 'Food & Drink',
        category_detailed: 'Delivery', pending: false,
        pending_transaction_id: null, metadata: {},
      });
      txns.push({
        id: uuid(), user_id: USER_ID, provider: 'plaid',
        provider_txn_id: `dining_${d}_3_${uuid()}`, date: dateStr,
        amount: -28.00, currency: 'USD', name: 'Uber Eats',
        merchant_name: 'Uber Eats', category_primary: 'Food & Drink',
        category_detailed: 'Delivery', pending: false,
        pending_transaction_id: null, metadata: {},
      });
    }
  }

  return txns;
}

/**
 * A subscription that appears pending then posts
 */
export function pendingToPostedSubscription(): { pending: Transaction; posted: Transaction } {
  const pendingId = uuid();
  const postedId = uuid();
  const today = new Date().toISOString().split('T')[0];

  return {
    pending: {
      id: pendingId, user_id: USER_ID, provider: 'plaid',
      provider_txn_id: `pending_sub_${pendingId}`, date: today,
      amount: -15.99, currency: 'USD', name: 'Netflix',
      merchant_name: 'Netflix', category_primary: 'Entertainment',
      category_detailed: 'Streaming', pending: true,
      pending_transaction_id: null, metadata: {},
    },
    posted: {
      id: postedId, user_id: USER_ID, provider: 'plaid',
      provider_txn_id: `posted_sub_${postedId}`, date: today,
      amount: -15.99, currency: 'USD', name: 'Netflix',
      merchant_name: 'Netflix', category_primary: 'Entertainment',
      category_detailed: 'Streaming', pending: false,
      pending_transaction_id: `pending_sub_${pendingId}`, metadata: {},
    },
  };
}

/**
 * A subscription that stops charging (for "No merchant charge" verification quest)
 */
export function stoppedSubscriptionFixture(): Transaction[] {
  const txns: Transaction[] = [];

  // Charges in months -3, -2, but NOT month -1 or current
  for (let m = 3; m >= 2; m--) {
    const date = new Date();
    date.setMonth(date.getMonth() - m);
    date.setDate(15);
    txns.push({
      id: uuid(), user_id: USER_ID, provider: 'plaid',
      provider_txn_id: `gym_${m}_${uuid()}`, date: date.toISOString().split('T')[0],
      amount: -49.99, currency: 'USD', name: 'Planet Fitness',
      merchant_name: 'Planet Fitness', category_primary: 'Health',
      category_detailed: 'Gym', pending: false,
      pending_transaction_id: null, metadata: {},
    });
  }
  // No charges in last month = subscription stopped

  return txns;
}

/**
 * Edge cases: refunds, chargebacks, negative amounts, split transactions
 */
export function edgeCaseFixture(): Transaction[] {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  return [
    // Refund (positive amount)
    {
      id: uuid(), user_id: USER_ID, provider: 'plaid',
      provider_txn_id: `refund_${uuid()}`, date: today,
      amount: 25.00, currency: 'USD', name: 'Amazon Refund',
      merchant_name: 'Amazon', category_primary: 'Shopping',
      category_detailed: 'Online', pending: false,
      pending_transaction_id: null, metadata: { type: 'refund' },
    },
    // Very small charge
    {
      id: uuid(), user_id: USER_ID, provider: 'plaid',
      provider_txn_id: `small_${uuid()}`, date: today,
      amount: -0.50, currency: 'USD', name: 'Apple In-App',
      merchant_name: 'Apple.com', category_primary: 'Technology',
      category_detailed: 'Software', pending: false,
      pending_transaction_id: null, metadata: {},
    },
    // Large charge
    {
      id: uuid(), user_id: USER_ID, provider: 'plaid',
      provider_txn_id: `large_${uuid()}`, date: yesterday,
      amount: -450.00, currency: 'USD', name: 'Best Buy',
      merchant_name: 'Best Buy', category_primary: 'Shopping',
      category_detailed: 'Electronics', pending: false,
      pending_transaction_id: null, metadata: {},
    },
    // Pending charge
    {
      id: uuid(), user_id: USER_ID, provider: 'plaid',
      provider_txn_id: `pending_${uuid()}`, date: today,
      amount: -32.50, currency: 'USD', name: 'Target',
      merchant_name: 'Target', category_primary: 'Shopping',
      category_detailed: 'General Merchandise', pending: true,
      pending_transaction_id: null, metadata: {},
    },
  ];
}

export const TEST_USER_ID = USER_ID;
