const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const API_URL = "https://apivip-anhkhoi-dzaivcl.onrender.com/data";

// ======================================================
// FILE LƯU TRỮ
// ======================================================
const DATA_FILE = path.join(__dirname, "infinity_db.json");

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
// ♾️ INFINITY PREDICTOR - VÔ CỰC SIÊU CHUẨN
// ======================================================
class InfinityPredictor {
    constructor() {
        this.history = [];
        this.predictions = [];
        this.accuracy = { correct: 0, total: 0 };
        this.winStreak = 0;
        this.maxWinStreak = 0;
        this.loseStreak = 0;

        // Bộ lọc dữ liệu kép
        this.dualMemory = {
            win: { patterns: new Map(), sumHistory: [] },
            lose: { patterns: new Map(), sumHistory: [] }
        };

        // Phân tích từng viên xúc xắc
        this.diceAnalysis = {
            d1: { freq: {1:0,2:0,3:0,4:0,5:0,6:0}, transitions: {}, hotFace: 1, coldFace: 1 },
            d2: { freq: {1:0,2:0,3:0,4:0,5:0,6:0}, transitions: {}, hotFace: 1, coldFace: 1 },
            d3: { freq: {1:0,2:0,3:0,4:0,5:0,6:0}, transitions: {}, hotFace: 1, coldFace: 1 },
            tripleRepeat: new Map(),
            sumMomentum: [],
            faceStreaks: { d1: {}, d2: {}, d3: {} }
        };

        // Trọng số cầu
        this.cauWeights = new Map();

        this.loadFromFile();
        console.log('♾️ INFINITY PREDICTOR: VÔ CỰC ĐÃ KÍCH HOẠT');
    }

    loadFromFile() {
        let saved = loadDB();
        if (saved) {
            this.accuracy = saved.accuracy || { correct: 0, total: 0 };
            this.maxWinStreak = saved.maxWinStreak || 0;
            if (saved.cauWeights) {
                for (let [k, v] of Object.entries(saved.cauWeights)) {
                    this.cauWeights.set(k, v);
                }
            }
        }
    }

    saveToFile() {
        saveDB({
            accuracy: this.accuracy,
            maxWinStreak: this.maxWinStreak,
            cauWeights: Object.fromEntries(this.cauWeights),
            totalPredictions: this.predictions.length
        });
    }

    // ============================================
    // HELPER
    // ============================================
    getResults() { return this.history.map(h => h.result === 'Tài' ? 'T' : 'X'); }
    getScores() { return this.history.map(h => h.tong || (h.dice ? h.dice.reduce((a, b) => a + b, 0) : 0)); }

    // ============================================
    // CẬP NHẬT PHÂN TÍCH XÚC XẮC
    // ============================================
    updateDiceAnalysis(d1, d2, d3, result) {
        const diceNames = ['d1', 'd2', 'd3'];
        const dice = [d1, d2, d3];

        // Tần suất
        this.diceAnalysis.d1.freq[d1]++;
        this.diceAnalysis.d2.freq[d2]++;
        this.diceAnalysis.d3.freq[d3]++;

        // Chuyển đổi
        if (this.history.length >= 2) {
            const prev = this.history[this.history.length - 2];
            if (prev.dice) {
                for (let i = 0; i < 3; i++) {
                    const key = `${prev.dice[i]}->${dice[i]}`;
                    const diceObj = this.diceAnalysis[diceNames[i]];
                    diceObj.transitions[key] = (diceObj.transitions[key] || 0) + 1;
                }
            }
        }

        // Bộ ba lặp
        const triple = `${d1},${d2},${d3}`;
        this.diceAnalysis.tripleRepeat.set(triple, (this.diceAnalysis.tripleRepeat.get(triple) || 0) + 1);

        // Tổng momentum
        const sum = d1 + d2 + d3;
        this.diceAnalysis.sumMomentum.push(sum);
        if (this.diceAnalysis.sumMomentum.length > 30) this.diceAnalysis.sumMomentum.shift();

        // Streak mặt
        for (let i = 0; i < 3; i++) {
            const face = dice[i];
            const diceObj = this.diceAnalysis[diceNames[i]];
            if (!diceObj.faceStreaks[face]) diceObj.faceStreaks[face] = [];
            let streak = 1;
            for (let j = this.history.length - 1; j >= 0; j--) {
                if (this.history[j].dice && this.history[j].dice[i] === face) streak++;
                else break;
            }
            diceObj.faceStreaks[face].push(streak);
            if (diceObj.faceStreaks[face].length > 20) diceObj.faceStreaks[face].shift();
        }

        // Hot/Cold
        for (let i = 0; i < 3; i++) {
            const diceObj = this.diceAnalysis[diceNames[i]];
            const entries = Object.entries(diceObj.freq);
            if (entries.length > 0) {
                entries.sort((a, b) => b[1] - a[1]);
                diceObj.hotFace = parseInt(entries[0][0]);
                diceObj.coldFace = parseInt(entries[entries.length - 1][0]);
            }
        }

        // Bộ nhớ kép
        const isWin = result === 'Tài' ? (sum >= 11) : (sum < 11);
        const memory = isWin ? this.dualMemory.win : this.dualMemory.lose;
        memory.sumHistory.push(sum);
        if (memory.sumHistory.length > 50) memory.sumHistory.shift();
    }

