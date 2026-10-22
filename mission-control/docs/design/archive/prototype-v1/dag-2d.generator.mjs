import fs from "node:fs";
import path from "node:path";

const ROOT = "/Users/Shared/Proyectos/panda-corp/mission-control/docs/frds";
const OUT = "/tmp/dag-2d-prototype.html";

const DEPS = {
  "WO-01-000": [], "WO-01-001": ["WO-01-000"], "WO-01-002": ["WO-01-000"], "WO-01-003": ["WO-01-000"],
  "WO-01-004": ["WO-01-000"], "WO-01-005": ["WO-01-000","WO-01-001"], "WO-01-006": ["WO-01-000","WO-01-001"],
  "WO-01-007": ["WO-01-000"], "WO-01-008": ["WO-01-002"], "WO-01-009": ["WO-01-005","WO-01-007","WO-05-001"],
  "WO-02-001": ["WO-01-003","WO-01-005"], "WO-02-003": ["WO-01-005"], "WO-02-004": ["WO-01-000"],
  "WO-02-011": ["WO-01-003","WO-01-005"],
  "WO-02-005": ["WO-02-001","WO-02-004","WO-01-003","WO-01-005","WO-13-006","WO-13-007","WO-13-008","WO-13-001","WO-13-002","WO-13-003"],
  "WO-02-007": ["WO-02-003","WO-02-011","WO-01-006","WO-13-006","WO-13-007","WO-13-009","WO-13-001","WO-13-002","WO-13-003","WO-06-005"],
  "WO-03-001": ["WO-01-004","WO-01-005","WO-01-001"],
  "WO-03-002": ["WO-03-001","WO-01-004","WO-01-005","WO-01-001","WO-02-003","WO-13-006","WO-13-007","WO-13-008","WO-13-001","WO-13-002","WO-13-003","WO-04-004"],
  "WO-04-001": ["WO-01-000","WO-01-001"], "WO-04-003": ["WO-02-003","WO-01-005"],
  "WO-04-004": ["WO-04-001","WO-04-003","WO-01-005","WO-03-001","WO-13-006","WO-13-007","WO-13-008","WO-13-001","WO-13-002","WO-13-003"],
  "WO-04-005": ["WO-04-001","WO-04-004","WO-02-003","WO-13-006","WO-13-007","WO-13-001","WO-13-002","WO-13-003"],
  "WO-05-001": ["WO-01-000"], "WO-05-002": ["WO-05-001"],
  "WO-05-003": ["WO-05-001","WO-05-002","WO-04-001","WO-04-004","WO-01-009","WO-13-006","WO-13-007","WO-13-008","WO-13-001","WO-13-002","WO-13-003"],
  "WO-06-012": ["WO-01-007"], "WO-06-001": ["WO-06-012"], "WO-06-002": ["WO-11-001","WO-13-001"],
  "WO-06-003": ["WO-06-001","WO-06-012"], "WO-06-004": ["WO-06-002","WO-06-003"],
  "WO-06-005": ["WO-06-001","WO-06-002","WO-06-003","WO-06-012","WO-01-007","WO-11-001"],
  "WO-06-007": ["WO-06-005","WO-06-004","WO-06-002","WO-06-001","WO-06-003","WO-01-009","WO-13-006","WO-13-007","WO-13-008","WO-13-009","WO-04-004","WO-11-001"],
  "WO-07-001": ["WO-01-001"], "WO-07-003": ["WO-01-001"], "WO-07-004": ["WO-01-001"],
  "WO-07-005": ["WO-07-001","WO-07-003","WO-07-004","WO-09-002","WO-01-007","WO-13-006","WO-13-007","WO-13-008"],
  "WO-08-001": ["WO-01-001"], "WO-08-002": ["WO-08-001","WO-07-005","WO-07-001","WO-07-003","WO-07-004","WO-13-006","WO-13-007","WO-13-008"],
  "WO-09-001": ["WO-01-005","WO-06-012"], "WO-09-002": ["WO-06-012"], "WO-09-005": ["WO-06-012"],
  "WO-09-003": ["WO-09-001","WO-09-005","WO-09-002","WO-01-007","WO-01-005","WO-03-001","WO-01-009","WO-13-006","WO-13-007","WO-13-008"],
  "WO-10-001": ["WO-01-003","WO-01-005","WO-01-007","WO-03-001"],
  "WO-10-005": ["WO-10-001","WO-09-003","WO-13-006","WO-13-007","WO-13-008"],
  "WO-11-001": [], "WO-11-002": ["WO-11-001","WO-04-003","WO-04-004","WO-01-005","WO-13-006","WO-13-007"],
  "WO-12-001": ["WO-01-007"], "WO-12-002": ["WO-01-007"], "WO-12-003": ["WO-01-007"], "WO-12-004": ["WO-01-007"],
  "WO-12-005": ["WO-12-004","WO-12-006","WO-01-009","WO-05-001","WO-13-006","WO-13-007"],
  "WO-12-006": ["WO-01-009","WO-05-001","WO-13-006","WO-13-007"],
  "WO-13-001": [], "WO-13-002": ["WO-13-001"], "WO-13-003": ["WO-13-002"], "WO-13-004": ["WO-13-002"], "WO-13-005": ["WO-13-001"],
  "WO-13-006": ["WO-13-001","WO-13-002","WO-13-003"], "WO-13-007": ["WO-13-001","WO-13-002","WO-13-003"],
  "WO-13-008": ["WO-13-001","WO-13-002","WO-13-003"], "WO-13-009": ["WO-13-001","WO-13-002","WO-13-003","WO-13-006","WO-13-007","WO-13-008"],
  "WO-14-001": ["WO-01-005"], "WO-14-002": ["WO-14-001","WO-13-006","WO-13-007"], "WO-14-003": ["WO-13-007"], "WO-14-004": [],
  "WO-15-001": [], "WO-15-002": ["WO-15-001"], "WO-15-003": ["WO-15-002"], "WO-15-004": ["WO-15-003","WO-13-007"],
  "WO-16-001": ["WO-01-002"], "WO-16-002": ["WO-16-001"], "WO-16-003": ["WO-16-002"], "WO-16-004": ["WO-16-003","WO-13-007","WO-13-006"],
  "WO-17-001": [], "WO-17-002": ["WO-17-001"], "WO-17-003": ["WO-17-001"], "WO-17-004": ["WO-17-002","WO-17-003","WO-13-006","WO-13-007"],
  "WO-18-001": ["WO-01-009","WO-01-008","WO-01-007","WO-01-005","WO-01-004","WO-01-003","WO-01-002","WO-03-001","WO-05-001","WO-09-001","WO-10-001","WO-13-006","WO-13-007","WO-13-008","WO-15-004","WO-16-004","WO-17-001"],
  "WO-19-001": ["WO-13-006","WO-13-008","WO-09-001","WO-17-004","WO-01-008","WO-01-007","WO-01-005","WO-01-004","WO-01-002"],
};

