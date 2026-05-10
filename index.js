// =========================================================================
// COPYRIGHT: @kings9vip
// HỆ THỐNG DỰ ĐOÁN MD5 - FULL LOGIC (KHÔNG XOÁ CODE)
// HIỂN THỊ JSON QUA ĐƯỜNG LINK RENDER (WEB INTERFACE)
// =========================================================================

const axios = require('axios');
const colors = require('colors');
const http = require('http');

const API_URL = 'https://wtxmd52.tele68.com/v1/txmd5/sessions?at=62385f65eb49fcb34c72a7d6489ad91d';

// --- BIẾN TOÀN CỤC ĐỂ LƯU TRỮ DỮ LIỆU JSON CHO LINK RENDER ---
let currentDataReport = {
    copyright: "@kings9vip",
    status: "Đang khởi tạo...",
    stats: { total: 0, win: 0, loss: 0, win_rate: "0%" }
};

// -------------------------------------------------------------------------
// PHẦN 1: ULTRA DICE PREDICTION SYSTEM (GIỮ NGUYÊN 100% CODE CỦA BẠN)
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
            patternMinLength: 3, patternMaxLength: 8, volatilityThreshold: 0.7,
            trendStrengthThreshold: 0.6, patternConfidenceDecay: 0.95, patternConfidenceGrowth: 1.05
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
// PHẦN 2 & 3: BALANCING & PATTERN (GIỮ NGUYÊN 100% CODE CỦA BẠN)
// -------------------------------------------------------------------------
const ExtraLogic = {
    analyze(history) {
        if (history.length === 0) return { breakProb: 0, side: null };
        let streak = 1;
        const last = history[history.length - 1];
        for (let i = history.length - 2; i >= 0; i--) {
            if (history[i] === last) streak++; else break;
        }
        const last20 = history.slice(-20);
        const taiCount = last20.filter(r => r === 'T').length;
        const imbalance = Math.abs(taiCount - (20 - taiCount)) / 20;
        return { streak, currentResult: last, breakProb: Math.min(0.5 + (streak * 0.08) + imbalance, 0.95) };
    },
    detectBridge(history) {
        const h = history.slice(-6).join('');
        if (h.includes('TXTX') || h.includes('XTXT')) return { side: h.endsWith('T') ? 'X' : 'T' };
        return null;
    }
};

// -------------------------------------------------------------------------
// ENGINE ĐIỀU PHỐI & CẬP NHẬT JSON
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
                const resChar = (latest.point > 10) ? 'T' : 'X';
                const resFull = resChar === 'T' ? 'TÀI' : 'XỈU';

                // Cập nhật thống kê thắng thua cho JSON
                if (this.lastPrediction && String(this.lastSessionId) === String(latest.id)) {
                    const isWin = this.lastPrediction === resFull;
                    this.stats.total++;
                    if (isWin) this.stats.win++; else this.stats.loss++;
                }

                this.processedId = latest.id;
                this.ultra.history = list.slice(0, 50).map(s => (s.point > 10) ? 'T' : 'X').reverse();
                this.ultra.updateMarketState();

                const weights = this.ultra.getPredictionWeights();
                const balance = ExtraLogic.analyze(this.ultra.history);
                const bridge = ExtraLogic.detectBridge(this.ultra.history);

                let finalTai = weights.tWeight, finalXiu = weights.xWeight;
                if (balance.breakProb > 0.75) (balance.currentResult === 'T' ? finalXiu += 150 : finalTai += 150);
                if (bridge) (bridge.side === 'T' ? finalTai += 300 : finalXiu += 300);

                const side = finalTai >= finalXiu ? 'TÀI' : 'XỈU';
                const conf = ((Math.max(finalTai, finalXiu) / (finalTai + finalXiu)) * 100).toFixed(1);

                this.lastPrediction = side;
                this.lastConf = conf;
                this.lastSessionId = Number(latest.id) + 1;

                // CẬP NHẬT DỮ LIỆU VÀO JSON REPORT ĐỂ HIỂN THỊ LÊN WEB
                currentDataReport = {
                    copyright: "@kings9vip",
                    phien_vừa_xong: {
                        id: latest.id,
                        ket_qua: resFull,
                        diem: latest.point
                    },
                    du_doan_moi: {
                        phien_tiep_theo: this.lastSessionId,
                        du_doan: side,
                        ti_le_tin_cay: `${conf}%`
                    },
                    thong_ke_he_thong: {
                        tong_phien: this.stats.total,
                        thang: this.stats.win,
                        thua: this.stats.loss,
                        ti_le_thang: `${((this.stats.win / this.stats.total) * 100 || 0).toFixed(1)}%`
                    },
                    market: this.ultra.marketState.regime
                };

                console.log(`[System] Đã cập nhật phiên ${this.lastSessionId} - Dự đoán: ${side} (${conf}%)`.green);
            }
        } catch (e) {}
    }
}

const Core = new CoreEngine();
setInterval(() => Core.update(), 3000);

// -------------------------------------------------------------------------
// TẠO SERVER HTTP ĐỂ HIỂN THỊ JSON QUA LINK RENDER
// -------------------------------------------------------------------------
const server = http.createServer((req, res) => {
    // Thiết lập Header trả về định dạng JSON và hỗ trợ CORS
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.writeHead(200);
    
    // Xuất dữ liệu JSON ra màn hình trình duyệt
    res.end(JSON.stringify(currentDataReport, null, 4));
});

// Port cho Render
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`\n🚀 Hệ thống đang chạy tại: http://localhost:${PORT}`);
    console.log(`👤 Bản quyền: @kings9vip`);
    console.log(`🌐 ĐƯỜNG TRUYỀN API BG ANH KHÔI.\n`);
});
