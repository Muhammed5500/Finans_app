import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

let model: GenerativeModel | null = null;

function getModel(): GenerativeModel {
  if (!model) {
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  }
  return model;
}

const SYSTEM_PROMPT = `Sen "Kamil AI" adında, Kamil Finance platformunun yapay zeka finans asistanısın.

Görevlerin:
- Kullanıcının finansal sorularını profesyonel ve anlaşılır şekilde yanıtla
- Portföy analizi yap, çeşitlendirme ve risk değerlendirmesi sun
- Haber ve piyasa olaylarını yorumla
- Hem Türkçe hem İngilizce dillerinde akıcı cevap ver (kullanıcının diline uyum sağla)

Kurallar:
- Kısa, öz ve profesyonel ol
- Somut öneriler verirken "Bu finansal tavsiye niteliği taşımaz" uyarısını ekle
- Sayısal verileri kullan, belirsiz ifadelerden kaçın
- Markdown formatı KULLANMA, düz metin yaz
- Pozitif ve yapıcı bir ton kullan`;

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
  const m = getModel();

  let contextBlock = '';

  if (context?.holdings && context.holdings.length > 0) {
    const totalValue = context.holdings.reduce(
      (s, h) => s + (h.currentValue ?? h.quantity * h.avgCost), 0,
    );
    const lines = context.holdings.map(h =>
      `${h.symbol} (${h.market}): ${h.quantity} adet, maliyet $${h.avgCost?.toFixed(2)}, güncel $${h.currentPrice?.toFixed(2) ?? '?'}, değer $${h.currentValue?.toFixed(2) ?? '?'}, K/Z $${h.profitLoss?.toFixed(2) ?? '?'}`,
    );
    contextBlock += `\n\n--- KULLANICININ PORTFÖYÜ (Toplam: $${totalValue.toFixed(2)}) ---\n${lines.join('\n')}`;
  }

  if (context?.news && context.news.length > 0) {
    const lines = context.news.slice(0, 5).map(n => `• ${n.title} (${n.source})`);
    contextBlock += `\n\n--- SON HABERLER ---\n${lines.join('\n')}`;
  }

  if (context?.currentPage) {
    contextBlock += `\n\n[Kullanıcı şu an "${context.currentPage}" sayfasında]`;
  }

  const prompt = `${SYSTEM_PROMPT}${contextBlock}\n\nKullanıcı: ${message}\n\nKamil AI:`;
  const result = await m.generateContent(prompt);
  return result.response.text();
}

// ─── News Summary ─────────────────────────────────────────────────────────

export async function summarizeNews(
  title: string,
  source?: string,
  summary?: string,
): Promise<NewsSummaryResult> {
  const m = getModel();

  const prompt = `${SYSTEM_PROMPT}

Aşağıdaki haberi analiz et ve yanıtını SADECE geçerli JSON olarak ver, başka hiçbir şey ekleme:

Haber Başlığı: ${title}
${source ? `Kaynak: ${source}` : ''}
${summary ? `Özet: ${summary}` : ''}

JSON formatı:
{
  "summary": "Haberin 2-3 cümlelik detaylı özeti",
  "keyPoints": ["Kritik nokta 1", "Kritik nokta 2", "Kritik nokta 3"],
  "sentiment": "positive veya negative veya neutral",
  "marketImpact": "Piyasa etkisi değerlendirmesi (1-2 cümle)"
}`;

  const result = await m.generateContent(prompt);
  const text = result.response.text();

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch { /* fall through */ }

  return { summary: text, keyPoints: [], sentiment: 'neutral', marketImpact: '' };
}

// ─── Portfolio Analysis ───────────────────────────────────────────────────

export async function analyzePortfolio(
  holdings: ChatContext['holdings'],
): Promise<string> {
  if (!holdings || holdings.length === 0) {
    return 'Portföyünüzde henüz varlık bulunmuyor. Portfolio sayfasından varlık ekleyerek başlayabilirsiniz.';
  }

  const m = getModel();

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

  const prompt = `${SYSTEM_PROMPT}

Kullanıcının portföyünü analiz et:

Toplam Değer: $${totalValue.toFixed(2)}
Toplam Maliyet: $${totalCost.toFixed(2)}
Toplam K/Z: $${totalPL.toFixed(2)} (${totalCost > 0 ? ((totalPL / totalCost) * 100).toFixed(2) : 0}%)

Varlıklar:
${JSON.stringify(details, null, 2)}

Değerlendir:
1. Çeşitlendirme durumu
2. Risk profili
3. Güçlü ve zayıf yönler
4. İyileştirme önerileri

Max 200 kelime, düz metin yaz. Sonuna "Bu bir yatırım tavsiyesi değildir." ekle.`;

  const result = await m.generateContent(prompt);
  return result.response.text();
}
