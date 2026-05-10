// =========================================================================
// PROJECT: OMNI MD5 SUPREME V8.0 - FULL ALGO & RENDER LOG OPTIMIZED
// DEVELOPER: @kings9vip
// ENGINE: Deep Hybrid Intelligence (Streak + Pattern + Bridge + Switch)
// =========================================================================

const axios = require('axios');
const colors = require('colors');
const http = require('http');

const API_URL = 'https://wtxmd52.tele68.com/v1/txmd5/sessions?at=62385f65eb49fcb34c72a7d6489ad91d';

class UltimateBrainAI {
    constructor() {
        this.history = [];
        this.stats = { total: 0, win: 0, loss: 0, streak: 0, maxStreak: 0 };
        this.lastPrediction = null;
        this.lastConf = null; // Lưu % tự tin để in ra lúc đối soát
        this.lastSessionId = null;
        this.lastProcessedId = null;
        this.patternMemory = {};
    }

    // --- FULL THUẬT TOÁN (KHÔNG RÚT NGẮN) ---
    detectStreakAndBreak() {
        if (this.history.length === 0) return { streak: 0, currentResult: null, breakProb: 0.0 };
        let streak = 1;
        const currentResult = this.history[this.history.length - 1];
        for (let i = this.history.length - 2; i >= 0; i--) {
            if (this.history[i] === currentResult) streak++; else break;
        }

        const last20 = this.history.slice(-20);
        const switches = last20.slice(1).reduce((count, curr, idx) => count + (curr !== last20[idx] ? 1 : 0), 0);
        const taiCount = last20.filter(r => r === 'T').length;
        const imbalance = Math.abs(taiCount - (20 - taiCount)) / 20;

        let breakProb = 0.0;
        if (streak >= 4) {
            breakProb = Math.min(0.5 + (streak * 0.05) + (switches / 40) + (imbalance * 0.1), 0.95);
        }
        return { streak, currentResult, breakProb };
    }

    getPatternPrediction() {
        if (this.history.length < 6) return { prediction: 0, confidence: 0 };
        const last3 = this.history.slice(-3).join('');
        const last4 = this.history.slice(-4).join('');

        if (last4 === 'TXTX' || last4 === 'XTXT') return { prediction: last4[3] === 'T' ? 2 : 1, confidence: 0.75 }; 
        if (last4 === 'TTXX' || last4 === 'XXTT') return { prediction: last4[3] === 'T' ? 1 : 2, confidence: 0.7 };  
        return { prediction: 0, confidence: 0 };
    }

    getSwitchPrediction() {
        const last10 = this.history.slice(-10);
        const switches = last10.slice(1).reduce((count, curr, idx) => count + (curr !== last10[idx] ? 1 : 0), 0);
        if (switches >= 7) return 1; 
        if (switches <= 3) return 2; 
        return 0;
    }

    predict() {
        if (this.history.length < 10) return { side: '?', conf: 0 };

        let taiScore = 0;
        let xiuScore = 0;
        const weights = { streak: 0.4, pattern: 0.25, switch: 0.15, bias: 0.2 };

        const streakData = this.detectStreakAndBreak();
        if (streakData.breakProb > 0.65) {
            if (streakData.currentResult === 'T') xiuScore += weights.streak; else taiScore += weights.streak;
        } else {
            if (streakData.currentResult === 'T') taiScore += weights.streak; else xiuScore += weights.streak;
        }

        const patternData = this.getPatternPrediction();
        if (patternData.prediction === 1) taiScore += weights.pattern;
        else if (patternData.prediction === 2) xiuScore += weights.pattern;

        const switchPred = this.getSwitchPrediction();
        if (switchPred === 1) { 
            if (streakData.currentResult === 'T') xiuScore += weights.switch; else taiScore += weights.switch;
        }

        const last30 = this.history.slice(-30);
        const taiCount = last30.filter(r => r === 'T').length;
        if (taiCount > 17) xiuScore += weights.bias;
        else if (taiCount < 13) taiScore += weights.bias;

        const side = taiScore >= xiuScore ? 'TÀI' : 'XỈU';
        const total = taiScore + xiuScore;
        const conf = ((Math.max(taiScore, xiuScore) / (total || 1)) * 100).toFixed(1);

        return { side, conf: Math.min(99.5, parseFloat(conf) + 20).toFixed(1) };
    }

