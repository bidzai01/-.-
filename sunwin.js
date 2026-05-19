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
    if (rawData && rawData.data && Array.isArray(rawData.data)) data = rawData.data;
    else if (Array.isArray(rawData)) data = rawData;
    else if (rawData && typeof rawData === 'object') data = [rawData];

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
            xuc_xac_1: d1, xuc_xac_2: d2, xuc_xac_3: d3,
            tong: tong, ket_qua: ketQua,
            result: ketQua === "tài" ? "Tài" : "Xỉu",
            dice: [d1, d2, d3]
        };
    }).filter(item => item.phien > 0 && item.tong >= 3 && item.tong <= 18);
}

// ======================================================
// 1. MARKOV ENGINE
// ======================================================
function predictMarkov(seq) {
    if (seq.length < 4) return null;
    let best = null, bestConf = 0;
    for (let order = 3; order <= Math.min(5, seq.length - 1); order++) {
        const last = seq.slice(-order);
        const trans = {};
        for (let i = 0; i <= seq.length - order - 1; i++) {
            const pat = seq.slice(i, i + order);
            const next = seq[i + order];
            if (!trans[pat]) trans[pat] = { T: 0, X: 0 };
            trans[pat][next]++;
        }
        const possible = trans[last];
        if (!possible) continue;
        const total = possible.T + possible.X;
        const probTai = possible.T / total;
        const conf = (Math.max(possible.T, possible.X) / total) * 100;
        if (conf > bestConf) { bestConf = conf; best = probTai > 0.5 ? "T" : "X"; }
    }
    return best ? { p: best, c: Math.round(bestConf) } : null;
}

function markov1(history) {
    if (history.length < 2) return null;
    const last = history[history.length - 1];
    const trans = { T: { T: 0, X: 0 }, X: { T: 0, X: 0 } };
    for (let i = 0; i < history.length - 1; i++) trans[history[i]][history[i + 1]]++;
    if (trans[last].T > trans[last].X) return 'T';
    if (trans[last].X > trans[last].T) return 'X';
    return null;
}

function markov2(history) {
    if (history.length < 3) return null;
    const last2 = history.slice(-2);
    const trans = new Map();
    for (let i = 0; i < history.length - 2; i++) {
        const key = history[i] + ',' + history[i + 1];
        const next = history[i + 2];
        if (!trans.has(key)) trans.set(key, { T: 0, X: 0 });
        trans.get(key)[next]++;
    }
    const possible = trans.get(last2.join(','));
    if (!possible) return null;
    return possible.T > possible.X ? 'T' : (possible.X > possible.T ? 'X' : null);
}

function markov3(history) {
    if (history.length < 4) return null;
    const last3 = history.slice(-3);
    const trans = new Map();
    for (let i = 0; i < history.length - 3; i++) {
        const key = history.slice(i, i + 3).join(',');
        const next = history[i + 3];
        if (!trans.has(key)) trans.set(key, { T: 0, X: 0 });
        trans.get(key)[next]++;
    }
    const possible = trans.get(last3.join(','));
    if (!possible) return null;
    return possible.T > possible.X ? 'T' : (possible.X > possible.T ? 'X' : null);
}

// ======================================================
// 2. MASTER CAU ENGINE
// ======================================================
class MasterCauEngine {
    constructor() {
        this.DB = {
            diem: {}, xucXac: {}, bet: { T: {}, X: {} },
            chuoi: new Map(), tamMat: { T: 0, X: 0 }, cap1: { T: 0, X: 0 }, cap6: { T: 0, X: 0 },
            tongThap: { T: 0, X: 0 }, tongCao: { T: 0, X: 0 },
            c11: { tiep: 0, gay: 0 }, c22: { tiep: 0, gay: 0 },
            zigzag: { tiep: 0, gay: 0 }, tamGiac: { tiep: 0, gay: 0 },
            rong: { tiep: 0, gay: 0 }, ho: { tiep: 0, gay: 0 },
            trendManh: { tang: { T: 0, X: 0 }, giam: { T: 0, X: 0 } },
            diemStreak: { tang3: { T: 0, X: 0 }, giam3: { T: 0, X: 0 } },
            tanSuat: { nhieuT: { T: 0, X: 0 }, nhieuX: { T: 0, X: 0 } }
        };
    }

