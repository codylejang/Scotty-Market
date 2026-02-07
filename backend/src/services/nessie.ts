import { Transaction } from '../schemas';
import seedSuite from '../data/seed-transactions.json';

export interface NessieTransaction {
  _id: string;
  type: string;
  amount: number;
  description: string;
  date: string;
}

interface NessieAccount {
  _id: string;
}

interface NessieCustomer {
  _id: string;
}

interface NessieMerchant {
  _id: string;
}

type SeedAccountKey =
  | 'primary_checking'
  | 'emergency_savings'
  | 'travel_card'
  | 'household_checking';

type SeedTransactionKind = 'purchase' | 'deposit' | 'withdrawal' | 'transfer';

interface SeedTransaction {
  kind: SeedTransactionKind;
  account: SeedAccountKey;
  payeeAccount?: SeedAccountKey;
  date: string;
  amount: number;
  description: string;
}

interface SeedSuite {
  transactions: SeedTransaction[];
}

interface NessieRawTransaction {
  _id: string;
  type?: string;
  amount: number;
  description?: string;
  purchase_date?: string;
  transaction_date?: string;
  payer_id?: string;
}

export interface NessieOptions {
  baseUrl?: string;
  apiKey?: string;
}

const DEFAULT_BASE_URL = 'http://api.nessieisreal.com';
const DEFAULT_TYPES = ['purchases', 'deposits', 'withdrawals', 'transfers'] as const;
const DEFAULT_ACCOUNT_TYPES = ['Checking', 'Savings', 'Credit Card'] as const;
const parsedSeedSuite = seedSuite as SeedSuite;

interface NessieCreateResponse<T> {
  objectCreated?: T;
  code?: number;
  message?: string;
}

export interface SeededNessieData {
  customerIds: string[];
  accountIds: string[];
  transactionsCreated: number;
}

function resolveNessieConfig(options: NessieOptions = {}) {
  const baseUrl = options.baseUrl ?? process.env.NESSIE_BASE_URL ?? DEFAULT_BASE_URL;
  const apiKey = options.apiKey ?? process.env.NESSIE_API_KEY;

  if (!apiKey) {
    throw new Error('Missing Nessie API key. Set NESSIE_API_KEY.');
  }

  return { baseUrl, apiKey };
}

async function nessieGet<T>(baseUrl: string, path: string, apiKey: string): Promise<T> {
  const url = `${baseUrl}${path}?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Nessie API ${response.status} GET ${path}: ${body}`);
  }

  return response.json() as Promise<T>;
}

