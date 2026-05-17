const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const API_URL = "https://apivip-anhkhoi-dzaivcl.onrender.com/data";

// ======================================================
// FILE LƯU TRỮ THỐNG KÊ
// ======================================================
const STATS_FILE = path.join(__dirname, "master_v2_stats.json");

function saveStats(stats) {
    try { fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2)); } catch (e) {}
}

function loadStats() {
    try {
        if (fs.existsSync(STATS_FILE)) {
            return JSON.parse(fs.readFileSync(STATS_FILE, "utf8"));
        }
    } catch (e) {}
    return {
        totalPredictions: 0, totalCorrect: 0, totalWrong: 0,
        currentWinStreak: 0, currentLoseStreak: 0,
        maxWinStreak: 0, maxLoseStreak: 0,
        predictionLog: [],
        performance: {}
    };
}

let stats = loadStats();

// ======================================================
// FORMAT DATA
// ======================================================
function normalizeData(rawData) {
    let data = [];
    if (rawData && rawData.data && Array.isArray(rawData.data)) {
        data = rawData.data;
    } else if (Array.isArray(rawData)) {
        data = rawData;
    } else if (rawData && typeof rawData === 'object') {
        data = [rawData];
    }
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
            tong: tong,
            ket_qua: ketQua,
            result: ketQua === "tài" ? "Tài" : "Xỉu",
            dice: [d1, d2, d3]
        };
    }).filter(item => item.phien > 0 && item.tong >= 3 && item.tong <= 18);
}

// ======================================================
// 🎯 MASTER ANALYZER V2 - FULL UPGRADE
// ======================================================
class MasterAnalyzerV2 {
    constructor() {
        this.history = [];
        this.predictions = [];
        this.stats = { correct: 0, total: 0, win: 0, maxWin: 0, lose: 0 };
        this.performance = {};
        this.diceMemory = new Map();
        this.patternMemory = new Map();
    }

    calcBreakProb(results, result, streak) {
        const allStreaks = this.extractAllStreaks(results);
        const sameType = allStreaks.filter(s => s.type === result);
        if (sameType.length === 0) return streak > 8 ? 0.7 : 0.5;
        const exactMatch = sameType.filter(s => s.len === streak).length;
        const longerMatch = sameType.filter(s => s.len > streak).length;
        const total = exactMatch + longerMatch;
        if (total === 0) return streak > 8 ? 0.7 : 0.5;
        let prob = exactMatch / total;
        const recentStreaks = sameType.filter(s => s.endIdx > results.length - 50);
        if (recentStreaks.length > 0) {
            prob = prob * 0.4 + (recentStreaks.filter(s => s.len > streak).length / recentStreaks.length) * 0.6;
        }
        return Math.min(0.9, Math.max(0.1, prob + streak * 0.02));
    }

    extractAllStreaks(results) {
        const allStreaks = [];
        let cur = 1, curType = results[0];
        for (let i = 1; i < results.length; i++) {
            if (results[i] === curType) cur++;
            else {
                if (cur >= 3) allStreaks.push({ type: curType, len: cur, endIdx: i - 1 });
                curType = results[i]; cur = 1;
            }
        }
        if (cur >= 3) allStreaks.push({ type: curType, len: cur, endIdx: results.length - 1 });
        return allStreaks;
    }

