(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var PREFS = ["愛知県", "岐阜県", "三重県"];
  var STORE = "lpgasPrice";
  var data = null;

  // ---------- 計算（線形補間） ----------
  // 点：0m3=基本料金、5・10・20・50m3。50m3を超える分は 20〜50m3 の傾きで延ばす
  function estimate(p, m3) {
    var pts = [[0, p.base], [5, p.m5], [10, p.m10], [20, p.m20], [50, p.m50]];
    if (m3 > 50) {
      var slope = (p.m50 - p.m20) / 30;
      return p.m50 + (m3 - 50) * slope;
    }
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i];
      if (m3 <= b[0]) return a[1] + (m3 - a[0]) * (b[1] - a[1]) / (b[0] - a[0]);
    }
    return p.m50;
  }

  // ---------- 入力の読み取り（全角数字・カンマも受けつける） ----------
  function normalize(s) {
    return String(s)
      .replace(/[０-９．，]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
      .replace(/[,\s円]/g, "")
      .trim();
  }
  function readUsage() {
    var s = normalize($("usage").value);
    if (s === "") return { err: "使用量を入れてください。" };
    if (!/^\d+(\.\d)?$/.test(s)) return { err: "使用量は数字で、小数点第1位まで入れてください（例：13.4）。" };
    var v = Number(s);
    if (v <= 0) return { err: "使用量は0より大きい数を入れてください。" };
    if (v > 1000) return { err: "使用量が大きすぎます（1,000m3まで）。" };
    return { v: v };
  }
  function readBill() {
    var s = normalize($("bill").value);
    if (s === "") return { v: null };
    if (!/^\d+$/.test(s)) return { err: "請求額は円単位の数字で入れてください（例：9800）。" };
    var v = Number(s);
    if (v <= 0) return { err: "請求額は0より大きい数を入れてください。" };
    return { v: v };
  }

  var yen = function (n) { return Math.round(n).toLocaleString("ja-JP"); };
  var m3txt = function (v) { return v.toLocaleString("ja-JP", { maximumFractionDigits: 1 }); };

  function showError(msg, el) {
    $("error").textContent = msg;
    $("error").hidden = false;
    $("result").hidden = true;   // 前の結果が残って見えないように
    ["usage", "bill"].forEach(function (id) { $(id).classList.toggle("bad", el === id); });
    if (el) $(el).focus();
  }
  function clearError() {
    $("error").hidden = true;
    $("usage").classList.remove("bad");
    $("bill").classList.remove("bad");
  }

  // ---------- 計算して表示 ----------
  function calc() {
    if (!data) return;
    var u = readUsage();
    if (u.err) return showError(u.err, "usage");
    var b = readBill();
    if (b.err) return showError(b.err, "bill");
    clearError();

    var pref = $("pref").value;
    var avg = Math.round(estimate(data.prefectures[pref], u.v));

    $("r-label").textContent = pref + "・" + m3txt(u.v) + "m³ の平均的な料金の目安";
    $("r-price").textContent = yen(avg);
    $("r-sub").textContent = surveyText() + "／基本料金・消費税込み";

    if (b.v !== null) {
      var diff = b.v - avg;
      var pct = diff / avg * 100;
      var el = $("c-diff");
      el.className = "c-diff" + (diff > 0 ? " high" : diff < 0 ? " low" : "");
      var pctTxt = (pct > 0 ? "+" : pct < 0 ? "−" : "±") + Math.abs(pct).toFixed(1) + "%";
      if (diff === 0) {
        el.innerHTML = "平均と同じです（<span class=\"num\">±0</span>円・<span class=\"num\">" + pctTxt + "</span>）";
      } else {
        el.innerHTML = "平均より <span class=\"num\">" + yen(Math.abs(diff)) + "</span>円 " + (diff > 0 ? "高い" : "安い") +
          "（<span class=\"num\">" + pctTxt + "</span>）";
      }
      $("c-bill").textContent = yen(b.v) + "円";
      var max = Math.max(avg, b.v);
      $("bar-avg").style.width = "0";
      $("bar-you").style.width = "0";
      $("compare").hidden = false;
      requestAnimationFrame(function () {
        $("bar-avg").style.width = (avg / max * 100) + "%";
        $("bar-you").style.width = (b.v / max * 100) + "%";
      });
    } else {
      $("compare").hidden = true;
    }

    $("result").hidden = false;
    highlightRow();
    try { localStorage.setItem(STORE, JSON.stringify({ pref: pref })); } catch (e) {}
    $("result").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // ---------- データの表 ----------
  function surveyText() {
    return data.survey.year + "年" + data.survey.month + "月調査のデータ";
  }
  function drawTable() {
    var tb = $("tbody");
    tb.textContent = "";
    PREFS.forEach(function (pref) {
      var p = data.prefectures[pref];
      var tr = document.createElement("tr");
      tr.dataset.pref = pref;
      [pref, p.base, p.m5, p.m10, p.m20, p.m50].forEach(function (v, i) {
        var td = document.createElement("td");
        td.textContent = i === 0 ? v : yen(v);
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    highlightRow();
  }
  function highlightRow() {
    var pref = $("pref").value;
    Array.prototype.forEach.call($("tbody").children, function (tr) {
      tr.classList.toggle("on", tr.dataset.pref === pref);
    });
  }

  // ---------- はじめに ----------
  try {
    var saved = JSON.parse(localStorage.getItem(STORE) || "{}");
    if (saved && PREFS.indexOf(saved.pref) >= 0) $("pref").value = saved.pref;
  } catch (e) {}

  $("form").addEventListener("submit", function (e) { e.preventDefault(); calc(); });
  $("pref").addEventListener("change", function () {
    highlightRow();
    if (!$("result").hidden) calc();
  });
  $("calc").disabled = true;

  fetch("data.json", { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) {
      var ok = d && d.survey && PREFS.every(function (p) { return d.prefectures && d.prefectures[p]; });
      if (!ok) throw new Error("bad data");
      data = d;
      $("survey").textContent = surveyText() + "（" + (d.note || "基本料金・消費税込み、単位は円") + "）";
      $("survey-foot").textContent = d.survey.year + "年" + d.survey.month + "月調査";
      drawTable();
      $("calc").disabled = false;
    })
    .catch(function () {
      $("survey").textContent = "データを読み込めませんでした。ページを再読み込みしてください。";
      showError("データを読み込めなかったため、計算できません。少し時間をおいて再読み込みしてください。");
    });

  // テスト用に計算関数を外から呼べるようにしておく
  window.__lpgasEstimate = estimate;
})();
