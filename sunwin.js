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
const DATA_FILE = path.join(__dirname, "king_db.json");

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
// SUNWIN ULTIMATE KING AI - CỐT LÕI CHÍNH
// ======================================================
class SunwinKingAI {
    constructor() {
        this.history = [];
        this.predictions = [];
        this.accuracy = { correct: 0, total: 0 };
        this.winStreak = 0;
        this.maxWinStreak = 0;
        this.loseStreak = 0;
        this.layers = {};
        this.layerWeights = {};
        this.loadFromFile();
        this.initAllLayers();
    }

    loadFromFile() {
        let saved = loadDB();
        if (saved) {
            this.layerWeights = saved.layerWeights || {};
            this.accuracy = saved.accuracy || { correct: 0, total: 0 };
        }
    }

    saveToFile() {
        saveDB({
            layerWeights: this.layerWeights,
            accuracy: this.accuracy,
            totalPredictions: this.predictions.length
        });
    }

    addLayer(name, fn, weight = 1.0) {
        this.layers[name] = fn;
        if (!this.layerWeights[name]) this.layerWeights[name] = weight;
    }

    // ============================================
    // KHỞI TẠO TẤT CẢ LAYERS (ĐÃ LỌC TRÙNG)
    // ============================================
    initAllLayers() {
        // === BIỆT (Streak) ===
        for (let len = 3; len <= 8; len++) {
            this.addLayer(`biet_${len}`, () => this.bietLayer(len), 1.0 + len * 0.1);
        }
        this.addLayer('biet_kep', () => this.bietKepLayer(), 1.5);
        this.addLayer('rong', () => this.rongLayer(), 1.4);
        this.addLayer('ho', () => this.hoLayer(), 1.4);

        // === CẦU ===
        this.addLayer('cau_11', () => this.cau11Layer(), 1.3);
        this.addLayer('cau_22', () => this.cau22Layer(), 1.2);
        this.addLayer('cau_33', () => this.cau33Layer(), 1.1);
        this.addLayer('cau_123', () => this.cau123Layer(), 1.1);
        this.addLayer('cau_321', () => this.cau321Layer(), 1.1);
        this.addLayer('zigzag', () => this.zigzagLayer(), 1.0);
        this.addLayer('tam_giac', () => this.tamGiacLayer(), 1.1);

        // === DICE ===
        this.addLayer('dice_triple', () => this.diceTripleLayer(), 1.5);
        this.addLayer('dice_sum', () => this.diceSumLayer(), 1.4);
        this.addLayer('dice_pair', () => this.dicePairLayer(), 1.2);
        this.addLayer('dice_highlow', () => this.diceHighLowLayer(), 1.1);
        this.addLayer('dice_hotcold', () => this.diceHotColdLayer(), 0.9);

        // === SCORE ===
        this.addLayer('score_extreme', () => this.scoreExtremeLayer(), 1.5);
        this.addLayer('score_ma', () => this.scoreMALayer(), 1.0);
        this.addLayer('score_bb', () => this.scoreBBLayer(), 1.0);
        this.addLayer('score_rsi', () => this.scoreRSILayer(), 1.0);

        // === TREND ===
        this.addLayer('trend_5', () => this.trendLayer(5), 1.0);
        this.addLayer('trend_10', () => this.trendLayer(10), 1.1);
        this.addLayer('trend_20', () => this.trendLayer(20), 1.0);
        this.addLayer('switch', () => this.switchLayer(), 1.1);

        // === PATTERN ===
        this.addLayer('pattern_3', () => this.patternLayer(3), 1.2);
        this.addLayer('pattern_5', () => this.patternLayer(5), 1.1);
        this.addLayer('knn', () => this.knnLayer(), 1.0);

        // === SPECIAL ===
        this.addLayer('all_tai', () => this.allTaiLayer(), 1.2);
        this.addLayer('all_xiu', () => this.allXiuLayer(), 1.2);
        this.addLayer('decision_tree', () => this.decisionTreeLayer(), 1.1);
        this.addLayer('super_final', () => this.superFinalLayer(), 2.0);

        console.log(`✅ Đã khởi tạo ${Object.keys(this.layers).length} layers`);
    }

    // ============================================
    // HELPER
    // ============================================
    getResults() { return this.history.map(h => h.result === 'Tài' ? 'T' : 'X'); }
    getScores() { return this.history.map(h => h.tong || (h.dice ? h.dice.reduce((a, b) => a + b, 0) : 0)); }