    learn(history) {
        const R = history.map(h => h.result === 'Tài' ? 'T' : 'X');
        const S = history.map(h => h.tong);
        const D = history.map(h => h.dice);
        const L = history.length;

        this.DB = {
            diem: {}, xucXac: {}, bet: { T: {}, X: {} },
            chuoi: new Map(), tamMat: { T: 0, X: 0 }, cap1: { T: 0, X: 0 }, cap6: { T: 0, X: 0 },
            tongThap: { T: 0, X: 0 }, tongCao: { T: 0, X: 0 },
            c11: { tiep: 0, gay: 0 }, c22: { tiep: 0, gay: 0 },
            zigzag: { tiep: 0, gay: 0 }, tamGiac: { tiep: 0, gay: 0 },
            rong: { tiep: 0, gay: 0 }, ho: { tiep: 0, gay: 0 },
            trendManh: { tang: { T: 0, X: 0 }, giam: { T: 0, X: 0 } },
            diemStreak: { tang3: { T: 0, X: 0 }, giam3: { T: 0, X: 0 } },
            tanSuat: { nhieuT: { T: 0, X: 0 }, nhieuX: { T: 0, X: 0 } }
        };

        for (let i = 0; i < L - 1; i++) {
            const s = S[i], n = R[i+1], dk = D[i].join('-'), d = D[i];
            if (!this.DB.diem[s]) this.DB.diem[s] = { T: 0, X: 0 };
            this.DB.diem[s][n]++;
            if (!this.DB.xucXac[dk]) this.DB.xucXac[dk] = { T: 0, X: 0 };
            this.DB.xucXac[dk][n]++;
            if (d[0]===d[1]&&d[1]===d[2]) this.DB.tamMat[n]++;
            if (d.filter(x=>x===1).length>=2) this.DB.cap1[n]++;
            if (d.filter(x=>x===6).length>=2) this.DB.cap6[n]++;
            if (s<=4) this.DB.tongThap[n]++;
            if (s>=17) this.DB.tongCao[n]++;
        }

        for (const t of ['T','X']) {
            let st=0;
            for (let i=0;i<L;i++) {
                if (R[i]===t) st++;
                else { if (st>=1&&i<L) { const k=Math.min(st,25); if(!this.DB.bet[t][k]) this.DB.bet[t][k]={tiep:0,gay:0}; if(R[i]===t) this.DB.bet[t][k].tiep++; else this.DB.bet[t][k].gay++; } st=0; }
            }
        }

        for (let len=2;len<=6;len++) {
            for (let i=0;i<L-len;i++) {
                const k=R.slice(i,i+len).join(''), n=R[i+len];
                if(!this.DB.chuoi.has(k)) this.DB.chuoi.set(k,{T:0,X:0});
                const p=this.DB.chuoi.get(k); p[n]++;
            }
        }

        for (let i=3;i<L-1;i++) {
            if (R[i]!==R[i-1]&&R[i-1]!==R[i-2]&&R[i-2]!==R[i-3]) { if(R[i+1]!==R[i]) this.DB.c11.tiep++; else this.DB.c11.gay++; }
            if (R[i-3]===R[i-2]&&R[i-1]===R[i]&&R[i-3]!==R[i-1]) { if(R[i+1]===R[i]) this.DB.c22.tiep++; else this.DB.c22.gay++; }
        }

        for (let i=5;i<L-1;i++) {
            let f=0; for(let j=i-4;j<=i;j++) if(j>i-4&&R[j]!==R[j-1]) f++;
            if(f>=4) { if(R[i+1]!==R[i]) this.DB.zigzag.tiep++; else this.DB.zigzag.gay++; }
            if(R.slice(i-5,i+1).every(x=>x==='T')) { if(R[i+1]==='X') this.DB.rong.gay++; else this.DB.rong.tiep++; }
            if(R.slice(i-5,i+1).every(x=>x==='X')) { if(R[i+1]==='T') this.DB.ho.gay++; else this.DB.ho.tiep++; }
        }

        for (let i=4;i<L-1;i++) {
            const p=R.slice(i-4,i+1).join('');
            if(p==='TXTXT') { if(R[i+1]==='X') this.DB.tamGiac.tiep++; else this.DB.tamGiac.gay++; }
            if(p==='XTXTX') { if(R[i+1]==='T') this.DB.tamGiac.tiep++; else this.DB.tamGiac.gay++; }
        }

        for (let i=10;i<L-1;i++) {
            const n=R[i+1], trend=S[i]-S[i-9];
            if(trend>8) this.DB.trendManh.tang[n]++;
            if(trend<-8) this.DB.trendManh.giam[n]++;
            if(i>=2&&S[i]>S[i-1]&&S[i-1]>S[i-2]) this.DB.diemStreak.tang3[n]++;
            if(i>=2&&S[i]<S[i-1]&&S[i-1]<S[i-2]) this.DB.diemStreak.giam3[n]++;
            const t10=R.slice(i-9,i+1).filter(r=>r==='T').length;
            if(t10>=7) this.DB.tanSuat.nhieuT[n]++;
            if(t10<=3) this.DB.tanSuat.nhieuX[n]++;
        }
    }

