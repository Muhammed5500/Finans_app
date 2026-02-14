import { AppError } from '../../utils/errors';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemini-2.0-flash-001';

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY || '';
  if (!key) throw new Error('OPENROUTER_API_KEY is not configured');
  return key;
}

async function callAI(messages: Array<{ role: string; content: string }>): Promise<string> {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getApiKey()}`,
      'HTTP-Referer': 'https://finans-app-ashen.vercel.app',
      'X-Title': 'Kamil Finance',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    if (res.status === 429) {
      throw new AppError(429, 'AI quota limit exceeded. Please wait a moment and try again.', 'AI_RATE_LIMIT');
    }
    if (res.status === 401 || res.status === 403) {
      throw new AppError(503, 'AI service is currently unavailable. Please check API key.', 'AI_AUTH_ERROR');
    }
    throw new AppError(502, `AI service error: ${errorBody}`, 'AI_ERROR');
  }

  const json: any = await res.json();
  return json.choices?.[0]?.message?.content || '';
}

function handleAIError(err: unknown): never {
  if (err instanceof AppError) throw err;
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('429') || msg.includes('quota')) {
    throw new AppError(429, 'AI quota limit exceeded. Please wait a moment and try again.', 'AI_RATE_LIMIT');
  }
  throw new AppError(502, 'Could not get a response from the AI service. Please try again.', 'AI_ERROR');
}

const SYSTEM_PROMPT = `You are "Kamil AI", the AI finance assistant of the Kamil Finance platform.

Your responsibilities:
- Answer the user's financial questions in a professional and clear manner
- Perform portfolio analysis, offer diversification and risk assessment
- Interpret news and market events
- Respond fluently in English

Rules:
- Be concise, clear and professional
- When giving specific recommendations, add "This is not financial advice." disclaimer
- Use numerical data, avoid vague statements
- Do NOT use Markdown formatting, write in plain text
- Use a positive and constructive tone`;

// ─── Types ────────────────────────────────────────────────────────────────

export interface ChatContext {
  holdings?: Array<{
    symbol: string;
    market: string;
    quantity: number;
    avgCost: number;
    currentPrice?: number;
    currentValue?: number;
    profitLoss?: number;
  }>;
  news?: Array<{ title: string; source: string }>;
  currentPage?: string;
}

export interface NewsSummaryResult {
  summary: string;
  keyPoints: string[];
  sentiment: string;
  marketImpact: string;
}

// ─── Chat ─────────────────────────────────────────────────────────────────

export async function chat(message: string, context?: ChatContext): Promise<string> {
  let contextBlock = '';

  if (context?.holdings && context.holdings.length > 0) {
    const totalValue = context.holdings.reduce(
      (s, h) => s + (h.currentValue ?? h.quantity * h.avgCost), 0,
    );
    const lines = context.holdings.map(h =>
      `${h.symbol} (${h.market}): ${h.quantity} units, cost $${h.avgCost?.toFixed(2)}, current $${h.currentPrice?.toFixed(2) ?? '?'}, value $${h.currentValue?.toFixed(2) ?? '?'}, P/L $${h.profitLoss?.toFixed(2) ?? '?'}`,
    );
    contextBlock += `\n\n--- USER'S PORTFOLIO (Total: $${totalValue.toFixed(2)}) ---\n${lines.join('\n')}`;
  }

  if (context?.news && context.news.length > 0) {
    const lines = context.news.slice(0, 5).map(n => `• ${n.title} (${n.source})`);
    contextBlock += `\n\n--- RECENT NEWS ---\n${lines.join('\n')}`;
  }

  if (context?.currentPage) {
    contextBlock += `\n\n[User is currently on the "${context.currentPage}" page]`;
  }

  try {
    return await callAI([
      { role: 'system', content: SYSTEM_PROMPT + contextBlock },
      { role: 'user', content: message },
    ]);
  } catch (err) {
    handleAIError(err);
  }
}

// ─── News Summary ─────────────────────────────────────────────────────────

export async function summarizeNews(
  title: string,
  source?: string,
  summary?: string,
): Promise<NewsSummaryResult> {
  const userPrompt = `Analyze the following news article and respond ONLY with valid JSON, nothing else:

Headline: ${title}
${source ? `Source: ${source}` : ''}
${summary ? `Summary: ${summary}` : ''}

JSON format:
{
  "summary": "A detailed 2-3 sentence summary of the news",
  "keyPoints": ["Key point 1", "Key point 2", "Key point 3"],
  "sentiment": "positive or negative or neutral",
  "marketImpact": "Market impact assessment (1-2 sentences)"
}`;

  let text: string;
  try {
    text = await callAI([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ]);
  } catch (err) {
    handleAIError(err);
  }

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch { /* fall through */ }

  return { summary: text, keyPoints: [], sentiment: 'neutral', marketImpact: '' };
}