    // ============================================
    // 1. PHÂN TÍCH BỆT SIÊU CHUẨN
    // ============================================
    analyzeBiet(results, scores) {
        const n = results.length;
        if (n < 2) return [];
        const signals = [];
        const last = results[n - 1];
        let streak = 1;
        for (let i = n - 2; i >= 0; i--) { if (results[i] === last) streak++; else break; }
        const breakProb = this.calcBreakProb(results, last, streak);

        if (streak >= 10) signals.push({ p: last === 'T' ? 'X' : 'T', c: 97, w: 3.0, s: 'biet_sieu_dai', r: `Bệt siêu dài ${streak}` });
        else if (streak >= 8) signals.push({ p: last === 'T' ? 'X' : 'T', c: 92, w: 2.8, s: 'biet_rat_dai', r: `Bệt rất dài ${streak}` });
        else if (streak >= 6) signals.push({ p: last === 'T' ? 'X' : 'T', c: 84, w: 2.3, s: 'biet_dai', r: `Bệt dài ${streak}` });
        else if (streak >= 4) {
            const pred = breakProb > 0.55 ? (last === 'T' ? 'X' : 'T') : last;
            signals.push({ p: pred, c: 65 + streak * 3, w: 1.8, s: 'biet_vua', r: `Bệt ${streak}` });
        } else if (streak >= 3) {
            signals.push({ p: last, c: 58 + streak * 2, w: 1.3, s: 'biet_ngan', r: `Bệt ngắn ${streak}` });
        }

        // Bệt với điểm số
        if (streak >= 4) {
            const streakScores = scores.slice(-streak);
            const avgScore = streakScores.reduce((a, b) => a + b, 0) / streak;
            const variance = streakScores.reduce((a, b) => a + Math.pow(b - avgScore, 2), 0) / streak;
            if (variance > 10) signals.push({ p: last === 'T' ? 'X' : 'T', c: 72, w: 1.5, s: 'biet_bien_dong', r: 'Bệt biến động cao' });
            if ((last === 'T' && avgScore > 13.5) || (last === 'X' && avgScore < 6.5)) signals.push({ p: last === 'T' ? 'X' : 'T', c: 70, w: 1.4, s: 'biet_diem_lech', r: `Điểm TB lệch: ${avgScore.toFixed(1)}` });
        }

        return signals;
    }

