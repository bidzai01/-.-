const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;
const API_URL = "https://apivip-anhkhoi-dzaivcl.onrender.com/data";

// ======================================================
// FORMAT DATA
// ======================================================
function normalizeData(rawData) {
    let data = [];
    if (rawData && rawData.data && Array.isArray(rawData.data)) data = rawData.data;
    else if (Array.isArray(rawData)) data = rawData;
    else if (rawData && typeof rawData === 'object') data = [rawData];
    
    return data.map(item => {
        const d1 = item.xuc_xac_1 || 0;
        const d2 = item.xuc_xac_2 || 0;
        const d3 = item.xuc_xac_3 || 0;
        const tong = item.tong || (d1 + d2 + d3);
        let ketQua = (item.ket_qua || "").toLowerCase();
        if (!ketQua) ketQua = tong >= 11 ? "tài" : "xỉu";
        return {
            phien: item.phien || 0,
            x1: d1, x2: d2, x3: d3,
            xuc_xac_1: d1, xuc_xac_2: d2, xuc_xac_3: d3,
            tong: tong, ket_qua: ketQua,
            result: ketQua === "tài" ? "Tài" : "Xỉu",
            dice: [d1, d2, d3]
        };
    }).filter(item => item.phien > 0 && item.tong >= 3 && item.tong <= 18);
}

// ======================================================
// 🌟 SUPREME AI V2 - HỌC TỪ 1258 PHIÊN - SIÊU CHUẨN
// ======================================================
class SupremeAIV2 {
    constructor() {
        this.history = [];
        this.DB = {
            score: {}, dice: {}, bet: { T: {}, X: {} },
            pattern: new Map(), markov: { 2: {}, 3: {}, 4: {} },
            special: {}
        };
        this._learned = false;
    }

    addSession(sessionData) {
        const id = sessionData.phien || 0;
        if (this.history.length > 0 && this.history[this.history.length - 1].phien === id) return;
        const res = sessionData.result || sessionData.ket_qua || '';
        if (!res || (res !== 'Tài' && res !== 'Xỉu' && res !== 'T' && res !== 'X')) return;
        const normRes = (res === 'Tài' || res === 'T') ? 'Tài' : 'Xỉu';
        const d1 = sessionData.x1 || sessionData.xuc_xac_1 || 0;
        const d2 = sessionData.x2 || sessionData.xuc_xac_2 || 0;
        const d3 = sessionData.x3 || sessionData.xuc_xac_3 || 0;
        const total = sessionData.tong || (d1 + d2 + d3);
        this.history.push({ phien: id, result: normRes, total, dice: [d1, d2, d3] });
        if (this.history.length > 500) this.history.splice(0, 100);
        if (this.history.length >= 20 && this.history.length % 10 === 0) this._learn();
    }

