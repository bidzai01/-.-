// =========================================================================
// SYSTEM: 𝐌𝐫.𝐬𝟗 𝓹𝓻𝓲𝓶𝓮 (SUPER GALAXY EDITION)
// ALGORITHMS: FULL INTEGRATION (Deep AI, Markov, Pattern, Variance, Entropy)
// =========================================================================

const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

// --- CẤU HÌNH API NGUỒN CẦU DÀI ---
const API_HU = 'https://wtx.tele68.com/v1/tx/sessions?at=62385f65eb49fcb34c72a7d6489ad91d';
const API_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions?at=62385f65eb49fcb34c72a7d6489ad91d';

let s9Memory = {
    hu: { last: null, streakLoss: 0, matrix: {} },
    md5: { last: null, streakLoss: 0, matrix: {} }
};
let globalState = { hu: {}, md5: {} };

// =========================================================================
// THUẬT TOÁN LÕI (FULL LOGIC - KHÔNG RÚT GỌN)
// =========================================================================

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

function primeMegaDecoder(data, type) {
    if (!data || data.length < 50) return null;

    // Lấy 50 phiên phân tích chiều sâu
    const history = data.slice(0, 50).reverse(); 
    const results = history.map(d => (d.resultTruyenThong === 'TAI' || d.point > 10) ? 'T' : 'X');
    const points = history.map(d => d.point);
    const lastResult = results[results.length - 1];
    
    let scoreT = 0, scoreX = 0;
    const mem = s9Memory[type];

    // LỚP 1: PATTERN RECOGNITION (Cầu 1-1, Bệt, 2-2, 3-3)
    let streak = 0;
    for (let i = results.length - 1; i >= 0; i--) { if (results[i] === lastResult) streak++; else break; }
    if (streak >= 4) { lastResult === 'T' ? scoreT += 20 : scoreX += 20; }
    
    const last10Str = results.slice(-10).join('');
    const patternDict = {
        'TXTXTXTX': 'T', 'XTXTXTXT': 'X', 
        'TTXXTTXX': 'T', 'XXTTXXTT': 'X', 
        'TTTXXXT': 'X', 'XXXTXXX': 'T',   
        'TTTXXXXT': 'X', 'XXXTTTTX': 'T'  
    };
    for (const [pat, pred] of Object.entries(patternDict)) {
        if (last10Str.endsWith(pat)) pred === 'T' ? scoreT += 35 : scoreX += 35;
    }

    // LỚP 2: MARKOV TRANSITION MATRIX (Dự đoán dây)
    for(let i = 0; i < results.length - 1; i++) {
        const pair = `${results[i]}->${results[i+1]}`;
        mem.matrix[pair] = (mem.matrix[pair] || 0) + 1;
    }
    const tNext = mem.matrix[`${lastResult}->T`] || 0;
    const xNext = mem.matrix[`${lastResult}->X`] || 0;
    if (tNext > xNext * 1.2) scoreT += 25;
    if (xNext > tNext * 1.2) scoreX += 25;

    // LỚP 3: DICE VARIANCE & SUPPORT/RESISTANCE (Lực nến xúc sắc)
    const currentPoint = points[points.length - 1];
    const prevPoint = points[points.length - 2];
    
    if (currentPoint > prevPoint && currentPoint < 14) scoreT += 15;
    if (currentPoint < prevPoint && currentPoint > 7) scoreX += 15;
    
    if (currentPoint >= 15) scoreX += 30; // Chạm đỉnh -> Dội Xỉu
    if (currentPoint <= 6) scoreT += 30;  // Chạm đáy -> Dội Tài

    // LỚP 4: STATISTICAL IMBALANCE (Độ lệch cầu)
    const tCount30 = results.slice(-30).filter(r => r === 'T').length;
    if (tCount30 > 18) scoreX += 20; // Lệch Tài -> Hút Xỉu
    if (tCount30 < 12) scoreT += 20; // Lệch Xỉu -> Hút Tài

    // LỚP 5: QUANTUM ENTROPY (Độ nhiễu)
    const ent = entropy(results.slice(-15));
    if (ent < 0.4) { 
        lastResult === 'T' ? scoreX += 10 : scoreT += 10;
    }

    // LỚP 6: AUTO REVERSAL (Chống bẻ cầu)
    let finalPred = scoreT >= scoreX ? 'TÀI' : 'XỈU';
    if (mem.streakLoss >= 3) {
        finalPred = finalPred === 'TÀI' ? 'XỈU' : 'TÀI'; 
    }

    // Tính Confidence siêu chuẩn
    const total = scoreT + scoreX;
    let conf = 50;
    if (total > 0) {
        const gap = Math.abs(scoreT - scoreX);
        conf = 65 + (gap / (total + 10)) * 34.9; 
    }

    return {
        id: Number(data[0].id) + 1,
        prediction: finalPred,
        confidence: Math.min(99.9, conf).toFixed(1),
        history: results.slice(-15).reverse() 
    };
}

