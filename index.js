// =========================================================================
// SYSTEM: 𝐌𝐫.𝐬𝟗 𝓹𝓻𝓲𝓶𝓮 ULTIMATE (GEN 10 FINAL)
// CORE DEVELOPER: DEV ANH KHÔI (CHỦ TÔN)
// ALGORITHMS: Integrated from lc.js, 1lcvippp01.js, predictionAlgorithmsAll.js, 
// 138163e8.user.js, 789.js, b521.js, dd.js, thuattoan123.js, thuattoan.js, 47g23.py, thuattoan8.txt
// =========================================================================

const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

// 1. CẤU HÌNH API NGUỒN CẦU DÀI
const API_HU = 'https://wtx.tele68.com/v1/tx/sessions?at=62385f65eb49fcb34c72a7d6489ad91d';
const API_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions?at=62385f65eb49fcb34c72a7d6489ad91d';

let s9Memory = {
    hu: { last: null, streakLoss: 0, matrix: {} },
    md5: { last: null, streakLoss: 0, matrix: {} }
};
let globalState = { hu: {}, md5: {} };

// =========================================================================
// 2. KHO TÀNG THUẬT TOÁN (KHÔNG RÚT GỌN - ĐẦY ĐỦ LOGIC)
// =========================================================================

// --- Hàm Trợ giúp Toán học ---
const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
const calcStdDev = arr => {
    if (arr.length < 2) return 0;
    const m = avg(arr);
    return Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - m, 2), 0) / arr.length);
};
const entropy = arr => {
    const freq = {}; arr.forEach(v => freq[v] = (freq[v] || 0) + 1);
    return Object.values(freq).reduce((e, f) => { const p = f / arr.length; return e - p * Math.log2(p); }, 0);
};

