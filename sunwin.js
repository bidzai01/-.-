const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;
const API_URL = "https://apivip-anhkhoi-dzaivcl.onrender.com/data";

// ======================================================
// FORMAT DATA
// ======================================================
function normalizeData(rawData) {
    let data = [];
    if (rawData && rawData.data && Array.isArray(rawData.data)) {
        data = rawData.data;
    } else if (Array.isArray(rawData)) {
        data = rawData;
    } else if (rawData && typeof rawData === 'object') {
        data = [rawData];
    }
    
    return data.map(item => {
        const d1 = item.xuc_xac_1 || 0;
        const d2 = item.xuc_xac_2 || 0;
        const d3 = item.xuc_xac_3 || 0;
        const tong = item.tong || (d1 + d2 + d3);
        let ketQua = (item.ket_qua || "").toLowerCase();
        if (!ketQua) ketQua = tong >= 11 ? "tài" : "xỉu";
        return {
            phien: item.phien || 0,
            x1: d1, x2: d2, x3: d3,
            tong: tong,
            ket_qua: ketQua,
            result: ketQua === "tài" ? "Tài" : "Xỉu",
            dice: [d1, d2, d3]
        };
    }).filter(item => item.phien > 0 && item.tong >= 3 && item.tong <= 18);
}

// ======================================================
// PREDICTOR ĐƠN GIẢN - CHẮC CHẮN HOẠT ĐỘNG
// ======================================================
function predictSimple(history) {
    const n = history.length;
    if (n < 5) return { duDoan: "tài", doTinCay: 52, reason: "Cần thêm dữ liệu" };
    
    const results = history.map(h => h.result === 'Tài' ? 'T' : 'X');
    const last = results[n - 1];
    
    // Đếm streak
    let streak = 1;
    for (let i = n - 2; i >= 0; i--) {
        if (results[i] === last) streak++;
        else break;
    }
    
    // Đếm Tài/Xỉu trong 15 phiên gần nhất
    const last15 = results.slice(-15);
    const tCount = last15.filter(r => r === 'T').length;
    
    // Logic dự đoán
    let duDoan, doTinCay;
    
    if (streak >= 7) {
        duDoan = last === 'T' ? 'xỉu' : 'tài';
        doTinCay = 85 + Math.min(10, streak - 7);
    } else if (streak >= 4) {
        duDoan = last === 'T' ? 'xỉu' : 'tài';
        doTinCay = 70 + streak;
    } else if (tCount >= 12) {
        duDoan = 'xỉu';
        doTinCay = 75;
    } else if (tCount <= 3) {
        duDoan = 'tài';
        doTinCay = 75;
    } else if (streak >= 2) {
        duDoan = last === 'T' ? 'tài' : 'xỉu';
        doTinCay = 58 + streak * 3;
    } else {
        // So sánh với 5 phiên trước
        const last5 = results.slice(-5);
        const t5 = last5.filter(r => r === 'T').length;
        if (t5 >= 4) {
            duDoan = 'xỉu';
            doTinCay = 65;
        } else if (t5 <= 1) {
            duDoan = 'tài';
            doTinCay = 65;
        } else {
            duDoan = last === 'T' ? 'xỉu' : 'tài';
            doTinCay = 55;
        }
    }
    
    doTinCay = Math.max(52, Math.min(98, doTinCay));
    
    return { duDoan, doTinCay, reason: `Streak: ${streak}, T count: ${tCount}/15` };
}

// ======================================================
// ANALYZE CAU
// ======================================================
function analyzeCau(history) {
    if (history.length < 10) return "[Đang thu thập...]";
    const results = history.map(h => h.result === 'Tài' ? 'T' : 'X');
    const last15 = results.slice(-15);
    const last10 = results.slice(-10);
    
    let parts = [];
    
    // Streak
    let streak = 1;
    const last = last15[last15.length - 1];
    for (let i = last15.length - 2; i >= 0; i--) {
        if (last15[i] === last) streak++;
        else break;
    }
    if (streak >= 3) parts.push(`Bệt ${streak} ${last === 'T' ? 'Tài' : 'Xỉu'}`);
    
    // 1-1
    let is11 = true;
    for (let i = 1; i < last10.length; i++) {
        if (last10[i] === last10[i - 1]) { is11 = false; break; }
    }
    if (is11) parts.push("Cầu 1-1");
    
    // Tỉ lệ
    const tCount = last15.filter(r => r === 'T').length;
    if (parts.length === 0) {
        if (tCount >= 12) parts.push("Tài áp đảo");
        else if (tCount <= 3) parts.push("Xỉu áp đảo");
        else if (tCount >= 9) parts.push("Nghiêng Tài");
        else if (tCount <= 6) parts.push("Nghiêng Xỉu");
        else parts.push("Cân bằng");
    }
    
    return `[${parts.join(', ')}] - ${last15.join('')}`;
}

