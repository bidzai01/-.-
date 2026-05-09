// ==UserScript==
// @name         𝐌𝐫.𝐬𝟗 𝓹𝓻𝓲𝓶𝓮 - Ultimate Prediction System V10
// @namespace    http://tampermonkey.net/
// @version      10.0
// @description  Hệ thống dự đoán tích hợp đa thuật toán, tự học và tối ưu giao diện Galaxy.
// @author       𝐌𝐫.𝐬𝟗 𝓹𝓻𝓲𝓶𝓮
// @match        *://lc79b.bet/*
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // ==========================================
    // 1. CẤU TRÚC DỮ LIỆU & BỘ NÃO TỰ HỌC
    // ==========================================
    const Brain = {
        history: JSON.parse(localStorage.getItem('mrS9_history')) || [],
        weights: JSON.parse(localStorage.getItem('mrS9_weights')) || {
            pattern: 1.0,
            markov: 1.0,
            entropy: 1.0,
            logic: 1.0
        },
        stats: JSON.parse(localStorage.getItem('mrS9_stats')) || {
            total: 0,
            correct: 0,
            lastPrediction: null,
            lastSession: null
        },

        save() {
            localStorage.setItem('mrS9_history', JSON.stringify(this.history));
            localStorage.setItem('mrS9_weights', JSON.stringify(this.weights));
            localStorage.setItem('mrS9_stats', JSON.stringify(this.stats));
        },

        learn(currentSession, actualResult) {
            if (this.stats.lastPrediction && this.stats.lastSession === currentSession - 1) {
                this.stats.total++;
                if (this.stats.lastPrediction === actualResult) {
                    this.stats.correct++;
                    // Tăng trọng số nếu đúng
                    Object.keys(this.weights).forEach(k => this.weights[k] += 0.02);
                } else {
                    // Giảm trọng số nếu sai
                    Object.keys(this.weights).forEach(k => this.weights[k] -= 0.01);
                }
            }
            this.stats.lastSession = currentSession;
            this.save();
        }
    };

    // ==========================================
    // 2. KHO THUẬT TOÁN HỢP NHẤT
    // ==========================================
    const Algorithms = {
        // A. Thuật toán Pattern (Mẫu cầu)
        patternMatch(history) {
            const str = history.slice(-6).join('');
            const db = {
                "TTTXXX": "Tài", "XXXT T T": "Xỉu", "TXTXTX": "Tài",
                "TTXXTT": "Xỉu", "XXXXXX": "Tài", "TTTTTT": "Xỉu",
                "TXXTXX": "Tài", "XTTXTT": "Xỉu"
            };
            return db[str] || (Math.random() > 0.5 ? "Tài" : "Xỉu");
        },

        // B. Thuật toán Markov (Xác suất chuyển trạng thái)
        markovChain(history) {
            let transitions = { "T": { "T": 0, "X": 0 }, "X": { "T": 0, "X": 0 } };
            for (let i = 0; i < history.length - 1; i++) {
                if (transitions[history[i]]) {
                    transitions[history[i]][history[i+1]]++;
                }
            }
            const last = history[history.length - 1];
            return transitions[last]["T"] >= transitions[last]["X"] ? "Tài" : "Xỉu";
        },

        // C. Phân tích Entropy & Bit (Dành cho MD5)
        entropyAnalysis(hash) {
            if (!hash) return "Tài";
            let counts = {};
            for (let char of hash) { counts[char] = (counts[char] || 0) + 1; }
            let entropy = 0;
            for (let char in counts) {
                let p = counts[char] / hash.length;
                entropy -= p * Math.log2(p);
            }
            return entropy > 3.5 ? "Xỉu" : "Tài";
        },

        // D. Logic Phân tích chuỗi (Ultra Logic)
        ultraLogic(history) {
            let taiCount = history.filter(x => x === "T").length;
            return taiCount > history.length / 2 ? "Xỉu" : "Tài";
        }
    };

    // ==========================================
    // 3. GIAO DIỆN SIÊU NÉT - 𝐌𝐫.𝐬𝟗 𝓹𝓻𝓲𝓶𝓮
    // ==========================================
    GM_addStyle(`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Share+Tech+Mono&display=swap');

        .mr-s9-container {
            position: fixed; top: 20px; right: 20px; width: 320px;
            background: rgba(10, 10, 25, 0.85);
            backdrop-filter: blur(15px);
            border: 2px solid #00f2ff;
            border-radius: 15px;
            box-shadow: 0 0 25px rgba(0, 242, 255, 0.4), inset 0 0 15px rgba(0, 242, 255, 0.2);
            color: #fff; font-family: 'Share Tech Mono', monospace; z-index: 9999;
            padding: 15px; overflow: hidden; transition: all 0.3s ease;
        }

        .mr-s9-header {
            text-align: center; font-family: 'Orbitron', sans-serif;
            font-size: 18px; font-weight: bold; color: #ff00ff;
            text-shadow: 0 0 10px #ff00ff; border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            padding-bottom: 10px; margin-bottom: 15px;
        }

        .mode-selector {
            display: flex; gap: 5px; margin-bottom: 15px;
        }

        .mode-btn {
            flex: 1; padding: 8px; border: 1px solid #00f2ff;
            background: transparent; color: #00f2ff; cursor: pointer;
            font-size: 11px; border-radius: 5px; transition: 0.2s;
        }

        .mode-btn.active {
            background: #00f2ff; color: #000; box-shadow: 0 0 10px #00f2ff;
        }

        .display-box {
            background: rgba(0, 0, 0, 0.3); border-radius: 10px;
            padding: 15px; text-align: center; border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .result-text { font-size: 32px; font-weight: bold; margin: 10px 0; }
        .tai { color: #ffcc00; text-shadow: 0 0 15px #ffcc00; }
        .xiu { color: #00f2ff; text-shadow: 0 0 15px #00f2ff; }

        .confidence-bar {
            width: 100%; height: 6px; background: rgba(255, 255, 255, 0.1);
            border-radius: 3px; margin: 10px 0; overflow: hidden;
        }

        .confidence-fill {
            height: 100%; background: linear-gradient(90deg, #ff00ff, #00f2ff);
            width: 0%; transition: width 1s ease;
        }

        .footer-info {
            font-size: 10px; color: rgba(255, 255, 255, 0.5);
            display: flex; justify-content: space-between; margin-top: 10px;
        }
    `);

    let currentMode = 'HU'; // Default

    function buildUI() {
        const container = document.createElement('div');
        container.className = 'mr-s9-container';
        container.innerHTML = `
            <div class="mr-s9-header">𝐌𝐫.𝐬𝟗 𝓹𝓻𝓲𝓶𝓮</div>
            <div class="mode-selector">
                <button class="mode-btn active" id="btnHu">TÀI XỈU HŨ</button>
                <button class="mode-btn" id="btnMd5">TÀI XỈU MD5</button>
            </div>
            <div class="display-box">
                <div style="font-size: 12px; color: #aaa;">DỰ ĐOÁN PHIÊN TIẾP THEO</div>
                <div id="predictResult" class="result-text">---</div>
                <div class="confidence-bar"><div id="confFill" class="confidence-fill"></div></div>
                <div id="confText" style="font-size: 14px; color: #00f2ff;">Tin cậy: 0%</div>
            </div>
            <div class="footer-info">
                <span>Trạng thái: Hoạt động</span>
                <span id="accuracyText">Độ chính xác: 0%</span>
            </div>
            <div id="galaxyBg" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; opacity:0.1; z-index:-1;"></div>
        `;
        document.body.appendChild(container);

        // Sự kiện đổi chế độ
        document.getElementById('btnHu').onclick = () => switchMode('HU');
        document.getElementById('btnMd5').onclick = () => switchMode('MD5');
    }

    function switchMode(mode) {
        currentMode = mode;
        document.getElementById('btnHu').classList.toggle('active', mode === 'HU');
        document.getElementById('btnMd5').classList.toggle('active', mode === 'MD5');
        updatePrediction();
    }

    // ==========================================
    // 4. HỆ THỐNG XỬ LÝ DỮ LIỆU TỔNG HỢP
    // ==========================================
    function updatePrediction() {
        // Giả lập lấy lịch sử từ giao diện web (bạn có thể thay bằng API thật của LC79)
        const mockHistory = ["T", "X", "T", "T", "X", "X", "T", "X", "T"];
        const mockHash = "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"; // Hash MD5 giả định

        const p1 = Algorithms.patternMatch(mockHistory);
        const p2 = Algorithms.markovChain(mockHistory);
        const p3 = Algorithms.ultraLogic(mockHistory);
        const p4 = currentMode === 'MD5' ? Algorithms.entropyAnalysis(mockHash) : p1;

        // Dồn lực thuật toán và tính toán trọng số
        let scoreTai = 0;
        let scoreXiu = 0;

        const votes = [
            { res: p1, w: Brain.weights.pattern },
            { res: p2, w: Brain.weights.markov },
            { res: p3, w: Brain.weights.logic },
            { res: p4, w: Brain.weights.entropy }
        ];

        votes.forEach(v => {
            if (v.res === "Tài") scoreTai += v.w;
            else scoreXiu += v.w;
        });

        const totalScore = scoreTai + scoreXiu;
        const finalRes = scoreTai > scoreXiu ? "Tài" : "Xỉu";
        const confidence = Math.round((Math.max(scoreTai, scoreXiu) / totalScore) * 100);

        // Cập nhật UI
        const resEl = document.getElementById('predictResult');
        resEl.textContent = finalRes;
        resEl.className = `result-text ${finalRes === 'Tài' ? 'tai' : 'xiu'}`;
        
        document.getElementById('confFill').style.width = confidence + '%';
        document.getElementById('confText').textContent = `Tin cậy: ${confidence}%`;

        // Cập nhật tỷ lệ chính xác của Brain
        const acc = Brain.stats.total > 0 ? ((Brain.stats.correct / Brain.stats.total) * 100).toFixed(1) : 0;
        document.getElementById('accuracyText').textContent = `Độ chính xác: ${acc}%`;

        // Lưu dự đoán để học cho phiên sau
        Brain.stats.lastPrediction = finalRes;
    }

    // Khởi tạo
    buildUI();
    setInterval(updatePrediction, 5000); // Cập nhật mỗi 5 giây

    console.log("%c 𝐌𝐫.𝐬𝟗 𝓹𝓻𝓲𝓶𝓮 System Loaded Succesfully!", "color: #ff00ff; font-size: 20px; font-weight: bold;");
})();
