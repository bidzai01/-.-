const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

// ==========================================
// 1. CẤU HÌNH API SIÊU VIP (DỮ LIỆU SÂU)
// ==========================================
const API_HU = 'https://wtx.tele68.com/v1/tx/sessions?at=62385f65eb49fcb34c72a7d6489ad91d';
const API_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions?at=62385f65eb49fcb34c72a7d6489ad91d';

let globalData = { hu: {}, md5: {} };

// ==========================================
// 2. NHÂN THUẬT TOÁN ULTRON V10 (FULL INTEGRATION)
// ==========================================
function analyzeSuperVip(data) {
    if (!data || data.length < 30) return null;

    // Chuẩn hóa dữ liệu từ quá khứ đến hiện tại
    const history = data.map(d => ({
        point: d.point,
        result: d.point > 10 ? 'T' : 'X',
        dices: d.dices || []
    })).reverse();

    const results = history.map(h => h.result);
    const points = history.map(h => h.point);
    const lastResult = results[results.length - 1];
    
    let scoreTai = 0;
    let scoreXiu = 0;

    // --- THUẬT TOÁN 1: 35 LOẠI CẦU (PATTERN MASTER) ---
    const last10 = results.slice(-10).join('');
    
    // Cầu bệt (Streak)
    let streak = 0;
    for (let i = results.length - 1; i >= 0; i--) {
        if (results[i] === lastResult) streak++; else break;
    }
    if (streak >= 4) { lastResult === 'T' ? scoreTai += 25 : scoreXiu += 25; } // Theo bệt

    // Cầu đảo 1-1
    if (last10.includes('TXTXTX') || last10.includes('XTXTXT')) {
        lastResult === 'T' ? scoreXiu += 20 : scoreTai += 20;
    }

    // Cầu 2-2, 3-3, 1-2-3, 3-2-1
    const patterns = {
        'TTXXTT': 'X', 'XXTTXX': 'T', // 2-2
        'TTTXXX': 'T', 'XXXTTT': 'X', // 3-3
        'TXXTTT': 'X', 'XTTXXX': 'T', // 1-2-3
        'TTTXXT': 'X', 'XXXTX': 'T'   // 3-2-1
    };
    Object.keys(patterns).forEach(p => {
        if (last10.endsWith(p)) {
            patterns[p] === 'T' ? scoreTai += 30 : scoreXiu += 30;
        }
    });

    // --- THUẬT TOÁN 2: PHÂN TÍCH BIẾN THIÊN XÚC SẮC (DICE TREND) ---
    const last5Points = points.slice(-5);
    const currentPoint = last5Points[4];
    const prevPoint = last5Points[3];
    
    // Thuật toán nến (Candle Stick logic)
    if (currentPoint > prevPoint && currentPoint < 15) scoreTai += 15; // Xu hướng đang lên
    if (currentPoint < prevPoint && currentPoint > 6) scoreXiu += 15;  // Xu hướng đang xuống
    
    // Điểm chết (Điểm cực trị)
    if (currentPoint >= 16) scoreXiu += 20; // Quá cao thường hồi Xỉu
    if (currentPoint <= 5) scoreTai += 20;  // Quá thấp thường hồi Tài

    // --- THUẬT TOÁN 3: PHÂN TÍCH TÍN HIỆU BẺ CẦU (BREAK SIGNALS) ---
    const imbalance30 = results.slice(-30).filter(r => r === 'T').length;
    if (imbalance30 > 20) scoreXiu += 15; // Tài quá nhiều trong 30 phiên
    if (imbalance30 < 10) scoreTai += 15; // Xỉu quá nhiều

    // --- TỔNG HỢP & TÍNH ĐỘ TIN CẬY (CONFIDENCE) ---
    const totalScore = scoreTai + scoreXiu;
    const finalPred = scoreTai >= scoreXiu ? 'TÀI' : 'XỈU';
    
    // Tính % dựa trên sự chênh lệch score
    let confidence = 50;
    if (totalScore > 0) {
        const gap = Math.abs(scoreTai - scoreXiu);
        confidence = Math.min(99.8, 65 + (gap * 1.2));
    }

    return {
        id: Number(data[0].id) + 1,
        prediction: finalPred,
        confidence: confidence.toFixed(1),
        analytics: `Phân tích: ${streak > 2 ? 'Cầu Bệt '+streak : 'Cầu Nhảy'} | Điểm TB: ${(points.reduce((a,b)=>a+b,0)/points.length).toFixed(1)}`,
        history: results.slice(-15).reverse(),
        lastPoint: currentPoint
    };
}

// Engine lấy dữ liệu liên tục 1.5s
async function startEngine() {
    try {
        const [h, m] = await Promise.all([
            axios.get(API_HU, { timeout: 3000 }),
            axios.get(API_MD5, { timeout: 3000 })
        ]);
        if (h.data?.list) globalData.hu = analyzeSuperVip(h.data.list);
        if (m.data?.list) globalData.md5 = analyzeSuperVip(m.data.list);
    } catch (e) { console.log("Reconnecting..."); }
}
setInterval(startEngine, 1500);

