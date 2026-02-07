import { Transaction, Achievement, ChatMessage, DailyInsight } from '../types';
import { getSpendingByCategory, getTotalSpending } from './mockData';

// AI Service for Scotty
// In production, these would call Claude/OpenAI APIs
// For hackathon demo, we'll use realistic mock responses

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// System prompts for different AI functions
export const SYSTEM_PROMPTS = {
  chat: `You are Scotty, a friendly Scottish Terrier who helps college students manage their money.
You're encouraging, supportive, and occasionally use dog puns.
Keep responses short (2-3 sentences max).
You have access to the user's spending data and can give personalized advice.
Never be judgmental - always be supportive while being honest.
Occasionally use phrases like "ruff situation" or "pawsitive progress" but don't overdo it.`,

  achievements: `You are a financial advisor AI generating personalized micro-goals for a college student.
Based on their spending data, create 3 specific, achievable goals that:
1. Are completable within 1-7 days
2. Have a clear dollar amount saved
3. Are encouraging and not judgmental
4. Reference specific merchants or categories from their data

Format as JSON array with fields: title, description, targetAmount (optional), category (optional)`,

  insights: `You are generating a single brief insight (1 sentence) for a college student about their spending.
Be specific to their data. Use a friendly, encouraging tone.
Examples of good insights:
- "Your grocery spending is 15% lower than last week - nice work!"
- "Heads up: You've had 3 Uber Eats orders this week"
- "You're on track to beat your entertainment budget this month!"`,
};

interface AIConfig {
  apiKey?: string;
  useRealAI: boolean;
}

let config: AIConfig = {
  useRealAI: false, // Set to true and add API key to use real Claude
};

export function configureAI(newConfig: Partial<AIConfig>) {
  config = { ...config, ...newConfig };
}

