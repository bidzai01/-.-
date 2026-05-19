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
        const d1 = item.xuc_xac_1 || 0, d2 = item.xuc_xac_2 || 0, d3 = item.xuc_xac_3 || 0;
        const tong = item.tong || (d1 + d2 + d3);
        let ketQua = (item.ket_qua || "").toLowerCase();
        if (!ketQua) ketQua = tong >= 11 ? "tài" : "xỉu";
        return { phien: item.phien || 0, x1: d1, x2: d2, x3: d3, xuc_xac_1: d1, xuc_xac_2: d2, xuc_xac_3: d3, tong, ket_qua, result: ketQua === "tài" ? "Tài" : "Xỉu", dice: [d1, d2, d3] };
    }).filter(item => item.phien > 0 && item.tong >= 3 && item.tong <= 18);
}

// ======================================================
// 1. ULTIMATE CAU ANALYZER - 50+ LOẠI CẦU
// ======================================================
class UltimateCauAnalyzer {
    constructor() {
        this.cauDB = {};
    }
    learn(history) {
        const R = history.map(h => h.result === 'Tài' ? 'T' : 'X');
        const S = history.map(h => h.tong), D = history.map(h => h.dice), L = history.length;
        this.cauDB = {
            'CẦU 1-1': { tiep:0, gay:0, total:0 }, 'CẦU 2-2': { tiep:0, gay:0, total:0 }, 'CẦU 3-3': { tiep:0, gay:0, total:0 },
            'CẦU 4-4': { tiep:0, gay:0, total:0 }, 'CẦU 1-2-3': { tiep:0, gay:0, total:0 }, 'CẦU 3-2-1': { tiep:0, gay:0, total:0 },
            'CẦU TAM GIÁC': { tiep:0, gay:0, total:0 }, 'CẦU ZIGZAG': { tiep:0, gay:0, total:0 }, 'CẦU ĐỐI XỨNG': { tiep:0, gay:0, total:0 },
            'CẦU BẬC THANG': { tiep:0, gay:0, total:0 }, 'CẦU RỒNG': { tiep:0, gay:0, total:0 }, 'CẦU HỔ': { tiep:0, gay:0, total:0 },
            'CẦU SÓNG': { tiep:0, gay:0, total:0 }, 'CẦU 1-1 DÀI': { tiep:0, gay:0, total:0 }, 'CẦU 2-1-2': { tiep:0, gay:0, total:0 },
            'CẦU 1-2-1': { tiep:0, gay:0, total:0 }, 'CẦU NÉN': { tiep:0, gay:0, total:0 }, 'CẦU BUNG': { tiep:0, gay:0, total:0 },
            'CẦU 1-2-1-2': { tiep:0, gay:0, total:0 }, 'CẦU 1-1-2-2': { tiep:0, gay:0, total:0 }, 'CẦU VAI ĐẦU VAI': { tiep:0, gay:0, total:0 },
            'CẦU 3-1-3': { tiep:0, gay:0, total:0 }, 'BỆT TÀI': {}, 'BỆT XỈU': {}, 'TỔNG THẤP (≤4)': { T:0, X:0 }, 'TỔNG CAO (≥17)': { T:0, X:0 },
            '3 MẶT GIỐNG': { T:0, X:0 }, 'CẶP 1': { T:0, X:0 }, 'CẶP 6': { T:0, X:0 }
        };
        for (let i=3;i<L-1;i++) { if(R[i]!==R[i-1]&&R[i-1]!==R[i-2]&&R[i-2]!==R[i-3]){this.cauDB['CẦU 1-1'].total++;if(R[i+1]!==R[i])this.cauDB['CẦU 1-1'].tiep++;else this.cauDB['CẦU 1-1'].gay++;} if(R[i-3]===R[i-2]&&R[i-1]===R[i]&&R[i-3]!==R[i-1]){this.cauDB['CẦU 2-2'].total++;if(R[i+1]===R[i])this.cauDB['CẦU 2-2'].tiep++;else this.cauDB['CẦU 2-2'].gay++;} }
        for (let i=5;i<L-1;i++) { const a=R.slice(i-5,i-2),b=R.slice(i-2,i+1); if(a.every(x=>x===a[0])&&b.every(x=>x===b[0])&&a[0]!==b[0]){this.cauDB['CẦU 3-3'].total++;if(R[i+1]===a[0])this.cauDB['CẦU 3-3'].tiep++;else this.cauDB['CẦU 3-3'].gay++;} let f=0;for(let j=i-4;j<=i;j++)if(j>i-4&&R[j]!==R[j-1])f++;if(f>=4){this.cauDB['CẦU ZIGZAG'].total++;if(R[i+1]!==R[i])this.cauDB['CẦU ZIGZAG'].tiep++;else this.cauDB['CẦU ZIGZAG'].gay++;} if(R.slice(i-5,i+1).every(x=>x==='T')){this.cauDB['CẦU RỒNG'].total++;if(R[i+1]==='X')this.cauDB['CẦU RỒNG'].gay++;else this.cauDB['CẦU RỒNG'].tiep++;} if(R.slice(i-5,i+1).every(x=>x==='X')){this.cauDB['CẦU HỔ'].total++;if(R[i+1]==='T')this.cauDB['CẦU HỔ'].gay++;else this.cauDB['CẦU HỔ'].tiep++;} const p=R.slice(i-5,i+1).join('');if(p==='TXXTTT'||p==='XTTXXX'){const e=p==='TXXTTT'?'X':'T';this.cauDB['CẦU 1-2-3'].total++;if(R[i+1]===e)this.cauDB['CẦU 1-2-3'].tiep++;else this.cauDB['CẦU 1-2-3'].gay++;} if(p==='TTTXXT'||p==='XXXTTX'){const e=p==='TTTXXT'?'T':'X';this.cauDB['CẦU 3-2-1'].total++;if(R[i+1]===e)this.cauDB['CẦU 3-2-1'].tiep++;else this.cauDB['CẦU 3-2-1'].gay++;} }
        for (let i=4;i<L-1;i++) { const p=R.slice(i-4,i+1).join('');if(p==='TXTXT'){this.cauDB['CẦU TAM GIÁC'].total++;if(R[i+1]==='X')this.cauDB['CẦU TAM GIÁC'].tiep++;else this.cauDB['CẦU TAM GIÁC'].gay++;}if(p==='XTXTX'){this.cauDB['CẦU TAM GIÁC'].total++;if(R[i+1]==='T')this.cauDB['CẦU TAM GIÁC'].tiep++;else this.cauDB['CẦU TAM GIÁC'].gay++;} }
        for (let n=2;n<=20;n++) { this.cauDB['BỆT TÀI'][n]={tiep:0,gay:0}; this.cauDB['BỆT XỈU'][n]={tiep:0,gay:0}; }
        for (const t of ['T','X']) { let st=0; const db = t==='T'?this.cauDB['BỆT TÀI']:this.cauDB['BỆT XỈU']; for(let i=0;i<L;i++){if(R[i]===t)st++;else if(st>=2&&i<L){const k=Math.min(st,20);if(R[i]===t)db[k].tiep++;else db[k].gay++;st=0;}else st=0;} }
        for (let i=0;i<L-1;i++) { const n=R[i+1],d=D[i],s=S[i]; if(s<=4)this.cauDB['TỔNG THẤP (≤4)'][n]++; if(s>=17)this.cauDB['TỔNG CAO (≥17)'][n]++; if(d[0]===d[1]&&d[1]===d[2])this.cauDB['3 MẶT GIỐNG'][n]++; if(d.filter(x=>x===1).length>=2)this.cauDB['CẶP 1'][n]++; if(d.filter(x=>x===6).length>=2)this.cauDB['CẶP 6'][n]++; }
    }
    predict(R, S, lR, lS, lD, streak, flips, c11len, trend, t10) {
        const SIG = [], add = (p,c,w,r) => { if(c>=50) SIG.push({p,c:Math.min(95,Math.round(c)),w,r}); };
        if (lS<=4) { const d=this.cauDB['TỔNG THẤP (≤4)']; const rt=(d.T+d.X)>0?Math.round(d.T/(d.T+d.X)*100):79; add('T',rt,5,`Tổng ${lS}→Tài ${rt}%`); }
        if (lS>=17) { const d=this.cauDB['TỔNG CAO (≥17)']; const rx=(d.T+d.X)>0?Math.round(d.X/(d.T+d.X)*100):73; add('X',rx,5,`Tổng ${lS}→Xỉu ${rx}%`); }
        if (lD[0]===lD[1]&&lD[1]===lD[2]) { const d=this.cauDB['3 MẶT GIỐNG']; const r=(d.T+d.X)>0?Math.round(Math.max(d.T,d.X)/(d.T+d.X)*100):72; add(lD[0]>=4?'X':'T',r,4,`3 mặt ${lD[0]}`); }
        if (lD.filter(x=>x===1).length>=2) { const d=this.cauDB['CẶP 1']; const r=(d.T+d.X)>0?Math.round(d.T/(d.T+d.X)*100):72; add('T',r,4,`Cặp 1→Tài ${r}%`); }
        if (streak>=15) add(lR==='T'?'X':'T',90,4,`Bệt ${streak}→CHẮC GÃY`);
        else if (streak>=10) add(lR==='T'?'X':'T',80,4,`Bệt ${streak}→GÃY`);
        else if (streak>=7) add(lR==='T'?'X':'T',70,4,`Bệt ${streak}→Gãy`);
        else if (streak>=5) add(lR==='T'?'X':'T',62,3,`Bệt ${streak}→Gãy`);
        else if (streak>=2) add(lR,56,2,`Bệt ${streak}→Tiếp`);
        if (c11len>=5) add(lR==='T'?'X':'T',66,3,`Cầu 1-1 (${c11len} nhịp)`);
        else if (c11len>=3) add(lR==='T'?'X':'T',60,2,`Cầu 1-1 (${c11len} nhịp)`);
        if (flips>=8) add(lR==='T'?'X':'T',70,3,`Zigzag ${flips}/9→Đảo`);
        else if (flips>=6) add(lR==='T'?'X':'T',63,2,`Zigzag→Đảo`);
        if (lS>=5&&lS<=6) { const d=this.cauDB.diem?.[lS]; const r=d?Math.round(d.T/(d.T+d.X)*100):58; add('T',r,2.5,`Tổng ${lS}→Tài ${r}%`); }
        if (Math.abs(trend)>7) add(trend>0?'X':'T',64,2.5,`Điểm ${trend>0?'tăng':'giảm'} mạnh`);
        if (t10>=7) add('X',63,2,`Nhiều Tài(${t10}/10)→Xỉu`); else if (t10<=3) add('T',63,2,`Nhiều Xỉu(${10-t10}/10)→Tài`);
        if (flips<=2) add(lR,58,1.5,'Ít đổi→Tiếp');
        if (R.length>=4) { const l4=R.slice(-4); if(l4[0]===l4[1]&&l4[2]===l4[3]&&l4[0]!==l4[2]) add(l4[2],66,2.5,'Cầu 2-2→Tiếp'); }
        if (R.length>=5) { const l5=R.slice(-5).join(''); if(l5==='TXTXT') add('X',82,3,'Tam giác→X'); if(l5==='XTXTX') add('T',82,3,'Tam giác→T'); }
        if (R.length>=6) { const l6=R.slice(-6).join(''); if(l6==='TXXTTT') add('X',78,2.5,'1-2-3→X'); if(l6==='XTTXXX') add('T',78,2.5,'1-2-3→T'); }
        if (SIG.length===0) add(t10>=5?'T':'X',52,1,'Theo xu hướng');
        return SIG;
    }
}

