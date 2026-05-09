// =========================================================================
// SYSTEM: 𝐌𝐫.𝐬𝟗 𝓹𝓻𝓲𝓶𝓮 - GALAXY ULTRA EDITION (V22.0)
// GIAO DIỆN SOI CẦU SẮC NÉT + THUẬT TOÁN TOÀN DIỆN
// =========================================================================
const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

// --------------- API TELE68 ---------------
const API_HU = 'https://wtx.tele68.com/v1/tx/sessions?at=62385f65eb49fcb34c72a7d6489ad91d';
const API_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions?at=62385f65eb49fcb34c72a7d6489ad91d';

// --------------- GLOBAL STATE ---------------
let globalState = {
    hu: { prediction: '---', confidence: 50, history: [], recentSessions: [] },
    md5: { prediction: '---', confidence: 50, history: [], recentSessions: [] }
};

// ==================== THUẬT TOÁN MASTER ENGINE ====================
// (giữ nguyên từ code V21, tối ưu lại để lưu lịch sử chi tiết)

class UltraDicePredictionSystem {
    constructor() {
        this.history = [];
        this.weights = {};
        this.performance = {};
        this.patternDatabase = {
            '1-1': { pattern: ['T','X','T','X'], probability: 0.7 },
            '2-2': { pattern: ['T','T','X','X'], probability: 0.66 },
            '3-1': { pattern: ['T','T','T','X'], probability: 0.72 },
            '1-3': { pattern: ['T','X','X','X'], probability: 0.72 }
        };
        this.advancedPatterns = {
            'dynamic-1': { detect: (d) => d.slice(-6).filter(x=>x==='T').length===4 && d.at(-1)==='T', predict: ()=>'X', confidence: 0.72 },
            'dynamic-2': { detect: (d) => d.slice(-8).filter(x=>x==='T').length>=6 && d.at(-1)==='T', predict: ()=>'X', confidence: 0.78 }
        };
        for (let i=1; i<=21; i++) this.weights['model'+i] = 1;
    }
    addResult(result) {
        this.history.push(result);
        if (this.history.length > 200) this.history.shift();
    }
    getFinalPrediction() {
        const recent = this.history.slice(-12);
        if (recent.length < 4) return null;
        let pttn = null;
        for (const [type, data] of Object.entries(this.patternDatabase)) {
            if (recent.length >= data.pattern.length &&
                recent.slice(-data.pattern.length+1).join('-') === data.pattern.slice(0,-1).join('-')) {
                pttn = { pred: data.pattern[data.pattern.length-1], conf: data.probability };
            }
        }
        if (!pttn) {
            const t = recent.filter(x=>x==='T').length;
            pttn = { pred: t >= 6 ? 'X' : (t <= 6 ? 'T' : (recent[recent.length-1])), conf: 0.55 };
        }
        for (const [key, adv] of Object.entries(this.advancedPatterns)) {
            if (adv.detect(recent)) {
                const p = adv.predict();
                pttn = { pred: p, conf: Math.max(pttn.conf, adv.confidence) };
            }
        }
        if (recent.length >= 5) {
            let streak = 1;
            for (let i=recent.length-2; i>=0 && recent[i]===recent[recent.length-1]; i--) streak++;
            if (streak >= 5) pttn = { pred: recent[recent.length-1]==='T'?'X':'T', conf: 0.7 };
        }
        return { prediction: pttn.pred, confidence: pttn.conf * 100 };
    }
    updatePerformance(actual) {
        // Đơn giản hóa, không dùng trong phiên bản này
    }
}

