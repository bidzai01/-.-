/**
 * @Developer: Dev Anh Khôi (Chủ Tôn)
 * @Description: Tích hợp 3 thuật toán cốt lõi và xuất JSON chuẩn
 */

const express = require('express');
const app = express();

// =====================================================================
// 1. CHỈ GIỮ ĐÚNG 3 THUẬT TOÁN TỪ predictionAlgorithmsAll.js
// =====================================================================

// Thuật toán 1: Phân tích xu hướng và điểm chuyển đổi
function predictTrendAndSwitch(history) {
    if (!history || history.length < 5) return { prediction: 0, confidence: 0 };
    const recent = history.slice(-5).map(h => h.result);
    let taiCount = recent.filter(r => r === 'Tài').length;
    let xiuCount = recent.filter(r => r === 'Xỉu').length;
    let prediction = 0;
    if (taiCount > xiuCount) prediction = 1; // 1 là Tài
    else if (xiuCount > taiCount) prediction = 2; // 2 là Xỉu
    return { prediction, confidence: Math.max(taiCount, xiuCount) / 5 };
}

// Thuật toán 2: Phát hiện chuỗi (Streak) và xác suất bẻ cầu (Bridge)
function detectStreakAndBreak(history) {
    if (!history || history.length === 0) return { streak: 0, currentResult: null, breakProb: 0.0 };
    let streak = 1;
    const currentResult = history[history.length - 1].result;
    for (let i = history.length - 2; i >= 0; i--) {
        if (history[i].result === currentResult) streak++;
        else break;
    }
    const last20 = history.slice(-20).map(h => h.result);
    if (!last20.length) return { streak, currentResult, breakProb: 0.0 };
    const switches = last20.slice(1).reduce((count, curr, idx) => count + (curr !== last20[idx] ? 1 : 0), 0);
    const taiCount = last20.filter(r => r === 'Tài').length;
    const xiuCount = last20.filter(r => r === 'Xỉu').length;
    const imbalance = Math.abs(taiCount - xiuCount) / last20.length;
    
    let breakProb = 0.0;
    if (streak >= 8) {
        breakProb = Math.min(0.6 + (switches / 20) + imbalance * 0.15, 0.95);
    } else if (streak >= 4) {
        breakProb = Math.min(0.4 + (switches / 30) + imbalance * 0.1, 0.7);
    } else {
        breakProb = 0.2;
    }

    let prediction = currentResult === 'Tài' ? 1 : 2;
    if (breakProb > 0.5) prediction = prediction === 1 ? 2 : 1;

    return { streak, currentResult, breakProb, prediction };
}

// Thuật toán 3: AI nhận diện mẫu hình (Pattern)
function predictAIHTDD(history) {
    if (!history || history.length < 3) return { prediction: 'Tài', confidence: 0 };
    const last3 = history.slice(-3).map(h => h.result).join('-');
    const patterns = {
        'Tài-Tài-Tài': 'Xỉu', 'Xỉu-Xỉu-Xỉu': 'Tài',
        'Tài-Xỉu-Tài': 'Xỉu', 'Xỉu-Tài-Xỉu': 'Tài',
        'Tài-Tài-Xỉu': 'Xỉu', 'Xỉu-Xỉu-Tài': 'Tài'
    };
    return { 
        prediction: patterns[last3] || (Math.random() > 0.5 ? 'Tài' : 'Xỉu'), 
        confidence: 0.6 
    };
}

// Hàm phụ trợ: Phát hiện mẫu xấu
function isBadPattern(history) {
    if (history.length < 5) return false;
    const last5 = history.slice(-5).map(h => h.result).join('');
    return last5 === 'TàiXỉuTàiXỉuTài' || last5 === 'XỉuTàiXỉuTàiXỉu';
}