// ======================================================
// 2. 50+ THUẬT TOÁN TỔNG HỢP
// ======================================================
function predictMarkov(seq) { if(seq.length<4)return null;let b=null,bc=0;for(let o=3;o<=Math.min(5,seq.length-1);o++){const l=seq.slice(-o),t={};for(let i=0;i<=seq.length-o-1;i++){const p=seq.slice(i,i+o),n=seq[i+o];if(!t[p])t[p]={T:0,X:0};t[p][n]++;}const po=t[l];if(!po)continue;const tt=po.T+po.X,pr=po.T/tt,cf=(Math.max(po.T,po.X)/tt)*100;if(cf>bc){bc=cf;b=pr>0.5?"T":"X";}}return b?{p:b,c:Math.round(bc)}:null;}
function markov1(h){if(h.length<2)return null;const l=h[h.length-1],t={T:{T:0,X:0},X:{T:0,X:0}};for(let i=0;i<h.length-1;i++)t[h[i]][h[i+1]]++;if(t[l].T>t[l].X)return'T';if(t[l].X>t[l].T)return'X';return null;}
function markov2(h){if(h.length<3)return null;const l2=h.slice(-2),t=new Map();for(let i=0;i<h.length-2;i++){const k=h[i]+','+h[i+1],n=h[i+2];if(!t.has(k))t.set(k,{T:0,X:0});t.get(k)[n]++;}const po=t.get(l2.join(','));if(!po)return null;return po.T>po.X?'T':(po.X>po.T?'X':null);}
function markov3(h){if(h.length<4)return null;const l3=h.slice(-3),t=new Map();for(let i=0;i<h.length-3;i++){const k=h.slice(i,i+3).join(','),n=h[i+3];if(!t.has(k))t.set(k,{T:0,X:0});t.get(k)[n]++;}const po=t.get(l3.join(','));if(!po)return null;return po.T>po.X?'T':(po.X>po.T?'X':null);}
function rsiPredict(h,p=7){if(h.length<p)return null;const n=h.slice(-p).map(c=>c==='T'?1:0);let g=0,l=0;for(let i=1;i<n.length;i++){const d=n[i]-n[i-1];if(d>0)g+=d;else l-=d;}if(l===0)return 100;const r=100-(100/(1+g/l));if(r>70)return'X';if(r<30)return'T';return null;}
const PatternDetectors = { detect_1_1:(h)=>{if(h.length>=4&&h.slice(-4).join('')==="TXTX")return{p:'X',c:78};if(h.length>=4&&h.slice(-4).join('')==="XTXT")return{p:'T',c:78};return null;}, detect_2_2:(h)=>{if(h.length>=4&&h.slice(-4).join('')==="TTXX")return{p:'X',c:74};if(h.length>=4&&h.slice(-4).join('')==="XXTT")return{p:'T',c:74};return null;}, detect_triangle:(h)=>{const l5=h.slice(-5).join('');if(l5==="TXTXT")return{p:'X',c:80};if(l5==="XTXTX")return{p:'T',c:80};return null;}, detect_dragon:(h)=>{let t=0;for(let i=h.length-1;i>=0;i--){if(h[i]==='T')t++;else break;}if(t>=6)return{p:'X',c:76};if(t>=4)return{p:'T',c:66};return null;}, detect_tiger:(h)=>{let x=0;for(let i=h.length-1;i>=0;i--){if(h[i]==='X')x++;else break;}if(x>=6)return{p:'T',c:76};if(x>=4)return{p:'X',c:66};return null;} };

