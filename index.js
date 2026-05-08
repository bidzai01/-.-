const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

// --- CẤU HÌNH API GỐC (SUNWIN/TELE68) ---
const API_HU = 'https://wtx.tele68.com/v1/tx/lite-sessions?cp=R&cl=R&pf=web&at=62385f65eb49fcb34c72a7d6489ad91d';
const API_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/lite-sessions?cp=R&cl=R&pf=web&at=62385f65eb49fcb34c72a7d6489ad91d';

// --- BIẾN LƯU TRỮ DỮ LIỆU ---
let globalData = { hu: {}, md5: {} };

// --- THUẬT TOÁN PHÂN TÍCH 15 PHIÊN SIÊU VIP ---
function analyzeS9Prime(history) {
    if (!history || history.length < 10) return { pred: "ĐANG QUÉT", conf: 0, last: "..." };

    // Chỉ lấy đúng 15 phiên gần nhất theo yêu cầu
    const last15 = history.slice(0, 15);
    const results = last15.map(d => d.resultTruyenThong || (d.point > 10 ? 'TAI' : 'XIU'));
    const points = last15.map(d => d.point);
    
    let score = 0; // Dương là nghiêng Tài, Âm là nghiêng Xỉu

    // 1. Phân tích Xúc sắc (Dice Sum Trend)
    const recentAvg = (points[0] + points[1] + points[2]) / 3;
    if (recentAvg > 11.5) score -= 2; // Xu hướng xuống Xỉu
    if (recentAvg < 9.5) score += 2;  // Xu hướng lên Tài

    // 2. Phân tích Cầu Bệt/Đảo (Pattern Tracking)
    let streak = 1;
    for (let i = 1; i < results.length; i++) {
        if (results[i] === results[0]) streak++;
        else break;
    }
    
    if (streak >= 3) {
        // Nếu bệt dài ở 15 phiên, tính toán điểm bẻ hoặc theo
        if (results[0] === 'TAI') score -= (streak * 0.5); 
        else score += (streak * 0.5);
    }

    // 3. Phân tích Tỷ lệ Tài/Xỉu trong 15 phiên
    const taiCount = results.filter(r => r === 'TAI').length;
    const xiuCount = 15 - taiCount;
    score += (xiuCount - taiCount) * 0.8;

    // KẾT LUẬN & TÍNH % (Giới hạn 52% - 98%)
    const prediction = score >= 0 ? 'TÀI' : 'XỈU';
    let baseConf = 52 + Math.abs(score) * 4;
    
    // Đảm bảo % không nhảy quá ảo
    if (baseConf > 98) baseConf = 95 + (Math.random() * 3);
    if (baseConf < 52) baseConf = 52 + (Math.random() * 5);

    return { 
        pred: prediction, 
        conf: Math.round(baseConf),
        last: `${results[0]} (${points[0]})`
    };
}

// --- QUÉT API GỐC LIÊN TỤC 1 GIÂY ---
async function fetchData() {
    try {
        const [resHu, resMd5] = await Promise.all([
            axios.get(API_HU, { timeout: 900 }),
            axios.get(API_MD5, { timeout: 900 })
        ]);

        if (resHu.data && resHu.data.list) {
            globalData.hu = {
                next: resHu.data.list[0].id + 1,
                analysis: analyzeS9Prime(resHu.data.list)
            };
        }
        if (resMd5.data && resMd5.data.list) {
            globalData.md5 = {
                next: resMd5.data.list[0].id + 1,
                analysis: analyzeS9Prime(resMd5.data.list)
            };
        }
    } catch (e) { /* Tự động bỏ qua lỗi kết nối */ }
}

setInterval(fetchData, 1000);