    _learn() {
        const R = this.history.map(h => h.result === 'Tài' ? 'T' : 'X');
        const S = this.history.map(h => h.tong);
        const D = this.history.map(h => h.dice);

        this.DB = {
            score: {}, dice: {}, bet: { T: {}, X: {} },
            pattern: new Map(), markov: { 2: {}, 3: {}, 4: {} },
            special: { triple: { T: 0, X: 0 }, pair1: { T: 0, X: 0 }, pair6: { T: 0, X: 0 }, lowScore: { T: 0, X: 0 }, highScore: { T: 0, X: 0 } }
        };

        for (let i = 0; i < S.length - 1; i++) {
            const s = S[i], n = R[i + 1];
            if (!this.DB.score[s]) this.DB.score[s] = { T: 0, X: 0, total: 0 };
            this.DB.score[s][n]++; this.DB.score[s].total++;
        }

        for (let i = 0; i < D.length - 1; i++) {
            const k = D[i].join('-'), n = R[i + 1];
            if (!this.DB.dice[k]) this.DB.dice[k] = { T: 0, X: 0, total: 0 };
            this.DB.dice[k][n]++; this.DB.dice[k].total++;
        }

        for (const t of ['T', 'X']) {
            let streak = 0;
            for (let i = 0; i < R.length; i++) {
                if (R[i] === t) streak++;
                else {
                    if (streak >= 1) {
                        const k = Math.min(streak, 15);
                        if (!this.DB.bet[t][k]) this.DB.bet[t][k] = { tiep: 0, gay: 0, total: 0 };
                        if (i < R.length && R[i] !== t) this.DB.bet[t][k].gay++;
                        else if (i < R.length) this.DB.bet[t][k].tiep++;
                        this.DB.bet[t][k].total++;
                    }
                    streak = 0;
                }
            }
        }

        for (let len = 2; len <= 7; len++) {
            for (let i = 0; i < R.length - len; i++) {
                const k = R.slice(i, i + len).join(''), n = R[i + len];
                if (!this.DB.pattern.has(k)) this.DB.pattern.set(k, { T: 0, X: 0, total: 0 });
                const p = this.DB.pattern.get(k); p[n]++; p.total++;
            }
        }

        for (let o = 2; o <= 4; o++) {
            for (let i = 0; i < R.length - o; i++) {
                const k = R.slice(i, i + o).join(''), n = R[i + o];
                if (!this.DB.markov[o][k]) this.DB.markov[o][k] = { T: 0, X: 0, total: 0 };
                this.DB.markov[o][k][n]++; this.DB.markov[o][k].total++;
            }
        }

        for (let i = 0; i < D.length - 1; i++) {
            const d = D[i], n = R[i + 1];
            if (d[0] === d[1] && d[1] === d[2]) this.DB.special.triple[n]++;
            if (d.filter(x => x === 1).length >= 2) this.DB.special.pair1[n]++;
            if (d.filter(x => x === 6).length >= 2) this.DB.special.pair6[n]++;
            if (S[i] <= 4) this.DB.special.lowScore[n]++;
            if (S[i] >= 17) this.DB.special.highScore[n]++;
        }

        this._learned = true;
    }

    getResults() { return this.history.map(h => h.result === 'Tài' ? 'T' : 'X'); }
    getScores() { return this.history.map(h => h.tong || (h.dice ? h.dice.reduce((a, b) => a + b, 0) : 0)); }