    // ============================================
    // PHÂN TÍCH TỪNG VIÊN XÚC XẮC
    // ============================================
    predictFromIndividualDice() {
        const signals = [];
        const n = this.history.length;
        if (n < 2) return signals;
        const last = this.history[n - 1];
        if (!last.dice) return signals;

        const diceNames = ['d1', 'd2', 'd3'];
        const predictedDice = [];

        for (let i = 0; i < 3; i++) {
            const currentFace = last.dice[i];
            const diceObj = this.diceAnalysis[diceNames[i]];
            const transitions = diceObj.transitions;
            let bestFace = currentFace, bestCount = 0;
            for (let f = 1; f <= 6; f++) {
                const key = `${currentFace}->${f}`;
                const count = transitions[key] || 0;
                if (count > bestCount) { bestCount = count; bestFace = f; }
            }
            predictedDice.push(bestFace);
        }

        const predictedSum = predictedDice.reduce((a, b) => a + b, 0);
        if (bestCount >= 3) {
            signals.push({ p: predictedSum >= 11 ? 'T' : 'X', c: 50 + Math.min(30, bestCount * 5), w: 1.3, s: 'dice_transition', r: `Chuyển đổi từng viên -> ${predictedSum}` });
        }

        const hotSum = this.diceAnalysis.d1.hotFace + this.diceAnalysis.d2.hotFace + this.diceAnalysis.d3.hotFace;
        signals.push({ p: hotSum >= 11 ? 'T' : 'X', c: 55, w: 0.8, s: 'dice_hot', r: `Hot faces -> ${hotSum}` });

        return signals;
    }

    // ============================================
    // PHÂN TÍCH BỆT
    // ============================================
    analyzeBiet(results) {
        const n = results.length;
        if (n < 2) return [];
        const signals = [];
        const last = results[n - 1];
        let streak = 1;
        for (let i = n - 2; i >= 0; i--) { if (results[i] === last) streak++; else break; }

        if (streak >= 10) signals.push({ p: last === 'T' ? 'X' : 'T', c: 96, w: 2.5, s: 'biet_sieu_dai', r: `Bệt ${streak}` });
        else if (streak >= 7) signals.push({ p: last === 'T' ? 'X' : 'T', c: 88, w: 2.2, s: 'biet_dai', r: `Bệt dài ${streak}` });
        else if (streak >= 5) signals.push({ p: last === 'T' ? 'X' : 'T', c: 75, w: 1.8, s: 'biet_trung_binh', r: `Bệt ${streak}` });
        else if (streak >= 3) signals.push({ p: last, c: 58 + streak * 3, w: 1.3, s: 'biet_ngan', r: `Bệt ngắn ${streak}` });

        let tRun = 0, xRun = 0;
        for (let i = n - 1; i >= 0 && results[i] === 'T'; i--) tRun++;
        for (let i = n - 1; i >= 0 && results[i] === 'X'; i--) xRun++;
        if (tRun >= 8) signals.push({ p: 'X', c: 95, w: 2.8, s: 'rong_dai', r: `Rồng ${tRun}` });
        else if (tRun >= 6) signals.push({ p: 'X', c: 85, w: 2.2, s: 'rong', r: `Rồng ${tRun}` });
        else if (tRun >= 4) signals.push({ p: 'T', c: 68, w: 1.2, s: 'rong_ngan', r: `Rồng ngắn ${tRun}` });
        if (xRun >= 8) signals.push({ p: 'T', c: 95, w: 2.8, s: 'ho_dai', r: `Hổ ${xRun}` });
        else if (xRun >= 6) signals.push({ p: 'T', c: 85, w: 2.2, s: 'ho', r: `Hổ ${xRun}` });
        else if (xRun >= 4) signals.push({ p: 'X', c: 68, w: 1.2, s: 'ho_ngan', r: `Hổ ngắn ${xRun}` });

        return signals;
    }

