/* ==========================================================
   노인 무임승차와 지하철 적자 실증 분석 — 차트 & 지도
   순수 SVG/JS, 외부 라이브러리 없음
   ========================================================== */
(function () {
  "use strict";

  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const C = () => ({
    s1: css("--s1"), s2: css("--s2"), s3: css("--s3"),
    ink: css("--ink"), ink2: css("--ink-2"), muted: css("--muted"),
    grid: css("--grid"), axis: css("--axis"), surface: css("--surface"),
    danger: css("--danger"), neutral: css("--neutral-fill"),
  });

  const NS = "http://www.w3.org/2000/svg";
  function el(tag, attrs, parent) {
    const node = document.createElementNS(NS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }
  function txt(parent, x, y, str, attrs) {
    const t = el("text", Object.assign({ x, y }, attrs || {}), parent);
    t.textContent = str;
    return t;
  }
  const fmt = (n, d) => n.toLocaleString("ko-KR", { maximumFractionDigits: d == null ? 1 : d, minimumFractionDigits: 0 });

  /* ---------- tooltip ---------- */
  const tip = document.getElementById("tip");
  function showTip(evt, title, rows) {
    tip.innerHTML = "";
    const t = document.createElement("div");
    t.className = "tp-t";
    t.textContent = title;
    tip.appendChild(t);
    (rows || []).forEach(([label, value, color]) => {
      const r = document.createElement("div");
      r.className = "tp-row";
      if (color) {
        const k = document.createElement("span");
        k.className = "k";
        k.style.background = color;
        r.appendChild(k);
      }
      const s = document.createElement("span");
      s.textContent = label;
      r.appendChild(s);
      const b = document.createElement("b");
      b.textContent = value;
      r.appendChild(b);
      tip.appendChild(r);
    });
    tip.style.display = "block";
    moveTip(evt);
  }
  function moveTip(evt) {
    const pad = 14;
    let x = evt.clientX + pad, y = evt.clientY + pad;
    const r = tip.getBoundingClientRect();
    if (x + r.width > innerWidth - 8) x = evt.clientX - r.width - pad;
    if (y + r.height > innerHeight - 8) y = evt.clientY - r.height - pad;
    tip.style.left = x + "px";
    tip.style.top = y + "px";
  }
  function hideTip() { tip.style.display = "none"; }

  /* rounded-top bar path (dir=1 grows up from baseline, dir=-1 grows down) */
  function barPath(x, base, w, h, r, dir) {
    r = Math.min(r, w / 2, Math.abs(h));
    if (h <= 0) return "";
    if (dir === 1) {
      const y = base - h;
      return `M${x},${base} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${base} Z`;
    }
    const y = base + h;
    return `M${x},${base} L${x},${y - r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y - r} L${x + w},${base} Z`;
  }

  function makeSvg(container, w, h) {
    const box = document.getElementById(container);
    box.innerHTML = "";
    const svg = el("svg", { viewBox: `0 0 ${w} ${h}`, role: "img" }, box);
    return svg;
  }

  function legend(id, items) {
    const box = document.getElementById(id);
    if (!box) return;
    box.innerHTML = "";
    items.forEach(([label, color, shape]) => {
      const li = document.createElement("span");
      li.className = "li";
      const sw = document.createElement("span");
      sw.className = shape === "line" ? "ln" : "sw";
      sw.style.background = color;
      li.appendChild(sw);
      li.appendChild(document.createTextNode(label));
      box.appendChild(li);
    });
  }

  function yGrid(svg, x0, x1, yScale, ticks, unit, col) {
    ticks.forEach((v) => {
      const y = yScale(v);
      el("line", { x1: x0, y1: y, x2: x1, y2: y, stroke: col.grid, "stroke-width": 1 }, svg);
      txt(svg, x0 - 8, y + 4, fmt(v, 1) + (unit || ""), { "text-anchor": "end", "font-size": 11, fill: col.muted });
    });
  }

  /* ==========================================================
     DATA
     ========================================================== */
  const YEARS = [2021, 2022, 2023, 2024];
  const yearlyTotal = [12.91, 14.17, 15.47, 15.96];     // 억 명
  const yearlyElder = [1.75, 1.97, 2.22, 2.33];
  const yearlyShare = [13.53, 13.88, 14.35, 14.57];      // %

  const hourBins = ["~06", "06–07", "07–08", "08–09", "09–10", "10–16", "17–20", "21~"];
  const hourWeekday = [30.4, 15.9, 7.0, 7.4, 15.9, 26.3, 7.8, 4.4];
  const hourWeekend = [32.6, 25.9, 18.6, 17.2, 19.9, 25.4, 8.8, 4.9];

  const ticketYears = [2019, 2020, 2021, 2022, 2023];
  const ticketData = {
    경로: [82.2, 81.8, 83.0, 84.5, 84.9],
    장애: [16.6, 17.1, 16.0, 14.5, 14.2],
    유공자: [1.2, 1.1, 1.0, 1.0, 0.9],
  };

  const popYears = [2019, 2020, 2021, 2022, 2023, 2024];
  const elderPop = [148, 157, 161, 167, 174, 182];       // 만 명
  const workerShare = [15.44, 17.55, 17.19, 17.84, 18.76, 20.08]; // %

  const lossElder = [2378, 2643, 3068, 3492];            // 억 원 (양수 크기)
  const netLoss = [9644, 6420, 5173, 7241];              // 억 원 (양수 크기)
  const contribution = [24.7, 41.2, 59.3, 48.2];         // %

  /* 상관계수 매트릭스: rows=독립변수, cols=[A승차, A하차, C승차, C하차] */
  const corrRows = ["노인인구수", "등록인구수", "사업시설관리 종사자", "기초연금 수급률"];
  const corrCols = ["A구간 승차\n(출발지)", "A구간 하차\n(목적지)", "C구간 승차\n(출발지)", "C구간 하차\n(목적지)"];
  const corrVals = [
    [0.634, 0.006, -0.033, -0.121],
    [0.575, 0.196, 0.060, -0.045],
    [-0.286, 0.745, 0.334, 0.299],
    [0.155, -0.744, -0.451, -0.390],
  ];
  const corrSig = [
    ["***", "", "", ""],
    ["**", "", "", ""],
    ["", "***", "", ""],
    ["", "***", "*", ""],
  ];

  /* C구간 TOP25 역 */
  const topStations = [
    [1, "제기동", "동대문구", 1519, 981, 64.6, 74.1, "①"],
    [2, "종로3가", "종로구", 2114, 877, 41.5, 74.8, "①"],
    [3, "청량리", "동대문구", 1592, 835, 52.5, 73.6, "①"],
    [4, "종로5가", "종로구", 1897, 774, 40.8, 77.9, "①"],
    [5, "회현(남대문시장)", "중구", 2180, 629, 28.9, 79.3, "①"],
    [6, "연신내", "은평구", 1663, 611, 36.7, 77.8, "②"],
    [7, "고속터미널", "서초구", 3651, 547, 15.0, 76.5, "③"],
    [8, "선릉", "강남구", 3079, 536, 17.4, 87.4, "④"],
    [9, "창동", "도봉구", 1476, 529, 35.8, 74.4, "②"],
    [10, "동묘앞", "종로구", 976, 506, 51.9, 58.2, "①"],
    [11, "사당", "동작구", 2085, 494, 23.7, 76.4, "③"],
    [12, "잠실(송파구청)", "송파구", 4662, 484, 10.4, 75.3, "③"],
    [13, "신도림", "구로구", 2558, 483, 18.9, 75.1, "③"],
    [14, "신림", "관악구", 2323, 468, 20.1, 77.2, "②"],
    [15, "교대(법원·검찰청)", "서초구", 2405, 461, 19.2, 86.9, "④"],
    [16, "서울역", "중구", 3019, 461, 15.3, 77.5, "③"],
    [17, "미아사거리", "강북구", 1389, 441, 31.7, 76.8, "②"],
    [18, "수유(강북구청)", "강북구", 1613, 437, 27.1, 77.6, "②"],
    [19, "동대문", "종로구", 1681, 428, 25.5, 80.5, "①"],
    [20, "서울대입구", "관악구", 2198, 425, 19.3, 79.7, "②"],
    [21, "불광", "은평구", 1047, 422, 40.3, 74.8, "②"],
    [22, "구로디지털단지", "구로구", 2585, 420, 16.2, 78.2, "④"],
    [23, "총신대입구(이수)", "동작구", 1175, 419, 35.7, 77.4, "②"],
    [24, "역삼", "강남구", 3450, 380, 11.0, 85.9, "④"],
    [25, "천호(풍납토성)", "강동구", 1190, 376, 31.6, 74.2, "②"],
  ];

  /* 자치구 마스터 데이터
     od: OD 유형, board/alight/net: A+B구간 승·하차·순승차(만), netRatio: 순승차비율 %
     fac: 사업시설관리 종사자(만), pop/eld: 전체·노인 인구(만)
     idx: 생계형 지수, grade: A/B/C, ab: A+B구간 하차비중 %
     dawn: 새벽(~09시) 노인 하차량(백만 명), facPct: 종사자 비중 %, elderRatio: 노인 승차 비율 % */
  const GU = {
    강남구: { od: "목적지형", board: 598, alight: 1208, net: -609.9, netRatio: 33.1, fac: 7.49, pop: 56.3, eld: 9.0, idx: 79.8, grade: "A", ab: 21.8, dawn: 12.1, facPct: 9.4, elderRatio: 14.6 },
    금천구: { od: "저활용형", board: 32, alight: 83, net: -51.1, netRatio: 27.7, fac: 2.53, pop: 23.9, eld: 4.7, idx: 69.1, grade: "A", ab: 27.5, dawn: 0.8, facPct: 9.8, elderRatio: 10.2 },
    영등포구: { od: "목적지형", board: 305, alight: 370, net: -65.0, netRatio: 45.2, fac: 7.07, pop: 39.7, eld: 6.8, idx: 64.3, grade: "A", ab: 16.9, dawn: 3.7, facPct: 17.1, elderRatio: 8.6 },
    서초구: { od: "목적지형", board: 386, alight: 769, net: -383.1, netRatio: 33.4, fac: 6.13, pop: 41.3, eld: 6.8, idx: 60.5, grade: "A", ab: 18.8, dawn: 7.7, facPct: 13.9, elderRatio: 13.1 },
    중구: { od: "목적지형", board: 420, alight: 1025, net: -605.7, netRatio: 29.0, fac: 3.87, pop: 13.1, eld: 2.6, idx: 45.7, grade: "A", ab: 17.4, dawn: 10.2, facPct: 8.6, elderRatio: 12.7 },
    마포구: { od: "혼재형", board: 525, alight: 487, net: 37.5, netRatio: 51.9, fac: 2.89, pop: 37.3, eld: 5.9, idx: 32.5, grade: "A", ab: 14.6, dawn: 4.9, facPct: 11.4, elderRatio: 9.7 },
    성동구: { od: "혼재형", board: 408, alight: 366, net: 42.8, netRatio: 52.8, fac: 1.63, pop: 28.1, eld: 5.1, idx: 29.9, grade: "A", ab: 16.5, dawn: 3.7, facPct: 8.7, elderRatio: 11.6 },
    용산구: { od: "저활용형", board: 170, alight: 210, net: -40.1, netRatio: 44.7, fac: 1.36, pop: 21.7, eld: 3.8, idx: 28.3, grade: "A", ab: 17.4, dawn: 2.1, facPct: 8.1, elderRatio: 12.1 },
    송파구: { od: "혼재형", board: 788, alight: 710, net: 78.6, netRatio: 52.6, fac: 2.46, pop: 65.6, eld: 11.3, idx: 27.3, grade: "A", ab: 14.1, dawn: 7.1, facPct: 6.2, elderRatio: 10.7 },
    구로구: { od: "출발지형", board: 536, alight: 318, net: 218.2, netRatio: 62.8, fac: 2.44, pop: 41.2, eld: 8.2, idx: 24.5, grade: "B", ab: 12.5, dawn: 3.2, facPct: 11.6, elderRatio: 8.4 },
    종로구: { od: "목적지형", board: 320, alight: 874, net: -554.5, netRatio: 26.8, fac: 1.96, pop: 15.0, eld: 2.9, idx: 23.9, grade: "B", ab: 13.1, dawn: 8.7, facPct: 6.9, elderRatio: 17.2 },
    강서구: { od: "출발지형", board: 580, alight: 310, net: 270.5, netRatio: 65.2, fac: 2.34, pop: 56.2, eld: 10.7, idx: 22.0, grade: "B", ab: 11.4, dawn: 3.1, facPct: 8.5, elderRatio: 10.9 },
    강동구: { od: "출발지형", board: 734, alight: 453, net: 280.4, netRatio: 61.8, fac: 1.28, pop: 48.1, eld: 8.9, idx: 15.7, grade: "B", ab: 11.8, dawn: 4.5, facPct: 9.6, elderRatio: 12.2 },
    서대문구: { od: "저활용형", board: 315, alight: 281, net: 34.2, netRatio: 52.9, fac: 0.56, pop: 31.9, eld: 5.9, idx: 15.7, grade: "B", ab: 13.5, dawn: 2.8, facPct: 4.2, elderRatio: 12.3 },
    광진구: { od: "출발지형", board: 585, alight: 413, net: 171.9, netRatio: 58.6, fac: 0.95, pop: 34.9, eld: 5.9, idx: 15.1, grade: "B", ab: 13.5, dawn: 4.1, facPct: 7.1, elderRatio: 9.4 },
    성북구: { od: "출발지형", board: 429, alight: 257, net: 171.3, netRatio: 62.5, fac: 0.67, pop: 43.5, eld: 8.3, idx: 13.4, grade: "B", ab: 12.2, dawn: 2.6, facPct: 6.0, elderRatio: 10.8 },
    양천구: { od: "저활용형", board: 309, alight: 149, net: 159.8, netRatio: 67.5, fac: 0.65, pop: 43.4, eld: 8.0, idx: 10.6, grade: "B", ab: 10.9, dawn: 1.5, facPct: 5.2, elderRatio: 10.0 },
    노원구: { od: "출발지형", board: 855, alight: 460, net: 394.8, netRatio: 65.0, fac: 0.68, pop: 49.7, eld: 10.0, idx: 9.0, grade: "C", ab: 11.1, dawn: 4.6, facPct: 4.8, elderRatio: 10.8 },
    동작구: { od: "출발지형", board: 758, alight: 459, net: 298.4, netRatio: 62.3, fac: 0.64, pop: 38.7, eld: 7.2, idx: 7.8, grade: "C", ab: 11.0, dawn: 4.6, facPct: 6.2, elderRatio: 10.7 },
    중랑구: { od: "저활용형", board: 435, alight: 207, net: 228.7, netRatio: 67.8, fac: 0.44, pop: 38.5, eld: 8.3, idx: 7.2, grade: "C", ab: 11.0, dawn: 2.1, facPct: 3.6, elderRatio: 10.7 },
    동대문구: { od: "혼재형", board: 344, alight: 368, net: -24.7, netRatio: 48.3, fac: 0.94, pop: 35.9, eld: 6.9, idx: 6.9, grade: "C", ab: 10.2, dawn: 3.7, facPct: 6.4, elderRatio: 12.3 },
    관악구: { od: "출발지형", board: 547, alight: 233, net: 314.3, netRatio: 70.2, fac: 0.67, pop: 49.6, eld: 8.8, idx: 6.2, grade: "C", ab: 9.5, dawn: 2.3, facPct: 5.2, elderRatio: 8.1 },
    은평구: { od: "출발지형", board: 833, alight: 359, net: 474.0, netRatio: 69.9, fac: 0.27, pop: 46.5, eld: 9.7, idx: 2.4, grade: "C", ab: 9.0, dawn: 3.6, facPct: 2.4, elderRatio: 11.8 },
    도봉구: { od: "저활용형", board: 350, alight: 166, net: 183.4, netRatio: 67.8, fac: 0.38, pop: 30.6, eld: 7.4, idx: 1.9, grade: "C", ab: 9.5, dawn: 1.7, facPct: 6.0, elderRatio: 11.2 },
    강북구: { od: "저활용형", board: 378, alight: 174, net: 203.4, netRatio: 68.4, fac: 0.38, pop: 28.9, eld: 7.1, idx: 1.7, grade: "C", ab: 9.3, dawn: 1.7, facPct: 4.0, elderRatio: 12.0 },
  };

  /* ==========================================================
     CHARTS — 기초 현황
     ========================================================== */
  function chartYearlyBars() {
    const col = C();
    const W = 480, H = 300, mL = 44, mR = 10, mT = 26, mB = 34;
    const svg = makeSvg("chYearlyBars", W, H);
    const plotW = W - mL - mR, plotH = H - mT - mB;
    const yMax = 18;
    const yS = (v) => mT + plotH - (v / yMax) * plotH;
    yGrid(svg, mL, W - mR, yS, [0, 5, 10, 15], "", col);
    el("line", { x1: mL, y1: yS(0), x2: W - mR, y2: yS(0), stroke: col.axis, "stroke-width": 1 }, svg);
    const groupW = plotW / YEARS.length;
    const barW = 22, gap = 2;
    YEARS.forEach((yr, i) => {
      const cx = mL + groupW * i + groupW / 2;
      const x1 = cx - barW - gap / 2, x2 = cx + gap / 2;
      const series = [
        ["전체 승차", yearlyTotal[i], col.s1, x1],
        ["노인 승차", yearlyElder[i], col.s2, x2],
      ];
      series.forEach(([name, v, color, x]) => {
        const p = el("path", { d: barPath(x, yS(0), barW, yS(0) - yS(v), 4, 1), fill: color }, svg);
        txt(svg, x + barW / 2, yS(v) - 6, fmt(v, 1), { "text-anchor": "middle", "font-size": 11, fill: col.ink2 });
        p.style.cursor = "pointer";
        p.addEventListener("pointermove", (e) => showTip(e, yr + "년", [
          ["전체 승차", fmt(yearlyTotal[i], 2) + "억 명", col.s1],
          ["노인 승차", fmt(yearlyElder[i], 2) + "억 명", col.s2],
          ["노인 비중", yearlyShare[i] + "%", null],
        ]));
        p.addEventListener("pointerleave", hideTip);
      });
      txt(svg, cx, H - 12, yr, { "text-anchor": "middle", "font-size": 12, fill: col.ink2 });
    });
    txt(svg, mL, 14, "승차 인원 (억 명)", { "font-size": 11.5, fill: col.muted });
  }

  function chartYearlyShare() {
    const col = C();
    const W = 480, H = 300, mL = 48, mR = 20, mT = 26, mB = 34;
    const svg = makeSvg("chYearlyShare", W, H);
    const plotW = W - mL - mR, plotH = H - mT - mB;
    const yMin = 13, yMax = 15;
    const yS = (v) => mT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
    const xS = (i) => mL + (plotW / (YEARS.length - 1)) * i;
    yGrid(svg, mL, W - mR, yS, [13, 13.5, 14, 14.5, 15], "%", col);
    const d = yearlyShare.map((v, i) => (i ? "L" : "M") + xS(i) + "," + yS(v)).join(" ");
    el("path", { d, fill: "none", stroke: col.s2, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);
    yearlyShare.forEach((v, i) => {
      const c = el("circle", { cx: xS(i), cy: yS(v), r: 4.5, fill: col.s2, stroke: col.surface, "stroke-width": 2 }, svg);
      txt(svg, xS(i), yS(v) - 11, v + "%", { "text-anchor": "middle", "font-size": 11, fill: col.ink2 });
      txt(svg, xS(i), H - 12, YEARS[i], { "text-anchor": "middle", "font-size": 12, fill: col.ink2 });
      const hit = el("circle", { cx: xS(i), cy: yS(v), r: 16, fill: "transparent" }, svg);
      hit.addEventListener("pointermove", (e) => showTip(e, YEARS[i] + "년", [["노인 승차 비중", v + "%", col.s2]]));
      hit.addEventListener("pointerleave", hideTip);
    });
    txt(svg, mL, 14, "노인 승차 비중 (%)", { "font-size": 11.5, fill: col.muted });
  }

  function chartHourly() {
    const col = C();
    const W = 980, H = 320, mL = 42, mR = 12, mT = 26, mB = 36;
    const svg = makeSvg("chHourly", W, H);
    const plotW = W - mL - mR, plotH = H - mT - mB;
    const yMax = 36;
    const yS = (v) => mT + plotH - (v / yMax) * plotH;
    yGrid(svg, mL, W - mR, yS, [0, 10, 20, 30], "%", col);
    el("line", { x1: mL, y1: yS(0), x2: W - mR, y2: yS(0), stroke: col.axis, "stroke-width": 1 }, svg);
    const groupW = plotW / hourBins.length;
    const barW = Math.min(24, groupW / 2 - 8), gap = 2;
    hourBins.forEach((bin, i) => {
      const cx = mL + groupW * i + groupW / 2;
      const x1 = cx - barW - gap / 2, x2 = cx + gap / 2;
      [[hourWeekday[i], col.s1, x1, "평일"], [hourWeekend[i], col.s2, x2, "주말"]].forEach(([v, color, x]) => {
        const p = el("path", { d: barPath(x, yS(0), barW, yS(0) - yS(v), 4, 1), fill: color }, svg);
        p.style.cursor = "pointer";
        p.addEventListener("pointermove", (e) => showTip(e, bin + "시", [
          ["평일 노인 비중", hourWeekday[i] + "%", col.s1],
          ["주말 노인 비중", hourWeekend[i] + "%", col.s2],
        ]));
        p.addEventListener("pointerleave", hideTip);
      });
      if (i === 0 || i === 5) {
        txt(svg, x1 + barW / 2, yS(hourWeekday[i]) - 6, hourWeekday[i] + "%", { "text-anchor": "middle", "font-size": 11, fill: col.ink2 });
      }
      txt(svg, cx, H - 14, bin, { "text-anchor": "middle", "font-size": 11.5, fill: col.ink2 });
    });
    txt(svg, mL, 14, "노인 승차 비중 (%)", { "font-size": 11.5, fill: col.muted });
  }

  function chartTicket() {
    const col = C();
    const W = 480, H = 300, mL = 42, mR = 10, mT = 24, mB = 34;
    const svg = makeSvg("chTicket", W, H);
    const plotW = W - mL - mR, plotH = H - mT - mB;
    const yS = (v) => mT + plotH - (v / 100) * plotH;
    yGrid(svg, mL, W - mR, yS, [0, 25, 50, 75, 100], "%", col);
    const groupW = plotW / ticketYears.length;
    const barW = 24, gapPx = 2;
    const keys = ["경로", "장애", "유공자"];
    const colors = { 경로: col.s1, 장애: col.s2, 유공자: col.s3 };
    ticketYears.forEach((yr, i) => {
      const x = mL + groupW * i + groupW / 2 - barW / 2;
      let acc = 0;
      keys.forEach((k, ki) => {
        const v = ticketData[k][i];
        const y0 = yS(acc), y1 = yS(acc + v);
        const hPix = Math.max(0, y0 - y1 - (ki < keys.length - 1 ? gapPx : 0));
        const isTop = ki === keys.length - 1;
        const d = isTop
          ? barPath(x, y0, barW, y0 - y1, 4, 1)
          : `M${x},${y0} L${x},${y0 - hPix} L${x + barW},${y0 - hPix} L${x + barW},${y0} Z`;
        const p = el("path", { d, fill: colors[k] }, svg);
        p.style.cursor = "pointer";
        p.addEventListener("pointermove", (e) => showTip(e, yr + "년 우대권 구성", keys.map((kk) => [kk, ticketData[kk][i] + "%", colors[kk]])));
        p.addEventListener("pointerleave", hideTip);
        if (k === "경로") {
          txt(svg, x + barW / 2, (y0 + y1) / 2 + 3, Math.round(v) + "%", { "text-anchor": "middle", "font-size": 9, fill: "#ffffff", "font-weight": 700 });
        }
        acc += v;
      });
      txt(svg, x + barW / 2, H - 12, yr, { "text-anchor": "middle", "font-size": 12, fill: col.ink2 });
    });
  }

  function chartPop() {
    const col = C();
    const W = 460, H = 260, mL = 42, mR = 8, mT = 24, mB = 32;
    const svg = makeSvg("chPop", W, H);
    const plotW = W - mL - mR, plotH = H - mT - mB;
    const yMax = 200;
    const yS = (v) => mT + plotH - (v / yMax) * plotH;
    yGrid(svg, mL, W - mR, yS, [0, 50, 100, 150, 200], "", col);
    const groupW = plotW / popYears.length;
    const barW = Math.min(24, groupW - 14);
    popYears.forEach((yr, i) => {
      const x = mL + groupW * i + groupW / 2 - barW / 2;
      const p = el("path", { d: barPath(x, yS(0), barW, yS(0) - yS(elderPop[i]), 4, 1), fill: col.s1 }, svg);
      p.style.cursor = "pointer";
      p.addEventListener("pointermove", (e) => showTip(e, yr + "년", [["65세 이상 인구", fmt(elderPop[i], 0) + "만 명", col.s1]]));
      p.addEventListener("pointerleave", hideTip);
      txt(svg, x + barW / 2, yS(elderPop[i]) - 6, elderPop[i], { "text-anchor": "middle", "font-size": 10.5, fill: col.ink2 });
      txt(svg, x + barW / 2, H - 11, yr, { "text-anchor": "middle", "font-size": 11, fill: col.ink2 });
    });
    txt(svg, mL, 13, "65세 이상 인구 (만 명)", { "font-size": 11, fill: col.muted });
  }

  function chartWorker() {
    const col = C();
    const W = 460, H = 260, mL = 44, mR = 16, mT = 24, mB = 32;
    const svg = makeSvg("chWorker", W, H);
    const plotW = W - mL - mR, plotH = H - mT - mB;
    const yMin = 14, yMax = 21;
    const yS = (v) => mT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
    const xS = (i) => mL + (plotW / (popYears.length - 1)) * i;
    yGrid(svg, mL, W - mR, yS, [14, 16, 18, 20], "%", col);
    const d = workerShare.map((v, i) => (i ? "L" : "M") + xS(i) + "," + yS(v)).join(" ");
    el("path", { d, fill: "none", stroke: col.s2, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);
    workerShare.forEach((v, i) => {
      el("circle", { cx: xS(i), cy: yS(v), r: 4, fill: col.s2, stroke: col.surface, "stroke-width": 2 }, svg);
      if (i === 0 || i === popYears.length - 1)
        txt(svg, xS(i), yS(v) - 10, v + "%", { "text-anchor": "middle", "font-size": 10.5, fill: col.ink2 });
      txt(svg, xS(i), H - 11, popYears[i], { "text-anchor": "middle", "font-size": 11, fill: col.ink2 });
      const hit = el("circle", { cx: xS(i), cy: yS(v), r: 15, fill: "transparent" }, svg);
      hit.addEventListener("pointermove", (e) => showTip(e, popYears[i] + "년", [["55세 이상 근로자 비중", v + "%", col.s2]]));
      hit.addEventListener("pointerleave", hideTip);
    });
    txt(svg, mL, 13, "55세 이상 근로자 비중 (%)", { "font-size": 11, fill: col.muted });
  }

  /* ==========================================================
     CHARTS — 가설 1
     ========================================================== */
  function chartLoss() {
    const col = C();
    const W = 980, H = 340, mL = 52, mR = 12, mT = 40, mB = 36;
    const svg = makeSvg("chLoss", W, H);
    const plotW = W - mL - mR, plotH = H - mT - mB;
    const yMax = 10000;
    const yS = (v) => mT + (v / yMax) * plotH; // downward
    [0, 2500, 5000, 7500, 10000].forEach((v) => {
      const y = yS(v);
      el("line", { x1: mL, y1: y, x2: W - mR, y2: y, stroke: col.grid, "stroke-width": 1 }, svg);
      txt(svg, mL - 8, y + 4, v === 0 ? "0" : "−" + fmt(v, 0), { "text-anchor": "end", "font-size": 11, fill: col.muted });
    });
    el("line", { x1: mL, y1: yS(0), x2: W - mR, y2: yS(0), stroke: col.axis, "stroke-width": 1 }, svg);
    const groupW = plotW / YEARS.length;
    const barW = 24, gap = 2;
    YEARS.forEach((yr, i) => {
      const cx = mL + groupW * i + groupW / 2;
      const x1 = cx - barW - gap / 2, x2 = cx + gap / 2;
      [[netLoss[i], col.s1, x1, "당기순손실"], [lossElder[i], col.s2, x2, "노인 무임 추정 손실"]].forEach(([v, color, x, name]) => {
        const p = el("path", { d: barPath(x, yS(0), barW, yS(v) - yS(0), 4, -1), fill: color }, svg);
        txt(svg, x + barW / 2, yS(v) + 15, "−" + fmt(v, 0), { "text-anchor": "middle", "font-size": 10.5, fill: col.ink2 });
        p.style.cursor = "pointer";
        p.addEventListener("pointermove", (e) => showTip(e, yr + "년", [
          ["당기순손실", "−" + fmt(netLoss[i], 0) + "억 원", col.s1],
          ["노인 무임 추정 손실", "−" + fmt(lossElder[i], 0) + "억 원", col.s2],
          ["적자 기여도", contribution[i] + "%", null],
        ]));
        p.addEventListener("pointerleave", hideTip);
      });
      txt(svg, cx, 20, "기여도 " + contribution[i] + "%", { "text-anchor": "middle", "font-size": 11.5, fill: col.ink2, "font-weight": 700 });
      txt(svg, cx, H - 12, yr, { "text-anchor": "middle", "font-size": 12, fill: col.ink2 });
    });
    txt(svg, mL, H - 12, "", {});
  }

  /* 시나리오 시뮬레이터 */
  let scnRate = 0;
  function chartScenario() {
    const col = C();
    const W = 980, H = 320, mL = 52, mR = 12, mT = 24, mB = 36;
    const svg = makeSvg("chScenario", W, H);
    const plotW = W - mL - mR, plotH = H - mT - mB;
    const yMax = 10000;
    const yS = (v) => mT + (v / yMax) * plotH;
    [0, 2500, 5000, 7500, 10000].forEach((v) => {
      const y = yS(v);
      el("line", { x1: mL, y1: y, x2: W - mR, y2: y, stroke: col.grid, "stroke-width": 1 }, svg);
      txt(svg, mL - 8, y + 4, v === 0 ? "0 (흑자선)" : "−" + fmt(v, 0), { "text-anchor": "end", "font-size": 11, fill: col.muted });
    });
    el("line", { x1: mL, y1: yS(0), x2: W - mR, y2: yS(0), stroke: col.axis, "stroke-width": 1.5 }, svg);
    const groupW = plotW / YEARS.length;
    const barW = 34;
    YEARS.forEach((yr, i) => {
      const x = mL + groupW * i + groupW / 2 - barW / 2;
      const orig = netLoss[i];
      const adj = netLoss[i] - lossElder[i] * (scnRate / 100);
      /* track = 현행 적자(연한 단계), fill = 조정 적자 */
      el("path", { d: barPath(x, yS(0), barW, yS(orig) - yS(0), 4, -1), fill: css("--seq-100") }, svg);
      const p = el("path", { d: barPath(x, yS(0), barW, yS(adj) - yS(0), 4, -1), fill: css("--seq-450") || col.s1 }, svg);
      p.setAttribute("fill", col.s1);
      txt(svg, x + barW / 2, yS(adj) + 16, "−" + fmt(Math.round(adj), 0), { "text-anchor": "middle", "font-size": 11, fill: col.ink2, "font-weight": 700 });
      const saved = Math.round(lossElder[i] * (scnRate / 100));
      p.style.cursor = "pointer";
      const hit = el("rect", { x: x - 8, y: mT, width: barW + 16, height: plotH, fill: "transparent" }, svg);
      hit.addEventListener("pointermove", (e) => showTip(e, yr + "년 · 무임손실 " + scnRate + "% 감소 시", [
        ["현행 당기순손실", "−" + fmt(orig, 0) + "억 원", css("--seq-100")],
        ["조정 당기순손실", "−" + fmt(Math.round(adj), 0) + "억 원", col.s1],
        ["개선 폭", "+" + fmt(saved, 0) + "억 원", null],
      ]));
      hit.addEventListener("pointerleave", hideTip);
      txt(svg, x + barW / 2, H - 12, yr, { "text-anchor": "middle", "font-size": 12, fill: col.ink2 });
    });
    const desc = document.getElementById("scnDesc");
    const names = { 0: "현행 유지 — 변화 없음 (기준값)", 30: "시나리오 A — 일부 고령층 부분 부담 또는 보조금 확대", 50: "시나리오 B — 절반 요금 부과 또는 운행 합리화", 70: "시나리오 C — 대폭 개선, 선별적 무임 축소", 100: "시나리오 D — 노인 무임승차 완전 폐지 (이론적 최대치)" };
    const totalSaved = Math.round(lossElder.reduce((a, b) => a + b, 0) * (scnRate / 100));
    desc.textContent = names[scnRate] + " · 4개년 누적 개선 폭 " + fmt(totalSaved, 0) + "억 원 — 그래도 모든 해가 0(흑자선) 아래에 머뭅니다.";
  }
  document.getElementById("scnSeg").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    document.querySelectorAll("#scnSeg button").forEach((x) => x.classList.remove("on"));
    b.classList.add("on");
    scnRate = +b.dataset.r;
    chartScenario();
  });

  /* ==========================================================
     CHARTS — 가설 2
     ========================================================== */
  function corrColor(r) {
    /* diverging: 양수 → blue, 음수 → red, 0 근처 → neutral gray */
    const light = !matchMedia("(prefers-color-scheme: dark)").matches;
    const mid = light ? [240, 239, 236] : [56, 56, 53];
    const blue = light ? [13, 54, 107] : [57, 135, 229];
    const red = light ? [160, 35, 35] : [230, 103, 103];
    const t = Math.min(1, Math.abs(r) / 0.8);
    const target = r >= 0 ? blue : red;
    const c = mid.map((m, i) => Math.round(m + (target[i] - m) * t));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }
  function chartCorr() {
    const col = C();
    const W = 980, H = 330, mL = 190, mT = 56, mR = 16, mB = 14;
    const svg = makeSvg("chCorr", W, H);
    const cw = (W - mL - mR) / 4, chH = (H - mT - mB) / 4;
    corrCols.forEach((c, j) => {
      const lines = c.split("\n");
      lines.forEach((ln, k) => {
        txt(svg, mL + cw * j + cw / 2, 22 + k * 15, ln, { "text-anchor": "middle", "font-size": 11.5, fill: col.ink2, "font-weight": k === 0 ? 700 : 400 });
      });
    });
    corrRows.forEach((rname, i) => {
      txt(svg, mL - 12, mT + chH * i + chH / 2 + 4, rname, { "text-anchor": "end", "font-size": 12.5, fill: col.ink2, "font-weight": 650 });
      corrCols.forEach((_, j) => {
        const r = corrVals[i][j], sig = corrSig[i][j];
        const x = mL + cw * j + 1, y = mT + chH * i + 1;
        const bg = corrColor(r);
        const rect = el("rect", { x, y, width: cw - 2, height: chH - 2, rx: 8, fill: bg }, svg);
        /* 셀 내부 라벨: 배경 명도에 따라 잉크 선택 */
        const strongBg = Math.abs(r) > 0.4;
        const light = !matchMedia("(prefers-color-scheme: dark)").matches;
        const inkIn = strongBg ? (light ? "#ffffff" : "#0b0b0b") : col.ink;
        txt(svg, x + (cw - 2) / 2, y + chH / 2 + 1, (r > 0 ? "+" : "") + r.toFixed(3), { "text-anchor": "middle", "font-size": 13.5, fill: inkIn, "font-weight": 750 });
        if (sig) txt(svg, x + (cw - 2) / 2, y + chH / 2 + 17, sig, { "text-anchor": "middle", "font-size": 11, fill: inkIn });
        rect.style.cursor = "pointer";
        rect.addEventListener("pointermove", (e) => showTip(e, rname + " → " + corrCols[j].replace("\n", " "), [
          ["피어슨 r", (r > 0 ? "+" : "") + r.toFixed(3), bg],
          ["유의성", sig ? sig + (sig === "***" ? " (p<0.001)" : sig === "**" ? " (p<0.01)" : " (p<0.05)") : "비유의 (p≥0.05)", null],
        ]));
        rect.addEventListener("pointerleave", hideTip);
      });
    });
  }

  function buildTopStations() {
    const table = document.getElementById("topStations");
    table.innerHTML = "";
    const thead = document.createElement("thead");
    thead.innerHTML = "<tr><th>#</th><th>역명</th><th>자치구</th><th class='num'>전체 하차(만)</th><th class='num'>노인 하차(만)</th><th class='num'>노인 비중</th><th class='num'>평일 비중</th><th>유형</th></tr>";
    table.appendChild(thead);
    const tb = document.createElement("tbody");
    const typeClass = { "①": "b1", "②": "b3", "③": "bn", "④": "b2" };
    const typeName = { "①": "① 여가·복지", "②": "② 생활권 거점", "③": "③ 환승 허브", "④": "④ 업무지구" };
    topStations.forEach((s) => {
      const tr = document.createElement("tr");
      const cells = [s[0], s[1], s[2], fmt(s[3], 0), fmt(s[4], 0), s[5] + "%", s[6] + "%"];
      cells.forEach((c, i) => {
        const td = document.createElement("td");
        td.textContent = c;
        if (i >= 3) td.className = "num";
        tr.appendChild(td);
      });
      const td = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = "badge " + typeClass[s[7]];
      badge.textContent = typeName[s[7]];
      td.appendChild(badge);
      tr.appendChild(td);
      tb.appendChild(tr);
    });
    table.appendChild(tb);
  }

  function chartIndex() {
    const col = C();
    const entries = Object.entries(GU).sort((a, b) => b[1].idx - a[1].idx);
    const rowH = 24, mL = 84, mR = 60, mT = 8, mB = 8;
    const W = 980, H = mT + mB + entries.length * rowH;
    const svg = makeSvg("chIndex", W, H);
    const plotW = W - mL - mR;
    const xS = (v) => mL + (v / 80) * plotW;
    [0, 20, 40, 60, 80].forEach((v) => {
      el("line", { x1: xS(v), y1: mT, x2: xS(v), y2: H - mB, stroke: col.grid, "stroke-width": 1 }, svg);
      txt(svg, xS(v), H - mB + 0, "", {});
    });
    const gradeColor = { A: col.s1, B: col.s2, C: col.s3 };
    entries.forEach(([name, d], i) => {
      const y = mT + i * rowH + 3;
      const h = rowH - 8;
      txt(svg, mL - 8, y + h / 2 + 4, name, { "text-anchor": "end", "font-size": 12, fill: col.ink, "font-weight": 650 });
      const wdt = Math.max(2, xS(d.idx) - mL);
      const p = el("path", {
        d: `M${mL},${y} L${mL + wdt - 4},${y} Q${mL + wdt},${y} ${mL + wdt},${y + 4} L${mL + wdt},${y + h - 4} Q${mL + wdt},${y + h} ${mL + wdt - 4},${y + h} L${mL},${y + h} Z`,
        fill: gradeColor[d.grade],
      }, svg);
      txt(svg, mL + wdt + 7, y + h / 2 + 4, d.idx.toFixed(1), { "font-size": 11.5, fill: col.ink2, "font-variant-numeric": "tabular-nums" });
      const hit = el("rect", { x: 0, y: y - 2, width: W, height: rowH, fill: "transparent" }, svg);
      hit.style.cursor = "pointer";
      hit.addEventListener("pointermove", (e) => showTip(e, name + " — " + d.grade + "등급", [
        ["생계형 지수", d.idx.toFixed(1), gradeColor[d.grade]],
        ["사업시설관리 종사자", d.fac + "만 명", null],
        ["A+B구간 하차비중", d.ab + "%", null],
        ["OD 유형", d.od, null],
      ]));
      hit.addEventListener("pointerleave", hideTip);
    });
  }

  /* ==========================================================
     MAP
     ========================================================== */
  const mapMetrics = {
    od: {
      title: "OD 유형 (평일 ~09시 순승차 기준)",
      type: "cat",
      value: (d) => d.od,
      cats: [
        ["출발지형", () => C().s1, "주거 밀집 — 승차가 하차를 구조적으로 초과"],
        ["목적지형", () => C().s2, "업무지구 — 새벽 하차 집중, 종사자 밀집"],
        ["혼재형", () => C().s3, "주거·업무 기능 공존"],
        ["저활용형", () => C().neutral, "이용량 하위 25%"],
      ],
      fmt: (d) => d.od,
    },
    grade: {
      title: "생계형 복합판정지수 — 등급",
      type: "cat",
      value: (d) => d.grade,
      cats: [
        ["A", () => C().s1, "생계형 — 상위 ⅓ (지수 ≥ 28.5)"],
        ["B", () => C().s2, "혼재형 — 중위 ⅓"],
        ["C", () => C().s3, "여가형 — 하위 ⅓ (지수 < 16.5)"],
      ],
      fmt: (d) => d.grade + "등급 (" + d.idx.toFixed(1) + ")",
    },
    index: {
      title: "생계형 복합판정지수 (0–100)",
      type: "seq",
      value: (d) => d.idx,
      max: 80,
      fmt: (d) => d.idx.toFixed(1),
    },
    dawnOff: {
      title: "새벽(~09시) 노인 하차량 (백만 명)",
      type: "seq",
      value: (d) => d.dawn,
      max: 13,
      fmt: (d) => d.dawn + "백만 명",
    },
    facility: {
      title: "사업시설관리업 종사자 비중 (%)",
      type: "seq",
      value: (d) => d.facPct,
      max: 18,
      fmt: (d) => d.facPct + "%",
    },
    elderRatio: {
      title: "전체 승차 중 노인 비율 (%)",
      type: "seq",
      value: (d) => d.elderRatio,
      max: 18,
      min: 7,
      fmt: (d) => d.elderRatio + "%",
    },
  };
  let mapMetric = "od";

  function seqColor(t) {
    /* 파랑 단일 색상 램프 100→700 */
    const stops = [
      [205, 226, 251], [158, 197, 244], [109, 167, 236],
      [57, 135, 229], [37, 106, 191], [24, 79, 149], [13, 54, 107],
    ];
    const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(x));
    const f = x - i;
    const c = stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }

  let mapProjected = null;
  function projectMap() {
    /* 등장방형 근사 투영 */
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    const cosLat = Math.cos((37.55 * Math.PI) / 180);
    const pts = SEOUL_GEO.map((f) => {
      const rings = f.coords.map((ring) =>
        ring.map(([lon, lat]) => {
          const x = lon * cosLat, y = -lat;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          return [x, y];
        })
      );
      return { name: f.name, rings };
    });
    const W = 640, H = 520, pad = 10;
    const s = Math.min((W - pad * 2) / (maxX - minX), (H - pad * 2) / (maxY - minY));
    const ox = (W - (maxX - minX) * s) / 2, oy = (H - (maxY - minY) * s) / 2;
    mapProjected = pts.map((f) => ({
      name: f.name,
      rings: f.rings.map((ring) => ring.map(([x, y]) => [(x - minX) * s + ox, (y - minY) * s + oy])),
    }));
    mapProjected.forEach((f) => {
      /* 라벨 위치: 최대 링의 무게중심 근사 */
      let best = f.rings[0];
      f.rings.forEach((r) => { if (r.length > best.length) best = r; });
      let cx = 0, cy = 0;
      best.forEach(([x, y]) => { cx += x; cy += y; });
      f.cx = cx / best.length;
      f.cy = cy / best.length;
    });
    return { W, H };
  }

  function renderMapLegend() {
    const m = mapMetrics[mapMetric];
    document.getElementById("mapLegendTitle").textContent = m.title;
    const box = document.getElementById("mapLegend");
    box.innerHTML = "";
    if (m.type === "cat") {
      m.cats.forEach(([label, colorFn, desc]) => {
        const row = document.createElement("div");
        row.className = "row";
        const sw = document.createElement("span");
        sw.className = "sw";
        sw.style.background = colorFn();
        row.appendChild(sw);
        const s = document.createElement("span");
        s.innerHTML = "<b>" + label + "</b>" + (desc ? " · " + desc : "");
        row.appendChild(s);
        box.appendChild(row);
      });
    } else {
      const bar = document.createElement("div");
      bar.style.cssText = "height:12px;border-radius:6px;background:linear-gradient(90deg," +
        [0, 0.25, 0.5, 0.75, 1].map((t) => seqColor(t)).join(",") + ");margin:4px 0 2px";
      box.appendChild(bar);
      const lab = document.createElement("div");
      lab.style.cssText = "display:flex;justify-content:space-between;font-size:11.5px;color:var(--muted)";
      lab.innerHTML = "<span>" + (m.min || 0) + "</span><span>" + m.max + "</span>";
      box.appendChild(lab);
    }
  }

  function guInfo(name) {
    const d = GU[name];
    const info = document.getElementById("mapInfo");
    info.innerHTML = "";
    const t = document.createElement("div");
    t.className = "gu";
    t.textContent = name;
    info.appendChild(t);
    const dl = document.createElement("dl");
    [
      ["OD 유형", d.od],
      ["생계형 지수 / 등급", d.idx.toFixed(1) + " / " + d.grade],
      ["~09시 승차 (만)", fmt(d.board, 0)],
      ["~09시 하차 (만)", fmt(d.alight, 0)],
      ["순승차비율", d.netRatio + "%"],
      ["새벽 노인 하차량", d.dawn + "백만 명"],
      ["사업시설관리 종사자", d.fac + "만 명 (" + d.facPct + "%)"],
      ["노인 승차 비율", d.elderRatio + "%"],
      ["노인 인구", d.eld + "만 명"],
    ].forEach(([k, v]) => {
      const dt = document.createElement("dt");
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.textContent = v;
      dl.appendChild(dt);
      dl.appendChild(dd);
    });
    info.appendChild(dl);
  }

  function renderMap() {
    const col = C();
    const dims = projectMap();
    const svg = makeSvg("seoulMap", dims.W, dims.H);
    const m = mapMetrics[mapMetric];
    mapProjected.forEach((f) => {
      const d = GU[f.name];
      if (!d) return;
      let fill;
      if (m.type === "cat") {
        const cat = m.cats.find(([label]) => label === m.value(d));
        fill = cat ? cat[1]() : col.neutral;
      } else {
        const lo = m.min || 0;
        fill = seqColor((m.value(d) - lo) / (m.max - lo));
      }
      const path = f.rings.map((ring) => "M" + ring.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join("L") + "Z").join(" ");
      const p = el("path", { d: path, fill, class: "gu-path" }, svg);
      p.addEventListener("pointermove", (e) => {
        showTip(e, f.name, [
          [m.title, m.fmt(d), fill],
          ["OD 유형", d.od, null],
          ["생계형 지수", d.idx.toFixed(1) + " (" + d.grade + "등급)", null],
        ]);
        guInfo(f.name);
      });
      p.addEventListener("pointerleave", hideTip);
      p.addEventListener("click", () => guInfo(f.name));
      /* 라벨 — 배경 명도에 따라 잉크 결정 */
      let inkIn = col.ink;
      const mRGB = /rgb\((\d+),(\d+),(\d+)\)/.exec(fill);
      if (mRGB) {
        const lum = 0.2126 * mRGB[1] + 0.7152 * mRGB[2] + 0.0722 * mRGB[3];
        inkIn = lum < 140 ? "#ffffff" : "#0b0b0b";
      } else if (m.type === "cat") {
        const light = !matchMedia("(prefers-color-scheme: dark)").matches;
        const v = m.value(d);
        inkIn = (v === "저활용형") ? (light ? "#0b0b0b" : "#ffffff") : "#ffffff";
        if (light && (v === "C" || v === "혼재형")) inkIn = "#0b0b0b";
      }
      txt(svg, f.cx, f.cy, f.name.replace("구", ""), { "text-anchor": "middle", class: "gu-label", fill: inkIn });
    });
    renderMapLegend();
  }
  document.getElementById("mapSeg").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    document.querySelectorAll("#mapSeg button").forEach((x) => x.classList.remove("on"));
    b.classList.add("on");
    mapMetric = b.dataset.m;
    renderMap();
  });

  /* ==========================================================
     RENDER ALL
     ========================================================== */
  function renderAll() {
    const col = C();
    chartYearlyBars();
    chartYearlyShare();
    legend("lgYearly", [["전체 승차 (억 명)", col.s1], ["노인 승차 (억 명)", col.s2], ["노인 승차 비중 (%)", col.s2, "line"]]);
    chartHourly();
    legend("lgHourly", [["평일", col.s1], ["주말", col.s2]]);
    chartTicket();
    legend("lgTicket", [["경로(노인)", col.s1], ["장애", col.s2], ["유공자", col.s3]]);
    chartPop();
    chartWorker();
    chartLoss();
    legend("lgLoss", [["당기순손실", col.s1], ["노인 무임 추정 손실", col.s2]]);
    chartScenario();
    chartCorr();
    buildTopStations();
    chartIndex();
    legend("lgIndex", [["A등급 · 생계형", col.s1], ["B등급 · 혼재형", col.s2], ["C등급 · 여가형", col.s3]]);
    renderMap();
    guInfo("강남구");
  }

  renderAll();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", renderAll);
})();
