import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname);
const calendarPath = path.join(root, "calendar.json");
const statusPath = path.join(root, "status.json");
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
const horizonMonths = mode === "weekly" ? 1 : 3;
const windowStart = new Date(shanghaiNow.getFullYear(), shanghaiNow.getMonth(), shanghaiNow.getDate());
const windowEnd = new Date(windowStart);
windowEnd.setMonth(windowEnd.getMonth() + horizonMonths);

const generated = [];
for (let offset = 0; offset <= horizonMonths; offset += 1) {
  const monthDate = new Date(windowStart.getFullYear(), windowStart.getMonth() + offset, 1);
  generated.push(...monthlyEvents(monthDate.getFullYear(), monthDate.getMonth()));
}

const byId = new Map(existing.map((event) => [event.id, event]));
let added = 0;
let updated = 0;
for (const candidate of generated) {
  const eventDate = new Date(candidate.scheduledDateTime);
  if (eventDate < windowStart || eventDate > windowEnd) continue;
  const current = byId.get(candidate.id);
  if (!current) {
    byId.set(candidate.id, candidate);
    added += 1;
  } else if (!["official_confirmed", "completed"].includes(current.dateStatus)) {
    const merged = { ...candidate, ...current, scheduledDateTime: candidate.scheduledDateTime, updatedAt: now.toISOString() };
    if (JSON.stringify(merged) !== JSON.stringify(current)) updated += 1;
    byId.set(candidate.id, merged);
  }
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
  message: "云端滚动日历更新成功；预计事件仍等待官方确认。",
}, null, 2)}\n`);

console.log(`Updated ${events.length} events: ${added} added, ${updated} refreshed.`);