    // ============================================
    // PHÁT HIỆN HÀNG TRĂM LOẠI CẦU
    // ============================================
    detectAllCauTypes(results, scores) {
        const n = results.length;
        const signals = [];
        if (n < 4) return signals;
        const last = results[n - 1];

        // 1-1
        let altCount = 0;
        for (let i = n - 1; i >= 1; i--) { if (results[i] !== results[i - 1]) altCount++; else break; }
        if (altCount >= 3) signals.push({ p: last === 'T' ? 'X' : 'T', c: Math.min(90, 65 + altCount * 2), w: 0.8 + altCount * 0.15, s: 'cau_11', r: `Cầu 1-1 (${altCount + 1})` });

        // 2-2
        if (n >= 8) {
            let seg = results.slice(-8);
            let is22 = true;
            for (let i = 0; i < 8; i += 2) if (seg[i] !== seg[i + 1]) { is22 = false; break; }
            if (is22 && seg[0] !== seg[2]) {
                let phase = n % 2;
                signals.push({ p: phase === 0 ? seg[7] : (seg[7] === 'T' ? 'X' : 'T'), c: 82, w: 1.5, s: 'cau_22', r: 'Cầu 2-2' });
            }
        }

        // 3-3
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

        // Cầu điểm
        if (n >= 5 && scores.length >= 5) {
            let recentScores = scores.slice(-5);
            let avg = recentScores.reduce((a, b) => a + b, 0) / 5;
            if (avg > 13) signals.push({ p: 'X', c: 65, w: 1.1, s: 'cau_dice_high', r: `Điểm TB cao ${avg.toFixed(1)}` });
            else if (avg < 7) signals.push({ p: 'T', c: 65, w: 1.1, s: 'cau_dice_low', r: `Điểm TB thấp ${avg.toFixed(1)}` });
        }

        // Vai đầu vai
        if (scores.length >= 15) {
            let recentScores = scores.slice(-15);
            let peaks = [];
            for (let i = 2; i < recentScores.length - 2; i++) {
                if (recentScores[i] > recentScores[i - 1] && recentScores[i] > recentScores[i - 2] &&
                    recentScores[i] > recentScores[i + 1] && recentScores[i] > recentScores[i + 2]) peaks.push({ val: recentScores[i] });
            }
            if (peaks.length >= 3) {
                let l3 = peaks.slice(-3);
                if (l3[0].val < l3[1].val && l3[2].val < l3[1].val && Math.abs(l3[0].val - l3[2].val) <= 2) {
                    signals.push({ p: 'X', c: 75, w: 1.3, s: 'vai_dau_vai', r: 'Vai đầu vai' });
                }
            }
        }

        return signals;
    }

