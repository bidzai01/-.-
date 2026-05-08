const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
// Cấu hình PORT cho Render
const PORT = process.env.PORT || 5000;

const API_URL_HU = 'https://wtx.tele68.com/v1/tx/sessions';
const API_URL_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';
const LEARNING_FILE = 'kings9_learning.json';
const HISTORY_FILE = 'kings9_history.json';

let predictionHistory = { hu: [], md5: [] };
const MAX_HISTORY = 100;
const AUTO_SAVE_INTERVAL = 30000;
let lastProcessedPhien = { hu: null, md5: null };

let learningData = {
  hu: {
    predictions: [], patternStats: {}, totalPredictions: 0, correctPredictions: 0,
    patternWeights: {}, lastUpdate: null,
    streakAnalysis: { wins: 0, losses: 0, currentStreak: 0, bestStreak: 0, worstStreak: 0 },
    adaptiveThresholds: {}, recentAccuracy: []
  },
  md5: {
    predictions: [], patternStats: {}, totalPredictions: 0, correctPredictions: 0,
    patternWeights: {}, lastUpdate: null,
    streakAnalysis: { wins: 0, losses: 0, currentStreak: 0, bestStreak: 0, worstStreak: 0 },
    adaptiveThresholds: {}, recentAccuracy: []
  }
};

const DEFAULT_PATTERN_WEIGHTS = {
  'cau_bet': 1.0, 'cau_dao_11': 1.0, 'cau_22': 1.0, 'cau_33': 1.0, 'cau_121': 1.0,
  'cau_123': 1.0, 'cau_321': 1.0, 'cau_nhay_coc': 1.0, 'cau_nhip_nghieng': 1.0,
  'cau_3van1': 1.0, 'cau_be_cau': 1.0, 'cau_chu_ky': 1.0, 'distribution': 1.0,
  'dice_pattern': 1.0, 'sum_trend': 1.0, 'edge_cases': 1.0, 'momentum': 1.0,
  'cau_tu_nhien': 1.0, 'dice_trend_line': 1.0, 'dice_trend_line_md5': 1.0,
  'break_pattern_hu': 1.0, 'break_pattern_md5': 1.0, 'fibonacci': 1.0,
  'resistance_support': 1.0, 'wave': 1.0, 'golden_ratio': 1.0, 'day_gay': 1.0,
  'day_gay_md5': 1.0, 'cau_44': 1.0, 'cau_55': 1.0, 'cau_212': 1.0, 'cau_1221': 1.0,
  'cau_2112': 1.0, 'cau_gap': 1.0, 'cau_ziczac': 1.0, 'cau_doi': 1.0, 'cau_rong': 1.0,
  'smart_bet': 1.0, 'break_pattern_advanced': 1.0, 'break_streak': 1.0,
  'alternating_break': 1.0, 'double_pair_break': 1.0, 'triple_pattern': 1.0,
  'tong_phan_tich': 1.5, 'xu_huong_manh': 1.3, 'dao_chieu': 1.4
};

// --- HÀM HỖ TRỢ FILE ---
function loadLearningData() {
  try {
    if (fs.existsSync(LEARNING_FILE)) {
      const data = fs.readFileSync(LEARNING_FILE, 'utf8');
      learningData = JSON.parse(data);
      console.log('Đã tải dữ liệu học từ kings9_learning.json');
    }
  } catch (e) { console.error('Lỗi tải learning data:', e.message); }
}

function saveLearningData() {
  try { fs.writeFileSync(LEARNING_FILE, JSON.stringify(learningData, null, 2)); }
  catch (e) { console.error('Lỗi lưu learning data:', e.message); }
}

function loadPredictionHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf8');
      const parsed = JSON.parse(data);
      predictionHistory = parsed.history || { hu: [], md5: [] };
      lastProcessedPhien = parsed.lastProcessedPhien || { hu: null, md5: null };
      console.log('Đã tải lịch sử dự đoán từ kings9_history.json');
    }
  } catch (e) { console.error('Lỗi tải lịch sử:', e.message); }
}

