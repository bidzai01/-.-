const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

// Cấu hình API
const API_HU = 'https://wtx.tele68.com/v1/tx/lite-sessions?cp=R&cl=R&pf=web&at=62385f65eb49fcb34c72a7d6489ad91d';
const API_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/lite-sessions?cp=R&cl=R&pf=web&at=62385f65eb49fcb34c72a7d6489ad91d';

let memoryBridge = { hu: [], md5: [] }; // Lưu cầu để phân tích

// --- THUẬT TOÁN GIẢI MÃ VIP (FULL - KHÔNG RÚT GỌN) ---
function vipDecoder(dataList) {
    if (!dataList || dataList.length < 15) return null;

    // Lấy đúng 15 phiên gần nhất để check
    const last15 = dataList.slice(0, 15);
    const results = last15.map(d => (d.resultTruyenThong === 'TAI' || d.point > 10) ? 'T' : 'X');
    const points = last15.map(d => d.point);
    
    let scoreT = 0, scoreX = 0;
    let viDetail = "";

    // 1. Phân tích nhịp cầu (1-1, 2-2, bệt)
    let streak = 1;
    for(let i=1; i<results.length; i++) {
        if(results[i] === results[0]) streak++; else break;
    }
    if(streak >= 3) { // Cầu bệt -> Ưu tiên bẻ hoặc theo (Logic VIP)
        if(streak < 5) { scoreT += (results[0]==='X'?3:0); scoreX += (results[0]==='T'?3:0); }
        else { scoreT += (results[0]==='T'?2:0); scoreX += (results[0]==='X'?2:0); }
    }

    // 2. Thuật toán Điểm Nút (Vị)
    const currentPoint = points[0];
    const avgPoint = points.reduce((a, b) => a + b, 0) / 15;
    
    // Dự đoán Vị (Chẵn/Lẻ của tổng điểm)
    const viProb = currentPoint % 2 === 0 ? "LẺ (Vị)" : "CHẴN (Vị)";
    viDetail = `Dự kiến: ${viProb} | Tổng TB: ${avgPoint.toFixed(1)}`;

    // 3. Logic ép phiên
    if(currentPoint >= 15) scoreX += 4; // Quá cao -> Hồi Xỉu
    if(currentPoint <= 5) scoreT += 4;  // Quá thấp -> Hồi Tài

    const finalResult = scoreT >= scoreX ? 'TÀI' : 'XỈU';
    const confidence = Math.min(99, 60 + (Math.abs(scoreT - scoreX) * 8));

    return {
        nextPhien: Number(dataList[0].id) + 1, // Cộng thêm 1 đơn vị
        prediction: finalResult,
        confidence: confidence,
        vi: viProb,
        logs: `Phân tích 15 phiên: ${results.join('|')}`,
        history: results // Trả về để lưu cầu
    };
}

// Cập nhật dữ liệu liên tục
async function updateEngine() {
    try {
        const [res1, res2] = await Promise.all([
            axios.get(API_HU, { timeout: 3000 }),
            axios.get(API_MD5, { timeout: 3000 })
        ]);
        if(res1.data?.list) memoryBridge.hu = vipDecoder(res1.data.list);
        if(res2.data?.list) memoryBridge.md5 = vipDecoder(res2.data.list);
    } catch (e) {}
}
setInterval(updateEngine, 2000);