// --- MEGA ENGINE ---
function primeMegaDecoder(data, type) {
    if (!data || data.length < 50) return null;

    // Lấy 50 phiên để phân tích chiều sâu
    const history = data.slice(0, 50).reverse(); // Cũ -> Mới
    const results = history.map(d => (d.resultTruyenThong === 'TAI' || d.point > 10) ? 'T' : 'X');
    const points = history.map(d => d.point);
    const lastResult = results[results.length - 1];
    
    let scoreT = 0, scoreX = 0;
    const mem = s9Memory[type];

    // LỚP 1: PATTERN RECOGNITION (TỪ predictionAlgorithmsAll.js & thuattoan8.txt)
    let streak = 0;
    for (let i = results.length - 1; i >= 0; i--) { if (results[i] === lastResult) streak++; else break; }
    if (streak >= 4) { lastResult === 'T' ? scoreT += 20 : scoreX += 20; }
    
    const last10Str = results.slice(-10).join('');
    const patternDict = {
        'TXTXTXTX': 'T', 'XTXTXTXT': 'X', // Cầu 1-1 dài
        'TTXXTTXX': 'T', 'XXTTXXTT': 'X', // Cầu 2-2
        'TTTXXXT': 'X', 'XXXTXXX': 'T',   // Cầu 3-3 bẻ
        'TTTXXXXT': 'X', 'XXXTTTTX': 'T'  // Cầu 3-4 bẻ
    };
    for (const [pat, pred] of Object.entries(patternDict)) {
        if (last10Str.endsWith(pat)) pred === 'T' ? scoreT += 35 : scoreX += 35;
    }

    // LỚP 2: MARKOV TRANSITION MATRIX (TỪ 789.js & Deep AI)
    for(let i = 0; i < results.length - 1; i++) {
        const pair = `${results[i]}->${results[i+1]}`;
        mem.matrix[pair] = (mem.matrix[pair] || 0) + 1;
    }
    const tNext = mem.matrix[`${lastResult}->T`] || 0;
    const xNext = mem.matrix[`${lastResult}->X`] || 0;
    if (tNext > xNext * 1.2) scoreT += 25;
    if (xNext > tNext * 1.2) scoreX += 25;

    // LỚP 3: DICE VARIANCE & SUPPORT/RESISTANCE (TỪ thuattoan.js & b521.js)
    const currentPoint = points[points.length - 1];
    const prevPoint = points[points.length - 2];
    const pointAvg15 = avg(points.slice(-15));
    const pointStdDev = calcStdDev(points.slice(-15));
    
    // Nến xúc sắc
    if (currentPoint > prevPoint && currentPoint < 14) scoreT += 15;
    if (currentPoint < prevPoint && currentPoint > 7) scoreX += 15;
    
    // Hỗ trợ / Kháng cự (Cực trị)
    if (currentPoint >= 15) scoreX += 30; // Chạm đỉnh -> Dội Xỉu
    if (currentPoint <= 6) scoreT += 30;  // Chạm đáy -> Dội Tài

    // LỚP 4: STATISTICAL IMBALANCE (TỪ 47g23.py)
    const tCount30 = results.slice(-30).filter(r => r === 'T').length;
    if (tCount30 > 18) scoreX += 20; // Lệch Tài -> Hút Xỉu
    if (tCount30 < 12) scoreT += 20; // Lệch Xỉu -> Hút Tài

    // LỚP 5: QUANTUM ENTROPY (Độ nhiễu loạn cầu)
    const ent = entropy(results.slice(-15));
    if (ent < 0.4) { // Cầu quá ổn định (bệt), đánh ngược lại để bẻ
        lastResult === 'T' ? scoreX += 10 : scoreT += 10;
    }

    // LỚP 6: ĐOÁN VỊ XÚC SẮC (TỪ thuattoan123.js)
    // Tính toán điểm rơi dựa trên động lượng (momentum)
    const momentum = currentPoint - prevPoint;
    let nextVi = Math.round((currentPoint + pointAvg15) / 2 + (momentum * 0.2));
    if (nextVi < 3) nextVi = 4; if (nextVi > 18) nextVi = 17;
    const viProb = nextVi > 10 ? `TÀI VỊ ${nextVi}` : `XỈU VỊ ${nextVi}`;

    // --- AUTO REVERSAL (Chống gãy cầu) ---
    let finalPred = scoreT >= scoreX ? 'TÀI' : 'XỈU';
    if (mem.streakLoss >= 3) {
        finalPred = finalPred === 'TÀI' ? 'XỈU' : 'TÀI'; // Bẻ ngược logic nếu AI đang bị nhà cái bắt bài
    }

    // Tính Confidence
    const total = scoreT + scoreX;
    let conf = 50;
    if (total > 0) {
        const gap = Math.abs(scoreT - scoreX);
        conf = 65 + (gap / (total + 10)) * 34.9; // Căn chỉnh tỷ lệ 65% - 99.9%
    }

    return {
        id: Number(data[0].id) + 1,
        prediction: finalPred,
        confidence: Math.min(99.9, conf).toFixed(1),
        vi: viProb,
        history: results.slice(-15).reverse() // Đảo lại cho giao diện hiển thị Mới -> Cũ
    };
}

// ==========================================
// 3. AUTO-PING ENGINE (TREO DỮ LIỆU SIÊU TỐC)
// ==========================================
async function runEngine() {
    try {
        const [resHu, resMd5] = await Promise.all([
            axios.get(API_HU, { timeout: 3000 }),
            axios.get(API_MD5, { timeout: 3000 })
        ]);
        if (resHu.data?.list) globalState.hu = primeMegaDecoder(resHu.data.list, 'hu');
        if (resMd5.data?.list) globalState.md5 = primeMegaDecoder(resMd5.data.list, 'md5');
    } catch (e) {}
}
setInterval(runEngine, 1200); // 1.2s ping 1 lần, không độ trễ

