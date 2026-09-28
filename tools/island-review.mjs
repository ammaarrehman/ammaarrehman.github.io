#!/usr/bin/env node
/* Audit-only instrumentation is added to the browser response, never to shipped world.js.
   Exposes read-only terrain/state observations for screenshots and geometry checks. */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';
const out = fileURLToPath(new URL('./out/review/', import.meta.url));
mkdirSync(out, { recursive: true });
const source = readFileSync(new URL('../js/world.js', import.meta.url), 'utf8');
const hook = `
  if (DEBUG) window.__review = {
    state: function () { return { state: gameState(), seaCodeType: typeof DEEP, deepTileIsWet: wet(0),
      logs: Object.keys(found), saveBytes: new TextEncoder().encode(JSON.stringify(save)).length,
      canvasMB: CANVASES.reduce(function(n,c){return n+c.width*c.height*4;},cv.width*cv.height*4)/1048576,
      paintMs: groundMs, audio: SND && SND.stats ? SND.stats() : null }; },
    geometry: function () {
      var blockedDirt=[], walkableWater=[];
      for(var y=0;y<MH;y++) for(var x=0;x<MW;x++) {
        var px=x*T+8,py=y*T+8,painted=kAt(px,py);
        if(painted===KD && !walkable(x,y) && rim(x,y) && !inBuilding(x,y) && !nearStation(x,y)) blockedDirt.push([x,y]);
        if(painted===KW && walkable(x,y) && at(x,y)!==BRIDGE && at(x,y)!==DOCK) walkableWater.push([x,y]);
      }
      return {blockedDirt:blockedDirt,walkableWater:walkableWater};
    }
  };
`;
const instrumented = source.replace(/\}\)\(\);\s*$/, hook + '\n})();');
const server = await serve(8462), browser = await chromium.launch();
const report = { when: new Date().toISOString(), scenes: [] };
try {
  for (const [name, viewport, hour, mobile] of [
    ['desktop-night', {width:1366,height:900},21,false],
    ['phone-day', {width:390,height:844},11,true],
    ['phone-landscape', {width:844,height:390},11,true]
  ]) {
    const context = await browser.newContext({viewport, hasTouch:mobile, isMobile:mobile, deviceScaleFactor:mobile?2:1});
    await context.route('**/js/world.js*', r => r.fulfill({contentType:'application/javascript',body:instrumented}));
    const page = await context.newPage(), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://localhost:8462/?debug=1&islandhour='+hour+'#island');
    await page.waitForFunction(()=>window.__island?.getState().open);
    await page.waitForTimeout(2600);
    if(await page.locator('.w-card-go [data-a="play"]').isVisible()) await page.locator('.w-card-go [data-a="play"]').click();
    for(const [place,x,y] of [['village',46,60],['garden',69,46],['clearing',48,43]]) {
      await page.evaluate(([x,y])=>window.__island.teleport(x*16+8,y*16+8),[x,y]);
      await page.waitForTimeout(900);
      // The debug overlay is excluded from screenshots, but still measured below.
      await page.locator('.w-debug').evaluate(e=>e.hidden=true);
      await page.screenshot({path:out+name+'-'+place+'.png'});
    }
    const state=await page.evaluate(()=>window.__review.state());
    const geometry=await page.evaluate(()=>window.__review.geometry());
    const frames=await page.evaluate(()=>window.__island.frames(true));
    frames.sort((a,b)=>a-b);
    await page.keyboard.press('p');
    await page.screenshot({path:out+name+'-menu.png'});
    report.scenes.push({name,state,geometry,p95WorkMs:frames[Math.floor(frames.length*.95)],errors});
    await context.close();
  }
  const context=await browser.newContext({reducedMotion:'reduce'});
  await context.route('**/js/world.js*',r=>r.fulfill({contentType:'application/javascript',body:instrumented}));
  await context.addInitScript(()=>localStorage.setItem('island-save',JSON.stringify({v:1,logs:['rack','desk','uplink','tower','lighthouse','macbook','tablet','mailbox'],hatched:true,seal:true})));
  const page=await context.newPage();
  await page.goto('http://localhost:8462/?debug=1#island');
  await page.waitForTimeout(4000);
  report.reducedMotionAllLogs={state:await page.evaluate(()=>window.__review.state()),confirmationVisible:await page.locator('.w-dialog').isVisible()};
  await context.close();
} finally { await browser.close();server.close();writeFileSync(out+'island.json',JSON.stringify(report,null,2)); }
console.log(JSON.stringify(report,null,2));