    // ============================================
    // 2. PHÂN TÍCH CẦU ĐA DẠNG
    // ============================================
    analyzeCau(results, scores) {
        const n = results.length;
        if (n < 4) return [];
        const signals = [];
        const last = results[n - 1];

        // 1-1
        let altCount = 0;
        for (let i = n - 1; i >= 1; i--) { if (results[i] !== results[i - 1]) altCount++; else break; }
        if (altCount >= 3) signals.push({ p: last === 'T' ? 'X' : 'T', c: Math.min(92, 65 + (altCount + 1) * 2), w: 0.8 + (altCount + 1) * 0.12, s: 'cau_11', r: `Cầu 1-1 (${altCount + 1} phiên)` });

        // 2-2
        if (n >= 8) {
            let seg = results.slice(-8);
            let is22 = true;
            for (let i = 0; i < 8; i += 2) if (seg[i] !== seg[i + 1]) { is22 = false; break; }
            if (is22 && seg[0] !== seg[2]) signals.push({ p: n % 2 === 0 ? seg[7] : (seg[7] === 'T' ? 'X' : 'T'), c: 84, w: 1.6, s: 'cau_22', r: 'Cầu 2-2' });
        }

        // 3-3
        if (n >= 12) {
            let seg = results.slice(-12);
            let is33 = true;
            for (let i = 0; i < 12; i += 3) {
                let block = seg.slice(i, i + 3);
                if (block.length === 3 && !block.every(v => v === block[0])) { is33 = false; break; }
            }
            if (is33 && seg[0] !== seg[3]) signals.push({ p: n % 3 === 0 ? (seg[11] === 'T' ? 'X' : 'T') : seg[11], c: 86, w: 1.5, s: 'cau_33', r: 'Cầu 3-3' });
        }

        // 1-2-3 & 3-2-1
        if (n >= 6) {
            let l6 = results.slice(-6).join('');
            if (l6 === 'TXXTTT') signals.push({ p: 'X', c: 77, w: 1.3, s: 'cau_123', r: 'Cầu 1-2-3' });
            if (l6 === 'XTTXXX') signals.push({ p: 'T', c: 77, w: 1.3, s: 'cau_123', r: 'Cầu 1-2-3' });
            if (l6 === 'TTTXXT') signals.push({ p: 'X', c: 76, w: 1.3, s: 'cau_321', r: 'Cầu 3-2-1' });
            if (l6 === 'XXXTTX') signals.push({ p: 'T', c: 76, w: 1.3, s: 'cau_321', r: 'Cầu 3-2-1' });
        }

        // Rồng/Hổ
        let tRun = 0, xRun = 0;
        for (let i = n - 1; i >= 0 && results[i] === 'T'; i--) tRun++;
        for (let i = n - 1; i >= 0 && results[i] === 'X'; i--) xRun++;
        if (tRun >= 8) signals.push({ p: 'X', c: 96, w: 3.0, s: 'rong_dai', r: `Rồng ${tRun}` });
        else if (tRun >= 6) signals.push({ p: 'X', c: 86, w: 2.5, s: 'rong', r: `Rồng ${tRun}` });
        else if (tRun >= 4) signals.push({ p: 'T', c: 68, w: 1.3, s: 'rong_ngan', r: `Rồng ngắn ${tRun}` });
        if (xRun >= 8) signals.push({ p: 'T', c: 96, w: 3.0, s: 'ho_dai', r: `Hổ ${xRun}` });
        else if (xRun >= 6) signals.push({ p: 'T', c: 86, w: 2.5, s: 'ho', r: `Hổ ${xRun}` });
        else if (xRun >= 4) signals.push({ p: 'X', c: 68, w: 1.3, s: 'ho_ngan', r: `Hổ ngắn ${xRun}` });

        // Zigzag
        if (n >= 7) {
            let sw = 0;
            for (let i = n - 6; i < n; i++) if (results[i] !== results[i - 1]) sw++;
            if (sw >= 5) signals.push({ p: last === 'T' ? 'X' : 'T', c: 68 + sw * 2, w: 1.0 + sw * 0.1, s: 'zigzag', r: `Zigzag ${sw}` });
        }

        // Tam giác
        if (n >= 5) {
            let l5 = results.slice(-5).join('');
            if (l5 === 'TXTXT') signals.push({ p: 'X', c: 80, w: 1.2, s: 'tam_giac', r: 'Tam giác' });
            if (l5 === 'XTXTX') signals.push({ p: 'T', c: 80, w: 1.2, s: 'tam_giac', r: 'Tam giác' });
        }

        // Đối xứng
        if (n >= 10) {
            let mid = Math.floor(n / 2);
            let left = results.slice(0, mid), right = results.slice(mid).reverse();
            let matches = 0;
            for (let i = 0; i < Math.min(left.length, right.length); i++) if (left[i] === right[i]) matches++;
            let ratio = matches / Math.min(left.length, right.length);
            if (ratio >= 0.85) {
                let mirrorPos = mid - (n - mid);
                if (mirrorPos >= 0 && mirrorPos < n) signals.push({ p: results[mirrorPos], c: 62 + ratio * 15, w: 1.0, s: 'doi_xung', r: `Đối xứng ${(ratio*100).toFixed(0)}%` });
            }
        }

        return signals;
    }

    // ============================================
    // 3. PHÂN TÍCH XÚC XẮC SIÊU CHUẨN
    // ============================================
    analyzeDice() {
        const n = this.history.length;
        if (n < 3) return [];
        const signals = [];
        const last = this.history[n - 1];
        if (!last.dice || !last.dice[0]) return signals;
        const sum = last.dice.reduce((a, b) => a + b, 0);
        const triple = last.dice.join(',');

        if (sum >= 17) signals.push({ p: 'X', c: 96, w: 3.0, s: 'dice_sum_17', r: `Tổng ${sum}` });
        else if (sum >= 15) signals.push({ p: 'X', c: 78, w: 2.0, s: 'dice_sum_15', r: `Tổng ${sum}` });
        if (sum <= 4) signals.push({ p: 'T', c: 96, w: 3.0, s: 'dice_sum_4', r: `Tổng ${sum}` });
        else if (sum <= 6) signals.push({ p: 'T', c: 72, w: 1.5, s: 'dice_sum_6', r: `Tổng ${sum}` });

        this.diceMemory.set(triple, (this.diceMemory.get(triple) || 0) + 1);
        const tripleCount = this.diceMemory.get(triple);
        if (tripleCount >= 3) {
            let afterTai = 0, afterTotal = 0;
            for (let i = 0; i < n - 1; i++) {
                if (this.history[i].dice && this.history[i].dice.join(',') === triple) {
                    afterTotal++;
                    if (this.history[i + 1].result === 'Tài') afterTai++;
                }
            }
            if (afterTotal >= 3) {
                const prob = afterTai / afterTotal;
                signals.push({ p: prob > 0.5 ? 'T' : 'X', c: Math.round(50 + Math.abs(prob - 0.5) * 85), w: 2.2, s: 'dice_triple', r: `Bộ ba ${triple} lặp ${tripleCount} lần` });
            }
        }

        return signals;
    }