const STATE = { VERIFIED: "done", IN_REVIEW: "review", IN_PROGRESS: "in_progress", BLOCKED: "fail", PLANNED: "todo" };
const wos = [];
for (const frd of fs.readdirSync(ROOT).sort()) {
  const dir = path.join(ROOT, frd, "work-orders");
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (!/^wo-.+\.md$/i.test(f)) continue;
    const txt = fs.readFileSync(path.join(dir, f), "utf-8");
    const fmEnd = txt.indexOf("\n---", 3);
    const fm = txt.startsWith("---") && fmEnd > 0 ? txt.slice(3, fmEnd) : "";
    const get = (k) => { const m = new RegExp(`^${k}:\\s*(.+)$`, "m").exec(fm); return m ? m[1].trim() : ""; };
    const h = txt.split("\n").find((l) => /^#\s/.test(l)) ?? "";
    const idm = /\b(WO-\d{2,}-\d{3,})\b/.exec(h) || /^(wo-\d{2,}-\d{3,})/i.exec(f);
    const id = idm ? idm[1].toUpperCase() : f.replace(/\.md$/, "").toUpperCase();
    let title = get("title").replace(/^['"]|['"]$/g, "");
    title = title.replace(/^WO-\d{2,}-\d{3,}\s*[—-]\s*/, "").replace(/^>-\s*/, "").trim();
    if (!title || title === ">-") { const bh = h.replace(/^#\s*/, "").replace(/^WO-\d{2,}-\d{3,}\s*[—-]\s*/, ""); title = bh || id; }
    const st = STATE[(get("implementation_status") || "PLANNED").toUpperCase()] ?? "todo";
    wos.push({ id, title, state: st, frd, dependsOn: DEPS[id] ?? [] });
  }
}
const idset = new Set(wos.map((w) => w.id));
for (const w of wos) w.dependsOn = (w.dependsOn || []).filter((d) => idset.has(d) && d !== w.id);
const DATA = JSON.stringify(wos);

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>DAG 2D — Mission Control</title>
<style>
  :root{--bg:#0e1116;--panel:#161b22;--panel2:#1c232c;--bd:#2a323c;--t1:#e6edf3;--t2:#9aa7b4;--t3:#6b7785;
    --ok:#3fb950;--review:#58a6ff;--prog:#d29922;--fail:#f85149;--todo:#484f58;--accent:#7c5cff;}
  *{box-sizing:border-box} html,body{margin:0;height:100%}
  body{background:var(--bg);color:var(--t1);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;display:flex;flex-direction:column}
  header{flex:0 0 auto;padding:9px 16px;border-bottom:1px solid var(--bd);display:flex;gap:14px;align-items:center;flex-wrap:wrap;background:var(--bg);z-index:5}
  header h1{font-size:14px;margin:0;font-weight:600}
  .sub,.hint{font-size:11px;color:var(--t2)} .hint{color:var(--t3)}
  .legend{display:flex;gap:11px;font-size:11px;color:var(--t2);align-items:center;flex-wrap:wrap}
  .dot{display:inline-block;width:9px;height:9px;border-radius:2px;vertical-align:-1px;margin-right:3px}
  #wrap{flex:1 1 auto;position:relative;overflow:hidden;cursor:grab}
  #wrap.grabbing{cursor:grabbing}
  .cluster{fill:var(--panel);stroke:var(--bd);stroke-width:1.2}
  .cluster.fsel{stroke:var(--accent);stroke-width:2.4}
  .clabel{fill:var(--t2);font-size:12px;font-weight:700}
  .card{cursor:pointer}
  .card rect.bg{fill:var(--panel2);stroke:var(--bd);stroke-width:1}
  .cid{fill:var(--t3);font-size:8px;font-family:ui-monospace,monospace}
  .ctitle{fill:var(--t1);font-size:9.5px}
  .intra{stroke:var(--t3);stroke-width:1.1;fill:none;opacity:.5}
  .xedge{stroke:var(--accent);stroke-width:1.4;stroke-dasharray:5 4;fill:none;opacity:.4}
  .edge.hot{opacity:1 !important;stroke-width:2.6 !important}
  .edge.cold{opacity:.05 !important}
  .card.cold{opacity:.18}
  .card.sel rect.bg{stroke:var(--accent);stroke-width:2}
  .toolbar{position:absolute;top:10px;right:14px;display:flex;gap:6px;z-index:6}
  .toolbar button{background:var(--panel2);color:var(--t1);border:1px solid var(--bd);border-radius:8px;width:30px;height:30px;font-size:15px;cursor:pointer}
</style></head><body>
<header>
  <h1>DAG 2D · Mission Control</h1>
  <span class="sub">cajas = FRDs · tarjetas = work orders · líneas finas = deps internas · — — moradas = relación entre FRDs (al seleccionar un WO, cada línea toma un color para seguirla)</span>
  <span class="legend">
    <span><i class="dot" style="background:var(--ok)"></i>hecho</span>
    <span><i class="dot" style="background:var(--review)"></i>revisión</span>
    <span><i class="dot" style="background:var(--prog)"></i>en curso</span>
    <span><i class="dot" style="background:var(--fail)"></i>falló</span>
    <span><i class="dot" style="background:var(--todo)"></i>pendiente</span>
  </span>
  <span class="hint">arrastra · rueda=zoom · clic en una tarjeta = fija su cadena (clic de nuevo o en vacío = soltar)</span>
</header>
<div id="wrap"><div class="toolbar"><button id="zin">+</button><button id="zout">−</button><button id="zfit">⤢</button></div></div>
<script>
const WOS = ${DATA};
const SCOL = {done:'var(--ok)',review:'var(--review)',in_progress:'var(--prog)',fail:'var(--fail)',todo:'var(--todo)'};
const esc=s=>String(s).replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));
const frdOf=new Map(WOS.map(w=>[w.id,w.frd]));
const byFrd=new Map(); for(const w of WOS){ if(!byFrd.has(w.frd))byFrd.set(w.frd,[]); byFrd.get(w.frd).push(w); }
const frds=[...byFrd.keys()];
const label=f=>{const m=/^(frd-\\d+)-?(.*)$/.exec(f);const head=m?m[1].toUpperCase():f;const rest=(m?m[2]:'').replace(/-/g,' ');return rest?head+' · '+rest.charAt(0).toUpperCase()+rest.slice(1):head;};
function wrap2(t,max){ if(t.length<=max)return [t,'']; const ws=t.split(' ');let a='',b='';for(const w of ws){if(b===''&&(a?a+' '+w:w).length<=max)a=a?a+' '+w:w;else b=b?b+' '+w:w;} if(b.length>max)b=b.slice(0,max-1)+'…'; return [a,b]; }

// ---- per-cluster internal layout (cards by intra-FRD rank) ----
const CW=164, CH=54, COLW=182, ROWH=66, HEAD=28, PAD=12;
const cards=new Map();
const clusters=frds.map(f=>{const list=byFrd.get(f);const ids=new Set(list.map(w=>w.id));const intra=[];for(const w of list)for(const d of w.dependsOn)if(ids.has(d))intra.push([d,w.id]);return {f,list,intra};});
for(const c of clusters){
  const list=c.list;
  const rank=new Map(list.map(w=>[w.id,0])),indeg=new Map(list.map(w=>[w.id,0])),succ=new Map(list.map(w=>[w.id,[]]));
  for(const [a,b] of c.intra){succ.get(a).push(b);indeg.set(b,(indeg.get(b)||0)+1);}
  const q=list.filter(w=>indeg.get(w.id)===0).map(w=>w.id);
  while(q.length){const n=q.shift();for(const m of succ.get(n)){if(rank.get(n)+1>rank.get(m))rank.set(m,rank.get(n)+1);indeg.set(m,indeg.get(m)-1);if(indeg.get(m)===0)q.push(m);}}
  const byRank=new Map();for(const w of list){const r=rank.get(w.id);if(!byRank.has(r))byRank.set(r,[]);byRank.get(r).push(w);}
  let maxRows=1,maxRank=0;
  for(const [r,b] of byRank){maxRank=Math.max(maxRank,r);maxRows=Math.max(maxRows,b.length);b.forEach((w,i)=>cards.set(w.id,{dx:PAD+r*COLW,dy:HEAD+i*ROWH}));}
  c.w=PAD*2+maxRank*COLW+CW; c.h=HEAD+PAD+(maxRows-1)*ROWH+CH;
}
const cByF=new Map(clusters.map(c=>[c.f,c]));

// ---- FRD super-graph (cross deps aggregated to FRD level) ----
const superCount=new Map(); // "A>B" -> count
for(const w of WOS)for(const d of w.dependsOn){const a=frdOf.get(d),b=w.frd;if(a&&b&&a!==b){const k=a+'>'+b;superCount.set(k,(superCount.get(k)||0)+1);}}
const superDir=[...superCount.entries()].map(([k,n])=>{const[a,b]=k.split('>');return{a,b,n};});
const superUndir=new Set(); for(const{a,b}of superDir){superUndir.add(a<b?a+'|'+b:b+'|'+a);}
const superLinks=[...superUndir].map(k=>{const[a,b]=k.split('|');return{a,b};});

// ---- deterministic force layout + AABB no-overlap ----
const N=clusters.length,R0=650; clusters.forEach((c,i)=>{const a=i/N*Math.PI*2;c.x=Math.cos(a)*R0;c.y=Math.sin(a)*R0;});
const IDEAL=340;
for(let it=0;it<900;it++){const al=1-it/900;
  for(let i=0;i<N;i++)for(let j=i+1;j<N;j++){const A=clusters[i],B=clusters[j];let dx=B.x-A.x,dy=B.y-A.y,d=Math.hypot(dx,dy)||.01;let rep=(200000/(d*d))*al;A.x-=dx/d*rep;A.y-=dy/d*rep;B.x+=dx/d*rep;B.y+=dy/d*rep;}
  for(const l of superLinks){const A=cByF.get(l.a),B=cByF.get(l.b);if(!A||!B)continue;let dx=B.x-A.x,dy=B.y-A.y,d=Math.hypot(dx,dy)||.01;const f=(d-IDEAL)*0.02*al;A.x+=dx/d*f;A.y+=dy/d*f;B.x-=dx/d*f;B.y-=dy/d*f;}
  for(const c of clusters){c.x-=c.x*0.005*al;c.y-=c.y*0.005*al;}
}
// AABB separation — guarantees boxes never touch (GAP margin)
const GAP=34;
for(let pass=0;pass<600;pass++){let any=false;
  for(let i=0;i<N;i++)for(let j=i+1;j<N;j++){const A=clusters[i],B=clusters[j];
    const ox=(A.w/2+B.w/2+GAP)-Math.abs(A.x-B.x), oy=(A.h/2+B.h/2+GAP)-Math.abs(A.y-B.y);
    if(ox>0&&oy>0){any=true; if(ox<oy){const s=(A.x<B.x?-1:1)*ox/2;A.x+=s;B.x-=s;}else{const s=(A.y<B.y?-1:1)*oy/2;A.y+=s;B.y-=s;}}
  } if(!any)break;
}
let mnx=1e9,mny=1e9,mxx=-1e9,mxy=-1e9;
for(const c of clusters){mnx=Math.min(mnx,c.x-c.w/2);mny=Math.min(mny,c.y-c.h/2);mxx=Math.max(mxx,c.x+c.w/2);mxy=Math.max(mxy,c.y+c.h/2);}
const M=80,W=mxx-mnx+M*2,H=mxy-mny+M*2;
for(const c of clusters){c.bx=c.x-c.w/2-mnx+M;c.by=c.y-c.h/2-mny+M;c.cxAbs=c.bx+c.w/2;c.cyAbs=c.by+c.h/2;}
const cardAbs=new Map();
for(const c of clusters)for(const w of c.list){const p=cards.get(w.id);cardAbs.set(w.id,{x:c.bx+p.dx,y:c.by+p.dy});}

// ---- render ----
let clusterSvg='',cardSvg='',intraSvg='',crossSvg='';
for(const c of clusters){
  clusterSvg+='<rect class="cluster" data-frd="'+c.f+'" x="'+c.bx+'" y="'+c.by+'" width="'+c.w+'" height="'+c.h+'" rx="12"/>';
  clusterSvg+='<text class="clabel" x="'+(c.bx+10)+'" y="'+(c.by+18)+'">'+esc(label(c.f).slice(0,32))+'</text>';
  for(const w of c.list){const p=cardAbs.get(w.id);const x=p.x,y=p.y;const [l1,l2]=wrap2(w.title,24);
    cardSvg+='<g class="card" data-id="'+w.id+'" data-frd="'+c.f+'">'
      +'<rect class="bg" x="'+x+'" y="'+y+'" width="'+CW+'" height="'+CH+'" rx="6"/>'
      +'<rect x="'+x+'" y="'+y+'" width="4" height="'+CH+'" rx="2" fill="'+SCOL[w.state]+'"/>'
      +'<text class="cid" x="'+(x+12)+'" y="'+(y+14)+'">'+w.id+'</text>'
      +'<text class="ctitle" x="'+(x+12)+'" y="'+(y+30)+'">'+esc(l1)+'</text>'
      +(l2?'<text class="ctitle" x="'+(x+12)+'" y="'+(y+43)+'">'+esc(l2)+'</text>':'')
      +'<title>'+esc(w.id+' · '+w.title+' ['+w.state+']')+'</title></g>';
  }
}
// intra edges (WO->WO)
for(const w of WOS)for(const d of w.dependsOn){if(frdOf.get(d)!==w.frd)continue;const A=cardAbs.get(d),B=cardAbs.get(w.id);if(!A||!B)continue;
  const x1=A.x+CW,y1=A.y+CH/2,x2=B.x,y2=B.y+CH/2;const mx=(x1+x2)/2;
  intraSvg+='<path class="edge intra" data-a="'+d+'" data-b="'+w.id+'" d="M'+x1+' '+y1+' C'+mx+' '+y1+','+mx+' '+y2+','+x2+' '+y2+'"/>';}
// cross edges (FRD->FRD aggregated) — uniform accent at rest; recolored per line ONLY when a WO
// is selected (so the few highlighted lines are each distinguishable; see light()).
for(const{a,b,n}of superDir){const A=cByF.get(a),B=cByF.get(b);if(!A||!B)continue;
  const sw=Math.min(3,1.1+n*0.22);
  crossSvg+='<path class="edge xedge" data-fa="'+a+'" data-fb="'+b+'" style="stroke-width:'+sw+'" d="M'+A.cxAbs+' '+A.cyAbs+' L'+B.cxAbs+' '+B.cyAbs+'"/>';}
// Render order: cross FRD-edges BEHIND the opaque cluster boxes (so they hide where they cross a
// box and emerge from the box borders — no spiderweb over the boxes); intra edges ON TOP of the
// boxes (visible inside them); cards last.
const svg='<svg id="g" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" xmlns="http://www.w3.org/2000/svg">'+crossSvg+clusterSvg+intraSvg+cardSvg+'</svg>';
const wrap=document.getElementById('wrap');wrap.insertAdjacentHTML('beforeend',svg);
const g=document.getElementById('g');

// ---- adjacency (intra WO-level + FRD-level) ----
const intraAdj=new Map(WOS.map(w=>[w.id,new Set()]));
for(const w of WOS)for(const d of w.dependsOn)if(frdOf.get(d)===w.frd){intraAdj.get(w.id).add(d);intraAdj.get(d).add(w.id);}
const frdAdj=new Map(frds.map(f=>[f,new Set()]));
for(const l of superLinks){frdAdj.get(l.a).add(l.b);frdAdj.get(l.b).add(l.a);}
function bfs(start,adj){const seen=new Set([start]),q=[start];while(q.length){const n=q.shift();for(const m of (adj.get(n)||[]))if(!seen.has(m)){seen.add(m);q.push(m);}}return seen;}

const edgeEls=[...g.querySelectorAll('.edge')];
const cardEls=[...g.querySelectorAll('.card')];
const clusterEls=[...g.querySelectorAll('.cluster')];
// desaturated harmonious palette — used ONLY to recolor the highlighted FRD lines on selection.
const PALETTE=['#6e8bb3','#7faf9b','#b3897a','#b38ab0','#9bab6e','#7badb3','#b3a36e','#8f96b3','#a87f97','#8a7bb8'];
let pinned=null;
function light(id){
  const woChain=bfs(id,intraAdj);              // full transitive WO chain WITHIN its FRD (bounded, useful)
  const F=frdOf.get(id);
  const frdSet=new Set([F]); for(const nb of (frdAdj.get(F)||[]))frdSet.add(nb);   // F + IMMEDIATE FRD neighbors
  let ci=0,ii=0;
  for(const e of edgeEls){
    const isX=e.classList.contains('xedge');
    const on = isX ? (e.dataset.fa===F||e.dataset.fb===F) : (woChain.has(e.dataset.a)&&woChain.has(e.dataset.b));
    e.classList.toggle('hot',on);e.classList.toggle('cold',!on);
    if(on){ e.style.setProperty('stroke',PALETTE[(isX?ci++:ii++)%PALETTE.length],'important'); }
    else { e.style.removeProperty('stroke'); }
  }
  for(const cd of cardEls){const me=cd.dataset.id,mf=cd.dataset.frd;
    cd.classList.toggle('sel',woChain.has(me));
    cd.classList.toggle('cold',!frdSet.has(mf));   // dim WOs whose FRD isn't F or a direct neighbor
  }
  for(const cl of clusterEls){cl.classList.toggle('fsel',frdSet.has(cl.dataset.frd));}
}
function unlight(){for(const e of edgeEls){e.classList.remove('hot','cold');e.style.removeProperty('stroke');}for(const cd of cardEls)cd.classList.remove('cold','sel');for(const cl of clusterEls)cl.classList.remove('fsel');}
function refresh(){if(pinned)light(pinned);else unlight();}
for(const cd of cardEls){
  cd.addEventListener('mouseenter',()=>{if(!pinned)light(cd.dataset.id);});
  cd.addEventListener('mouseleave',()=>{if(!pinned)unlight();});
  cd.addEventListener('click',e=>{e.stopPropagation();pinned=(pinned===cd.dataset.id?null:cd.dataset.id);refresh();});
}

// pan + zoom (relative to #wrap)
let scale=Math.min((wrap.clientWidth-40)/W,(wrap.clientHeight-40)/H,1)||1,tx=20,ty=20;
function apply(){g.style.transformOrigin='0 0';g.style.transform='translate('+tx+'px,'+ty+'px) scale('+scale+')';}
apply();let pan=false,sx=0,sy=0,moved=false,dnx=0,dny=0;
wrap.addEventListener('mousedown',e=>{pan=true;moved=false;dnx=e.clientX;dny=e.clientY;sx=e.clientX-tx;sy=e.clientY-ty;wrap.classList.add('grabbing');});
addEventListener('mousemove',e=>{if(!pan)return;if(Math.abs(e.clientX-dnx)+Math.abs(e.clientY-dny)>4)moved=true;tx=e.clientX-sx;ty=e.clientY-sy;apply();});
addEventListener('mouseup',()=>{pan=false;wrap.classList.remove('grabbing');});
wrap.addEventListener('click',()=>{if(moved)return;if(pinned){pinned=null;refresh();}});
wrap.addEventListener('wheel',e=>{e.preventDefault();const r=wrap.getBoundingClientRect();const f=e.deltaY<0?1.1:0.9;const mx=e.clientX-r.left-tx,my=e.clientY-r.top-ty;tx-=mx*(f-1);ty-=my*(f-1);scale*=f;apply();},{passive:false});
zin.onclick=()=>{scale*=1.15;apply();};zout.onclick=()=>{scale*=0.87;apply();};
zfit.onclick=()=>{scale=Math.min((wrap.clientWidth-40)/W,(wrap.clientHeight-40)/H,1)||1;tx=20;ty=20;apply();};
</script></body></html>`;

fs.writeFileSync(OUT, html, "utf-8");
const fof = new Map(wos.map((w) => [w.id, w.frd]));
let total = 0, cross = 0; const pairs = new Set();
for (const w of wos) for (const d of w.dependsOn) { total++; if (fof.get(d) && fof.get(d) !== w.frd) { cross++; pairs.add(fof.get(d) + ">" + w.frd); } }
console.log("WOs:", wos.length, "· total deps:", total, "· cross-WO:", cross, "· FRD↔FRD pairs:", pairs.size);
console.log("wrote", OUT, "(" + Math.round(html.length / 1024) + " KB)");
