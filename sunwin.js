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
// 🌟 SUPREME AI V7 - FULL 27+ THUẬT TOÁN - SIÊU CHUẨN
// ======================================================
class SupremeAIV7 {
    constructor() {
        this.history = [];
        this.DB = {};
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
        if (this.history.length >= 20 && this.history.length % 10 === 0) this._deepLearn();
    }

    _deepLearn() {
        const R = this.history.map(h => h.result === 'Tài' ? 'T' : 'X');
        const S = this.history.map(h => h.tong);
        const D = this.history.map(h => h.dice);
        const L = this.history.length;

        this.DB = {
            score: {}, dice: {}, bet: { T: {}, X: {} },
            pattern: new Map(), markov: { 2: {}, 3: {}, 4: {}, 5: {} },
            triple: { T: 0, X: 0 }, pair1: { T: 0, X: 0 }, pair6: { T: 0, X: 0 },
            lowS: { T: 0, X: 0 }, highS: { T: 0, X: 0 },
            c11: { t: 0, g: 0 }, c22: { t: 0, g: 0 }, c33: { t: 0, g: 0 },
            zigzag: { t: 0, g: 0 }, tamgiac: { t: 0, g: 0 },
            rong: { t: 0, g: 0 }, ho: { t: 0, g: 0 },
            c123: { t: 0, g: 0 }, c321: { t: 0, g: 0 },
            c1212: { t: 0, g: 0 }, c1122: { t: 0, g: 0 },
            doixung: { t: 0, g: 0 }, bacthang: { t: 0, g: 0 },
            freq: { nT: { T: 0, X: 0 }, nX: { T: 0, X: 0 } },
            mom: { up: { T: 0, X: 0 }, dn: { T: 0, X: 0 } },
            scoreStreak: { up3: { T: 0, X: 0 }, dn3: { T: 0, X: 0 } },
            diceHot: {}, diceCold: {}
        };

        // Điểm & Xúc xắc
        for (let i = 0; i < L - 1; i++) {
            const s = S[i], n = R[i + 1], dk = D[i].join('-'), d = D[i];
            if (!this.DB.score[s]) this.DB.score[s] = { T: 0, X: 0, t: 0 };
            this.DB.score[s][n]++; this.DB.score[s].t++;
            if (!this.DB.dice[dk]) this.DB.dice[dk] = { T: 0, X: 0, t: 0 };
            this.DB.dice[dk][n]++; this.DB.dice[dk].t++;
            if (d[0] === d[1] && d[1] === d[2]) this.DB.triple[n]++;
            if (d.filter(x => x === 1).length >= 2) this.DB.pair1[n]++;
            if (d.filter(x => x === 6).length >= 2) this.DB.pair6[n]++;
            if (s <= 4) this.DB.lowS[n]++;
            if (s >= 17) this.DB.highS[n]++;
            d.forEach(face => { if (!this.DB.diceHot[face]) this.DB.diceHot[face] = 0; this.DB.diceHot[face]++; });
        }
        for (let f = 1; f <= 6; f++) this.DB.diceCold[f] = (this.DB.diceHot[f] || 0);

        // Bệt
        for (const t of ['T', 'X']) {
            let st = 0;
            for (let i = 0; i < L; i++) {
                if (R[i] === t) st++;
                else {
                    if (st >= 1) {
                        const k = Math.min(st, 25);
                        if (!this.DB.bet[t][k]) this.DB.bet[t][k] = { tiep: 0, gay: 0, t: 0 };
                        if (i < L) { if (R[i] === t) this.DB.bet[t][k].tiep++; else this.DB.bet[t][k].gay++; this.DB.bet[t][k].t++; }
                    }
                    st = 0;
                }
            }
        }

        // Pattern & Markov
        for (let pl = 2; pl <= 8; pl++) {
            for (let i = 0; i < L - pl; i++) {
                const k = R.slice(i, i + pl).join(''), n = R[i + pl];
                if (!this.DB.pattern.has(k)) this.DB.pattern.set(k, { T: 0, X: 0, t: 0 });
                const p = this.DB.pattern.get(k); p[n]++; p.t++;
            }
        }
        for (let o = 2; o <= 5; o++) {
            for (let i = 0; i < L - o; i++) {
                const k = R.slice(i, i + o).join(''), n = R[i + o];
                if (!this.DB.markov[o][k]) this.DB.markov[o][k] = { T: 0, X: 0, t: 0 };
                this.DB.markov[o][k][n]++; this.DB.markov[o][k].t++;
            }
        }

        // Cầu đặc biệt
        for (let i = 3; i < L - 1; i++) {
            if (R[i] !== R[i-1] && R[i-1] !== R[i-2] && R[i-2] !== R[i-3]) {
                if (R[i+1] !== R[i]) this.DB.c11.t++; else this.DB.c11.g++;
            }
            if (R[i-3] === R[i-2] && R[i-1] === R[i] && R[i-3] !== R[i-1]) {
                if (R[i+1] === R[i]) this.DB.c22.t++; else this.DB.c22.g++;
            }
        }
        for (let i = 5; i < L - 1; i++) {
            if (R[i-5]===R[i-4]&&R[i-4]===R[i-3]&&R[i-2]===R[i-1]&&R[i-1]===R[i]&&R[i-5]!==R[i-2]) {
                if (R[i+1] === R[i-5]) this.DB.c33.t++; else this.DB.c33.g++;
            }
            let f = 0;
            for (let j = i-4; j <= i; j++) if (j > i-4 && R[j] !== R[j-1]) f++;
            if (f >= 4) { if (R[i+1] !== R[i]) this.DB.zigzag.t++; else this.DB.zigzag.g++; }
            if (R.slice(i-5, i+1).every(x => x === 'T')) { if (R[i+1] === 'X') this.DB.rong.g++; else this.DB.rong.t++; }
            if (R.slice(i-5, i+1).every(x => x === 'X')) { if (R[i+1] === 'T') this.DB.ho.g++; else this.DB.ho.t++; }
            const p = R.slice(i-5, i+1).join('');
            if (p === 'TXXTTT' || p === 'XTTXXX') { const e = p === 'TXXTTT' ? 'X' : 'T'; if (R[i+1] === e) this.DB.c123.t++; else this.DB.c123.g++; }
            if (p === 'TTTXXT' || p === 'XXXTTX') { const e = p === 'TTTXXT' ? 'T' : 'X'; if (R[i+1] === e) this.DB.c321.t++; else this.DB.c321.g++; }
        }
        for (let i = 4; i < L - 1; i++) {
            const p = R.slice(i-4, i+1).join('');
            if (p === 'TXTXT') { if (R[i+1] === 'X') this.DB.tamgiac.t++; else this.DB.tamgiac.g++; }
            if (p === 'XTXTX') { if (R[i+1] === 'T') this.DB.tamgiac.t++; else this.DB.tamgiac.g++; }
        }
        for (let i = 7; i < L - 1; i++) {
            if (R[i-7]===R[i-5]&&R[i-5]===R[i-3]&&R[i-6]===R[i-4]&&R[i-4]===R[i-2]&&R[i-7]!==R[i-6]) {
                if (R[i+1] !== R[i]) this.DB.c1212.t++; else this.DB.c1212.g++;
            }
            if (R[i-7]===R[i-6]&&R[i-5]===R[i-4]&&R[i-3]===R[i-2]&&R[i-1]===R[i]&&R[i-7]!==R[i-5]&&R[i-5]!==R[i-3]) {
                if (R[i+1] === R[i]) this.DB.c1122.t++; else this.DB.c1122.g++;
            }
        }
        for (let len = 3; len <= 6; len++) {
            for (let i = len; i < L - len; i++) {
                const left = R.slice(i-len, i), right = R.slice(i, i+len).reverse();
                if (left.join('') === right.join('')) {
                    if (R[i+len] === R[i-len]) this.DB.doixung.t++; else this.DB.doixung.g++;
                }
            }
        }
        for (let i = 5; i < L - 1; i++) {
            const seg = []; let cnt = 1;
            for (let j = i-4; j <= i; j++) {
                if (j > i-4 && R[j] === R[j-1]) cnt++;
                else if (j > i-4) { seg.push(cnt); cnt = 1; }
            }
            seg.push(cnt);
            if (seg.length >= 3) {
                const inc = seg.every((v, k) => k === 0 || v >= seg[k-1]);
                const dec = seg.every((v, k) => k === 0 || v <= seg[k-1]);
                if (inc || dec) { if (R[i+1] === R[i]) this.DB.bacthang.t++; else this.DB.bacthang.g++; }
            }
        }

        // Tần suất & Momentum & Điểm streak
        for (let i = 10; i < L - 1; i++) {
            const t10 = R.slice(i-9, i+1).filter(r => r === 'T').length, n = R[i + 1];
            if (t10 >= 7) this.DB.freq.nT[n]++;
            if (t10 <= 3) this.DB.freq.nX[n]++;
            const tr = S[i] - S[i-9];
            if (tr > 8) this.DB.mom.up[n]++;
            if (tr < -8) this.DB.mom.dn[n]++;
            if (i >= 2 && S[i] > S[i-1] && S[i-1] > S[i-2]) this.DB.scoreStreak.up3[n]++;
            if (i >= 2 && S[i] < S[i-1] && S[i-1] < S[i-2]) this.DB.scoreStreak.dn3[n]++;
        }

        this._learned = true;
    }

