import seedSuite from '../data/nessie-seed-transactions.json';

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

interface NessieOptions {
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

interface SeededNessieData {
  customerIds: string[];
  accountIds: string[];
  transactionsCreated: number;
}

function resolveNessieConfig(options: NessieOptions = {}) {
  const baseUrl =
    options.baseUrl ??
    process.env.EXPO_PUBLIC_NESSIE_BASE_URL ??
    process.env.NESSIE_BASE_URL ??
    DEFAULT_BASE_URL;

  const apiKey =
    options.apiKey ??
    process.env.EXPO_PUBLIC_NESSIE_API_KEY ??
    process.env.NESSIE_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Missing Nessie API key. Set EXPO_PUBLIC_NESSIE_API_KEY (app) or NESSIE_API_KEY (CLI).'
    );
  }

  return { baseUrl, apiKey };
}

async function nessieGet<T>(
  baseUrl: string,
  path: string,
  apiKey: string
): Promise<T> {
  const url = `${baseUrl}${path}?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Nessie API ${response.status} ${path}: ${body}`);
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

async function createCustomer(baseUrl: string, apiKey: string, idx: number) {
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
) {
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

async function getMerchantIds(baseUrl: string, apiKey: string) {
  const merchants = await nessieGet<NessieMerchant[]>(baseUrl, '/merchants', apiKey);
  return merchants.map((merchant) => merchant._id);
}

/**
 * Deletes all existing accounts for the API key so a clean seed can be created.
 */
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

/**
 * Clears existing accounts and creates realistic dummy data across checking, savings,
 * and credit-card accounts. Returns IDs and created transaction counts.
 */
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

/**
 * Fetches transaction history where amount is signed based on cash flow.
 * Negative = money out, positive = money in.
 */
export async function getTransactionHistory(
  startDate: Date,
  endDate: Date,
  options: NessieOptions = {}
): Promise<NessieTransaction[]> {
  const { baseUrl, apiKey } = resolveNessieConfig(options);

  const accounts = await nessieGet<NessieAccount[]>(baseUrl, '/accounts', apiKey);
  const allTransactions: NessieTransaction[] = [];

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
        if (txDate < startDate || txDate > endDate) return;

        let signedAmount = tx.amount;

        if (typeLabel === 'purchases' || typeLabel === 'withdrawals') {
          signedAmount = -Math.abs(tx.amount);
        } else if (typeLabel === 'deposits') {
          signedAmount = Math.abs(tx.amount);
        } else if (typeLabel === 'transfers') {
          signedAmount =
            tx.payer_id === accountId ? -Math.abs(tx.amount) : Math.abs(tx.amount);
        }

        allTransactions.push({
          _id: tx._id,
          type: tx.type || typeLabel,
          amount: signedAmount,
          description: tx.description || '',
          date: dateStr,
        });
      });
    });
  }

  const uniqueMap = new Map(allTransactions.map((t) => [t._id, t]));
  return Array.from(uniqueMap.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}