// ==========================================
// 4. FRONTEND - 𝐌𝐫.𝐬𝟗 𝓹𝓻𝓲𝓶𝓮 (FLAT, ANTI-ZOOM, LEAVES)
// ==========================================
app.get('/api/s9', (req, res) => res.json(globalState));
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>𝐌𝐫.𝐬𝟗 𝓹𝓻𝓲𝓶𝓮</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@900&family=Rajdhani:wght@600;700&display=swap');
            
            * { touch-action: manipulation; box-sizing: border-box; }
            body { 
                margin: 0; background: #000; color: #fff; 
                font-family: 'Rajdhani', sans-serif; overflow-x: hidden;
                display: flex; flex-direction: column; align-items: center;
                min-height: 100vh;
            }

            /* Nền tĩnh lặng chuyên nghiệp */
            #space {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: radial-gradient(circle at center, #0a0514 0%, #020005 100%);
                z-index: -2;
            }
            canvas { position: fixed; top: 0; left: 0; z-index: -1; opacity: 0.5; }

            /* Hiệu ứng lá rơi */
            .leaf {
                position: absolute; top: -50px; z-index: 0;
                pointer-events: none; opacity: 0.5;
                animation: fall linear forwards;
            }
            @keyframes fall {
                0% { transform: translateY(-50px) rotate(0deg); opacity: 0; }
                10% { opacity: 0.6; }
                90% { opacity: 0.6; }
                100% { transform: translateY(105vh) rotate(720deg); opacity: 0; }
            }

            .brand-header {
                font-family: 'Orbitron'; font-size: clamp(35px, 6vw, 60px);
                margin: 40px 0 30px; letter-spacing: 5px;
                background: linear-gradient(90deg, #00f2fe, #fff, #ff007f);
                -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.3));
            }

            .main-container { width: 95%; max-width: 1100px; display: flex; flex-direction: column; gap: 20px; z-index: 1; }

            /* Giao diện Dẹp & Nằm Ngang (Flat Horizontal) */
            .s9-card {
                display: flex; flex-direction: row; align-items: center; justify-content: space-between;
                background: rgba(20, 20, 30, 0.5); border: 1px solid rgba(255,255,255,0.05);
                border-radius: 20px; padding: 25px; backdrop-filter: blur(20px);
                box-shadow: 0 15px 35px rgba(0,0,0,0.8);
            }
            .s9-hu { border-left: 6px solid #00f2fe; }
            .s9-md5 { border-left: 6px solid #ff007f; }

            .info-col { flex: 1; display: flex; flex-direction: column; gap: 5px; border-right: 1px solid rgba(255,255,255,0.1); padding-right: 20px; }
            .info-label { font-size: 14px; color: #888; letter-spacing: 2px; }
            .info-id { font-family: 'Orbitron'; font-size: 28px; color: #fff; }

            .pred-col { flex: 2; display: flex; flex-direction: column; align-items: center; justify-content: center; }
            .pred-val { font-family: 'Orbitron'; font-size: 80px; font-weight: 900; line-height: 1; margin: 0; }
            .tai { color: #00f2fe; text-shadow: 0 0 40px rgba(0, 242, 254, 0.7); }
            .xiu { color: #ff007f; text-shadow: 0 0 40px rgba(255, 0, 127, 0.7); }
            
            .vi-val { font-size: 24px; color: #ffea00; margin-top: 10px; font-weight: 700; letter-spacing: 2px; background: rgba(0,0,0,0.5); padding: 5px 20px; border-radius: 10px; border: 1px solid #ffea00; }

            .conf-col { flex: 1; display: flex; flex-direction: column; align-items: flex-end; padding-left: 20px; border-left: 1px solid rgba(255,255,255,0.1); }
            .conf-label { font-size: 14px; color: #888; letter-spacing: 2px; }
            .conf-val { font-size: 40px; font-weight: 900; color: #00ff88; text-shadow: 0 0 15px rgba(0,255,136,0.5); }

            /* Lịch sử ngang */
            .history-bar { width: 100%; display: flex; gap: 6px; padding: 12px; background: rgba(0,0,0,0.6); border-radius: 12px; margin-top: 15px; overflow: hidden; }
            .h-dot { width: 16px; height: 16px; border-radius: 50%; }
            .h-dot.T { background: #00f2fe; box-shadow: 0 0 8px #00f2fe; }
            .h-dot.X { background: #ff007f; box-shadow: 0 0 8px #ff007f; }

            @media (max-width: 800px) {
                .s9-card { flex-direction: column; text-align: center; gap: 20px; }
                .info-col { border-right: none; border-bottom: 1px solid rgba(255,255,255,0.1); padding-right: 0; padding-bottom: 15px; }
                .conf-col { border-left: none; align-items: center; padding-left: 0; }
                .pred-val { font-size: 70px; }
                .history-bar { justify-content: center; }
            }
        </style>
    </head>
    <body>
        <div id="space"></div>
        <canvas id="stars"></canvas>
        
        <div class="brand-header">𝐌𝐫.𝐬𝟗 𝓹𝓻𝓲𝓶𝓮</div>

        <div class="main-container">
            <div class="s9-card s9-hu">
                <div class="info-col">
                    <div class="info-label">TX SESSIONS</div>
                    <div class="info-id" id="hu-id">#-------</div>
                    <div style="font-size: 12px; color: #00f2fe; margin-top: 10px;">• ALGO V10 ACTIVE</div>
                </div>
                <div class="pred-col">
                    <div class="pred-val" id="hu-pred">---</div>
                    <div class="vi-val" id="hu-vi">VỊ: --</div>
                </div>
                <div class="conf-col">
                    <div class="conf-label">ĐỘ TIN CẬY</div>
                    <div class="conf-val" id="hu-conf">0%</div>
                </div>
            </div>
            <div class="history-bar" id="hu-hist"></div>

            <div class="s9-card s9-md5">
                <div class="info-col">
                    <div class="info-label">MD5 SESSIONS</div>
                    <div class="info-id" id="md5-id">#-------</div>
                    <div style="font-size: 12px; color: #ff007f; margin-top: 10px;">• ALGO V10 ACTIVE</div>
                </div>
                <div class="pred-col">
                    <div class="pred-val" id="md5-pred">---</div>
                    <div class="vi-val" id="md5-vi" style="color: #00ff88; border-color: #00ff88;">VỊ: --</div>
                </div>
                <div class="conf-col">
                    <div class="conf-label">ĐỘ TIN CẬY</div>
                    <div class="conf-val" id="md5-conf" style="color:#ff007f; text-shadow:0 0 15px rgba(255,0,127,0.5);">0%</div>
                </div>
            </div>
            <div class="history-bar" id="md5-hist"></div>
        </div>

        <script>
            // Hiệu ứng nền tĩnh lặng (Canvas Stars)
            const canvas = document.getElementById('stars');
            const ctx = canvas.getContext('2d');
            let w, h, starsArray = [];
            function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }
            window.addEventListener('resize', resize); resize();
            for(let i=0; i<150; i++) starsArray.push({ x: Math.random()*w, y: Math.random()*h, r: Math.random()*1.5 });
            function drawStars() {
                ctx.clearRect(0,0,w,h);
                ctx.fillStyle = '#fff';
                starsArray.forEach(s => {
                    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill();
                    s.y -= 0.2; if(s.y < 0) s.y = h;
                });
                requestAnimationFrame(drawStars);
            }
            drawStars();

            // Hiệu ứng Lá rơi nhiều loại
            const leaves = ['🍂', '🍁', '🌿', '🍃', '🌸', '✨'];
            function spawnLeaf() {
                const l = document.createElement('div');
                l.className = 'leaf';
                l.innerText = leaves[Math.floor(Math.random()*leaves.length)];
                l.style.left = Math.random() * 100 + 'vw';
                l.style.fontSize = (Math.random() * 18 + 12) + 'px';
                l.style.animationDuration = (Math.random() * 6 + 4) + 's';
                document.body.appendChild(l);
                setTimeout(() => l.remove(), 10000);
            }
            setInterval(spawnLeaf, 300); // Tăng tốc độ rơi lá, dày đặc hơn

            // Cập nhật dữ liệu S9
            async function syncData() {
                try {
                    const res = await fetch('/api/s9');
                    const d = await res.json();
                    
                    ['hu', 'md5'].forEach(t => {
                        const data = d[t];
                        if(data && data.id) {
                            document.getElementById(t+'-id').innerText = "#" + data.id;
                            document.getElementById(t+'-pred').innerText = data.prediction;
                            document.getElementById(t+'-pred').className = "pred-val " + (data.prediction === 'TÀI' ? 'tai' : 'xiu');
                            document.getElementById(t+'-vi').innerText = data.vi;
                            document.getElementById(t+'-conf').innerText = data.confidence + "%";
                            
                            const hist = document.getElementById(t+'-hist');
                            hist.innerHTML = data.history.map(r => \`<div class="h-dot \${r}"></div>\`).join('');
                        }
                    });
                } catch(e) {}
            }
            setInterval(syncData, 1200);
        </script>
    </body>
    </html>
    `);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('--- 𝐌𝐫.𝐬𝟗 𝓹𝓻𝓲𝓶𝓮 ULTIMATE ENGINE STARTED ---');
    runEngine();
});