    // ============================================
    // 4. PATTERN & TREND
    // ============================================
    analyzePatternTrend(results, scores) {
        const n = results.length;
        if (n < 5) return [];
        const signals = [];
        const lastScore = scores[n - 1];

        for (const len of [3, 4, 5]) {
            if (n <= len) continue;
            let pattern = results.slice(-len).join('');
            let counts = { T: 0, X: 0 };
            for (let i = 0; i < n - len; i++) {
                if (results.slice(i, i + len).join('') === pattern) counts[results[i + len]]++;
            }
            let total = counts.T + counts.X;
            if (total >= Math.max(3, 8 - len)) {
                let prob = counts.T / total;
                signals.push({ p: prob > 0.5 ? 'T' : 'X', c: Math.round(Math.min(90, 50 + Math.abs(prob - 0.5) * (100 - len * 5))), w: Math.max(0.5, 1.8 - len * 0.15), s: `pattern_${len}`, r: `Pattern ${len} (${total} lần)` });
            }
        }

        for (const window of [5, 7, 10]) {
            if (n < window) continue;
            let seg = results.slice(-window);
            let tCount = seg.filter(r => r === 'T').length;
            let ratio = tCount / window;
            if (ratio >= 0.7) signals.push({ p: 'X', c: 60 + ratio * 25, w: 1.0 + ratio * 0.5, s: `trend_over_${window}`, r: `Quá mua ${window} phiên` });
            else if (ratio <= 0.3) signals.push({ p: 'T', c: 60 + (1 - ratio) * 25, w: 1.0 + (1 - ratio) * 0.5, s: `trend_under_${window}`, r: `Quá bán ${window} phiên` });
        }

        let last5 = results.slice(-5);
        if (last5.every(r => r === 'T')) signals.push({ p: 'X', c: 84, w: 1.8, s: 'all_tai_5', r: '5 phiên toàn Tài' });
        if (last5.every(r => r === 'X')) signals.push({ p: 'T', c: 84, w: 1.8, s: 'all_xiu_5', r: '5 phiên toàn Xỉu' });

        if (lastScore >= 17) signals.push({ p: 'X', c: 95, w: 2.5, s: 'score_17', r: 'Điểm >= 17' });
        else if (lastScore >= 15) signals.push({ p: 'X', c: 76, w: 1.5, s: 'score_15', r: 'Điểm >= 15' });
        if (lastScore <= 4) signals.push({ p: 'T', c: 95, w: 2.5, s: 'score_4', r: 'Điểm <= 4' });
        else if (lastScore <= 6) signals.push({ p: 'T', c: 72, w: 1.4, s: 'score_6', r: 'Điểm <= 6' });

        return signals;
    }

