const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

// --- CẤU HÌNH API GỐC ---
const API_HU = 'https://wtx.tele68.com/v1/tx/sessions';
const API_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';

// --- TRỌNG SỐ THUẬT TOÁN TỪ FILE LC.JS ---
const WEIGHTS = {
  streak: 1.2,
  bridge: 1.5,
  distribution: 1.0,
  dice_sum: 1.1,
  break_prob: 1.4
};

// --- BIẾN LƯU TRỮ DỮ LIỆU ---
let lastData = { hu: {}, md5: {} };

// --- THUẬT TOÁN PHÂN TÍCH CHUYÊN SÂU (TỪ 3 FILE BẠN GỬI) ---
function analyzeAdvanced(history) {
  if (!history || history.length < 20) return { pred: "Chờ dữ liệu...", conf: 0 };

  const last20 = history.slice(0, 20);
  const results = last20.map(d => d.resultTruyenThong || (d.point > 10 ? 'TAI' : 'XIU'));
  const points = last20.map(d => d.point);

  let taiScore = 0;
  let xiuScore = 0;

  // 1. Phân tích Chuỗi (Streak) & Xác suất bẻ cầu (Break Probability)
  let currentStreak = 1;
  const firstResult = results[0];
  for (let i = 1; i < results.length; i++) {
    if (results[i] === firstResult) currentStreak++;
    else break;
  }

  // Nếu bệt quá dài, tăng điểm cho phe ngược lại (Bẻ cầu)
  if (currentStreak >= 4) {
    if (firstResult === 'TAI') xiuScore += WEIGHTS.break_prob * currentStreak;
    else taiScore += WEIGHTS.break_prob * currentStreak;
  }

  // 2. Phân tích Cầu 1-1, 2-2 (Bridge Pattern)
  const pattern11 = results.slice(0, 4).join('');
  if (pattern11 === 'TAIXIUTAIXIU' || pattern11 === 'XIUTAIXIUTAI') {
    if (results[0] === 'TAI') xiuScore += WEIGHTS.bridge * 2;
    else taiScore += WEIGHTS.bridge * 2;
  }

  // 3. Xu hướng tổng điểm (Dice Sum Trend)
  const avgPoint = points.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
  if (avgPoint > 10.5) xiuScore += WEIGHTS.dice_sum; // Xu hướng giảm
  else taiScore += WEIGHTS.dice_sum; // Xu hướng tăng

  // Kết luận
  const prediction = taiScore >= xiuScore ? 'Tài' : 'Xỉu';
  const confidence = Math.min(95, 60 + Math.abs(taiScore - xiuScore) * 5);

  return { pred: prediction, conf: Math.round(confidence) };
}

// --- QUÉT API LIÊN TỤC MỖI 1 GIÂY ---
async function updateData() {
  try {
    const [resHu, resMd5] = await Promise.all([
      axios.get(API_HU, { timeout: 800 }),
      axios.get(API_MD5, { timeout: 800 })
    ]);

    const listHu = resHu.data.list;
    const listMd5 = resMd5.data.list;

    lastData.hu = {
      currentPhien: listHu[0].id,
      nextPhien: listHu[0].id + 1,
      analysis: analyzeAdvanced(listHu),
      lastResult: listHu[0]
    };

    lastData.md5 = {
      currentPhien: listMd5[0].id,
      nextPhien: listMd5[0].id + 1,
      analysis: analyzeAdvanced(listMd5),
      lastResult: listMd5[0]
    };
  } catch (e) {
    console.log("Đang quét API...");
  }
}

setInterval(updateData, 1000);

// --- GIAO DIỆN HIỂN THỊ 2 DÒNG ---
app.get('/kings9vip', (req, res) => {
  const css = `
    body { background: #000; color: #fff; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .container { width: 90%; max-width: 500px; }
    .row { background: linear-gradient(145deg, #1a1a1a, #000); border: 2px solid #333; border-radius: 15px; padding: 20px; margin-bottom: 20px; text-align: center; box-shadow: 0 0 20px rgba(0,255,204,0.2); }
    .row-hu { border-color: #ffcc00; }
    .row-md5 { border-color: #00e5ff; }
    .id-tag { color: #ff00ff; font-weight: bold; font-size: 1.2em; margin-bottom: 10px; }
    .title { font-size: 0.9em; color: #aaa; text-transform: uppercase; letter-spacing: 2px; }
    .prediction { font-size: 2.5em; font-weight: 900; margin: 10px 0; text-shadow: 0 0 10px #fff; }
    .phien { color: #555; font-size: 0.8em; }
    .conf { color: #0f0; font-weight: bold; }
  `;

  const html = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>${css}</style>
        <meta http-equiv="refresh" content="2">
      </head>
      <body>
        <div class="id-tag">@KINGS9VIP - AI DECODER</div>
        <div class="container">
          <div class="row row-hu">
            <div class="title">Tài Xỉu Hũ (Legacy)</div>
            <div class="phien">Dự đoán phiên: #${lastData.hu.nextPhien || '...'}</div>
            <div class="prediction">${(lastData.hu.analysis?.pred || '...').toUpperCase()}</div>
            <div class="conf">Độ tin cậy: ${lastData.hu.analysis?.conf || 0}%</div>
          </div>

          <div class="row row-md5">
            <div class="title">Tài Xỉu MD5 (Vip)</div>
            <div class="phien">Dự đoán phiên: #${lastData.md5.nextPhien || '...'}</div>
            <div class="prediction">${(lastData.md5.analysis?.pred || '...').toUpperCase()}</div>
            <div class="conf">Độ tin cậy: ${lastData.md5.analysis?.conf || 0}%</div>
          </div>
        </div>
        <div style="font-size: 0.7em; color: #444;">Dữ liệu cập nhật thời gian thực (1s)</div>
      </body>
    </html>
  `;
  res.send(html);
});

app.listen(PORT, () => {
  console.log('Hệ thống KINGS9VIP đã sẵn sàng!');
  updateData();
});