class MasterEngine {
    constructor() {
        this.ultra = new UltraDicePredictionSystem();
        this.historyTX = [];
        this.detailedSessions = []; // lưu {id, point, result, dices}
        this.lastId = 0;
    }
    feed(sessions) {
        // sessions: mảng đã sắp xếp id tăng dần
        for (const s of sessions) {
            if (s.id <= this.lastId) continue;
            this.lastId = s.id;
            const tx = s.point >= 11 ? 'T' : 'X';
            this.ultra.addResult(tx);
            this.historyTX.push(tx);
            this.detailedSessions.push({
                id: s.id,
                point: s.point,
                result: tx === 'T' ? 'TÀI' : 'XỈU',
                dices: s.dices || []
            });
        }
        if (this.historyTX.length > 60) this.historyTX = this.historyTX.slice(-60);
        if (this.detailedSessions.length > 30) this.detailedSessions = this.detailedSessions.slice(-30);
    }
    predict() {
        const ultraPred = this.ultra.getFinalPrediction();
        let pred = ultraPred ? (ultraPred.prediction==='T'?'TAI':'XIU') : '---';
        let conf = ultraPred ? ultraPred.confidence : 50;
        return {
            prediction: pred,
            confidence: Math.min(98.8, conf).toFixed(1),
            history: this.historyTX.slice(-12),
            recentSessions: this.detailedSessions.slice(-20) // 20 phiên gần nhất
        };
    }
}

const engines = { hu: new MasterEngine(), md5: new MasterEngine() };

async function fetchAndUpdate(type, url) {
    try {
        const res = await axios.get(url, { timeout: 4000 });
        if (res.data?.list) {
            const list = res.data.list.sort((a,b)=>a.id - b.id).slice(-30);
            engines[type].feed(list);
        }
    } catch(e) {}
}

async function updateAll() {
    await Promise.all([fetchAndUpdate('hu', API_HU), fetchAndUpdate('md5', API_MD5)]);
    globalState.hu = engines.hu.predict();
    globalState.md5 = engines.md5.predict();
}
setInterval(updateAll, 2500);
updateAll();

// API endpoint
app.get('/api/data', (req, res) => res.json(globalState));