    calcBreakProb(results, result, streak) {
        let same = 0, longer = 0, cur = 1;
        for (let i = 1; i < results.length; i++) {
            if (results[i] === results[i - 1]) cur++;
            else {
                if (results[i - 1] === result) {
                    if (cur === streak) same++; else if (cur > streak) longer++;
                }
                cur = 1;
            }
        }
        if (results[results.length - 1] === result) {
            if (cur === streak) same++; else if (cur > streak) longer++;
        }
        let total = same + longer;
        return total > 0 ? same / total : 0.5;
    }

    // ============================================
    // BIỆT LAYERS
    // ============================================
    bietLayer(len) {
        let results = this.getResults();
        if (results.length < len) return null;
        let streak = 1, last = results[results.length - 1];
        for (let i = results.length - 2; i >= 0; i--) { if (results[i] === last) streak++; else break; }
        if (streak >= len) {
            let bp = this.calcBreakProb(results, last, streak);
            let pred = bp > 0.55 ? (last === 'T' ? 'X' : 'T') : last;
            return { p: pred, c: Math.min(95, 50 + streak * 4), w: 10 };
        }
        return null;
    }

    bietKepLayer() {
        let results = this.getResults();
        if (results.length < 20) return null;
        let streaks = [], cur = 1;
        for (let i = 1; i < results.length; i++) {
            if (results[i] === results[i - 1]) cur++;
            else { if (cur >= 3) streaks.push({ type: results[i - 1], len: cur }); cur = 1; }
        }
        if (cur >= 3) streaks.push({ type: results[results.length - 1], len: cur });
        if (streaks.length >= 2) {
            let l2 = streaks.slice(-2);
            if (l2[0].type !== l2[1].type && Math.abs(l2[0].len - l2[1].len) <= Math.max(l2[0].len, l2[1].len) * 0.3) {
                let avg = (l2[0].len + l2[1].len) / 2, cl = 1;
                for (let i = results.length - 2; i >= 0; i--) { if (results[i] === results[results.length - 1]) cl++; else break; }
                return { p: cl < avg ? results[results.length - 1] : (results[results.length - 1] === 'T' ? 'X' : 'T'), c: 72, w: 8 };
            }
        }
        return null;
    }

    rongLayer() {
        let results = this.getResults();
        let r = 0;
        for (let i = results.length - 1; i >= 0 && results[i] === 'T'; i--) r++;
        if (r >= 6) return { p: 'X', c: Math.min(95, 78 + r), w: 14 };
        if (r >= 4) return { p: 'T', c: 68 + r, w: 8 };
        return null;
    }

    hoLayer() {
        let results = this.getResults();
        let r = 0;
        for (let i = results.length - 1; i >= 0 && results[i] === 'X'; i--) r++;
        if (r >= 6) return { p: 'T', c: Math.min(95, 78 + r), w: 14 };
        if (r >= 4) return { p: 'X', c: 68 + r, w: 8 };
        return null;
    }

    // ============================================
    // CẦU LAYERS
    // ============================================
    cau11Layer() {
        let results = this.getResults();
        if (results.length < 6) return null;
        let is11 = true;
        for (let i = results.length - 5; i < results.length; i++) {
            if (results[i] === results[i - 1]) { is11 = false; break; }
        }
        if (is11) return { p: results[results.length - 1] === 'T' ? 'X' : 'T', c: 80, w: 10 };
        return null;
    }

    cau22Layer() {
        let results = this.getResults();
        if (results.length < 8) return null;
        let last8 = results.slice(-8);
        let is22 = true;
        for (let i = 0; i < 8; i += 2) if (last8[i] !== last8[i + 1]) { is22 = false; break; }
        if (is22 && last8[0] !== last8[2]) {
            let phase = results.length % 2;
            return { p: phase === 0 ? last8[7] : (last8[7] === 'T' ? 'X' : 'T'), c: 82, w: 9 };
        }
        return null;
    }

    cau33Layer() {
        let results = this.getResults();
        if (results.length < 12) return null;
        let last12 = results.slice(-12);
        let is33 = true;
        for (let i = 0; i < 12; i += 3) {
            if (last12[i] !== last12[i + 1] || last12[i] !== last12[i + 2]) { is33 = false; break; }
        }
        if (is33 && last12[0] !== last12[3]) {
            let phase = results.length % 3;
            return { p: phase === 0 ? (last12[11] === 'T' ? 'X' : 'T') : last12[11], c: 84, w: 8 };
        }
        return null;
    }

