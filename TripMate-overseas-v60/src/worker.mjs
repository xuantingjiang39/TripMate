import { createRegionalBridge } from './regional-bridge.mjs';
// Cloudflare Worker entrypoint. Secrets stay in runtime bindings.
let runtimeEnv = {};
const PAGE_HTML = "__TRIPMATE_HTML__";
let nextAgnesKey = 0;
const system = `You are TripMate, a considerate Chinese travel-planning assistant.
Create detailed, practical plans for families and older travelers. Never invent bookings, live prices,
opening hours, or reservation availability. State which items must be checked before booking.
For every activity that may require a ticket or reservation, say where the user should buy or reserve it. Prefer the venue's official website, official WeChat account or mini-program, railway 12306, the operating airline, or a mainstream travel platform. Never invent a URL or claim availability.
Return only valid JSON: {"title":"...","summary":"...","days":[{"day":"DAY 1","events":[{"name":"...","note":"..."}]}],"transportLegs":[{"day":"DAY 1","time":"08:30","from":"上海虹桥站","to":"苏州站","mode":"高铁","route":"乘G字头列车直达；从苏州站南广场出站","duration":"约30分钟","cost":80,"costDetail":"2人单程，约40元/人","booking":"铁路12306官网或App"}],"recommendations":{"hotels":[{"destination":"苏州","name":"酒店全名","area":"所在商圈或街道","estimatedCost":600,"costDetail":"每晚约600元，1间房","rating":"4.8/5","positiveRate":96,"reviewCount":1200,"sourceName":"评分来源平台","sourceUrl":"https://...","evidence":"搜索资料中支持该评分的简短事实","reviewReasons":["位置方便","服务细致","房间安静"],"booking":"酒店官网或正规平台"}],"restaurants":[{"destination":"苏州","name":"餐厅全名","area":"具体位置","estimatedCost":240,"costDetail":"2人一餐，人均约120元","rating":"4.8/5","positiveRate":96,"reviewCount":800,"sourceName":"评分来源平台","sourceUrl":"https://...","evidence":"搜索资料中支持该评分的简短事实","reviewReasons":["招牌菜稳定","环境整洁","服务友好"],"booking":"官方电话/公众号或正规平台"}]},"budget":{"transport":{"total":1800,"items":[{"name":"往返高铁","detail":"2人往返，约450元/人","amount":900}]},"lodging":{"total":1500,"items":[{"name":"西湖附近酒店","detail":"2晚，约750元/晚","amount":1500}]},"foodTickets":{"total":1050,"items":[{"name":"每日餐饮","detail":"2人3天","amount":750},{"name":"景点门票","detail":"按行程中的具体景点估算","amount":300}]},"total":4350,"currency":"CNY"},"advice":"..."}.
Use the number of days requested by the user, or 3 days by default. Create 5 timeline events per day, including breakfast or lunch, transportation, sightseeing, rest and dinner when appropriate. This must be an itinerary, not a quiz, article, Q&A, or city introduction. Every sightseeing event must name a specific country or city and a specific attraction, neighborhood, museum, palace, park, restaurant area, station, airport, or transfer route. Never write vague items like "core attraction", "city center", "local market", "next city", or "nearby scenic area" without a concrete name. For multi-country trips, distribute days across named countries and cities and show the cross-border transport between them. Keep the pace relaxed by including rest time rather than removing useful detail. Start every event name with a suggested time. Each note must be 1-2 concise Chinese sentences. Create one transportLegs entry for every movement from arrival through the end of each day, including transfers between consecutive itinerary places and the return to the hotel or departure station. Never skip a segment. Each leg must give exact named start and end points, the concrete vehicle (walking, taxi, bus number, metro line, train number/type or flight), station/stop names and transfer instructions in route, realistic duration, numeric subtotal cost, the price basis in costDetail, and the official booking/payment channel in booking. If walking, cost is 0 and route must still describe the street or exit when useful. Do not invent an exact train/flight number if schedules are unknown; state the service type and tell the user to choose a suitable current service in the official channel. Use only the supplied WEB RESEARCH EVIDENCE for hotel and restaurant popularity claims. For every destination city, recommend at least one hotel and two characteristic restaurants when qualified evidence exists. A recommendation qualifies only when an evidence source states at least 95% positive reviews or an equivalent score of at least 4.75/5; never invent or upgrade a rating, review count, URL, price or review fact. Give the source URL and synthesize 3 concise recurring praise reasons supported by the evidence. If no qualified evidence exists for a destination, return no invented recommendation for it and explain that limitation in advice. Prices are estimates and must say so. The budget must be an Agnes estimate for the whole trip and must change with destination, duration, party size and the user's stated budget. Every budget category must contain detailed items naming exactly what the money is spent on. Each item's detail must state the price basis such as people, nights, meals, rides or tickets, and amount must be its subtotal. The transport budget items must reconcile with all transportLegs costs. Hotel and restaurant budget items must reconcile with the selected recommendations. Use numbers only; each category total must equal its item amounts and the overall total must equal all category totals. Use CNY unless the user explicitly requests another currency. If a maximum budget is stated, keep the estimate within it or clearly explain in summary that it is infeasible. The summary should be 1-2 sentences and the advice should give 5 concrete preparation reminders.`;

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

function agnesKeys() {
  return [...new Set([
    ...String(runtimeEnv.AGNES_API_KEYS || '').split(/[,;\r\n]+/),
    String(runtimeEnv.AGNES_API_KEY || '')
  ].map(value => value.trim()).filter(Boolean))];
}

function agnesRaceWidth() {
  const requested = Number(runtimeEnv.AGNES_RACE_WIDTH || 8);
  const safeRequested = Number.isFinite(requested) ? Math.max(1, Math.min(12, Math.floor(requested))) : 8;
  return Math.max(1, Math.min(agnesKeys().length, safeRequested));
}

function reserveDistinctAgnesKeys(maxAttempts = 1) {
  const keys = agnesKeys();
  if (!keys.length) return [];
  const requested = Number.isFinite(Number(maxAttempts)) ? Math.floor(Number(maxAttempts)) : 1;
  const count = Math.max(1, Math.min(requested, keys.length, agnesRaceWidth()));
  const start = nextAgnesKey % keys.length;
  nextAgnesKey = (nextAgnesKey + count) % keys.length;
  return Array.from({ length: count }, (_, index) => keys[(start + index) % keys.length]);
}

function agnesKeysForRole(keySlot, maxAttempts = 1) {
  const keys = agnesKeys();
  if (!keys.length) return [];
  const requested = Number.isFinite(Number(maxAttempts)) ? Math.floor(Number(maxAttempts)) : 1;
  const count = Math.max(1, Math.min(requested, keys.length));
  const start = Math.max(0, Number(keySlot) || 0) % keys.length;
  return Array.from({ length: count }, (_, index) => keys[(start + index) % keys.length]);
}

let activeAgnesCalls = 0;
const waitingAgnesCalls = [];
let nextAgnesStartAt = 0;

function agnesMaxConcurrency() {
  const requested = Number(runtimeEnv.AGNES_MAX_CONCURRENCY || 2);
  const safeRequested = Number.isFinite(requested) ? Math.max(1, Math.min(8, Math.floor(requested))) : 2;
  return Math.max(1, Math.min(agnesKeys().length || 1, safeRequested));
}

function agnesMinIntervalMs() {
  const requested = Number(runtimeEnv.AGNES_MIN_INTERVAL_MS || 1800);
  return Number.isFinite(requested) ? Math.max(500, Math.min(10000, Math.floor(requested))) : 1800;
}

async function waitForAgnesPacing() {
  const now = Date.now();
  const startAt = Math.max(now, nextAgnesStartAt);
  nextAgnesStartAt = startAt + agnesMinIntervalMs();
  const delay = startAt - now;
  if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
}

async function withAgnesSlot(task) {
  if (activeAgnesCalls >= agnesMaxConcurrency()) {
    await new Promise(resolve => waitingAgnesCalls.push(resolve));
  } else {
    activeAgnesCalls += 1;
  }
  try {
    await waitForAgnesPacing();
    return await task();
  } finally {
    const next = waitingAgnesCalls.shift();
    if (next) next();
    else activeAgnesCalls = Math.max(0, activeAgnesCalls - 1);
  }
}

async function callAgnes(payload, { timeoutMs = 75000, apiKey } = {}) {
  if (!apiKey) throw new Error('服务器未配置 AGNES_API_KEY');
  return fetch("https://apihub.agnes-ai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs)
  });
}

function decodeXml(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
}

