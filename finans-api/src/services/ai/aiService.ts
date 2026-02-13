import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

let model: GenerativeModel | null = null;

function getModel(): GenerativeModel {
  if (!model) {
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
    const genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
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
  const m = getModel();
  const lang = language === 'tr' ? 'tr' : 'en';

  const langInstruction = lang === 'tr'
    ? 'Yanıtını Türkçe ver. Hisse sembolleri BIST formatında olsun (THYAO, GARAN, ASELS vb).'
    : 'Respond in English. Stock symbols should be in NYSE/NASDAQ format (AAPL, MSFT, TSLA etc).';

  const portfolioInstruction = portfolioSymbols && portfolioSymbols.length > 0
    ? `\n\nÖNEMLİ: Bu haber kullanıcının portföyündeki [${portfolioSymbols.join(', ')}] varlıklarıyla ilgili. Analizine kişiselleştirilmiş bir girişle başla ve bu varlıkların nasıl etkilenebileceğini özellikle belirt.`
    : '';

  const prompt = `${SYSTEM_PROMPT}

Aşağıdaki finans haberini detaylı analiz et. ${langInstruction}${portfolioInstruction}

Yanıtını SADECE geçerli JSON olarak ver, başka hiçbir şey ekleme:

Haber Başlığı: ${title}
${source ? `Kaynak: ${source}` : ''}
${summary ? `Özet: ${summary}` : ''}

JSON formatı:
{
  "quickLook": ["Kısa madde 1", "Kısa madde 2", "Kısa madde 3"],
  "affectedStocks": ["SEMBOL1", "SEMBOL2"],
  "sentiment": "positive veya negative veya neutral",
  "marketImpact": "Piyasa etkisi değerlendirmesi (1-2 cümle)",
  "summary": "Haberin 2-3 cümlelik detaylı özeti",
  "keyPoints": ["Anahtar nokta 1", "Anahtar nokta 2"]
}

Kurallar:
- quickLook tam olarak 3 madde olmalı, her biri max 15 kelime
- affectedStocks en fazla 5 sembol, sadece doğrudan etkilenen hisseler
- Kripto haberleri için BTC, ETH gibi semboller kullan
- Eğer etkilenen hisse yoksa boş dizi ver`;

  const result = await m.generateContent(prompt);
  const text = result.response.text();

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

// ─── Portfolio News Matching ─────────────────────────────────────────────

export async function matchPortfolioNews(
  symbols: string[],
  news: Array<{ id: string; title: string }>,
): Promise<Record<string, string[]>> {
  if (!symbols.length || !news.length) return {};

  const m = getModel();

  const newsBlock = news.map((n, i) => `${i + 1}. [${n.id}] ${n.title}`).join('\n');

  const prompt = `Portföydeki semboller: [${symbols.join(', ')}]

Aşağıdaki haberlerin hangisi hangi sembolle ilgili? Sadece doğrudan ilgili olanları eşleştir.

Haberler:
${newsBlock}

Yanıtını SADECE geçerli JSON olarak ver, başka hiçbir şey ekleme.
Format: {"haberIdsi": ["SEMBOL1", "SEMBOL2"]}
Eşleşmeyen haberleri dahil etme. Hiç eşleşme yoksa boş obje {} döndür.`;

  try {
    const result = await m.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch { /* fall through */ }

  return {};
}