    cau123Layer() {
        let results = this.getResults();
        if (results.length < 6) return null;
        let l6 = results.slice(-6).join('');
        if (l6 === "TXXTTT") return { p: 'X', c: 77, w: 8 };
        if (l6 === "XTTXXX") return { p: 'T', c: 77, w: 8 };
        return null;
    }

    cau321Layer() {
        let results = this.getResults();
        if (results.length < 6) return null;
        let l6 = results.slice(-6).join('');
        if (l6 === "TTTXXT") return { p: 'X', c: 76, w: 8 };
        if (l6 === "XXXTTX") return { p: 'T', c: 76, w: 8 };
        return null;
    }

    zigzagLayer() {
        let results = this.getResults();
        if (results.length < 7) return null;
        let seg = results.slice(-7), sw = 0;
        for (let i = 1; i < 7; i++) if (seg[i] !== seg[i - 1]) sw++;
        if (sw >= 5) return { p: results[results.length - 1] === 'T' ? 'X' : 'T', c: 68 + sw * 2, w: 7 };
        return null;
    }

    tamGiacLayer() {
        let results = this.getResults();
        if (results.length < 5) return null;
        let l5 = results.slice(-5).join('');
        if (l5 === "TXTXT") return { p: 'X', c: 80, w: 7 };
        if (l5 === "XTXTX") return { p: 'T', c: 80, w: 7 };
        return null;
    }

    // ============================================
    // DICE LAYERS
    // ============================================
    diceTripleLayer() {
        if (this.history.length < 5) return null;
        let last = this.history[this.history.length - 1];
        if (!last.dice || !last.dice[0]) return null;
        let triple = last.dice.join(',');
        let tc = 0, tt = 0;
        for (let i = 0; i < this.history.length - 1; i++) {
            if (!this.history[i].dice) continue;
            if (this.history[i].dice.join(',') === triple) { tc++; if (this.history[i + 1].result === 'Tài') tt++; }
        }
        if (tc >= 3) { let prob = tt / tc; return { p: prob > 0.5 ? 'T' : 'X', c: 50 + Math.abs(prob - 0.5) * 80, w: 9 }; }
        return null;
    }

    diceSumLayer() {
        if (this.history.length < 5) return null;
        let last = this.history[this.history.length - 1];
        if (!last.dice || !last.dice[0]) return null;
        let sum = last.dice.reduce((a, b) => a + b, 0);
        let sumAfter = {};
        for (let i = 0; i < this.history.length - 1; i++) {
            if (!this.history[i].dice || !this.history[i + 1].dice) continue;
            let s = this.history[i].dice.reduce((a, b) => a + b, 0);
            if (s === sum) {
                let ns = this.history[i + 1].dice.reduce((a, b) => a + b, 0);
                sumAfter[ns] = (sumAfter[ns] || 0) + 1;
            }
        }
        let total = Object.values(sumAfter).reduce((a, b) => a + b, 0);
        if (total >= 5) {
            let bestSum = 3, bestCount = 0;
            for (let s = 3; s <= 18; s++) if ((sumAfter[s] || 0) > bestCount) { bestCount = sumAfter[s]; bestSum = s; }
            return { p: bestSum >= 11 ? 'T' : 'X', c: 50 + (bestCount / total) * 40, w: 8 };
        }
        return null;
    }

    dicePairLayer() {
        if (this.history.length < 5) return null;
        let last = this.history[this.history.length - 1];
        if (!last.dice || !last.dice[0]) return null;
        let p12 = last.dice[0] + '' + last.dice[1];
        let p23 = last.dice[1] + '' + last.dice[2];
        let p13 = last.dice[0] + '' + last.dice[2];
        let pc = 0, pt = 0;
        for (let i = 0; i < this.history.length - 1; i++) {
            if (!this.history[i].dice) continue;
            let hp12 = this.history[i].dice[0] + '' + this.history[i].dice[1];
            let hp23 = this.history[i].dice[1] + '' + this.history[i].dice[2];
            let hp13 = this.history[i].dice[0] + '' + this.history[i].dice[2];
            if ((hp12 === p12 || hp23 === p23 || hp13 === p13) && i + 1 < this.history.length) {
                pc++; if (this.history[i + 1].result === 'Tài') pt++;
            }
        }
        if (pc >= 5) { let prob = pt / pc; return { p: prob > 0.5 ? 'T' : 'X', c: 50 + Math.abs(prob - 0.5) * 55, w: 7 }; }
        return null;
    }

