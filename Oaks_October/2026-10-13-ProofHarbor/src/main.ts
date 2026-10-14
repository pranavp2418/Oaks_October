import {Component, signal, OnDestroy} from '@angular/core';
import {bootstrapApplication} from '@angular/platform-browser';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import sample from '../data/sample.json';
import {openStore,readJournal,saveJournal} from './storage';

@Component({
 selector:'app-root',standalone:true,imports:[CommonModule,FormsModule],
 template:`
 <div class="app-shell">
  <header><a class="brand" href="#"><span class="logo">P<span>H</span></span><strong>ProofHarbor</strong></a><span class="header-label">INCIDENT INVESTIGATION / ORIGINAL SYNTHETIC DEMO</span><span class="workspace-badge"><i></i>LOCAL JOURNAL <b>r{{state()?.revision??0}}</b></span></header>
  <div class="workspace-layout">
   <aside class="rail">
    <div class="rail-title"><span>01 / SOURCE MATERIAL</span><b>{{state()?.documents?.length??0}}</b></div>
    <p class="rail-intro">Evidence stays visible. Conclusions must earn their citations.</p>
    <button class="primary import" [disabled]="busy()" (click)="loadSample()">Import synthetic evidence</button>
    <nav class="source-list" aria-label="Evidence sources">
     @for(doc of state()?.documents??[];track doc.id){<button [class.selected]="selectedDoc()?.id===doc.id" (click)="selectedDoc.set(doc);tab.set('Evidence')"><span>{{doc.id}}</span><strong>{{doc.title}}</strong><small>{{doc.entities.join(' · ')}}</small></button>}
     @if(!state()?.documents?.length){<div class="source-empty">Start with the sample or import your own bounded JSON evidence.</div>}
    </nav>
    <div class="rail-boundary"><b>THE BOUNDARY</b><p>Single-user journal in this browser. Real Python retrieval and SQLite checkpoints are reconstructed on each request. No shared database or model API.</p><button class="text-button" [disabled]="busy()" (click)="reopen()">Reopen saved workspace</button></div>
   </aside>
   <main>
    <div class="heading"><div><p class="eyebrow">EVIDENCE BEFORE CONCLUSIONS</p><h1>Trace the facts.<br><em>Keep the doubt.</em></h1></div><div class="method-note"><b>LEXICAL + GRAPH RETRIEVAL</b><p>Inspect source paths, expose conflicting claims, and review a recoverable dossier. Publishing never executes a mitigation.</p></div></div>
    <div class="feedback" [class.error]="error()" role="status" aria-live="polite">@if(busy()){<span class="spinner"></span>}{{message()}}</div>
    <nav class="tabs" aria-label="Workbench sections">@for(name of ['Investigate','Evidence','Review','Trace'];track name){<button [class.active]="tab()===name" (click)="tab.set(name)">{{name}}</button>}</nav>
    @if(tab()==='Investigate'){
     <section class="panel-enter query-panel"><div><small>02 / FRAME THE QUESTION</small><h2>What needs explaining?</h2><p>Retrieval finds related observations. It does not infer the root cause.</p></div><label>Investigation question<input [(ngModel)]="query" maxlength="240" placeholder="e.g. gateway release routing"></label><div class="query-actions"><button class="primary" [disabled]="busy()||!state()?.documents?.length" (click)="investigate(false)">Investigate evidence <span>↗</span></button><button [disabled]="busy()||!state()?.documents?.length" (click)="investigate(true)">Inject retrieval failure</button></div></section>
     <section class="recent panel-enter"><div class="section-title"><h2>Investigation desk</h2><span>{{state()?.runs?.length??0}} DOSSIERS</span></div>
      @for(run of state()?.runs??[];track run.id){<article class="run-row"><div class="run-marker">{{run.status==='published'?'✓':'↗'}}</div><div class="run-description"><small>{{run.id}}</small><h3>{{run.query}}</h3><p>{{run.dossier?.sentences?.length??0}} citations · {{run.dossier?.contradictions?.length??0}} unresolved contradictions</p></div><div class="run-actions"><span class="status-pill" [class.published]="run.status==='published'">{{label(run.status)}}</span>@if(run.status==='failed'){<button [disabled]="busy()" (click)="retry(run)">Resume checkpoint</button>}@else{<button (click)="selectedRun.set(run);tab.set('Review')">Open dossier</button>}</div></article>}
      @if(!state()?.runs?.length){<div class="desk-empty"><span>↗</span><h3>No conclusion without a trail.</h3><p>Import the evidence, ask about gateway routing, then follow the links from release to queue to worker.</p></div>}
     </section>
    }
    @if(tab()==='Evidence'){
     <section class="panel-enter evidence-layout"><div><small>INSPECT / IMPORT</small><h2>Sources, not instructions.</h2><p>Document text is treated as evidence. No text can trigger tools or external requests.</p><label class="file-input">Import evidence JSON<input type="file" accept=".json,application/json" (change)="readFile($event,'evidence')"></label><label class="file-input">Restore exported workspace<input type="file" accept=".json,application/json" (change)="readFile($event,'workspace')"></label><label>Evidence bundle<textarea [(ngModel)]="editor" spellcheck="false"></textarea></label><button class="primary" [disabled]="busy()" (click)="importEditor()">Save evidence bundle</button></div><article class="source-detail">@if(selectedDoc();as doc){<small>{{doc.id}}</small><h2>{{doc.title}}</h2><blockquote>{{doc.body}}</blockquote><dl><dt>Entities</dt><dd>{{doc.entities.join(', ')||'None'}}</dd><dt>Explicit links</dt><dd>{{doc.links.join(', ')||'None'}}</dd><dt>Supersedes</dt><dd>{{doc.supersedes||'None'}}</dd></dl>@if(doc.claim){<div class="claim"><b>CLAIM / {{doc.claim.key}}</b><p>{{doc.claim.value}}</p></div>}}@else{<p>Select a source from the rail to inspect its original text and links.</p>}</article></section>
    }
    @if(tab()==='Review'){
     <section class="panel-enter dossier">@if(selectedRun();as run){<div class="dossier-heading"><div><small>03 / CITATION-CHECKED DOSSIER</small><h2>{{run.query}}</h2></div><span class="status-pill">{{label(run.status)}}</span></div>
      @if(run.dossier){<div class="dossier-stats"><span><b>{{run.dossier.sentences.length}}</b> exact source quotations</span><span><b>{{run.dossier.excluded_superseded.length}}</b> superseded sources excluded</span><span><b>{{run.dossier.graph_edges}}</b> discovery edges</span></div>
       @if(run.dossier.contradictions.length){<section class="contradiction"><b>CONFLICTING OBSERVATIONS / KEEP OPEN</b>@for(conflict of run.dossier.contradictions;track conflict.key){<h3>{{conflict.key}}</h3>@for(source of conflict.sources;track source.id){<p><strong>{{source.id}}</strong> reports {{source.value}}</p>}}</section>}
       <div class="quotations">@for(hit of run.dossier.hits;track hit.id){<article><div><span class="citation">[{{hit.id}}]</span><small>{{hit.path.length===1?'LEXICAL MATCH':'GRAPH DISCOVERY'}}</small></div><h3>{{hit.title}}</h3><blockquote>{{hit.quote}}</blockquote><div class="path">@for(step of hit.path;track step.id){<span>{{step.id}}<small>{{step.via}}</small></span>}</div></article>}</div>
       @if(!run.dossier.publishable){<div class="no-evidence">No current evidence matched. Change the question or import supporting sources; this dossier cannot publish.</div>}
       @if(run.status==='awaiting_review'||run.status==='rejected'){
        <div class="review-controls"><div><small>04 / RECORDED HUMAN REVIEW</small><h3>Approve the evidence, not a guess.</h3><p>This is a local recorded review, not authenticated identity. A rejection retains the checkpoint for another review.</p></div><label>Reviewer identifier<input [(ngModel)]="reviewer" maxlength="64"></label><label>Review note<textarea [(ngModel)]="reviewNote" maxlength="500"></textarea></label><label class="check"><input type="checkbox" [(ngModel)]="acknowledge">I acknowledge that conflicting observations remain unresolved.</label><div class="query-actions"><button class="primary" [disabled]="busy()" (click)="review(run,'approve')">Approve & publish dossier</button><button [disabled]="busy()" (click)="review(run,'reject')">Return for review</button></div></div>
       }
       @if(run.status==='published'){<div class="published-note">✓ Dossier published with exact citations. Review: {{run.decision.reviewer}} — {{run.decision.note}}</div>}
       @if(run.status==='stale'){<div class="no-evidence">Evidence changed after this investigation. Start a new investigation before approving.</div>}
      }@else{<p>Retrieval was interrupted. Resume its checkpoint from the investigation desk.</p>}
      <button class="export" [disabled]="busy()" (click)="exportWorkspace()">Export portable workspace ↓</button><button class="export" [disabled]="busy()" (click)="exportWorkspace(true)">Export evidence dossier ↓</button>
     }@else{<div class="desk-empty"><h2>Select an investigation.</h2><button (click)="tab.set('Investigate')">Back to desk</button></div>}</section>
    }
    @if(tab()==='Trace'){
     <section class="panel-enter"><div class="section-title"><h2>Transitions you can inspect.</h2><button (click)="exportWorkspace()" [disabled]="busy()">Export workspace ↓</button></div><div class="trace-summary"><p>Last API reconstruction: <b>{{state()?.elapsed_ms??0}} ms</b> · {{state()?.audit?.length??0}} accepted operations. This browser's measurement is not a fleet benchmark.</p><p class="hash">Evidence SHA-256: {{state()?.digest??'Import evidence to establish a binding.'}}</p></div><div class="trace-list">@for(event of state()?.audit??[];track event.sequence){<article><b>{{event.sequence.toString().padStart(2,'0')}}</b><span><strong>{{event.operation}}</strong><small>{{event.id}}</small></span><code>{{event.hash}}</code></article>}</div>@if(!state()?.audit?.length){<p>No accepted operations yet.</p>}</section>
    }
    <footer><span>EXACT QUOTATIONS. EXPLICIT LIMITS.</span><a href="https://github.com/pranavp2418/Oaks_October/tree/main/Oaks_October/2026-10-13-ProofHarbor" target="_blank" rel="noreferrer">Source / architecture ↗</a></footer>
   </main>
  </div>
 </div>`
})
class App implements OnDestroy{
 state=signal<any>(null);selectedDoc=signal<any>(null);selectedRun=signal<any>(null);tab=signal('Investigate');busy=signal(true);error=signal(false);message=signal('Reconstructing the saved workspace…');
 query='gateway release routing';reviewer='operator-one';reviewNote='Exact citations checked; conflicting probes remain open.';acknowledge=false;editor=JSON.stringify(sample,null,2);
 db?:IDBDatabase;channel=new BroadcastChannel('proofharbor');
 constructor(){this.reopen();this.channel.onmessage=()=>{if(!this.busy())this.reopen();};}
 ngOnDestroy(){this.channel.close();this.db?.close();}
 label(value:string){return value.replaceAll('_',' ').toUpperCase();}
 async call(journal:any[],operation?:any){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
  try{const response=await fetch('/api/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({schema:1,journal,operation}),signal:controller.signal});const result=await response.json();if(!response.ok)throw Error(result.error??'API request failed.');return result;}finally{clearTimeout(timer);}
 }
 accept(result:any){this.state.set(result);const selected=this.selectedRun();if(selected)this.selectedRun.set(result.runs.find((r:any)=>r.id===selected.id)??null);const doc=this.selectedDoc();if(doc)this.selectedDoc.set(result.documents.find((d:any)=>d.id===doc.id)??null);}
 async reopen(){this.busy.set(true);try{this.db??=await openStore();const result=await this.call(await readJournal(this.db));this.accept(result);this.error.set(false);this.message.set('Workspace ready. Import evidence or continue a saved checkpoint.');}catch(e:any){this.error.set(true);this.message.set(e.message??'Workspace could not open.');}finally{this.busy.set(false);}}
 async act(type:string,extra:any){if(this.busy()||!this.db)return;this.busy.set(true);this.error.set(false);try{const journal=await readJournal(this.db),operation={id:crypto.randomUUID(),expected:this.state()?.revision??0,type,...extra};const result=await this.call(journal,operation);await saveJournal(this.db,journal,[...journal,operation]);this.accept(result);this.channel.postMessage(result.revision);this.message.set(`Saved ${type} at revision ${result.revision}.`);return result;}catch(e:any){this.error.set(true);this.message.set(e.name==='AbortError'?'API timed out. The saved journal is unchanged. Retry.':e.message);}finally{this.busy.set(false);}}
 loadSample(){this.editor=JSON.stringify(sample,null,2);this.act('import',{bundle:sample});}
 async importEditor(){try{const result=await this.act('import',{bundle:JSON.parse(this.editor)});if(result)this.selectedDoc.set(result.documents[0]);}catch(e:any){this.error.set(true);this.message.set('Invalid JSON: '+e.message);}}
 async investigate(fail:boolean){const result=await this.act('investigate',{query:this.query,fail});if(result){this.selectedRun.set(result.runs[0]);if(!fail)this.tab.set('Review');}}
 async retry(run:any){const result=await this.act('retry',{run:run.id});if(result){this.selectedRun.set(result.runs.find((r:any)=>r.id===run.id));this.tab.set('Review');}}
 review(run:any,action:string){return this.act('review',{run:run.id,action,reviewer:this.reviewer,note:this.reviewNote,acknowledge:this.acknowledge});}
 async exportWorkspace(dossier=false){if(!this.db)return;const journal=await readJournal(this.db),content=dossier?{schema:1,evidence:this.state(),mode:'Evidence dossier; restore using the separate portable workspace export'}:{schema:1,journal},blob=new Blob([JSON.stringify(content)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=dossier?'proofharbor-dossier.json':'proofharbor-workspace.json';a.click();URL.revokeObjectURL(url);this.message.set(dossier?'Evidence dossier exported.':'Compact replayable workspace exported.');}
 async readFile(event:Event,kind:string){const input=event.target as HTMLInputElement,file=input.files?.[0];if(!file||this.busy()||!this.db)return;try{if(file.size>131072)throw Error('Import exceeds 128 KiB.');const value=JSON.parse(await file.text());if(kind==='evidence'){this.editor=JSON.stringify(value,null,2);this.message.set('Evidence staged in the editor. Save it to apply.');}else{if(value.schema!==1||!Array.isArray(value.journal))throw Error('Workspace schema 1 and journal required.');this.busy.set(true);const previous=await readJournal(this.db),result=await this.call(value.journal);await saveJournal(this.db,previous,value.journal);this.accept(result);this.selectedRun.set(result.runs[0]??null);this.channel.postMessage(result.revision);this.message.set('Exported journal restored and checkpoints reconstructed.');this.error.set(false);}}catch(e:any){this.error.set(true);this.message.set(e.message);}finally{this.busy.set(false);input.value='';}}
}
bootstrapApplication(App).catch(error=>{document.body.textContent='ProofHarbor could not start. Reload the page.';console.error(error);});