    getResults() { return this.history.map(h => h.result === 'Tài' ? 'T' : 'X'); }
    getScores() { return this.history.map(h => h.tong || (h.dice ? h.dice.reduce((a, b) => a + b, 0) : 0)); }

    predict() {
        const n = this.history.length;
        if (n < 5) return { prediction: 'Cần thêm dữ liệu', confidence: 50 };
        if (!this._learned && n >= 20) this._deepLearn();

        const R = this.getResults();
        const S = this.getScores();
        const last = this.history[n - 1];
        const lR = R[n - 1], lS = S[n - 1];
        const lD = last.dice || [0, 0, 0];

        let streak = 1;
        for (let i = n - 2; i >= 0; i--) { if (R[i] === lR) streak++; else break; }
        let flips = 0;
        for (let i = Math.max(1, n - 9); i < n; i++) { if (R[i] !== R[i - 1]) flips++; }
        let c11len = 1;
        for (let i = n - 2; i >= 0; i--) { if (R[i] !== R[i + 1]) c11len++; else break; }
        const trend5 = n >= 10 ? S.slice(-5).reduce((a,b)=>a+b,0)/5 - S.slice(-10,-5).reduce((a,b)=>a+b,0)/5 : 0;
        const t10 = R.slice(-10).filter(r => r === 'T').length;
        const scoreUp3 = n >= 3 && S[n-3] < S[n-2] && S[n-2] < S[n-1];
        const scoreDn3 = n >= 3 && S[n-3] > S[n-2] && S[n-2] > S[n-1];

        const SIG = [];
        const add = (p, c, w, t, r) => SIG.push({ pred: p, conf: Math.min(95, Math.round(c)), weight: w, type: t, reason: r });

        // 1-3: CỰC MẠNH
        if (lS <= 4) { const d = this.DB.lowS; const total = (d.T||0)+(d.X||0); const rt = total>0?Math.round((d.T||0)/total*100):79; add('T', rt, 5.0, 'CỰC MẠNH', `Tổng ${lS}→Tài ${rt}%`); }
        if (lS >= 17) { const d = this.DB.highS; const total = (d.T||0)+(d.X||0); const rx = total>0?Math.round((d.X||0)/total*100):73; add('X', rx, 5.0, 'CỰC MẠNH', `Tổng ${lS}→Xỉu ${rx}%`); }
        if (lD[0]===lD[1]&&lD[1]===lD[2]) { const d=this.DB.triple; const total=(d.T||0)+(d.X||0); const r=total>0?Math.round(Math.max(d.T||0,d.X||0)/total*100):72; add(lD[0]>=4?'X':'T',r,4.0,'3 MẶT',`3 mặt ${lD[0]}→${lD[0]>=4?'Xỉu':'Tài'} ${r}%`); }

        // 4-5: RẤT MẠNH
        if (lD.filter(x=>x===1).length>=2) { const d=this.DB.pair1; const total=(d.T||0)+(d.X||0); const r=total>0?Math.round((d.T||0)/total*100):72; add('T',r,3.5,'CẶP 1',`Cặp 1→Tài ${r}%`); }
        if (lD.filter(x=>x===6).length>=2&&lS>=15) add('X',68,3.0,'CẶP 6','Cặp 6+Điểm cao→Xỉu');

        // 6-10: BỆT
        if (streak>=15) { const bd=this.DB.bet[lR]?.[Math.min(streak,25)]; const gr=bd&&bd.t>0?Math.round(bd.gay/bd.t*100):92; add(lR==='T'?'X':'T',gr,5.0,'SIÊU BỆT',`Bệt ${streak}→CHẮC GÃY ${gr}%`); }
        else if (streak>=10) { const bd=this.DB.bet[lR]?.[Math.min(streak,25)]; const gr=bd&&bd.t>0?Math.round(bd.gay/bd.t*100):82; add(lR==='T'?'X':'T',gr,4.5,'SIÊU BỆT',`Bệt ${streak}→GÃY ${gr}%`); }
        else if (streak>=7) { const bd=this.DB.bet[lR]?.[streak]; const gr=bd&&bd.t>0?Math.round(bd.gay/bd.t*100):72; add(lR==='T'?'X':'T',gr,3.5,'BỆT DÀI',`Bệt ${streak}→Gãy ${gr}%`); }
        else if (streak>=5) { const bd=this.DB.bet[lR]?.[streak]; const gr=bd&&bd.t>0?Math.round(bd.gay/bd.t*100):62; add(lR==='T'?'X':'T',gr,2.5,'BỆT',`Bệt ${streak}→Gãy ${gr}%`); }
        else if (streak>=2) { const bd=this.DB.bet[lR]?.[streak]; const tr2=bd&&bd.t>0?Math.round(bd.tiep/bd.t*100):56; add(lR,tr2,1.5,'BỆT NGẮN',`Bệt ${streak}→Tiếp ${tr2}%`); }

        // 11-13: CẦU 1-1 & ZIGZAG
        if (c11len>=5) add(lR==='T'?'X':'T',66,2.5,'CẦU 1-1 DÀI',`Cầu 1-1 (${c11len} nhịp)→Đảo`);
        else if (c11len>=3) add(lR==='T'?'X':'T',60,2.0,'CẦU 1-1',`Cầu 1-1 (${c11len} nhịp)→Đảo`);
        if (flips>=8) add(lR==='T'?'X':'T',70,2.5,'ZIGZAG MẠNH',`Zigzag ${flips}/9→Đảo`);
        else if (flips>=6) add(lR==='T'?'X':'T',63,2.0,'ZIGZAG','Zigzag→Đảo');
        else if (flips<=2&&n>=10) add(lR,58,1.5,'ÍT ĐỔI','Ít đổi→Tiếp');

        // 14-17: ĐIỂM & MOMENTUM & STREAK
        if (lS>=5&&lS<=6) { const d=this.DB.score[lS]; const r=d&&d.t>0?Math.round(d.T/d.t*100):58; add('T',r,2.5,'ĐIỂM THẤP',`Tổng ${lS}→Tài ${r}%`); }
        if (lS>=15&&lS<=16) { const d=this.DB.score[lS]; const r=d&&d.t>0?Math.round(d.T/d.t*100):54; add('T',r,1.5,'ĐIỂM CAO',`Tổng ${lS}→Tài ${r}%`); }
        if (Math.abs(trend5)>7) add(trend5>0?'X':'T',64,2.0,'MOMENTUM',`Điểm ${trend5>0?'tăng':'giảm'} mạnh`);
        if (scoreUp3) { const d=this.DB.scoreStreak.up3; if((d.T||0)+(d.X||0)>=5){const r=Math.round((d.X||0)/((d.T||0)+(d.X||0))*100);add('X',r,2.0,'ĐIỂM TĂNG 3','Điểm tăng 3 phiên→Xỉu');} }
        if (scoreDn3) { const d=this.DB.scoreStreak.dn3; if((d.T||0)+(d.X||0)>=5){const r=Math.round((d.T||0)/((d.T||0)+(d.X||0))*100);add('T',r,2.0,'ĐIỂM GIẢM 3','Điểm giảm 3 phiên→Tài');} }

        // 18-19: TẦN SUẤT
        if (t10>=7) add('X',63,2.0,'TẦN SUẤT',`Nhiều Tài(${t10}/10)→Xỉu`);
        else if (t10<=3) add('T',63,2.0,'TẦN SUẤT',`Nhiều Xỉu(${10-t10}/10)→Tài`);

        // 20: PATTERN
        for (let pl=7; pl>=3; pl--) {
            const k=R.slice(-pl).join(''), p=this.DB.pattern.get(k);
            if(p&&p.t>=5) { const tR=p.T/p.t; if(tR>=0.65){add('T',Math.round(tR*100),2.5,'PATTERN',`"${k}"→Tài ${Math.round(tR*100)}%`);break;} if(tR<=0.35){add('X',Math.round((1-tR)*100),2.5,'PATTERN',`"${k}"→Xỉu ${Math.round((1-tR)*100)}%`);break;} }
        }

        // 21: MARKOV
        for (let o=4; o>=2; o--) {
            const k=R.slice(-o).join(''), mk=this.DB.markov[o][k];
            if(mk&&mk.t>=5) { const tR=mk.T/mk.t; if(tR>=0.62){add('T',Math.round(50+tR*30),2.0,`MARKOV-${o}`,'Markov→Tài');break;} if(tR<=0.38){add('X',Math.round(50+(1-tR)*30),2.0,`MARKOV-${o}`,'Markov→Xỉu');break;} }
        }

        // 22-26: CẦU ĐẶC BIỆT
        if (R.length>=4) { const l4=R.slice(-4); if(l4[0]===l4[1]&&l4[2]===l4[3]&&l4[0]!==l4[2]) add(l4[2],66,2.5,'CẦU 2-2','Cầu 2-2→Tiếp'); }
        if (R.length>=6) { const l6=R.slice(-6).join(''); if(l6==='TXXTTT') add('X',78,2.5,'CẦU 1-2-3','1-2-3→X'); if(l6==='XTTXXX') add('T',78,2.5,'CẦU 1-2-3','1-2-3→T'); }
        if (R.length>=5) { const l5=R.slice(-5).join(''); if(l5==='TXTXT') add('X',82,3.0,'TAM GIÁC','Tam giác→X'); if(l5==='XTXTX') add('T',82,3.0,'TAM GIÁC','Tam giác→T'); }
        if (R.length>=8) { const l8=R.slice(-8); if(l8[0]===l8[1]&&l8[2]===l8[3]&&l8[4]===l8[5]&&l8[6]===l8[7]&&l8[0]!==l8[2]&&l8[2]!==l8[4]) add(l8[6],62,1.5,'CẦU 4-4','Cầu 4-4→Tiếp'); }

        // 27: XÚC XẮC DB
        const dk=lD.join('-'), dd=this.DB.dice[dk];
        if(dd&&dd.t>=3) { const tR=dd.T/dd.t; if(tR>=0.65) add('T',Math.round(tR*100),2.0,'XÚC XẮC',`Bộ ${dk}→Tài ${Math.round(tR*100)}%`); else if(tR<=0.35) add('X',Math.round((1-tR)*100),2.0,'XÚC XẮC',`Bộ ${dk}→Xỉu ${Math.round((1-tR)*100)}%`); }

        // 28: XÚC XẮC NÓNG
        const hotFaces = Object.entries(this.DB.diceHot).sort((a,b)=>b[1]-a[1]).slice(0,2).map(e=>parseInt(e[0]));
        const hotInDice = lD.filter(x=>hotFaces.includes(x)).length;
        if (hotInDice>=2) add('T',58,1.0,'XÚC XẮC NÓNG','Nhiều mặt nóng→Tài');

        // MẶC ĐỊNH
        if (SIG.length===0) add(t10>=5?'T':'X',52,1.0,'MẶC ĐỊNH','Theo xu hướng');

        // TỔNG HỢP
        SIG.sort((a,b)=>(b.weight*b.conf)-(a.weight*a.conf));
        const top=SIG.slice(0,20);
        let sT=0,sX=0,tW=0;
        for(const s of top){const w=s.weight*(s.conf/100);if(s.pred==='T')sT+=w;else sX+=w;tW+=w;}
        if(tW===0)return{prediction:R[n-1]==='T'?'Xỉu':'Tài',confidence:52};
        const probT=sT/tW,finalPred=probT>0.5?'T':'X';
        let conf=Math.round(Math.abs(probT-0.5)*2*100);
        if(SIG.length<3)conf=Math.min(conf,60);else if(SIG.length<5)conf=Math.min(conf,72);else if(SIG.length<8)conf=Math.min(conf,80);
        const t3=top.slice(0,3),t5=top.slice(0,5);
        if(t5.every(s=>s.pred===t5[0].pred)&&SIG.length>=8)conf=Math.min(95,conf+8);
        else if(t3.every(s=>s.pred===t3[0].pred)&&SIG.length>=5)conf=Math.min(88,conf+4);
        conf=Math.max(52,Math.min(95,conf));
        if(Math.abs(probT-0.5)<0.04)conf=Math.min(conf,58);
        return{prediction:finalPred==='T'?'Tài':'Xỉu',confidence:conf,totalSignals:SIG.length};
    }
}