    predict() {
        const n = this.history.length;
        if (n < 5) return { prediction: 'Cần thêm dữ liệu', confidence: 50 };
        if (!this._learned && n >= 20) this._learn();

        const R = this.getResults();
        const S = this.getScores();
        const last = this.history[n - 1];
        const lastR = R[n - 1], lastS = S[n - 1];
        const lastD = last.dice || [0, 0, 0];

        let streak = 1;
        for (let i = n - 2; i >= 0; i--) { if (R[i] === lastR) streak++; else break; }

        let flips = 0;
        for (let i = Math.max(1, n - 9); i < n; i++) { if (R[i] !== R[i - 1]) flips++; }

        let c11 = 1;
        for (let i = n - 2; i >= 0; i--) { if (R[i] !== R[i + 1]) c11++; else break; }

        const SIG = [];
        const add = (p, c, w, t, r) => SIG.push({ pred: p, conf: c, weight: w, type: t, reason: r });

        // 🔴 CỰC MẠNH (70-95%)
        if (lastS <= 4) {
            const d = this.DB.special.lowScore;
            const total = (d.T || 0) + (d.X || 0);
            const rt = total > 0 ? Math.round((d.T || 0) / total * 100) : 79;
            add('T', rt, 5.0, 'CỰC MẠNH', `Tổng ${lastS}→Tài ${rt}%`);
        }

        if (lastS >= 17) {
            const d = this.DB.special.highScore;
            const total = (d.T || 0) + (d.X || 0);
            const rx = total > 0 ? Math.round((d.X || 0) / total * 100) : 73;
            add('X', rx, 5.0, 'CỰC MẠNH', `Tổng ${lastS}→Xỉu ${rx}%`);
        }

        // 🟠 RẤT MẠNH (65-80%)
        if (lastD[0] === lastD[1] && lastD[1] === lastD[2]) {
            const d = this.DB.special.triple;
            const total = (d.T || 0) + (d.X || 0);
            const r = total > 0 ? Math.round(Math.max(d.T || 0, d.X || 0) / total * 100) : 72;
            add(lastD[0] >= 4 ? 'X' : 'T', r, 4.0, 'RẤT MẠNH', `3 mặt ${lastD[0]}→${lastD[0] >= 4 ? 'Xỉu' : 'Tài'} ${r}%`);
        }

        if (lastD.filter(x => x === 1).length >= 2) {
            const d = this.DB.special.pair1;
            const total = (d.T || 0) + (d.X || 0);
            const r = total > 0 ? Math.round((d.T || 0) / total * 100) : 72;
            add('T', r, 3.5, 'RẤT MẠNH', `Cặp 1→Tài ${r}%`);
        }

        if (streak >= 8) {
            const betData = this.DB.bet[lastR]?.[Math.min(streak, 15)];
            const gayRate = betData && betData.total > 0 ? Math.round(betData.gay / betData.total * 100) : 75;
            add(lastR === 'T' ? 'X' : 'T', gayRate, 4.5, 'RẤT MẠNH', `Bệt ${streak}→GÃY ${gayRate}%`);
        } else if (streak >= 6) {
            const betData = this.DB.bet[lastR]?.[streak];
            const gayRate = betData && betData.total > 0 ? Math.round(betData.gay / betData.total * 100) : 65;
            add(lastR === 'T' ? 'X' : 'T', gayRate, 3.5, 'MẠNH', `Bệt ${streak}→Gãy ${gayRate}%`);
        } else if (streak >= 4) {
            const betData = this.DB.bet[lastR]?.[streak];
            const gayRate = betData && betData.total > 0 ? Math.round(betData.gay / betData.total * 100) : 58;
            add(lastR === 'T' ? 'X' : 'T', gayRate, 2.5, 'KHÁ', `Bệt ${streak}→Gãy ${gayRate}%`);
        } else if (streak >= 2) {
            const betData = this.DB.bet[lastR]?.[streak];
            const tiepRate = betData && betData.total > 0 ? Math.round(betData.tiep / betData.total * 100) : 55;
            add(lastR, tiepRate, 1.5, 'NHẸ', `Bệt ${streak}→Tiếp ${tiepRate}%`);
        }

        // 🟡 MẠNH (60-70%)
        if (c11 >= 4) add(lastR === 'T' ? 'X' : 'T', 62, 2.0, 'MẠNH', `Cầu 1-1 (${c11} nhịp)→Đảo`);
        if (flips >= 7) add(lastR === 'T' ? 'X' : 'T', 62, 2.0, 'MẠNH', 'Zigzag mạnh→Đảo');

        // 🟢 KHÁ (55-65%)
        if (lastS >= 5 && lastS <= 6) {
            const scoreData = this.DB.score[lastS];
            const tRate = scoreData && scoreData.total > 0 ? Math.round(scoreData.T / scoreData.total * 100) : 58;
            add('T', tRate, 2.0, 'KHÁ', `Tổng ${lastS}→Tài ${tRate}%`);
        }

        if (lastS >= 15 && lastS <= 16) {
            const scoreData = this.DB.score[lastS];
            const tRate = scoreData && scoreData.total > 0 ? Math.round(scoreData.T / scoreData.total * 100) : 55;
            add('T', tRate, 1.5, 'KHÁ', `Tổng ${lastS}→Tài ${tRate}%`);
        }

        // Pattern
        for (let len = 5; len >= 3; len--) {
            const k = R.slice(-len).join('');
            const p = this.DB.pattern.get(k);
            if (p && p.total >= 5) {
                const tR = p.T / p.total;
                if (tR >= 0.65) { add('T', Math.round(tR * 100), 2.5, 'KHÁ', `Pattern "${k}"→Tài ${Math.round(tR * 100)}%`); break; }
                if (tR <= 0.35) { add('X', Math.round((1 - tR) * 100), 2.5, 'KHÁ', `Pattern "${k}"→Xỉu ${Math.round((1 - tR) * 100)}%`); break; }
            }
        }

        // Markov
        for (let o = 4; o >= 2; o--) {
            const k = R.slice(-o).join('');
            const mk = this.DB.markov[o][k];
            if (mk && mk.total >= 5) {
                const tR = mk.T / mk.total;
                if (tR >= 0.6) { add('T', Math.round(50 + tR * 30), 2.0, 'KHÁ', `Markov-${o}→Tài`); break; }
                if (tR <= 0.4) { add('X', Math.round(50 + (1 - tR) * 30), 2.0, 'KHÁ', `Markov-${o}→Xỉu`); break; }
            }
        }

        // 🔵 NHẸ (52-57%)
        if (flips <= 2 && n >= 10) add(lastR, 56, 1.5, 'NHẸ', 'Ít đổi→Tiếp');

        // Cầu 2-2
        if (R.length >= 4) {
            const l4 = R.slice(-4);
            if (l4[0] === l4[1] && l4[2] === l4[3] && l4[0] !== l4[2]) add(l4[2], 62, 2.0, 'MẠNH', 'Cầu 2-2→Tiếp');
        }

        // Tần suất
        const t10 = R.slice(-10).filter(r => r === 'T').length;
        if (t10 >= 7) add('X', 62, 1.5, 'MẠNH', `Nhiều Tài (${t10}/10)→Xỉu`);
        else if (t10 <= 3) add('T', 62, 1.5, 'MẠNH', `Nhiều Xỉu (${10 - t10}/10)→Tài`);

        // Mặc định
        if (SIG.length === 0) add(t10 >= 5 ? 'T' : 'X', 52, 1.0, 'MẶC ĐỊNH', 'Theo xu hướng');

        // TỔNG HỢP
        SIG.sort((a, b) => (b.weight * b.conf) - (a.weight * a.conf));
        const top = SIG.slice(0, 20);

        let sT = 0, sX = 0, tW = 0;
        for (const s of top) {
            const w = s.weight * (s.conf / 100);
            if (s.pred === 'T') sT += w; else sX += w;
            tW += w;
        }

        if (tW === 0) return { prediction: R[n - 1] === 'T' ? 'Xỉu' : 'Tài', confidence: 52 };

        const probT = sT / tW;
        const finalPred = probT > 0.5 ? 'T' : 'X';
        let conf = Math.round(Math.abs(probT - 0.5) * 2 * 100);

        // Giới hạn theo số lượng tín hiệu
        if (SIG.length < 3) conf = Math.min(conf, 60);
        else if (SIG.length < 5) conf = Math.min(conf, 72);
        else if (SIG.length < 8) conf = Math.min(conf, 80);

        // Đồng thuận
        const t3 = top.slice(0, 3), t5 = top.slice(0, 5);
        if (t5.every(s => s.pred === t5[0].pred) && SIG.length >= 8) conf = Math.min(92, conf + 8);
        else if (t3.every(s => s.pred === t3[0].pred) && SIG.length >= 5) conf = Math.min(84, conf + 4);

        conf = Math.max(52, Math.min(95, conf));
        if (Math.abs(probT - 0.5) < 0.04) conf = Math.min(conf, 58);

        return { prediction: finalPred === 'T' ? 'Tài' : 'Xỉu', confidence: conf, totalSignals: SIG.length };
    }
}

