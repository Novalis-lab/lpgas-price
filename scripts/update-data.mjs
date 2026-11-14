// 石油情報センターの「一般小売価格 LP（プロパン）ガス 確報」ページを読み込み、
// 愛知県・岐阜県・三重県の料金（基本料金・5・10・20・50m3）と調査月を取り出して data.json を更新する。
//
// ・読み込みに失敗したとき、数字が正しく取れなかったときは data.json を書き換えずに終了する（終了コード 1）
// ・取れた数字が今の data.json と同じときは何もしない
// ・実行には Node.js 18 以上が必要（GitHub Actions の ubuntu-latest には入っている）

import { readFile, writeFile } from "node:fs/promises";

const SOURCE_URL = "https://oil-info.ieej.or.jp/price/price_ippan_lp_gusu.html";
const DATA_FILE = new URL("../data.json", import.meta.url);
const PREFS = ["愛知県", "岐阜県", "三重県"];
const KEYS = ["base", "m5", "m10", "m20", "m50"];

function fail(message) {
  console.error("更新しませんでした: " + message);
  process.exit(1);
}

// HTML のタグを取り除いて、空白をそろえた文字列にする
function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/[ \t\r\n　]+/g, " ");
}

function toInt(s) {
  return Number(String(s).replace(/,/g, ""));
}

async function fetchPage() {
  let res;
  try {
    res = await fetch(SOURCE_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; lpgas-price-updater)" },
      signal: AbortSignal.timeout(30000),
    });
  } catch (e) {
    fail("ページを読み込めませんでした（" + e.message + "）");
  }
  if (!res.ok) fail("ページの読み込みでエラーが返りました（HTTP " + res.status + "）");
  return await res.text();
}

function parse(html) {
  const text = htmlToText(html);

  // 表の見出しに「単位:円」「2026年8月」「基本料金」「5m3」… と並んでいる
  const unitAt = text.search(/単位\s*[:：]\s*円/);
  if (unitAt < 0) fail("表の見出し（単位:円）が見つかりませんでした");
  const head = text.slice(unitAt, unitAt + 200);
  const m = head.match(/(\d{4})\s*年\s*(\d{1,2})\s*月/);
  if (!m) fail("調査月が見つかりませんでした");
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12) fail("調査月の値がおかしいです（" + m[0] + "）");
  if (!/基本料金/.test(head)) fail("表の見出し（基本料金）が見つかりませんでした");

  const num = "(\\d{1,3}(?:,\\d{3})*)";
  const prefectures = {};
  for (const pref of PREFS) {
    const re = new RegExp(pref + "\\s+" + Array(5).fill(num).join("\\s+") + "(?!\\d)", "g");
    const rows = [...text.matchAll(re)];
    if (rows.length !== 1) fail(pref + " の行が " + rows.length + " 件見つかりました（1件のはず）");
    const values = rows[0].slice(1, 6).map(toInt);

    // 数字のチェック：すべて整数で、使用量が増えるほど高くなっていて、ありえる範囲か
    if (values.some((v) => !Number.isInteger(v))) fail(pref + " の数字が読み取れませんでした");
    for (let i = 1; i < values.length; i++) {
      if (values[i] <= values[i - 1]) fail(pref + " の料金が使用量の順に増えていません（" + values.join(", ") + "）");
    }
    if (values[0] < 300 || values[0] > 10000) fail(pref + " の基本料金がありえない値です（" + values[0] + "円）");
    if (values[4] > 300000) fail(pref + " の50m3の料金がありえない値です（" + values[4] + "円）");

    prefectures[pref] = Object.fromEntries(KEYS.map((k, i) => [k, values[i]]));
  }
  return { survey: { year, month }, prefectures };
}

async function main() {
  let current;
  try {
    current = JSON.parse(await readFile(DATA_FILE, "utf8"));
  } catch (e) {
    fail("今の data.json を読めませんでした（" + e.message + "）");
  }

  const html = await fetchPage();
  const got = parse(html);

  console.log("取得した調査月: " + got.survey.year + "年" + got.survey.month + "月");
  for (const pref of PREFS) {
    const p = got.prefectures[pref];
    console.log("  " + pref + ": " + KEYS.map((k) => k + "=" + p[k]).join(" "));
  }

  // 古い調査月のデータで上書きしない
  const curKey = (current.survey?.year ?? 0) * 100 + (current.survey?.month ?? 0);
  const newKey = got.survey.year * 100 + got.survey.month;
  if (newKey < curKey) fail("取得した調査月が今のデータより古いです");

  const next = { ...current, survey: got.survey, prefectures: { ...current.prefectures } };
  for (const pref of PREFS) next.prefectures[pref] = got.prefectures[pref];

  // data.json と同じ書き方（1県1行）で書き出す
  const out = JSON.stringify(next, null, 2).replace(
    /\{\s+"base": (\d+),\s+"m5": (\d+),\s+"m10": (\d+),\s+"m20": (\d+),\s+"m50": (\d+)\s+\}/g,
    '{ "base": $1, "m5": $2, "m10": $3, "m20": $4, "m50": $5 }'
  ) + "\n";

  if (JSON.stringify(next) === JSON.stringify(current)) {
    console.log("数字は変わっていません。data.json はそのままです。");
    return;
  }
  await writeFile(DATA_FILE, out, "utf8");
  console.log("data.json を更新しました。");
}

main().catch((e) => fail(e.stack || String(e)));