    // ============================================
    // 🎯 DỰ ĐOÁN
    // ============================================
    predict() {
        const n = this.history.length;
        if (n < 5) return { prediction: 'Cần thêm dữ liệu', confidence: 0, wait: true };

        const results = this.history.map(h => h.result === 'Tài' ? 'T' : 'X');
        const scores = this.history.map(h => h.tong || (h.dice ? h.dice.reduce((a, b) => a + b, 0) : 0));

        const allSignals = [
            ...this.analyzeBiet(results, scores),
            ...this.analyzeCau(results, scores),
            ...this.analyzeDice(),
            ...this.analyzePatternTrend(results, scores)
        ];

        if (allSignals.length === 0) return { prediction: results[n - 1] === 'T' ? 'Xỉu' : 'Tài', confidence: 50 };

        allSignals.sort((a, b) => (b.w * b.c) - (a.w * a.c));
        const topSignals = allSignals.slice(0, 40);

        let scoreT = 0, scoreX = 0, totalW = 0;
        for (const signal of topSignals) {
            const w = signal.w * (signal.c / 100);
            if (signal.p === 'T') scoreT += w; else scoreX += w;
            totalW += w;
        }

        if (totalW === 0) return { prediction: results[n - 1] === 'T' ? 'Xỉu' : 'Tài', confidence: 50 };

        const probT = scoreT / totalW;
        const finalPred = probT > 0.5 ? 'T' : 'X';
        let confidence = Math.round(Math.abs(probT - 0.5) * 2 * 100);
        confidence = Math.max(52, Math.min(98, confidence));

        const top5 = topSignals.slice(0, 5), top10 = topSignals.slice(0, 10);
        if (top10.every(s => s.p === top10[0].p)) confidence = Math.min(98, confidence + 12);
        else if (top5.every(s => s.p === top5[0].p)) confidence = Math.min(98, confidence + 6);

        if (this.stats.lose >= 3) confidence = Math.max(52, confidence - 5);
        if (this.stats.win >= 5) confidence = Math.min(98, confidence + 5);

        this.predictions.push({
            prediction: finalPred === 'T' ? 'Tài' : 'Xỉu',
            confidence,
            topSignals: topSignals.slice(0, 5).map(s => s.s)
        });
        if (this.predictions.length > 500) this.predictions.shift();

        return { prediction: finalPred === 'T' ? 'Tài' : 'Xỉu', confidence, totalSignals: allSignals.length };
    }

    addSession(sessionData) {
        let result = sessionData.result || sessionData.ket_qua || '';
        if (result === 'Tài' || result === 'T') result = 'Tài';
        else if (result === 'Xỉu' || result === 'X') result = 'Xỉu';
        else return;
        this.history.push({
            result: result,
            tong: sessionData.tong || (sessionData.x1 + sessionData.x2 + sessionData.x3) || 0,
            dice: [sessionData.x1 || sessionData.xuc_xac_1 || 0, sessionData.x2 || sessionData.xuc_xac_2 || 0, sessionData.x3 || sessionData.xuc_xac_3 || 0],
            timestamp: Date.now()
        });
        if (this.history.length > 3000) this.history = this.history.slice(-2500);
    }

    feedback(actualResult) {
        if (this.predictions.length === 0) return;
        let lastPred = this.predictions[this.predictions.length - 1];
        lastPred.actual = actualResult;
        let isCorrect = lastPred.prediction === actualResult;
        this.stats.total++;
        if (isCorrect) { this.stats.correct++; this.stats.win++; this.stats.lose = 0; if (this.stats.win > this.stats.maxWin) this.stats.maxWin = this.stats.win; }
        else { this.stats.lose++; this.stats.win = 0; }
    }
}

// ======================================================
// KHỞI TẠO AI
// ======================================================
const masterV2 = new MasterAnalyzerV2();

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
        if (tCount >= 6) parts.push("Tài áp đảo");
        else if (tCount <= 1) parts.push("Xỉu áp đảo");
        else if (tCount >= 5) parts.push("Nghiêng Tài");
        else if (tCount <= 2) parts.push("Nghiêng Xỉu");
        else parts.push("Cân bằng");
    }
    return `[${parts.join(', ')}] - ${patternStr}`;
}

