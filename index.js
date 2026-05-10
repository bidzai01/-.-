// =========================================================================
// COPYRIGHT: @kings9vip
// HỆ THỐNG DỰ ĐOÁN MD5 - 3 PHÂN VÙNG THUẬT TOÁN ĐỘC LẬP (FULL LOGIC)
// =========================================================================

const axios = require('axios');
const colors = require('colors');
const http = require('http');

const API_URL = 'https://wtxmd52.tele68.com/v1/txmd5/sessions?at=62385f65eb49fcb34c72a7d6489ad91d';

// -------------------------------------------------------------------------
// PHẦN 1: ULTRA DICE PREDICTION SYSTEM (TỪ THUATTOAN.JS & THUATTOAN123.JS)
// -------------------------------------------------------------------------
class UltraDicePredictionSystem {
    constructor() {
        this.history = [];
        this.models = {};
        this.weights = {};
        this.performance = {};
        this.patternDatabase = {};
        this.advancedPatterns = {};
        this.sessionStats = {
            streaks: { T: 0, X: 0, maxT: 0, maxX: 0 },
            transitions: { TtoT: 0, TtoX: 0, XtoT: 0, XtoX: 0 },
            volatility: 0.5,
            patternConfidence: {},
            recentAccuracy: 0,
            bias: { T: 0, X: 0 }
        };
        this.marketState = { trend: 'neutral', momentum: 0, stability: 0.5, regime: 'normal' };
        this.adaptiveParameters = {
            patternMinLength: 3,
            patternMaxLength: 8,
            volatilityThreshold: 0.7,
            trendStrengthThreshold: 0.6,
            patternConfidenceDecay: 0.95,
            patternConfidenceGrowth: 1.05
        };
        this.initAllModels();
    }

    initAllModels() {
        for (let i = 1; i <= 113; i++) {
            this.models[`model_${i}`] = (history) => {
                if (history.length < 10) return null;
                const last = history[history.length - 1];
                const prev = history[history.length - 2];
                if (i % 2 === 0) return last;
                if (i % 3 === 0) return prev;
                if (i % 5 === 0) return last === 'T' ? 'X' : 'T';
                if (i % 7 === 0) return history[history.length - 3] || last;
                return last;
            };
            this.weights[`model_${i}`] = 1.0;
        }
    }

    updateMarketState() {
        if (this.history.length < 10) return;
        const last10 = this.history.slice(-10);
        const switches = last10.slice(1).reduce((c, curr, i) => c + (curr !== last10[i] ? 1 : 0), 0);
        this.marketState.stability = 1 - (switches / 9);
        this.marketState.regime = switches >= 7 ? 'volatile' : (switches <= 2 ? 'trending' : 'normal');
    }

    getPredictionWeights() {
        let tWeight = 0, xWeight = 0;
        Object.keys(this.models).forEach(id => {
            const pred = this.models[id](this.history);
            if (pred === 'T') tWeight += this.weights[id];
            else if (pred === 'X') xWeight += this.weights[id];
        });
        return { tWeight, xWeight };
    }
}

// -------------------------------------------------------------------------
// PHẦN 2: BALANCING & STREAK ANALYSIS (TỪ PREDICTIONALGORITHMSALL.JS)
// -------------------------------------------------------------------------
const BalancingSystem = {
    analyze(history) {
        if (history.length === 0) return { breakProb: 0, side: null };
        let streak = 1;
        const last = history[history.length - 1];
        for (let i = history.length - 2; i >= 0; i--) {
            if (history[i] === last) streak++; else break;
        }
        const last20 = history.slice(-20);
        const taiCount = last20.filter(r => r === 'T').length;
        const xiuCount = last20.filter(r => r === 'X').length;
        const imbalance = Math.abs(taiCount - xiuCount) / 20;
        let breakProb = 0;
        if (streak >= 4) breakProb = Math.min(0.5 + (streak * 0.08) + imbalance, 0.95);
        return {
            streak, currentResult: last, breakProb,
            imbalanceSide: taiCount > xiuCount ? 'X' : 'T',
            isTooHeavilyBiased: Math.max(taiCount, xiuCount) >= 14
        };
    }
};

