// The report must name the live cache, and must not crash where caches is absent.
var path=require('path'); var NODE_PATH=process.env.NODE_PATH||'/tmp/pwtest/node_modules';
var pw=require(path.join(NODE_PATH,'playwright'));
var fail=0; function ck(l,c,x){console.log((c?'  ok   ':'  FAIL ')+l+(x?'   '+x:''));if(!c)fail=1;}
(async function(){
  var b=await pw.chromium.launch({executablePath:'/home/fry/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',args:['--no-sandbox','--allow-file-access-from-files']});
  var p=await b.newPage({viewport:{width:390,height:844}});
  p.on('pageerror',function(e){console.log('PAGEERROR:',e.message);fail=1;});
  await p.goto('file:///tmp/etv-repo/index.html'); await p.waitForTimeout(400);
  // plant a cache the way the service worker would
  await p.evaluate(function(){ return caches.open('vega-v34').then(function(){}); });
  await p.reload(); await p.waitForTimeout(600);
  var r=await p.evaluate(function(){
    FNV.act('new');
    FNV.act('export');                       // builds S.exportText via runReport()
    return JSON.parse(FNV.S.exportText).cache;
  });
  console.log('report cache field: '+JSON.stringify(r));
  ck('report names the live cache, not a literal', r==='vega-v34', 'got '+r);
  await b.close(); console.log(fail?'FAILED':'ok'); process.exit(fail);
})().catch(function(e){console.error('threw:',e&&e.stack||e);process.exit(1);});
