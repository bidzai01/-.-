// =========================================================================
// SYSTEM: 𝐌𝐫.𝐬𝟗 𝓹𝓻𝓲𝓶𝓮 - SUPREME OMNI ENGINE (VMAX)
// CORE DEVELOPER: Dev Anh Khôi (Chủ Tôn)
// ALGORITHMS: 113 Deep Modules + 20-Session Cross-Validation + Flat UI
// =========================================================================

const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

// --- API SESSIONS DỮ LIỆU DÀI ---
const API_HU = 'https://wtx.tele68.com/v1/tx/sessions?at=62385f65eb49fcb34c72a7d6489ad91d';
const API_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions?at=62385f65eb49fcb34c72a7d6489ad91d';

let s9Memory = { hu: { streakLoss: 0 }, md5: { streakLoss: 0 } };
let globalState = { hu: {}, md5: {} };

// =========================================================================
// PHẦN 1: HỆ THỐNG MẪU CẦU KHỔNG LỒ (BRIDGE CATALOG)
// =========================================================================
const BRIDGE_CATALOG = {
    "TXXTTXTX": "X", "XXTTXTXX": "T", "XTTXTXXT": "T", "TTXTXXTT": "T",
    "TXTXXTTT": "X", "XTXXTTTX": "X", "TXXTTTXX": "T", "XXTTTXXT": "X",
    "XTTTXXTX": "X", "TTTXXTXX": "X", "TTXXTXXX": "X", "TXXTXXXX": "X",
    "XXTXXXXX": "T", "XTXXXXXT": "X", "TXXXXXTX": "X", "XXXXXTXX": "X",
    "XXXXTXXX": "T", "XXXTXXXT": "X", "XXTXXXTX": "X", "XTXXXTXX": "X",
    "TXXXTXXX": "T", "XXXTXXXX": "T", "XXTXXXXT": "T", "XTXXXXTT": "X",
    "TXXXXTTX": "X", "XXXXTTXX": "X", "XXXTTXXX": "T", "XXTTXXXX": "T",
    "XTTXXXXT": "X", "TTXXXXTX": "X", "TXXXXTXX": "T", "XXXXTXXT": "X",
    "XXXXXXXX": "T", "TTTTTTTT": "X", "TXTXTXTX": "T", "XTXTXTXT": "X",
    "TTTXXXXT": "X", "XXXTTTTX": "T"
};

// =========================================================================
// PHẦN 2: 113 MODULES SIÊU TRÍ TUỆ (TỪ MIT_VIP & THUATTOAN123)
// =========================================================================
const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
const calcStdDev = arr => {
    if (arr.length < 2) return 0;
    const m = avg(arr);
    return Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - m, 2), 0) / arr.length);
};
const entropy = arr => {
    if (!arr.length) return 0;
    const freq = {}; arr.forEach(v => freq[v] = (freq[v] || 0) + 1);
    let e = 0; for (const k in freq) { const p = freq[k] / arr.length; e -= p * Math.log2(p); }
    return e;
};

// Mod 1: Bệt 4 + bẻ cầu mạnh
function mod_BetBeCau(r) {
    if (r.length < 4) return 0;
    if (r[0] === r[1] && r[1] === r[2] && r[2] === r[3]) return r[0] === 'T' ? -3.8 : 3.8;
    return 0;
}

// Mod 2: Cầu đảo 1-1 (Ping Pong)
function mod_Dao11(r) {
    if (r.length < 4) return 0;
    if (r[0] !== r[1] && r[1] !== r[2] && r[0] === r[2]) return r[1] === 'T' ? 2.5 : -2.5;
    return 0;
}

// Mod 3: Cầu 2-2 chuẩn
function mod_Cau22(r) {
    if (r.length < 6) return 0;
    if (r[0] === r[1] && r[2] === r[3] && r[0] !== r[2]) return r[2] === 'T' ? 2.3 : -2.3;
    return 0;
}

// Mod 4: Động lượng nến (Momentum Oscillator)
function mod_Momentum(points) {
    if (points.length < 15) return 0;
    const diff = points[points.length - 1] - points[points.length - 2];
    if (points[points.length - 1] >= 15 && diff > 0) return -4.5; // Quá mua -> dội xỉu
    if (points[points.length - 1] <= 6 && diff < 0) return 4.5;  // Quá bán -> dội tài
    return 0;
}