    diceHighLowLayer() {
        if (this.history.length < 5) return null;
        let last = this.history[this.history.length - 1];
        if (!last.dice || !last.dice[0]) return null;
        let hl = last.dice.map(d => d >= 4 ? 'H' : 'L').join('');
        let hlc = 0, hlt = 0;
        for (let i = 0; i < this.history.length - 1; i++) {
            if (!this.history[i].dice) continue;
            let hhl = this.history[i].dice.map(d => d >= 4 ? 'H' : 'L').join('');
            if (hhl === hl && i + 1 < this.history.length) { hlc++; if (this.history[i + 1].result === 'Tài') hlt++; }
        }
        if (hlc >= 5) { let prob = hlt / hlc; return { p: prob > 0.5 ? 'T' : 'X', c: 50 + Math.abs(prob - 0.5) * 45, w: 6 }; }
        return null;
    }

    diceHotColdLayer() {
        if (this.history.length < 20) return null;
        let freq = [{}, {}, {}];
        for (let h of this.history.slice(-20)) {
            if (!h.dice) continue;
            for (let i = 0; i < 3; i++) freq[i][h.dice[i]] = (freq[i][h.dice[i]] || 0) + 1;
        }
        let hotSum = 0;
        for (let i = 0; i < 3; i++) {
            let hotFace = Object.entries(freq[i]).sort((a, b) => b[1] - a[1])[0];
            hotSum += parseInt(hotFace ? hotFace[0] : 3);
        }
        return { p: hotSum >= 11 ? 'T' : 'X', c: 55, w: 5 };
    }

    // ============================================
    // SCORE LAYERS
    // ============================================
    scoreExtremeLayer() {
        let lastScore = this.history[this.history.length - 1]?.tong || (this.history[this.history.length - 1]?.dice?.reduce((a, b) => a + b, 0)) || 0;
        if (lastScore >= 17) return { p: 'X', c: 92, w: 15 };
        if (lastScore >= 15) return { p: 'X', c: 78, w: 9 };
        if (lastScore <= 4) return { p: 'T', c: 92, w: 15 };
        if (lastScore <= 6) return { p: 'T', c: 72, w: 8 };
        return null;
    }

    scoreMALayer() {
        if (this.history.length < 10) return null;
        let scores = this.getScores().slice(-10);
        let ma5 = scores.slice(-5).reduce((a, b) => a + b, 0) / 5;
        let ma10 = scores.reduce((a, b) => a + b, 0) / 10;
        if (ma5 > ma10 + 2) return { p: 'T', c: 64, w: 6 };
        if (ma5 < ma10 - 2) return { p: 'X', c: 64, w: 6 };
        return null;
    }

    scoreBBLayer() {
        if (this.history.length < 10) return null;
        let scores = this.getScores().slice(-10);
        let avg = scores.reduce((a, b) => a + b, 0) / 10;
        let variance = scores.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / 10;
        let std = Math.sqrt(variance);
        let last = scores[scores.length - 1];
        if (last > avg + 2 * std) return { p: 'X', c: 68, w: 6 };
        if (last < avg - 2 * std) return { p: 'T', c: 68, w: 6 };
        return null;
    }

    scoreRSILayer() {
        if (this.history.length < 10) return null;
        let scores = this.getScores().slice(-10);
        let gains = 0, losses = 0;
        for (let i = 1; i < 10; i++) { let diff = scores[i] - scores[i - 1]; if (diff > 0) gains += diff; else losses -= Math.abs(diff); }
        let rs = losses === 0 ? 100 : gains / losses;
        let rsi = 100 - (100 / (1 + rs));
        if (rsi > 70) return { p: 'X', c: 64, w: 5 };
        if (rsi < 30) return { p: 'T', c: 64, w: 5 };
        return null;
    }

