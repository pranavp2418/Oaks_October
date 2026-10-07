const host=document.querySelector('#gem-puzzle');
if(host){
 const features=[
 ['Customer intake','Capture a structured brief before design work begins.','Give the jeweler a clear starting point for the customer’s idea.','INTAKE',[[511,216],[226,513],[637,366]]],
 ['AI-assisted design','Turn a customer brief into visual design directions using OpenAI and Gemini integrations.','Explore a direction before committing to a final design.','DESIGN',[[511,214],[729,214],[858,350],[640,363]]],
 ['Quotations','Bring custom-jewelry quotations into the same workflow as the design and order.','Connect a design decision to the customer’s quote.','QUOTES',[[230,514],[633,374],[476,555]]],
 ['Customer approvals','Keep customer decisions connected to the order and its next step.','Move an approved direction forward with a clear decision.','APPROVALS',[[645,371],[853,356],[757,500]]],
 ['Manufacturer handoff','Carry approved designs and order details into the manufacturing handoff.','Give the next person in the process the context they need.','HANDOFF',[[869,362],[1022,506],[766,501]]],
 ['Output guardrails','Structured-output guardrails help make AI-assisted workflows more reliable.','Keep generated responses usable by the application.','GUARDRAILS',[[640,377],[752,503],[485,550]]],
 ['Customer records','Keep customer details connected to requests and their workflow.','Find the context behind a custom order.','CUSTOMERS',[[232,522],[471,562],[277,648]]],
 ['Request tracking','Organize custom-jewelry requests as they progress through the pipeline.','See which orders need attention next.','REQUESTS',[[283,652],[470,571],[353,716]]],
 ['Render management','Keep design renders within the order’s review and decision process.','Bring the visual direction into the approval conversation.','RENDERS',[[487,560],[749,514],[599,666]]],
 ['Prompt routing','Route AI requests to the appropriate workflow and model integration.','Give different product tasks a purposeful generation path.','AI ROUTING',[[477,566],[648,721],[492,879],[360,727]]],
 ['Product feedback','Production feedback becomes workflow fixes and product improvements.','Refine the experience with what real customers actually need.','FEEDBACK',[[654,731],[786,860],[625,1024],[497,888]]]
 ];
 const ns='http://www.w3.org/2000/svg';const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','80 125 1095 1000');svg.setAttribute('aria-label','CraftsmanAI interactive gemstone. Eleven feature tiles.');svg.classList.add('gem-svg');
 let defs='<defs><mask id="gem-border"><rect width="1254" height="1254" fill="white"/>';
 features.forEach(f=>defs+=`<polygon points="${f[4].map(p=>p.join(',')).join(' ')}" fill="black" stroke="black" stroke-width="7"/>`);defs+='</mask>';
 features.forEach((f,i)=>defs+=`<clipPath id="facet-clip-${i}"><polygon points="${f[4].map(p=>p.join(',')).join(' ')}"/></clipPath>`);defs+='</defs><image href="/assets/craftsmanai-icon.png" width="1254" height="1254" mask="url(#gem-border)" pointer-events="none"/>';
 svg.innerHTML=defs;host.append(svg);
 let selected=0,arrange=false,drag=null;const positions=features.map(()=>({x:0,y:0}));
 const tiles=features.map((f,i)=>{
  const g=document.createElementNS(ns,'g');g.classList.add('gem-tile');g.setAttribute('tabindex','0');g.setAttribute('role','button');g.setAttribute('aria-label',`Facet ${i+1}: ${f[0]}. Flip to learn more.`);g.setAttribute('aria-pressed','false');g.dataset.facet=i;
  const points=f[4].map(p=>p.join(',')).join(' '),cx=f[4].reduce((a,p)=>a+p[0],0)/f[4].length,cy=f[4].reduce((a,p)=>a+p[1],0)/f[4].length;
  g.innerHTML=`<g class="facet-inner" style="transform-origin:${cx}px ${cy}px"><image class="facet-front" href="/assets/craftsmanai-icon.png" width="1254" height="1254" clip-path="url(#facet-clip-${i})"/><g class="facet-back"><polygon points="${points}" fill="#112b4b" stroke="#d9c482" stroke-width="4"/><text x="${cx}" y="${cy-5}" text-anchor="middle" fill="#b9d9ff" font-size="25" font-family="DM Sans">${String(i+1).padStart(2,'0')}</text><text x="${cx}" y="${cy+21}" text-anchor="middle" fill="white" font-size="15" font-family="DM Sans">${f[3]}</text></g><polygon class="facet-outline" points="${points}" fill="transparent" stroke="transparent" stroke-width="6"/></g>`;
  svg.append(g);
  function choose(){selected=i;renderInfo(i);tiles.forEach((t,j)=>t.classList.toggle('selected',i===j))}
  function flip(){choose();const on=g.classList.toggle('flipped');g.setAttribute('aria-pressed',String(on));g.classList.remove('flipping');void g.getBoundingClientRect();g.classList.add('flipping')}
  g.addEventListener('click',e=>{if(g.dataset.dragged==='true'){g.dataset.dragged='false';return}if(arrange)choose();else flip()});
  g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();flip()}else if(arrange&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();choose();const amount=e.shiftKey?25:10;move(i,positions[i].x+(e.key==='ArrowRight'?amount:e.key==='ArrowLeft'?-amount:0),positions[i].y+(e.key==='ArrowDown'?amount:e.key==='ArrowUp'?-amount:0))}});
  g.addEventListener('pointerdown',e=>{if(!arrange)return;e.preventDefault();choose();const pt=toSVG(e);drag={i,start:pt,origin:{...positions[i]},moved:false};svg.append(g);g.focus({preventScroll:true});g.setPointerCapture(e.pointerId)});
  g.addEventListener('pointermove',e=>{if(!drag||drag.i!==i)return;const p=toSVG(e);if(Math.hypot(p.x-drag.start.x,p.y-drag.start.y)>5)drag.moved=true;move(i,drag.origin.x+p.x-drag.start.x,drag.origin.y+p.y-drag.start.y)});
  g.addEventListener('pointerup',()=>{if(drag){g.dataset.dragged=String(drag.moved);drag=null}});g.addEventListener('pointercancel',()=>{drag=null});
  g.flip=flip;return g;
 });
 function toSVG(e){const p=new DOMPoint(e.clientX,e.clientY);return p.matrixTransform(svg.getScreenCTM().inverse())}
 const boundary=[[454,204],[797,204],[1093,523],[627,1055],[155,524]];
 function inside(p){let ok=true;for(let i=0;i<boundary.length;i++){const a=boundary[i],b=boundary[(i+1)%boundary.length];if((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])<-1)ok=false}return ok}
 function move(i,x,y){if(features[i][4].every(p=>inside([p[0]+x,p[1]+y]))){positions[i]={x,y};tiles[i].setAttribute('transform',`translate(${x} ${y})`);document.querySelector('#puzzle-status').textContent=`${features[i][0]} tile moved.`}}
 function renderInfo(i){const f=features[i];document.querySelector('#facet-number').textContent=`${String(i+1).padStart(2,'0')} / 11 FACETS`;document.querySelector('#facet-title').textContent=f[0];document.querySelector('#facet-copy').textContent=f[1];document.querySelector('#facet-usecase').textContent=f[2]}
 document.querySelector('#arrange-mode').addEventListener('click',e=>{arrange=!arrange;e.currentTarget.setAttribute('aria-pressed',String(arrange));e.currentTarget.textContent=arrange?'Done arranging':'Arrange tiles';host.classList.toggle('arranging',arrange);document.querySelector('#puzzle-help').textContent=arrange?'Drag tiles within the frame. Keyboard: select a tile, then use arrow keys. Shift moves faster.':'Select with Tab. Flip with Enter or Space.'});
 document.querySelector('#reset-puzzle').addEventListener('click',()=>{tiles.forEach((t,i)=>{positions[i]={x:0,y:0};t.removeAttribute('transform');t.classList.remove('flipped','flipping','selected');t.setAttribute('aria-pressed','false')});selected=0;renderInfo(0);document.querySelector('#puzzle-status').textContent='Original CraftsmanAI shape restored.'});
 document.querySelector('#flip-selected').addEventListener('click',()=>tiles[selected].flip());
}