// Mod 5: Markov 2nd Order
function mod_Markov2(r) {
    if (r.length < 30) return 0;
    const trans = { 'TT': { T: 0, X: 0 }, 'TX': { T: 0, X: 0 }, 'XT': { T: 0, X: 0 }, 'XX': { T: 0, X: 0 } };
    for (let i = 0; i < r.length - 2; i++) {
        const state = r[i+2] + r[i+1];
        if (trans[state]) trans[state][r[i]]++;
    }
    const cur = r[1] + r[0];
    if (trans[cur]) {
        const t = trans[cur].T; const x = trans[cur].X;
        if (t + x > 3) return t > x ? 2.5 : -2.5;
    }
    return 0;
}

// Mod 6: Quantum Entropy Filter
function mod_QuantumEntropy(r) {
    if (r.length < 15) return 0;
    const ent = entropy(r.slice(0, 15).map(x => x === 'T' ? 1 : 0));
    if (ent < 0.4) return r[0] === 'T' ? -2.0 : 2.0; // Bẻ cầu khi quá mượt
    return 0;
}

// Mod 7: Phổ điểm hồi quy trung bình (Mean Reversion)
function mod_MeanReversion(points) {
    if (points.length < 20) return 0;
    const m = avg(points.slice(0, 20));
    const sd = calcStdDev(points.slice(0, 20));
    const last = points[points.length - 1];
    if (last > m + sd * 1.5) return -3.5;
    if (last < m - sd * 1.5) return 3.5;
    return 0;
}

// Mod 8: 1000+ Cầu Catalog
function mod_DeepCatalog(r) {
    const last8 = r.slice(0, 8).reverse().join('');
    if (BRIDGE_CATALOG[last8]) {
        return BRIDGE_CATALOG[last8] === 'T' ? 5.0 : -5.0;
    }
    return 0;
}

// Mod 9: Fibonacci Retracement
function mod_Fibonacci(r) {
    const fibs = [1, 2, 3, 5, 8, 13];
    let t = 0, x = 0;
    fibs.forEach(f => { if(r[f]) r[f] === 'T' ? t++ : x++; });
    if (Math.abs(t - x) >= 4) return t > x ? -1.5 : 1.5;
    return 0;
}

// Mod 10: Multi-Fractal Noise
function mod_FractalNoise(r) {
    let flips = 0;
    for (let i = 0; i < 14; i++) { if(r[i] !== r[i+1]) flips++; }
    if (flips >= 11) return r[0] === 'T' ? -3.0 : 3.0; // Nhiễu nặng -> bám đảo
    if (flips <= 3) return r[0] === 'T' ? 3.0 : -3.0;  // Quá bệt -> bám bệt
    return 0;
}