// =========================================================================
// AUTO-PING ENGINE (KHÔNG ĐỘ TRỄ)
// =========================================================================
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
setInterval(runEngine, 1200);

// =========================================================================
// GIAO DIỆN SIÊU NÉT - GALAXY 𝐌𝐫.𝐬𝟗 𝓹𝓻𝓲𝓶𝓮 (NO VỊ, FLAT LAYOUT)
// =========================================================================
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

            /* Không gian Galaxy tĩnh lặng, huyền bí */
            #space {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: radial-gradient(ellipse at center, #0a0518 0%, #000 100%);
                z-index: -3;
            }
            canvas { position: fixed; top: 0; left: 0; z-index: -2; opacity: 0.6; }

            /* Lá rơi cao cấp */
            .leaf {
                position: absolute; top: -50px; z-index: -1;
                pointer-events: none; opacity: 0.7; filter: drop-shadow(0 0 5px rgba(255,255,255,0.3));
                animation: fall linear forwards;
            }
            @keyframes fall {
                0% { transform: translateY(-50px) rotate(0deg) scale(0.8); opacity: 0; }
                10% { opacity: 0.8; }
                80% { opacity: 0.8; }
                100% { transform: translateY(105vh) rotate(720deg) scale(1.2); opacity: 0; }
            }

            /* Thương hiệu S9 */
            .brand-header {
                font-family: 'Orbitron'; font-size: clamp(40px, 7vw, 75px);
                margin: 45px 0 35px; letter-spacing: 6px;
                background: linear-gradient(135deg, #00f2fe, #fff, #ff007f);
                -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                filter: drop-shadow(0 0 25px rgba(0, 242, 254, 0.6));
                animation: pulseGlow 3s ease-in-out infinite alternate;
            }
            @keyframes pulseGlow { 
                0% { filter: drop-shadow(0 0 15px rgba(0, 242, 254, 0.4)); } 
                100% { filter: drop-shadow(0 0 35px rgba(255, 0, 127, 0.8)); } 
            }

            .main-container { width: 95%; max-width: 1200px; display: flex; flex-direction: column; gap: 25px; z-index: 1; }

            /* Card Nằm Ngang Siêu Nét */
            .s9-card {
                display: flex; flex-direction: row; align-items: center; justify-content: space-between;
                background: rgba(15, 15, 25, 0.45); 
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 25px; padding: 30px; 
                backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px);
                box-shadow: 0 20px 50px rgba(0,0,0,0.9), inset 0 0 20px rgba(255,255,255,0.02);
                position: relative; overflow: hidden;
            }
            
            /* Viền phát sáng tĩnh */
            .s9-card::before {
                content: ''; position: absolute; top: 0; left: 0; width: 6px; height: 100%;
            }
            .s9-hu::before { background: #00f2fe; box-shadow: 0 0 20px #00f2fe; }
            .s9-md5::before { background: #ff007f; box-shadow: 0 0 20px #ff007f; }

            .info-col { flex: 1.2; display: flex; flex-direction: column; gap: 8px; padding-left: 15px; }
            .info-label { font-size: 15px; color: #777; letter-spacing: 3px; font-weight: bold; }
            .info-id { font-family: 'Orbitron'; font-size: 32px; color: #fff; text-shadow: 0 0 10px rgba(255,255,255,0.3); }

            /* Số Tài Xỉu Cực Lớn */
            .pred-col { flex: 2; display: flex; flex-direction: column; align-items: center; justify-content: center; }
            .pred-val { font-family: 'Orbitron'; font-size: clamp(80px, 12vw, 110px); font-weight: 900; line-height: 1; margin: 0; letter-spacing: 2px; }
            .tai { color: #00f2fe; text-shadow: 0 0 50px rgba(0, 242, 254, 0.9), 0 0 100px rgba(0, 242, 254, 0.4); }
            .xiu { color: #ff007f; text-shadow: 0 0 50px rgba(255, 0, 127, 0.9), 0 0 100px rgba(255, 0, 127, 0.4); }

            /* Độ tin cậy bo tròn */
            .conf-col { flex: 1.2; display: flex; flex-direction: column; align-items: flex-end; padding-right: 15px; }
            .conf-label { font-size: 14px; color: #888; letter-spacing: 2px; margin-bottom: 5px; }
            .conf-box { 
                background: rgba(0,0,0,0.6); padding: 10px 25px; border-radius: 15px; 
                border: 1px solid rgba(255,255,255,0.1); display: inline-block;
            }
            .conf-val { font-size: 38px; font-weight: 900; font-family: 'Orbitron'; }
            .conf-hu { color: #00f2fe; text-shadow: 0 0 15px rgba(0,242,254,0.6); }
            .conf-md5 { color: #ff007f; text-shadow: 0 0 15px rgba(255,0,127,0.6); }

            /* Lịch sử ngang tối giản */
            .history-bar { width: 100%; display: flex; gap: 8px; padding: 15px; background: rgba(0,0,0,0.5); border-radius: 15px; margin-top: -5px; justify-content: flex-start; border: 1px solid rgba(255,255,255,0.03); }
            .h-dot { width: 18px; height: 18px; border-radius: 50%; }
            .h-dot.T { background: #00f2fe; box-shadow: 0 0 10px #00f2fe; }
            .h-dot.X { background: #ff007f; box-shadow: 0 0 10px #ff007f; }

            .footer-brand { margin-top: 40px; font-family: 'Orbitron'; color: #444; letter-spacing: 8px; font-size: 12px; }

            @media (max-width: 850px) {
                .s9-card { flex-direction: column; text-align: center; gap: 25px; padding: 25px 15px; }
                .info-col { padding-left: 0; align-items: center; }
                .conf-col { padding-right: 0; align-items: center; }
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
                    <div style="font-size: 11px; color: #00f2fe; margin-top: 5px; font-family: monospace;">[ SYSTEM CONNECTED ]</div>
                </div>
                <div class="pred-col">
                    <div class="pred-val" id="hu-pred">---</div>
                </div>
                <div class="conf-col">
                    <div class="conf-label">TIN CẬY</div>
                    <div class="conf-box"><div class="conf-val conf-hu" id="hu-conf">0%</div></div>
                </div>
            </div>
            <div class="history-bar" id="hu-hist"></div>

            <div class="s9-card s9-md5">
                <div class="info-col">
                    <div class="info-label">MD5 SESSIONS</div>
                    <div class="info-id" id="md5-id">#-------</div>
                    <div style="font-size: 11px; color: #ff007f; margin-top: 5px; font-family: monospace;">[ SYSTEM CONNECTED ]</div>
                </div>
                <div class="pred-col">
                    <div class="pred-val" id="md5-pred">---</div>
                </div>
                <div class="conf-col">
                    <div class="conf-label">TIN CẬY</div>
                    <div class="conf-box"><div class="conf-val conf-md5" id="md5-conf">0%</div></div>
                </div>
            </div>
            <div class="history-bar" id="md5-hist"></div>
        </div>
        
        <div class="footer-brand">ULTIMATE EDITION</div>

        <script>
            // 1. Sao bay nền tĩnh
            const canvas = document.getElementById('stars');
            const ctx = canvas.getContext('2d');
            let w, h, starsArray = [];
            function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }
            window.addEventListener('resize', resize); resize();
            for(let i=0; i<200; i++) starsArray.push({ x: Math.random()*w, y: Math.random()*h, r: Math.random()*1.5 });
            function drawStars() {
                ctx.clearRect(0,0,w,h);
                ctx.fillStyle = '#fff';
                starsArray.forEach(s => {
                    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill();
                    s.y -= 0.15; if(s.y < 0) s.y = h;
                });
                requestAnimationFrame(drawStars);
            }
            drawStars();

            // 2. Lá Rơi Cực Đẹp
            const leaves = ['🍃', '🍁', '🍂', '🌸', '🌿', '✨'];
            function spawnLeaf() {
                const l = document.createElement('div');
                l.className = 'leaf';
                l.innerText = leaves[Math.floor(Math.random()*leaves.length)];
                l.style.left = Math.random() * 100 + 'vw';
                l.style.fontSize = (Math.random() * 20 + 12) + 'px';
                l.style.animationDuration = (Math.random() * 7 + 4) + 's';
                document.body.appendChild(l);
                setTimeout(() => l.remove(), 12000);
            }
            setInterval(spawnLeaf, 350);

            // 3. Xử lý API Data
            async function syncData() {
                try {
                    const res = await fetch('/api/s9');
                    const d = await res.json();
                    
                    ['hu', 'md5'].forEach(t => {
                        const data = d[t];
                        if(data && data.id) {
                            document.getElementById(t+'-id').innerText = "#" + data.id;
                            
                            const predEl = document.getElementById(t+'-pred');
                            predEl.innerText = data.prediction;
                            predEl.className = "pred-val " + (data.prediction === 'TÀI' ? 'tai' : 'xiu');
                            
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
    console.log('--- 𝐌𝐫.𝐬𝟗 𝓹𝓻𝓲𝓶𝓮 ULTIMATE DEPLOYED ---');
    runEngine();
});