// Ensemble: Tổng hợp 3 thuật toán
function getEnsemblePrediction(history) {
    if (!history || history.length < 5) return null;
    
    const trendPred = predictTrendAndSwitch(history);
    const bridgePred = detectStreakAndBreak(history);
    const aiPred = predictAIHTDD(history);
    
    const weights = { trend: 0.3, switch: 0.2, bridge: 0.3, aihtdd: 0.2 };
    let taiScore = 0, xiuScore = 0;
    
    // Áp dụng thuật toán 1 & 2
    if (trendPred.prediction === 1) taiScore += weights.trend; else if (trendPred.prediction === 2) xiuScore += weights.trend;
    if (bridgePred.prediction === 1) taiScore += weights.bridge; else if (bridgePred.prediction === 2) xiuScore += weights.bridge;
    
    // Áp dụng thuật toán 3
    if (aiPred.prediction === 'Tài') taiScore += weights.aihtdd; else xiuScore += weights.aihtdd;
    
    // Điều chỉnh khi phát hiện mẫu xấu
    if (isBadPattern(history)) {
        taiScore *= 0.85; 
        xiuScore *= 0.85;
    }
    
    // Cân bằng nếu dự đoán nghiêng quá nhiều
    const last10Preds = history.slice(-10).map(h => h.result);
    const taiPredCount = last10Preds.filter(r => r === 'Tài').length;
    if (taiPredCount >= 7) xiuScore += 0.2;
    else if (taiPredCount <= 3) taiScore += 0.2;
    
    const totalScore = taiScore + xiuScore;
    const finalPred = taiScore > xiuScore ? 'Tài' : 'Xỉu';
    const confidence = totalScore > 0 ? (Math.max(taiScore, xiuScore) / totalScore) : 0;
    
    return {
        prediction: finalPred,
        confidence: (confidence * 100).toFixed(2),
        details: { trendPred, bridgePred, aiPred }
    };
}

function predict(history) {
    return getEnsemblePrediction(history);
}

// =====================================================================
// 2. API TRẢ VỀ JSON CHUẨN FORM (Thay thế router hiện tại của bạn)
// =====================================================================

app.get('/taixiu', (req, res) => {
    try {
        // Lấy data history từ biến global của file lc.js (ví dụ predictionHistory.hu)
        // Lưu ý: Đảm bảo format của mảng history là [{ result: 'Tài' }, { result: 'Xỉu' }, ...]
        const history = predictionHistory.hu || []; 
        
        if (history.length < 5) {
            return res.json({ error: "Chưa đủ dữ liệu để phân tích" });
        }

        // Lấy thông tin phiên mới nhất để hiển thị
        const currentData = history[history.length - 1]; 
        
        // Chạy full 3 thuật toán
        const predictionResult = predict(history);

        // Xuất JSON đúng chuẩn ảnh yêu cầu
        const responseData = {
            phien: currentData.phien ? currentData.phien + 1 : 0, // Phiên mục tiêu dự đoán
            Xuc_xac_1: currentData.dices ? currentData.dices[0] : 0,
            Xuc_xac_2: currentData.dices ? currentData.dices[1] : 0,
            Xuc_xac_3: currentData.dices ? currentData.dices[2] : 0,
            Tong: currentData.tong || 0,
            Ket_qua: currentData.result || "Chưa rõ",
            du_doan: predictionResult ? predictionResult.prediction : "Không xác định",
            do_tin_cay: predictionResult ? `${Math.round(predictionResult.confidence)}%` : "0%",
            thong_tin_bo_sung: {
                sessionStats: {
                    streak: predictionResult ? predictionResult.details.bridgePred.streak : 0,
                    breakProb: predictionResult ? predictionResult.details.bridgePred.breakProb.toFixed(2) : 0
                },
                marketState: {
                    regime: "normal"
                }
            }
        };

        res.json(responseData);

    } catch (error) {
        console.error('Lỗi khi xử lý dự đoán:', error);
        res.status(500).json({ error: 'Lỗi server nội bộ' });
    }
});