    // ============================================
    // PHÂN TÍCH XÚC XẮC TỔNG HỢP
    // ============================================
    analyzeDiceTotal() {
        const signals = [];
        const n = this.history.length;
        if (n < 2) return signals;
        const last = this.history[n - 1];
        if (!last.dice || !last.dice[0]) return signals;
        const lastSum = last.dice.reduce((a, b) => a + b, 0);

        if (lastSum >= 17) signals.push({ p: 'X', c: 94, w: 2.5, s: 'dice_sum_17', r: `Tổng ${lastSum}` });
        else if (lastSum >= 15) signals.push({ p: 'X', c: 78, w: 1.6, s: 'dice_sum_15', r: `Tổng ${lastSum}` });
        if (lastSum <= 4) signals.push({ p: 'T', c: 94, w: 2.5, s: 'dice_sum_4', r: `Tổng ${lastSum}` });
        else if (lastSum <= 6) signals.push({ p: 'T', c: 72, w: 1.4, s: 'dice_sum_6', r: `Tổng ${lastSum}` });

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
    // DỰ ĐOÁN TỪ BỘ NHỚ KÉP
    // ============================================
    predictFromDualMemory(results) {
        const signals = [];
        if (results.length < 5) return signals;
        const recentPattern = results.slice(-5).join('');
        const winCount = this.dualMemory.win.patterns.get(recentPattern) || 0;
        const loseCount = this.dualMemory.lose.patterns.get(recentPattern) || 0;
        const total = winCount + loseCount;

        if (total >= 3) {
            const winRatio = winCount / total;
            if (winRatio > 0.6) {
                signals.push({ p: results[results.length - 1], c: 55 + winRatio * 30, w: 1.2, s: 'dual_win', r: `Pattern thắng (${(winRatio*100).toFixed(0)}%)` });
            } else if (winRatio < 0.4) {
                signals.push({ p: results[results.length - 1] === 'T' ? 'X' : 'T', c: 55 + (1 - winRatio) * 30, w: 1.2, s: 'dual_lose', r: `Pattern thua (${((1-winRatio)*100).toFixed(0)}%)` });
            }
        }

        return signals;
    }

    // ============================================
    // 🎯 DỰ ĐOÁN VÔ CỰC
    // ============================================
    predict() {
        const n = this.history.length;
        if (n < 5) return { prediction: 'Cần thêm dữ liệu', confidence: 0, wait: true };

        const results = this.getResults();
        const scores = this.getScores();

        const allSignals = [
            ...this.analyzeBiet(results),
            ...this.detectAllCauTypes(results, scores),
            ...this.analyzeDiceTotal(),
            ...this.predictFromIndividualDice(),
            ...this.predictFromDualMemory(results)
        ];

        if (allSignals.length === 0) {
            return { prediction: results[n - 1] === 'T' ? 'Xỉu' : 'Tài', confidence: 50 };
        }

        allSignals.sort((a, b) => (b.w * b.c) - (a.w * a.c));
        const topSignals = allSignals.slice(0, 40);

        let scoreT = 0, scoreX = 0, totalW = 0;
        for (const s of topSignals) {
            const cauW = this.cauWeights.get(s.s) || 1.0;
            const w = s.w * (s.c / 100) * cauW;
            if (s.p === 'T') scoreT += w; else scoreX += w;
            totalW += w;
        }

        if (totalW === 0) {
            return { prediction: results[n - 1] === 'T' ? 'Xỉu' : 'Tài', confidence: 50 };
        }

        const probT = scoreT / totalW;
        const finalPred = probT > 0.5 ? 'T' : 'X';
        let confidence = Math.round(Math.abs(probT - 0.5) * 2 * 100);
        confidence = Math.max(52, Math.min(98, confidence));

        const top5 = topSignals.slice(0, 5), top10 = topSignals.slice(0, 10);
        if (top10.every(s => s.p === top10[0].p)) confidence = Math.min(98, confidence + 12);
        else if (top5.every(s => s.p === top5[0].p)) confidence = Math.min(98, confidence + 6);

        if (this.loseStreak >= 3) confidence = Math.max(52, confidence - 5);
        if (this.winStreak >= 5) confidence = Math.min(98, confidence + 5);

        this.predictions.push({
            prediction: finalPred === 'T' ? 'Tài' : 'Xỉu',
            confidence,
            topTypes: topSignals.slice(0, 5).map(s => s.s)
        });
        if (this.predictions.length > 500) this.predictions.shift();

        // Cập nhật bộ nhớ kép
        const recentPattern = results.slice(-5).join('');
        const memory = results[n - 1] === 'T' ? this.dualMemory.win : this.dualMemory.lose;
        memory.patterns.set(recentPattern, (memory.patterns.get(recentPattern) || 0) + 1);

        return {
            prediction: finalPred === 'T' ? 'Tài' : 'Xỉu',
            confidence,
            totalSignals: allSignals.length,
            hotFaces: `${this.diceAnalysis.d1.hotFace}-${this.diceAnalysis.d2.hotFace}-${this.diceAnalysis.d3.hotFace}`
        };
    }

    addSession(sessionData) {
        let result = sessionData.result || sessionData.ket_qua || '';
        if (result === 'Tài' || result === 'T') result = 'Tài';
        else if (result === 'Xỉu' || result === 'X') result = 'Xỉu';
        else return;

        const d1 = sessionData.x1 || sessionData.xuc_xac_1 || 0;
        const d2 = sessionData.x2 || sessionData.xuc_xac_2 || 0;
        const d3 = sessionData.x3 || sessionData.xuc_xac_3 || 0;

        this.history.push({
            result: result,
            tong: sessionData.tong || (d1 + d2 + d3),
            dice: [d1, d2, d3],
            timestamp: Date.now()
        });
        if (this.history.length > 3000) this.history = this.history.slice(-2500);

        if (d1 > 0) this.updateDiceAnalysis(d1, d2, d3, result);
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
                    this.cauWeights.set(t, Math.min(3.0, (this.cauWeights.get(t) || 1.0) * 1.05));
                }
            }
        } else {
            this.loseStreak++;
            this.winStreak = 0;
            if (lastPred.topTypes) {
                for (let t of lastPred.topTypes) {
                    this.cauWeights.set(t, Math.max(0.3, (this.cauWeights.get(t) || 1.0) * 0.95));
                }
            }
        }
        if (this.accuracy.total % 20 === 0) this.saveToFile();
    }
}