// --- GIAO DIỆN PHẲNG - RỘNG - KHÔNG TRỄ ---
app.get('/api/raw', (req, res) => res.json(memoryBridge));
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>DECODER PRO - DEV ANH KHÔI</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700&family=Roboto+Mono:wght@500&display=swap');
            body { 
                background: #050505; color: #fff; font-family: 'Roboto Mono', monospace; 
                margin: 0; padding: 20px; display: flex; flex-direction: column; align-items: center;
            }
            .container { width: 95%; max-width: 1200px; }
            .header-nav { 
                display: flex; justify-content: space-between; align-items: center;
                padding: 15px; border-bottom: 2px solid #333; margin-bottom: 20px;
            }
            .brand { font-family: 'Orbitron'; font-size: 24px; color: #00e5ff; text-shadow: 0 0 10px #00e5ff; }
            
            /* Giao diện hàng ngang (Flat Layout) */
            .row-card {
                display: flex; background: rgba(20,20,20,0.8); border: 1px solid #333;
                border-radius: 12px; margin-bottom: 15px; overflow: hidden;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            }
            .side-info { 
                padding: 20px; background: rgba(255,255,255,0.03); 
                width: 250px; border-right: 1px solid #333;
            }
            .main-result { 
                flex: 1; padding: 20px; display: flex; flex-direction: column; justify-content: center;
                align-items: center; position: relative;
            }
            .prediction-text { font-size: 70px; font-weight: 900; font-family: 'Orbitron'; line-height: 1; }
            .tai { color: #00e5ff; text-shadow: 0 0 30px #00e5ff; }
            .xiu { color: #ff1493; text-shadow: 0 0 30px #ff1493; }
            
            .vi-box { font-size: 20px; color: #ffea00; margin-top: 10px; font-weight: bold; }
            
            /* Thanh lưu cầu (Bridge History) */
            .bridge-history {
                width: 100%; background: #000; padding: 10px; display: flex; gap: 5px;
                border-top: 1px solid #333; justify-content: flex-start; overflow-x: auto;
            }
            .dot { width: 25px; height: 25px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; }
            .dot-t { background: #00e5ff; color: #000; }
            .dot-x { background: #ff1493; color: #fff; }

            .footer { margin-top: 30px; font-size: 12px; color: #444; letter-spacing: 2px; }
            .loading { opacity: 0.5; animation: blink 1s infinite; }
            @keyframes blink { 50% { opacity: 0.1; } }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header-nav">
                <div class="brand">MR.S9 PRIME</div>
                <div id="status">HỆ THỐNG: SẴN SÀNG</div>
            </div>

            <div class="row-card">
                <div class="side-info">
                    <div style="color: #888">PHIÊN TIẾP THEO</div>
                    <div id="hu-phien" style="font-size: 22px; color: #fff">#---------</div>
                    <div style="margin-top: 15px; color: #888">TỶ LỆ THẮNG</div>
                    <div id="hu-conf" style="font-size: 22px; color: #00ff88">0%</div>
                </div>
                <div class="main-result">
                    <div id="hu-pred" class="prediction-text loading">QUÉT...</div>
                    <div id="hu-vi" class="vi-box">Đang tính Vị...</div>
                </div>
                <div class="bridge-history" id="hu-bridge"></div>
            </div>

            <div class="row-card">
                <div class="side-info">
                    <div style="color: #888">PHIÊN TIẾP THEO</div>
                    <div id="md5-phien" style="font-size: 22px; color: #fff">#---------</div>
                    <div style="margin-top: 15px; color: #888">TỶ LỆ THẮNG</div>
                    <div id="md5-conf" style="font-size: 22px; color: #00ff88">0%</div>
                </div>
                <div class="main-result">
                    <div id="md5-pred" class="prediction-text loading">QUÉT...</div>
                    <div id="md5-vi" class="vi-box">Đang tính Vị...</div>
                </div>
                <div class="bridge-history" id="md5-bridge"></div>
            </div>
        </div>

        <div class="footer">ADMINISTRATOR: @DEVANHKHOI | V6.2 ULTIMATE</div>

        <script>
            function renderBridge(targetId, history) {
                const container = document.getElementById(targetId);
                container.innerHTML = history.map(res => 
                    \`<div class="dot \${res === 'T' ? 'dot-t' : 'dot-x'}">\${res}</div>\`
                ).join('');
            }

            async function refresh() {
                try {
                    const r = await fetch('/api/raw');
                    const data = await r.json();

                    if(data.hu) {
                        document.getElementById('hu-phien').innerText = "#" + data.hu.nextPhien;
                        document.getElementById('hu-pred').innerText = data.hu.prediction;
                        document.getElementById('hu-pred').className = "prediction-text " + (data.hu.prediction === 'TÀI' ? 'tai' : 'xiu');
                        document.getElementById('hu-conf').innerText = data.hu.confidence + "%";
                        document.getElementById('hu-vi').innerText = "> " + data.hu.vi;
                        renderBridge('hu-bridge', data.hu.history);
                    }

                    if(data.md5) {
                        document.getElementById('md5-phien').innerText = "#" + data.md5.nextPhien;
                        document.getElementById('md5-pred').innerText = data.md5.prediction;
                        document.getElementById('md5-pred').className = "prediction-text " + (data.md5.prediction === 'TÀI' ? 'tai' : 'xiu');
                        document.getElementById('md5-conf').innerText = data.md5.confidence + "%";
                        document.getElementById('md5-vi').innerText = "> " + data.md5.vi;
                        renderBridge('md5-bridge', data.md5.history);
                    }
                } catch(e) {}
            }
            setInterval(refresh, 1500);
        </script>
    </body>
    </html>
    `);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('System VIP is running on port ' + PORT);
    updateEngine();
});