async function searchWeb(query) {
  try {
    const braveUrl = `https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`;
    const braveResponse = await fetch(braveUrl, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36', 'accept-language': 'zh-CN,zh;q=0.9' }, signal: AbortSignal.timeout(15000) });
    if (braveResponse.ok) {
      const braveHtml = await braveResponse.text();
      const links = [...new Set([...braveHtml.matchAll(/https:\/\/(?:hotels|you)\.ctrip\.com\/[^"'<>\\\s]+/gi)].map(match => decodeXml(match[0])))].slice(0, 8);
      const ctripResults = links.map(link => {
        const index = braveHtml.indexOf(link);
        const context = decodeXml(braveHtml.slice(Math.max(0, index - 500), Math.min(braveHtml.length, index + 1800))).slice(0, 1200);
        return { title: context.slice(0, 160) || '携程搜索结果', url: link, snippet: context };
      }).filter(item => /ctrip\.com/i.test(item.url));
      if (ctripResults.length) return ctripResults;
    }
  } catch {}
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=zh-cn&mkt=zh-CN`;
  const response = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 TripMate/1.0' }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`搜索服务 HTTP ${response.status}`);
  const html = await response.text();
  return [...html.matchAll(/<li class="b_algo"[\s\S]*?<\/li>/gi)].slice(0, 8).map(match => {
    const item = match[0];
    const heading = item.match(/<h2[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/i);
    const snippet = item.match(/<div class="b_caption"[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
    return { title: decodeXml(heading?.[2]), url: decodeXml(heading?.[1]), snippet: decodeXml(snippet?.[1]) };
  }).filter(item => item.title && /^https?:\/\//i.test(item.url));
}

async function collectWebResearch(requestText) {
  let suggestedQueries = [];
  try {
    const queryData = await generateJsonPart(
      '从旅行需求中提取目的地城市，并提出待核验的具体酒店和特色餐厅名称。只返回JSON：{"queries":["城市 具体酒店名 酒店","城市 具体餐厅名 餐厅"]}。每个城市最多2家酒店、4家餐厅，所有检索词必须为简体中文。候选名称不是评分证据，稍后会到携程核验。',
      requestText,
      700,
      { timeoutMs: 60000, attempts: 1 }
    );
    suggestedQueries = Array.isArray(queryData?.queries) ? queryData.queries : [];
  } catch {}
  const ctripQueries = suggestedQueries.map(String).map(value => value.trim()).filter(Boolean).map(query => {
    const restaurant = /餐厅|饭店|酒楼|美食|菜馆|小吃/.test(query);
    return `${restaurant ? 'site:you.ctrip.com/food' : 'site:hotels.ctrip.com/hotel'} ${query} 携程 评分 点评数 价格`;
  });
  const fallbackQueries = [
    `site:hotels.ctrip.com/hotel ${requestText} 携程酒店 4.8 评分 点评数`,
    `site:you.ctrip.com/food ${requestText} 携程美食 4.8 评分 人均 点评数`
  ];
  const queries = [...new Set([...ctripQueries, ...fallbackQueries])].slice(0, 4);
  const groups = [];
  for (let index = 0; index < queries.length; index += 2) {
    const batch = await Promise.all(queries.slice(index, index + 2).map(async query => {
      try { return { query, source: '携程', results: await searchWeb(query) }; }
      catch { return { query, source: '携程', results: [] }; }
    }));
    groups.push(...batch);
  }
  const useful = groups.map(group => ({ ...group, results: group.results.filter(result => /^https:\/\/(?:hotels|you)\.ctrip\.com\//i.test(result.url)) })).filter(group => group.results.length);
  if (!useful.length) return JSON.stringify({ searchedAt: new Date().toISOString(), groups: [], notice: '携程公开搜索没有返回可核验的酒店或餐厅评分资料，请在携程App中复核。' });
  const research = JSON.stringify({ searchedAt: new Date().toISOString(), groups: useful }).slice(0, 30000);
  return research;
}

function findJsonObject(text) {
  const start = text.indexOf('{');
  if (start < 0) return '';
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) return text.slice(start, index + 1);
  }
  return '';
}

function cleanAgnesJsonText(text) {
  return String(text || '')
    .replace(/^\uFEFF/, '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim();
}

function repairJsonSyntax(text) {
  const source = cleanAgnesJsonText(text);
  const object = findJsonObject(source);
  const candidate = object || source.slice(source.indexOf('{'), source.lastIndexOf('}') + 1);
  if (!candidate || !candidate.startsWith('{') || !candidate.endsWith('}')) return '';
  return candidate.replace(/,\s*([}\]])/g, '$1');
}

function repairCommonJsonShape(text) {
  const source = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  if (!source.includes('"days"') || !source.includes('"advice"')) return '';
  let repaired = source.replace(/,\s*\{\s*"advice"\s*:/, '],"advice":');
  const opens = (repaired.match(/\[/g) || []).length;
  const closes = (repaired.match(/\]/g) || []).length;
  if (opens > closes) repaired += ']'.repeat(opens - closes);
  const braceOpens = (repaired.match(/\{/g) || []).length;
  const braceCloses = (repaired.match(/\}/g) || []).length;
  if (braceOpens > braceCloses) repaired += '}'.repeat(braceOpens - braceCloses);
  return repaired;
}

function expectedDayCount(requestText) {
  const text = String(requestText || '');
  const digit = text.match(/(\d+)\s*[天日]/);
  if (digit) return Math.max(1, Math.min(30, Number(digit[1])));
  const cn = { 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  const chinese = text.match(/([一两二三四五六七八九十])\s*[天日]/);
  return chinese ? cn[chinese[1]] : 3;
}

function tokenBudgetFor(requestText) {
  const days = expectedDayCount(requestText);
  if (days <= 3) return 5000;
  if (days <= 7) return 5200;
  if (days <= 12) return 9000;
  return 12000;
}

function nonNegativeNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? Math.round(value) : NaN;
  const text = String(value ?? '').replace(/,/g, '').trim();
  const range = text.match(/(\d+(?:\.\d+)?)\s*(?:-|~|～|至|到)\s*(\d+(?:\.\d+)?)/);
  if (range) return Math.round((Number(range[1]) + Number(range[2])) / 2);
  const match = text.match(/\d+(?:\.\d+)?/);
  const amount = match ? Number(match[0]) : NaN;
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount) : NaN;
}

function normalizedDayLabel(value, index = 0) {
  const label = String(value || '').trim();
  const digit = label.match(/(?:DAY\s*|第\s*)?(\d+)(?:\s*天)?/i);
  if (digit) return `第 ${Number(digit[1])} 天`;
  const chinese = label.match(/第?\s*([一两二三四五六七八九十])\s*天/);
  const values = { 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  return chinese ? `第 ${values[chinese[1]]} 天` : `第 ${index + 1} 天`;
}

function normalizeGeneratedLeg(leg, index = 0) {
  const cost = nonNegativeNumber(leg?.cost ?? leg?.amount ?? leg?.price ?? leg?.fare);
  return {
    day: normalizedDayLabel(leg?.day || leg?.date, Math.floor(index / 3)),
    time: String(leg?.time || leg?.departureTime || '').trim(),
    from: String(leg?.from || leg?.start || leg?.origin || '').trim(),
    to: String(leg?.to || leg?.end || leg?.destination || '').trim(),
    mode: String(leg?.mode || leg?.vehicle || leg?.transport || '').trim(),
    route: String(leg?.route || leg?.directions || leg?.transfer || '').trim(),
    duration: String(leg?.duration || leg?.timeNeeded || '').trim(),
    cost,
    costDetail: String(leg?.costDetail || leg?.cost_detail || leg?.priceDetail || leg?.priceBasis || '').trim(),
    booking: String(leg?.booking || leg?.payment || leg?.channel || '').trim()
  };
}

function parsePlan(text, requestText = '') {
  const trimmed = String(text || '').trim();
  const candidates = [
    trimmed,
    trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, ''),
    repairCommonJsonShape(trimmed),
    findJsonObject(trimmed)
  ];
  let parsed;
  for (const candidate of candidates) {
    if (!candidate) continue;
    try { parsed = JSON.parse(candidate); break; } catch {}
  }
  if (!parsed || !Array.isArray(parsed.days)) throw new Error('Invalid plan JSON');
  const chineseDay = (value, index) => {
    const label = String(value || '').trim();
    const match = label.match(/^DAY\s*(\d+)$/i);
    return match ? `第 ${match[1]} 天` : label || `第 ${index + 1} 天`;
  };
  const days = parsed.days.map((day, index) => ({
    day: chineseDay(day?.day || day?.date || day?.title, index),
    events: (Array.isArray(day?.events) ? day.events
      : Array.isArray(day?.activities) ? day.activities
      : Array.isArray(day?.schedule) ? day.schedule
      : Array.isArray(day?.items) ? day.items
      : [])
      .map(event => typeof event === 'string'
        ? { name: event, note: '' }
        : {
          name: String(event?.name || event?.title || event?.time || event?.activity || '行程安排'),
          note: String(event?.note || event?.description || event?.details || event?.tips || '')
        })
      .filter(event => event.name)
  })).filter(day => day.events.length);
  if (!days.length) throw new Error('Plan contains no events');
  const requiredDays = expectedDayCount(requestText);
  const wrongDayCount = days.length !== requiredDays;
  const tooSparse = days.some(day => day.events.length < 3);
  const looksLikeQuiz = [parsed.title, parsed.summary, parsed.advice, text].some(value => /问答|测验|quiz|Q&A/i.test(String(value || '')));
  const rawBudget = parsed.budget || parsed.cost || parsed.costs || {};
  const numberValue = nonNegativeNumber;
  const rawLegs = parsed.transportLegs || parsed.transport_legs || parsed.routes || parsed.transfers || [];
  const transportLegs = (Array.isArray(rawLegs) ? rawLegs : []).map((leg, index) => ({
    day: chineseDay(leg?.day, Math.floor(index / 4)),
    time: String(leg?.time || ''),
    from: String(leg?.from || leg?.start || leg?.origin || '').trim(),
    to: String(leg?.to || leg?.end || leg?.destination || '').trim(),
    mode: String(leg?.mode || leg?.vehicle || leg?.transport || '').trim(),
    route: String(leg?.route || leg?.directions || leg?.transfer || '').trim(),
    duration: String(leg?.duration || leg?.timeNeeded || '').trim(),
    cost: numberValue(leg?.cost ?? leg?.amount ?? leg?.price),
    costDetail: String(leg?.costDetail || leg?.cost_detail || leg?.priceDetail || '').trim(),
    booking: String(leg?.booking || leg?.payment || leg?.channel || '').trim()
  })).filter(leg => leg.from && leg.to && leg.mode && leg.route && leg.duration && Number.isFinite(leg.cost) && leg.costDetail && leg.booking);
  const rawRecommendations = parsed.recommendations || parsed.staysAndDining || {};
  const normalizeRecommendation = (item, type) => ({
    type,
    destination: String(item?.destination || item?.city || '').trim(),
    name: String(item?.name || item?.title || '').trim(),
    area: String(item?.area || item?.location || '').trim(),
    estimatedCost: numberValue(item?.estimatedCost ?? item?.cost ?? item?.price),
    costDetail: String(item?.costDetail || item?.priceDetail || item?.priceBasis || '').trim(),
    rating: String(item?.rating || '').trim(),
    positiveRate: numberValue(item?.positiveRate ?? item?.positive_rate),
    reviewCount: numberValue(item?.reviewCount ?? item?.review_count),
    sourceName: String(item?.sourceName || item?.source || '').trim(),
    sourceUrl: String(item?.sourceUrl || item?.url || '').trim(),
    evidence: String(item?.evidence || item?.ratingEvidence || '').trim(),
    reviewReasons: (Array.isArray(item?.reviewReasons) ? item.reviewReasons : Array.isArray(item?.reasons) ? item.reasons : []).map(String).map(value => value.trim()).filter(Boolean).slice(0, 5),
    booking: String(item?.booking || item?.bookingChannel || '').trim()
  });
  const validRecommendation = item => item.destination && item.name && item.area && Number.isFinite(item.estimatedCost) && item.costDetail && item.rating && item.positiveRate >= 95 && Number.isFinite(item.reviewCount) && item.sourceName && /^https?:\/\//i.test(item.sourceUrl) && item.evidence && item.reviewReasons.length >= 2 && item.booking;
  const hotels = (Array.isArray(rawRecommendations.hotels) ? rawRecommendations.hotels : []).map(item => normalizeRecommendation(item, 'hotel')).filter(validRecommendation);
  const restaurants = (Array.isArray(rawRecommendations.restaurants) ? rawRecommendations.restaurants : []).map(item => normalizeRecommendation(item, 'restaurant')).filter(validRecommendation);
  const normalizeCategory = value => {
    if (!value || typeof value !== 'object' || !Array.isArray(value.items)) return null;
    const items = value.items.map(item => ({
      name: String(item?.name || item?.title || '').trim(),
      detail: String(item?.detail || item?.description || item?.basis || '').trim(),
      amount: numberValue(item?.amount ?? item?.subtotal ?? item?.cost)
    })).filter(item => item.name && item.detail && Number.isFinite(item.amount));
    if (!items.length && numberValue(value.total) !== 0) return null;
    return { total: items.reduce((sum, item) => sum + item.amount, 0), items };
  };
  const transport = normalizeCategory(rawBudget.transport ?? rawBudget.transportation ?? rawBudget.traffic);
  const lodging = normalizeCategory(rawBudget.lodging ?? rawBudget.hotel ?? rawBudget.accommodation);
  const foodTickets = normalizeCategory(rawBudget.foodTickets ?? rawBudget.food_and_tickets ?? rawBudget.foodAndTickets ?? rawBudget.mealsAndTickets);
  const calculatedTotal = transport && lodging && foodTickets ? transport.total + lodging.total + foodTickets.total : NaN;
  const tooFewLegs = transportLegs.length < Math.max(1, days.length * 3);
  const legCostTotal = transportLegs.reduce((sum, leg) => sum + leg.cost, 0);
  const transportDoesNotReconcile = transport && Math.abs(transport.total - legCostTotal) > 1;
  if (wrongDayCount || tooSparse || tooFewLegs || transportDoesNotReconcile || looksLikeQuiz || !Number.isFinite(calculatedTotal)) throw new Error('Plan is incomplete or not an itinerary');
  return {
    title: String(parsed.title || 'AI 定制行程'),
    summary: String(parsed.summary || ''),
    days,
    transportLegs,
    recommendations: { hotels, restaurants },
    budget: {
      transport,
      lodging,
      foodTickets,
      total: calculatedTotal,
      currency: String(rawBudget.currency || 'CNY').toUpperCase()
    },
    advice: String(parsed.advice || parsed.tips || parsed.days.find(day => day?.advice)?.advice || '')
  };
}

async function saveBadResponse(label, text) {
  console.error(label, String(text || '').slice(0, 1000));
}

function agnesContentText(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(agnesContentText).filter(Boolean).join('');
  if (!value || typeof value !== 'object') return '';
  for (const key of ['text', 'content', 'value', 'output_text']) {
    const text = agnesContentText(value[key]);
    if (text) return text;
  }
  if (['title', 'days', 'transportLegs', 'lodgingBudget', 'foodTicketsBudget', 'queries', 'hotels', 'restaurants', 'approved'].some(key => key in value)) {
    try { return JSON.stringify(value); } catch {}
  }
  return '';
}

function parseAgnesEventStream(rawResponse) {
  let content = '';
  let finishReason = '';
  let errorMessage = '';
  let eventCount = 0;
  for (const line of String(rawResponse || '').split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;
    let event;
    try { event = JSON.parse(payload); } catch { continue; }
    eventCount += 1;
    errorMessage ||= String(event?.error?.message || '');
    const choice = event?.choices?.[0];
    content += agnesContentText(choice?.delta?.content)
      || agnesContentText(choice?.message?.content)
      || agnesContentText(choice?.text)
      || agnesContentText(event?.output_text);
    finishReason ||= String(choice?.finish_reason || '');
  }
  return { content, finishReason, errorMessage, eventCount };
}

async function readAgnesResponse(api) {
  const rawResponse = await api.text();
  let data;
  try { data = JSON.parse(rawResponse); }
  catch {
    const streamed = parseAgnesEventStream(rawResponse);
    if (streamed.errorMessage) {
      const error = new Error(streamed.errorMessage);
      error.status = api.status;
      throw error;
    }
    if (!api.ok) {
      const error = new Error(`Agnes HTTP ${api.status}`);
      error.status = api.status;
      throw error;
    }
    if (!streamed.content) throw new Error(`Unreadable Agnes response (${streamed.eventCount} stream events)`);
    if (streamed.finishReason === 'length') throw new Error('Agnes response was truncated');
    return streamed.content;
  }
  if (!api.ok || data?.error) {
    const error = new Error(data?.error?.message || data?.message || `Agnes HTTP ${api.status}`);
    error.status = api.status;
    throw error;
  }
  const choice = data?.choices?.[0] || data?.data?.choices?.[0];
  const candidates = [
    choice?.message?.content,
    choice?.message?.parsed,
    choice?.message?.reasoning_content,
    choice?.text,
    data?.output_text,
    data?.response,
    data?.result?.content,
    data?.data?.output_text
  ];
  const content = candidates.map(agnesContentText).find(Boolean) || '';
  if (!content) {
    const shape = {
      topLevel: Object.keys(data || {}).slice(0, 12),
      choice: Object.keys(choice || {}).slice(0, 12),
      message: Object.keys(choice?.message || {}).slice(0, 12),
      finishReason: choice?.finish_reason || null
    };
    console.error('Agnes returned no readable content', JSON.stringify(shape));
    throw new Error('Agnes returned empty content');
  }
  if (choice?.finish_reason === 'length') throw new Error('Agnes response was truncated');
  return content;
}

function parseJsonText(text) {
  const source = cleanAgnesJsonText(text);
  for (const candidate of [source, repairJsonSyntax(source), repairCommonJsonShape(source), findJsonObject(source)]) {
    if (!candidate) continue;
    try { return JSON.parse(candidate); } catch {}
  }
  throw new Error('Agnes 分段结果格式异常');
}

function isRetryableAgnesError(error) {
  const status = Number(error?.status || 0);
  const message = String(error?.message || error || '');
  if (status === 429 || /rate limit|free users|too many requests/i.test(message)) return true;
  if ([401, 403, 408].includes(status) || status >= 500) return true;
  return error?.name === 'TimeoutError'
    || error?.name === 'AbortError'
    || /Agnes 分段结果格式异常|纯文本行程仍不完整|Unreadable Agnes response|empty content|truncated|fetch failed|ECONNRESET|EAI_AGAIN|socket|network/i.test(message);
}

function readableAgnesError(error) {
  const raw = String(error?.message || error || '网络连接中断');
  if (error?.name === 'TimeoutError' || /timed?\s*out|timeout|aborted due to timeout/i.test(raw)) return raw.replace(/The operation was aborted due to timeout\.?|request timed? out|timeout/gi, '请求超时');
  if (/All promises were rejected/i.test(raw)) return '所有备用密钥均未返回有效结果';
  if (/Unreadable Agnes response|Agnes 分段结果格式异常|纯文本行程仍不完整|empty content|truncated/i.test(raw)) return 'Agnes 返回格式不完整';
  if (/fetch failed|ECONNRESET|EAI_AGAIN|socket|network/i.test(raw)) return '暂时无法连接 Agnes';
  return raw;
}

async function generateJsonPart(instruction, content, maxTokens, callOptions = {}) {
  const payload = {
    model: 'agnes-3.0-flash',
    messages: [{ role: 'system', content: instruction }, { role: 'user', content }],
    temperature: 0.2,
    max_tokens: maxTokens,
    stream: false,
    response_format: { type: 'json_object' },
    chat_template_kwargs: { enable_thinking: false }
  };
  const { timeoutMs = 75000, attempts = 1, onRetry, stage = 'Agnes 分段任务', keySlot } = callOptions;
  const keys = Number.isFinite(Number(keySlot)) ? agnesKeysForRole(keySlot, attempts) : reserveDistinctAgnesKeys(attempts);
  if (!keys.length) throw new Error('服务器未配置 AGNES_API_KEY');
  let lastError;
  for (let index = 0; index < keys.length; index += 1) {
    try {
      return await withAgnesSlot(async () => {
        const requestAndParse = async requestPayload => {
          const api = await callAgnes(requestPayload, { timeoutMs, apiKey: keys[index] });
          return parseJsonText(await readAgnesResponse(api));
        };
        try {
          return await requestAndParse(payload);
        } catch (error) {
          const responseFormatUnsupported = [400, 422].includes(Number(error?.status || 0))
            && /response[_ -]?format|json[_ -]?object|unsupported/i.test(String(error?.message || ''));
          if (!responseFormatUnsupported) throw error;
          const { response_format, ...compatiblePayload } = payload;
          return requestAndParse(compatiblePayload);
        }
      });
    } catch (error) {
      lastError = error;
      const hasNext = index + 1 < keys.length;
      if (!hasNext || !isRetryableAgnesError(error)) {
        console.error('Agnes part failed', stage, readableAgnesError(error));
        throw error;
      }
      try {
        onRetry?.({ attempt: index + 2, maxAttempts: keys.length, error });
      } catch {}
      const rateLimited = Number(error?.status || 0) === 429 || /rate limit|free users|too many requests/i.test(String(error?.message || error || ''));
      const delayMs = rateLimited ? Math.min(30000, 4000 * (2 ** index)) : 900;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw lastError || new Error('Agnes 请求失败');
}

async function requireAllParts(entries) {
  const settled = await Promise.allSettled(entries.map(entry => entry.promise));
  const failures = settled.flatMap((result, index) => result.status === 'rejected'
    ? [`${entries[index].label}：${readableAgnesError(result.reason)}`]
    : []);
  if (failures.length) throw new Error(failures.join('；'));
  return settled.map(result => result.value);
}

function fallbackTransportForDay(day, index) {
  const events = Array.isArray(day?.events) ? day.events : [];
  const placeName = event => String(event?.name || '下一处行程').replace(/^\s*\d{1,2}[:：]\d{2}\s*[·・-]?\s*/, '').trim() || '下一处行程';
  const points = ['住宿地或当天抵达站', ...events.map(placeName), '住宿地或当天离开站'];
  const legs = [];
  for (let i = 0; i < points.length - 1 && legs.length < Math.max(3, events.length); i += 1) {
    if (points[i] === points[i + 1]) continue;
    legs.push({
      day: String(day?.day || `第 ${index + 1} 天`),
      time: String(events[Math.min(i, Math.max(0, events.length - 1))]?.name || '').match(/\d{1,2}[:：]\d{2}/)?.[0] || '',
      from: points[i],
      to: points[i + 1],
      mode: '公共交通或出租车',
      route: 'Agnes 未完整返回本段线路；请在出发前使用当地官方交通地图按实时路况查询。',
      duration: '以出发前实时查询为准',
      cost: 0,
      costDetail: '待确认（未计入已知费用小计）',
      booking: '当地官方交通 App、现场正规售票渠道或出租车平台'
    });
  }
  while (legs.length < 3) {
    legs.push({
      day: String(day?.day || `第 ${index + 1} 天`),
      time: '',
      from: legs.length ? '上一处活动地点' : '住宿地或当天抵达站',
      to: `第 ${legs.length + 1} 处活动地点`,
      mode: '公共交通或步行',
      route: '请按当天实际地点使用官方地图规划可达路线。',
      duration: '以实时查询为准',
      cost: 0,
      costDetail: '待确认（未计入已知费用小计）',
      booking: '当地官方交通渠道'
    });
  }
  return { transportLegs: legs };
}

const emptyBudgetPart = (key, label) => ({
  [key]: {
    total: 0,
    items: [{ name: `${label}待核实`, detail: 'Agnes 本次未完整返回该项价格，暂不计入总额，请重新生成或在预订前核实', amount: 0 }]
  }
});

function parsePlainCore(text, requiredDays) {
  const core = { title: '', summary: '', advice: '', days: [] };
  let currentDay;
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim().replace(/^[-*#]+\s*/, '');
    if (!line) continue;
    const title = line.match(/^标题\s*[|｜:：]\s*(.+)$/);
    const summary = line.match(/^摘要\s*[|｜:：]\s*(.+)$/);
    const advice = line.match(/^建议\s*[|｜:：]\s*(.+)$/);
    if (title) { core.title = title[1].trim(); continue; }
    if (summary) { core.summary = summary[1].trim(); continue; }
    if (advice) { core.advice = advice[1].trim(); continue; }
    const day = line.match(/^(?:第\s*)?(\d+)\s*天(?:\s*[|｜:：].*)?$/i) || line.match(/^DAY\s*(\d+)$/i);
    if (day) {
      currentDay = { day: `第 ${Number(day[1])} 天`, events: [] };
      core.days.push(currentDay);
      continue;
    }
    const event = line.match(/^(\d{1,2}[:：]\d{2})\s*[|｜]\s*([^|｜]+)\s*[|｜]\s*(.+)$/);
    if (event && currentDay) currentDay.events.push({ name: `${event[1].replace('：', ':')} ${event[2].trim()}`, note: event[3].trim() });
  }
  core.days = core.days.slice(0, requiredDays);
  if (core.days.length !== requiredDays || core.days.some(day => day.events.length < 3)) throw new Error('Agnes 纯文本行程仍不完整');
  core.title ||= 'AI 定制行程';
  core.summary ||= '已根据你的需求生成每日行程，实时价格与开放信息请在预订前核实。';
  core.advice ||= '出发前再次核实交通、住宿、门票、天气和开放通知。';
  return core;
}

async function generatePlainCore(requestText, requiredDays, onRetry) {
  const instruction = `你是 TripMate 行程规划师。不要返回JSON，不要使用Markdown代码块。严格按以下逐行格式输出：\n标题|简短标题\n摘要|1句摘要\n建议|5条准备提醒写成1段\n第1天\n08:30|具体地点或活动|1-2句具体说明\n12:00|具体地点或活动|1-2句具体说明\n……\n必须正好 ${requiredDays} 天，每天5-7个事件。地点和景点必须具体，所有文字使用简体中文。竖线必须保留。`;
  const payload = {
    model: 'agnes-3.0-flash',
    messages: [{ role: 'system', content: instruction }, { role: 'user', content: requestText }],
    temperature: 0.2,
    max_tokens: Math.max(2200, requiredDays * 750),
    stream: false,
    chat_template_kwargs: { enable_thinking: false }
  };
  const keys = reserveDistinctAgnesKeys(2);
  let lastError;
  for (let index = 0; index < keys.length; index += 1) {
    try {
      const text = await withAgnesSlot(async () => readAgnesResponse(await callAgnes(payload, { timeoutMs: 75000, apiKey: keys[index] })));
      return parsePlainCore(text, requiredDays);
    } catch (error) {
      lastError = error;
      if (index + 1 >= keys.length || !isRetryableAgnesError(error)) throw error;
      try { onRetry?.({ attempt: index + 2, maxAttempts: keys.length, error }); } catch {}
    }
  }
  throw lastError || new Error('Agnes 主体行程生成失败');
}

async function generatePlanInParts(requestText, maxTokens, { includeRecommendations = false, onCore, onProgress } = {}) {
  const requiredDays = expectedDayCount(requestText);
  const constrainedRequest = `用户原始需求：${requestText}\n强制要求：必须只生成 ${requiredDays} 天，days 数组必须正好有 ${requiredDays} 项，不得自行改成其他天数。`;
  const coreInstruction = `You are the itinerary section of TripMate. Return valid JSON only: {"title":"...","summary":"...","days":[{"day":"第 1 天","events":[{"name":"08:30 具体地点或活动","note":"1-2句具体说明"}]}],"advice":"..."}. Use exactly the requested number of days, or 3 by default. Create 5-7 useful timeline events per day. Name the actual country, city, attraction, museum, neighborhood and restaurant area; never use vague placeholders. Include meals, rest and realistic pacing for families or older travelers. Mention official ticket/reservation channels where relevant. Do not include transportLegs, recommendations or budget. Every user-visible string value must be natural Simplified Chinese. Do not use English headings, English explanations, DAY labels or untranslated transport terms; official brand names and unavoidable route codes may retain their proper spelling.`;
  const coreTokens = Math.min(Math.max(1500, 900 + requiredDays * 650), Math.max(2600, Math.ceil(maxTokens * 0.55)));
  const transportTokens = Math.min(Math.max(1400, 900 + requiredDays * 650), Math.max(2400, Math.ceil(maxTokens * 0.5)));
  const budgetTokens = Math.min(Math.max(900, 650 + requiredDays * 250), Math.max(1500, Math.ceil(maxTokens * 0.3)));
  const retryNotice = stage => ({ attempt, maxAttempts, error }) => {
    try {
      onProgress?.({
        stage,
        status: 'retrying',
        attempt,
        maxAttempts,
        message: `${stage}第一次未完成（${readableAgnesError(error)}），正在切换另一把密钥重试（${attempt}/${maxAttempts}）…`
      });
    } catch {}
  };
  // A failed or malformed coordinator response is retried once on a distinct key.
  const corePromise = generateJsonPart(coreInstruction, constrainedRequest, coreTokens, {
    timeoutMs: 75000,
    attempts: 2,
    keySlot: 0,
    stage: '主体行程',
    onRetry: retryNotice('主体行程')
  });
  const researchPromise = includeRecommendations
    ? collectWebResearch(requestText)
    : Promise.resolve(JSON.stringify({ groups: [], notice: '极速模式未进行酒店和餐厅联网核验。' }));
  // Core is the only dependency of transport and budget. Do not hold those tasks
  // behind web research: research continues independently on another key.
  let core;
  try {
    core = await corePromise;
  } catch (error) {
    onProgress?.({ stage: '主体行程', status: 'repairing', message: 'Agnes 的结构化结果不可读取，正在切换到兼容格式重新生成…' });
    core = await generatePlainCore(constrainedRequest, requiredDays, retryNotice('主体行程兼容模式'));
  }
  if (!Array.isArray(core?.days) || !core.days.length) throw new Error('Agnes 每日行程部分不完整');
  if (core.days.length > requiredDays) core.days = core.days.slice(0, requiredDays);
  if (onCore) await onCore({
    title: core.title,
    summary: core.summary,
    days: core.days,
    advice: core.advice
  });
  const itineraryContext = JSON.stringify({ request: requestText, title: core.title, summary: core.summary, days: core.days });

  const transportInstruction = `你是 TripMate 的单日交通专员。严格根据所给当天行程，只返回有效JSON：{"transportLegs":[{"day":"第 1 天","time":"08:30","from":"具体起点","to":"具体终点","mode":"具体交通工具或步行","route":"线路、车站、出口与换乘说明","duration":"预计时间","cost":80,"costDetail":"人数、次数和单价","booking":"官方购票或支付渠道"}]}。至少列出3段，覆盖当天首次抵达、相邻地点间移动以及最后返回酒店或离开；不得遗漏行程中相邻地点。未知实时班次时只写交通服务类型，不编造车次航班号。步行费用为0。所有可见文字使用简体中文。`;
  const lodgingInstruction = `你是 TripMate 的住宿预算专员。根据用户需求和完整每日行程，只返回有效JSON：{"lodgingBudget":{"total":600,"items":[{"name":"住宿区域或具体酒店类型","detail":"1人1间1晚，估算每晚600元；不是实时房价","amount":600}]}}。逐项写清人数、房间数、晚数和单价；一日游如用户明确要求住宿也必须计入。total严格等于items之和，所有文字使用简体中文。`;
  const foodTicketsInstruction = `你是 TripMate 的餐饮与门票预算专员。根据用户需求和完整每日行程，只返回有效JSON：{"foodTicketsBudget":{"total":500,"items":[{"name":"武侯祠门票","detail":"1人×参考票价50元，出发前以官方渠道为准","amount":50},{"name":"午餐和晚餐","detail":"1人2餐×约100元","amount":200}]}}。逐项列出所有收费景点、早餐、午餐、晚餐；免费景点也以0元列出。total严格等于items之和，所有文字使用简体中文。`;
  const hotelInstruction = `你是 TripMate 的酒店口碑证据专员。只使用给定的携程网络证据，只返回有效JSON：{"hotels":[{"destination":"城市","name":"酒店全名","area":"位置","estimatedCost":600,"costDetail":"晚数、房间数和估算单价（不是实时房价）","rating":"4.8/5","positiveRate":96,"reviewCount":1200,"sourceName":"携程","sourceUrl":"https://...","evidence":"证据摘要","reviewReasons":["原因一","原因二","原因三"],"booking":"携程酒店或酒店官方渠道"}],"adviceExtra":"..."}。只有证据明确达到95%好评或至少4.75/5时才可推荐；不得编造或提高评分、点评数、链接和好评原因。所有文字使用简体中文。`;
  const restaurantInstruction = `你是 TripMate 的特色餐厅口碑证据专员。只使用给定的携程网络证据，只返回有效JSON：{"restaurants":[{"destination":"城市","name":"餐厅全名","area":"位置","estimatedCost":240,"costDetail":"人数、餐数和人均消费","rating":"4.8/5","positiveRate":96,"reviewCount":800,"sourceName":"携程","sourceUrl":"https://...","evidence":"证据摘要","reviewReasons":["原因一","原因二","原因三"],"booking":"携程美食页、餐厅官方电话或公众号"}],"adviceExtra":"..."}。每个目的地最多推荐3家；只有证据明确达到95%好评或至少4.75/5时才可推荐；不得编造或提高评分、点评数、链接和好评原因。所有文字使用简体中文。`;
  // Specialists run in parallel. Each role receives its own key slot so one
  // account is not asked to generate the entire trip.
  const shardOptions = (stage, keySlot) => ({ timeoutMs: 75000, attempts: 3, keySlot, stage, onRetry: retryNotice(stage) });
  const perDayTransportTokens = Math.max(1800, Math.ceil(transportTokens / requiredDays));
  const dayTransportEntries = core.days.map((day, index) => ({
    label: `第 ${index + 1} 天交通专员`,
    promise: generateJsonPart(
      transportInstruction,
      JSON.stringify({ request: requestText, day, isFirstDay: index === 0, isLastDay: index === core.days.length - 1 }),
      perDayTransportTokens,
      shardOptions(`第 ${index + 1} 天交通专员`, index)
    )
  }));
  const lodgingSlot = core.days.length;
  const lodgingPromise = generateJsonPart(lodgingInstruction, itineraryContext, budgetTokens, shardOptions('住宿预算专员', lodgingSlot));
  const foodTicketsPromise = generateJsonPart(foodTicketsInstruction, itineraryContext, budgetTokens, shardOptions('餐饮门票专员', lodgingSlot + 1));
  const evidenceContext = researchPromise.then(webResearch => `${itineraryContext}\n\n携程网络证据：\n${webResearch}`);
  const hotelPromise = includeRecommendations
    ? evidenceContext.then(content => generateJsonPart(hotelInstruction, content, 1600, shardOptions('酒店口碑专员', lodgingSlot + 2)))
    : Promise.resolve({ hotels: [], adviceExtra: '' });
  const restaurantPromise = includeRecommendations
    ? evidenceContext.then(content => generateJsonPart(restaurantInstruction, content, 1800, shardOptions('餐厅口碑专员', lodgingSlot + 3)))
    : Promise.resolve({ restaurants: [], adviceExtra: '' });
  const partEntries = [
    ...dayTransportEntries,
    { label: '住宿预算专员', promise: lodgingPromise },
    { label: '餐饮门票专员', promise: foodTicketsPromise },
    { label: '酒店口碑专员', promise: hotelPromise },
    { label: '餐厅口碑专员', promise: restaurantPromise }
  ];
  const settledParts = await Promise.allSettled(partEntries.map(entry => entry.promise));
  const warnings = [];
  settledParts.forEach((result, index) => {
    if (result.status === 'rejected') warnings.push(`${partEntries[index].label}未完成（${readableAgnesError(result.reason)}）`);
  });
  const dayTransports = settledParts.slice(0, core.days.length).map((result, index) => {
    if (result.status === 'fulfilled' && Array.isArray(result.value?.transportLegs) && result.value.transportLegs.length >= 3) return result.value;
    if (result.status === 'fulfilled') warnings.push(`${dayTransportEntries[index].label}返回内容不完整`);
    return fallbackTransportForDay(core.days[index], index);
  });
  const specialistParts = settledParts.slice(core.days.length);
  const lodgingPart = specialistParts[0]?.status === 'fulfilled' && specialistParts[0].value?.lodgingBudget
    ? specialistParts[0].value : emptyBudgetPart('lodgingBudget', '住宿预算');
  const foodTicketsPart = specialistParts[1]?.status === 'fulfilled' && specialistParts[1].value?.foodTicketsBudget
    ? specialistParts[1].value : emptyBudgetPart('foodTicketsBudget', '餐饮与门票预算');
  const hotelPart = specialistParts[2]?.status === 'fulfilled' ? specialistParts[2].value : { hotels: [], adviceExtra: '' };
  const restaurantPart = specialistParts[3]?.status === 'fulfilled' ? specialistParts[3].value : { restaurants: [], adviceExtra: '' };
  const transportLegs = dayTransports.flatMap(part => Array.isArray(part?.transportLegs) ? part.transportLegs : []);
  const transportBudget = {
    total: transportLegs.reduce((sum, leg) => sum + Number(leg?.cost || 0), 0),
    items: transportLegs.map(leg => ({
      name: `${leg?.from || '起点'} → ${leg?.to || '终点'}（${leg?.mode || '交通'}）`,
      detail: String(leg?.costDetail || '按本段预计费用'),
      amount: Number(leg?.cost || 0)
    }))
  };
  const lodgingBudget = lodgingPart?.lodgingBudget || {};
  const foodTicketsBudget = foodTicketsPart?.foodTicketsBudget || {};
  const total = [transportBudget, lodgingBudget, foodTicketsBudget].reduce((sum, category) => sum + Number(category?.total || 0), 0);
  return {
    title: core.title,
    summary: core.summary,
    days: core.days,
    transportLegs,
    recommendations: { hotels: hotelPart?.hotels || [], restaurants: restaurantPart?.restaurants || [] },
    budget: { transport: transportBudget, lodging: lodgingBudget, foodTickets: foodTicketsBudget, total, currency: 'CNY' },
    advice: [
      core.advice,
      hotelPart?.adviceExtra,
      restaurantPart?.adviceExtra,
      warnings.length ? `本次部分补充数据未完整返回：${warnings.join('；')}。已保留可验证的主体行程，标为待核实的费用未计入总额，可稍后重新生成。` : ''
    ].filter(Boolean).join(' ')
  };
}

async function reviewPlan(plan, requestText, maxTokens) {
  const runAudit = async (instruction, firstDraft) => {
    return generateJsonPart(
      instruction,
      JSON.stringify({ userRequest: requestText, firstDraft }),
      Math.min(750, maxTokens),
      { timeoutMs: 60000, attempts: 1 }
    );
  };
  const itineraryInstruction = `你是 TripMate 的行程审核员。不要重写，只检查第一轮结果的天数、人数、目的地和用户指定景点是否一致；每日安排是否具体、简体中文、节奏现实，购票渠道是否交代。只返回有效JSON：{"approved":true,"issues":[],"reviewNote":"行程审核摘要"}。issues最多4条，不得输出Markdown或思考过程。`;
  const logisticsInstruction = `你是 TripMate 的交通与费用审核员。不要重写，只检查每段移动是否有具体起终点、交通工具、路线、时间、费用和购票渠道；酒店餐厅是否有可核验来源；住宿、餐饮、门票、交通是否漏项且加法正确。只返回有效JSON：{"approved":true,"issues":[],"reviewNote":"交通费用审核摘要"}。issues最多4条，不得输出Markdown或思考过程。`;
  const [itineraryAudit, logisticsAudit] = await Promise.all([
    runAudit(itineraryInstruction, { title: plan.title, summary: plan.summary, days: plan.days, advice: plan.advice }),
    runAudit(logisticsInstruction, { transportLegs: plan.transportLegs, recommendations: plan.recommendations, budget: plan.budget })
  ]);
  const issues = [
    ...(Array.isArray(itineraryAudit?.issues) ? itineraryAudit.issues : []),
    ...(Array.isArray(logisticsAudit?.issues) ? logisticsAudit.issues : [])
  ].map(String).map(value => value.trim()).filter(Boolean).slice(0, 8);
  return {
    approved: Boolean(itineraryAudit?.approved) && Boolean(logisticsAudit?.approved),
    issues,
    reviewNote: [itineraryAudit?.reviewNote, logisticsAudit?.reviewNote].filter(Boolean).map(String).map(value => value.trim()).filter(Boolean).join('；') || '已完成行程与交通费用双路审核。'
  };
}

async function generatePlanLowQuota(requestText, maxTokens, { onCore, onProgress } = {}) {
  const requiredDays = expectedDayCount(requestText);
  const instruction = `你是 TripMate 的完整旅行规划师。为了节省共享账户额度，你必须在这一次回答中完成全部内容，只返回有效 JSON，不要 Markdown，不要思考过程。
JSON 结构必须是：{"title":"...","summary":"...","days":[{"day":"第 1 天","events":[{"name":"08:30 具体地点或活动","note":"1-2句说明"}]}],"transportLegs":[{"day":"第 1 天","time":"08:30","from":"具体起点","to":"具体终点","mode":"交通工具","route":"线路、车站、出口或换乘说明","duration":"预计时间","cost":0,"costDetail":"人数、次数和单价","booking":"官方购票或支付渠道"}],"recommendations":{"hotels":[],"restaurants":[]},"budget":{"transport":{"total":0,"items":[{"name":"起点→终点（交通工具）","detail":"人数、次数和单价","amount":0}]},"lodging":{"total":0,"items":[{"name":"住宿","detail":"人数、房间数、晚数和估算单价","amount":0}]},"foodTickets":{"total":0,"items":[{"name":"餐饮或门票","detail":"人数、餐数或票数和估算单价","amount":0}]},"total":0,"currency":"CNY"},"advice":"..."}。
必须正好生成 ${requiredDays} 天，每天 5 个具体事件，并且每天至少 3 段交通。交通必须覆盖首次抵达、相邻地点移动和最后返回住宿地或离开；不得编造未知的车次、航班号、实时价格或余票。所有费用都是估算，每个 amount 是小计，分类 total 与总计必须等于各项之和。recommendations 的 hotels 和 restaurants 必须保持为空数组，因为本次不额外联网核验评分。所有可见文字使用简体中文。`;
  const constrainedRequest = `用户原始需求：${requestText}\n强制要求：正好 ${requiredDays} 天；在单次回答中给出完整行程、交通和预算。`;
  onProgress?.({ stage: '节省额度模式', status: 'generating', message: '正在用一次 Agnes 请求生成完整行程、交通和预算…' });
  const draft = await generateJsonPart(instruction, constrainedRequest, maxTokens, {
    timeoutMs: 90000,
    attempts: 1,
    stage: '单次完整行程'
  });
  if (!Array.isArray(draft?.days) || !draft.days.length) throw new Error('Agnes 单次行程结果不完整');
  if (draft.days.length > requiredDays) draft.days = draft.days.slice(0, requiredDays);

  const dayLabel = normalizedDayLabel;
  let sourceLegs = (Array.isArray(draft.transportLegs) ? draft.transportLegs : [])
    .map(normalizeGeneratedLeg)
    .filter(leg => leg.from && leg.to && leg.mode && leg.route && leg.duration && Number.isFinite(leg.cost) && leg.costDetail && leg.booking);
  const missingDays = draft.days.map((day, index) => ({ day, index, label: dayLabel(day?.day, index) }))
    .filter(({ label }) => sourceLegs.filter(leg => leg.day === label).length < 3);
  if (missingDays.length) {
    onProgress?.({ stage: '交通费用补全', status: 'generating', message: '正在保留已返回价格，并补全缺失的交通费用…' });
    const repairInstruction = `你是 TripMate 的交通费用补全专员。只为给定日期返回缺失的交通段，只返回有效JSON：{"transportLegs":[{"day":"第 1 天","time":"08:30","from":"具体起点","to":"具体终点","mode":"具体交通工具或步行","route":"线路、车站、出口与换乘说明","duration":"预计时间","cost":80,"costDetail":"人数、次数和估算单价","booking":"官方购票或支付渠道"}]}。每天至少3段，覆盖抵达、相邻活动地点移动以及返回住宿地或离开。cost必须是数字小计；允许合理估算并在costDetail注明估算依据，不得用“待确认”代替全部价格。步行费用为0。所有文字使用简体中文。`;
    try {
      const repaired = await generateJsonPart(
        repairInstruction,
        JSON.stringify({ request: requestText, missingDays: missingDays.map(({ day, label }) => ({ ...day, day: label })) }),
        Math.min(3600, Math.max(2200, maxTokens)),
        { timeoutMs: 75000, attempts: 2, stage: '交通费用补全' }
      );
      const repairedLegs = (Array.isArray(repaired?.transportLegs) ? repaired.transportLegs : [])
        .map(normalizeGeneratedLeg)
        .filter(leg => leg.from && leg.to && leg.mode && leg.route && leg.duration && Number.isFinite(leg.cost) && leg.costDetail && leg.booking);
      sourceLegs = [...sourceLegs, ...repairedLegs];
    } catch (error) {
      onProgress?.({ stage: '交通费用补全', status: 'warning', message: `交通费用补全未完成（${readableAgnesError(error)}），仅将确实缺失的单项标为待确认。` });
    }
  }
  const transportLegs = draft.days.flatMap((day, index) => {
    const label = dayLabel(day?.day, index);
    const matches = sourceLegs.filter(leg => leg.day === label).slice(0, Math.max(3, (day?.events || []).length + 1));
    if (matches.length >= 3) return matches;
    const fallback = fallbackTransportForDay({ ...day, day: label }, index).transportLegs;
    const existingRoutes = new Set(matches.map(leg => `${leg.from}|${leg.to}`));
    return [...matches, ...fallback.filter(leg => !existingRoutes.has(`${leg.from}|${leg.to}`)).slice(0, 3 - matches.length)];
  });
  draft.transportLegs = transportLegs;
  const transportItems = transportLegs.map(leg => ({
    name: `${leg?.from || '起点'} → ${leg?.to || '终点'}（${leg?.mode || '交通'}）`,
    detail: String(leg?.costDetail || '按本段预计费用，出发前核实'),
    amount: Math.max(0, Number(leg?.cost || 0))
  }));
  const transportTotal = transportItems.reduce((sum, item) => sum + item.amount, 0);
  draft.recommendations = { hotels: [], restaurants: [] };
  draft.budget ||= {};
  draft.budget.transport = { total: transportTotal, items: transportItems };
  if (!Array.isArray(draft.budget?.lodging?.items)) draft.budget.lodging = emptyBudgetPart('lodging', '住宿预算').lodging;
  if (!Array.isArray(draft.budget?.foodTickets?.items)) draft.budget.foodTickets = emptyBudgetPart('foodTickets', '餐饮与门票预算').foodTickets;
  draft.budget.total = transportTotal
    + Number(draft.budget.lodging?.total || 0)
    + Number(draft.budget.foodTickets?.total || 0);
  draft.budget.currency ||= 'CNY';
  draft.advice = `${String(draft.advice || '').trim()} 本次采用节省额度模式，未额外联网核验酒店和餐厅评分，因此不显示未经验证的推荐。`.trim();

  onCore?.({ title: draft.title, summary: draft.summary, days: draft.days, advice: draft.advice });
  return draft;
}

if (false) { createServer(async (req, res) => {
  if (req.method === "GET" && (req.url === "/" || req.url === "/tripmate-mvp.html")) {
    try { send(res, 200, await readFile(join(directory, "tripmate-mvp.html")), "text/html; charset=utf-8"); }
    catch { send(res, 500, "TripMate 页面未找到", "text/plain; charset=utf-8"); }
    return;
  }
  if (req.method !== "POST" || !["/api/plan", "/api/plan-stream"].includes(req.url)) return send(res, 404, { error: "Not found" });
  if (!agnesKeys().length) return send(res, 503, { error: "服务器未配置 AGNES_API_KEY 或 AGNES_API_KEYS。" });
  let raw = "";
  for await (const chunk of req) raw += chunk;
  let request;
  try { request = JSON.parse(raw); } catch { return send(res, 400, { error: "请求格式不正确。" }); }
  const requestText = String(request.request || "").trim().slice(0, 1200);
  if (!requestText) return send(res, 400, { error: "请填写旅行需求。" });
  const maxTokens = tokenBudgetFor(requestText);
  const streaming = req.url === "/api/plan-stream";
  if (streaming) res.writeHead(200, {
    "content-type": "application/x-ndjson; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  const emit = (type, payload) => {
    if (streaming && !res.writableEnded) res.write(`${JSON.stringify({ type, ...payload })}\n`);
  };
  try {
    const assembled = await generatePlanInParts(requestText, maxTokens, {
      includeRecommendations: true,
      onCore: streaming ? core => emit('core', { plan: core }) : undefined,
      onProgress: streaming ? progress => emit('progress', progress) : undefined
    });
    try {
      let plan = parsePlan(JSON.stringify(assembled), requestText);
      let reviewed = false;
      let reviewNote = '';
      let reviewWarning = '';
      try {
        const audit = await reviewPlan(plan, requestText, maxTokens);
        reviewNote = audit.reviewNote;
        if (audit.issues.length) plan.advice = `${plan.advice} 二次检查提醒：${audit.issues.join('；')}。`;
        reviewed = true;
      } catch (error) {
        const detail = String(error?.message || '请求失败');
        reviewWarning = /rate limit|free users|HTTP 429/i.test(detail)
          ? '二次检查暂未完成：这些密钥所属的 Agnes 免费账户已达到共享调用上限。请等待额度恢复，或在 Agnes 升级 Token Plan；当前显示第一轮已通过程序校验的结果。'
          : `二次检查未完成：${detail}。当前显示第一轮已通过程序校验的结果。`;
      }
      const result = { ...plan, reviewed, reviewNote, reviewWarning };
      if (streaming) {
        emit('complete', { plan: result });
        return res.end();
      }
      return send(res, 200, result);
    } catch {
      await saveBadResponse('Agnes parallel sections failed validation', JSON.stringify(assembled, null, 2));
      if (streaming) {
        emit('error', { error: "Agnes 的分段结果有一部分不完整，已拒绝显示不可靠内容，请重新生成。" });
        return res.end();
      }
      return send(res, 502, { error: "Agnes 的分段结果有一部分不完整，已拒绝显示不可靠内容，请重新生成。" });
    }
  } catch (error) {
    const rawReason = String(error?.message || '网络连接中断');
    const reason = readableAgnesError(error);
    const message = /rate limit|free users|HTTP 429/i.test(rawReason)
      ? 'Agnes 免费账户已达到共享调用上限。请等待额度恢复，或在 Agnes 升级 Token Plan 后重试。'
      : /^无法/.test(rawReason)
        ? `${rawReason}，TripMate 不会伪造 95% 好评推荐，请稍后重试。`
        : /^暂时无法连接 Agnes/.test(reason)
          ? `${reason}，请稍后再试。`
          : `Agnes ${reason}，请稍后再试。`;
    if (streaming) {
      emit('error', { error: message });
      return res.end();
    }
    return send(res, 502, { error: message });
  }
}).listen(port, () => console.log(`TripMate 已运行：http://localhost:${port}`)); }

async function assemblePlan(requestText, emit) {
  const maxTokens = tokenBudgetFor(requestText);
  const assembled = await generatePlanInParts(requestText, maxTokens, {
    includeRecommendations: true,
    onCore: core => emit?.('core', { plan: core }),
    onProgress: progress => emit?.('progress', progress)
  });
  let plan;
  try {
    plan = parsePlan(JSON.stringify(assembled), requestText);
  } catch {
    await saveBadResponse('Agnes parallel sections failed validation', JSON.stringify(assembled, null, 2));
    throw new Error('Agnes 的分段结果有一部分不完整，已拒绝显示不可靠内容，请重新生成。');
  }
  return {
    ...plan,
    reviewed: false,
    reviewNote: '已通过 TripMate 程序完整性校验。',
    reviewWarning: '已由多把 Agnes 密钥分工生成；若单项失败，只保留该项的待核实提示。'
  };
}

function aiFailureMessage(error) {
  const rawReason = String(error?.message || '网络连接中断');
  if (/分段结果/.test(rawReason)) return rawReason;
  const reason = readableAgnesError(error);
  if (/rate limit|free users|HTTP 429/i.test(rawReason)) return 'Agnes 账户已达到调用上限。请等待额度恢复后重试。';
  if (/^无法/.test(rawReason)) return `${rawReason}，TripMate 不会伪造 95% 好评推荐，请稍后重试。`;
  if (/^暂时无法连接 Agnes/.test(reason)) return `${reason}，请稍后再试。`;
  return `Agnes ${reason}，请稍后再试。`;
}

async function parseJsonRequest(request, maxBytes = 2_000_000) {
  const text = await request.text();
  if (text.length > maxBytes) throw new Error('请求内容过大');
  try { return JSON.parse(text || '{}'); }
  catch { throw new Error('请求格式不正确'); }
}

function authenticatedUser(request) {
  const userId = request.headers.get('oai-authenticated-user-id')?.trim();
  const email = request.headers.get('oai-authenticated-user-email')?.trim();
  if (!userId || !email) return null;
  let fullName = '';
  const encodedName = request.headers.get('oai-authenticated-user-full-name');
  if (encodedName && request.headers.get('oai-authenticated-user-full-name-encoding') === 'percent-encoded-utf-8') {
    try { fullName = decodeURIComponent(encodedName); } catch {}
  }
  return { userId, email, fullName };
}

async function profileFor(env, userId) {
  return env.DB.prepare('SELECT user_id, email, display_name, created_at, last_login_at FROM profiles WHERE user_id = ?').bind(userId).first();
}

async function handleAuth(request, env, action) {
  if (!env.DB) return jsonResponse({ error: '账号服务暂不可用' }, 503);
  const user = authenticatedUser(request);
  if (!user) return jsonResponse({ authenticated: false, registered: false, error: '请先使用 ChatGPT 登录' }, 401);
  if (action === 'me') {
    const profile = await profileFor(env, user.userId);
    return jsonResponse({ authenticated: true, registered: Boolean(profile), email: user.email, displayName: profile?.display_name || user.fullName || '' });
  }
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  if (action === 'login') {
    const profile = await profileFor(env, user.userId);
    if (!profile) return jsonResponse({ error: '这个 ChatGPT 账号还没有注册 TripMate，请先注册。' }, 404);
    const now = new Date().toISOString();
    await env.DB.prepare('UPDATE profiles SET email = ?, last_login_at = ? WHERE user_id = ?').bind(user.email, now, user.userId).run();
    return jsonResponse({ ok: true, email: user.email, displayName: profile.display_name || user.fullName || user.email.split('@')[0] });
  }
  if (action === 'register') {
    const existing = await profileFor(env, user.userId);
    if (existing) return jsonResponse({ error: '这个 ChatGPT 账号已经注册，请选择登录。' }, 409);
    let body;
    try { body = await parseJsonRequest(request, 10_000); }
    catch (error) { return jsonResponse({ error: error.message }, 400); }
    const displayName = String(body.displayName || user.fullName || '').trim().slice(0, 40);
    if (displayName.length < 1) return jsonResponse({ error: '请填写昵称。' }, 400);
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare('INSERT INTO profiles (user_id, email, display_name, created_at, last_login_at) VALUES (?, ?, ?, ?, ?)').bind(user.userId, user.email, displayName, now, now),
      env.DB.prepare(`INSERT INTO app_state (id, data, updated_at)
        SELECT ?, data, updated_at FROM app_state WHERE id = 'primary'
        ON CONFLICT(id) DO NOTHING`).bind(user.userId)
    ]);
    return jsonResponse({ ok: true, email: user.email, displayName });
  }
  return jsonResponse({ error: 'Not found' }, 404);
}

async function registeredUser(request, env) {
  const user = authenticatedUser(request);
  if (!user || !env.DB) return null;
  const profile = await profileFor(env, user.userId);
  return profile ? { ...user, profile } : null;
}

const SESSION_COOKIE = 'tripmate_session';
// Cloudflare Workers supports PBKDF2 iteration counts up to 100,000.
const PASSWORD_ITERATIONS = 100000;
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const encoder = new TextEncoder();

const normalizeEmail = value => String(value || '').trim().toLowerCase();
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
const bytesToHex = bytes => [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');
const bytesToBase64Url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
const base64UrlToBytes = value => Uint8Array.from(atob(String(value).replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(String(value).length / 4) * 4, '=')), char => char.charCodeAt(0));
const randomToken = length => bytesToBase64Url(crypto.getRandomValues(new Uint8Array(length)));
const sha256Hex = async value => bytesToHex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
const secureEqual = (left, right) => {
  const a = encoder.encode(String(left || '')), b = encoder.encode(String(right || ''));
  let different = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index++) different |= (a[index % (a.length || 1)] || 0) ^ (b[index % (b.length || 1)] || 0);
  return different === 0;
};

async function passwordDigest(password, saltValue, iterations = PASSWORD_ITERATIONS) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: base64UrlToBytes(saltValue), iterations }, key, 256);
  return bytesToHex(bits);
}

function requestCookie(request, name) {
  const match = request.headers.get('cookie')?.split(';').map(item => item.trim()).find(item => item.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
}

function jsonWithCookie(body, cookie, status = 200) {
  const response = jsonResponse(body, status);
  response.headers.set('set-cookie', cookie);
  return response;
}

function sameOrigin(request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

async function consumeRateLimit(env, key, limit, windowSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare('SELECT count, window_start FROM auth_rate_limits WHERE key = ?').bind(key).first();
  if (!row || now - Number(row.window_start) >= windowSeconds) {
    await env.DB.prepare(`INSERT INTO auth_rate_limits (key, count, window_start) VALUES (?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start`).bind(key, now).run();
    return true;
  }
  if (Number(row.count) >= limit) return false;
  await env.DB.prepare('UPDATE auth_rate_limits SET count = count + 1 WHERE key = ?').bind(key).run();
  return true;
}

async function publicSession(request, env) {
  const token = requestCookie(request, SESSION_COOKIE);
  if (!token || !env.DB) return null;
  const tokenHash = await sha256Hex(token);
  const user = await env.DB.prepare(`SELECT u.id, u.email, u.display_name, u.status, u.role, s.token_hash, s.expires_at
    FROM public_sessions s JOIN public_users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?`).bind(tokenHash, new Date().toISOString()).first();
  return user?.status === 'active' ? { ...user, tokenHash } : null;
}

async function issueSession(env, user) {
  const token = randomToken(32), tokenHash = await sha256Hex(token), createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
  await env.DB.prepare('INSERT INTO public_sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').bind(tokenHash, user.id, expiresAt, createdAt).run();
  return {
    body: { authenticated: true, id: user.id, email: user.email, displayName: user.display_name, role: user.role },
    cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`
  };
}

async function handlePublicAuth(request, env, action) {
  if (!env.DB) return jsonResponse({ error: '账号服务暂不可用' }, 503);
  if (action === 'me') {
    const user = await publicSession(request, env);
    return jsonResponse(user ? { authenticated: true, id: user.id, email: user.email, displayName: user.display_name, role: user.role } : { authenticated: false });
  }
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  if (!sameOrigin(request)) return jsonResponse({ error: '请求来源无效' }, 403);
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (action === 'logout') {
    const user = await publicSession(request, env);
    if (user) await env.DB.prepare('DELETE FROM public_sessions WHERE token_hash = ?').bind(user.tokenHash).run();
    return jsonWithCookie({ ok: true }, `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  }
  let body;
  try { body = await parseJsonRequest(request, 20_000); }
  catch (error) { return jsonResponse({ error: error.message }, 400); }
  if (action === 'register') {
    if (!await consumeRateLimit(env, `register:ip:${ip}`, 5, 3600)) return jsonResponse({ error: '注册请求过多，请稍后再试。' }, 429);
    const email = normalizeEmail(body.email), displayName = String(body.displayName || '').trim().slice(0, 40), password = String(body.password || '');
    if (!validEmail(email)) return jsonResponse({ error: '请输入有效邮箱。' }, 400);
    if (displayName.length < 1) return jsonResponse({ error: '请填写昵称。' }, 400);
    if (password.length < 10 || password.length > 128) return jsonResponse({ error: '密码需要 10–128 个字符。' }, 400);
    if (!await consumeRateLimit(env, `register:email:${email}`, 3, 86400)) return jsonResponse({ error: '这个邮箱的注册请求过多。' }, 429);
    const existing = await env.DB.prepare('SELECT id, status FROM public_users WHERE email_normalized = ?').bind(email).first();
    if (existing) return jsonResponse({ error: existing.status === 'pending' ? '注册申请正在等待管理员审核。' : '这个邮箱已经注册，请直接登录。' }, 409);
    const id = crypto.randomUUID(), salt = randomToken(16), passwordHash = await passwordDigest(password, salt), now = new Date().toISOString();
    await env.DB.prepare(`INSERT INTO public_users (id, email, email_normalized, display_name, password_hash, password_salt, password_iterations, status, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'user', ?)`).bind(id, email, email, displayName, passwordHash, salt, PASSWORD_ITERATIONS, now).run();
    return jsonResponse({ ok: true, pending: true, message: '注册申请已提交，管理员审核通过后即可登录。' }, 201);
  }
  if (action === 'login') {
    const email = normalizeEmail(body.email), password = String(body.password || '');
    if (!await consumeRateLimit(env, `login:${ip}:${email}`, 10, 900)) return jsonResponse({ error: '登录尝试过多，请 15 分钟后再试。' }, 429);
    const user = await env.DB.prepare('SELECT * FROM public_users WHERE email_normalized = ?').bind(email).first();
    if (!user || !secureEqual(await passwordDigest(password, user.password_salt, Number(user.password_iterations)), user.password_hash)) return jsonResponse({ error: '邮箱或密码不正确。' }, 401);
    if (user.status === 'pending') return jsonResponse({ error: '账号正在等待管理员审核。' }, 403);
    if (user.status !== 'active') return jsonResponse({ error: '账号当前不可用，请联系管理员。' }, 403);
    await env.DB.prepare('UPDATE public_users SET last_login_at = ? WHERE id = ?').bind(new Date().toISOString(), user.id).run();
    const session = await issueSession(env, user);
    return jsonWithCookie(session.body, session.cookie);
  }
  if (action === 'admin-setup') {
    if (!await consumeRateLimit(env, `admin-setup:${ip}`, 6, 3600)) return jsonResponse({ error: '尝试次数过多，请稍后再试。' }, 429);
    const adminCount = await env.DB.prepare("SELECT COUNT(*) AS count FROM public_users WHERE role = 'admin'").first();
    if (Number(adminCount?.count || 0) > 0) return jsonResponse({ error: '管理员已经初始化，请直接登录。' }, 409);
    if (!env.TRIPMATE_ADMIN_SETUP_TOKEN || !secureEqual(body.setupToken, env.TRIPMATE_ADMIN_SETUP_TOKEN)) return jsonResponse({ error: '管理员初始化码不正确。' }, 403);
    const email = normalizeEmail(body.email), displayName = String(body.displayName || '').trim().slice(0, 40), password = String(body.password || '');
    if (!validEmail(email) || !displayName || password.length < 8 || password.length > 128) return jsonResponse({ error: '请填写有效邮箱、昵称和至少 8 位密码。' }, 400);
    const id = crypto.randomUUID(), salt = randomToken(16), passwordHash = await passwordDigest(password, salt), now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO public_users (id, email, email_normalized, display_name, password_hash, password_salt, password_iterations, status, role, created_at, approved_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 'admin', ?, ?)`).bind(id, email, email, displayName, passwordHash, salt, PASSWORD_ITERATIONS, now, now),
      env.DB.prepare(`INSERT INTO app_state (id, data, updated_at)
        SELECT ?, data, updated_at FROM app_state WHERE id = 'primary'
        ON CONFLICT(id) DO NOTHING`).bind(id)
    ]);
    const session = await issueSession(env, { id, email, display_name: displayName, role: 'admin' });
    return jsonWithCookie(session.body, session.cookie, 201);
  }
  return jsonResponse({ error: 'Not found' }, 404);
}

async function handleAdmin(request, env, action) {
  const admin = await publicSession(request, env);
  if (!admin || admin.role !== 'admin') return jsonResponse({ error: '需要管理员权限。' }, 403);
  if (action === 'list' && request.method === 'GET') {
    const result = await env.DB.prepare(`SELECT id, email, display_name, status, role, created_at, approved_at, last_login_at
      FROM public_users ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 ELSE 2 END, created_at DESC LIMIT 200`).all();
    return jsonResponse({ users: result.results || [] });
  }
  if (action === 'status' && request.method === 'POST') {
    if (!sameOrigin(request)) return jsonResponse({ error: '请求来源无效' }, 403);
    let body;
    try { body = await parseJsonRequest(request, 10_000); }
    catch (error) { return jsonResponse({ error: error.message }, 400); }
    const userId = String(body.userId || ''), status = String(body.status || '');
    if (!['active', 'rejected', 'disabled'].includes(status)) return jsonResponse({ error: '账号状态无效' }, 400);
    if (userId === admin.id) return jsonResponse({ error: '不能修改当前管理员账号。' }, 400);
    const result = await env.DB.prepare(`UPDATE public_users SET status = ?, approved_at = ?, approved_by = ? WHERE id = ? AND role != 'admin'`)
      .bind(status, status === 'active' ? new Date().toISOString() : null, admin.id, userId).run();
    if (!result.meta?.changes) return jsonResponse({ error: '用户不存在或不可修改。' }, 404);
    if (status !== 'active') await env.DB.prepare('DELETE FROM public_sessions WHERE user_id = ?').bind(userId).run();
    return jsonResponse({ ok: true, status });
  }
  if (action === 'delete' && request.method === 'POST') {
    if (!sameOrigin(request)) return jsonResponse({ error: '请求来源无效' }, 403);
    let body;
    try { body = await parseJsonRequest(request, 10_000); }
    catch (error) { return jsonResponse({ error: error.message }, 400); }
    const userId = String(body.userId || '').trim();
    if (!userId) return jsonResponse({ error: '缺少用户编号。' }, 400);
    if (userId === admin.id) return jsonResponse({ error: '不能删除当前管理员账号。' }, 400);
    const target = await env.DB.prepare('SELECT id, email_normalized, role FROM public_users WHERE id = ?').bind(userId).first();
    if (!target) return jsonResponse({ error: '用户不存在。' }, 404);
    if (target.role === 'admin') return jsonResponse({ error: '管理员账号不能在这里删除。' }, 400);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM public_sessions WHERE user_id = ?').bind(userId),
      env.DB.prepare('DELETE FROM app_state WHERE id = ?').bind(userId),
      env.DB.prepare('DELETE FROM regional_links WHERE user_id = ?').bind(userId),
      env.DB.prepare('DELETE FROM regional_archives WHERE user_id = ?').bind(userId),
      env.DB.prepare("DELETE FROM auth_rate_limits WHERE key = ? OR (key LIKE 'login:%' AND substr(key, -length(?)) = ?)")
        .bind(`register:email:${target.email_normalized}`, target.email_normalized, target.email_normalized),
      env.DB.prepare("DELETE FROM public_users WHERE id = ? AND role != 'admin'").bind(userId)
    ]);
    return jsonResponse({ ok: true, deletedUserId: userId });
  }
  return jsonResponse({ error: 'Not found' }, 404);
}

const regionalBridge=createRegionalBridge({publicSession,jsonResponse,sameOrigin,parseJsonRequest,randomToken});
async function handleState(request, env) {
  if (!env.DB) return jsonResponse({ error: '云端同步暂不可用' }, 503);
  const shared=await regionalBridge.state(request,env);if(shared)return shared;
  const user = await publicSession(request, env);
  if (!user) return jsonResponse({ error: '请先登录或注册 TripMate 账号' }, 401);
  if (request.method === 'GET') {
    const row = await env.DB.prepare('SELECT data, updated_at FROM app_state WHERE id = ?').bind(user.id).first();
    let data = {};
    try { data = row?.data ? JSON.parse(row.data) : {}; } catch {}
    return jsonResponse({ data, updatedAt: row?.updated_at || null, stateVersion: row?.updated_at || '' });
  }
  if (request.method === 'PUT') {
    const body = await parseJsonRequest(request);
    if (!body.data || Array.isArray(body.data) || typeof body.data !== 'object') return jsonResponse({ error: '同步数据格式不正确' }, 400);
    const allowed = new Set(['tripmate.v1.draft','tripmate.v1.trips','tripmate.v1.orders','tripmate.v1.reminders','tripmate.v1.expenses','tripmate.v1.packing','tripmate.v1.emergency','tripmate.v1.preferences','tripmate.v1.largeMode']);
    const data = Object.fromEntries(Object.entries(body.data).filter(([key]) => allowed.has(key)));
    const serialized = JSON.stringify(data);
    if (serialized.length > 1_800_000) return jsonResponse({ error: '同步数据过大' }, 413);
    if(!sameOrigin(request))return jsonResponse({error:'请从本站保存。'},403);
    const previous=await env.DB.prepare('SELECT updated_at FROM app_state WHERE id = ?').bind(user.id).first();
    if(body.stateVersion!==(previous?.updated_at||''))return jsonResponse({error:'云端记录已变化。本机修改已保留，请导出本机备份后处理冲突。'},409);
    const updatedAt=new Date(Math.max(Date.now(),Date.parse(previous?.updated_at||'')+1||0)).toISOString();
    const saved=await env.DB.prepare(`INSERT INTO app_state (id,data,updated_at)
      SELECT ?,?,? WHERE NOT EXISTS (SELECT 1 FROM regional_links WHERE user_id = ?)
      ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at
      WHERE app_state.updated_at = ? AND NOT EXISTS (SELECT 1 FROM regional_links WHERE user_id = ?)`)
      .bind(user.id,serialized,updatedAt,user.id,body.stateVersion,user.id).run();
    if(!saved.meta?.changes)return jsonResponse({error:'记录或连接状态已变化，本机修改保留。'},409);
    return jsonResponse({ok:true,updatedAt,stateVersion:updatedAt});
  }
  return jsonResponse({ error: 'Method not allowed' }, 405);
}

async function handlePlan(request, streaming, env) {
  if (!await publicSession(request, env)) return jsonResponse({ error: '请先登录 TripMate 账号' }, 401);
  if (!agnesKeys().length) return jsonResponse({ error: '服务器未配置 Agnes 密钥。' }, 503);
  let body;
  try { body = await parseJsonRequest(request, 20_000); }
  catch (error) { return jsonResponse({ error: error.message }, 400); }
  const requestText = String(body.request || '').trim().slice(0, 1200);
  if (!requestText) return jsonResponse({ error: '请填写旅行需求。' }, 400);
  if (!streaming) {
    try { return jsonResponse(await assemblePlan(requestText)); }
    catch (error) { return jsonResponse({ error: aiFailureMessage(error) }, 502); }
  }
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const emit = (type, payload) => controller.enqueue(encoder.encode(`${JSON.stringify({ type, ...payload })}\n`));
      (async () => {
        try { emit('complete', { plan: await assemblePlan(requestText, emit) }); }
        catch (error) { emit('error', { error: aiFailureMessage(error) }); }
        finally { controller.close(); }
      })();
    }
  });
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
}

export default {
  async fetch(request, env) {
    runtimeEnv = env;
    const url = new URL(request.url);
    try {
      if(['GET','HEAD'].includes(request.method)&&['/account-link','/tripmate-sync-ui.js'].includes(url.pathname)){
        const js=url.pathname.endsWith('.js');
        return new Response(request.method==='HEAD'?null:(js?SYNC_UI:ACCOUNT_LINK_HTML),{headers:{'content-type':js?'text/javascript; charset=utf-8':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; connect-src 'self' https://111.230.133.155; style-src 'unsafe-inline'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'"}});
      }
      if (['GET','HEAD'].includes(request.method) && ['/download','/download/','/download.html'].includes(url.pathname)) {
        return new Response(request.method==='HEAD'?null:DOWNLOAD_HTML,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
      }
      if (['GET','HEAD'].includes(request.method) && url.pathname==='/tripmate-regions.js') {
        return new Response(request.method==='HEAD'?null:REGIONAL_SCRIPT,{headers:{'content-type':'text/javascript; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
      }
      if (['GET','HEAD'].includes(request.method) && url.pathname==='/tripmate-icon.png') {
        return new Response(request.method==='HEAD'?null:Uint8Array.from(atob(ICON_BASE64),c=>c.charCodeAt(0)),{headers:{'content-type':'image/png','cache-control':'public, max-age=86400'}});
      }
      if (url.pathname.startsWith('/downloads/')) {
        const sources = {
          'TripMate-v58-android-v1.1.5.apk':'https://github.com/xuantingjiang39/TripMate/releases/download/v58/TripMate-v58-android-v1.1.5.apk',
          'TripMate-v54-Windows-1.0.1-Setup.exe':'https://github.com/xuantingjiang39/TripMate/releases/download/v54/TripMate-v54-Windows-1.0.1-Setup.exe'
        };
        const name=url.pathname.slice('/downloads/'.length), source=Object.hasOwn(sources,name)?sources[name]:null;
        if(!source)return new Response('Not found',{status:404});
        if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{allow:'GET, HEAD'}});
        const headers=new Headers();for(const key of ['range','if-range'])if(request.headers.has(key))headers.set(key,request.headers.get(key));
        const upstream=await fetch(source,{method:request.method,headers,redirect:'follow'});
        if(![200,206,416].includes(upstream.status))return new Response('Download temporarily unavailable. Please use the GitHub backup link.',{status:503,headers:{'retry-after':'60'}});
        const result=new Headers({'content-type':name.endsWith('.apk')?'application/vnd.android.package-archive':'application/octet-stream','content-disposition':`attachment; filename="${name}"`,'x-content-type-options':'nosniff'});
        for(const key of ['content-length','content-range','etag','accept-ranges'])if(upstream.headers.has(key))result.set(key,upstream.headers.get(key));
        result.set('cache-control',upstream.ok?'public, max-age=86400':'no-store');
        return new Response(request.method==='HEAD'?null:upstream.body,{status:upstream.status,headers:result});
      }
      if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/tripmate-mvp.html' || url.pathname === '/admin/setup')) {
        return new Response(PAGE_HTML, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store, max-age=0' } });
      }
      if (url.pathname === '/api/auth/me' && request.method === 'GET') return await handlePublicAuth(request, env, 'me');
      if (url.pathname === '/api/auth/login') return await handlePublicAuth(request, env, 'login');
      if (url.pathname === '/api/auth/register') return await handlePublicAuth(request, env, 'register');
      if (url.pathname === '/api/auth/logout') return await handlePublicAuth(request, env, 'logout');
      if (url.pathname === '/api/auth/admin-setup') return await handlePublicAuth(request, env, 'admin-setup');
      if (url.pathname === '/api/admin/users') return await handleAdmin(request, env, 'list');
      if (url.pathname === '/api/admin/user-status') return await handleAdmin(request, env, 'status');
      if (url.pathname === '/api/admin/user-delete') return await handleAdmin(request, env, 'delete');
      if (url.pathname.startsWith('/api/bridge/')) return await regionalBridge.handle(request,env);
      if (url.pathname === '/api/sync') return await handleState(request, env);
      if (request.method === 'POST' && url.pathname === '/api/plan') return await handlePlan(request, false, env);
      if (request.method === 'POST' && url.pathname === '/api/plan-stream') return await handlePlan(request, true, env);
      if (request.method === 'GET' && url.pathname === '/api/health') return jsonResponse({ ok: true, version:'v60-regional-sync', ai: agnesKeys().length > 0, sync: Boolean(env.DB) });
      return new Response('Not found', { status: 404 });
    } catch (error) {
      console.error('TripMate request failed', error);
      return jsonResponse({ error: '服务暂时不可用，请稍后重试。' }, 500);
    }
  }
};