    // ============================================
    // TREND LAYERS
    // ============================================
    trendLayer(window) {
        let results = this.getResults();
        if (results.length < window) return null;
        let seg = results.slice(-window);
        let tCount = seg.filter(r => r === 'T').length;
        let ratio = tCount / window;
        if (ratio >= 0.7) return { p: 'X', c: 60 + ratio * 20, w: 7 };
        if (ratio <= 0.3) return { p: 'T', c: 60 + (1 - ratio) * 20, w: 7 };
        return null;
    }

    switchLayer() {
        let results = this.getResults();
        if (results.length < 10) return null;
        let sw = 0;
        for (let i = results.length - 9; i < results.length; i++) if (results[i] !== results[i - 1]) sw++;
        if (sw >= 7) return { p: results[results.length - 1] === 'T' ? 'X' : 'T', c: 68, w: 7 };
        return null;
    }

    // ============================================
    // PATTERN LAYERS
    // ============================================
    patternLayer(len) {
        let results = this.getResults();
        if (results.length < len + 1) return null;
        let pattern = results.slice(-len).join('');
        let nextCounts = { T: 0, X: 0 };
        for (let i = 0; i < results.length - len; i++) {
            if (results.slice(i, i + len).join('') === pattern) nextCounts[results[i + len]]++;
        }
        let total = nextCounts.T + nextCounts.X;
        if (total >= Math.max(3, 8 - len)) {
            let probT = nextCounts.T / total;
            return { p: probT > 0.5 ? 'T' : 'X', c: 50 + Math.abs(probT - 0.5) * (100 - len * 5), w: Math.max(4, 10 - len) };
        }
        return null;
    }

    knnLayer() {
        let results = this.getResults();
        if (results.length < 12) return null;
        let query = results.slice(-10);
        let distances = [];
        for (let i = 0; i < results.length - 10; i++) {
            let seg = results.slice(i, i + 10);
            let dist = 0;
            for (let j = 0; j < 10; j++) if (seg[j] !== query[j]) dist++;
            if (i + 10 < results.length) distances.push({ dist, next: results[i + 10] });
        }
        distances.sort((a, b) => a.dist - b.dist);
        let neighbors = distances.slice(0, 5);
        let tCount = neighbors.filter(n => n.next === 'T').length;
        return { p: tCount > 2.5 ? 'T' : 'X', c: 50 + Math.abs(tCount - 2.5) * 20, w: 6 };
    }

    // ============================================
    // SPECIAL LAYERS
    // ============================================
    allTaiLayer() {
        let results = this.getResults().slice(-5);
        if (results.every(r => r === 'T')) return { p: 'X', c: 85, w: 12 };
        return null;
    }

    allXiuLayer() {
        let results = this.getResults().slice(-5);
        if (results.every(r => r === 'X')) return { p: 'T', c: 85, w: 12 };
        return null;
    }

    decisionTreeLayer() {
        let results = this.getResults();
        if (results.length < 10) return null;
        let l1 = results[results.length - 1], l2 = results[results.length - 2], l3 = results[results.length - 3];
        let t5 = results.slice(-5).filter(r => r === 'T').length;
        if (l1 === 'T' && l2 === 'T' && l3 === 'T') return { p: 'X', c: 75, w: 10 };
        if (l1 === 'X' && l2 === 'X' && l3 === 'X') return { p: 'T', c: 75, w: 10 };
        if (t5 >= 4) return { p: 'X', c: 65, w: 6 };
        if (t5 <= 1) return { p: 'T', c: 65, w: 6 };
        return null;
    }

    superFinalLayer() {
        let results = this.getResults();
        let last = results[results.length - 1];
        let streak = 1;
        for (let i = results.length - 2; i >= 0; i--) { if (results[i] === last) streak++; else break; }
        if (streak >= 10) return { p: last === 'T' ? 'X' : 'T', c: 92, w: 18 };
        let lastScore = this.history[this.history.length - 1]?.tong || (this.history[this.history.length - 1]?.dice?.reduce((a, b) => a + b, 0)) || 0;
        if (streak >= 7 && last === 'T' && lastScore >= 16) return { p: 'X', c: 90, w: 16 };
        if (streak >= 7 && last === 'X' && lastScore <= 5) return { p: 'T', c: 90, w: 16 };
        if (lastScore >= 17) return { p: 'X', c: 92, w: 15 };
        if (lastScore <= 4) return { p: 'T', c: 92, w: 15 };
        return null;
    }

