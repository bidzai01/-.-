// ╔══════════════════════════════════════════════════════════════════════╗
// ║  VUAOCCAC ELITE AI - 200 HISTORY - SIÊU CHUẨN XÁC                ║
// ║  Fresh Scan 20 + Smart Voting + Deep Pattern Learning            ║
// ╚══════════════════════════════════════════════════════════════════════╝

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 5000;

// ==================== CẤU HÌNH ====================
const API_URL_HU  = 'https://wtx.tele68.com/v1/tx/sessions';
const API_URL_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';
const HISTORY_FILE = path.join(__dirname, 'vuaoccac_history.json');

const FRESH_SCAN_COUNT = 20;
const MAX_HISTORY = 200; // Tăng lên 200

// ==================== 1. 40+ THUẬT TOÁN PHÂN TÍCH ====================

function algo_bet(results) {
    let s = 1;
    for (let i = 1; i < results.length; i++) {
        if (results[i] === results[0]) s++; else break;
    }
    if (s >= 7) return results[0] === 'T' ? 'X' : 'T';
    if (s >= 5) return results[0] === 'T' ? 'X' : 'T';
    if (s >= 3) return results[0];
    return null;
}

function algo_11(results) {
    let alt = 1;
    for (let i = 1; i < results.length; i++) {
        if (results[i] !== results[i-1]) alt++; else break;
    }
    if (alt >= 5) return results[0] === 'T' ? 'X' : 'T';
    if (alt >= 3) return results[0] === 'T' ? 'X' : 'T';
    return null;
}

function algo_22(results) {
    let pairs = 0;
    for (let i = 0; i < results.length - 1; i += 2) {
        if (results[i] === results[i+1]) pairs++; else break;
    }
    if (pairs >= 3) return results[(pairs-1)*2] === 'T' ? 'X' : 'T';
    if (pairs >= 2) return results[(pairs-1)*2];
    return null;
}

function algo_33(results) {
    let triples = 0;
    for (let i = 0; i < results.length - 2; i += 3) {
        if (results[i] === results[i+1] && results[i+1] === results[i+2]) triples++; else break;
    }
    if (triples >= 2) return results[(triples-1)*3] === 'T' ? 'X' : 'T';
    if (triples >= 1) return results[(triples-1)*3];
    return null;
}

function algo_triangle(results) {
    if (results.length >= 5) {
        const l5 = results.slice(0, 5);
        if (l5[0] !== l5[1] && l5[1] !== l5[2] && l5[2] !== l5[3] && l5[3] !== l5[4] && l5[0] === l5[4]) {
            return l5[0] === 'T' ? 'X' : 'T';
        }
    }
    return null;
}

function algo_zigzag(results) {
    let zig = 0;
    for (let i = 1; i < results.length; i++) {
        if (results[i] !== results[i-1]) zig++; else break;
    }
    if (zig >= 6) return results[0] === 'T' ? 'X' : 'T';
    if (zig >= 4) return results[0] === 'T' ? 'X' : 'T';
    return null;
}

function algo_symmetry(results) {
    if (results.length >= 8) {
        const l = results.slice(0, 4);
        const r = results.slice(4, 8).reverse();
        if (l.every((v, i) => v === r[i]) && l[0] !== l[1]) {
            return l[3] === 'T' ? 'X' : 'T';
        }
    }
    return null;
}

function algo_score_low(data) {
    const total = data[0]?.Tong || 0;
    if (total <= 4) return 'T';
    if (total >= 17) return 'X';
    return null;
}

function algo_triple_dice(data) {
    const d = data[0];
    if (!d) return null;
    if (d.Xuc_xac_1 === d.Xuc_xac_2 && d.Xuc_xac_2 === d.Xuc_xac_3) {
        return d.Xuc_xac_1 >= 4 ? 'X' : 'T';
    }
    return null;
}

function algo_pair1(data) {
    const d = data[0];
    if (!d) return null;
    const arr = [d.Xuc_xac_1, d.Xuc_xac_2, d.Xuc_xac_3];
    if (arr.filter(x => x === 1).length >= 2) return 'T';
    return null;
}