    predict(R, S, lR, lS, lD, streak, flips, c11len, trend, t10, diemTang3, diemGiam3) {
        const SIG = [];
        const add = (p,c,w,r) => { if(c>=50) SIG.push({p,c:Math.min(95,Math.round(c)),w,r}); };

        if (lS<=4) { const d=this.DB.tongThap; const rt=(d.T+d.X)>0?Math.round(d.T/(d.T+d.X)*100):79; add('T',rt,5,`Tổng ${lS}→Tài ${rt}%`); }
        if (lS>=17) { const d=this.DB.tongCao; const rx=(d.T+d.X)>0?Math.round(d.X/(d.T+d.X)*100):73; add('X',rx,5,`Tổng ${lS}→Xỉu ${rx}%`); }
        if (lD[0]===lD[1]&&lD[1]===lD[2]) { const d=this.DB.tamMat; const r=(d.T+d.X)>0?Math.round(Math.max(d.T,d.X)/(d.T+d.X)*100):72; add(lD[0]>=4?'X':'T',r,4,`3 mặt ${lD[0]}`); }
        if (lD.filter(x=>x===1).length>=2) { const d=this.DB.cap1; const r=(d.T+d.X)>0?Math.round(d.T/(d.T+d.X)*100):72; add('T',r,4,`Cặp 1→Tài ${r}%`); }
        if (streak>=15) add(lR==='T'?'X':'T',90,4,`Bệt ${streak}→CHẮC GÃY`);
        else if (streak>=10) add(lR==='T'?'X':'T',80,4,`Bệt ${streak}→GÃY`);
        else if (streak>=7) add(lR==='T'?'X':'T',70,4,`Bệt ${streak}→Gãy`);
        else if (streak>=5) add(lR==='T'?'X':'T',62,3,`Bệt ${streak}→Gãy`);
        else if (streak>=2) add(lR,56,2,`Bệt ${streak}→Tiếp`);
        if (c11len>=5) add(lR==='T'?'X':'T',66,3,`Cầu 1-1 (${c11len} nhịp)`);
        else if (c11len>=3) add(lR==='T'?'X':'T',60,2,`Cầu 1-1 (${c11len} nhịp)`);
        if (flips>=8) add(lR==='T'?'X':'T',70,3,`Zigzag ${flips}/9→Đảo`);
        else if (flips>=6) add(lR==='T'?'X':'T',63,2,`Zigzag→Đảo`);
        if (lS>=5&&lS<=6) { const d=this.DB.diem[lS]; const r=d?Math.round(d.T/(d.T+d.X)*100):58; add('T',r,2.5,`Tổng ${lS}→Tài ${r}%`); }
        if (Math.abs(trend)>7) add(trend>0?'X':'T',64,2.5,`Điểm ${trend>0?'tăng':'giảm'} mạnh`);
        if (t10>=7) add('X',63,2,`Nhiều Tài(${t10}/10)→Xỉu`);
        else if (t10<=3) add('T',63,2,`Nhiều Xỉu(${10-t10}/10)→Tài`);
        if (diemTang3) add('X',60,2,'Điểm tăng 3 phiên→Xỉu');
        if (diemGiam3) add('T',60,2,'Điểm giảm 3 phiên→Tài');
        if (flips<=2) add(lR,58,1.5,'Ít đổi→Tiếp');

        if (R.length>=4) { const l4=R.slice(-4); if(l4[0]===l4[1]&&l4[2]===l4[3]&&l4[0]!==l4[2]) add(l4[2],66,2.5,'Cầu 2-2→Tiếp'); }
        if (R.length>=5) { const l5=R.slice(-5).join(''); if(l5==='TXTXT') add('X',82,3,'Tam giác→X'); if(l5==='XTXTX') add('T',82,3,'Tam giác→T'); }
        if (R.length>=6) { const l6=R.slice(-6).join(''); if(l6==='TXXTTT') add('X',78,2.5,'1-2-3→X'); if(l6==='XTTXXX') add('T',78,2.5,'1-2-3→T'); }

        for (let len=5;len>=3;len--) {
            const k=R.slice(-len).join(''), p=this.DB.chuoi.get(k);
            if(p&&(p.T+p.X)>=5) { const tR=p.T/(p.T+p.X); if(tR>=0.65){add('T',Math.round(tR*100),2.5,`Chuỗi "${k}"→Tài`);break;} if(tR<=0.35){add('X',Math.round((1-tR)*100),2.5,`Chuỗi "${k}"→Xỉu`);break;} }
        }

        const dk=lD.join('-'), dd=this.DB.xucXac[dk];
        if(dd&&(dd.T+dd.X)>=3) { const tR=dd.T/(dd.T+dd.X); if(tR>=0.65) add('T',Math.round(tR*100),2,`Xúc xắc ${dk}→Tài`); else if(tR<=0.35) add('X',Math.round((1-tR)*100),2,`Xúc xắc ${dk}→Xỉu`); }

        if (SIG.length===0) add(t10>=5?'T':'X',52,1,'Theo xu hướng');
        return SIG;
    }
}

