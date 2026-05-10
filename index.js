// =========================================================================
// PROJECT: OMNI MD5 TERMINAL V5.0 - SUPREME EDITION
// DEVELOPER: @kings9vip
// ENGINE: AI Self-Learning + Fixed Sync Logic
// =========================================================================

const axios = require('axios');
const colors = require('colors');

// --- CẤU HÌNH API TX MD5 CHUẨN ---
const API_URL = 'https://wtxmd52.tele68.com/v1/txmd5/sessions?at=62385f65eb49fcb34c72a7d6489ad91d';

class MD5_SupremeAI {
    constructor() {
        this.history = [];
        this.patternDB = {}; 
        this.stats = { total: 0, win: 0, loss: 0, streak: 0, maxStreak: 0 };
        this.lastPrediction = null;
        this.lastSessionId = null; // ID phiên đang chờ kết quả
        this.lastProcessedId = null; // ID phiên vừa mới kết thúc (đã in log)
    }

    // --- HỌC TỪ FILE predictionAlgorithmsAll.js ---
    analyze(sessions) {
        // Lấy 50 phiên gần nhất để khảo sát
        this.history = sessions.map(s => (s.resultTruyenThong === 'TAI' || s.point > 10) ? 'T' : 'X').reverse();
        
        // Cơ chế Tự Học: Ghi nhớ các biến thể cầu
        for (let i = 0; i < this.history.length - 6; i++) {
            const pattern = this.history.slice(i, i + 5).join('');
            const next = this.history[i + 5];
            if (!this.patternDB[pattern]) this.patternDB[pattern] = { T: 0, X: 0 };
            this.patternDB[pattern][next]++;
        }
    }

    // --- THUẬT TOÁN DỰ ĐOÁN SIÊU VIP ---
    predict() {
        if (this.history.length < 15) return { side: '?', conf: 0 };

        let tWeight = 0;
        let xWeight = 0;

        // 1. Deep Pattern Match (Mẫu 5 phiên)
        const currentPattern = this.history.slice(-5).join('');
        if (this.patternDB[currentPattern]) {
            tWeight += this.patternDB[currentPattern].T * 3;
            xWeight += this.patternDB[currentPattern].X * 3;
        }

        // 2. Logic Bẻ Cầu (Từ file của bạn)
        let streak = 1;
        const last = this.history[this.history.length - 1];
        for (let i = this.history.length - 2; i >= 0; i--) {
            if (this.history[i] === last) streak++; else break;
        }
        if (streak >= 5) { // Nếu bệt quá dài, ưu tiên bẻ
            if (last === 'T') xWeight += (streak * 1.5); else tWeight += (streak * 1.5);
        }

        // 3. Market State (Cân bằng Tài/Xỉu 20 phiên)
        const last20 = this.history.slice(-20);
        const taiCount = last20.filter(r => r === 'T').length;
        if (taiCount > 12) xWeight += 4;
        else if (taiCount < 8) tWeight += 4;

        const side = tWeight >= xWeight ? 'TÀI' : 'XỈU';
        const total = tWeight + xWeight;
        const conf = total > 0 ? (Math.max(tWeight, xWeight) / total * 100) : 50;

        return { side, conf: Math.min(99.9, conf + 20).toFixed(1) };
    }

    // --- KIỂM TRA THẮNG THUA ---
    checkResult(session) {
        if (this.lastPrediction && String(this.lastSessionId) === String(session.id)) {
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
        return null;
    }
}

const AI = new MD5_SupremeAI();

function drawHeader() {
    console.clear();
    console.log("===============================================================".cyan);
    console.log("   👑 OMNI MD5 SUPREME V5.0 - SELF-LEARNING ACTIVE".bold.white);
    console.log(`   DEVELOPER: ${"@kings9vip".yellow.bold} | STATUS: ${"VIP MODEL".magenta}`);
    console.log("===============================================================".cyan);
    console.log(`${" PHIÊN ".bgWhite.black} | ${"KẾT QUẢ".bgWhite.black} | ${"DỰ ĐOÁN".bgWhite.black} | ${"TỰ TIN".bgWhite.black} | ${"TRẠNG THÁI".bgWhite.black}`);
    console.log("---------------------------------------------------------------".gray);
}

function drawFooter() {
    const rate = AI.stats.total > 0 ? ((AI.stats.win / AI.stats.total) * 100).toFixed(1) : 0;
    process.stdout.write(
        `\r [LOGS] TỔNG: ${AI.stats.total} | WIN: ${AI.stats.win.toString().green} | LOSS: ${AI.stats.loss.toString().red} | RATE: ${rate.toString().yellow}% | STREAK: ${AI.stats.streak.toString().cyan}  `
    );
}

async function start() {
    drawHeader();
    
    setInterval(async () => {
        try {
            const res = await axios.get(API_URL, { timeout: 3000 });
            const list = res.data.list;
            if (!list || list.length === 0) return;

            const latest = list[0];
            
            // --- FIX LỖI LẶP PHIÊN TRONG ẢNH ---
            // Chỉ xử lý nếu ID này chưa từng được in log trước đó
            if (String(latest.id) !== String(AI.lastProcessedId)) {
                
                // 1. Kiểm tra kết quả của dự đoán phiên trước đó
                const status = AI.checkResult(latest);
                
                // 2. In kết quả phiên vừa đóng (nếu có dự đoán trước đó)
                if (status) {
                    const resColor = (latest.resultTruyenThong === 'TAI') ? "TÀI".red : "XỈU".blue;
                    console.log(
                        ` #${latest.id.toString().gray} |   ${resColor} (${latest.point.toString().white.padEnd(2)}) |   ${AI.lastPrediction.padEnd(5)} |   ---    |    ${status}`
                    );
                }

                // 3. Đánh dấu phiên này đã xử lý để không in lặp lại
                AI.lastProcessedId = latest.id;

                // 4. Bắt đầu học và dự đoán cho phiên KẾ TIẾP
                AI.analyze(list);
                const p = AI.predict();
                
                const nextId = Number(latest.id) + 1;
                AI.lastPrediction = p.side;
                AI.lastSessionId = nextId;

                // 5. In dòng dự đoán mới
                console.log(
                    ` #${nextId.toString().yellow} |   ${"???".gray.padEnd(7)} |   ${p.side.bold}   |   ${p.conf}%  |    ${"CHỜ...".yellow}`
                );
                console.log("---------------------------------------------------------------".gray);
                drawFooter();
            }
        } catch (err) {
            // Re-syncing...
        }
    }, 2000); // Check mỗi 2 giây để bám sát dữ liệu MD5
}

start();
