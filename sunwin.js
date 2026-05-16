const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const API_URL = "https://sunlol-zv7x.onrender.com/data";

// ======================================================
// FILE LƯU TRỮ VĨNH VIỄN
// ======================================================
const DATA_FILE = path.join(__dirname, "legendary_db.json");

function saveDB(data) {
    try { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); } catch (e) {}
}

function loadDB() {
    try { if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); } catch (e) {}
    return null;
}

// ======================================================
// FORMAT DATA
// ======================================================
function normalizeData(data) {
    if (!Array.isArray(data)) data = [data];
    return data.map(item => {
        const d1 = item.xuc_xac_1 || item.x1 || 0;
        const d2 = item.xuc_xac_2 || item.x2 || 0;
        const d3 = item.xuc_xac_3 || item.x3 || 0;
        const tong = item.tong || item.total || (d1 + d2 + d3);
        const ketQua = (item.ket_qua || item.result || (tong >= 11 ? "tài" : "xỉu")).toLowerCase();
        return {
            phien: item.phien || item.session || item.id || 0,
            x1: d1, x2: d2, x3: d3,
            xuc_xac_1: d1, xuc_xac_2: d2, xuc_xac_3: d3,
            tong: tong,
            ket_qua: ketQua === "tài" ? "tài" : "xỉu",
            result: ketQua === "tài" ? "Tài" : "Xỉu",
            dice: [d1, d2, d3]
        };
    }).filter(item => item.phien > 0 && item.tong >= 3 && item.tong <= 18);
}

// ======================================================
// 🌟 LEGENDARY PREDICTOR - HUYỀN THOẠI
// ======================================================
class LegendaryPredictor {
    constructor() {
        this.history = [];
        this.predictions = [];
        this.accuracy = { correct: 0, total: 0 };
        this.winStreak = 0;
        this.maxWinStreak = 0;
        this.loseStreak = 0;
        
        // Trọng số thông minh tự tối ưu
        this.smartWeights = {
            biet: 1.0, cau: 1.0, rong_ho: 1.2, dice_tong: 1.5,
            dice_triple: 1.8, dice_pair: 1.3, dice_hl: 1.0,
            dice_trans: 1.1, score: 1.2, trend: 1.0, pattern: 1.1, special: 1.3
        };
        
        this.loadFromFile();
        console.log('🌟 LEGENDARY PREDICTOR: HUYỀN THOẠI ĐÃ THỨC TỈNH');
    }

    loadFromFile() {
        let saved = loadDB();
        if (saved) {
            this.smartWeights = saved.smartWeights || this.smartWeights;
            this.accuracy = saved.accuracy || { correct: 0, total: 0 };
            this.maxWinStreak = saved.maxWinStreak || 0;
        }
    }

    saveToFile() {
        saveDB({
            smartWeights: this.smartWeights,
            accuracy: this.accuracy,
            maxWinStreak: this.maxWinStreak,
            totalPredictions: this.predictions.length
        });
    }

    // ============================================
    // HELPER
    // ============================================
    getResults() { return this.history.map(h => h.result === 'Tài' ? 'T' : 'X'); }
    getScores() { return this.history.map(h => h.tong || (h.dice ? h.dice.reduce((a, b) => a + b, 0) : 0)); }

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
        
        // Bệt siêu dài
        if (streak >= 10) {
            signals.push({ p: last === 'T' ? 'X' : 'T', c: 96, w: 2.5, s: 'biet_sieu_dai', r: `Bệt ${streak} - Gãy cao` });
        } else if (streak >= 7) {
            signals.push({ p: last === 'T' ? 'X' : 'T', c: 88 + (streak - 7) * 2, w: 2.2, s: 'biet_dai', r: `Bệt dài ${streak}` });
        } else if (streak >= 5) {
            let bp = this.calcBreakProb(results, last, streak);
            signals.push({ p: bp > 0.55 ? (last === 'T' ? 'X' : 'T') : last, c: 70 + streak * 2, w: 1.8, s: 'biet_trung_binh', r: `Bệt ${streak}` });
        } else if (streak >= 3) {
            signals.push({ p: last, c: 55 + streak * 3, w: 1.3, s: 'biet_ngan', r: `Bệt ngắn ${streak}` });
        }
        