// ======================================================
// LƯU HISTORY TẠM
// ======================================================
let globalHistory = [];
let lastPhien = 0;

// ======================================================
// ROUTE CHÍNH
// ======================================================
app.get("/", async (req, res) => {
    try {
        console.log(">>> Bắt đầu fetch API...");
        const response = await axios.get(API_URL, { timeout: 15000 });
        console.log(">>> API response status:", response.status);
        console.log(">>> API response keys:", Object.keys(response.data));
        
        const rawData = response.data;
        const history = normalizeData(rawData);
        console.log(">>> Parsed history length:", history.length);
        
        // Cập nhật global history
        for (const item of history) {
            if (item.phien > lastPhien) {
                globalHistory.push(item);
                lastPhien = item.phien;
            }
        }
        // Giữ 200 phiên gần nhất
        if (globalHistory.length > 200) globalHistory = globalHistory.slice(-200);
        console.log(">>> Global history size:", globalHistory.length);
        
        const latest = history[history.length - 1];
        console.log(">>> Latest phien:", latest.phien, "|", latest.ket_qua, "|", latest.x1, latest.x2, latest.x3, "=", latest.tong);
        
        const pattern = analyzeCau(history);
        const predict = predictSimple(history);
        console.log(">>> Pattern:", pattern);
        console.log(">>> Predict:", predict.duDoan, predict.doTinCay + "%");
        
        const result = {
            id: "AnhKhoidzai Sunwin",
            phien_truoc: latest.phien,
            xuc_xac1: latest.x1,
            xuc_xac2: latest.x2,
            xuc_xac3: latest.x3,
            tong: latest.tong,
            ket_qua: latest.ket_qua,
            pattern: pattern,
            phien_hien_tai: latest.phien + 1,
            du_doan: predict.duDoan,
            do_tin_cay: predict.doTinCay + "%"
        };
        
        console.log(">>> Sending result:", JSON.stringify(result));
        res.json(result);
        
    } catch (err) {
        console.log(">>> ERROR:", err.message);
        console.log(">>> Error details:", err.response ? err.response.status : 'no response');
        
        res.json({
            id: "AnhKhoidzai Sunwin",
            phien_truoc: 0,
            xuc_xac1: 0, xuc_xac2: 0, xuc_xac3: 0,
            tong: 0,
            ket_qua: "tài",
            pattern: "[Lỗi fetch API]",
            phien_hien_tai: 0,
            du_doan: "tài",
            do_tin_cay: "52%"
        });
    }
});

app.get("/taixiu", async (req, res) => {
    // Redirect về route chính
    try {
        const response = await axios.get(API_URL, { timeout: 15000 });
        const rawData = response.data;
        const history = normalizeData(rawData);
        
        for (const item of history) {
            if (item.phien > lastPhien) {
                globalHistory.push(item);
                lastPhien = item.phien;
            }
        }
        if (globalHistory.length > 200) globalHistory = globalHistory.slice(-200);
        
        const latest = history[history.length - 1];
        const pattern = analyzeCau(history);
        const predict = predictSimple(history);
        
        res.json({
            id: "AnhKhoidzai Sunwin",
            phien_truoc: latest.phien,
            xuc_xac1: latest.x1, xuc_xac2: latest.x2, xuc_xac3: latest.x3,
            tong: latest.tong,
            ket_qua: latest.ket_qua,
            pattern: pattern,
            phien_hien_tai: latest.phien + 1,
            du_doan: predict.duDoan,
            do_tin_cay: predict.doTinCay + "%"
        });
    } catch (err) {
        res.json({
            id: "AnhKhoidzai Sunwin",
            phien_truoc: 0,
            xuc_xac1: 0, xuc_xac2: 0, xuc_xac3: 0,
            tong: 0,
            ket_qua: "tài",
            pattern: "[Lỗi]",
            phien_hien_tai: 0,
            du_doan: "tài",
            do_tin_cay: "52%"
        });
    }
});

app.listen(PORT, () => {
    console.log("========================================");
    console.log("Server Infinity chạy tại port " + PORT);
    console.log("API: " + API_URL);
    console.log("========================================");
});