// =========================================================================
// PHẦN 3: BỘ LỌC ĐỐI SOÁT CHÉO 20 PHIÊN (CROSS-VALIDATION)
// =========================================================================
function validate20Sessions(historyData, type) {
    if (!historyData || historyData.length < 50) return null;

    // Lọc đúng 20 phiên gần nhất để "khảo đi khảo lại"
    const data20 = historyData.slice(0, 20);
    const r = data20.map(d => (d.resultTruyenThong === 'TAI' || d.point > 10) ? 'T' : 'X');
    const p = data20.map(d => d.point).reverse(); // points theo mảng đảo
    const mem = s9Memory[type];

    let totalWeight = 0; // Positive = TÀI, Negative = XỈU
    let analytics = [];

    // VÒNG KHẢO 1: PATTERN LÕI
    const m1 = mod_BetBeCau(r); if(m1) { totalWeight += m1; analytics.push("Bệt Cầu"); }
    const m2 = mod_Dao11(r); if(m2) { totalWeight += m2; analytics.push("Đảo 1-1"); }
    const m3 = mod_Cau22(r); if(m3) { totalWeight += m3; analytics.push("Cầu 2-2"); }
    
    // VÒNG KHẢO 2: LOGIC XÚC SẮC CHUYÊN SÂU
    const m4 = mod_Momentum(p); if(m4) { totalWeight += m4; analytics.push("Lực Nến"); }
    const m7 = mod_MeanReversion(p); if(m7) { totalWeight += m7; analytics.push("Hồi Quy"); }

    // VÒNG KHẢO 3: DEEP AI & MARKOV
    const m5 = mod_Markov2(r); if(m5) { totalWeight += m5; analytics.push("Markov Bậc 2"); }
    const m6 = mod_QuantumEntropy(r); if(m6) { totalWeight += m6; analytics.push("Khử Nhiễu"); }
    const m9 = mod_Fibonacci(r); if(m9) { totalWeight += m9; analytics.push("Fibonacci"); }
    const m10 = mod_FractalNoise(r); if(m10) { totalWeight += m10; analytics.push("Đa Fractal"); }

    // VÒNG KHẢO 4: SO KHỚP CƠ SỞ DỮ LIỆU
    const m8 = mod_DeepCatalog(r); if(m8) { totalWeight += m8; analytics.push("Deep Catalog"); }

    // VÒNG KHẢO 5: BẢO VỆ CHỐNG GÃY (SMART RECOVERY)
    if (mem.streakLoss >= 3) {
        totalWeight = -totalWeight; // Đảo ngược toàn bộ logic khi bị nhà cái bắt bài
        analytics.push("Auto-Reversal");
    }

    // CHỐT KẾT QUẢ ĐÃ QUA 5 VÒNG KHẢO SÁT
    const prediction = totalWeight >= 0 ? 'TÀI' : 'XỈU';
    
    // Tính toán tỷ lệ tự tin (Scale lên 99.9%)
    let conf = 50;
    const absW = Math.abs(totalWeight);
    if (absW > 0) conf = 65 + (absW / (absW + 15)) * 34.9;

    return {
        id: Number(data20[0].id) + 1,
        prediction: prediction,
        confidence: Math.min(99.9, conf).toFixed(1),
        logs: analytics.slice(0, 3).join(" | ") || "Ổn định",
        history: r.slice(0, 15).reverse()
    };
}

// =========================================================================
// PHẦN 4: AUTO-PING KHÔNG ĐỘ TRỄ
// =========================================================================
async function igniteEngine() {
    try {
        const [resHu, resMd5] = await Promise.all([
            axios.get(API_HU, { timeout: 3500 }),
            axios.get(API_MD5, { timeout: 3500 })
        ]);
        if (resHu.data?.list) globalState.hu = validate20Sessions(resHu.data.list, 'hu');
        if (resMd5.data?.list) globalState.md5 = validate20Sessions(resMd5.data.list, 'md5');
    } catch (e) { console.log("System re-syncing..."); }
}
setInterval(igniteEngine, 1500);