// --------------- GIAO DIỆN SOI CẦU ĐẸP SẮC NÉT ---------------
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>𝐌𝐫.𝐬𝟗 𝓹𝓻𝓲𝓶𝓮 - SOI CẦU</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Share+Tech+Mono&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;}
        body{background:#0a0a0a;color:#eee;font-family:'Share Tech Mono',monospace;overflow-x:hidden;}
        .main-header{text-align:center;padding:20px 10px 5px;}
        .main-header h1{font-family:'Orbitron',sans-serif;font-size:2.2rem;background:linear-gradient(to right,#00f2fe,#ff007f);-webkit-background-clip:text;-webkit-text-fill-color:transparent;text-shadow:none;letter-spacing:5px;margin-bottom:10px;}
        .container{display:flex;flex-wrap:wrap;gap:20px;padding:20px;max-width:1400px;margin:auto;}
        .panel{flex:1 1 500px;background:rgba(20,20,20,0.9);border-radius:16px;border:1px solid rgba(255,255,255,0.1);padding:20px;backdrop-filter:blur(10px);}
        .panel .title{font-family:'Orbitron',sans-serif;font-size:1.5rem;margin-bottom:15px;display:flex;align-items:center;gap:10px;}
        .hu .title .dot{width:14px;height:14px;background:#00f2fe;border-radius:50%;box-shadow:0 0 10px #00f2fe;}
        .md5 .title .dot{width:14px;height:14px;background:#ff007f;border-radius:50%;box-shadow:0 0 10px #ff007f;}
        .prediction-box{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:15px;}
        .prediction-box .current-session{font-size:1.2rem;color:#aaa;}
        .prediction-box .prediction-result{font-family:'Orbitron',sans-serif;font-size:2.5rem;font-weight:900;letter-spacing:5px;}
        .tai-glow{color:#00f2fe;text-shadow:0 0 15px #00f2fe,0 0 30px #00f2fe;}
        .xiu-glow{color:#ff007f;text-shadow:0 0 15px #ff007f,0 0 30px #ff007f;}
        .confidence{font-size:1rem;color:#999;}

        .dice-charts{display:flex;flex-wrap:wrap;gap:15px;margin-top:15px;}
        .dice-chart-container{flex:1 1 150px;min-width:130px;}
        .dice-chart-container canvas{max-height:200px;}

        .session-history{margin-top:20px;}
        .session-history h3{font-size:1.1rem;color:#aaa;margin-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:5px;}
        .history-list{display:flex;flex-wrap:wrap;gap:5px;}
        .history-item{width:38px;height:38px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:0.8rem;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);}
        .history-item.T{background:rgba(0,242,254,0.15);color:#00f2fe;border-color:#00f2fe;}
        .history-item.X{background:rgba(255,0,127,0.15);color:#ff007f;border-color:#ff007f;}

        .recent-table{width:100%;margin-top:15px;border-collapse:collapse;font-size:0.85rem;}
        .recent-table th{text-align:left;padding:6px 4px;color:#888;border-bottom:1px solid rgba(255,255,255,0.1);}
        .recent-table td{padding:6px 4px;border-bottom:1px solid rgba(255,255,255,0.05);}
        .dice-faces{display:flex;gap:4px;}
        .dice-face{width:22px;height:22px;border-radius:4px;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:0.7rem;}

        @media(max-width:768px){
            .container{flex-direction:column;padding:10px;}
            .prediction-box .prediction-result{font-size:2rem;}
        }
    </style>
</head>
<body>
    <div class="main-header">
        <h1>🔮 𝐌𝐫.𝐬𝟗 𝓹𝓻𝓲𝓶𝓮 - SOI CẦU</h1>
    </div>
    <div class="container">
        <!-- PANEL HŨ -->
        <div class="panel hu">
            <div class="title"><span class="dot"></span> JACKPOT (HŨ)</div>
            <div class="prediction-box">
                <div>
                    <div class="current-session" id="hu-session">#------</div>
                    <div class="confidence">Độ tin cậy: <span id="hu-conf">0%</span></div>
                </div>
                <div class="prediction-result" id="hu-pred">---</div>
            </div>
            <div class="dice-charts" id="hu-charts"></div>
            <div class="session-history">
                <h3>Lịch sử 12 phiên</h3>
                <div class="history-list" id="hu-history"></div>
            </div>
            <div style="margin-top:15px;">
                <h3>20 phiên gần nhất</h3>
                <table class="recent-table" id="hu-recent"></table>
            </div>
        </div>

        <!-- PANEL MD5 -->
        <div class="panel md5">
            <div class="title"><span class="dot"></span> TX MD5</div>
            <div class="prediction-box">
                <div>
                    <div class="current-session" id="md5-session">#------</div>
                    <div class="confidence">Độ tin cậy: <span id="md5-conf">0%</span></div>
                </div>
                <div class="prediction-result" id="md5-pred">---</div>
            </div>
            <div class="dice-charts" id="md5-charts"></div>
            <div class="session-history">
                <h3>Lịch sử 12 phiên</h3>
                <div class="history-list" id="md5-history"></div>
            </div>
            <div style="margin-top:15px;">
                <h3>20 phiên gần nhất</h3>
                <table class="recent-table" id="md5-recent"></table>
            </div>
        </div>
    </div>

    <script>
        // ---- Hàm vẽ biểu đồ tần suất xúc xắc ----
        function renderDiceCharts(containerId, sessions) {
            const container = document.getElementById(containerId);
            container.innerHTML = '';
            if (!sessions || sessions.length === 0) {
                container.innerHTML = '<p style="color:#666;">Đang tải dữ liệu...</p>';
                return;
            }

            // Tính tần suất mặt 1-6 cho từng viên xúc xắc
            const diceNames = ['Xúc xắc 1', 'Xúc xắc 2', 'Xúc xắc 3'];
            const frequency = [
                [0,0,0,0,0,0,0], // index 0 bỏ qua
                [0,0,0,0,0,0,0],
                [0,0,0,0,0,0,0]
            ];
            sessions.forEach(s => {
                if (s.dices && s.dices.length === 3) {
                    for (let i=0; i<3; i++) {
                        const val = s.dices[i];
                        if (val >= 1 && val <= 6) frequency[i][val]++;
                    }
                }
            });

            const colors = ['#00f2fe', '#ffcc00', '#ff007f'];
            diceNames.forEach((name, idx) => {
                const wrapper = document.createElement('div');
                wrapper.className = 'dice-chart-container';
                const canvas = document.createElement('canvas');
                canvas.id = containerId+'-dice'+idx;
                wrapper.appendChild(canvas);
                container.appendChild(wrapper);

                const ctx = canvas.getContext('2d');
                new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: ['1','2','3','4','5','6'],
                        datasets: [{
                            label: name,
                            data: frequency[idx].slice(1),
                            backgroundColor: colors[idx] + '90',
                            borderColor: colors[idx],
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: {
                            legend: { display: false },
                            title: { display: true, text: name, color: '#aaa', font: { size: 12 } }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: { stepSize: 2, color: '#888' },
                                grid: { color: 'rgba(255,255,255,0.05)' }
                            },
                            x: {
                                ticks: { color: '#888' }
                            }
                        }
                    }
                });
            });
        }

        // ---- Hàm render bảng lịch sử gần đây ----
        function renderRecentTable(tableId, sessions) {
            const table = document.getElementById(tableId);
            if (!sessions || sessions.length === 0) {
                table.innerHTML = '<tr><td colspan="4" style="color:#666;">Chưa có dữ liệu</td></tr>';
                return;
            }
            let html = '<tr><th>Phiên</th><th>Điểm</th><th>Kết quả</th><th>Xúc xắc</th></tr>';
            sessions.slice().reverse().forEach(s => {
                const diceHtml = s.dices && s.dices.length ? 
                    s.dices.map(d => '<span class="dice-face">'+d+'</span>').join('') : '---';
                const resultClass = s.result === 'TÀI' ? 'T' : 'X';
                html += `<tr>
                    <td>#${s.id}</td>
                    <td>${s.point}</td>
                    <td class="${resultClass}" style="font-weight:bold;">${s.result}</td>
                    <td><div class="dice-faces">${diceHtml}</div></td>
                </tr>`;
            });
            table.innerHTML = html;
        }

        // ---- Hàm render lịch sử T/X ngắn ----
        function renderHistoryDots(containerId, history) {
            const container = document.getElementById(containerId);
            container.innerHTML = history.map(r => 
                '<div class="history-item '+r+'">'+r+'</div>'
            ).join('');
        }

        // ---- Cập nhật toàn bộ UI ----
        async function refresh() {
            try {
                const res = await fetch('/api/data');
                const data = await res.json();

                for (const type of ['hu', 'md5']) {
                    const d = data[type];
                    if (!d) continue;

                    document.getElementById(type+'-session').innerText = 
                        d.recentSessions && d.recentSessions.length ? 
                        '#' + d.recentSessions[d.recentSessions.length-1].id : '#------';

                    const predEl = document.getElementById(type+'-pred');
                    predEl.innerText = d.prediction;
                    predEl.className = 'prediction-result ' + (d.prediction === 'TAI' ? 'tai-glow' : 'xiu-glow');

                    document.getElementById(type+'-conf').innerText = d.confidence + '%';

                    // Lịch sử 12 phiên T/X
                    if (d.history) renderHistoryDots(type+'-history', d.history);

                    // Biểu đồ xúc xắc (dùng 20 phiên)
                    if (d.recentSessions) renderDiceCharts(type+'-charts', d.recentSessions);

                    // Bảng 20 phiên gần nhất
                    if (d.recentSessions) renderRecentTable(type+'-recent', d.recentSessions);
                }
            } catch(e) {}
        }

        setInterval(refresh, 2000);
        refresh();
    </script>
</body>
</html>
    `);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`𝐌𝐫.𝐬𝟗 𝓹𝓻𝓲𝓶𝓮 V22 - SOI CẦU running on port ${PORT}`);
});