// ======================================================
// 3. PATTERN DETECTORS
// ======================================================
const PatternDetectors = {
    detect_1_1: (h) => { if(h.length>=4&&h.slice(-4).join('')==="TXTX")return{p:'X',c:78}; if(h.length>=4&&h.slice(-4).join('')==="XTXT")return{p:'T',c:78}; return null; },
    detect_2_2: (h) => { if(h.length>=4&&h.slice(-4).join('')==="TTXX")return{p:'X',c:74}; if(h.length>=4&&h.slice(-4).join('')==="XXTT")return{p:'T',c:74}; return null; },
    detect_triangle: (h) => { const l5=h.slice(-5).join(''); if(l5==="TXTXT")return{p:'X',c:80}; if(l5==="XTXTX")return{p:'T',c:80}; return null; },
    detect_dragon: (h) => { let t=0; for(let i=h.length-1;i>=0;i--){if(h[i]==='T')t++;else break;} if(t>=6)return{p:'X',c:76}; if(t>=4)return{p:'T',c:66}; return null; },
    detect_tiger: (h) => { let x=0; for(let i=h.length-1;i>=0;i--){if(h[i]==='X')x++;else break;} if(x>=6)return{p:'T',c:76}; if(x>=4)return{p:'X',c:66}; return null; }
};