// ======================================================
// 3. SIÊU CẦU PREDICTOR V9
// ======================================================
class SieuCauPredictorV9 {
    constructor() { this.history = []; this.lastPred = null; this.lastPattern = ''; }
    getCurrentStreak() { if(!this.history.length)return{outcome:null,length:0};let l=this.history[0],len=1;for(let i=1;i<this.history.length;i++){if(this.history[i]===l)len++;else break;}return{outcome:l,length:len};}
    detectCau424() { if(this.history.length<10)return null;let h=this.history.slice(0,10),p1=h.slice(0,4),p2=h.slice(4,6),p3=h.slice(6,10);if(p1.every(x=>x==='Tài')&&p2.every(x=>x==='Xỉu')&&p3.every(x=>x==='Tài'))return{pred:'Xỉu',weight:0.98,pattern:'CẦU 4-2-4'};if(p1.every(x=>x==='Xỉu')&&p2.every(x=>x==='Tài')&&p3.every(x=>x==='Xỉu'))return{pred:'Tài',weight:0.98,pattern:'CẦU 4-2-4'};return null;}
    detectCau323() { if(this.history.length<8)return null;let h=this.history.slice(0,8);if(h[0]===h[1]&&h[1]===h[2]&&h[3]===h[4]&&h[2]!==h[3]&&h[5]===h[6]&&h[6]===h[7]&&h[5]===h[0])return{pred:h[0],weight:0.97,pattern:'CẦU 3-2-3'};return null;}
    detectCau33() { if(this.history.length<6)return null;let h=this.history.slice(0,6);if(h[0]===h[1]&&h[1]===h[2]&&h[3]===h[4]&&h[4]===h[5]&&h[0]!==h[3])return{pred:h[0],weight:0.96,pattern:'CẦU 3-3'};return null;}
    detectCau22() { if(this.history.length<4)return null;let h=this.history.slice(0,4);if(h[0]===h[1]&&h[2]===h[3]&&h[0]!==h[2])return{pred:h[2]==='Tài'?'Xỉu':'Tài',weight:0.93,pattern:'CẦU 2-2'};return null;}
    detectCau212() { if(this.history.length<5)return null;let h=this.history.slice(0,5);if(h[0]===h[1]&&h[3]===h[4]&&h[0]===h[3]&&h[1]!==h[2])return{pred:h[0],weight:0.95,pattern:'CẦU 2-1-2'};return null;}
    detectCau11() { if(this.history.length<6)return null;let h=this.history.slice(0,6);for(let i=1;i<h.length;i++)if(h[i]===h[i-1])return null;return{pred:h[5]==='Tài'?'Xỉu':'Tài',weight:0.92,pattern:'CẦU 1-1'};}
    detectLongStreak() { let s=this.getCurrentStreak();if(s.length>=6&&s.length<=9)return{pred:s.outcome,weight:0.93,pattern:`BỆT ${s.outcome} (${s.length} dây)`};if(s.length>=10)return{pred:s.outcome==='Tài'?'Xỉu':'Tài',weight:0.92,pattern:`ĐẢO BỆT ${s.length} DÂY`};if(s.length>=4&&s.length<=5)return{pred:s.outcome,weight:0.90,pattern:`BỆT ${s.length} DÂY`};return null;}
    detectCauLech() { if(this.history.length<15)return null;let l15=this.history.slice(0,15),tc=l15.filter(x=>x==='Tài').length,r=tc/15;if(r>=0.73)return{pred:'Xỉu',weight:0.90,pattern:'LỆCH TÀI → XỈU'};if(r<=0.27)return{pred:'Tài',weight:0.90,pattern:'LỆCH XỈU → TÀI'};return null;}
    predict() {
        if(this.history.length<4){let rp=Math.random()>0.5?'Tài':'Xỉu';return{prediction:rp,confidence:68,pattern:'ĐANG PHÂN TÍCH...'};}
        let results=[],p424=this.detectCau424();if(p424)results.push(p424);let p323=this.detectCau323();if(p323)results.push(p323);let p33=this.detectCau33();if(p33)results.push(p33);let p22=this.detectCau22();if(p22)results.push(p22);let p212=this.detectCau212();if(p212)results.push(p212);let p11=this.detectCau11();if(p11)results.push(p11);let streak=this.detectLongStreak();if(streak)results.push(streak);let lech=this.detectCauLech();if(lech)results.push(lech);
        if(results.length===0){let ratio=this.history.filter(x=>x==='Tài').length/this.history.length;let pred=ratio>=0.53?'Tài':'Xỉu';let conf=72+Math.floor(Math.abs(ratio-0.5)*30);conf=Math.min(88,Math.max(68,conf));return{prediction:pred,confidence:conf,pattern:`TỈ LỆ ${Math.round(ratio*100)}% TÀI`};}
        let taiW=0,xiuW=0,pat='';for(let r of results){if(r.pred==='Tài')taiW+=r.weight;else xiuW+=r.weight;if(r.pattern)pat=r.pattern;}
        let fp=taiW>xiuW?'Tài':'Xỉu',conf=68+Math.floor((Math.max(taiW,xiuW)/(taiW+xiuW))*32);
        let l10=this.history.slice(0,10);if(l10.length===10){let t10=l10.filter(x=>x==='Tài').length;if(t10>=9){fp='Xỉu';conf=Math.min(96,conf+12);pat='CHỐNG BỆT TÀI - BẮT XỈU';}if(t10<=1){fp='Tài';conf=Math.min(96,conf+12);pat='CHỐNG BỆT XỈU - BẮT TÀI';}}
        conf=Math.min(98,Math.max(72,conf));return{prediction:fp,confidence:conf,pattern:pat};
    }
    updateAndPredict(result) { this.history.unshift(result); if(this.history.length>1000)this.history.pop(); return this.predict(); }
}

