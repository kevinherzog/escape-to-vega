var fs=require('fs'),path=require('path'),os=require('os');
var FILE=process.argv[2]||'/tmp/etv-repo/index.html';
var m=fs.readFileSync(FILE,'utf8').match(/<script>([\s\S]*?)<\/script>/);
var TMP=path.join(os.tmpdir(),'bug-splice-'+Math.random().toString(36).slice(2)+'.js');
fs.writeFileSync(TMP,m[1]); var L=require(TMP);

var s=L.newRun(0,1,'albatross');
s.crew=[]; s.bench=[]; s.cap=6; s.slots=4; s.weapons=['laser'];
// two matching crew aboard
L.addCrew(s,'tech','spark',1);
L.addCrew(s,'tech','spark',1);
// bench: the third matching copy FIRST, an unrelated weapon SECOND
var third=L.makeCrewForTest?null:null;
s.bench=[{kind:'crew',m:{id:7001,role:'tech',origin:'spark',stars:1,name:'Volta'}},
         {kind:'weapon',k:'rail'}];
console.log('before : crew='+s.crew.length+' stars='+s.crew.map(function(c){return c.stars;}).join('/')+
            '  bench='+JSON.stringify(s.bench.map(function(e){return e.kind==='weapon'?e.k:'crew';}))+
            '  weapons='+JSON.stringify(s.weapons));
var r=L.benchDeploy(s,0);     // deploy the benched third copy -> triggers a merge
console.log('deploy(0) ->',JSON.stringify(r));
console.log('after  : crew='+s.crew.length+' stars='+s.crew.map(function(c){return c.stars;}).join('/')+
            '  bench='+JSON.stringify(s.bench.map(function(e){return e.kind==='weapon'?e.k:'crew';}))+
            '  weapons='+JSON.stringify(s.weapons));
var railGone = s.weapons.indexOf('rail')<0 && !(s.bench||[]).some(function(e){return e.kind==='weapon'&&e.k==='rail';});
console.log('\nRailgun still exists somewhere? '+(railGone?'NO  <-- destroyed, no scrap paid':'yes'));
console.log('scrap: '+s.scrap);
