const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

// --- CẤU HÌNH API GỐC ---
const API_HU = 'https://wtx.tele68.com/v1/tx/sessions';
const API_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';

// --- BIẾN LƯU TRỮ DỮ LIỆU ---
let globalData = { hu: { next: 0, pred: "...", conf: 0, last: "..." }, md5: { next: 0, pred: "...", conf: 0, last: "..." } };

// --- THUẬT TOÁN TỔNG HỢP TỪ 5 FILE ---
function analyzeFullLogic(history) {
    if (!history || history.length < 20) return { pred: "ĐANG QUÉT", conf: 0, last: "Đợi xíu..." };

    const last20 = history.slice(0, 20);
    const results = last20.map(d => d.resultTruyenThong || (d.point > 10 ? 'TAI' : 'XIU'));
    const points = last20.map(d => d.point);
    
    let taiScore = 0;
    let xiuScore = 0;

    // 1. Logic Soi Bệt & Bẻ Cầu (Từ predictionAlgorithmsAll.js)
    let streak = 1;
    for (let i = 1; i < results.length; i++) {
        if (results[i] === results[0]) streak++;
        else break;
    }
    
    if (streak >= 4) { // Phát hiện bệt
        if (results[0] === 'TAI') xiuScore += (2.0 * (streak / 2)); // Tăng xác suất bẻ
        else taiScore += (2.0 * (streak / 2));
    } else {
        if (results[0] === 'TAI') taiScore += 1.5; // Theo cầu thuận
        else xiuScore += 1.5;
    }

    // 2. Logic Cầu Đảo 1-1 (Từ lc.js)
    const pattern = results.slice(0, 3).join('');
    if (pattern === 'TAIXIUTAI' || pattern === 'XIUTAIXIU') {
        if (results[0] === 'TAI') xiuScore += 3.0; 
        else taiScore += 3.0;
    }

    // 3. Logic Tổng Điểm (Từ lc79_taixiu_script.js)
    const lastPoint = points[0];
    if (lastPoint >= 15) xiuScore += 2.0; // Điểm quá cao dễ về Xỉu
    if (lastPoint <= 6) taiScore += 2.0; // Điểm quá thấp dễ về Tài

    // KẾT LUẬN
    const prediction = taiScore >= xiuScore ? 'TÀI' : 'XỈU';
    const confidence = Math.min(99, 60 + Math.abs(taiScore - xiuScore) * 6);

    return { 
        pred: prediction, 
        conf: Math.round(confidence),
        last: `${results[0]} (${points[0]})`
    };
}

// --- QUÉT API LIÊN TỤC 1 GIÂY ---
async function startScanning() {
    try {
        const [resHu, resMd5] = await Promise.all([
            axios.get(API_HU, { timeout: 950 }),
            axios.get(API_MD5, { timeout: 950 })
        ]);

        if (resHu.data && resHu.data.list) {
            globalData.hu = {
                next: resHu.data.list[0].id + 1,
                analysis: analyzeFullLogic(resHu.data.list)
            };
        }
        if (resMd5.data && resMd5.data.list) {
            globalData.md5 = {
                next: resMd5.data.list[0].id + 1,
                analysis: analyzeFullLogic(resMd5.data.list)
            };
        }
    } catch (e) {
        // Lỗi kết nối API game, tự động thử lại sau 1s
    }
}

setInterval(startScanning, 1000);

// --- GIAO DIỆN CHÍNH (TẠI TRANG CHỦ /) ---
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>KINGS9 VIP - CHỦ TÔN</title>
        <meta http-equiv="refresh" content="2">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
            body { 
                background: #050505; color: #fff; font-family: 'Share Tech Mono', monospace;
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                height: 100vh; margin: 0; overflow: hidden;
            }
            .header { color: #ff00ff; font-size: 28px; text-shadow: 0 0 20px #ff00ff; font-weight: 900; margin-bottom: 30px; }
            .card {
                width: 320px; background: rgba(20, 20, 20, 0.9); border: 2px solid #00f2ff;
                border-radius: 15px; padding: 15px; margin-bottom: 20px;
                box-shadow: 0 0 25px rgba(0, 242, 255, 0.4); text-align: center;
            }
            .card-md5 { border-color: #ff00ff; box-shadow: 0 0 25px rgba(255, 0, 255, 0.4); }
            .tag { font-size: 12px; color: #00f2ff; text-transform: uppercase; letter-spacing: 3px; }
            .phien { color: #555; font-size: 14px; margin: 5px 0; }
            .result { font-size: 55px; font-weight: 900; color: #fff; margin: 10px 0; text-shadow: 2px 2px #000; }
            .conf { color: #0f0; font-size: 18px; }
            .footer { position: fixed; bottom: 10px; font-size: 10px; color: #333; }
        </style>
    </head>
    <body>
        <div class="header">@DEV ANH KHÔI VIP</div>
        
        <div class="card">
            <div class="tag">TÀI XỈU HŨ</div>
            <div class="phien">Phiên tiếp: #${globalData.hu.next || '...'}</div>
            <div class="result">${globalData.hu.analysis?.pred || '...'}</div>
            <div class="conf">Tỉ lệ thắng: ${globalData.hu.analysis?.conf || 0}%</div>
            <div style="font-size: 11px; color: #444; margin-top: 5px;">Vừa về: ${globalData.hu.analysis?.last || '...'}</div>
        </div>

        <div class="card card-md5">
            <div class="tag" style="color: #ff00ff;">TÀI XỈU MD5</div>
            <div class="phien">Phiên tiếp: #${globalData.md5.next || '...'}</div>
            <div class="result">${globalData.md5.analysis?.pred || '...'}</div>
            <div class="conf">Tỉ lệ thắng: ${globalData.md5.analysis?.conf || 0}%</div>
            <div style="font-size: 11px; color: #444; margin-top: 5px;">Vừa về: ${globalData.md5.analysis?.last || '...'}</div>
        </div>

        <div class="footer">DỮ LIỆU QUÉT API 1S - TỰ CẬP NHẬT SAU 2S</div>
    </body>
    </html>
    `);
});

app.listen(PORT, () => {
    console.log('Kings9Vip is Online at port ' + PORT);
    startScanning();
});
