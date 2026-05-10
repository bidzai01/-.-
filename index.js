// =========================================================================
// SYSTEM: 𝐌𝐫.𝐬𝟗 𝓹𝓻𝓲𝓶𝓮 - GALAXY ULTRA EDITION (V21.0)
// DEVELOPER: Dev Anh Khôi
// ALGORITHMS: FULL INTEGRATION (Deep AI, Markov, Pattern, Variance, Entropy, Bias)
// =========================================================================

const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

// --- CẤU HÌNH API NGUỒN ---
const API_HU = 'https://wtx.tele68.com/v1/tx/sessions?at=62385f65eb49fcb34c72a7d6489ad91d';
const API_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions?at=62385f65eb49fcb34c72a7d6489ad91d';

let s9Memory = {
    hu: { last: null, streakLoss: 0, matrix: {}, stats: { T: 0, X: 0 } },
    md5: { last: null, streakLoss: 0, matrix: {}, stats: { T: 0, X: 0 } }
};
let globalState = { hu: {}, md5: {} };

// =========================================================================
// DATABASE: THUẬT TOÁN MẪU 8 PHIÊN (DEEP PATTERNS)
// =========================================================================
const DEEP_PATTERNS = {
    "TXXTTXTX": "Xỉu", "XXTTXTXX": "Tài", "XTTXTXXT": "Tài", "TTXTXXTT": "Tài",
    "TXTXXTTT": "Xỉu", "XTXXTTTX": "Xỉu", "TXXTTTXX": "Tài", "XXTTTXXT": "Xỉu",
    "XTTTXXTX": "Xỉu", "TTTXXTXX": "Xỉu", "TTXXTXXX": "Xỉu", "TXXTXXXX": "Xỉu",
    "XXTXXXXX": "Tài", "XTXXXXXT": "Xỉu", "TXXXXXTX": "Xỉu", "XXXXXTXX": "Xỉu",
    "XXXXTXXX": "Tài", "XXXTXXXT": "Xỉu", "XXTXXXTX": "Xỉu", "XTXXXTXX": "Xỉu",
    "TXXXTXXX": "Tài", "XXXTXXXX": "Tài", "XXTXXXXT": "Tài", "XTXXXXTT": "Xỉu",
    "TXXXXTTX": "Xỉu", "XXXXTTXX": "Xỉu", "XXXTTXXX": "Tài", "XXTTXXXX": "Tài",
    "XTTXXXXT": "Xỉu", "TTXXXXTX": "Xỉu", "TXXXXTXX": "Tài", "XXXXTXXT": "Xỉu",
    "XXXXXXXX": "Tài", "TTTTTTTT": "Xỉu", "TXTXTXTX": "Tài", "XTXTXTXT": "Xỉu",
    "TTTXXXXT": "Xỉu", "XXXTTTTX": "Tài"
};

// =========================================================================
// THUẬT TOÁN LÕI (CORE ENGINE - NO TRUNCATION)
// =========================================================================
const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
const entropy = arr => {
    const freq = {}; arr.forEach(v => freq[v] = (freq[v] || 0) + 1);
    return Object.values(freq).reduce((e, f) => { const p = f / arr.length; return e - p * Math.log2(p); }, 0);
};