        // Rồng
        let tRun = 0;
        for (let i = n - 1; i >= 0 && results[i] === 'T'; i--) tRun++;
        if (tRun >= 8) signals.push({ p: 'X', c: 95, w: 2.8, s: 'rong_dai', r: `Rồng ${tRun}` });
        else if (tRun >= 6) signals.push({ p: 'X', c: 85, w: 2.2, s: 'rong', r: `Rồng ${tRun}` });
        else if (tRun >= 4) signals.push({ p: 'T', c: 68, w: 1.2, s: 'rong_ngan', r: `Rồng ngắn ${tRun}` });
        
        // Hổ
        let xRun = 0;
        for (let i = n - 1; i >= 0 && results[i] === 'X'; i--) xRun++;
        if (xRun >= 8) signals.push({ p: 'T', c: 95, w: 2.8, s: 'ho_dai', r: `Hổ ${xRun}` });
        else if (xRun >= 6) signals.push({ p: 'T', c: 85, w: 2.2, s: 'ho', r: `Hổ ${xRun}` });
        else if (xRun >= 4) signals.push({ p: 'X', c: 68, w: 1.2, s: 'ho_ngan', r: `Hổ ngắn ${xRun}` });
        
        // Bệt kép
        if (n >= 20) {
            let allStreaks = this.extractAllStreaks(results);
            if (allStreaks.length >= 2) {
                let l2 = allStreaks.slice(-2);
                if (l2[0].type !== l2[1].type) {
                    let diff = Math.abs(l2[0].len - l2[1].len);
                    if (diff <= Math.max(l2[0].len, l2[1].len) * 0.3) {
                        let avg = (l2[0].len + l2[1].len) / 2, cl = 1;
                        for (let i = n - 2; i >= 0; i--) { if (results[i] === last) cl++; else break; }
                        signals.push({ p: cl < avg ? last : (last === 'T' ? 'X' : 'T'), c: 74, w: 1.6, s: 'biet_kep', r: 'Bệt kép cân bằng' });
                    }
                }
            }
        }
        
