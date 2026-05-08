const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

// --- CẤU HÌNH API GỐC ---
const API_HU = 'https://wtx.tele68.com/v1/tx/sessions';
const API_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';

// --- BIẾN LƯU TRỮ DỮ LIỆU ---
let globalData = { hu: {}, md5: {} };

// --- HỆ THỐNG THUẬT TOÁN TỔNG HỢP (KING S9 VIP) ---
function analyzeMaster(history) {
    if (!history || history.length < 20) return { pred: "ĐANG QUÉT...", conf: 0, reason: "Thiếu dữ liệu" };

    const last20 = history.slice(0, 20);
    const results = last20.map(d => d.resultTruyenThong || (d.point > 10 ? 'TAI' : 'XIU'));
    const points = last20.map(d => d.point);
    
    let taiScore = 0;
    let xiuScore = 0;

    // 1. Thuật toán Detect Streak (Soi Bệt) - Từ predictionAlgorithmsAll.js
    let streak = 1;
    for (let i = 1; i < results.length; i++) {
        if (results[i] === results[0]) streak++;
        else break;
    }
    
    // Logic bẻ cầu: Nếu bệt quá 4 tay, tăng xác suất bẻ
    if (streak >= 4) {
        if (results[0] === 'TAI') xiuScore += (1.5 * streak);
        else taiScore += (1.5 * streak);
    } else {
        // Theo cầu bệt
        if (results[0] === 'TAI') taiScore += 1.2;
        else xiuScore += 1.2;
    }

    // 2. Thuật toán Cầu Đảo 1-1 / 2-2 (Bridge Pattern)
    const pattern = results.slice(0, 4).join('');
    if (pattern === 'TAIXIUTAIXIU' || pattern === 'XIUTAIXIUTAI') {
        if (results[0] === 'TAI') xiuScore += 2.5; 
        else taiScore += 2.5;
    }

    // 3. Thuật toán Tỷ lệ (Imbalance) - Phân tích 20 phiên
    const taiCount = results.filter(r => r === 'TAI').length;
    const xiuCount = 20 - taiCount;
    if (taiCount > 13) xiuScore += 2.0; // Quá nhiều Tài -> Nuôi Xỉu
    if (xiuCount > 13) taiScore += 2.0; // Quá nhiều Xỉu -> Nuôi Tài

    // 4. Thuật toán Điểm Số (Dice Sum Trend)
    const avgPoint = points.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    if (avgPoint > 12) xiuScore += 1.0;
    if (avgPoint < 9) taiScore += 1.0;

    // KẾT LUẬN
    const prediction = taiScore >= xiuScore ? 'TÀI' : 'XỈU';
    const confidence = Math.min(98, 65 + Math.abs(taiScore - xiuScore) * 5);

    return { 
        pred: prediction, 
        conf: Math.round(confidence),
        lastResult: `${results[0]} (${points[0]})`
    };
}

// --- QUÉT API LIÊN TỤC MỖI 1 GIÂY ---
async function scanSystem() {
    try {
        const [resHu, resMd5] = await Promise.all([
            axios.get(API_HU, { timeout: 900 }),
            axios.get(API_MD5, { timeout: 900 })
        ]);

        const listHu = resHu.data.list;
        const listMd5 = resMd5.data.list;

        globalData.hu = {
            nextPhien: listHu[0].id + 1,
            analysis: analyzeMaster(listHu)
        };

        globalData.md5 = {
            nextPhien: listMd5[0].id + 1,
            analysis: analyzeMaster(listMd5)
        };
    } catch (e) {
        // Bỏ qua lỗi kết nối tạm thời
    }
}

setInterval(scanSystem, 1000);

// --- GIAO DIỆN HIỂN THỊ (CYBER GALAXY STYLE) ---
app.get('/', (req, res) => {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>KINGS9 VIP - DECODER</title>
        <meta http-equiv="refresh" content="2">
        <style>
            body { 
                background: radial-gradient(circle, #0d1117 0%, #000 100%); 
                color: #fff; font-family: 'Segoe UI', sans-serif; 
                display: flex; flex-direction: column; align-items: center; 
                min-height: 100vh; margin: 0; padding-top: 20px;
            }
            .header { color: #00f2ff; font-weight: 900; font-size: 24px; text-shadow: 0 0 15px #00f2ff; margin-bottom: 20px; }
            .container { width: 95%; max-width: 450px; }
            .card { 
                background: rgba(255, 255, 255, 0.03); 
                border: 1px solid rgba(0, 242, 255, 0.3);
                border-radius: 20px; padding: 20px; margin-bottom: 20px;
                backdrop-filter: blur(10px); position: relative; overflow: hidden;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            }
            .card::before {
                content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%;
            }
            .card-hu::before { background: #ff00ff; box-shadow: 0 0 15px #ff00ff; }
            .card-md5::before { background: #00ffcc; box-shadow: 0 0 15px #00ffcc; }
            
            .title { font-size: 14px; text-transform: uppercase; color: #aaa; letter-spacing: 2px; }
            .phien { font-size: 12px; color: #666; margin-top: 5px; }
            .prediction { 
                font-size: 48px; font-weight: 900; margin: 15px 0;
                background: linear-gradient(to bottom, #fff, #888);
                -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            }
            .footer-info { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #222; pt: 10px; }
            .confidence { color: #00ff00; font-weight: bold; }
            .last { font-size: 11px; color: #444; }
        </style>
    </head>
    <body>
        <div class="header">@KINGS9VIP PRO</div>
        <div class="container">
            
            <div class="card card-hu">
                <div class="title" style="color: #ff00ff">Tài Xỉu Hũ (Legacy)</div>
                <div class="phien">Phiên dự đoán: #${globalData.hu.nextPhien || '...'}</div>
                <div class="prediction">${globalData.hu.analysis?.pred || '...'}</div>
                <div class="footer-info">
                    <div class="confidence">Độ tin cậy: ${globalData.hu.analysis?.conf || 0}%</div>
                    <div class="last">Vừa về: ${globalData.hu.analysis?.lastResult || '...'}</div>
                </div>
            </div>

            <div class="card card-md5">
                <div class="title" style="color: #00ffcc">Tài Xỉu MD5 (Siêu Cấp)</div>
                <div class="phien">Phiên dự đoán: #${globalData.md5.nextPhien || '...'}</div>
                <div class="prediction">${globalData.md5.analysis?.pred || '...'}</div>
                <div class="footer-info">
                    <div class="confidence">Độ tin cậy: ${globalData.md5.analysis?.conf || 0}%</div>
                    <div class="last">Vừa về: ${globalData.md5.analysis?.lastResult || '...'}</div>
                </div>
            </div>

        </div>
        <div style="font-size: 10px; color: #333; margin-top: 10px;">Dữ liệu quét Realtime 1s/lần</div>
    </body>
    </html>
    `;
    res.send(html);
});

app.listen(PORT, () => {
    console.log('Kings9Vip is running...');
    scanSystem();
});