// ======================================================
// 4. TECHNICAL INDICATORS
// ======================================================
function rsiPredict(history, period=7) {
    if(history.length<period)return null;
    const nums=history.slice(-period).map(c=>c==='T'?1:0);
    let gains=0,losses=0;
    for(let i=1;i<nums.length;i++){const diff=nums[i]-nums[i-1];if(diff>0)gains+=diff;else losses-=diff;}
    if(losses===0)return 100;
    const rsi=100-(100/(1+gains/losses));
    if(rsi>70)return'X';if(rsi<30)return'T';return null;
}

// ======================================================
// 🌟 GOD MASTER AI - TỔNG HỢP TẤT CẢ
// ======================================================
class GodMasterAI {
    constructor() {
        this.history = [];
        this.masterCau = new MasterCauEngine();
        this._learned = false;
    }

    addSession(sessionData) {
        const id = sessionData.phien || 0;
        if (this.history.length > 0 && this.history[this.history.length - 1].phien === id) return;
        const res = sessionData.result || sessionData.ket_qua || '';
        if (!res || (res !== 'Tài' && res !== 'Xỉu' && res !== 'T' && res !== 'X')) return;
        const normRes = (res === 'Tài' || res === 'T') ? 'Tài' : 'Xỉu';
        const d1 = sessionData.x1 || sessionData.xuc_xac_1 || 0;
        const d2 = sessionData.x2 || sessionData.xuc_xac_2 || 0;
        const d3 = sessionData.x3 || sessionData.xuc_xac_3 || 0;
        const total = sessionData.tong || (d1 + d2 + d3);
        this.history.push({ phien: id, result: normRes, total, dice: [d1, d2, d3] });
        if (this.history.length > 500) this.history.splice(0, 100);
        if (this.history.length >= 20 && this.history.length % 10 === 0) {
            this.masterCau.learn(this.history);
            this._learned = true;
        }
    }

    getResults() { return this.history.map(h => h.result === 'Tài' ? 'T' : 'X'); }
    getScores() { return this.history.map(h => h.tong || (h.dice ? h.dice.reduce((a, b) => a + b, 0) : 0)); }