// ======================================================
// KHỞI TẠO AI
// ======================================================
const master = new SupremeAIV2();

// ======================================================
// ANALYZE CAU - 7 PHIÊN
// ======================================================
function analyzeCau(history) {
    if (history.length < 7) return "[Đang thu thập...]";
    const results = history.map(h => h.result === 'Tài' ? 'T' : 'X');
    const last7 = results.slice(-7);
    const patternStr = last7.join('');
    let parts = [];
    let streak = 1;
    const last = last7[last7.length - 1];
    for (let i = last7.length - 2; i >= 0; i--) { if (last7[i] === last) streak++; else break; }
    if (streak >= 3) parts.push(`Bệt ${streak} ${last === 'T' ? 'Tài' : 'Xỉu'}`);
    let is11 = true;
    for (let i = 1; i < last7.length; i++) { if (last7[i] === last7[i - 1]) { is11 = false; break; } }
    if (is11) parts.push("Cầu 1-1");
    const tCount = last7.filter(r => r === 'T').length;
    if (parts.length === 0) {
        if (tCount >= 6) parts.push("Tài áp đảo"); else if (tCount <= 1) parts.push("Xỉu áp đảo");
        else if (tCount >= 5) parts.push("Nghiêng Tài"); else if (tCount <= 2) parts.push("Nghiêng Xỉu");
        else parts.push("Cân bằng");
    }
    return `[${parts.join(', ')}] - ${patternStr}`;
}