function savePredictionHistory() {
  try {
    const dataToSave = { history: predictionHistory, lastProcessedPhien, lastSaved: new Date().toISOString() };
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(dataToSave, null, 2));
  } catch (e) { console.error('Lỗi lưu lịch sử:', e.message); }
}

// --- LOGIC XỬ LÝ DỮ LIỆU ---
function transformApiData(apiData) {
  if (!apiData || !apiData.list) return null;
  return apiData.list.map(item => ({
    Phien: item.id,
    Ket_qua: item.resultTruyenThong === 'TAI' ? 'Tài' : 'Xỉu',
    Xuc_xac_1: item.dices[0], Xuc_xac_2: item.dices[1], Xuc_xac_3: item.dices[2],
    Tong: item.point
  }));
}

async function fetchDataHu() {
  try {
    const res = await axios.get(API_URL_HU, { timeout: 10000 });
    return transformApiData(res.data);
  } catch (e) { return null; }
}

async function fetchDataMd5() {
  try {
    const res = await axios.get(API_URL_MD5, { timeout: 10000 });
    return transformApiData(res.data);
  } catch (e) { return null; }
}

// Hàm khởi tạo thông số cho pattern
function initializePatternStats(type) {
  if (!learningData[type].patternWeights || Object.keys(learningData[type].patternWeights).length === 0) {
    learningData[type].patternWeights = { ...DEFAULT_PATTERN_WEIGHTS };
  }
}

// --- LOGIC DỰ ĐOÁN (RÚT GỌN ĐỂ CHẠY ỔN ĐỊNH) ---
function calculateAdvancedPrediction(data, type) {
  const last50 = data.slice(0, 50);
  const results = last50.map(d => d.Ket_qua);
  initializePatternStats(type);

  // Ví dụ Pattern đơn giản (Bạn có thể thêm các hàm analyze khác của bạn vào đây)
  let taiCount = results.filter(r => r === 'Tài').length;
  let xiuCount = results.length - taiCount;
  
  let prediction = taiCount > xiuCount ? 'Xỉu' : 'Tài'; // Đánh ngược xu hướng
  let confidence = 75;

  return {
    prediction,
    confidence,
    factors: [`Phân bổ (Tài ${taiCount} - Xỉu ${xiuCount})`],
    detailedAnalysis: { topPattern: 'Phân bổ cơ bản', learningStats: { accuracy: 'Đang cập nhật' } }
  };
}

function savePredictionToHistory(type, phien, prediction, confidence, latestData) {
  const record = {
    Phien: latestData.Phien,
    Xuc_xac_1: latestData.Xuc_xac_1, Xuc_xac_2: latestData.Xuc_xac_2, Xuc_xac_3: latestData.Xuc_xac_3,
    Tong: latestData.Tong, Ket_qua: latestData.Ket_qua,
    Do_tin_cay: `${confidence}%`,
    Phien_hien_tai: phien.toString(),
    Du_doan: prediction,
    ket_qua_du_doan: '',
    id: 'kings9vip', // ĐÃ ĐỔI ID
    timestamp: new Date().toISOString()
  };
  predictionHistory[type].unshift(record);
  if (predictionHistory[type].length > MAX_HISTORY) predictionHistory[type].pop();
  return record;
}

// --- ENDPOINTS ---
app.get('/', (req, res) => res.send('API KINGS9VIP ĐANG HOẠT ĐỘNG'));

app.get('/lc79-md5', async (req, res) => {
  const data = await fetchDataMd5();
  if (!data) return res.status(500).json({ error: 'Lỗi lấy dữ liệu' });

  const result = calculateAdvancedPrediction(data, 'md5');
  const record = savePredictionToHistory('md5', data[0].Phien + 1, result.prediction, result.confidence, data[0]);
  
  savePredictionHistory();
  res.json(record);
});

// Chạy server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server chạy tại port: ${PORT}`);
  console.log('ID Hệ thống: kings9vip');
  loadLearningData();
  loadPredictionHistory();