// ==========================================
// 3. GIAO DIỆN GALAXY NEON + LÁ RƠI (FULL UI)
// ==========================================
app.get('/api/raw', (req, res) => res.json(globalData));
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>𝐃𝐄𝐕 𝐀𝐍𝐇 𝐊𝐇𝐎̂𝐈 - ULTRON V10</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700&family=Share+Tech+Mono&display=swap');
            body { margin: 0; background: #000; color: #fff; font-family: 'Share Tech Mono', monospace; overflow: hidden; }
            
            #bg { position: fixed; width: 100%; height: 100%; z-index: -1; background: radial-gradient(circle, #1a0033 0%, #000 100%); }
            
            .leaf { position: absolute; top: -50px; animation: fall linear infinite; pointer-events: none; opacity: 0.6; }
            @keyframes fall { 
                to { transform: translateY(105vh) rotate(360deg); } 
            }

            .header { text-align: center; padding: 20px; font-family: 'Orbitron'; font-size: 35px; 
                background: linear-gradient(to right, #00f2fe, #7117ea, #ff00ff);
                -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                text-shadow: 0 0 20px rgba(113, 23, 234, 0.5);
            }

            .container { display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 10px; }
            
            .panel { 
                width: 90%; max-width: 500px;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(0, 242, 254, 0.4);
                border-radius: 20px; padding: 20px;
                backdrop-filter: blur(15px); position: relative;
                box-shadow: 0 0 30px rgba(0, 242, 254, 0.1);
            }

            .row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
            .label { color: #888; font-size: 12px; }
            .val-id { color: #00f2fe; font-weight: bold; }
            
            .prediction { font-size: 80px; font-family: 'Orbitron'; text-align: center; margin: 10px 0; }
            .TAI { color: #00f2fe; text-shadow: 0 0 50px #00f2fe; }
            .XIU { color: #ff007f; text-shadow: 0 0 50px #ff007f; }

            .confidence-bar { height: 10px; background: #222; border-radius: 5px; overflow: hidden; margin-top: 10px; }
            .fill { height: 100%; background: linear-gradient(90deg, #00f2fe, #ff00ff); transition: width 1s; }

            .history { display: flex; gap: 5px; justify-content: center; margin-top: 15px; }
            .dot { width: 12px; height: 12px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.2); }
            .dot.T { background: #00f2fe; box-shadow: 0 0 8px #00f2fe; }
            .dot.X { background: #ff007f; box-shadow: 0 0 8px #ff007f; }

            .footer { position: fixed; bottom: 10px; width: 100%; text-align: center; color: #555; font-size: 10px; }
        </style>
    </head>
    <body>
        <div id="bg"></div>
        <div class="header">𝐃𝐄𝐕 𝐀𝐍𝐇 𝐊𝐇𝐎̂𝐈</div>
        
        <div class="container">
            <div class="panel" id="panel-hu">
                <div class="row">
                    <div><span class="label">PHIÊN:</span> <span class="val-id" id="hu-id">#---</span></div>
                    <div style="color: #ffea00;" id="hu-anal">Loading...</div>
                </div>
                <div class="prediction" id="hu-pred">---</div>
                <div class="row">
                    <span class="label">ĐỘ TIN CẬY: <span id="hu-conf-text" style="color:#fff">0%</span></span>
                </div>
                <div class="confidence-bar"><div class="fill" id="hu-fill" style="width: 0%"></div></div>
                <div class="history" id="hu-hist"></div>
            </div>

            <div class="panel" id="panel-md5" style="border-color: rgba(255, 0, 127, 0.4);">
                <div class="row">
                    <div><span class="label">MD5:</span> <span class="val-id" id="md5-id">#---</span></div>
                    <div style="color: #ffea00;" id="md5-anal">Loading...</div>
                </div>
                <div class="prediction" id="md5-pred">---</div>
                <div class="row">
                    <span class="label">ĐỘ TIN CẬY: <span id="md5-conf-text" style="color:#fff">0%</span></span>
                </div>
                <div class="confidence-bar"><div class="fill" id="md5-fill" style="width: 0%; background: #ff007f;"></div></div>
                <div class="history" id="md5-hist"></div>
            </div>
        </div>

        <div class="footer">ADMIN: @DEVANHKHOI | ALGORITHM V10.0 ULTRA</div>

        <script>
            // Lá rơi
            const icons = ['🌸', '🍂', '🍃', '🍁'];
            function createLeaf() {
                const l = document.createElement('div');
                l.className = 'leaf';
                l.innerText = icons[Math.floor(Math.random()*icons.length)];
                l.style.left = Math.random() * 100 + 'vw';
                l.style.fontSize = (Math.random()*20 + 10) + 'px';
                l.style.animationDuration = (Math.random()*5 + 5) + 's';
                document.body.appendChild(l);
                setTimeout(() => l.remove(), 10000);
            }
            setInterval(createLeaf, 500);

            async function update() {
                try {
                    const res = await fetch('/api/raw');
                    const data = await res.json();
                    
                    ['hu', 'md5'].forEach(key => {
                        const d = data[key];
                        if (d && d.id) {
                            document.getElementById(key+'-id').innerText = "#" + d.id;
                            document.getElementById(key+'-pred').innerText = d.prediction;
                            document.getElementById(key+'-pred').className = "prediction " + (d.prediction === 'TÀI' ? 'TAI' : 'XIU');
                            document.getElementById(key+'-anal').innerText = d.analytics;
                            document.getElementById(key+'-conf-text').innerText = d.confidence + "%";
                            document.getElementById(key+'-fill').style.width = d.confidence + "%";
                            
                            const hDiv = document.getElementById(key+'-hist');
                            hDiv.innerHTML = d.history.map(r => \`<div class="dot \${r}"></div>\`).join('');
                        }
                    });
                } catch(e) {}
            }
            setInterval(update, 1500);
        </script>
    </body>
    </html>
    `);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('--- 𝐌𝐫.𝐬𝟗 𝓹𝓻𝓲𝓶𝓮 ---');
    startEngine();
});