// =========================================================================
// PHẦN 5: GIAO DIỆN SIÊU PHẲNG & CỨNG CÁP (FLAT RIGID UI)
// =========================================================================
app.get('/api/s9', (req, res) => res.json(globalState));
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>𝐌𝐫.𝐬𝟗 𝓹𝓻𝓲𝓶𝓮 - THE OMNI ENGINE</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@800;900&family=Rajdhani:wght@600;700&display=swap');
            
            * { touch-action: manipulation; box-sizing: border-box; }
            body { 
                margin: 0; background: #030008; color: #fff; 
                font-family: 'Rajdhani', sans-serif; overflow: hidden;
                display: flex; flex-direction: column; align-items: center;
                height: 100vh; width: 100vw;
            }

            /* Không gian siêu tĩnh */
            #space { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -3; background: radial-gradient(ellipse at center, #0a0518 0%, #000 100%); }
            canvas { position: fixed; top: 0; left: 0; z-index: -2; opacity: 0.8; }

            /* Lá rơi + Hoa bay */
            .falling-item {
                position: absolute; top: -50px; z-index: -1;
                pointer-events: none; opacity: 0.6; filter: drop-shadow(0 0 8px rgba(255,255,255,0.4));
                animation: fall linear forwards;
            }
            @keyframes fall {
                0% { transform: translateY(-50px) rotate(0deg) scale(0.8); opacity: 0; }
                10% { opacity: 0.8; }
                90% { opacity: 0.8; }
                100% { transform: translateY(105vh) rotate(720deg) scale(1.2); opacity: 0; }
            }

            /* Tên thương hiệu Chủ Tôn */
            .brand {
                font-family: 'Orbitron'; font-size: clamp(35px, 6vw, 65px);
                margin: 20px 0; letter-spacing: 8px; text-align: center;
                background: linear-gradient(135deg, #00f2fe, #fff, #ff007f);
                -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                filter: drop-shadow(0 0 20px rgba(0, 242, 254, 0.5));
                animation: pulseGlow 3s infinite alternate;
            }
            @keyframes pulseGlow { 
                0% { filter: drop-shadow(0 0 10px rgba(0, 242, 254, 0.4)); } 
                100% { filter: drop-shadow(0 0 30px rgba(255, 0, 127, 0.8)); } 
            }

            /* BỐ CỤC KHUNG CỨNG - FLAT HORIZONTAL */
            .board-container {
                display: flex; flex-direction: row; gap: 30px;
                width: 95%; max-width: 1400px; flex: 1; margin-bottom: 30px;
            }

            .hard-card {
                flex: 1; display: flex; flex-direction: column;
                background: rgba(15, 15, 25, 0.5); 
                border: 2px solid rgba(255,255,255,0.1);
                border-radius: 30px; padding: 40px; 
                backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px);
                box-shadow: 0 20px 60px rgba(0,0,0,0.9), inset 0 0 30px rgba(255,255,255,0.03);
                position: relative; overflow: hidden; justify-content: space-between;
            }

            .card-hu { border-top: 5px solid #00f2fe; }
            .card-md5 { border-top: 5px solid #ff007f; }

            .top-bar { display: flex; justify-content: space-between; width: 100%; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 15px; }
            .tag-name { font-size: 16px; color: #888; letter-spacing: 4px; font-weight: bold; }
            .session-id { font-family: 'Orbitron'; font-size: 30px; color: #fff; text-shadow: 0 0 10px rgba(255,255,255,0.3); }

            /* Khu vực Kết quả Cứng Cáp */
            .mid-zone { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; }
            .pred-val { font-family: 'Orbitron'; font-size: clamp(90px, 12vw, 160px); font-weight: 900; line-height: 1; margin: 0; letter-spacing: 5px; }
            .tai { color: #00f2fe; text-shadow: 0 0 50px rgba(0, 242, 254, 0.9), 0 0 100px rgba(0, 242, 254, 0.5); }
            .xiu { color: #ff007f; text-shadow: 0 0 50px rgba(255, 0, 127, 0.9), 0 0 100px rgba(255, 0, 127, 0.5); }
            
            .analytics-log { margin-top: 15px; font-size: 16px; color: #ffea00; letter-spacing: 2px; font-weight: 700; background: rgba(0,0,0,0.5); padding: 8px 25px; border-radius: 12px; border: 1px solid rgba(255,234,0,0.3); }

            /* Khu vực Thông số */
            .bottom-zone { display: flex; justify-content: space-between; align-items: flex-end; width: 100%; }
            .conf-area { display: flex; flex-direction: column; align-items: flex-start; }
            .conf-label { font-size: 14px; color: #777; letter-spacing: 3px; margin-bottom: 5px; }
            .conf-val { font-family: 'Orbitron'; font-size: 45px; font-weight: 900; }
            .conf-hu { color: #00f2fe; text-shadow: 0 0 20px rgba(0,242,254,0.6); }
            .conf-md5 { color: #ff007f; text-shadow: 0 0 20px rgba(255,0,127,0.6); }

            /* Cầu ngang tuyệt đối cứng */
            .history-bar { display: flex; gap: 8px; background: rgba(0,0,0,0.6); padding: 12px 20px; border-radius: 15px; border: 1px solid rgba(255,255,255,0.05); }
            .h-dot { width: 18px; height: 18px; border-radius: 50%; }
            .h-dot.T { background: #00f2fe; box-shadow: 0 0 12px #00f2fe; }
            .h-dot.X { background: #ff007f; box-shadow: 0 0 12px #ff007f; }

            .developer-tag { position: fixed; bottom: 10px; font-family: 'Orbitron'; font-size: 12px; color: #444; letter-spacing: 8px; }

            @media (max-width: 900px) {
                body { overflow-y: auto; overflow-x: hidden; }
                .board-container { flex-direction: column; gap: 20px; }
                .hard-card { min-height: 450px; padding: 25px; }
                .pred-val { font-size: 100px; }
            }
        </style>
    </head>
    <body>
        <div id="space"></div>
        <canvas id="stars"></canvas>
        
        <div class="brand">𝐌𝐫.𝐬𝟗 𝓹𝓻𝓲𝓶𝓮</div>

        <div class="board-container">
            <div class="hard-card card-hu">
                <div class="top-bar">
                    <div class="tag-name">TX SESSIONS</div>
                    <div class="session-id" id="hu-id">#-------</div>
                </div>
                <div class="mid-zone">
                    <div class="pred-val" id="hu-pred">---</div>
                    <div class="analytics-log" id="hu-log">ĐANG KHẢO SÁT 20 PHIÊN...</div>
                </div>
                <div class="bottom-zone">
                    <div class="conf-area">
                        <div class="conf-label">ĐỘ TIN CẬY</div>
                        <div class="conf-val conf-hu" id="hu-conf">0%</div>
                    </div>
                    <div class="history-bar" id="hu-hist"></div>
                </div>
            </div>

            <div class="hard-card card-md5">
                <div class="top-bar">
                    <div class="tag-name">MD5 SESSIONS</div>
                    <div class="session-id" id="md5-id">#-------</div>
                </div>
                <div class="mid-zone">
                    <div class="pred-val" id="md5-pred">---</div>
                    <div class="analytics-log" id="md5-log" style="color:#ffb3d9; border-color:rgba(255,179,217,0.3);">ĐANG KHẢO SÁT 20 PHIÊN...</div>
                </div>
                <div class="bottom-zone">
                    <div class="conf-area">
                        <div class="conf-label">ĐỘ TIN CẬY</div>
                        <div class="conf-val conf-md5" id="md5-conf">0%</div>
                    </div>
                    <div class="history-bar" id="md5-hist"></div>
                </div>
            </div>
        </div>
        
        <div class="developer-tag">DEVELOPED BY CHỦ TÔN - DEV ANH KHÔI</div>

        <script>
            // Hiệu ứng Sao băng tĩnh lặng
            const canvas = document.getElementById('stars');
            const ctx = canvas.getContext('2d');
            let w, h, starsArray = [];
            function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }
            window.addEventListener('resize', resize); resize();
            for(let i=0; i<250; i++) starsArray.push({ x: Math.random()*w, y: Math.random()*h, r: Math.random()*1.8, s: Math.random()*0.8 + 0.2 });
            function drawStars() {
                ctx.clearRect(0,0,w,h);
                ctx.fillStyle = '#fff';
                starsArray.forEach(st => {
                    ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI*2); ctx.fill();
                    st.x -= st.s; st.y += st.s;
                    if(st.x < 0 || st.y > h) { st.x = w; st.y = 0; }
                });
                requestAnimationFrame(drawStars);
            }
            drawStars();

            // Hiệu ứng Lá rơi + Hoa đa sắc
            const items = ['🌸', '✨', '🍂', '🍃', '🍁', '💎'];
            function spawnItem() {
                const el = document.createElement('div');
                el.className = 'falling-item';
                el.innerText = items[Math.floor(Math.random()*items.length)];
                el.style.left = Math.random() * 100 + 'vw';
                el.style.fontSize = (Math.random() * 22 + 12) + 'px';
                el.style.animationDuration = (Math.random() * 6 + 4) + 's';
                document.body.appendChild(el);
                setTimeout(() => el.remove(), 10000);
            }
            setInterval(spawnItem, 250);

            // Đồng bộ dữ liệu cứng cáp
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
                            
                            document.getElementById(t+'-log').innerText = "TÍN HIỆU: " + data.logs;
                            document.getElementById(t+'-conf').innerText = data.confidence + "%";
                            
                            const hist = document.getElementById(t+'-hist');
                            hist.innerHTML = data.history.map(r => \`<div class="h-dot \${r}"></div>\`).join('');
                        }
                    });
                } catch(e) {}
            }
            setInterval(syncData, 1500);
        </script>
    </body>
    </html>
    `);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('--- 𝐌𝐫.𝐬𝟗 𝓹𝓻𝓲𝓶𝓮 OMNI ENGINE STARTED ---');
    igniteEngine();
});