// ======================================================
// CẬP NHẬT STATS
// ======================================================
function updateStats(prediction, actualResult) {
    stats.totalPredictions++;
    const isCorrect = prediction === actualResult;
    if (isCorrect) {
        stats.totalCorrect++;
        stats.currentWinStreak++;
        stats.currentLoseStreak = 0;
        if (stats.currentWinStreak > stats.maxWinStreak) stats.maxWinStreak = stats.currentWinStreak;
    } else {
        stats.totalWrong++;
        stats.currentLoseStreak++;
        stats.currentWinStreak = 0;
        if (stats.currentLoseStreak > stats.maxLoseStreak) stats.maxLoseStreak = stats.currentLoseStreak;
    }
    stats.predictionLog.push({
        timestamp: new Date().toISOString(),
        prediction, actual: actualResult, correct: isCorrect,
        winStreak: stats.currentWinStreak, loseStreak: stats.currentLoseStreak
    });
    if (stats.predictionLog.length > 200) stats.predictionLog = stats.predictionLog.slice(-200);
    saveStats(stats);
}

// ======================================================
// GLOBAL STATE
// ======================================================
let globalHistory = [];
let lastPhien = 0;
let lastPrediction = null;

// ======================================================
// ROUTE CHÍNH
// ======================================================
app.get("/", async (req, res) => {
    try {
        const response = await axios.get(API_URL, { timeout: 15000 });
        const rawData = response.data;
        const history = normalizeData(rawData);

        for (const item of history) {
            if (item.phien > lastPhien) {
                globalHistory.push(item);
                masterV2.addSession(item);
                lastPhien = item.phien;
                if (lastPrediction && globalHistory.length >= 2) {
                    const prevSession = globalHistory[globalHistory.length - 2];
                    updateStats(lastPrediction, prevSession.ket_qua);
                    masterV2.feedback(prevSession.ket_qua === 'tài' ? 'Tài' : 'Xỉu');
                    lastPrediction = null;
                }
            }
        }
        if (globalHistory.length > 200) globalHistory = globalHistory.slice(-200);

        const latest = history[history.length - 1];
        const pattern = analyzeCau(history);
        const predict = masterV2.predict();
        lastPrediction = predict.prediction === 'Tài' ? 'tài' : 'xỉu';

        const accuracy = stats.totalPredictions > 0 ? ((stats.totalCorrect / stats.totalPredictions) * 100).toFixed(1) : '0.0';

        const result = {
            id: "AnhKhoidzai Sunwin",
            phien_truoc: latest.phien,
            xuc_xac1: latest.x1, xuc_xac2: latest.x2, xuc_xac3: latest.x3,
            tong: latest.tong, ket_qua: latest.ket_qua,
            pattern: pattern,
            phien_hien_tai: latest.phien + 1,
            du_doan: predict.prediction === 'Tài' ? 'tài' : 'xỉu',
            do_tin_cay: predict.confidence + "%",
            thong_ke: {
                tong_du_doan: stats.totalPredictions,
                dung: stats.totalCorrect,
                sai: stats.totalWrong,
                ti_le_dung: accuracy + "%",
                chuoi_thang_hien_tai: stats.currentWinStreak,
                chuoi_thua_hien_tai: stats.currentLoseStreak,
                chuoi_thang_max: stats.maxWinStreak,
                chuoi_thua_max: stats.maxLoseStreak
            }
        };
        console.log("JSON:", JSON.stringify(result, null, 2));
        res.json(result);
    } catch (err) {
        console.log("ERROR:", err.message);
        const accuracy = stats.totalPredictions > 0 ? ((stats.totalCorrect / stats.totalPredictions) * 100).toFixed(1) : '0.0';
        res.json({
            id: "AnhKhoidzai Sunwin",
            phien_truoc: 0, xuc_xac1: 0, xuc_xac2: 0, xuc_xac3: 0, tong: 0,
            ket_qua: "tài", pattern: "[Lỗi fetch API]",
            phien_hien_tai: 0, du_doan: "tài", do_tin_cay: "52%",
            thong_ke: {
                tong_du_doan: stats.totalPredictions,
                dung: stats.totalCorrect, sai: stats.totalWrong,
                ti_le_dung: accuracy + "%",
                chuoi_thang_hien_tai: stats.currentWinStreak,
                chuoi_thua_hien_tai: stats.currentLoseStreak,
                chuoi_thang_max: stats.maxWinStreak,
                chuoi_thua_max: stats.maxLoseStreak
            }
        });
    }
});