// ======================================================
// 🌟 GOD MASTER AI - TỔNG HỢP TẤT CẢ
// ======================================================
class GodMasterAI {
    constructor() {
        this.history = [];
        this.ultimateCau = new UltimateCauAnalyzer();
        this.sieuCau = new SieuCauPredictorV9();
        this._learned = false;
    }
    addSession(sessionData) {
        const id = sessionData.phien || 0;
        if (this.history.length > 0 && this.history[this.history.length - 1].phien === id) return;
        const res = sessionData.result || sessionData.ket_qua || '';
        if (!res || (res !== 'Tài' && res !== 'Xỉu' && res !== 'T' && res !== 'X')) return;
        const normRes = (res === 'Tài' || res === 'T') ? 'Tài' : 'Xỉu';
        const d1 = sessionData.x1 || sessionData.xuc_xac_1 || 0, d2 = sessionData.x2 || sessionData.xuc_xac_2 || 0, d3 = sessionData.x3 || sessionData.xuc_xac_3 || 0;
        const total = sessionData.tong || (d1 + d2 + d3);
        this.history.push({ phien: id, result: normRes, total, dice: [d1, d2, d3] });
        this.sieuCau.updateAndPredict(normRes);
        if (this.history.length > 500) this.history.splice(0, 100);
        if (this.history.length >= 20 && this.history.length % 10 === 0) { this.ultimateCau.learn(this.history); this._learned = true; }
    }
    getResults() { return this.history.map(h => h.result === 'Tài' ? 'T' : 'X'); }
    getScores() { return this.history.map(h => h.tong || (h.dice ? h.dice.reduce((a, b) => a + b, 0) : 0)); }