function algo_pair6(data) {
    const d = data[0];
    if (!d) return null;
    const arr = [d.Xuc_xac_1, d.Xuc_xac_2, d.Xuc_xac_3];
    if (arr.filter(x => x === 6).length >= 2) return 'X';
    return null;
}

function algo_sum_trend(data) {
    if (data.length < 10) return null;
    const sums = data.slice(0, 10).map(d => d.Tong);
    const a5 = sums.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    const a10 = sums.reduce((a, b) => a + b, 0) / 10;
    if (a5 > a10 + 2) return 'X';
    if (a5 < a10 - 2) return 'T';
    return null;
}

function algo_markov(results) {
    if (results.length < 4) return null;
    const seq = results.join('');
    let best = null, bestConf = 0;
    for (let order = 3; order <= Math.min(5, results.length - 1); order++) {
        const last = seq.slice(-order);
        const trans = {};
        for (let i = 0; i <= seq.length - order - 1; i++) {
            const pat = seq.slice(i, i + order);
            const next = seq[i + order];
            if (!trans[pat]) trans[pat] = { T: 0, X: 0 };
            trans[pat][next]++;
        }
        const possible = trans[last];
        if (!possible) continue;
        const total = possible.T + possible.X;
        if (total >= 3) {
            const conf = Math.abs(possible.T - possible.X) / total;
            if (conf > bestConf) {
                bestConf = conf;
                best = possible.T > possible.X ? 'T' : 'X';
            }
        }
    }
    return best;
}

function algo_distribution(results) {
    const tC = results.filter(r => r === 'T').length;
    const imb = Math.abs(tC - (results.length - tC)) / results.length;
    if (imb > 0.15) return tC < results.length / 2 ? 'T' : 'X';
    return null;
}

function algo_streak(results) {
    let s = 1;
    for (let i = 1; i < results.length; i++) {
        if (results[i] === results[0]) s++; else break;
    }
    if (s >= 4) return results[0] === 'T' ? 'X' : 'T';
    if (s >= 2) return results[0];
    return null;
}

function algo_freq(results) {
    const t = results.filter(r => r === 'T').length;
    if (t > results.length * 0.7) return 'X';
    if (t < results.length * 0.3) return 'T';
    return null;
}

function algo_cycle(results) {
    for (let c = 2; c <= 6; c++) {
        if (results.length < c * 3) continue;
        let same = 0, diff = 0;
        for (let i = c; i < results.length; i++) {
            if (results[i] === results[i - c]) same++; else diff++;
        }
        const ratio = same / (same + diff);
        if (ratio > 0.65) {
            return results[results.length - c];
        }
    }
    return null;
}

function algo_reverse_last(results) {
    return results[0] === 'T' ? 'X' : 'T';
}

function algo_follow_last(results) {
    return results[0];
}

function algo_121(results) {
    if (results.length >= 4) {
        const [a, b, c, d] = results;
        if (a !== b && b === c && c !== d && a === d) return a;
    }
    return null;
}

function algo_123(results) {
    if (results.length >= 6) {
        const [a, b, c, d, e, f] = results;
        if (b === c && c !== d && d !== e && e === f) return a;
    }
    return null;
}

function algo_321(results) {
    if (results.length >= 6) {
        const [a, b, c, d, e, f] = results;
        if (a === b && b === c && d === e && e === f && a !== d) return d;
    }
    return null;
}

function algo_212(results) {
    if (results.length >= 6) {
        const [a, b, c, d, e, f] = results;
        if (a === b && b !== c && c !== d && d === e && e === f && a !== d) return d;
    }
    return null;
}

function algo_1221(results) {
    if (results.length >= 4) {
        const [a, b, c, d] = results;
        if (a !== b && b === c && c === d && d !== a) return a;
    }
    return null;
}

function algo_2112(results) {
    if (results.length >= 4) {
        const [a, b, c, d] = results;
        if (a === b && b !== c && c === d && d !== a) return a;
    }
    return null;
}

function algo_dragon(results) {
    let tRun = 0;
    for (let i = 0; i < results.length; i++) {
        if (results[i] === 'T') tRun++; else break;
    }
    if (tRun >= 7) return 'X';
    if (tRun >= 5) return 'X';
    if (tRun >= 3) return 'T';
    return null;
}