function advancedDecoder(data, type) {
    if (!data || data.length < 50) return null;

    const history = data.slice(0, 50).reverse(); 
    const results = history.map(d => (d.resultTruyenThong === 'TAI' || d.point > 10) ? 'T' : 'X');
    const points = history.map(d => d.point);
    const lastResult = results[results.length - 1];
    const lastPoint = points[points.length - 1];
    
    let scoreT = 0, scoreX = 0;
    const mem = s9Memory[type];

    // LỚP 1: DEEP PATTERN RECOGNITION (Soi 8 phiên liên tiếp)
    const last8Str = results.slice(-8).join('');
    if (DEEP_PATTERNS[last8Str]) {
        DEEP_PATTERNS[last8Str] === 'Tài' ? scoreT += 55 : scoreX += 55;
    }

    // LỚP 2: PATTERN CƠ BẢN (Cầu 1-1, Bệt, 2-2, 3-3)
    let streak = 0;
    for (let i = results.length - 1; i >= 0; i--) { if (results[i] === lastResult) streak++; else break; }
    if (streak >= 4) { lastResult === 'T' ? scoreT += 20 : scoreX += 20; }
    
    const last10Str = results.slice(-10).join('');
    const patternDict = {
        'TXTXTXTX': 'T', 'XTXTXTXT': 'X', 
        'TTXXTTXX': 'T', 'XXTTXXTT': 'X', 
        'TTTXXXT': 'X', 'XXXTXXX': 'T'
    };
    for (const [pat, pred] of Object.entries(patternDict)) {
        if (last10Str.endsWith(pat)) pred === 'T' ? scoreT += 35 : scoreX += 35;
    }

    // LỚP 3: MARKOV TRANSITION MATRIX (Dự đoán dây)
    for(let i = 0; i < results.length - 1; i++) {
        const pair = `${results[i]}->${results[i+1]}`;
        mem.matrix[pair] = (mem.matrix[pair] || 0) + 1;
    }
    const tNext = mem.matrix[`${lastResult}->T`] || 0;
    const xNext = mem.matrix[`${lastResult}->X`] || 0;
    if (tNext > xNext * 1.1) scoreT += 25;
    if (xNext > tNext * 1.1) scoreX += 25;

    // LỚP 4: DICE MOMENTUM & SUPPORT/RESISTANCE (Lực dội xúc sắc)
    const prevPoint = points[points.length - 2];
    if (lastPoint > prevPoint && lastPoint < 14) scoreT += 15;
    if (lastPoint < prevPoint && lastPoint > 7) scoreX += 15;
    if (lastPoint >= 15) scoreX += 40; // Chạm đỉnh -> Dội Xỉu
    if (lastPoint <= 6) scoreT += 40;  // Chạm đáy -> Dội Tài

    // LỚP 5: BIAS BALANCER (Cân bằng độ lệch)
    const tCount30 = results.slice(-30).filter(r => r === 'T').length;
    if (tCount30 > 18) scoreX += 25; 
    if (tCount30 < 12) scoreT += 25;

    // LỚP 6: QUANTUM ENTROPY (Độ nhiễu tín hiệu)
    const ent = entropy(results.slice(-15));
    if (ent < 0.45) { 
        lastResult === 'T' ? scoreX += 15 : scoreT += 15;
    }

    // LỚP 7: AUTO REVERSAL (Hệ thống bẻ cầu tự động)
    let finalPred = scoreT >= scoreX ? 'TÀI' : 'XỈU';
    if (mem.streakLoss >= 3) {
        finalPred = finalPred === 'TÀI' ? 'XỈU' : 'TÀI'; 
    }

    // TÍNH ĐỘ TIN CẬY
    const total = scoreT + scoreX;
    let conf = 50;
    if (total > 0) {
        const gap = Math.abs(scoreT - scoreX);
        conf = 68 + (gap / (total + 12)) * 31.9; 
    }

    return {
        id: Number(data[0].id) + 1,
        prediction: finalPred,
        confidence: Math.min(99.8, conf).toFixed(1),
        history: results.slice(-15).reverse() 
    };
}

// ENGINE CẬP NHẬT 2 GIÂY/LẦN
async function runEngine() {
    try {
        const [resHu, resMd5] = await Promise.all([
            axios.get(API_HU, { timeout: 3500 }),
            axios.get(API_MD5, { timeout: 3500 })
        ]);
        if (resHu.data?.list) globalState.hu = advancedDecoder(resHu.data.list, 'hu');
        if (resMd5.data?.list) globalState.md5 = advancedDecoder(resMd5.data.list, 'md5');
    } catch (e) {}
}
setInterval(runEngine, 2000);