    predict() {
        const n = this.history.length;
        if (n < 5) return { prediction: 'Cần thêm dữ liệu', confidence: 50 };
        if (!this._learned && n >= 20) { this.masterCau.learn(this.history); this._learned = true; }

        const R = this.getResults(), S = this.getScores();
        const last = this.history[n - 1];
        const lR = R[n - 1], lS = S[n - 1], lD = last.dice || [0, 0, 0];

        let streak = 1;
        for (let i = n - 2; i >= 0; i--) { if (R[i] === lR) streak++; else break; }
        let flips = 0;
        for (let i = Math.max(1, n - 9); i < n; i++) { if (R[i] !== R[i - 1]) flips++; }
        let c11len = 1;
        for (let i = n - 2; i >= 0; i--) { if (R[i] !== R[i + 1]) c11len++; else break; }
        const trend = n >= 10 ? S.slice(-5).reduce((a,b)=>a+b,0)/5 - S.slice(-10,-5).reduce((a,b)=>a+b,0)/5 : 0;
        const t10 = R.slice(-10).filter(r => r === 'T').length;
        const diemTang3 = n >= 3 && S[n-3] < S[n-2] && S[n-2] < S[n-1];
        const diemGiam3 = n >= 3 && S[n-3] > S[n-2] && S[n-2] > S[n-1];

        let all = [];

        // === MASTER CAU SIGNALS ===
        const mcSignals = this.masterCau.predict(R, S, lR, lS, lD, streak, flips, c11len, trend, t10, diemTang3, diemGiam3);
        all.push(...mcSignals.map(s => ({ p: s.p, c: s.c, w: s.w, s: 'master_cau' })));

        // === MARKOV ===
        const mm = predictMarkov(R.join(''));
        if (mm) all.push({ ...mm, w: 1.0, s: 'markov_multi' });
        const m1 = markov1(R); if (m1) all.push({ p: m1, c: 55, w: 0.6, s: 'markov1' });
        const m2 = markov2(R); if (m2) all.push({ p: m2, c: 58, w: 0.7, s: 'markov2' });
        const m3 = markov3(R); if (m3) all.push({ p: m3, c: 60, w: 0.7, s: 'markov3' });

        // === PATTERN DETECTORS ===
        for (const [name, detector] of Object.entries(PatternDetectors)) {
            const res = detector(R);
            if (res) all.push({ p: res.p, c: res.c, w: 0.9, s: name });
        }

        // === RSI ===
        const rsi = rsiPredict(R);
        if (rsi) all.push({ p: rsi, c: 64, w: 0.8, s: 'rsi' });

        if (all.length === 0) return { prediction: R[n - 1] === 'T' ? 'Xỉu' : 'Tài', confidence: 52 };

        all.sort((a, b) => (b.w * b.c) - (a.w * a.c));
        const top = all.slice(0, 30);

        let sT = 0, sX = 0, tW = 0;
        for (const s of top) { const w = s.w * (s.c / 100); if (s.p === 'T') sT += w; else sX += w; tW += w; }
        if (tW === 0) return { prediction: R[n - 1] === 'T' ? 'Xỉu' : 'Tài', confidence: 52 };

        const probT = sT / tW;
        const finalPred = probT > 0.5 ? 'T' : 'X';
        let conf = Math.round(Math.abs(probT - 0.5) * 2 * 100);

        if (all.length < 3) conf = Math.min(conf, 60);
        else if (all.length < 5) conf = Math.min(conf, 72);
        else if (all.length < 8) conf = Math.min(conf, 80);

        const t3 = top.slice(0, 3), t5 = top.slice(0, 5);
        if (t5.every(s => s.p === t5[0].p) && all.length >= 8) conf = Math.min(95, conf + 8);
        else if (t3.every(s => s.p === t3[0].p) && all.length >= 5) conf = Math.min(88, conf + 4);

        conf = Math.max(52, Math.min(95, conf));
        if (Math.abs(probT - 0.5) < 0.04) conf = Math.min(conf, 58);

        return { prediction: finalPred === 'T' ? 'Tài' : 'Xỉu', confidence: conf, totalSignals: all.length };
    }
}

// ======================================================
// KHỞI TẠO AI
// ======================================================
const master = new GodMasterAI();

// ======================================================
// ANALYZE CAU - 10 PHIÊN
// ======================================================
function analyzeCau(history) {
    if (history.length < 10) return "[Đang thu thập...]";
    const results = history.map(h => h.result === 'Tài' ? 'T' : 'X');
    const last10 = results.slice(-10);
    const patternStr = last10.join('');
    let parts = [];
    let streak = 1; const last = last10[last10.length - 1];
    for (let i = last10.length - 2; i >= 0; i--) { if (last10[i] === last) streak++; else break; }
    if (streak >= 3) parts.push(`Bệt ${streak} ${last === 'T' ? 'Tài' : 'Xỉu'}`);
    let is11 = true;
    for (let i = 1; i < last10.length; i++) { if (last10[i] === last10[i - 1]) { is11 = false; break; } }
    if (is11) parts.push("Cầu 1-1");
    const tCount = last10.filter(r => r === 'T').length;
    if (parts.length === 0) {
        if (tCount >= 9) parts.push("Tài áp đảo"); else if (tCount <= 1) parts.push("Xỉu áp đảo");
        else if (tCount >= 7) parts.push("Nghiêng Tài"); else if (tCount <= 3) parts.push("Nghiêng Xỉu");
        else parts.push("Cân bằng");
    }
    return `[${parts.join(', ')}] - ${patternStr}`;
}