app.get("/taixiu", async (req, res) => {
    try {
        const response = await axios.get(API_URL, { timeout: 15000 });
        const rawData = response.data;
        const history = normalizeData(rawData);
        for (const item of history) {
            if (item.phien > lastPhien) {
                globalHistory.push(item);
                masterV2.addSession(item);
                lastPhien = item.phien;
                if (lastPrediction && globalHistory.length >= 2) {
                    const prevSession = globalHistory[globalHistory.length - 2];
                    updateStats(lastPrediction, prevSession.ket_qua);
                    masterV2.feedback(prevSession.ket_qua === 'tài' ? 'Tài' : 'Xỉu');
                    lastPrediction = null;
                }
            }
        }
        if (globalHistory.length > 200) globalHistory = globalHistory.slice(-200);
        const latest = history[history.length - 1];
        const pattern = analyzeCau(history);
        const predict = masterV2.predict();
        lastPrediction = predict.prediction === 'Tài' ? 'tài' : 'xỉu';
        const accuracy = stats.totalPredictions > 0 ? ((stats.totalCorrect / stats.totalPredictions) * 100).toFixed(1) : '0.0';
        res.json({
            id: "AnhKhoidzai Sunwin",
            phien_truoc: latest.phien,
            xuc_xac1: latest.x1, xuc_xac2: latest.x2, xuc_xac3: latest.x3,
            tong: latest.tong, ket_qua: latest.ket_qua,
            pattern: pattern,
            phien_hien_tai: latest.phien + 1,
            du_doan: predict.prediction === 'Tài' ? 'tài' : 'xỉu',
            do_tin_cay: predict.confidence + "%",
            thong_ke: {
                tong_du_doan: stats.totalPredictions,
                dung: stats.totalCorrect, sai: stats.totalWrong,
                ti_le_dung: accuracy + "%",
                chuoi_thang_hien_tai: stats.currentWinStreak,
                chuoi_thua_hien_tai: stats.currentLoseStreak,
                chuoi_thang_max: stats.maxWinStreak,
                chuoi_thua_max: stats.maxLoseStreak
            }
        });
    } catch (err) {
        const accuracy = stats.totalPredictions > 0 ? ((stats.totalCorrect / stats.totalPredictions) * 100).toFixed(1) : '0.0';
        res.json({
            id: "AnhKhoidzai Sunwin",
            phien_truoc: 0, xuc_xac1: 0, xuc_xac2: 0, xuc_xac3: 0, tong: 0,
            ket_qua: "tài", pattern: "[Lỗi]",
            phien_hien_tai: 0, du_doan: "tài", do_tin_cay: "52%",
            thong_ke: {
                tong_du_doan: stats.totalPredictions,
                dung: stats.totalCorrect, sai: stats.totalWrong,
                ti_le_dung: accuracy + "%",
                chuoi_thang_hien_tai: stats.currentWinStreak,
                chuoi_thua_hien_tai: stats.currentLoseStreak,
                chuoi_thang_max: stats.maxWinStreak,
                chuoi_thua_max: stats.maxLoseStreak
            }
        });
    }
});

app.get("/stats", (req, res) => {
    const accuracy = stats.totalPredictions > 0 ? ((stats.totalCorrect / stats.totalPredictions) * 100).toFixed(1) : '0.0';
    res.json({
        tong_du_doan: stats.totalPredictions,
        dung: stats.totalCorrect,
        sai: stats.totalWrong,
        ti_le_dung: accuracy + "%",
        chuoi_thang_hien_tai: stats.currentWinStreak,
        chuoi_thua_hien_tai: stats.currentLoseStreak,
        chuoi_thang_max: stats.maxWinStreak,
        chuoi_thua_max: stats.maxLoseStreak,
        lich_su_gan_day: stats.predictionLog.slice(-10).reverse()
    });
});

app.listen(PORT, () => {
    console.log("🎯 Server Master V2 chạy tại port " + PORT);
    console.log("🔗 API: " + API_URL);
});