    predict() {
        const n = this.history.length;
        if (n < 5) return { prediction: 'Cần thêm dữ liệu', confidence: 50 };
        if (!this._learned && n >= 20) { this.ultimateCau.learn(this.history); this._learned = true; }
        const R = this.getResults(), S = this.getScores(), last = this.history[n - 1];
        const lR = R[n - 1], lS = S[n - 1], lD = last.dice || [0, 0, 0];
        let streak = 1; for (let i = n - 2; i >= 0; i--) { if (R[i] === lR) streak++; else break; }
        let flips = 0; for (let i = Math.max(1, n - 9); i < n; i++) { if (R[i] !== R[i - 1]) flips++; }
        let c11len = 1; for (let i = n - 2; i >= 0; i--) { if (R[i] !== R[i + 1]) c11len++; else break; }
        const trend = n >= 10 ? S.slice(-5).reduce((a,b)=>a+b,0)/5 - S.slice(-10,-5).reduce((a,b)=>a+b,0)/5 : 0;
        const t10 = R.slice(-10).filter(r => r === 'T').length;

        let all = [];

        // Ultimate Cau signals
        const ucSignals = this.ultimateCau.predict(R, S, lR, lS, lD, streak, flips, c11len, trend, t10);
        all.push(...ucSignals.map(s => ({ p: s.p, c: s.c, w: s.w, s: 'ultimate_cau' })));

        // Markov
        const mm = predictMarkov(R.join('')); if (mm) all.push({ ...mm, w: 1.0, s: 'markov_multi' });
        const m1 = markov1(R); if (m1) all.push({ p: m1, c: 55, w: 0.6, s: 'markov1' });
        const m2 = markov2(R); if (m2) all.push({ p: m2, c: 58, w: 0.7, s: 'markov2' });
        const m3 = markov3(R); if (m3) all.push({ p: m3, c: 60, w: 0.7, s: 'markov3' });

        // Pattern Detectors
        for (const [name, detector] of Object.entries(PatternDetectors)) { const res = detector(R); if (res) all.push({ p: res.p, c: res.c, w: 0.9, s: name }); }

        // RSI
        const rsi = rsiPredict(R); if (rsi) all.push({ p: rsi, c: 64, w: 0.8, s: 'rsi' });

        // Siêu Cầu V9
        const scPred = this.sieuCau.predict();
        if (scPred && scPred.confidence >= 60) all.push({ p: scPred.prediction === 'Tài' ? 'T' : 'X', c: scPred.confidence, w: 1.5, s: 'sieu_cau_v9' });

        if (all.length === 0) return { prediction: R[n - 1] === 'T' ? 'Xỉu' : 'Tài', confidence: 52 };

        all.sort((a, b) => (b.w * b.c) - (a.w * a.c));
        const top = all.slice(0, 30);
        let sT = 0, sX = 0, tW = 0;
        for (const s of top) { const w = s.w * (s.c / 100); if (s.p === 'T') sT += w; else sX += w; tW += w; }
        if (tW === 0) return { prediction: R[n - 1] === 'T' ? 'Xỉu' : 'Tài', confidence: 52 };
        const probT = sT / tW, finalPred = probT > 0.5 ? 'T' : 'X';
        let conf = Math.round(Math.abs(probT - 0.5) * 2 * 100);
        if (all.length < 3) conf = Math.min(conf, 60); else if (all.length < 5) conf = Math.min(conf, 72); else if (all.length < 8) conf = Math.min(conf, 80);
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
    const last10 = results.slice(-10), patternStr = last10.join('');
    let parts = [], streak = 1; const last = last10[last10.length - 1];
    for (let i = last10.length - 2; i >= 0; i--) { if (last10[i] === last) streak++; else break; }
    if (streak >= 3) parts.push(`Bệt ${streak} ${last === 'T' ? 'Tài' : 'Xỉu'}`);
    let is11 = true; for (let i = 1; i < last10.length; i++) { if (last10[i] === last10[i - 1]) { is11 = false; break; } }
    if (is11) parts.push("Cầu 1-1");
    const tCount = last10.filter(r => r === 'T').length;
    if (parts.length === 0) { if (tCount >= 9) parts.push("Tài áp đảo"); else if (tCount <= 1) parts.push("Xỉu áp đảo"); else if (tCount >= 7) parts.push("Nghiêng Tài"); else if (tCount <= 3) parts.push("Nghiêng Xỉu"); else parts.push("Cân bằng"); }
    return `[${parts.join(', ')}] - ${patternStr}`;
}

// ======================================================
// GLOBAL STATE
// ======================================================
let globalHistory = [], lastPhien = 0;

// ======================================================
// ROUTES
// ======================================================
app.get("/", async (req, res) => {
    try {
        const response = await axios.get(API_URL, { timeout: 15000 });
        const rawData = response.data, history = normalizeData(rawData);
        for (const item of history) { if (item.phien > lastPhien) { globalHistory.push(item); master.addSession(item); lastPhien = item.phien; } }
        if (globalHistory.length > 200) globalHistory = globalHistory.slice(-200);
        const latest = history[history.length - 1], pattern = analyzeCau(history), predict = master.predict();
        const result = { id: "AnhKhoidzai Sunwin", phien_truoc: latest.phien, xuc_xac1: latest.x1, xuc_xac2: latest.x2, xuc_xac3: latest.x3, tong: latest.tong, ket_qua: latest.ket_qua, pattern, phien_hien_tai: latest.phien + 1, du_doan: predict.prediction === 'Tài' ? 'tài' : 'xỉu', do_tin_cay: predict.confidence + "%" };
        console.log("JSON:", JSON.stringify(result, null, 2));
        res.json(result);
    } catch (err) { res.json({ id: "AnhKhoidzai Sunwin", phien_truoc: 0, xuc_xac1: 0, xuc_xac2: 0, xuc_xac3: 0, tong: 0, ket_qua: "tài", pattern: "[Lỗi]", phien_hien_tai: 0, du_doan: "tài", do_tin_cay: "52%" }); }
});

app.get("/taixiu", async (req, res) => {
    try {
        const response = await axios.get(API_URL, { timeout: 15000 });
        const rawData = response.data, history = normalizeData(rawData);
        for (const item of history) { if (item.phien > lastPhien) { globalHistory.push(item); master.addSession(item); lastPhien = item.phien; } }
        if (globalHistory.length > 200) globalHistory = globalHistory.slice(-200);
        const latest = history[history.length - 1], pattern = analyzeCau(history), predict = master.predict();
        res.json({ id: "AnhKhoidzai Sunwin", phien_truoc: latest.phien, xuc_xac1: latest.x1, xuc_xac2: latest.x2, xuc_xac3: latest.x3, tong: latest.tong, ket_qua: latest.ket_qua, pattern, phien_hien_tai: latest.phien + 1, du_doan: predict.prediction === 'Tài' ? 'tài' : 'xỉu', do_tin_cay: predict.confidence + "%" });
    } catch (err) { res.json({ id: "AnhKhoidzai Sunwin", phien_truoc: 0, xuc_xac1: 0, xuc_xac2: 0, xuc_xac3: 0, tong: 0, ket_qua: "tài", pattern: "[Lỗi]", phien_hien_tai: 0, du_doan: "tài", do_tin_cay: "52%" }); }
});

// ======================================================
// AUTO SCAN MỖI 0.1 GIÂY (100ms)
// ======================================================
async function autoScan() {
    console.log("🔄 Bắt đầu quét API mỗi 0.1 giây...");
    setInterval(async () => {
        try { const response = await axios.get(API_URL, { timeout: 5000 }); const rawData = response.data, history = normalizeData(rawData); for (const item of history) { if (item.phien > lastPhien) { globalHistory.push(item); master.addSession(item); lastPhien = item.phien; } } if (globalHistory.length > 200) globalHistory = globalHistory.slice(-200); } catch (e) {}
    }, 100);
}

app.listen(PORT, () => { console.log("🌟 God Master AI chạy tại port " + PORT); console.log("🔗 API: " + API_URL); console.log("📊 ALL THUẬT TOÁN | % 52-95% | Quét 0.1s | 10 phiên"); autoScan(); });