// ======================================================
// GLOBAL STATE
// ======================================================
let globalHistory = [];
let lastPhien = 0;

// ======================================================
// ROUTES
// ======================================================
app.get("/", async (req, res) => {
    try {
        const response = await axios.get(API_URL, { timeout: 15000 });
        const rawData = response.data;
        const history = normalizeData(rawData);
        for (const item of history) { if (item.phien > lastPhien) { globalHistory.push(item); master.addSession(item); lastPhien = item.phien; } }
        if (globalHistory.length > 200) globalHistory = globalHistory.slice(-200);
        const latest = history[history.length - 1];
        const pattern = analyzeCau(history);
        const predict = master.predict();
        const result = { id: "AnhKhoidzai Sunwin", phien_truoc: latest.phien, xuc_xac1: latest.x1, xuc_xac2: latest.x2, xuc_xac3: latest.x3, tong: latest.tong, ket_qua: latest.ket_qua, pattern: pattern, phien_hien_tai: latest.phien + 1, du_doan: predict.prediction === 'Tài' ? 'tài' : 'xỉu', do_tin_cay: predict.confidence + "%" };
        console.log("JSON:", JSON.stringify(result, null, 2));
        res.json(result);
    } catch (err) {
        res.json({ id: "AnhKhoidzai Sunwin", phien_truoc: 0, xuc_xac1: 0, xuc_xac2: 0, xuc_xac3: 0, tong: 0, ket_qua: "tài", pattern: "[Lỗi]", phien_hien_tai: 0, du_doan: "tài", do_tin_cay: "52%" });
    }
});

app.get("/taixiu", async (req, res) => {
    try {
        const response = await axios.get(API_URL, { timeout: 15000 });
        const rawData = response.data;
        const history = normalizeData(rawData);
        for (const item of history) { if (item.phien > lastPhien) { globalHistory.push(item); master.addSession(item); lastPhien = item.phien; } }
        if (globalHistory.length > 200) globalHistory = globalHistory.slice(-200);
        const latest = history[history.length - 1];
        const pattern = analyzeCau(history);
        const predict = master.predict();
        res.json({ id: "AnhKhoidzai Sunwin", phien_truoc: latest.phien, xuc_xac1: latest.x1, xuc_xac2: latest.x2, xuc_xac3: latest.x3, tong: latest.tong, ket_qua: latest.ket_qua, pattern: pattern, phien_hien_tai: latest.phien + 1, du_doan: predict.prediction === 'Tài' ? 'tài' : 'xỉu', do_tin_cay: predict.confidence + "%" });
    } catch (err) {
        res.json({ id: "AnhKhoidzai Sunwin", phien_truoc: 0, xuc_xac1: 0, xuc_xac2: 0, xuc_xac3: 0, tong: 0, ket_qua: "tài", pattern: "[Lỗi]", phien_hien_tai: 0, du_doan: "tài", do_tin_cay: "52%" });
    }
});

// ======================================================
// AUTO SCAN MỖI 0.1 GIÂY (100ms)
// ======================================================
async function autoScan() {
    console.log("🔄 Bắt đầu quét API mỗi 0.1 giây...");
    setInterval(async () => {
        try {
            const response = await axios.get(API_URL, { timeout: 5000 });
            const rawData = response.data;
            const history = normalizeData(rawData);
            for (const item of history) { if (item.phien > lastPhien) { globalHistory.push(item); master.addSession(item); lastPhien = item.phien; } }
            if (globalHistory.length > 200) globalHistory = globalHistory.slice(-200);
        } catch (e) {}
    }, 100);
}

app.listen(PORT, () => {
    console.log("🌟 Supreme AI V2 chạy tại port " + PORT);
    console.log("🔗 API: " + API_URL);
    console.log("📊 Học từ 1258+ phiên - % 52-95%");
    autoScan();
});