// Format transaction data for AI context
function formatTransactionsForAI(transactions: Transaction[]): string {
  const spending = getSpendingByCategory(transactions);
  const total = getTotalSpending(transactions, 30);

  const topMerchants = transactions
    .reduce((acc, t) => {
      acc[t.merchant] = (acc[t.merchant] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

  const sortedMerchants = Object.entries(topMerchants)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return `
Monthly spending: $${total.toFixed(2)}
Top categories: ${Object.entries(spending)
    .filter(([, amount]) => amount > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([cat, amount]) => `${cat}: $${amount.toFixed(0)}`)
    .join(', ')}
Top merchants: ${sortedMerchants.map(([m, a]) => `${m}: $${a.toFixed(0)}`).join(', ')}
  `.trim();
}

// Call Claude API (for production use)
async function callClaudeAPI(systemPrompt: string, userMessage: string): Promise<string> {
  if (!config.apiKey) {
    throw new Error('API key not configured');
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

// Generate chat response from Scotty
export async function generateChatResponse(
  userMessage: string,
  transactions: Transaction[],
  chatHistory: ChatMessage[]
): Promise<string> {
  const context = formatTransactionsForAI(transactions);

  if (config.useRealAI && config.apiKey) {
    const historyContext = chatHistory
      .slice(-4)
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');

    return callClaudeAPI(
      SYSTEM_PROMPTS.chat,
      `User's financial data:\n${context}\n\nRecent chat:\n${historyContext}\n\nUser says: ${userMessage}`
    );
  }

  // Mock responses for demo
  return generateMockChatResponse(userMessage, transactions);
}

function generateMockChatResponse(userMessage: string, transactions: Transaction[]): string {
  const lowerMessage = userMessage.toLowerCase();
  const total = getTotalSpending(transactions, 30);
  const spending = getSpendingByCategory(transactions);

  // Contextual responses based on keywords
  if (lowerMessage.includes('how am i doing') || lowerMessage.includes('status')) {
    if (total < 800) {
      return "Woof! You're doing pawsitively great! Your spending is well under control this month. Keep it up! 🐕";
    } else {
      return "You're doing okay, but I've noticed some areas where we could trim back. Want to look at your top spending categories?";
    }
  }

  if (lowerMessage.includes('food') || lowerMessage.includes('eating')) {
    const foodSpend = (spending.food_dining || 0) + (spending.groceries || 0);
    return `You've spent $${foodSpend.toFixed(0)} on food this month. ${foodSpend > 300 ? "That's a bit ruff on the budget - maybe try meal prepping?" : "Not bad at all! Good balance between dining out and groceries."}`;
  }

  if (lowerMessage.includes('save') || lowerMessage.includes('saving')) {
    return "Great question! Based on your spending, I'd suggest starting with cutting one subscription and reducing delivery orders by half. That could save you $50-80/month!";
  }

  if (lowerMessage.includes('subscription')) {
    return "I see you have a few subscriptions running. When's the last time you used all of them? Sometimes we forget about ones we signed up for months ago!";
  }

  if (lowerMessage.includes('help')) {
    return "I'm here for you! I can help you track spending, set goals, and stay on budget. Just ask me about your finances or how you're doing!";
  }

  // Default friendly responses
  const defaults = [
    "Interesting! Tell me more about your financial goals and I'll help you get there.",
    "I'm always here to help! Try asking me how you're doing or about specific spending categories.",
    "*perks up ears* I'd love to help you save more. What area of spending concerns you most?",
  ];

  return defaults[Math.floor(Math.random() * defaults.length)];
}

// Generate AI achievements based on spending
export async function generateAIAchievements(transactions: Transaction[]): Promise<Achievement[]> {
  const context = formatTransactionsForAI(transactions);

  if (config.useRealAI && config.apiKey) {
    const response = await callClaudeAPI(
      SYSTEM_PROMPTS.achievements,
      `Generate personalized savings goals based on this data:\n${context}`
    );

    try {
      return JSON.parse(response);
    } catch {
      console.error('Failed to parse AI achievements');
    }
  }

  // Use mock achievements
  return generateMockAchievements(transactions);
}

function generateMockAchievements(transactions: Transaction[]): Achievement[] {
  const spending = getSpendingByCategory(transactions);
  const achievements: Achievement[] = [];

  // Delivery reduction
  const deliverySpend = transactions
    .filter(t => ['DoorDash', 'Uber Eats'].includes(t.merchant))
    .reduce((sum, t) => sum + t.amount, 0);

  if (deliverySpend > 50) {
    achievements.push({
      id: `ach_${Date.now()}_1`,
      title: '🍳 Home Chef Week',
      description: `You've spent $${deliverySpend.toFixed(0)} on delivery. Cook all meals for 5 days to save ~$40!`,
      targetAmount: Math.round(deliverySpend * 0.6),
      completed: false,
      category: 'food_dining',
      aiGenerated: true,
    });
  }

  // Coffee challenge
  const coffeeSpend = transactions
    .filter(t => t.merchant === 'Starbucks')
    .reduce((sum, t) => sum + t.amount, 0);

  if (coffeeSpend > 25) {
    achievements.push({
      id: `ach_${Date.now()}_2`,
      title: '☕ Barista Mode',
      description: 'Make your own coffee Mon-Thu, treat yourself Friday. Save ~$15 this week!',
      targetAmount: 15,
      completed: false,
      category: 'food_dining',
      aiGenerated: true,
    });
  }

  // Entertainment budget
  if ((spending.entertainment || 0) > 60) {
    achievements.push({
      id: `ach_${Date.now()}_3`,
      title: '🎮 Free Fun Friday',
      description: 'Find 3 free entertainment activities this week (parks, game nights, campus events).',
      completed: false,
      category: 'entertainment',
      aiGenerated: true,
    });
  }

  // General no-spend challenge
  achievements.push({
    id: `ach_${Date.now()}_4`,
    title: '💪 No-Spend Weekend',
    description: 'Make it through Saturday and Sunday without any discretionary spending!',
    targetAmount: 0,
    completed: false,
    aiGenerated: true,
  });

  return achievements;
}

// Generate daily insight blurb
export async function generateDailyInsight(transactions: Transaction[]): Promise<DailyInsight> {
  const context = formatTransactionsForAI(transactions);

  if (config.useRealAI && config.apiKey) {
    const response = await callClaudeAPI(
      SYSTEM_PROMPTS.insights,
      `Generate one brief insight:\n${context}`
    );

    return {
      id: `insight_${Date.now()}`,
      message: response,
      type: 'neutral',
      date: new Date(),
    };
  }

  return generateMockInsight(transactions);
}

function generateMockInsight(transactions: Transaction[]): DailyInsight {
  const recentTransactions = transactions.slice(0, 10);
  const total = getTotalSpending(transactions, 7);
  const spending = getSpendingByCategory(transactions);

  const insights: Array<{ message: string; type: 'positive' | 'neutral' | 'warning' }> = [];

  // Check for positive patterns
  if (total < 150) {
    insights.push({
      message: "Ruff! You've spent less than $150 this week. That's pawsome budgeting! 🐕",
      type: 'positive',
    });
  }

  // Check for concerning patterns
  const deliveryCount = recentTransactions.filter(t =>
    ['DoorDash', 'Uber Eats'].includes(t.merchant)
  ).length;

  if (deliveryCount >= 3) {
    insights.push({
      message: `Heads up! That's ${deliveryCount} delivery orders recently. Your wallet might need a walk instead!`,
      type: 'warning',
    });
  }

  // Grocery insight
  if ((spending.groceries || 0) > (spending.food_dining || 0)) {
    insights.push({
      message: "Nice! You're spending more on groceries than dining out. Smart money moves!",
      type: 'positive',
    });
  }

  // Default neutral insights
  insights.push({
    message: "Remember: small daily savings add up to big monthly wins!",
    type: 'neutral',
  });

  const selected = insights[Math.floor(Math.random() * insights.length)];

  return {
    id: `insight_${Date.now()}`,
    message: selected.message,
    type: selected.type,
    date: new Date(),
  };
}
