// Conservation fuzzer. Randomly drives hangar/store actions through real clicks
// and asserts: an item may only leave the ship+bench by being installed, by being
// sold (scrap must rise), or by a merge (some member's stars must rise).
const fs=require('fs'); const {JSDOM}=require('jsdom');
const FILE=process.argv[2]||'/tmp/etv-repo/index.html';
const STEPS=+(process.argv[3]||400);
const dom=new JSDOM(fs.readFileSync(FILE,'utf8'),{runScripts:'dangerously',resources:'usable',url:'http://localhost/'});
dom.window.requestAnimationFrame=cb=>setTimeout(cb,0); dom.window.scrollTo=()=>{};
const errs=[]; dom.window.onerror=m=>errs.push(String(m));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const qa=a=>[].slice.call(dom.window.document.querySelectorAll('[data-a="'+a+'"]'));
let rng=12345; const rnd=()=>((rng=(rng*1103515245+12345)&0x7fffffff)/0x7fffffff);
const pick=a=>a[Math.floor(rnd()*a.length)];

function snap(s){
  const bw=(s.bench||[]).filter(e=>e.kind==='weapon').map(e=>e.k);
  const bc=(s.bench||[]).filter(e=>e.kind==='crew').map(e=>e.m);
  const stars={}; s.crew.concat(bc).forEach(m=>{ stars[m.id]=m.stars; });
  const w={}; s.weapons.concat(bw).forEach(k=>{ w[k]=(w[k]||0)+1; });
  return { w:w, nW:s.weapons.length+bw.length, stars:stars,
           ids:Object.keys(stars), nC:s.crew.length+bc.length,
           scrap:s.scrap, slots:s.slots, cap:s.cap };
}
// A merge is the only way a body may vanish without payment, and its signature is
// that some surviving member gained a star.
function someoneGainedAStar(a,b){
  return Object.keys(b.stars).some(id=>a.stars[id]!=null && b.stars[id]>a.stars[id]);
}
(async()=>{
  await wait(300);
  const FNV=dom.window.FNV, L=dom.window.VEGA;
  FNV.act('new'); await wait(50);
  const s=FNV.S.run;
  Object.assign(s,{scrap:200});
  s.bench=[{kind:'weapon',k:'flak'},{kind:'crew',m:{id:9001,role:'tech',origin:'spark',stars:1,name:'Volta'}}];
  L.syncHull(s);

  let bad=0;
  for(let step=0;step<STEPS;step++){
    if(s.scrap<30) s.scrap=200;                    // keep actions affordable
    if(!(s.bench||[]).length && rnd()<0.5){        // refill the bench so it stays exercised
      s.bench=[{kind:'weapon',k:pick(['flak','rail','mining','lance'])}];
    }
    const screen=rnd()<0.3?'store':'hangar';
    if(screen==='store'){ FNV.S.store=L.makeStore(s); }
    FNV.go(screen); await wait(12);

    // choose a random enabled action
    const kinds=['selbench','selw','selcrew','upg','sbuy','buy','deploy','benchsell','sellw','sellc','benchw','benchc','sslot','srep'];
    const cands=[];
    kinds.forEach(k=>qa(k).forEach(b=>{ if(!b.disabled) cands.push(b); }));
    if(!cands.length) continue;
    const btn=pick(cands);
    const act=btn.getAttribute('data-a'), val=btn.getAttribute('data-v');
    const before=snap(s);
    btn.click(); await wait(12);
    const after=snap(s);

    // weapons may only vanish if scrap rose (sold/replaced) or slots shrank
    if(after.nW<before.nW && after.scrap<=before.scrap){
      console.log('WEAPON LOST  step'+step+' act='+act+' v='+val+
        '  nW '+before.nW+'->'+after.nW+'  scrap '+before.scrap+'->'+after.scrap);
      bad++;
    }
    // crew bodies may only vanish if scrap rose (sold) or a merge happened (max star rose)
    if(after.nC<before.nC && after.scrap<=before.scrap && !someoneGainedAStar(before,after)){
      console.log('CREW LOST    step'+step+' act='+act+' v='+val+
        '  nC '+before.nC+'->'+after.nC+'  scrap '+before.scrap+'->'+after.scrap+
        '  (no merge: nobody gained a star)');
      bad++;
    }
    // a specific weapon key vanishing without payment, even if the count is masked
    Object.keys(before.w).forEach(k=>{
      if((after.w[k]||0)<before.w[k] && after.scrap<=before.scrap){
        console.log('WEAPON KEY LOST step'+step+' act='+act+' v='+val+'  '+k+
          ' '+before.w[k]+'->'+(after.w[k]||0)+'  scrap '+before.scrap+'->'+after.scrap);
        bad++;
      }
    });
    if(bad>6) break;
  }
  console.log('\nsteps='+STEPS+'  violations='+bad+'  jsErrors='+(errs.length?errs.join(' | '):'none'));
  console.log(bad||errs.length?'FUZZ FOUND PROBLEMS':'fuzz clean');
  process.exit(bad||errs.length?1:0);
})().catch(e=>{console.error('threw:',e&&e.stack||e);process.exit(1);});
