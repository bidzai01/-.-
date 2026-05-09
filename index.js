// =========================================================================
// SYSTEM: 𝐌𝐫.𝐬𝟗 𝓹𝓻𝓲𝓶𝓮 - GALAXY ULTRA EDITION (V20.0)
// CORE: Dual-Engine Analysis + Deep Pattern Matching (8-Session)
// =========================================================================

const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

// --- API TELE68 SESSIONS ---
const API_HU = 'https://wtx.tele68.com/v1/tx/sessions?at=62385f65eb49fcb34c72a7d6489ad91d';
const API_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions?at=62385f65eb49fcb34c72a7d6489ad91d';

let globalState = { hu: {}, md5: {} };

// =========================================================================
// THUẬT TOÁN SIÊU CẤP (INTEGRATED FROM DATABASE)
// =========================================================================

// 1. Từ điển mẫu 8 phiên (Deep Pattern)
const deepPatterns = {
    "TXXTTXTX": "Xỉu", "XXTTXTXX": "Tài", "XTTXTXXT": "Tài", "TTXTXXTT": "Tài",
    "TXTXXTTT": "Xỉu", "XTXXTTTX": "Xỉu", "TXXTTTXX": "Tài", "XXTTTXXT": "Xỉu",
    "XXXXXXXX": "Tài", "TTTTTTTT": "Xỉu", "TXTXTXTX": "Tài", "XTXTXTXT": "Xỉu"
};

function advancedDecoder(data) {
    if (!data || data.length < 30) return null;

    const history = data.slice(0, 30).reverse(); 
    const results = history.map(d => (d.resultTruyenThong === 'TAI' || d.point > 10) ? 'T' : 'X');
    const points = history.map(d => d.point);
    const lastResult = results[results.length - 1];
    const lastPoint = points[points.length - 1];
    
    let scoreT = 0, scoreX = 0;

    // A. Lớp Pattern 8 phiên (Deep Lookback)
    const last8Str = results.slice(-8).join('');
    if (deepPatterns[last8Str]) {
        deepPatterns[last8Str] === 'Tài' ? scoreT += 50 : scoreX += 50;
    }

    // B. Lớp Markov Chain (Xác suất chuyển trạng thái)
    let transitions = { 'T->T': 0, 'T->X': 0, 'X->T': 0, 'X->X': 0 };
    for(let i=0; i < results.length - 1; i++) {
        transitions[`${results[i]}->${results[i+1]}`]++;
    }
    const tProb = transitions[`${lastResult}->T`];
    const xProb = transitions[`${lastResult}->X`];
    tProb > xProb ? scoreT += 20 : scoreX += 20;

    // C. Lớp Momentum (Lực xúc xắc)
    const diff = lastPoint - points[points.length - 2];
    if (lastPoint >= 15 && diff > 0) scoreX += 30; // Quá cao + đang lên -> Đảo chiều
    if (lastPoint <= 6 && diff < 0) scoreT += 30;  // Quá thấp + đang xuống -> Đảo chiều

    // D. Lớp Trend (Cầu bệt/đảo)
    let streak = 0;
    for(let i = results.length - 1; i >= 0; i--) {
        if(results[i] === lastResult) streak++; else break;
    }
    if (streak >= 5) { // Chống bệt
        lastResult === 'T' ? scoreX += 25 : scoreT += 25;
    }

    const total = scoreT + scoreX;
    const finalSide = scoreT >= scoreX ? 'TÀI' : 'XỈU';
    const confidence = total > 0 ? 65 + (Math.abs(scoreT - scoreX) / total) * 34 : 50;

    return {
        id: Number(data[0].id) + 1,
        prediction: finalSide,
        confidence: Math.min(98.8, confidence).toFixed(1),
        history: results.slice(-12).reverse()
    };
}

async function runEngine() {
    try {
        const [resHu, resMd5] = await Promise.all([
            axios.get(API_HU, { timeout: 4000 }),
            axios.get(API_MD5, { timeout: 4000 })
        ]);
        if (resHu.data?.list) globalState.hu = advancedDecoder(resHu.data.list);
        if (resMd5.data?.list) globalState.md5 = advancedDecoder(resMd5.data.list);
    } catch (e) { console.log("Engine sync error..."); }
}
setInterval(runEngine, 2000);