// --- GIAO DIỆN GALAXY SIÊU VIP ---
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>𝐌𝐫.𝐬𝟗 𝓹𝓻𝓲𝓶𝓮 - GALAXY AI</title>
        <meta http-equiv="refresh" content="2">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;900&family=Share+Tech+Mono&display=swap');
            
            body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000; font-family: 'Share Tech Mono', monospace; }

            /* Background Galaxy Động */
            .stars-container {
                position: absolute; width: 100%; height: 100%;
                background: radial-gradient(ellipse at bottom, #1B2735 0%, #090A0F 100%);
                z-index: -1;
            }
            .star {
                position: absolute; background: white; border-radius: 50%; opacity: 0.5;
                animation: move-stars linear infinite;
            }
            @keyframes move-stars {
                from { transform: translateY(0px); }
                to { transform: translateY(-1000px); }
            }

            .main-ui {
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                height: 100vh; color: #fff;
            }

            .brand {
                font-family: 'Orbitron', sans-serif; font-size: 32px; font-weight: 900;
                background: linear-gradient(to right, #ff00cc, #3333ff, #00ffcc);
                -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                text-shadow: 0 0 20px rgba(255, 0, 204, 0.5); margin-bottom: 30px;
                animation: glow 2s ease-in-out infinite alternate;
            }

            @keyframes glow { from { filter: brightness(1); } to { filter: brightness(1.5); } }

            .card {
                width: 340px; background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 25px; padding: 25px; margin-bottom: 25px;
                backdrop-filter: blur(15px); box-shadow: 0 0 40px rgba(0, 0, 0, 0.8);
                text-align: center; position: relative;
            }
            
            .card-hu { border-top: 4px solid #ff00ff; }
            .card-md5 { border-top: 4px solid #00f2ff; }

            .tag { font-size: 14px; letter-spacing: 4px; color: #aaa; margin-bottom: 10px; }
            .phien { color: #555; font-size: 13px; margin-bottom: 5px; }
            .result { 
                font-size: 65px; font-weight: 900; margin: 10px 0;
                text-shadow: 0 0 15px #fff; font-family: 'Orbitron', sans-serif;
            }
            .percentage { 
                font-size: 20px; color: #00ff00; font-weight: bold;
                background: rgba(0, 255, 0, 0.1); padding: 5px 15px; border-radius: 50px;
                display: inline-block;
            }
            .footer-info { font-size: 10px; color: #444; margin-top: 15px; }
        </style>
    </head>
    <body>
        <div class="stars-container" id="stars"></div>
        
        <div class="main-ui">
            <div class="brand">𝐌𝐫.𝐬𝟗 𝓹𝓻𝓲𝓶𝓮</div>

            <div class="card card-hu">
                <div class="tag">TX HŨ ULTIMATE</div>
                <div class="phien">#${globalData.hu.next || 'PHÂN TÍCH...'}</div>
                <div class="result">${globalData.hu.analysis?.pred || '...'}</div>
                <div class="percentage">WIN: ${globalData.hu.analysis?.conf || 0}%</div>
                <div class="footer-info">15 PHIÊN GẦN NHẤT | VỪA VỀ: ${globalData.hu.analysis?.last || '...'}</div>
            </div>

            <div class="card card-md5">
                <div class="tag">TX MD5 SUPREME</div>
                <div class="phien">#${globalData.md5.next || 'PHÂN TÍCH...'}</div>
                <div class="result">${globalData.md5.analysis?.pred || '...'}</div>
                <div class="percentage">WIN: ${globalData.md5.analysis?.conf || 0}%</div>
                <div class="footer-info">15 PHIÊN GẦN NHẤT | VỪA VỀ: ${globalData.md5.analysis?.last || '...'}</div>
            </div>
        </div>

        <script>
            // Tạo sao bay động cho Galaxy
            const container = document.getElementById('stars');
            for (let i = 0; i < 150; i++) {
                const star = document.createElement('div');
                star.className = 'star';
                const size = Math.random() * 3 + 'px';
                star.style.width = size;
                star.style.height = size;
                star.style.left = Math.random() * 100 + '%';
                star.style.top = Math.random() * 100 + '%';
                star.style.animationDuration = (Math.random() * 3 + 2) + 's';
                star.style.animationDelay = Math.random() * 5 + 's';
                container.appendChild(star);
            }
        </script>
    </body>
    </html>
    `);
});

app.listen(PORT, () => {
    console.log('System Mr.S9 Prime is Live!');
    fetchData();
});