// ======================================================
// KHỞI TẠO AI
// ======================================================
const infinityAI = new InfinityPredictor();

// ======================================================
// ANALYZE CAU DETAIL
// ======================================================
function analyzeCauDetail(history) {
    if (history.length < 10) return "[Đang thu thập dữ liệu...]";
    let results = history.map(h => h.result === 'Tài' ? 'T' : 'X');
    let last15 = results.slice(-15);
    let patternStr = last15.join("");
    let cauTypes = [];

    let streak = 1, lastResult = last15[last15.length - 1];
    for (let i = last15.length - 2; i >= 0; i--) { if (last15[i] === lastResult) streak++; else break; }
    if (streak >= 3) cauTypes.push("Bệt " + streak + " " + (lastResult === 'T' ? 'Tài' : 'Xỉu'));

    let is11 = true;
    for (let i = 1; i < last15.length; i++) if (last15[i] === last15[i - 1]) { is11 = false; break; }
    if (is11) cauTypes.push("Cầu 1-1");

    let tCount = last15.filter(r => r === 'T').length;
    if (cauTypes.length === 0) {
        if (tCount >= 10) cauTypes.push("Tài mạnh");
        else if (tCount <= 5) cauTypes.push("Xỉu mạnh");
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
                infinityAI.addSession(item);
                lastScannedPhien = item.phien;
            }
        }

        if (infinityAI.history.length < 5) {
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
        let predict = infinityAI.predict();

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
                infinityAI.addSession(item);
                lastScannedPhien = item.phien;
            }
        }

        if (infinityAI.history.length < 5) {
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
        let predict = infinityAI.predict();

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
    console.log("♾️ Bắt đầu quét API mỗi 1 giây...");
    setInterval(async () => {
        try {
            const response = await axios.get(API_URL, { timeout: 5000 });
            const rawData = response.data;
            const dataArray = rawData.data || rawData || [];
            let history = normalizeData(Array.isArray(dataArray) ? dataArray : [dataArray]);

            for (let item of history) {
                if (item.phien > lastScannedPhien) {
                    infinityAI.addSession(item);
                    lastScannedPhien = item.phien;
                }
            }

            if (infinityAI.predictions.length > 0 && history.length > 0) {
                let latest = history[history.length - 1];
                let lastPred = infinityAI.predictions[infinityAI.predictions.length - 1];
                if (!lastPred.actual && lastPred.prediction !== 'Cần thêm dữ liệu') {
                    infinityAI.feedback(latest.ket_qua === 'tài' ? 'Tài' : 'Xỉu');
                }
            }
        } catch (e) {}
    }, 1000);
}

app.listen(PORT, () => {
    console.log("♾️ Server Infinity chạy tại port " + PORT);
    autoScan();
});