async function nessieRequest<T>(
  baseUrl: string,
  path: string,
  apiKey: string,
  method: 'GET' | 'POST' | 'DELETE',
  body?: unknown
): Promise<T> {
  const url = `${baseUrl}${path}?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Nessie API ${response.status} ${method} ${path}: ${text}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function createCustomer(baseUrl: string, apiKey: string, idx: number): Promise<string> {
  const response = await nessieRequest<NessieCreateResponse<NessieCustomer>>(
    baseUrl,
    '/customers',
    apiKey,
    'POST',
    {
      first_name: `Scotty${idx}`,
      last_name: 'Sandbox',
      address: {
        street_number: `${100 + idx}`,
        street_name: 'Main St',
        city: 'Austin',
        state: 'TX',
        zip: '73301',
      },
    }
  );

  if (!response.objectCreated?._id) {
    throw new Error(`Failed to create customer: ${JSON.stringify(response)}`);
  }

  return response.objectCreated._id;
}

async function createAccount(
  baseUrl: string,
  apiKey: string,
  customerId: string,
  type: (typeof DEFAULT_ACCOUNT_TYPES)[number],
  nickname: string,
  balance: number
): Promise<string> {
  const response = await nessieRequest<NessieCreateResponse<NessieAccount>>(
    baseUrl,
    `/customers/${customerId}/accounts`,
    apiKey,
    'POST',
    {
      type,
      nickname,
      rewards: 0,
      balance,
    }
  );

  if (!response.objectCreated?._id) {
    throw new Error(`Failed to create ${type} account: ${JSON.stringify(response)}`);
  }

  return response.objectCreated._id;
}

async function getMerchantIds(baseUrl: string, apiKey: string): Promise<string[]> {
  const merchants = await nessieGet<NessieMerchant[]>(baseUrl, '/merchants', apiKey);
  return merchants.map((merchant) => merchant._id);
}

function splitDescription(description: string): {
  prefix: string | null;
  detail: string | null;
} {
  const parts = description.split(' - ');
  if (parts.length <= 1) {
    const trimmed = description.trim();
    return {
      prefix: null,
      detail: trimmed.length > 0 ? trimmed : null,
    };
  }

  const [prefixRaw, ...rest] = parts;
  const prefix = prefixRaw.trim() || null;
  const detail = rest.join(' - ').trim() || null;
  return { prefix, detail };
}

export function inferNessieCategory(type: string, description: string): string {
  const { prefix } = splitDescription(description);
  if (prefix) {
    const normalizedPrefix = prefix.toLowerCase();
    if (normalizedPrefix.includes('income')) return 'Income';
    if (normalizedPrefix.includes('grocer')) return 'Groceries';
    if (normalizedPrefix.includes('dining')) return 'Food & Drink';
    if (normalizedPrefix.includes('travel')) return 'Transportation';
    if (normalizedPrefix.includes('fun')) return 'Entertainment';
    if (normalizedPrefix.includes('shopping')) return 'Shopping';
    if (normalizedPrefix.includes('self-care')) return 'Health';
    if (normalizedPrefix.includes('misc')) return 'Other';
    if (normalizedPrefix.includes('transfer')) return 'Transfer';
    if (normalizedPrefix.includes('subscription')) return 'Subscription';
  }

  const text = `${type} ${description}`.toLowerCase();
  if (
    text.includes('subscription') ||
    text.includes('netflix') ||
    text.includes('spotify') ||
    text.includes('disney+') ||
    text.includes('icloud') ||
    text.includes('chatgpt')
  ) {
    return 'Subscription';
  }
  if (text.includes('grocer')) return 'Groceries';
  if (
    text.includes('dining') ||
    text.includes('restaurant') ||
    text.includes('cafe') ||
    text.includes('coffee')
  ) {
    return 'Food & Drink';
  }
  if (
    text.includes('travel') ||
    text.includes('airport') ||
    text.includes('flight') ||
    text.includes('train') ||
    text.includes('bus') ||
    text.includes('rideshare')
  ) {
    return 'Transportation';
  }
  if (
    text.includes('fun') ||
    text.includes('movie') ||
    text.includes('concert') ||
    text.includes('museum') ||
    text.includes('theme park')
  ) {
    return 'Entertainment';
  }
  if (
    text.includes('shopping') ||
    text.includes('gift') ||
    text.includes('clothes') ||
    text.includes('sale')
  ) {
    return 'Shopping';
  }
  if (
    text.includes('self-care') ||
    text.includes('pharmacy') ||
    text.includes('wellness') ||
    text.includes('salon') ||
    text.includes('dental')
  ) {
    return 'Health';
  }
  if (text.includes('transfer')) return 'Transfer';
  if (type.toLowerCase().includes('deposit')) return 'Income';
  return 'Other';
}

function inferSignedSeedAmount(seedTx: SeedTransaction): number {
  const amount = Math.abs(seedTx.amount);
  if (seedTx.kind === 'purchase' || seedTx.kind === 'withdrawal') {
    return -amount;
  }
  if (seedTx.kind === 'deposit') {
    return amount;
  }
  // Seed transfer records are written from payer account perspective.
  return -amount;
}

function formatDate(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}

export function buildSeedTransactionsForUser(userId: string): Transaction[] {
  return parsedSeedSuite.transactions
    .map((seedTx, index) => {
      const description = seedTx.description || `${seedTx.kind} transaction`;
      const { prefix, detail } = splitDescription(description);
      const merchant = (detail || description || seedTx.kind).trim();
      const providerTxnId = `${userId}:nessie-seed:${index}:${seedTx.date}:${seedTx.kind}`;

      return {
        id: `${userId}_nessie_seed_${index}`,
        user_id: userId,
        provider: 'nessie',
        provider_txn_id: providerTxnId,
        date: formatDate(seedTx.date),
        amount: inferSignedSeedAmount(seedTx),
        currency: 'USD',
        name: merchant,
        merchant_name: merchant,
        category_primary: inferNessieCategory(seedTx.kind, description),
        category_detailed: prefix,
        pending: false,
        pending_transaction_id: null,
        metadata: {
          source: 'seed_json',
          kind: seedTx.kind,
          account: seedTx.account,
          payee_account: seedTx.payeeAccount ?? null,
        },
      } satisfies Transaction;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function mapNessieTransactionsToBackendTransactions(
  userId: string,
  transactions: NessieTransaction[]
): Transaction[] {
  return transactions.map((tx) => {
    const description = tx.description || tx.type;
    const { prefix, detail } = splitDescription(description);
    const merchant = (detail || description || tx.type).trim();
    const providerTxnId = `${userId}:nessie:${tx._id}`;

    return {
      id: `${userId}_nessie_${tx._id}`,
      user_id: userId,
      provider: 'nessie',
      provider_txn_id: providerTxnId,
      date: formatDate(tx.date),
      amount: tx.amount,
      currency: 'USD',
      name: merchant,
      merchant_name: merchant,
      category_primary: inferNessieCategory(tx.type, description),
      category_detailed: prefix,
      pending: false,
      pending_transaction_id: null,
      metadata: {
        source: 'nessie_api',
        nessie_id: tx._id,
        nessie_type: tx.type,
      },
    } satisfies Transaction;
  });
}

export async function clearAllAccounts(options: NessieOptions = {}): Promise<number> {
  const { baseUrl, apiKey } = resolveNessieConfig(options);
  const accounts = await nessieGet<NessieAccount[]>(baseUrl, '/accounts', apiKey);

  await Promise.all(
    accounts.map((account) =>
      nessieRequest<void>(baseUrl, `/accounts/${account._id}`, apiKey, 'DELETE')
    )
  );

  return accounts.length;
}

export async function resetAndSeedNessieDummyData(
  options: NessieOptions = {}
): Promise<SeededNessieData> {
  const { baseUrl, apiKey } = resolveNessieConfig(options);
  await clearAllAccounts({ baseUrl, apiKey });

  const [customerA, customerB] = await Promise.all([
    createCustomer(baseUrl, apiKey, 1),
    createCustomer(baseUrl, apiKey, 2),
  ]);
  const customerIds = [customerA, customerB];

  const [checkingId, savingsId, creditCardId, secondCheckingId] = await Promise.all([
    createAccount(baseUrl, apiKey, customerA, 'Checking', 'Primary Checking', 2800),
    createAccount(baseUrl, apiKey, customerA, 'Savings', 'Emergency Savings', 9200),
    createAccount(baseUrl, apiKey, customerA, 'Credit Card', 'Travel Card', 600),
    createAccount(baseUrl, apiKey, customerB, 'Checking', 'Household Checking', 1400),
  ]);
  const accountIds = [checkingId, savingsId, creditCardId, secondCheckingId];
  const accountIdByKey: Record<SeedAccountKey, string> = {
    primary_checking: checkingId,
    emergency_savings: savingsId,
    travel_card: creditCardId,
    household_checking: secondCheckingId,
  };

  const merchantIds = await getMerchantIds(baseUrl, apiKey);
  if (merchantIds.length === 0) {
    throw new Error('No merchants returned by Nessie; cannot create purchase records.');
  }

  let transactionsCreated = 0;
  for (let i = 0; i < parsedSeedSuite.transactions.length; i++) {
    const tx = parsedSeedSuite.transactions[i];
    const accountId = accountIdByKey[tx.account];

    try {
      if (tx.kind === 'purchase') {
        const merchantId = merchantIds[i % merchantIds.length];
        await nessieRequest(
          baseUrl,
          `/accounts/${accountId}/purchases`,
          apiKey,
          'POST',
          {
            merchant_id: merchantId,
            medium: 'balance',
            purchase_date: tx.date,
            amount: tx.amount,
            status: 'completed',
            description: tx.description,
          }
        );
      } else if (tx.kind === 'deposit') {
        await nessieRequest(
          baseUrl,
          `/accounts/${accountId}/deposits`,
          apiKey,
          'POST',
          {
            medium: 'balance',
            transaction_date: tx.date,
            amount: tx.amount,
            status: 'completed',
            description: tx.description,
          }
        );
      } else if (tx.kind === 'withdrawal') {
        await nessieRequest(
          baseUrl,
          `/accounts/${accountId}/withdrawals`,
          apiKey,
          'POST',
          {
            medium: 'balance',
            transaction_date: tx.date,
            amount: tx.amount,
            status: 'completed',
            description: tx.description,
          }
        );
      } else if (tx.kind === 'transfer') {
        if (!tx.payeeAccount) {
          throw new Error('Missing payeeAccount for transfer record.');
        }
        await nessieRequest(
          baseUrl,
          `/accounts/${accountId}/transfers`,
          apiKey,
          'POST',
          {
            medium: 'balance',
            transaction_date: tx.date,
            payee_id: accountIdByKey[tx.payeeAccount],
            amount: tx.amount,
            status: 'completed',
            description: tx.description,
          }
        );
      }

      transactionsCreated += 1;
    } catch (error) {
      throw new Error(
        `Failed seeding tx #${i + 1} (${tx.kind} ${tx.account} ${tx.date}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  return {
    customerIds,
    accountIds,
    transactionsCreated,
  };
}

