// =========================================================================
// PROJECT: OMNI ENGINE TERMINAL V3.0 - AI SELF-LEARNING
// DEVELOPER: @DEVANHKHOI (CHỦ TÔN)
// ENGINE: Deep Memorization & Win/Loss Analytics
// =========================================================================

const axios = require('axios');
const colors = require('colors');

// Cấu hình API (Lấy từ dữ liệu bạn hay dùng)
const API_URL = 'https://wtx.tele68.com/v1/tx/sessions?at=62385f65eb49fcb34c72a7d6489ad91d';

// =========================================================================
// CLASS AI TỰ HỌC (PORTED FROM THUATTOAN123.JS)
// =========================================================================
class UltraDeepAI {
    constructor() {
        this.history = [];
        this.patternDB = {}; // Ghi nhớ mẫu cầu
        this.weights = { pattern: 0.4, trend: 0.3, entropy: 0.3 };
        this.stats = { total: 0, win: 0, loss: 0, streak: 0, maxStreak: 0 };
        this.lastPrediction = null;
        this.lastSessionId = null;
    }

    // Học từ lịch sử
    learn(results) {
        this.history = results.map(r => (r.resultTruyenThong === 'TAI' || r.point > 10) ? 'T' : 'X').reverse();
        
        // Ghi nhớ các mẫu cầu từ 3-6 phiên vào bộ nhớ tạm (Self-Learning)
        for (let i = 0; i < this.history.length - 6; i++) {
            const pattern = this.history.slice(i, i + 5).join('');
            const next = this.history[i + 5];
            if (!this.patternDB[pattern]) this.patternDB[pattern] = { T: 0, X: 0 };
            this.patternDB[pattern][next]++;
        }
    }

    // Dự đoán dựa trên bộ nhớ đã học
    predict() {
        if (this.history.length < 10) return { side: '?', conf: 0 };

        const currentPattern = this.history.slice(-5).join('');
        let tScore = 0, xScore = 0;

        // 1. Đối soát mẫu cầu đã nhớ
        if (this.patternDB[currentPattern]) {
            const p = this.patternDB[currentPattern];
            tScore += p.T * 2;
            xScore += p.X * 2;
        }

        // 2. Thuật toán Trend Momentum
        const last3 = this.history.slice(-3).join('');
        if (last3 === 'TTT') xScore += 1.5; // Bẻ bệt
        else if (last3 === 'XXX') tScore += 1.5;

        // 3. Tính toán tỷ lệ
        const total = tScore + xScore;
        const side = tScore >= xScore ? 'TÀI' : 'XỈU';
        const conf = total > 0 ? (Math.max(tScore, xScore) / total * 100) : 50;

        return { side, conf: Math.min(99, conf + 30).toFixed(1) };
    }

    // Kiểm tra thắng thua phiên trước
    checkWinLoss(currentTopSession) {
        if (this.lastPrediction && this.lastSessionId === currentTopSession.id) {
            const actual = (currentTopSession.resultTruyenThong === 'TAI' || currentTopSession.point > 10) ? 'TÀI' : 'XỈU';
            const isWin = this.lastPrediction === actual;

            this.stats.total++;
            if (isWin) {
                this.stats.win++;
                this.stats.streak++;
                if (this.stats.streak > this.stats.maxStreak) this.stats.maxStreak = this.stats.streak;
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

const AI = new UltraDeepAI();

// =========================================================================
// GIAO DIỆN TERMINAL VIP
// =========================================================================
function printHeader() {
    console.clear();
    console.log("===============================================================".cyan);
    console.log("   🚀 OMNI ENGINE TERMINAL V3.0 - HỆ THỐNG TỰ HỌC PHIÊN".bold.white);
    console.log(`   DEVELOPER: ${"@DEVANHKHOI".yellow} | STATUS: ${"ACTIVE".green}`);
    console.log("===============================================================".cyan);
    console.log(`${" PHIÊN ".bgWhite.black} | ${"KẾT QUẢ".bgWhite.black} | ${"DỰ ĐOÁN".bgWhite.black} | ${"TỰ TIN".bgWhite.black} | ${"TRẠNG THÁI".bgWhite.black}`);
    console.log("---------------------------------------------------------------".gray);
}

function updateFooter() {
    const winRate = AI.stats.total > 0 ? ((AI.stats.win / AI.stats.total) * 100).toFixed(1) : 0;
    process.stdout.write(
        `\r [THỐNG KÊ] Tổng: ${AI.stats.total} | Thắng: ${AI.stats.win.toString().green} | Thua: ${AI.stats.loss.toString().red} | WinRate: ${winRate.toString().yellow}% | Chuỗi: ${AI.stats.streak.toString().cyan}  `
    );
}

async function startEngine() {
    printHeader();
    
    setInterval(async () => {
        try {
            const res = await axios.get(API_URL);
            const data = res.data.list;
            if (!data || data.length === 0) return;

            const topSession = data[0];
            const nextId = Number(topSession.id) + 1;

            // Nếu phát hiện phiên mới
            if (AI.lastSessionId !== topSession.id) {
                const status = AI.checkWinLoss(topSession);
                const resultText = (topSession.resultTruyenThong === 'TAI') ? "TÀI".red : "XỈU".blue;
                const pointText = topSession.point.toString().white;

                // Log kết quả phiên vừa xong
                if (AI.lastSessionId) {
                    console.log(
                        ` #${topSession.id.toString().gray} |   ${resultText} (${pointText})  |   ${AI.lastPrediction.padEnd(5)} |   ---    |    ${status}`
                    );
                }

                // Học và Dự đoán cho phiên TIẾP THEO
                AI.learn(data);
                const pred = AI.predict();

                // Lưu lại để đối soát
                AI.lastPrediction = pred.side;
                AI.lastSessionId = nextId;

                // Hiển thị dự đoán mới nhất trên một dòng chờ
                console.log(
                    ` #${nextId.toString().yellow} |   ${"???".gray}    |   ${pred.side.bold}   |   ${pred.conf}%  |    ${"CHỜ...".yellow}`
                );
                console.log("---------------------------------------------------------------".gray);
                updateFooter();
            }
        } catch (e) {
            // Error silent
        }
    }, 2000);
}

// KHỞI CHẠY
startEngine();
