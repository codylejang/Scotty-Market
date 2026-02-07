import {
  getTransactionHistory,
  resetAndSeedNessieDummyData,
} from '../services/nessie';

/**
 * Parse a date string or return the provided fallback Date.
 *
 * @param value - A date string (expected format YYYY-MM-DD). If falsy or undefined, the `fallback` is returned.
 * @param fallback - Date to return when `value` is not provided or is falsy.
 * @returns The parsed Date for `value`, or `fallback` if `value` is falsy.
 * @throws Error if `value` is present but cannot be parsed as a valid date.
 */
function parseDateArg(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: "${value}". Use YYYY-MM-DD.`);
  }
  return parsed;
}

/**
 * Parse CLI arguments to determine a transaction date range, whether to seed data, and an optional base URL.
 *
 * Parses process.argv (excluding node/executable) for key=value pairs and standalone flags. Recognized keys:
 * `--start` and `--end` (date strings parsed via parseDateArg; defaults: `--start` = 120 days before today, `--end` = today),
 * `--seed` (accepted as a flag or as `--seed=true`/`--seed=1`), and `--base-url`.
 *
 * @returns An object with:
 * - `startDate`: the parsed start date
 * - `endDate`: the parsed end date (guaranteed to be on or after `startDate`)
 * - `shouldSeed`: `true` when seeding was requested, `false` otherwise
 * - `baseUrl`: the value of `--base-url` if provided, or `undefined`
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const kv = new Map<string, string>();
  const flags = new Set<string>();

  for (const arg of args) {
    if (arg.includes('=')) {
      const [key, value] = arg.split('=');
      if (key && value) kv.set(key, value);
    } else {
      flags.add(arg);
    }
  }

  const today = new Date();
  const startDefault = new Date();
  startDefault.setDate(today.getDate() - 120);

  const startDate = parseDateArg(kv.get('--start'), startDefault);
  const endDate = parseDateArg(kv.get('--end'), today);

  if (endDate < startDate) {
    throw new Error('--end must be on or after --start.');
  }

  const shouldSeed =
    flags.has('--seed') || kv.get('--seed') === 'true' || kv.get('--seed') === '1';
  const baseUrl = kv.get('--base-url');

  return { startDate, endDate, shouldSeed, baseUrl };
}

/**
 * Run the Nessie test CLI: parse command-line arguments, optionally seed the Nessie sandbox, fetch transactions for the date range, compute totals, and print a concise summary.
 *
 * When the `--seed` flag or equivalent is provided, the function seeds dummy data before fetching transactions. It prints the date range, total transaction count, money in, money out, and up to the 20 most recent transactions with date, type, amount, and description.
 */
async function main() {
  const { startDate, endDate, shouldSeed, baseUrl } = parseArgs();

  if (shouldSeed) {
    const seedResult = await resetAndSeedNessieDummyData({ baseUrl });
    console.log(
      `Seeded Nessie sandbox: ${seedResult.customerIds.length} customers, ${seedResult.accountIds.length} accounts, ${seedResult.transactionsCreated} transactions`
    );
  }

  const transactions = await getTransactionHistory(startDate, endDate, { baseUrl });

  const moneyOut = transactions
    .filter((tx) => tx.amount < 0)
    .reduce((sum, tx) => sum + tx.amount, 0);
  const moneyIn = transactions
    .filter((tx) => tx.amount > 0)
    .reduce((sum, tx) => sum + tx.amount, 0);

  console.log(
    `Nessie test result for ${startDate.toISOString().slice(0, 10)} to ${endDate
      .toISOString()
      .slice(0, 10)}`
  );
  console.log(`Transactions: ${transactions.length}`);
  console.log(`Money in: $${moneyIn.toFixed(2)}`);
  console.log(`Money out: $${Math.abs(moneyOut).toFixed(2)}`);
  console.log('Most recent 20 transactions:');

  for (const tx of transactions.slice(0, 20)) {
    console.log(
      `- ${tx.date} | ${tx.type} | ${tx.amount.toFixed(2)} | ${tx.description || '(no description)'}`
    );
  }
}

main().catch((error) => {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    console.error('Nessie test failed:', error.message);
    if (cause) {
      console.error('Cause:', cause);
    }
  } else {
    console.error('Nessie test failed:', error);
  }
  process.exit(1);
});