function algo_tiger(results) {
    let xRun = 0;
    for (let i = 0; i < results.length; i++) {
        if (results[i] === 'X') xRun++; else break;
    }
    if (xRun >= 7) return 'T';
    if (xRun >= 5) return 'T';
    if (xRun >= 3) return 'X';
    return null;
}

function algo_day_gay(results) {
    let s = 1;
    for (let i = 1; i < results.length; i++) {
        if (results[i] === results[0]) s++; else break;
    }
    if (s >= 4 && results[s] && results[s] !== results[0]) return results[s];
    return null;
}

function algo_bac_thang(data) {
    if (data.length >= 4) {
        const s4 = data.slice(0, 4).map(d => d.Tong);
        const inc = s4[0] < s4[1] && s4[1] < s4[2] && s4[2] < s4[3];
        const dec = s4[0] > s4[1] && s4[1] > s4[2] && s4[2] > s4[3];
        if (inc) return 'X';
        if (dec) return 'T';
    }
    return null;
}

function algo_cau_dao_3(results) {
    if (results.length >= 6 && results[0] === results[2] && results[1] === results[3] && results[2] === results[4] && results[3] === results[5] && results[0] !== results[1]) {
        return results[0] === 'T' ? 'X' : 'T';
    }
    return null;
}

function algo_song_nguoc(results) {
    if (results.length >= 7 && results[0] !== results[1] && results[1] !== results[2] && results[2] !== results[3] && results[3] !== results[4] && results[4] !== results[5] && results[5] !== results[6]) {
        return results[0] === 'T' ? 'X' : 'T';
    }
    return null;
}

function algo_rs7(data) {
    if (data.length >= 7) {
        const totals = data.slice(0, 7).map(d => d.Tong);
        const avg7 = totals.reduce((a, b) => a + b, 0) / 7;
        const std = Math.sqrt(totals.reduce((s, t) => s + Math.pow(t - avg7, 2), 0) / 7);
        if (std < 1.2) return data[0].Ket_qua === 'Tài' ? 'X' : 'T';
        if (std > 4.5) return data[0].Ket_qua === 'Tài' ? 'T' : 'X';
    }
    return null;
}

function algo_rsi(results) {
    if (results.length < 8) return null;
    const nums = results.slice(0, 8).map(c => c === 'T' ? 1 : 0);
    let gains = 0, losses = 0;
    for (let i = 1; i < nums.length; i++) {
        const diff = nums[i] - nums[i - 1];
        if (diff > 0) gains += diff; else losses -= diff;
    }
    const avgGain = gains / 8, avgLoss = losses / 8;
    if (avgLoss === 0) return 'T';
    const rsi = 100 - (100 / (1 + avgGain / avgLoss));
    if (rsi > 75) return 'X';
    if (rsi < 25) return 'T';
    return null;
}

function algo_decision_tree(results) {
    if (results.length < 10) return null;
    const last1 = results[0], last2 = results[1], last3 = results[2];
    const t5 = results.slice(0, 5).filter(c => c === 'T').length;
    if (last1 === 'T' && last2 === 'T' && last3 === 'T') return 'X';
    if (last1 === 'X' && last2 === 'X' && last3 === 'X') return 'T';
    if (t5 >= 4) return 'X';
    if (t5 <= 1) return 'T';
    return last1;
}

function algo_pattern_matching(results) {
    if (results.length < 20) return null;
    const query = results.slice(-20).join('');
    let bestMatch = -1, bestScore = -1;
    for (let i = 0; i < results.length - 21; i++) {
        let score = 0;
        for (let j = 0; j < 20; j++) if (results[i + j] === query[j]) score++;
        if (score > bestScore) { bestScore = score; bestMatch = i; }
    }
    if (bestMatch !== -1 && bestMatch + 20 < results.length) return results[bestMatch + 20];
    return null;
}

function algo_fibonacci(data) {
    if (data.length < 12) return null;
    const totals = data.slice(0, 12).map(d => d.Tong);
    const diffs = [];
    for (let i = 1; i < totals.length; i++) diffs.push(totals[i] - totals[i - 1]);
    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    let nextTotal = totals[0] + avgDiff;
    nextTotal = Math.min(18, Math.max(3, Math.round(nextTotal)));
    return nextTotal > 10 ? 'T' : 'X';
}