    // ============================================
    // MAIN PREDICT
    // ============================================
    predict() {
        if (this.history.length < 5) return { prediction: 'Cần ít nhất 5 phiên', confidence: 0, wait: true };

        let allPreds = [];
        for (let [name, fn] of Object.entries(this.layers)) {
            try {
                let res = fn();
                if (res && res.p) {
                    allPreds.push({ ...res, layer: name });
                }
            } catch (e) {}
        }

        if (allPreds.length === 0) {
            let last = this.getResults();
            return { prediction: last[last.length - 1] === 'T' ? 'Xỉu' : 'Tài', confidence: 50 };
        }

        allPreds.sort((a, b) => (b.w || 5) * (b.c || 50) - (a.w || 5) * (a.c || 50));
        let topPreds = allPreds.slice(0, 30);

        let voteT = 0, voteX = 0, totalW = 0;
        for (let pred of topPreds) {
            let w = (pred.w || 5) * ((pred.c || 50) / 100);
            if (pred.p === 'T') voteT += w; else voteX += w;
            totalW += w;
        }

        if (totalW === 0) {
            let last = this.getResults();
            return { prediction: last[last.length - 1] === 'T' ? 'Xỉu' : 'Tài', confidence: 50 };
        }

        let probT = voteT / totalW;
        let finalPred = probT > 0.5 ? 'T' : 'X';
        let confidence = Math.round(Math.abs(probT - 0.5) * 2 * 100);
        confidence = Math.max(52, Math.min(98, confidence));

        let top5 = topPreds.slice(0, 5), top10 = topPreds.slice(0, 10);
        if (top10.every(p => p.p === top10[0].p)) confidence = Math.min(98, confidence + 15);
        else if (top5.every(p => p.p === top5[0].p)) confidence = Math.min(98, confidence + 10);

        this.predictions.push({
            prediction: finalPred === 'T' ? 'Tài' : 'Xỉu',
            confidence,
            timestamp: Date.now(),
            topLayers: topPreds.slice(0, 5).map(p => p.layer)
        });
        if (this.predictions.length > 500) this.predictions.shift();

        return {
            prediction: finalPred === 'T' ? 'Tài' : 'Xỉu',
            confidence,
            totalSignals: allPreds.length
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
            if (lastPred.topLayers) {
                for (let layer of lastPred.topLayers) {
                    if (this.layerWeights[layer] !== undefined) {
                        this.layerWeights[layer] = Math.min(5, this.layerWeights[layer] * 1.05);
                    }
                }
            }
        } else {
            this.loseStreak++;
            this.winStreak = 0;
            if (lastPred.topLayers) {
                for (let layer of lastPred.topLayers) {
                    if (this.layerWeights[layer] !== undefined) {
                        this.layerWeights[layer] = Math.max(0.1, this.layerWeights[layer] * 0.95);
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
const kingAI = new SunwinKingAI();

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
                kingAI.addSession(item);
                lastScannedPhien = item.phien;
            }
        }

        if (kingAI.history.length < 5) {
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
        let predict = kingAI.predict();

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
                kingAI.addSession(item);
                lastScannedPhien = item.phien;
            }
        }

        if (kingAI.history.length < 5) {
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
        let predict = kingAI.predict();

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
// AUTO SCAN MỖI 1 GIÂY
// ======================================================
async function autoScan() {
    console.log("Bắt đầu quét API mỗi 1 giây...");
    setInterval(async () => {
        try {
            const response = await axios.get(API_URL, { timeout: 5000 });
            const rawData = response.data;
            const dataArray = rawData.data || rawData || [];
            let history = normalizeData(Array.isArray(dataArray) ? dataArray : [dataArray]);

            for (let item of history) {
                if (item.phien > lastScannedPhien) {
                    kingAI.addSession(item);
                    lastScannedPhien = item.phien;
                }
            }

            // Feedback
            if (kingAI.predictions.length > 0 && history.length > 0) {
                let latest = history[history.length - 1];
                let lastPred = kingAI.predictions[kingAI.predictions.length - 1];
                if (!lastPred.actual && lastPred.prediction !== 'Cần ít nhất 5 phiên') {
                    kingAI.feedback(latest.ket_qua === 'tài' ? 'Tài' : 'Xỉu');
                }
            }
        } catch (e) {}
    }, 1000);
}

app.listen(PORT, () => {
    console.log("Server chạy tại port " + PORT);
    autoScan();
});
