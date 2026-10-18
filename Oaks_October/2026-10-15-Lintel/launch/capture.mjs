// Capture an isolated synthetic browser session. No user profile, cookies or credentials.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const output=process.argv[2]||'/workspace/media/lintel';await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:960,height:540},deviceScaleFactor:4,reducedMotion:'reduce'});
const page=await context.newPage();await page.goto(process.env.LINTEL_CAPTURE_URL||'https://lintel-20261015.vercel.app');await page.locator('.evidence-table').waitFor();await page.evaluate(()=>document.fonts.ready);
await page.locator('.blueprint').scrollIntoViewIfNeeded();await page.screenshot({path:output+'/opening.png'});
// Reproducible lossless native screenshots of actual workflow states, before film assembly.
await page.getByRole('button',{name:'Investigate this dossier'}).click();await page.locator('.agent-report').waitFor();await page.locator('.trace').nth(1).locator('details').evaluate(e=>e.open=true);await page.locator('.trace').nth(1).scrollIntoViewIfNeeded();await page.screenshot({path:output+'/investigation.png'});
await page.getByLabel('Human review note').fill('Checked the synthetic source versions and deadline calculation.');await page.getByRole('button',{name:'Accept findings'}).click();await page.getByRole('button',{name:'Accept findings'}).waitFor({state:'hidden'});await page.screenshot({path:output+'/reviewed-investigation.png'});
await page.getByRole('button',{name:'Drawing desk',exact:true}).click();
for(const title of ['Flood elevation certificate','Structural drawings','Energy compliance worksheet','Owner authorization']){await page.getByLabel('Change '+title+' state').selectOption('valid');await page.getByLabel('Change '+title+' state').waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('.spinner'));}
await page.locator('.alternatives article button').first().click();await page.getByLabel('Review note',{exact:true}).fill('Verified all synthetic references and resolved the owner conflict.');await page.getByRole('button',{name:'Approve exact proposal'}).click();await page.getByRole('button',{name:'Prepare dossier',exact:true}).waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('button.primary[disabled]'));await page.getByRole('button',{name:'Prepare dossier',exact:true}).click();await page.locator('.prepared').waitFor();await page.locator('.review-panel').scrollIntoViewIfNeeded();await page.screenshot({path:output+'/prepared.png'});
await writeFile(output+'/capture-provenance.json',JSON.stringify({viewport:{width:960,height:540},deviceScaleFactor:4,pixelDimensions:{width:3840,height:2160},source:process.env.LINTEL_CAPTURE_URL||'https://lintel-20261015.vercel.app',synthetic:true,method:'Actual isolated browser workflow, native 4x screenshots; not yet a recorded motion master.',verifiedFlows:['real tool investigation','human review','evidence changes','proposal approval','dossier preparation']},null,2));await browser.close();
