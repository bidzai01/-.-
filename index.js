// =========================================================================
// PROJECT: OMNI ENGINE TERMINAL V4.0 - MD5 SPECIALIST
// DEVELOPER: @DEVANHKHOI (CHỦ TÔN)
// ENGINE: AI Self-Learning + Break Probability + Bias Balancer
// =========================================================================

const axios = require('axios');
const colors = require('colors');

// --- CẤU HÌNH API TX MD5 ---
const API_URL = 'https://wtxmd52.tele68.com/v1/txmd5/sessions?at=62385f65eb49fcb34c72a7d6489ad91d';

class MD5_UltraAI {
    constructor() {
        this.history = [];
        this.patternDB = {}; 
        this.stats = { total: 0, win: 0, loss: 0, streak: 0, maxStreak: 0 };
        this.lastPrediction = null;
        this.lastSessionId = null;
        this.processedSessions = new Set();
    }

    // Logic Tự Học & Phân Tích (Kết hợp từ predictionAlgorithmsAll.js)
    analyze(sessions) {
        // Chuyển đổi dữ liệu API sang định dạng T/X
        this.history = sessions.map(s => (s.resultTruyenThong === 'TAI' || s.point > 10) ? 'T' : 'X').reverse();
        
        // Ghi nhớ mẫu cầu (Memory Learning)
        for (let i = 0; i < this.history.length - 5; i++) {
            const pattern = this.history.slice(i, i + 4).join('');
            const next = this.history[i + 4];
            if (!this.patternDB[pattern]) this.patternDB[pattern] = { T: 0, X: 0 };
            this.patternDB[pattern][next]++;
        }
    }

    predict() {
        if (this.history.length < 10) return { side: '?', conf: 0 };

        let taiWeight = 0;
        let xiuWeight = 0;

        // 1. Đối soát Pattern 4 phiên gần nhất
        const currentPattern = this.history.slice(-4).join('');
        if (this.patternDB[currentPattern]) {
            taiWeight += this.patternDB[currentPattern].T * 2.5;
            xiuWeight += this.patternDB[currentPattern].X * 2.5;
        }

        // 2. Logic Bẻ Cầu (Break Probability)
        let streak = 1;
        const lastResult = this.history[this.history.length - 1];
        for (let i = this.history.length - 2; i >= 0; i--) {
            if (this.history[i] === lastResult) streak++; else break;
        }
        
        if (streak >= 4) { // Cầu bệt từ 4 tay trở lên
            if (lastResult === 'T') xiuWeight += (streak * 1.2); else taiWeight += (streak * 1.2);
        }

        // 3. Bias Balancer (Cân bằng tài xỉu 20 phiên)
        const last20 = this.history.slice(-20);
        const taiCount = last20.filter(r => r === 'T').length;
        if (taiCount >= 13) xiuWeight += 3.0; // Tài quá nhiều thì ưu tiên Xỉu
        else if (taiCount <= 7) taiWeight += 3.0;

        const side = taiWeight >= xiuWeight ? 'TÀI' : 'XỈU';
        const totalWeight = taiWeight + xiuWeight;
        const conf = totalWeight > 0 ? (Math.max(taiWeight, xiuWeight) / totalWeight * 100) : 50;

        return { side, conf: Math.min(99.9, conf + 25).toFixed(1) };
    }

    checkResult(session) {
        if (this.lastPrediction && this.lastSessionId === session.id) {
            const actual = (session.resultTruyenThong === 'TAI' || session.point > 10) ? 'TÀI' : 'XỈU';
            const isWin = this.lastPrediction === actual;

            this.stats.total++;
            if (isWin) {
                this.stats.win++;
                this.stats.streak++;
                this.stats.maxStreak = Math.max(this.stats.streak, this.stats.maxStreak);
                return "THẮNG".green.bold;
            } else {
                this.stats.loss++;
                this.stats.streak = 0;
                return "THUA".red.bold;
            }
        }
        return "---".gray;
    }
}

const AI = new MD5_UltraAI();

function renderUI() {
    console.clear();
    console.log("===============================================================".cyan);
    console.log("   💎 OMNI MD5 TERMINAL V4.0 - SELF-LEARNING ENGINE".bold.white);
    console.log(`   AUTHOR: ${"DEV ANH KHÔI".yellow} | MODE: ${"TX MD5 VIP".magenta}`);
    console.log("===============================================================".cyan);
    console.log(`${" PHIÊN ".bgWhite.black} | ${"KẾT QUẢ".bgWhite.black} | ${"DỰ ĐOÁN".bgWhite.black} | ${"TỰ TIN".bgWhite.black} | ${"TRẠNG THÁI".bgWhite.black}`);
    console.log("---------------------------------------------------------------".gray);
}

function showStats() {
    const rate = AI.stats.total > 0 ? ((AI.stats.win / AI.stats.total) * 100).toFixed(1) : 0;
    process.stdout.write(
        `\r [LOGS] TỔNG: ${AI.stats.total} | WIN: ${AI.stats.win.toString().green} | LOSS: ${AI.stats.loss.toString().red} | TỶ LỆ: ${rate.toString().yellow}% | CHUỖI: ${AI.stats.streak.toString().cyan}  `
    );
}

async function run() {
    renderUI();
    
    setInterval(async () => {
        try {
            const res = await axios.get(API_URL);
            const list = res.data.list;
            if (!list || list.length === 0) return;

            const latest = list[0];
            const nextId = Number(latest.id) + 1;

            // Nếu là phiên mới hoàn toàn
            if (!AI.processedSessions.has(latest.id)) {
                AI.processedSessions.add(latest.id);
                
                const status = AI.checkResult(latest);
                const resColor = (latest.resultTruyenThong === 'TAI') ? "TÀI".red : "XỈU".blue;
                
                // Ghi nhận lịch sử cũ
                if (AI.lastSessionId === latest.id) {
                    console.log(
                        ` #${latest.id.toString().gray} |   ${resColor} (${latest.point.toString().white.padEnd(2)}) |   ${AI.lastPrediction.padEnd(5)} |   ---    |    ${status}`
                    );
                }

                // Học từ dữ liệu mới nhất
                AI.analyze(list);
                
                // Dự đoán cho phiên tiếp theo
                const p = AI.predict();
                AI.lastPrediction = p.side;
                AI.lastSessionId = nextId;

                console.log(
                    ` #${nextId.toString().yellow} |   ${"???".gray.padEnd(7)} |   ${p.side.bold}   |   ${p.conf}%  |    ${"CHỜ...".yellow}`
                );
                console.log("---------------------------------------------------------------".gray);
                showStats();
                
                // Dọn dẹp bộ nhớ Set để tránh tràn RAM
                if (AI.processedSessions.size > 100) AI.processedSessions.clear();
            }
        } catch (err) {
            // Re-connecting...
        }
    }, 2500);
}

run();
