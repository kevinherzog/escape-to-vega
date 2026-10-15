// Spark line vs the alternatives on a Needle, realistic 2-star crew + starting relic.
var fs=require('fs'),path=require('path'),os=require('os');
var m=fs.readFileSync('/tmp/etv-repo/index.html','utf8').match(/<script>([\s\S]*?)<\/script>/);
var TMP=path.join(os.tmpdir(),'needle-ab.js'); fs.writeFileSync(TMP,m[1]); var L=require(TMP);
var N=+(process.argv[2]||800);
var ROLES=['pilot','gunner','tech','engineer'];
function mk(origin,sector,stars,extra){
  var s=L.newRun(4,777,'needle'); s.crew=[]; s.bench=[]; s.cap=6;
  ROLES.forEach(function(r){ L.addCrew(s,r,origin,stars); });
  (extra||[]).forEach(function(c){ L.addCrew(s,c[0],c[1],stars); });
  L.syncHull(s); s.hull=L.maxHull(s); s.sector=sector; s.jump=3;
  if(sector>=2){ s.engineLv=4; s.weapons=['beam','mining','laser']; }
  return s;
}
function duel(s,type,seed){ L.seed(seed); var c=L.startCombat(s,type,{}); var g=200000;
  while(!c.over&&g-->0) L.stepCombat(c,0.05); return c.winner==='p'; }
[1,2,3].forEach(function(sec){
  console.log('\n=== Needle · Nightfall · sector '+sec+' · 2-star crew · '+N+' seeds ===');
  console.log('origin chased'.padEnd(26)+'hull'.padStart(6)+'shd'.padStart(5)+'fight'.padStart(8)+'elite'.padStart(8)+'guard'.padStart(8));
  [['Spark','spark'],['Crystalline','rock'],['Insectoid','bug'],['Human','human']].forEach(function(v){
    var p=mk(v[1],sec,2),d=L.derive(p),out=[];
    ['fight','elite','guardian'].forEach(function(t){ var w=0;
      for(var i=0;i<N;i++) if(duel(mk(v[1],sec,2),t,8000+i)) w++;
      out.push((w/N*100).toFixed(1).padStart(8)); });
    console.log(v[0].padEnd(26)+String(L.maxHull(p)).padStart(6)+String(d.bonusShields).padStart(5)+out.join(''));
  });
});