    updateHistory(sessions) {
        this.history = sessions.map(s => (s.resultTruyenThong === 'TAI' || s.point > 10) ? 'T' : 'X').reverse();
        const pattern = this.history.slice(-5).join('');
        if (!this.patternMemory[pattern]) this.patternMemory[pattern] = 0;
        this.patternMemory[pattern]++;
    }

    checkWinLoss(session) {
        if (this.lastPrediction && String(this.lastSessionId) === String(session.id)) {
            const actual = (session.resultTruyenThong === 'TAI' || session.point > 10) ? 'TÀI' : 'XỈU';
            const isWin = this.lastPrediction === actual;
            this.stats.total++;
            if (isWin) {
                this.stats.win++;
                this.stats.streak++;
                this.stats.maxStreak = Math.max(this.stats.streak, this.stats.maxStreak);
                return "🟢 THẮNG".green.bold;
            } else {
                this.stats.loss++;
                this.stats.streak = 0;
                return "🔴 THUA".red.bold;
            }
        }
        return null;
    }
}

const AI = new UltimateBrainAI();

console.clear();
console.log("===============================================================".cyan);
console.log("   🚀 OMNI MD5 SUPREME V8.0 - @kings9vip ACTIVE".bold.white);
console.log("   Trạng thái: Đang kết nối dữ liệu máy chủ...".gray);
console.log("===============================================================\n".cyan);

async function run() {
    setInterval(async () => {
        try {
            const res = await axios.get(API_URL, { timeout: 5000 });
            const list = res.data.list;
            if (!list || list.length === 0) return;

            const latest = list[0];

            // Nếu phát hiện phiên mới đã có kết quả
            if (String(latest.id) !== String(AI.lastProcessedId)) {
                
                // 1. CHỐT KẾT QUẢ PHIÊN VỪA XONG
                const status = AI.checkWinLoss(latest);
                if (status) {
                    const resColor = (latest.resultTruyenThong === 'TAI') ? "TÀI".red.bold : "XỈU".blue.bold;
                    const rate = AI.stats.total > 0 ? ((AI.stats.win / AI.stats.total) * 100).toFixed(1) : 0;
                    
                    console.log("---------------------------------------------------------".gray);
                    console.log(` 🎯 KẾT QUẢ PHIÊN: ${latest.id}`.white.bold);
                    console.log(` 🎲 THỰC TẾ: ${resColor} (${latest.point.toString().yellow})`);
                    console.log(` 🤖 DỰ ĐOÁN: ${AI.lastPrediction.bold} (Tự tin: ${AI.lastConf}%)`);
                    console.log(` 📌 TRẠNG THÁI: ${status}`);
                    console.log(` 📊 THỐNG KÊ: Tổng: ${AI.stats.total} | Win: ${AI.stats.win.toString().green} | Loss: ${AI.stats.loss.toString().red} | Rate: ${rate.toString().cyan}%`);
                    console.log("---------------------------------------------------------\n".gray);
                }
                
                // 2. HỌC VÀ SOI CẦU PHIÊN TIẾP THEO
                AI.lastProcessedId = latest.id;
                AI.updateHistory(list);
                
                const p = AI.predict();
                AI.lastPrediction = p.side;
                AI.lastConf = p.conf; // Lưu lại % để phiên sau in ra
                AI.lastSessionId = Number(latest.id) + 1;

                // 3. IN DỰ ĐOÁN PHIÊN MỚI
                console.log(` ⏳ ĐANG SOI PHIÊN KẾ TIẾP: ${AI.lastSessionId}`.yellow.bold);
                console.log(` 🔮 DỰ ĐOÁN: ${p.side.bold} - Tự tin: ${p.conf.toString().cyan}%`);
                console.log(` 🔄 Chờ kết quả từ API...`.gray);
            }
        } catch (e) {
            // Lỗi mạng ẩn đi để tránh rác log
        }
    }, 2500);
}

// Server giữ kết nối cho Render
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('@kings9vip');
});
server.listen(process.env.PORT || 10000, () => run());