// ======================================================
// KHỞI TẠO AI
// ======================================================
const master = new SupremeAIV7();

// ======================================================
// ANALYZE CAU - 8 PHIÊN
// ======================================================
function analyzeCau(history) {
    if (history.length < 8) return "[Đang thu thập...]";
    const results = history.map(h => h.result === 'Tài' ? 'T' : 'X');
    const last8 = results.slice(-8);
    const patternStr = last8.join('');
    let parts = [];
    let streak = 1; const last = last8[last8.length - 1];
    for (let i = last8.length - 2; i >= 0; i--) { if (last8[i] === last) streak++; else break; }
    if (streak >= 3) parts.push(`Bệt ${streak} ${last === 'T' ? 'Tài' : 'Xỉu'}`);
    let is11 = true;
    for (let i = 1; i < last8.length; i++) { if (last8[i] === last8[i - 1]) { is11 = false; break; } }
    if (is11) parts.push("Cầu 1-1");
    const tCount = last8.filter(r => r === 'T').length;
    if (parts.length === 0) {
        if (tCount >= 7) parts.push("Tài áp đảo"); else if (tCount <= 1) parts.push("Xỉu áp đảo");
        else if (tCount >= 5) parts.push("Nghiêng Tài"); else if (tCount <= 3) parts.push("Nghiêng Xỉu");
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
    console.log("🌟 Supreme AI V7 chạy tại port " + PORT);
    console.log("🔗 API: " + API_URL);
    console.log("📊 28+ thuật toán | % 52-95% | Quét 0.1s");
    autoScan();
});