function signedAmountForNessieType(
  typeLabel: (typeof DEFAULT_TYPES)[number],
  tx: NessieRawTransaction,
  accountId: string
): number {
  if (typeLabel === 'purchases' || typeLabel === 'withdrawals') {
    return -Math.abs(tx.amount);
  }
  if (typeLabel === 'deposits') {
    return Math.abs(tx.amount);
  }
  return tx.payer_id === accountId ? -Math.abs(tx.amount) : Math.abs(tx.amount);
}

function shouldReplaceExistingTransfer(existing: NessieTransaction, nextTx: NessieTransaction): boolean {
  // If we receive the same transfer via payer and payee account listings,
  // keep the outgoing (negative) representation for consistent cash-out semantics.
  return existing.amount >= 0 && nextTx.amount < 0;
}

export async function getTransactionHistory(
  startDate: Date,
  endDate: Date,
  options: NessieOptions = {}
): Promise<NessieTransaction[]> {
  const { baseUrl, apiKey } = resolveNessieConfig(options);
  const accounts = await nessieGet<NessieAccount[]>(baseUrl, '/accounts', apiKey);
  const byId = new Map<string, NessieTransaction>();

  for (const account of accounts) {
    const accountId = account._id;
    const responses = await Promise.all(
      DEFAULT_TYPES.map((type) =>
        nessieGet<NessieRawTransaction[]>(
          baseUrl,
          `/accounts/${accountId}/${type}`,
          apiKey
        )
      )
    );

    responses.forEach((rawData, index) => {
      const typeLabel = DEFAULT_TYPES[index];

      rawData.forEach((tx) => {
        const dateStr = tx.purchase_date || tx.transaction_date;
        if (!dateStr) return;

        const txDate = new Date(dateStr);
        if (Number.isNaN(txDate.getTime())) return;
        if (txDate < startDate || txDate > endDate) return;

        const mapped: NessieTransaction = {
          _id: tx._id,
          type: tx.type || typeLabel,
          amount: signedAmountForNessieType(typeLabel, tx, accountId),
          description: tx.description || '',
          date: formatDate(dateStr),
        };

        const existing = byId.get(mapped._id);
        if (!existing) {
          byId.set(mapped._id, mapped);
          return;
        }

        if (typeLabel === 'transfers' && shouldReplaceExistingTransfer(existing, mapped)) {
          byId.set(mapped._id, mapped);
          return;
        }

        if (!existing.description && mapped.description) {
          byId.set(mapped._id, mapped);
        }
      });
    });
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}