        return signals;
    }

    calcBreakProb(results, result, streak) {
        let same = 0, longer = 0, cur = 1;
        for (let i = 1; i < results.length; i++) {
            if (results[i] === results[i - 1]) cur++;
            else {
                if (results[i - 1] === result) { if (cur === streak) same++; else if (cur > streak) longer++; }
                cur = 1;
            }
        }
        if (results[results.length - 1] === result) { if (cur === streak) same++; else if (cur > streak) longer++; }
        let total = same + longer;
        return total > 0 ? same / total : 0.5;
    }

    extractAllStreaks(results) {
        let all = [], cur = 1, ct = results[0];
        for (let i = 1; i < results.length; i++) {
            if (results[i] === ct) cur++;
            else { if (cur >= 3) all.push({ type: ct, len: cur }); ct = results[i]; cur = 1; }
        }
        if (cur >= 3) all.push({ type: ct, len: cur });
        return all;
    }

    // ============================================
    // 2. PHÂN TÍCH CẦU SIÊU CHUẨN
    // ============================================
    analyzeCau(results) {
        const n = results.length;
        if (n < 4) return [];
        const signals = [];
        const last = results[n - 1];
        
        // Cầu 1-1
        let altLen = 0;
        for (let i = n - 1; i >= 1; i--) { if (results[i] !== results[i - 1]) altLen++; else break; }
        if (altLen >= 3) {
            signals.push({ p: last === 'T' ? 'X' : 'T', c: Math.min(92, 65 + altLen * 2), w: 0.8 + altLen * 0.15, s: 'cau_11', r: `Cầu 1-1 (${altLen + 1} phiên)` });
        }
        
        // Cầu 2-2
        if (n >= 8) {
            let seg = results.slice(-8);
            let is22 = true;
            for (let i = 0; i < 8; i += 2) if (seg[i] !== seg[i + 1]) { is22 = false; break; }
            if (is22 && seg[0] !== seg[2]) {
                let phase = n % 2;
                signals.push({ p: phase === 0 ? seg[7] : (seg[7] === 'T' ? 'X' : 'T'), c: 82, w: 1.5, s: 'cau_22', r: 'Cầu 2-2' });
            }
        }
        
        // Cầu 3-3
        if (n >= 12) {
            let seg = results.slice(-12);
            let is33 = true;
            for (let i = 0; i < 12; i += 3) {
                let block = seg.slice(i, i + 3);
                if (block.length === 3 && !block.every(v => v === block[0])) { is33 = false; break; }
            }
            if (is33 && seg[0] !== seg[3]) {
                let phase = n % 3;
                signals.push({ p: phase === 0 ? (seg[11] === 'T' ? 'X' : 'T') : seg[11], c: 84, w: 1.4, s: 'cau_33', r: 'Cầu 3-3' });
            }
        }
        
        // 1-2-3 & 3-2-1
        if (n >= 6) {
            let l6 = results.slice(-6).join('');
            if (l6 === 'TXXTTT') signals.push({ p: 'X', c: 77, w: 1.2, s: 'cau_123', r: 'Cầu 1-2-3' });
            if (l6 === 'XTTXXX') signals.push({ p: 'T', c: 77, w: 1.2, s: 'cau_123', r: 'Cầu 1-2-3' });
            if (l6 === 'TTTXXT') signals.push({ p: 'X', c: 76, w: 1.2, s: 'cau_321', r: 'Cầu 3-2-1' });
            if (l6 === 'XXXTTX') signals.push({ p: 'T', c: 76, w: 1.2, s: 'cau_321', r: 'Cầu 3-2-1' });
        }
        
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
        
        return signals;
    }

    // ============================================
    // 3. PHÂN TÍCH XÚC XẮC
    // ============================================
    analyzeDice() {
        const n = this.history.length;
        if (n < 3) return [];
        const signals = [];
        const last = this.history[n - 1];
        if (!last.dice || !last.dice[0]) return signals;
        
        const lastSum = last.dice.reduce((a, b) => a + b, 0);
        const lastTriple = last.dice.join(',');
        
        // Tổng cực đoan
        if (lastSum >= 17) signals.push({ p: 'X', c: 94, w: 2.5, s: 'dice_sum_17', r: `Tổng ${lastSum} - cực cao` });
        else if (lastSum >= 15) signals.push({ p: 'X', c: 78, w: 1.6, s: 'dice_sum_15', r: `Tổng ${lastSum} - cao` });
        if (lastSum <= 4) signals.push({ p: 'T', c: 94, w: 2.5, s: 'dice_sum_4', r: `Tổng ${lastSum} - cực thấp` });
        else if (lastSum <= 6) signals.push({ p: 'T', c: 72, w: 1.4, s: 'dice_sum_6', r: `Tổng ${lastSum} - thấp` });
        
        // Bộ ba
        let tripleCount = 0, tripleTai = 0;
        for (let i = 0; i < n - 1; i++) {
            if (!this.history[i].dice) continue;
            if (this.history[i].dice.join(',') === lastTriple) { tripleCount++; if (this.history[i + 1].result === 'Tài') tripleTai++; }
        }
        if (tripleCount >= 3) {
            let prob = tripleTai / tripleCount;
            signals.push({ p: prob > 0.5 ? 'T' : 'X', c: Math.round(50 + Math.abs(prob - 0.5) * 90), w: 2.0, s: 'dice_triple', r: `Bộ ba ${lastTriple} (${tripleCount} lần)` });
        }
        
        // Cặp
        let pairs = [`${last.dice[0]},${last.dice[1]}`, `${last.dice[1]},${last.dice[2]}`, `${last.dice[0]},${last.dice[2]}`];
        let pairCount = 0, pairTai = 0;
        for (let i = 0; i < n - 1; i++) {
            if (!this.history[i].dice) continue;
            let hp = [`${this.history[i].dice[0]},${this.history[i].dice[1]}`, `${this.history[i].dice[1]},${this.history[i].dice[2]}`, `${this.history[i].dice[0]},${this.history[i].dice[2]}`];
            if (hp.some(h => pairs.includes(h))) { pairCount++; if (this.history[i + 1].result === 'Tài') pairTai++; }
        }
        if (pairCount >= 5) {
            let prob = pairTai / pairCount;
            signals.push({ p: prob > 0.5 ? 'T' : 'X', c: Math.round(50 + Math.abs(prob - 0.5) * 65), w: 1.4, s: 'dice_pair', r: `Cặp khớp ${pairCount} lần` });
        }
        
        // Tổng sau tổng
        let sumAfter = {};
        for (let i = 0; i < n - 1; i++) {
            if (!this.history[i].dice || !this.history[i + 1].dice) continue;
            let s = this.history[i].dice.reduce((a, b) => a + b, 0);
            if (s === lastSum) {
                let ns = this.history[i + 1].dice.reduce((a, b) => a + b, 0);
                sumAfter[ns] = (sumAfter[ns] || 0) + 1;
            }
        }
        let totalAfter = Object.values(sumAfter).reduce((a, b) => a + b, 0);
        if (totalAfter >= 5) {
            let bestSum = 3, bestCount = 0;
            for (let s = 3; s <= 18; s++) if ((sumAfter[s] || 0) > bestCount) { bestCount = sumAfter[s]; bestSum = s; }
            signals.push({ p: bestSum >= 11 ? 'T' : 'X', c: Math.round(50 + (bestCount / totalAfter) * 45), w: 1.2, s: 'dice_sum_after', r: `Sau ${lastSum} -> ${bestSum}` });
        }
        
        return signals;
    }

    // ============================================
    // 4. PHÂN TÍCH ĐIỂM & XU HƯỚNG
    // ============================================
    analyzeScoreAndTrend(results, scores) {
        const n = results.length;
        if (n < 5) return [];
        const signals = [];
        const last = results[n - 1];
        const lastScore = scores[n - 1];
        
        // Điểm cực đoan
        if (lastScore >= 17) signals.push({ p: 'X', c: 94, w: 2.5, s: 'score_17', r: 'Điểm >= 17' });
        else if (lastScore >= 15) signals.push({ p: 'X', c: 75, w: 1.5, s: 'score_15', r: 'Điểm >= 15' });
        if (lastScore <= 4) signals.push({ p: 'T', c: 94, w: 2.5, s: 'score_4', r: 'Điểm <= 4' });
        else if (lastScore <= 6) signals.push({ p: 'T', c: 70, w: 1.3, s: 'score_6', r: 'Điểm <= 6' });
        
        // MA Cross
        if (n >= 10) {
            let ma5 = scores.slice(-5).reduce((a, b) => a + b, 0) / 5;
            let ma10 = scores.slice(-10).reduce((a, b) => a + b, 0) / 10;
            let diff = ma5 - ma10;
            if (Math.abs(diff) > 2.5) {
                signals.push({ p: diff > 0 ? 'T' : 'X', c: 60 + Math.abs(diff) * 3, w: 1.1, s: 'ma_cross', r: `MA5 ${diff > 0 ? '>' : '<'} MA10` });
            }
        }
        
        // Xu hướng đa khung
        for (let window of [5, 10, 15, 20]) {
            if (n < window) continue;
            let seg = results.slice(-window);
            let tCount = seg.filter(r => r === 'T').length;
            let ratio = tCount / window;
            if (ratio >= 0.75) signals.push({ p: 'X', c: 60 + ratio * 25, w: 1.0 + ratio * 0.5, s: `trend_over_${window}`, r: `Quá mua ${window} phiên` });
            else if (ratio <= 0.25) signals.push({ p: 'T', c: 60 + (1 - ratio) * 25, w: 1.0 + (1 - ratio) * 0.5, s: `trend_under_${window}`, r: `Quá bán ${window} phiên` });
        }
        
        // Tần suất đảo
        if (n >= 10) {
            let sw = 0;
            for (let i = n - 9; i < n; i++) if (results[i] !== results[i - 1]) sw++;
            if (sw >= 8) signals.push({ p: last === 'T' ? 'X' : 'T', c: 72, w: 1.3, s: 'switch_vhigh', r: `Đảo rất nhiều ${sw}/9` });
            else if (sw >= 6) signals.push({ p: last === 'T' ? 'X' : 'T', c: 65, w: 1.1, s: 'switch_high', r: `Đảo nhiều ${sw}/9` });
        }
        
        // 5 phiên giống nhau
        let last5 = results.slice(-5);
        if (last5.every(r => r === 'T')) signals.push({ p: 'X', c: 82, w: 1.6, s: 'all_tai_5', r: '5 phiên toàn Tài' });
        else if (last5.every(r => r === 'X')) signals.push({ p: 'T', c: 82, w: 1.6, s: 'all_xiu_5', r: '5 phiên toàn Xỉu' });
        
        return signals;
    }

    // ============================================
    // 5. PATTERN MATCHING
    // ============================================
    analyzePattern(results) {
        const n = results.length;
        const signals = [];
        for (let len of [3, 4, 5, 6, 7]) {
            if (n <= len) continue;
            let pattern = results.slice(-len).join('');
            let counts = { T: 0, X: 0 };
            for (let i = 0; i < n - len; i++) {
                if (results.slice(i, i + len).join('') === pattern) counts[results[i + len]]++;
            }
            let total = counts.T + counts.X;
            if (total >= Math.max(3, 10 - len)) {
                let prob = counts.T / total;
                signals.push({ p: prob > 0.5 ? 'T' : 'X', c: Math.round(Math.min(90, 50 + Math.abs(prob - 0.5) * (110 - len * 8))), w: Math.max(0.5, 1.8 - len * 0.15), s: `pattern_${len}`, r: `Pattern ${len} (${total} lần)` });
            }
        }
        return signals;
    }

    // ============================================
    // 🎯 DỰ ĐOÁN HUYỀN THOẠI
    // ============================================
    predict() {
        if (this.history.length < 5) return { prediction: 'Cần thêm dữ liệu', confidence: 0, wait: true };

        let results = this.getResults();
        let scores = this.getScores();

        let allSignals = [
            ...this.analyzeBiet(results, scores),
            ...this.analyzeCau(results),
            ...this.analyzeDice(),
            ...this.analyzeScoreAndTrend(results, scores),
            ...this.analyzePattern(results)
        ];

        if (allSignals.length === 0) {
            return { prediction: results[results.length - 1] === 'T' ? 'Xỉu' : 'Tài', confidence: 50 };
        }

        allSignals.sort((a, b) => (b.w * b.c) - (a.w * a.c));
        let topSignals = allSignals.slice(0, 30);

        let scoreT = 0, scoreX = 0, totalW = 0;
        for (let s of topSignals) {
            let groupKey = s.s.split('_')[0];
            let smartW = this.smartWeights[groupKey] || 1.0;
            let w = s.w * (s.c / 100) * smartW;
            if (s.p === 'T') scoreT += w; else scoreX += w;
            totalW += w;
        }

        if (totalW === 0) {
            return { prediction: results[results.length - 1] === 'T' ? 'Xỉu' : 'Tài', confidence: 50 };
        }

        let probT = scoreT / totalW;
        let finalPred = probT > 0.5 ? 'T' : 'X';
        let confidence = Math.round(Math.abs(probT - 0.5) * 2 * 100);
        confidence = Math.max(52, Math.min(98, confidence));

        let top5 = topSignals.slice(0, 5), top10 = topSignals.slice(0, 10);
        if (top10.every(s => s.p === top10[0].p)) confidence = Math.min(98, confidence + 15);
        else if (top5.every(s => s.p === top5[0].p)) confidence = Math.min(98, confidence + 8);

        this.predictions.push({
            prediction: finalPred === 'T' ? 'Tài' : 'Xỉu',
            confidence,
            topTypes: topSignals.slice(0, 5).map(s => s.s)
        });
        if (this.predictions.length > 500) this.predictions.shift();

        return {
            prediction: finalPred === 'T' ? 'Tài' : 'Xỉu',
            confidence,
            totalSignals: allSignals.length
        };
    }

    addSession(sessionData) {
        let result = sessionData.result || sessionData.ket_qua || '';
        if (result === 'Tài' || result === 'T') result = 'Tài';
        else if (result === 'Xỉu' || result === 'X') result = 'Xỉu';
        else return;

        this.history.push({
            result: result,
            tong: sessionData.tong || 0,
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
        this.accuracy.total++;
        if (isCorrect) {
            this.accuracy.correct++;
            this.winStreak++;
            this.loseStreak = 0;
            if (this.winStreak > this.maxWinStreak) this.maxWinStreak = this.winStreak;
            if (lastPred.topTypes) {
                for (let t of lastPred.topTypes) {
                    let key = t.split('_')[0];
                    if (this.smartWeights[key] !== undefined) {
                        this.smartWeights[key] = Math.min(3.0, this.smartWeights[key] * 1.04);
                    }
                }
            }
        } else {
            this.loseStreak++;
            this.winStreak = 0;
            if (lastPred.topTypes) {
                for (let t of lastPred.topTypes) {
                    let key = t.split('_')[0];
                    if (this.smartWeights[key] !== undefined) {
                        this.smartWeights[key] = Math.max(0.3, this.smartWeights[key] * 0.96);
                    }
                }
            }
        }
        if (this.accuracy.total % 20 === 0) this.saveToFile();
    }
}

// ======================================================
// KHỞI TẠO AI
// ======================================================
const legendaryAI = new LegendaryPredictor();

// ======================================================
// ANALYZE CAU DETAIL
// ======================================================
function analyzeCauDetail(history) {
    if (history.length < 10) return "[Đang thu thập dữ liệu...]";
    let results = history.map(h => h.result === 'Tài' ? 'T' : 'X');
    let last10 = results.slice(-10);
    let patternStr = last10.join("");
    let cauTypes = [];

    let streak = 1, lastResult = last10[last10.length - 1];
    for (let i = last10.length - 2; i >= 0; i--) { if (last10[i] === lastResult) streak++; else break; }
    if (streak >= 3) cauTypes.push("Bệt " + streak + " " + (lastResult === 'T' ? 'Tài' : 'Xỉu'));

    let is11 = true;
    for (let i = 1; i < last10.length; i++) if (last10[i] === last10[i - 1]) { is11 = false; break; }
    if (is11) cauTypes.push("Cầu 1-1");

    let tCount = last10.filter(r => r === 'T').length;
    if (cauTypes.length === 0) {
        if (tCount >= 7) cauTypes.push("Tài mạnh");
        else if (tCount <= 3) cauTypes.push("Xỉu mạnh");
        else if (tCount >= 6) cauTypes.push("Nghiêng Tài");
        else if (tCount <= 4) cauTypes.push("Nghiêng Xỉu");
        else cauTypes.push("Cân bằng");
    }

    return "[Cầu " + cauTypes.join(', ') + "] - " + patternStr;
}

// ======================================================
// QUÉT API
// ======================================================
let lastScannedPhien = 0;

// ======================================================
// API ROUTES
// ======================================================
app.get("/taixiu", async (req, res) => {
    try {
        const response = await axios.get(API_URL, { timeout: 10000 });
        const rawData = response.data;
        const dataArray = rawData.data || rawData || [];
        let history = normalizeData(Array.isArray(dataArray) ? dataArray : [dataArray]);

        for (let item of history) {
            if (item.phien > lastScannedPhien) {
                legendaryAI.addSession(item);
                lastScannedPhien = item.phien;
            }
        }

        if (legendaryAI.history.length < 5) {
            return res.json({
                id: "AnhKhoidzai Sunwin",
                phien_truoc: history.length > 0 ? history[history.length - 1].phien : 0,
                xuc_xac1: history.length > 0 ? history[history.length - 1].x1 : 0,
                xuc_xac2: history.length > 0 ? history[history.length - 1].x2 : 0,
                xuc_xac3: history.length > 0 ? history[history.length - 1].x3 : 0,
                tong: history.length > 0 ? history[history.length - 1].tong : 0,
                ket_qua: history.length > 0 ? history[history.length - 1].ket_qua : "tài",
                pattern: "[Đang học - cần 5 phiên...]",
                phien_hien_tai: history.length > 0 ? history[history.length - 1].phien + 1 : 0,
                du_doan: "tài",
                do_tin_cay: "52%"
            });
        }

        let latest = history[history.length - 1];
        let pattern = analyzeCauDetail(history);
        let predict = legendaryAI.predict();

        res.json({
            id: "AnhKhoidzai Sunwin",
            phien_truoc: latest.phien,
            xuc_xac1: latest.x1, xuc_xac2: latest.x2, xuc_xac3: latest.x3,
            tong: latest.tong, ket_qua: latest.ket_qua,
            pattern: pattern,
            phien_hien_tai: latest.phien + 1,
            du_doan: predict.prediction === 'Tài' ? 'tài' : 'xỉu',
            do_tin_cay: predict.confidence + "%"
        });

    } catch (err) {
        res.json({ id: "AnhKhoidzai Sunwin", phien_truoc: 0, xuc_xac1: 0, xuc_xac2: 0, xuc_xac3: 0, tong: 0, ket_qua: "tài", pattern: "[Đang kết nối...]", phien_hien_tai: 0, du_doan: "tài", do_tin_cay: "52%" });
    }
});

app.get("/", async (req, res) => {
    try {
        const response = await axios.get(API_URL, { timeout: 10000 });
        const rawData = response.data;
        const dataArray = rawData.data || rawData || [];
        let history = normalizeData(Array.isArray(dataArray) ? dataArray : [dataArray]);

        for (let item of history) {
            if (item.phien > lastScannedPhien) {
                legendaryAI.addSession(item);
                lastScannedPhien = item.phien;
            }
        }

        if (legendaryAI.history.length < 5) {
            return res.json({
                id: "AnhKhoidzai Sunwin",
                phien_truoc: history.length > 0 ? history[history.length - 1].phien : 0,
                xuc_xac1: history.length > 0 ? history[history.length - 1].x1 : 0,
                xuc_xac2: history.length > 0 ? history[history.length - 1].x2 : 0,
                xuc_xac3: history.length > 0 ? history[history.length - 1].x3 : 0,
                tong: history.length > 0 ? history[history.length - 1].tong : 0,
                ket_qua: history.length > 0 ? history[history.length - 1].ket_qua : "tài",
                pattern: "[Đang học - cần 5 phiên...]",
                phien_hien_tai: history.length > 0 ? history[history.length - 1].phien + 1 : 0,
                du_doan: "tài",
                do_tin_cay: "52%"
            });
        }

        let latest = history[history.length - 1];
        let pattern = analyzeCauDetail(history);
        let predict = legendaryAI.predict();

        let result = {
            id: "AnhKhoidzai Sunwin",
            phien_truoc: latest.phien,
            xuc_xac1: latest.x1, xuc_xac2: latest.x2, xuc_xac3: latest.x3,
            tong: latest.tong, ket_qua: latest.ket_qua,
            pattern: pattern,
            phien_hien_tai: latest.phien + 1,
            du_doan: predict.prediction === 'Tài' ? 'tài' : 'xỉu',
            do_tin_cay: predict.confidence + "%"
        };

        console.log("JSON:", JSON.stringify(result, null, 2));
        res.json(result);

    } catch (err) {
        res.json({ id: "AnhKhoidzai Sunwin", phien_truoc: 0, xuc_xac1: 0, xuc_xac2: 0, xuc_xac3: 0, tong: 0, ket_qua: "tài", pattern: "[Đang kết nối...]", phien_hien_tai: 0, du_doan: "tài", do_tin_cay: "52%" });
    }
});

// ======================================================
// AUTO SCAN
// ======================================================
async function autoScan() {
    console.log("🌟 Bắt đầu quét API mỗi 1 giây...");
    setInterval(async () => {
        try {
            const response = await axios.get(API_URL, { timeout: 5000 });
            const rawData = response.data;
            const dataArray = rawData.data || rawData || [];
            let history = normalizeData(Array.isArray(dataArray) ? dataArray : [dataArray]);

            for (let item of history) {
                if (item.phien > lastScannedPhien) {
                    legendaryAI.addSession(item);
                    lastScannedPhien = item.phien;
                    console.log(`📡 Phiên mới: #${item.phien} | ${item.ket_qua} | ${item.x1}-${item.x2}-${item.x3} = ${item.tong}`);
                }
            }

            if (legendaryAI.predictions.length > 0 && history.length > 0) {
                let latest = history[history.length - 1];
                let lastPred = legendaryAI.predictions[legendaryAI.predictions.length - 1];
                if (!lastPred.actual && lastPred.prediction !== 'Cần thêm dữ liệu') {
                    legendaryAI.feedback(latest.ket_qua === 'tài' ? 'Tài' : 'Xỉu');
                }
            }
        } catch (e) {}
    }, 1000);
}

app.listen(PORT, () => {
    console.log("🌟 Server Legendary chạy tại port " + PORT);
    autoScan();
});
