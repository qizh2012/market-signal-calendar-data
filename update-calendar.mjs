import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname);
const calendarPath = path.join(root, "calendar.json");
const statusPath = path.join(root, "status.json");
const verifiedBackfillPath = path.join(root, "verified-backfill-2026.json");
const mode = process.env.RUN_MODE || "bootstrap";
const now = new Date();
const shanghaiNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Shanghai" }));

function pad(value) {
  return String(value).padStart(2, "0");
}

function dateOnly(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function localIso(date, time = "09:30:00") {
  return `${dateOnly(date)}T${time}+08:00`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function nextWeekday(date) {
  const day = date.getDay();
  if (day === 6) return addDays(date, 2);
  if (day === 0) return addDays(date, 1);
  return date;
}

function lastWeekday(year, month) {
  const date = new Date(year, month + 1, 0);
  while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() - 1);
  return date;
}

function firstFriday(year, month) {
  const date = new Date(year, month, 1);
  date.setDate(1 + ((5 - date.getDay() + 7) % 7));
  return date;
}

function thirdFriday(year, month) {
  return addDays(firstFriday(year, month), 14);
}

function lastFriday(year, month) {
  const date = new Date(year, month + 1, 0);
  date.setDate(date.getDate() - ((date.getDay() - 5 + 7) % 7));
  return date;
}

function isLastWeekdayToday() {
  return dateOnly(shanghaiNow) === dateOnly(lastWeekday(shanghaiNow.getFullYear(), shanghaiNow.getMonth()));
}

if (mode === "month-end" && !isLastWeekdayToday()) {
  console.log("Not the last weekday of the month; no update required.");
  process.exit(0);
}

const common = {
  timezone: "Asia/Shanghai",
  dateStatus: "historical_estimate",
  sourceLevel: "official",
  actualValue: "",
  consensusValue: "",
  previousValue: "",
  revisionValue: "",
  outcomeSummary: "",
  marketReaction: "",
};

const marketHolidaySources = {
  china: {
    market: "A股",
    countryOrRegion: "中国",
    publisher: "上海证券交易所 / 深圳证券交易所",
    timezone: "Asia/Shanghai",
    offset: "+08:00",
    sourceUrl: "https://www.sse.com.cn/disclosure/dealinstruc/closed/c/c_20251222_10802510.shtml",
    sourceName: "上海证券交易所2026年休市安排",
  },
  usa: {
    market: "美股",
    countryOrRegion: "美国",
    publisher: "New York Stock Exchange",
    timezone: "America/New_York",
    offset: "-05:00",
    sourceUrl: "https://www.nyse.com/trade/hours-calendars",
    sourceName: "NYSE Holidays & Trading Hours",
  },
  hong_kong: {
    market: "港股",
    countryOrRegion: "中国香港",
    publisher: "香港交易所",
    timezone: "Asia/Hong_Kong",
    offset: "+08:00",
    sourceUrl: "https://www.hkex.com.hk/-/media/HKEX-Market/Services/Circulars-and-Notices/Participant-and-Members-Circulars/SEHK/2025/ce_SEHK_CT_075_2025.pdf",
    sourceName: "香港证券市场2026年假期安排",
  },
  japan: {
    market: "日股",
    countryOrRegion: "日本",
    publisher: "Japan Exchange Group",
    timezone: "Asia/Tokyo",
    offset: "+09:00",
    sourceUrl: "https://www.jpx.co.jp/english/corporate/about-jpx/calendar/index.html",
    sourceName: "Japan Exchange Group Market Holidays",
  },
  korea: {
    market: "韩股",
    countryOrRegion: "韩国",
    publisher: "Korea Exchange",
    timezone: "Asia/Seoul",
    offset: "+09:00",
    sourceUrl: "https://global.krx.co.kr/contents/GLB/06/0602/0602010201/GLB0602010201T1.jsp",
    sourceName: "KRX休市规则 / 韩国官方公休日历",
  },
};

// Only exchange closures that fall on a normal Monday-Friday trading day are
// listed. Weekends are intentionally omitted to keep the calendar readable.
const marketHolidaysByYear = {
  2026: [
    ["china", "2026-01-01", "元旦"], ["china", "2026-01-02", "元旦假期"],
    ["china", "2026-02-16", "春节"], ["china", "2026-02-17", "春节"],
    ["china", "2026-02-18", "春节"], ["china", "2026-02-19", "春节"],
    ["china", "2026-02-20", "春节"], ["china", "2026-02-23", "春节"],
    ["china", "2026-04-06", "清明节"], ["china", "2026-05-01", "劳动节"],
    ["china", "2026-05-04", "劳动节"], ["china", "2026-05-05", "劳动节"],
    ["china", "2026-06-19", "端午节"], ["china", "2026-09-25", "中秋节"],
    ["china", "2026-10-01", "国庆节"], ["china", "2026-10-02", "国庆节"],
    ["china", "2026-10-05", "国庆节"], ["china", "2026-10-06", "国庆节"],
    ["china", "2026-10-07", "国庆节"],

    ["usa", "2026-01-01", "元旦"], ["usa", "2026-01-19", "马丁·路德·金纪念日"],
    ["usa", "2026-02-16", "华盛顿诞辰纪念日"], ["usa", "2026-04-03", "耶稣受难日"],
    ["usa", "2026-05-25", "阵亡将士纪念日"], ["usa", "2026-06-19", "六月节"],
    ["usa", "2026-07-03", "美国独立日补休"], ["usa", "2026-09-07", "劳动节"],
    ["usa", "2026-11-26", "感恩节"], ["usa", "2026-12-25", "圣诞节"],

    ["hong_kong", "2026-01-01", "元旦"], ["hong_kong", "2026-02-17", "农历新年"],
    ["hong_kong", "2026-02-18", "农历新年"], ["hong_kong", "2026-02-19", "农历新年"],
    ["hong_kong", "2026-04-03", "耶稣受难日"], ["hong_kong", "2026-04-06", "清明节翌日"],
    ["hong_kong", "2026-04-07", "复活节星期一翌日"], ["hong_kong", "2026-05-01", "劳动节"],
    ["hong_kong", "2026-05-25", "佛诞翌日"], ["hong_kong", "2026-06-19", "端午节"],
    ["hong_kong", "2026-07-01", "香港特别行政区成立纪念日"],
    ["hong_kong", "2026-10-01", "国庆日"], ["hong_kong", "2026-10-19", "重阳节翌日"],
    ["hong_kong", "2026-12-25", "圣诞节"],
    ["hong_kong", "2026-02-16", "农历新年前夕", "half-day"],
    ["hong_kong", "2026-12-24", "圣诞前夕", "half-day"],
    ["hong_kong", "2026-12-31", "新年前夕", "half-day"],

    ["japan", "2026-01-01", "元旦"], ["japan", "2026-01-02", "交易所假日"],
    ["japan", "2026-01-12", "成人之日"], ["japan", "2026-02-11", "建国纪念日"],
    ["japan", "2026-02-23", "天皇诞生日"], ["japan", "2026-03-20", "春分日"],
    ["japan", "2026-04-29", "昭和之日"], ["japan", "2026-05-04", "绿色之日"],
    ["japan", "2026-05-05", "儿童节"], ["japan", "2026-05-06", "宪法纪念日补休"],
    ["japan", "2026-07-20", "海之日"], ["japan", "2026-08-11", "山之日"],
    ["japan", "2026-09-21", "敬老日"], ["japan", "2026-09-22", "国民假日"],
    ["japan", "2026-09-23", "秋分日"], ["japan", "2026-10-12", "体育日"],
    ["japan", "2026-11-03", "文化日"], ["japan", "2026-11-23", "勤劳感谢日"],
    ["japan", "2026-12-31", "交易所假日"],

    ["korea", "2026-01-01", "元旦"], ["korea", "2026-02-16", "春节"],
    ["korea", "2026-02-17", "春节"], ["korea", "2026-02-18", "春节"],
    ["korea", "2026-03-02", "三一节补休"], ["korea", "2026-05-01", "劳动节"],
    ["korea", "2026-05-05", "儿童节"], ["korea", "2026-05-25", "佛诞补休"],
    ["korea", "2026-06-03", "全国地方选举日"], ["korea", "2026-07-17", "制宪节"],
    ["korea", "2026-08-17", "光复节补休"], ["korea", "2026-09-24", "中秋节"],
    ["korea", "2026-09-25", "中秋节"], ["korea", "2026-10-05", "开天节补休"],
    ["korea", "2026-10-09", "韩文日"], ["korea", "2026-12-25", "圣诞节"],
    ["korea", "2026-12-31", "年终休市"],
  ],
};

function marketHolidayEvents(year) {
  const today = dateOnly(shanghaiNow);
  return (marketHolidaysByYear[year] || []).map(([sourceKey, date, holiday, session = "closed"]) => {
    const source = marketHolidaySources[sourceKey];
    const completed = date < today;
    const halfDay = session === "half-day";
    const marketDescription = sourceKey === "japan"
      ? "JPX现金市场休市；部分衍生品可能另有假日交易安排，请查看JPX产品日历。"
      : `${source.market}${halfDay ? "半日交易，且当日为非交收日" : "全天休市"}。`;
    return {
      ...common,
      id: `market-holiday-${sourceKey}-${date}-${session}`,
      seriesKey: `market-holiday-${sourceKey}`,
      title: halfDay ? `${source.market}半日市：${holiday}` : `${source.market}休市：${holiday}`,
      category: "market_rule",
      countryOrRegion: source.countryOrRegion,
      publisher: source.publisher,
      scheduledDateTime: `${date}T09:00:00${source.offset}`,
      timezone: source.timezone,
      dateStatus: completed ? "completed" : "official_confirmed",
      importance: "medium",
      impactScope: [source.market, "跨市场流动性"],
      frequency: "年度交易所日历",
      usualReleasePattern: "交易所通常在上一年公布年度休市安排；临时调整以交易所最新公告为准。",
      sourceUrl: source.sourceUrl,
      sourceName: source.sourceName,
      description: marketDescription,
      outcomeSummary: completed ? `${date} ${marketDescription}` : "",
      tags: [source.market, halfDay ? "半日市" : "休市", holiday, "交易所日历"],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  });
}

function monthlyEvents(year, month) {
  const key = `${year}-${pad(month + 1)}`;
  const make = (event) => ({
    ...common,
    frequency: "月度",
    tags: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...event,
  });

  return [
    make({
      id: `cn-lpr-${key}`,
      seriesKey: "cn-lpr",
      title: `${month + 1}月LPR报价`,
      category: "central_bank",
      countryOrRegion: "中国",
      publisher: "全国银行间同业拆借中心",
      scheduledDateTime: localIso(nextWeekday(new Date(year, month, 20)), "09:00:00"),
      importance: "high",
      impactScope: ["利率债", "地产", "汇率"],
      usualReleasePattern: "原则上每月20日公布，遇节假日可能顺延或调整，以全国银行间同业拆借中心/中国人民银行公告为准。",
      sourceUrl: "https://www.chinamoney.com.cn/",
      sourceName: "全国银行间同业拆借中心",
      description: "贷款市场报价利率。当前日期仅按历史规则推算，等待官方确认。",
      tags: ["LPR", "贷款市场报价利率"],
    }),
    make({
      id: `cn-cpi-ppi-${key}`,
      seriesKey: "cn-cpi-ppi",
      title: `中国${month + 1}月CPI与PPI`,
      category: "macro",
      countryOrRegion: "中国",
      publisher: "国家统计局",
      scheduledDateTime: localIso(nextWeekday(new Date(year, month + 1, 9))),
      importance: "high",
      impactScope: ["全市场", "利率债", "消费"],
      usualReleasePattern: "通常于次月上中旬公布，具体日期以国家统计局发布日历为准。",
      sourceUrl: "https://www.stats.gov.cn/sj/fbrc/",
      sourceName: "国家统计局",
      description: "CPI与PPI月度数据。不得把历史规律当作固定发布日期。",
      tags: ["CPI", "PPI", "通胀"],
    }),
    make({
      id: `cn-official-pmi-${key}`,
      seriesKey: "cn-official-pmi",
      title: `中国${month + 1}月官方PMI`,
      category: "macro",
      countryOrRegion: "中国",
      publisher: "国家统计局 / 中国物流与采购联合会",
      scheduledDateTime: localIso(new Date(year, month + 1, 0)),
      importance: "high",
      impactScope: ["全市场", "周期", "汇率"],
      usualReleasePattern: "通常在月末公布，具体日期以国家统计局发布日历为准。",
      sourceUrl: "https://www.stats.gov.cn/sj/fbrc/",
      sourceName: "国家统计局",
      description: "制造业、非制造业及综合PMI。",
      tags: ["制造业PMI", "非制造业PMI"],
    }),
    make({
      id: `cn-credit-${key}`,
      seriesKey: "cn-credit",
      title: `中国${month + 1}月金融统计与社融`,
      category: "macro",
      countryOrRegion: "中国",
      publisher: "中国人民银行",
      scheduledDateTime: localIso(nextWeekday(new Date(year, month + 1, 12)), "17:00:00"),
      importance: "high",
      impactScope: ["利率债", "地产", "全市场"],
      usualReleasePattern: "通常在次月上中旬不定时发布，包含社融增量、M2和人民币贷款；无固定日期。",
      sourceUrl: "https://www.pbc.gov.cn/diaochatongjisi/116219/index.html",
      sourceName: "中国人民银行",
      description: "社会融资规模、货币供应量和人民币贷款。",
      tags: ["社融", "M2", "人民币贷款"],
    }),
    make({
      id: `cn-trade-${key}`,
      seriesKey: "cn-trade",
      title: `中国${month + 1}月进出口与贸易差额`,
      category: "macro",
      countryOrRegion: "中国",
      publisher: "海关总署",
      scheduledDateTime: localIso(nextWeekday(new Date(year, month + 1, 7)), "11:00:00"),
      importance: "high",
      impactScope: ["出口链", "汇率"],
      usualReleasePattern: "通常在次月上旬公布，具体日期以海关总署公告为准。",
      sourceUrl: "http://www.customs.gov.cn/customs/302249/zfxxgk/2799825/302274/302277/index.html",
      sourceName: "海关总署",
      description: "货物贸易进出口与贸易差额。",
      tags: ["进出口", "贸易差额"],
    }),
    make({
      id: `cn-activity-${key}`,
      seriesKey: "cn-activity",
      title: `中国${month + 1}月经济运行数据`,
      category: "macro",
      countryOrRegion: "中国",
      publisher: "国家统计局",
      scheduledDateTime: localIso(nextWeekday(new Date(year, month + 1, 15)), "10:00:00"),
      importance: "high",
      impactScope: ["全市场", "消费", "地产"],
      usualReleasePattern: "通常于次月中旬集中公布，1—2月合并发布，以官方发布日历为准。",
      sourceUrl: "https://www.stats.gov.cn/sj/fbrc/",
      sourceName: "国家统计局",
      description: "工业增加值、社零、固定资产投资、房地产开发投资和失业率等。",
      tags: ["工业增加值", "社零", "固投", "房地产", "失业率"],
    }),
    make({
      id: `us-nfp-${key}`,
      seriesKey: "us-nfp",
      title: `美国${month + 1}月非农就业与失业率`,
      category: "macro",
      countryOrRegion: "美国",
      publisher: "U.S. Bureau of Labor Statistics",
      scheduledDateTime: `${dateOnly(firstFriday(year, month + 1))}T08:30:00-04:00`,
      timezone: "America/New_York",
      importance: "high",
      impactScope: ["全市场", "利率债", "汇率"],
      usualReleasePattern: "通常于次月首个星期五公布，必须以BLS年度日历为准。",
      sourceUrl: "https://www.bls.gov/schedule/",
      sourceName: "BLS",
      description: "美国就业形势报告。",
      tags: ["非农", "失业率"],
    }),
    make({
      id: `us-cpi-${key}`,
      seriesKey: "us-cpi",
      title: `美国${month + 1}月CPI`,
      category: "macro",
      countryOrRegion: "美国",
      publisher: "U.S. Bureau of Labor Statistics",
      scheduledDateTime: `${dateOnly(nextWeekday(new Date(year, month + 1, 12)))}T08:30:00-04:00`,
      timezone: "America/New_York",
      importance: "high",
      impactScope: ["全市场", "利率债", "汇率", "科技"],
      usualReleasePattern: "通常于次月上中旬公布，必须以BLS年度日历为准。",
      sourceUrl: "https://www.bls.gov/schedule/",
      sourceName: "BLS",
      description: "美国消费者价格指数。",
      tags: ["美国CPI", "通胀"],
    }),
    make({
      id: `us-pce-${key}`,
      seriesKey: "us-pce",
      title: `美国${month + 1}月PCE物价指数`,
      category: "macro",
      countryOrRegion: "美国",
      publisher: "U.S. Bureau of Economic Analysis",
      scheduledDateTime: `${dateOnly(lastFriday(year, month + 1))}T08:30:00-04:00`,
      timezone: "America/New_York",
      importance: "high",
      impactScope: ["利率债", "汇率", "科技"],
      usualReleasePattern: "随个人收入与支出报告公布，必须以BEA日历为准。",
      sourceUrl: "https://www.bea.gov/news/schedule",
      sourceName: "BEA",
      description: "美联储重点关注的通胀指标。",
      tags: ["PCE", "通胀"],
    }),
    make({
      id: `cn-index-futures-expiry-${key}`,
      seriesKey: "cn-index-futures-expiry",
      title: `${month + 1}月A股股指期货交割日`,
      category: "market_rule",
      countryOrRegion: "中国",
      publisher: "中国金融期货交易所",
      scheduledDateTime: localIso(thirdFriday(year, month), "15:00:00"),
      importance: "medium",
      impactScope: ["全市场"],
      usualReleasePattern: "通常为合约到期月份第三个星期五，遇法定节假日顺延，以中金所规则为准。",
      sourceUrl: "https://www.cffex.com.cn/",
      sourceName: "中国金融期货交易所",
      description: "股指期货合约交割日。",
      tags: ["股指期货", "交割日"],
    }),
  ];
}

const existing = JSON.parse(fs.readFileSync(calendarPath, "utf8"));
const verifiedBackfill = fs.existsSync(verifiedBackfillPath)
  ? JSON.parse(fs.readFileSync(verifiedBackfillPath, "utf8"))
  : [];
const horizonMonths = mode === "weekly" ? 1 : 3;
const windowStart = new Date(shanghaiNow.getFullYear(), shanghaiNow.getMonth(), shanghaiNow.getDate());
const windowEnd = new Date(windowStart);
windowEnd.setMonth(windowEnd.getMonth() + horizonMonths);

const generated = [];
for (let offset = 0; offset <= horizonMonths; offset += 1) {
  const monthDate = new Date(windowStart.getFullYear(), windowStart.getMonth() + offset, 1);
  generated.push(...monthlyEvents(monthDate.getFullYear(), monthDate.getMonth()));
}
const officialMarketHolidays = [
  ...marketHolidayEvents(windowStart.getFullYear()),
  ...marketHolidayEvents(windowEnd.getFullYear()).filter(
    (event) => !event.id.includes(`-${windowStart.getFullYear()}-`),
  ),
];

const byId = new Map(existing.map((event) => [event.id, event]));
let added = 0;
let updated = 0;
function mergeCandidate(candidate) {
  const current = byId.get(candidate.id);
  if (!current) {
    byId.set(candidate.id, candidate);
    added += 1;
    return;
  }
  const becameCompleted =
    candidate.category === "market_rule" &&
    candidate.dateStatus === "completed" &&
    current.dateStatus === "official_confirmed";
  if (!["official_confirmed", "completed"].includes(current.dateStatus) || becameCompleted) {
    const merged = {
      ...candidate,
      ...current,
      dateStatus: becameCompleted ? "completed" : current.dateStatus,
      outcomeSummary: becameCompleted ? candidate.outcomeSummary : current.outcomeSummary,
      scheduledDateTime: candidate.scheduledDateTime,
      updatedAt: now.toISOString(),
    };
    if (JSON.stringify(merged) !== JSON.stringify(current)) updated += 1;
    byId.set(candidate.id, merged);
  }
}

for (const candidate of generated) {
  const eventDate = new Date(candidate.scheduledDateTime);
  if (eventDate < windowStart || eventDate > windowEnd) continue;
  mergeCandidate(candidate);
}
for (const candidate of officialMarketHolidays) {
  mergeCandidate(candidate);
}

const verifiedIds = new Set();
for (const record of verifiedBackfill) {
  if (verifiedIds.has(record.id)) throw new Error(`Duplicate verified backfill id: ${record.id}`);
  verifiedIds.add(record.id);
  if (record.dateStatus !== "completed") {
    throw new Error(`Verified backfill must be completed: ${record.id}`);
  }
  if (!["official", "authoritative_media"].includes(record.sourceLevel)) {
    throw new Error(`Verified backfill source is not allowed: ${record.id}`);
  }
  if (!record.sourceUrl || !record.sourceName) {
    throw new Error(`Verified backfill source is missing: ${record.id}`);
  }
  if (record.category === "macro" && !record.actualValue) {
    throw new Error(`Verified macro backfill missing actualValue: ${record.id}`);
  }
  const current = byId.get(record.id);
  if (!current) added += 1;
  else if (JSON.stringify(current) !== JSON.stringify(record)) updated += 1;
  byId.set(record.id, record);
}

const events = [...byId.values()].sort((a, b) => a.scheduledDateTime.localeCompare(b.scheduledDateTime));
const ids = new Set();
for (const event of events) {
  if (ids.has(event.id)) throw new Error(`Duplicate event id: ${event.id}`);
  ids.add(event.id);
  if (event.dateStatus === "completed" && event.category === "macro" && !event.actualValue) {
    throw new Error(`Completed macro event missing actualValue: ${event.id}`);
  }
  if (event.actualValue && event.dateStatus !== "completed") {
    throw new Error(`Actual value requires completed status: ${event.id}`);
  }
}

fs.writeFileSync(calendarPath, `${JSON.stringify(events, null, 2)}\n`);
fs.writeFileSync(statusPath, `${JSON.stringify({
  generatedAt: now.toISOString(),
  mode,
  eventCount: events.length,
  added,
  updated,
  windowStart: dateOnly(windowStart),
  windowEnd: dateOnly(windowEnd),
  verifiedBackfillCount: verifiedBackfill.length,
  message: `云端滚动日历更新成功；已合并 ${verifiedBackfill.length} 条已核验历史记录，预计事件仍等待官方确认。`,
}, null, 2)}\n`);

console.log(`Updated ${events.length} events: ${added} added, ${updated} refreshed.`);