// -------------------------------------------------------------------------
// PHẦN 3: BRIDGE & PATTERN RECOGNITION (TỪ PREDICTIONALGORITHMSALL.JS)
// -------------------------------------------------------------------------
const PatternSystem = {
    detectBridge(history) {
        const h = history.slice(-6).join('');
        if (h.includes('TXTX') || h.includes('XTXT')) return { side: h.endsWith('T') ? 'X' : 'T', type: '1-1' };
        if (h.includes('TTXX') || h.includes('XXTT')) return { side: h.endsWith('T') ? 'T' : 'X', type: '2-2' };
        if (h.includes('TTTXXX')) return { side: 'T', type: '3-3' };
        if (h.includes('XXXTTT')) return { side: 'X', type: '3-3' };
        return null;
    }
};

// -------------------------------------------------------------------------
// ENGINE ĐIỀU PHỐI (MAIN CORE) - PHẦN HIỂN THỊ LOG MỚI
// -------------------------------------------------------------------------
class CoreEngine {
    constructor() {
        this.ultra = new UltraDicePredictionSystem();
        this.processedId = null;
        this.lastPrediction = null;
        this.lastConf = 0;
        this.lastSessionId = null;
        this.stats = { total: 0, win: 0, loss: 0 };
    }

    async update() {
        try {
            const res = await axios.get(API_URL, { timeout: 5000 });
            const list = res.data.list;
            if (!list || list.length === 0) return;

            const latest = list[0];
            if (String(latest.id) !== String(this.processedId)) {
                const resChar = (latest.resultTruyenThong === 'TAI' || latest.point > 10) ? 'T' : 'X';
                const resFull = resChar === 'T' ? 'TÀI' : 'XỈU';

                // --- 1. HIỂN THỊ THẮNG THUA PHIÊN TRƯỚC ---
                if (this.lastPrediction && String(this.lastSessionId) === String(latest.id)) {
                    const isWin = this.lastPrediction === resFull;
                    this.stats.total++;
                    if (isWin) this.stats.win++; else this.stats.loss++;
                    const winRate = ((this.stats.win / this.stats.total) * 100).toFixed(1);

                    console.log("\n" + "=".repeat(50).cyan);
                    console.log(` 🏆 PHIÊN CHỐT: ${latest.id} | KẾT QUẢ: ${(resChar === 'T' ? "TÀI".red : "XỈU".blue)} (${latest.point}đ)`);
                    console.log(` 🤖 BOT ĐOÁN: ${this.lastPrediction} (${this.lastConf}%) -> ${(isWin ? "THẮNG ✅".green : "THUA ❌".red)}`);
                    console.log(` 📊 THỐNG KÊ: THẮNG: ${this.stats.win} | THUA: ${this.stats.loss} | TỈ LỆ: ${winRate}%`);
                }

                // --- 2. PHÂN TÍCH CHO PHIÊN TIẾP THEO ---
                this.processedId = latest.id;
                this.ultra.history = list.slice(0, 50).map(s => (s.resultTruyenThong === 'TAI' || s.point > 10) ? 'T' : 'X').reverse();
                this.ultra.updateMarketState();

                const weights = this.ultra.getPredictionWeights();
                const balance = BalancingSystem.analyze(this.ultra.history);
                const bridge = PatternSystem.detectBridge(this.ultra.history);

                let finalTai = weights.tWeight;
                let finalXiu = weights.xWeight;

                if (balance.breakProb > 0.75) {
                    if (balance.currentResult === 'T') finalXiu += 150; else finalTai += 150;
                }
                if (balance.isTooHeavilyBiased) {
                    if (balance.imbalanceSide === 'T') finalTai += 100; else finalXiu += 100;
                }
                if (bridge) {
                    if (bridge.side === 'T') finalTai += 300; else finalXiu += 300;
                }

                const side = finalTai >= finalXiu ? 'TÀI' : 'XỈU';
                const rawConf = (Math.max(finalTai, finalXiu) / (finalTai + finalXiu)) * 100;

                this.lastPrediction = side;
                this.lastConf = Math.min(98.5, rawConf).toFixed(1);
                this.lastSessionId = Number(latest.id) + 1;

                // --- 3. HIỂN THỊ DỰ ĐOÁN MỚI + COPYRIGHT ---
                console.log(`\n ⏳ PHIÊN MỚI: ${this.lastSessionId.toString().yellow.bold}`);
                console.log(` 🔮 DỰ ĐOÁN: ${side.bold.white} | TỈ LỆ: ${this.lastConf}%`);
                console.log(` 👤 COPYRIGHT: @kings9vip - PHIÊN: ${this.lastSessionId}`);
                console.log("-".repeat(50).gray);
            }
        } catch (e) {}
    }
}

const Core = new CoreEngine();
setInterval(() => Core.update(), 3000);

const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('System @kings9vip Online');
});
server.listen(process.env.PORT || 10000);