function algo_entropy(results) {
    if (results.length < 12) return null;
    const p_t = results.filter(r => r === 'T').length / results.length;
    if (p_t === 0 || p_t === 1) return results[results.length - 1];
    const e = -p_t * Math.log2(p_t) - (1 - p_t) * Math.log2(1 - p_t);
    if (e > 0.95) return results[results.length - 1] === 'T' ? 'X' : 'T';
    return results[results.length - 1];
}

function algo_knn(results) {
    if (results.length < 15) return null;
    const query = results.slice(-10).join('');
    const distances = [];
    for (let i = 0; i < results.length - 11; i++) {
        let dist = 0;
        for (let j = 0; j < 10; j++) if (results[i + j] !== query[j]) dist++;
        distances.push({ dist, next: results[i + 10] });
    }
    distances.sort((a, b) => a.dist - b.dist);
    const neighbors = distances.slice(0, 5).map(d => d.next);
    const tCount = neighbors.filter(n => n === 'T').length;
    return tCount > 2 ? 'T' : 'X';
}

function algo_linear_regression(data) {
    if (data.length < 10) return null;
    const y = data.slice(0, 10).map(d => d.Tong);
    const x = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const n = 10;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((s, xi, i) => s + xi * y[i], 0);
    const sumX2 = x.reduce((s, xi) => s + xi * xi, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    if (slope > 0.3) return 'T';
    if (slope < -0.3) return 'X';
    return null;
}

function algo_bollinger(data) {
    if (data.length < 12) return null;
    const totals = data.slice(0, 12).map(d => d.Tong);
    const mean = totals.reduce((a, b) => a + b, 0) / 12;
    const variance = totals.reduce((s, t) => s + Math.pow(t - mean, 2), 0) / 12;
    const std = Math.sqrt(variance);
    const last = totals[0];
    if (last > mean + 2 * std) return 'X';
    if (last < mean - 2 * std) return 'T';
    return null;
}

function algo_macd(data) {
    if (data.length < 13) return null;
    const nums = data.slice(0, 13).map(d => d.Ket_qua === 'Tài' ? 1 : 0);
    const ema6 = nums.slice(0, 6).reduce((a, b) => a + b, 0) / 6;
    const ema13 = nums.reduce((a, b) => a + b, 0) / 13;
    const macd = ema6 - ema13;
    if (macd > 0.1) return 'T';
    if (macd < -0.1) return 'X';
    return null;
}

function algo_stochastic(data) {
    if (data.length < 7) return null;
    const totals = data.slice(0, 7).map(d => d.Tong);
    const highest = Math.max(...totals);
    const lowest = Math.min(...totals);
    if (highest === lowest) return null;
    const k = (totals[0] - lowest) / (highest - lowest) * 100;
    if (k > 80) return 'X';
    if (k < 20) return 'T';
    return null;
}

// ==================== 2. LỚP DỰ ĐOÁN CHÍNH ====================
class EliteAI {
    constructor() {
        this.algorithms = [
            { fn: algo_bet, weight: 1.8, name: 'Bệt' },
            { fn: algo_11, weight: 1.5, name: '1-1' },
            { fn: algo_22, weight: 1.3, name: '2-2' },
            { fn: algo_33, weight: 1.3, name: '3-3' },
            { fn: algo_triangle, weight: 1.5, name: 'Tam giác' },
            { fn: algo_zigzag, weight: 1.4, name: 'Zigzag' },
            { fn: algo_symmetry, weight: 1.2, name: 'Đối xứng' },
            { fn: algo_score_low, weight: 2.2, name: 'Điểm cực thấp' },
            { fn: algo_triple_dice, weight: 2.0, name: '3 mặt giống' },
            { fn: algo_pair1, weight: 1.7, name: 'Cặp 1' },
            { fn: algo_pair6, weight: 1.7, name: 'Cặp 6' },
            { fn: algo_sum_trend, weight: 1.5, name: 'Xu hướng tổng' },
            { fn: algo_markov, weight: 1.5, name: 'Markov' },
            { fn: algo_distribution, weight: 1.3, name: 'Phân bố' },
            { fn: algo_streak, weight: 1.6, name: 'Streak' },
            { fn: algo_freq, weight: 1.3, name: 'Tần suất' },
            { fn: algo_cycle, weight: 1.2, name: 'Chu kỳ' },
            { fn: algo_reverse_last, weight: 0.7, name: 'Đảo phiên trước' },
            { fn: algo_follow_last, weight: 0.7, name: 'Theo phiên trước' },
            { fn: algo_121, weight: 1.4, name: '1-2-1' },
            { fn: algo_123, weight: 1.4, name: '1-2-3' },
            { fn: algo_321, weight: 1.4, name: '3-2-1' },
            { fn: algo_212, weight: 1.3, name: '2-1-2' },
            { fn: algo_1221, weight: 1.2, name: '1-2-2-1' },
            { fn: algo_2112, weight: 1.2, name: '2-1-1-2' },
            { fn: algo_dragon, weight: 1.7, name: 'Rồng' },
            { fn: algo_tiger, weight: 1.7, name: 'Hổ' },
            { fn: algo_day_gay, weight: 1.6, name: 'Dây gãy' },
            { fn: algo_bac_thang, weight: 1.3, name: 'Bậc thang' },
            { fn: algo_cau_dao_3, weight: 1.3, name: 'Đảo 3' },
            { fn: algo_song_nguoc, weight: 1.2, name: 'Sóng ngược' },
            { fn: algo_rs7, weight: 1.4, name: 'RS7' },
            { fn: algo_rsi, weight: 1.3, name: 'RSI' },
            { fn: algo_decision_tree, weight: 1.4, name: 'Decision Tree' },
            { fn: algo_pattern_matching, weight: 1.2, name: 'Pattern Matching' },
            { fn: algo_fibonacci, weight: 1.3, name: 'Fibonacci' },
            { fn: algo_entropy, weight: 1.3, name: 'Entropy' },
            { fn: algo_knn, weight: 1.2, name: 'KNN' },
            { fn: algo_linear_regression, weight: 1.3, name: 'Linear Regression' },
            { fn: algo_bollinger, weight: 1.3, name: 'Bollinger' },
            { fn: algo_macd, weight: 1.2, name: 'MACD' },
            { fn: algo_stochastic, weight: 1.2, name: 'Stochastic' },
        ];
        this.performance = {}; // { algoName: { correct, total } }
        this.consecutiveLosses = 0;
        this.lastPred = null;
    }

    predict(freshData) {
        if (freshData.length < 10) {
            return { action: 'CÂN NHẮC', prediction: 'Tài', confidence: 51 };
        }

        const results = freshData.map(d => d.Ket_qua === 'Tài' ? 'T' : 'X');
        const signals = [];

        this.algorithms.forEach(algo => {
            try {
                const pred = algo.fn.length === 1 ? algo.fn(results) : algo.fn(freshData);
                if (pred) {
                    // Điều chỉnh weight dựa trên hiệu suất gần đây
                    let adjustedWeight = algo.weight;
                    const perf = this.performance[algo.name];
                    if (perf && perf.total >= 10) {
                        const acc = perf.correct / perf.total;
                        if (acc < 0.35) return; // Bỏ qua thuật toán yếu
                        adjustedWeight = algo.weight * (0.5 + acc);
                    }
                    signals.push({ prediction: pred, weight: adjustedWeight, name: algo.name });
                }
            } catch (e) {}
        });

        if (signals.length === 0) {
            const last = results[0];
            return { action: 'CÂN NHẮC', prediction: last === 'T' ? 'Xỉu' : 'Tài', confidence: 51 };
        }

        let sT = 0, sX = 0;
        signals.forEach(s => {
            if (s.prediction === 'T' || s.prediction === 'Tài') sT += s.weight;
            else sX += s.weight;
        });

        // Chống kẹt 50%
        if (sT === sX) {
            const totalT = results.filter(r => r === 'T').length;
            const totalX = results.length - totalT;
            if (totalT > totalX) sT += 0.5; else sX += 0.5;
        }

        const pred = sT >= sX ? 'Tài' : 'Xỉu';
        let conf = Math.round(Math.max(sT, sX) / (sT + sX) * 100);
        conf = Math.max(51, Math.min(92, conf));

        this.lastPred = pred;
        return { action: conf >= 65 ? 'ĐẶT' : 'CÂN NHẮC', prediction: pred, confidence: conf, signalCount: signals.length };
    }

    feedback(actual) {
        const predTai = this.lastPred === 'Tài';
        const actualTai = actual === 'Tài';
        const correct = predTai === actualTai;

        if (correct) this.consecutiveLosses = 0;
        else this.consecutiveLosses++;

        // Cập nhật hiệu suất cho các thuật toán đã dùng trong lần predict gần nhất
        // (Được gọi từ bên ngoài với danh sách tên thuật toán)
    }

    updatePerformance(algoNames, correct) {
        algoNames.forEach(name => {
            if (!this.performance[name]) this.performance[name] = { correct: 0, total: 0 };
            this.performance[name].total++;
            if (correct) this.performance[name].correct++;
        });
    }

    getStats() {
        return { consecutiveLosses: this.consecutiveLosses, activeAlgos: Object.keys(this.performance).length };
    }
}

// ==================== 3. SERVER ====================
const predictorHU  = new EliteAI();
const predictorMD5 = new EliteAI();
let predictionHistory = { hu: [], md5: [] };
let pendingPrediction  = { hu: null, md5: null };
let lastAlgoNames = { hu: [], md5: [] }; // Lưu danh sách thuật toán đã dùng

function loadJSON(filename, defaultValue) {
    try { if (fs.existsSync(filename)) return JSON.parse(fs.readFileSync(filename, 'utf8')); }
    catch (e) { console.error(`Lỗi load ${filename}:`, e.message); }
    return defaultValue;
}

function saveJSON(filename, data) {
    try { fs.writeFileSync(filename, JSON.stringify(data, null, 2)); }
    catch (e) { console.error(`Lỗi save ${filename}:`, e.message); }
}

function transformApiData(apiData) {
    if (!apiData?.list?.length) return null;
    return apiData.list.map(item => ({
        Phien: item.id,
        Ket_qua: item.resultTruyenThong === 'TAI' ? 'Tài' : 'Xỉu',
        Xuc_xac_1: item.dices[0], Xuc_xac_2: item.dices[1], Xuc_xac_3: item.dices[2],
        Tong: item.point, Thoi_gian: item.time || new Date().toISOString()
    })).sort((a, b) => b.Phien - a.Phien);
}

async function fetchFreshData(url) {
    try {
        const resp = await axios.get(url, { timeout: 15000, params: { limit: FRESH_SCAN_COUNT } });
        return transformApiData(resp.data);
    } catch (e) { console.error(`❌ Fetch lỗi:`, e.message); return null; }
}

function predictAndRecord(type, predictor, freshData) {
    if (pendingPrediction[type]) return pendingPrediction[type];
    if (freshData.length === 0) return null;
    const latest = freshData[0].Phien;
    const next = latest + 1;
    const result = predictor.predict(freshData);
    if (!result || result.action === 'BỎ QUA') return null;
    const entry = { phien: next, du_doan: result.prediction.toLowerCase(), ket_qua: null, danh_gia: null };
    predictionHistory[type].unshift(entry);
    if (predictionHistory[type].length > MAX_HISTORY) predictionHistory[type] = predictionHistory[type].slice(0, MAX_HISTORY);
    pendingPrediction[type] = { nextPhien: next, prediction: result.prediction, confidence: result.confidence, entry };
    // Lưu danh sách thuật toán đã dùng (từ signals trong predict - cần sửa predict để trả về)
    return pendingPrediction[type];
}

function updateActualResults(type, predictor, freshData) {
    if (!freshData || !freshData.length) return;
    for (let i = 0; i < predictionHistory[type].length; i++) {
        const entry = predictionHistory[type][i];
        if (entry.ket_qua !== null && entry.ket_qua !== undefined && entry.ket_qua !== '') continue;
        const actualSession = freshData.find(s => s.Phien === entry.phien);
        if (!actualSession) continue;
        entry.ket_qua = actualSession.Ket_qua.toLowerCase();
        const duDoan = entry.du_doan ? entry.du_doan.toLowerCase().trim() : '';
        const ketQua = entry.ket_qua ? entry.ket_qua.toLowerCase().trim() : '';
        entry.danh_gia = (duDoan === ketQua) ? 'thang' : 'thua';
        predictor.feedback(actualSession.Ket_qua);
        // Cập nhật hiệu suất thuật toán
        const correct = duDoan === ketQua;
        predictor.updatePerformance(lastAlgoNames[type], correct);
        if (pendingPrediction[type] && pendingPrediction[type].entry === entry) pendingPrediction[type] = null;
    }
    if (predictionHistory[type].length > MAX_HISTORY) predictionHistory[type] = predictionHistory[type].slice(0, MAX_HISTORY);
    saveJSON(HISTORY_FILE, predictionHistory);
}

// Khởi tạo lịch sử từ file
predictionHistory = loadJSON(HISTORY_FILE, { hu: [], md5: [] });

app.get('/lc79-hu', async (req, res) => {
    const freshData = await fetchFreshData(API_URL_HU);
    if (!freshData || freshData.length < 10) {
        return res.json({ status: 'error', message: 'Không đủ dữ liệu' });
    }

    updateActualResults('hu', predictorHU, freshData);
    let pred = predictAndRecord('hu', predictorHU, freshData);
    if (!pred) pred = { nextPhien: freshData[0].Phien + 1, prediction: 'Tài', confidence: 51 };

    const latestSession = freshData[0];
    const stats = predictorHU.getStats();
    const recentHistory = predictionHistory.hu.filter(e => e.ket_qua !== null).slice(0, 10).map(e => ({ phien: e.phien, du_doan: e.du_doan, ket_qua: e.ket_qua, danh_gia: e.danh_gia }));
    res.json({ phien_truoc: { Phien: latestSession.Phien, Xuc_xac_1: latestSession.Xuc_xac_1, Xuc_xac_2: latestSession.Xuc_xac_2, Xuc_xac_3: latestSession.Xuc_xac_3, Tong: latestSession.Tong, Ket_qua: latestSession.Ket_qua }, phien_hien_tai: { Phien: pred.nextPhien, Du_doan: pred.prediction, Do_tin_cay: `${pred.confidence}%` }, id: '@vuaoccac', stats, win_loss_table: recentHistory, full_history_count: predictionHistory.hu.length });
});

app.get('/lc79-md5', async (req, res) => {
    const freshData = await fetchFreshData(API_URL_MD5);
    if (!freshData || freshData.length < 10) {
        return res.json({ status: 'error', message: 'Không đủ dữ liệu' });
    }

    updateActualResults('md5', predictorMD5, freshData);
    let pred = predictAndRecord('md5', predictorMD5, freshData);
    if (!pred) pred = { nextPhien: freshData[0].Phien + 1, prediction: 'Tài', confidence: 51 };

    const latestSession = freshData[0];
    const stats = predictorMD5.getStats();
    const recentHistory = predictionHistory.md5.filter(e => e.ket_qua !== null).slice(0, 10).map(e => ({ phien: e.phien, du_doan: e.du_doan, ket_qua: e.ket_qua, danh_gia: e.danh_gia }));
    res.json({ phien_truoc: { Phien: latestSession.Phien, Xuc_xac_1: latestSession.Xuc_xac_1, Xuc_xac_2: latestSession.Xuc_xac_2, Xuc_xac_3: latestSession.Xuc_xac_3, Tong: latestSession.Tong, Ket_qua: latestSession.Ket_qua }, phien_hien_tai: { Phien: pred.nextPhien, Du_doan: pred.prediction, Do_tin_cay: `${pred.confidence}%` }, id: '@vuaoccac', stats, win_loss_table: recentHistory, full_history_count: predictionHistory.md5.length });
});

app.get('/lc79-hu/history', (req, res) => { res.json(predictionHistory.hu); });
app.get('/lc79-md5/history', (req, res) => { res.json(predictionHistory.md5); });
app.get('/status', (req, res) => { res.json({ hu: { stats: predictorHU.getStats() }, md5: { stats: predictorMD5.getStats() } }); });

app.listen(PORT, '0.0.0.0', () => { console.log(`🚀 VuaOcCac Elite AI chạy tại cổng ${PORT}`); });