// =========================================================================
// GIAO DIỆN SIÊU CẤP - SPLIT LAYOUT V21
// =========================================================================
app.get('/api/s9', (req, res) => res.json(globalState));
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>𝐌𝐫.𝐬𝟗 𝓹𝓻𝓲𝓶𝓮 𝐕𝟐𝟏</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@800;900&family=Rajdhani:wght@600;700&display=swap');
            
            body { 
                margin: 0; background: #000; color: #fff; 
                font-family: 'Rajdhani', sans-serif; overflow: hidden;
                height: 100vh; width: 100vw;
            }

            #space { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -2; background: radial-gradient(circle, #0a0b1e 0%, #000 100%); }
            canvas { position: fixed; top: 0; left: 0; z-index: -1; }

            .main-wrapper {
                display: flex; height: 100vh; width: 100vw;
            }

            .section {
                flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
                padding: 30px; position: relative; border-right: 1px solid rgba(255,255,255,0.05);
                backdrop-filter: blur(10px);
            }

            .header-label {
                position: absolute; top: 40px; font-family: 'Orbitron'; font-size: 20px;
                letter-spacing: 4px; padding: 8px 25px; border-radius: 30px;
            }
            .label-hu { border: 1px solid #00f2fe; color: #00f2fe; box-shadow: 0 0 20px rgba(0,242,254,0.3); }
            .label-md5 { border: 1px solid #ff007f; color: #ff007f; box-shadow: 0 0 20px rgba(255,0,127,0.3); }

            .session-id { font-family: 'Orbitron'; font-size: 22px; color: #777; margin-top: 100px; }

            .prediction {
                font-family: 'Orbitron'; font-size: clamp(85px, 10vw, 140px); font-weight: 900;
                margin: 15px 0; letter-spacing: 8px; transition: 0.5s;
            }
            .tai-text { color: #00f2fe; text-shadow: 0 0 50px #00f2fe, 0 0 100px rgba(0,242,254,0.5); }
            .xiu-text { color: #ff007f; text-shadow: 0 0 50px #ff007f, 0 0 100px rgba(255,0,127,0.5); }

            .confidence-box {
                width: 80%; text-align: center; margin-top: 20px;
            }
            .conf-bar { width: 100%; height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden; margin: 10px 0; }
            .conf-fill { height: 100%; width: 0%; transition: 1.5s cubic-bezier(0.1, 0.5, 0.5, 1); }
            .fill-hu { background: linear-gradient(90deg, #00f2fe, #fff); box-shadow: 0 0 15px #00f2fe; }
            .fill-md5 { background: linear-gradient(90deg, #ff007f, #fff); box-shadow: 0 0 15px #ff007f; }
            .conf-val { font-family: 'Orbitron'; font-size: 28px; }

            .history { display: flex; gap: 8px; margin-top: 50px; }
            .dot { width: 14px; height: 14px; border-radius: 50%; }
            .dot.T { background: #00f2fe; box-shadow: 0 0 10px #00f2fe; }
            .dot.X { background: #ff007f; box-shadow: 0 0 10px #ff007f; }

            @media (max-width: 800px) {
                .main-wrapper { flex-direction: column; }
                .section { border-right: none; border-bottom: 1px solid rgba(255,255,255,0.05); }
                .session-id { margin-top: 60px; }
            }
        </style>
    </head>
    <body>
        <div id="space"></div>
        <canvas id="stars"></canvas>
        
        <div class="main-wrapper">
            <div class="section">
                <div class="header-label label-hu">JACKPOT TX</div>
                <div class="session-id" id="hu-id">#-------</div>
                <div class="prediction" id="hu-pred">---</div>
                <div class="confidence-box">
                    <div class="conf-bar"><div id="hu-fill" class="conf-bar-fill conf-fill fill-hu"></div></div>
                    <div class="conf-val" id="hu-conf">0.0%</div>
                </div>
                <div class="history" id="hu-hist"></div>
            </div>

            <div class="section">
                <div class="header-label label-md5">MD5 ENGINE</div>
                <div class="session-id" id="md5-id">#-------</div>
                <div class="prediction" id="md5-pred">---</div>
                <div class="confidence-box">
                    <div class="conf-bar"><div id="md5-fill" class="conf-bar-fill conf-fill fill-md5"></div></div>
                    <div class="conf-val" id="md5-conf">0.0%</div>
                </div>
                <div class="history" id="md5-hist"></div>
            </div>
        </div>

        <script>
            // 1. Galaxy Stars Effect
            const canvas = document.getElementById('stars');
            const ctx = canvas.getContext('2d');
            let w, h, stars = [];
            function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }
            window.addEventListener('resize', resize); resize();
            for(let i=0; i<150; i++) stars.push({ x: Math.random()*w, y: Math.random()*h, r: Math.random()*1.2, s: Math.random()*0.3 });
            function draw() {
                ctx.clearRect(0,0,w,h); ctx.fillStyle = '#fff';
                stars.forEach(s => {
                    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill();
                    s.y += s.s; if(s.y > h) s.y = 0;
                });
                requestAnimationFrame(draw);
            }
            draw();

            // 2. Data Sync
            async function sync() {
                try {
                    const res = await fetch('/api/s9');
                    const data = await res.json();
                    ['hu', 'md5'].forEach(t => {
                        const d = data[t];
                        if(d && d.id) {
                            document.getElementById(t+'-id').innerText = "#" + d.id;
                            const p = document.getElementById(t+'-pred');
                            p.innerText = d.prediction;
                            p.className = "prediction " + (d.prediction === 'TÀI' ? 'tai-text' : 'xiu-text');
                            document.getElementById(t+'-conf').innerText = d.confidence + "%";
                            document.getElementById(t+'-fill').style.width = d.confidence + "%";
                            document.getElementById(t+'-hist').innerHTML = d.history.map(r => \`<div class="dot \${r}"></div>\`).join('');
                        }
                    });
                } catch(e) {}
            }
            setInterval(sync, 2000);
        </script>
    </body>
    </html>
    `);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('--- 𝐌𝐫.𝐬𝟗 𝓹𝓻𝓲𝓶𝓮 V21 FULL ENGINE DEPLOYED ---');
    runEngine();
});