// =========================================================================
// GIAO DIỆN PHÂN TÁCH 2 NGĂN - SIÊU ĐẲNG CẤP
// =========================================================================
app.get('/api/data', (req, res) => res.json(globalState));
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>𝐌𝐫.𝐬𝟗 𝓹𝓻𝓲𝓶𝓮 𝐕𝟐𝟎</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Rajdhani:wght@500;700&display=swap');
            
            body { 
                margin: 0; background: #000; color: #fff; 
                font-family: 'Rajdhani', sans-serif; overflow: hidden;
                height: 100vh; width: 100vw;
            }

            /* Galaxy Background Canvas */
            #galaxy { position: fixed; top: 0; left: 0; z-index: -1; }

            /* Chia 2 ngăn chính */
            .split-wrapper {
                display: flex; height: 100vh; width: 100vw;
                background: rgba(0,0,0,0.2);
            }

            .compartment {
                flex: 1; display: flex; flex-direction: column;
                align-items: center; justify-content: center;
                position: relative; transition: 0.5s;
                padding: 20px; border-right: 1px solid rgba(255,255,255,0.05);
            }

            /* Hiệu ứng ngăn cách */
            .compartment::after {
                content: ''; position: absolute; top: 10%; right: 0; height: 80%; width: 1px;
                background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.2), transparent);
            }

            .brand-title {
                position: absolute; top: 30px; font-family: 'Orbitron';
                font-size: 28px; letter-spacing: 5px;
                background: linear-gradient(to bottom, #fff, #888);
                -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                filter: drop-shadow(0 0 10px rgba(255,255,255,0.3));
            }

            .table-tag {
                font-family: 'Orbitron'; font-size: 14px; padding: 5px 15px;
                border-radius: 50px; margin-bottom: 20px; letter-spacing: 2px;
            }
            .tag-hu { border: 1px solid #00f2fe; color: #00f2fe; box-shadow: 0 0 15px rgba(0,242,254,0.3); }
            .tag-md5 { border: 1px solid #ff007f; color: #ff007f; box-shadow: 0 0 15px rgba(255,0,127,0.3); }

            .session-id { font-family: 'Orbitron'; font-size: 20px; color: #aaa; margin-bottom: 10px; }

            /* Kết quả dự đoán cực lớn */
            .prediction-text {
                font-family: 'Orbitron'; font-size: clamp(80px, 8vw, 130px); font-weight: 900;
                margin: 10px 0; letter-spacing: 10px; transition: 0.3s;
            }
            .tai-glow { color: #00f2fe; text-shadow: 0 0 40px #00f2fe, 0 0 80px rgba(0,242,254,0.5); }
            .xiu-glow { color: #ff007f; text-shadow: 0 0 40px #ff007f, 0 0 80px rgba(255,0,127,0.5); }

            /* Thanh độ tin cậy */
            .confidence-wrap { width: 80%; max-width: 300px; text-align: center; margin-top: 20px; }
            .conf-label { font-size: 12px; color: #666; letter-spacing: 3px; margin-bottom: 10px; }
            .conf-bar-bg { width: 100%; height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px; overflow: hidden; }
            .conf-bar-fill { height: 100%; width: 0%; transition: 1.5s cubic-bezier(0.1, 0.7, 1.0, 0.1); }
            .fill-hu { background: #00f2fe; box-shadow: 0 0 10px #00f2fe; }
            .fill-md5 { background: #ff007f; box-shadow: 0 0 10px #ff007f; }

            .conf-percent { font-family: 'Orbitron'; font-size: 24px; margin-top: 10px; }

            /* Lịch sử phiên */
            .history-dots { display: flex; gap: 8px; margin-top: 40px; }
            .dot { width: 12px; height: 12px; border-radius: 50%; opacity: 0.8; }
            .dot.T { background: #00f2fe; box-shadow: 0 0 8px #00f2fe; }
            .dot.X { background: #ff007f; box-shadow: 0 0 8px #ff007f; }

            /* Responsive */
            @media (max-width: 768px) {
                .split-wrapper { flex-direction: column; }
                .compartment { border-right: none; border-bottom: 1px solid rgba(255,255,255,0.05); }
                .compartment::after { display: none; }
                .brand-title { display: none; }
            }
        </style>
    </head>
    <body>
        <canvas id="galaxy"></canvas>
        <div class="brand-title" style="left: 50%; transform: translateX(-50%);">𝐌𝐫.𝐬𝟗 𝓹𝓻𝓲𝓶𝓮</div>

        <div class="split-wrapper">
            <div class="compartment">
                <div class="table-tag tag-hu">JACKPOT TABLE</div>
                <div class="session-id" id="hu-id">#-------</div>
                <div class="prediction-text" id="hu-pred">---</div>
                <div class="confidence-wrap">
                    <div class="conf-label">STRENGTH ANALYSIS</div>
                    <div class="conf-bar-bg"><div id="hu-bar" class="conf-bar-fill fill-hu"></div></div>
                    <div class="conf-percent" id="hu-conf">0.0%</div>
                </div>
                <div class="history-dots" id="hu-hist"></div>
            </div>

            <div class="compartment">
                <div class="table-tag tag-md5">MD5 ALGORITHM</div>
                <div class="session-id" id="md5-id">#-------</div>
                <div class="prediction-text" id="md5-pred">---</div>
                <div class="confidence-wrap">
                    <div class="conf-label">STRENGTH ANALYSIS</div>
                    <div class="conf-bar-bg"><div id="md5-bar" class="conf-bar-fill fill-md5"></div></div>
                    <div class="conf-percent" id="md5-conf">0.0%</div>
                </div>
                <div class="history-dots" id="md5-hist"></div>
            </div>
        </div>

        <script>
            // 1. Hiệu ứng Galaxy & Sao băng & Hoa rơi
            const canvas = document.getElementById('galaxy');
            const ctx = canvas.getContext('2d');
            let w, h, particles = [];
            function init() {
                w = canvas.width = window.innerWidth;
                h = canvas.height = window.innerHeight;
            }
            window.addEventListener('resize', init); init();

            class Particle {
                constructor() {
                    this.reset();
                }
                reset() {
                    this.x = Math.random() * w;
                    this.y = Math.random() * h;
                    this.size = Math.random() * 2;
                    this.speedY = Math.random() * 0.5 + 0.2;
                    this.type = Math.random() > 0.95 ? 'meteor' : 'star';
                    this.color = ['#00f2fe', '#ff007f', '#ffffff', '#ffcc00'][Math.floor(Math.random()*4)];
                }
                draw() {
                    ctx.fillStyle = this.color;
                    if(this.type === 'meteor') {
                        ctx.fillRect(this.x, this.y, 1, 20);
                        this.y += 10; this.x -= 2;
                    } else {
                        ctx.beginPath();
                        ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
                        ctx.fill();
                        this.y += this.speedY;
                    }
                    if(this.y > h) this.reset();
                }
            }
            for(let i=0; i<150; i++) particles.push(new Particle());

            function animate() {
                ctx.fillStyle = 'rgba(0,0,0,0.1)';
                ctx.fillRect(0,0,w,h);
                particles.forEach(p => p.draw());
                requestAnimationFrame(animate);
            }
            animate();

            // 2. Đồng bộ dữ liệu
            async function updateUI() {
                try {
                    const res = await fetch('/api/data');
                    const data = await res.json();

                    ['hu', 'md5'].forEach(type => {
                        const d = data[type];
                        if(d && d.id) {
                            document.getElementById(type+'-id').innerText = "#" + d.id;
                            const pred = document.getElementById(type+'-pred');
                            pred.innerText = d.prediction;
                            pred.className = "prediction-text " + (d.prediction === 'TÀI' ? 'tai-glow' : 'xiu-glow');
                            
                            document.getElementById(type+'-conf').innerText = d.confidence + "%";
                            document.getElementById(type+'-bar').style.width = d.confidence + "%";
                            
                            const hist = document.getElementById(type+'-hist');
                            hist.innerHTML = d.history.map(r => \`<div class="dot \${r}"></div>\`).join('');
                        }
                    });
                } catch(e) {}
            }
            setInterval(updateUI, 2000);
            updateUI();
        </script>
    </body>
    </html>
    `);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('--- 𝐌𝐫.𝐬𝟗 𝓹𝓻𝓲𝓶𝓮 V20 DEPLOYED SUCCESSFULLY ---');
});
