import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database';
import { getTransactions } from './ingestion';
import { QuestStatus } from '../schemas';

interface QuestRow {
  id: string;
  user_id: string;
  status: string;
  title: string;
  window_start: string;
  window_end: string;
  metric_type: string;
  metric_params: string;
  reward_food_type: string;
  happiness_delta: number;
}

interface EvaluationResult {
  questId: string;
  previousStatus: string;
  newStatus: string;
  confirmedValue: number;
  pendingValue: number;
  explanation: string;
  rewardGranted: boolean;
}

/**
 * Evaluate a quest's progress based on actual transactions.
 * This is the core verification engine — only posted transactions confirm completion.
 */
export function evaluateQuest(questId: string): EvaluationResult {
  const db = getDb();
  const quest = db.prepare('SELECT * FROM quest WHERE id = ?').get(questId) as QuestRow | undefined;
  if (!quest) throw new Error(`Quest not found: ${questId}`);

  const params = JSON.parse(quest.metric_params);
  const now = new Date();
  const windowEnd = new Date(quest.window_end);
  const windowExpired = now > windowEnd;

  // Get posted transactions in window
  const posted = getTransactions(quest.user_id, quest.window_start, quest.window_end, {
    includePending: false,
    category: params.category,
    merchant_key: params.merchant_key,
  });

  // Get pending transactions in window
  const allTxns = getTransactions(quest.user_id, quest.window_start, quest.window_end, {
    includePending: true,
    category: params.category,
    merchant_key: params.merchant_key,
  });
  const pendingTxns = allTxns.filter(t => t.pending);

  let confirmedValue = 0;
  let pendingValue = 0;
  let newStatus: QuestStatus = quest.status as QuestStatus;
  let explanation = '';
  let rewardGranted = false;

  switch (quest.metric_type) {
    case 'CATEGORY_SPEND_CAP': {
      const cap = params.cap as number;
      confirmedValue = posted
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      pendingValue = pendingTxns
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      confirmedValue = Math.round(confirmedValue * 100) / 100;
      pendingValue = Math.round(pendingValue * 100) / 100;

      if (windowExpired) {
        newStatus = confirmedValue <= cap ? 'COMPLETED_VERIFIED' : 'FAILED';
        explanation = confirmedValue <= cap
          ? `Spent $${confirmedValue.toFixed(2)} (cap: $${cap.toFixed(2)}). Quest completed!`
          : `Spent $${confirmedValue.toFixed(2)} (cap: $${cap.toFixed(2)}). Over budget.`;
      } else if (confirmedValue > cap) {
        newStatus = 'FAILED';
        explanation = `Already spent $${confirmedValue.toFixed(2)}, exceeding cap of $${cap.toFixed(2)}.`;
      } else if (confirmedValue + pendingValue > cap) {
        newStatus = 'ACTIVE';
        explanation = `$${confirmedValue.toFixed(2)} confirmed + $${pendingValue.toFixed(2)} pending. Close to cap of $${cap.toFixed(2)}.`;
      } else {
        newStatus = 'ACTIVE';
        explanation = `$${confirmedValue.toFixed(2)} of $${cap.toFixed(2)} cap used so far. On track!`;
      }
      break;
    }

    case 'MERCHANT_SPEND_CAP': {
      const cap = params.cap as number;
      const merchantKey = params.merchant_key as string;
      const merchantPosted = posted.filter(t =>
        (t.merchant_name || t.name).toLowerCase() === merchantKey.toLowerCase() && t.amount < 0
      );
      const merchantPending = pendingTxns.filter(t =>
        (t.merchant_name || t.name).toLowerCase() === merchantKey.toLowerCase() && t.amount < 0
      );

      confirmedValue = Math.round(
        merchantPosted.reduce((sum, t) => sum + Math.abs(t.amount), 0) * 100
      ) / 100;
      pendingValue = Math.round(
        merchantPending.reduce((sum, t) => sum + Math.abs(t.amount), 0) * 100
      ) / 100;

      if (windowExpired) {
        newStatus = confirmedValue <= cap ? 'COMPLETED_VERIFIED' : 'FAILED';
        explanation = confirmedValue <= cap
          ? `Spent $${confirmedValue.toFixed(2)} at ${merchantKey} (cap: $${cap.toFixed(2)}). Quest completed!`
          : `Spent $${confirmedValue.toFixed(2)} at ${merchantKey} (cap: $${cap.toFixed(2)}). Over limit.`;
      } else if (confirmedValue > cap) {
        newStatus = 'FAILED';
        explanation = `Already spent $${confirmedValue.toFixed(2)} at ${merchantKey}, exceeding cap.`;
      } else {
        newStatus = 'ACTIVE';
        explanation = `$${confirmedValue.toFixed(2)} of $${cap.toFixed(2)} cap at ${merchantKey}.`;
      }
      break;
    }

    case 'NO_MERCHANT_CHARGE': {
      const merchantKey = params.merchant_key as string;
      const merchantPosted = posted.filter(t =>
        (t.merchant_name || t.name).toLowerCase() === merchantKey.toLowerCase() && t.amount < 0
      );
      const merchantPending = pendingTxns.filter(t =>
        (t.merchant_name || t.name).toLowerCase() === merchantKey.toLowerCase() && t.amount < 0
      );

      confirmedValue = merchantPosted.length;
      pendingValue = merchantPending.length;

      if (windowExpired) {
        newStatus = confirmedValue === 0 ? 'COMPLETED_VERIFIED' : 'FAILED';
        explanation = confirmedValue === 0
          ? `No charges from ${merchantKey} detected. Verification passed!`
          : `${confirmedValue} charge(s) from ${merchantKey} detected.`;
      } else if (confirmedValue > 0) {
        newStatus = 'FAILED';
        explanation = `${confirmedValue} posted charge(s) from ${merchantKey} detected.`;
      } else if (pendingValue > 0) {
        newStatus = 'COMPLETED_PROVISIONAL';
        explanation = `No posted charges from ${merchantKey}, but ${pendingValue} pending. Provisional until posting.`;
      } else {
        newStatus = 'ACTIVE';
        explanation = `No charges from ${merchantKey} so far. Monitoring continues.`;
      }
      break;
    }

    case 'TRANSFER_AMOUNT': {
      const targetAmount = params.target_amount as number;
      const transferTxns = posted.filter(t => t.amount > 0 && (
        t.category_primary === 'Transfer' ||
        t.name.toLowerCase().includes('transfer') ||
        t.name.toLowerCase().includes('savings')
      ));
      const pendingTransfers = pendingTxns.filter(t => t.amount > 0 && (
        t.category_primary === 'Transfer' ||
        t.name.toLowerCase().includes('transfer')
      ));

      confirmedValue = Math.round(
        transferTxns.reduce((sum, t) => sum + t.amount, 0) * 100
      ) / 100;
      pendingValue = Math.round(
        pendingTransfers.reduce((sum, t) => sum + t.amount, 0) * 100
      ) / 100;

      if (confirmedValue >= targetAmount) {
        newStatus = 'COMPLETED_VERIFIED';
        explanation = `Transferred $${confirmedValue.toFixed(2)} (target: $${targetAmount.toFixed(2)}). Quest completed!`;
      } else if (confirmedValue + pendingValue >= targetAmount) {
        newStatus = 'COMPLETED_PROVISIONAL';
        explanation = `$${confirmedValue.toFixed(2)} confirmed + $${pendingValue.toFixed(2)} pending toward $${targetAmount.toFixed(2)} target.`;
      } else if (windowExpired) {
        newStatus = 'EXPIRED';
        explanation = `Only $${confirmedValue.toFixed(2)} of $${targetAmount.toFixed(2)} transferred before deadline.`;
      } else {
        newStatus = 'ACTIVE';
        explanation = `$${confirmedValue.toFixed(2)} of $${targetAmount.toFixed(2)} transferred so far.`;
      }
      break;
    }
  }

  const previousStatus = quest.status;

  // Atomic: update quest status + snapshot + reward in a single transaction
  const commitEvaluation = db.transaction(() => {
    // Update quest status
    db.prepare(`UPDATE quest SET status = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(newStatus, questId);

    // Create progress snapshot
    db.prepare(`
      INSERT INTO quest_progress_snapshot (id, quest_id, confirmed_value, pending_value, status, explanation)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuid(), questId, confirmedValue, pendingValue, newStatus, explanation);

    // Grant reward on verified completion
    if (newStatus === 'COMPLETED_VERIFIED' && previousStatus !== 'COMPLETED_VERIFIED') {
      grantReward(quest.user_id, quest.reward_food_type, quest.happiness_delta);
      rewardGranted = true;
    }
  });

  commitEvaluation();

  return {
    questId,
    previousStatus,
    newStatus,
    confirmedValue,
    pendingValue,
    explanation,
    rewardGranted,
  };
}