// ─── Enhanced News Analysis ──────────────────────────────────────────────

export interface NewsAnalysisResult {
  quickLook: string[];
  affectedStocks: string[];
  sentiment: string;
  marketImpact: string;
  summary: string;
  keyPoints: string[];
}

export async function analyzeNewsEnhanced(
  title: string,
  source?: string,
  summary?: string,
  language?: string,
  portfolioSymbols?: string[],
): Promise<NewsAnalysisResult> {
  const langInstruction = 'Respond in English. Stock symbols should be in NYSE/NASDAQ format (AAPL, MSFT, TSLA etc).';

  const portfolioInstruction = portfolioSymbols && portfolioSymbols.length > 0
    ? `\n\nIMPORTANT: This news is related to the user's portfolio holdings [${portfolioSymbols.join(', ')}]. Start your analysis with a personalized introduction and specifically highlight how these assets may be affected.`
    : '';

  const userPrompt = `Analyze the following financial news in detail. ${langInstruction}${portfolioInstruction}

Respond ONLY with valid JSON, nothing else:

Headline: ${title}
${source ? `Source: ${source}` : ''}
${summary ? `Summary: ${summary}` : ''}

JSON format:
{
  "quickLook": ["Brief point 1", "Brief point 2", "Brief point 3"],
  "affectedStocks": ["SYMBOL1", "SYMBOL2"],
  "sentiment": "positive or negative or neutral",
  "marketImpact": "Market impact assessment (1-2 sentences)",
  "summary": "A detailed 2-3 sentence summary of the news",
  "keyPoints": ["Key point 1", "Key point 2"]
}

Rules:
- quickLook must have exactly 3 items, each max 15 words
- affectedStocks at most 5 symbols, only directly affected stocks
- For crypto news use symbols like BTC, ETH
- If no stocks are affected, return an empty array`;

  let text: string;
  try {
    text = await callAI([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ]);
  } catch (err) {
    handleAIError(err);
  }

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch { /* fall through */ }

  return {
    quickLook: [],
    affectedStocks: [],
    sentiment: 'neutral',
    marketImpact: '',
    summary: text,
    keyPoints: [],
  };
}

// ─── Portfolio Analysis ───────────────────────────────────────────────────

export async function analyzePortfolio(
  holdings: ChatContext['holdings'],
): Promise<string> {
  if (!holdings || holdings.length === 0) {
    return 'Your portfolio is empty. You can start by adding assets from the Portfolio page.';
  }

  const totalValue = holdings.reduce((s, h) => s + (h.currentValue ?? h.quantity * h.avgCost), 0);
  const totalCost = holdings.reduce((s, h) => s + h.quantity * h.avgCost, 0);
  const totalPL = totalValue - totalCost;

  const details = holdings.map(h => ({
    symbol: h.symbol,
    market: h.market,
    qty: h.quantity,
    avgCost: h.avgCost,
    price: h.currentPrice,
    value: h.currentValue,
    weight: ((h.currentValue ?? 0) / totalValue * 100).toFixed(1) + '%',
    pl: h.profitLoss,
  }));

  const userPrompt = `Analyze the user's portfolio:

Total Value: $${totalValue.toFixed(2)}
Total Cost: $${totalCost.toFixed(2)}
Total P/L: $${totalPL.toFixed(2)} (${totalCost > 0 ? ((totalPL / totalCost) * 100).toFixed(2) : 0}%)

Holdings:
${JSON.stringify(details, null, 2)}

Evaluate:
1. Diversification status
2. Risk profile
3. Strengths and weaknesses
4. Improvement suggestions

Max 200 words, write in plain text. End with "This is not financial advice."`;

  try {
    return await callAI([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ]);
  } catch (err) {
    handleAIError(err);
  }
}

// ─── Portfolio News Matching ─────────────────────────────────────────────

export async function matchPortfolioNews(
  symbols: string[],
  news: Array<{ id: string; title: string }>,
): Promise<Record<string, string[]>> {
  if (!symbols.length || !news.length) return {};

  const newsBlock = news.map((n, i) => `${i + 1}. [${n.id}] ${n.title}`).join('\n');

  const userPrompt = `Portfolio symbols: [${symbols.join(', ')}]

Which of the following news articles are related to which symbol? Only match directly related ones.

News:
${newsBlock}

Respond ONLY with valid JSON, nothing else.
Format: {"newsId": ["SYMBOL1", "SYMBOL2"]}
Do not include unmatched news. If there are no matches, return an empty object {}.`;

  let text: string;
  try {
    text = await callAI([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ]);
  } catch (err) {
    handleAIError(err);
  }

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch { /* fall through */ }

  return {};
}