// ======================================================
// GLOBAL STATE
// ======================================================
let globalHistory = [];
let lastPhien = 0;

// ======================================================
// ROUTES
// ======================================================
app.get("/", async (req, res) => {
    try {
        const response = await axios.get(API_URL, { timeout: 15000 });
        const rawData = response.data;
        const history = normalizeData(rawData);
        for (const item of history) { if (item.phien > lastPhien) { globalHistory.push(item); master.addSession(item); lastPhien = item.phien; } }
        if (globalHistory.length > 200) globalHistory = globalHistory.slice(-200);
        const latest = history[history.length - 1];
        const pattern = analyzeCau(history);
        const predict = master.predict();
        const result = { id: "AnhKhoidzai Sunwin", phien_truoc: latest.phien, xuc_xac1: latest.x1, xuc_xac2: latest.x2, xuc_xac3: latest.x3, tong: latest.tong, ket_qua: latest.ket_qua, pattern: pattern, phien_hien_tai: latest.phien + 1, du_doan: predict.prediction === 'Tài' ? 'tài' : 'xỉu', do_tin_cay: predict.confidence + "%" };
        console.log("JSON:", JSON.stringify(result, null, 2));
        res.json(result);
    } catch (err) {
        res.json({ id: "AnhKhoidzai Sunwin", phien_truoc: 0, xuc_xac1: 0, xuc_xac2: 0, xuc_xac3: 0, tong: 0, ket_qua: "tài", pattern: "[Lỗi]", phien_hien_tai: 0, du_doan: "tài", do_tin_cay: "52%" });
    }
});

app.get("/taixiu", async (req, res) => {
    try {
        const response = await axios.get(API_URL, { timeout: 15000 });
        const rawData = response.data;
        const history = normalizeData(rawData);
        for (const item of history) { if (item.phien > lastPhien) { globalHistory.push(item); master.addSession(item); lastPhien = item.phien; } }
        if (globalHistory.length > 200) globalHistory = globalHistory.slice(-200);
        const latest = history[history.length - 1];
        const pattern = analyzeCau(history);
        const predict = master.predict();
        res.json({ id: "AnhKhoidzai Sunwin", phien_truoc: latest.phien, xuc_xac1: latest.x1, xuc_xac2: latest.x2, xuc_xac3: latest.x3, tong: latest.tong, ket_qua: latest.ket_qua, pattern: pattern, phien_hien_tai: latest.phien + 1, du_doan: predict.prediction === 'Tài' ? 'tài' : 'xỉu', do_tin_cay: predict.confidence + "%" });
    } catch (err) {
        res.json({ id: "AnhKhoidzai Sunwin", phien_truoc: 0, xuc_xac1: 0, xuc_xac2: 0, xuc_xac3: 0, tong: 0, ket_qua: "tài", pattern: "[Lỗi]", phien_hien_tai: 0, du_doan: "tài", do_tin_cay: "52%" });
    }
});

// ======================================================
// AUTO SCAN MỖI 0.1 GIÂY (100ms)
// ======================================================
async function autoScan() {
    console.log("🔄 Bắt đầu quét API mỗi 0.1 giây...");
    setInterval(async () => {
        try {
            const response = await axios.get(API_URL, { timeout: 5000 });
            const rawData = response.data;
            const history = normalizeData(rawData);
            for (const item of history) { if (item.phien > lastPhien) { globalHistory.push(item); master.addSession(item); lastPhien = item.phien; } }
            if (globalHistory.length > 200) globalHistory = globalHistory.slice(-200);
        } catch (e) {}
    }, 100);
}

app.listen(PORT, () => {
    console.log("🌟 God Master AI chạy tại port " + PORT);
    console.log("🔗 API: " + API_URL);
    console.log("📊 50+ thuật toán | % 52-95% | Quét 0.1s | 10 phiên");
    autoScan();
});