/**
 * Evaluate all active quests for a user.
 */
export function evaluateUserQuests(userId: string): EvaluationResult[] {
  const db = getDb();
  const quests = db.prepare(
    `SELECT id FROM quest WHERE user_id = ? AND status IN ('ACTIVE', 'COMPLETED_PROVISIONAL')`
  ).all(userId) as { id: string }[];

  return quests.map(q => evaluateQuest(q.id));
}

/**
 * Grant reward: update scotty_state with happiness and food credit.
 */
function grantReward(userId: string, foodType: string, happinessDelta: number): void {
  const db = getDb();
  const now = new Date().toISOString();

  // Ensure scotty_state exists
  db.prepare(`
    INSERT OR IGNORE INTO scotty_state (user_id, happiness, mood, food_credits)
    VALUES (?, 70, 'content', 10)
  `).run(userId);

  db.prepare(`
    UPDATE scotty_state SET
      happiness = MIN(100, happiness + ?),
      mood = CASE
        WHEN MIN(100, happiness + ?) >= 80 THEN 'happy'
        WHEN MIN(100, happiness + ?) >= 50 THEN 'content'
        WHEN MIN(100, happiness + ?) >= 25 THEN 'worried'
        ELSE 'sad'
      END,
      food_credits = food_credits + 3,
      last_reward_food = ?,
      last_reward_at = ?,
      updated_at = datetime('now')
    WHERE user_id = ?
  `).run(happinessDelta, happinessDelta, happinessDelta, happinessDelta, foodType, now, userId);
}
