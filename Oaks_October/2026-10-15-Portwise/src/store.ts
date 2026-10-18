import {DatabaseSync} from 'node:sqlite';import {createHash} from 'node:crypto';import {repair,replay,validate,Case,Value} from './core.js';
export const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
type State={revision:number;connector:Case;phase:string;proposal:null|{baseHash:string;patch:{field:string;before:Value;after:Value}[];hash:string;reviewed:boolean};applied:null|Case;history:unknown[]};
export class CaseStore{
 db:DatabaseSync;
 constructor(path:string){this.db=new DatabaseSync(path);this.db.exec('PRAGMA journal_mode=WAL;PRAGMA synchronous=FULL;CREATE TABLE IF NOT EXISTS cases(id TEXT PRIMARY KEY,revision INTEGER NOT NULL,body TEXT NOT NULL);CREATE TABLE IF NOT EXISTS ops(case_id TEXT NOT NULL,key TEXT NOT NULL,request_hash TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(case_id,key));CREATE TABLE IF NOT EXISTS journal(case_id TEXT NOT NULL,sequence INTEGER NOT NULL,previous TEXT NOT NULL,hash TEXT NOT NULL,body TEXT NOT NULL,PRIMARY KEY(case_id,sequence));');}
 close(){this.db.close();}
 load(id:string):State{const row=this.db.prepare('SELECT body FROM cases WHERE id=?').get(id) as {body:string}|undefined;if(!row)throw Error('Unknown case');return JSON.parse(row.body);}
 act(id:string,key:string,expected:number|null,command:Record<string,unknown>,role='operator'){
  if(!/^[A-Za-z0-9_.-]{1,80}$/.test(id)||!/^[A-Za-z0-9_.-]{1,100}$/.test(key)||!['operator','reviewer'].includes(role))throw Error('Invalid operation identity');const requestHash=hash({expected,command,role});this.db.exec('BEGIN IMMEDIATE');
  try{const previous=this.db.prepare('SELECT request_hash,result FROM ops WHERE case_id=? AND key=?').get(id,key) as {request_hash:string;result:string}|undefined;if(previous){if(previous.request_hash!==requestHash)throw Error('Idempotency payload conflict');this.db.exec('COMMIT');return JSON.parse(previous.result);}
   let state:State;
   if(command.kind==='import'){if(expected!==null||this.db.prepare('SELECT id FROM cases WHERE id=?').get(id))throw Error('Case already exists');state={revision:0,connector:validate(command.connector),phase:'diagnosing',proposal:null,applied:null,history:[]};}
   else{state=this.load(id);if(state.revision!==expected)throw Error('Stale case revision');
    switch(command.kind){
     case 'propose':{const solution=repair(state.connector);if(!solution.feasible)throw Error('No authorized feasible repair');const proposal={baseHash:hash(state.connector),patch:solution.patch,reviewed:false};state.proposal={...proposal,hash:hash(proposal)};state.phase='proposed';break;}
     case 'review':{if(role!=='reviewer'||!state.proposal||state.proposal.hash!==command.proposalHash)throw Error('Exact proposal reviewer action required');if(!['approve','reject'].includes(String(command.decision))||typeof command.note!=='string'||!command.note.trim()||command.note.length>1000)throw Error('Review decision and note required');state.proposal.reviewed=command.decision==='approve';state.phase=state.proposal.reviewed?'reviewed':'rejected';break;}
     case 'stage':{if(!state.proposal?.reviewed||state.proposal.hash!==command.proposalHash||hash(state.connector)!==state.proposal.baseHash)throw Error('Reviewed current proposal required');const r=replay(state.connector,state.proposal.patch);if(!r.passed)throw Error('Replay regression rejected');state.phase='staged';break;}
     case 'apply':{if(role!=='reviewer'||state.phase!=='staged'||!state.proposal||state.proposal.hash!==command.proposalHash)throw Error('Staged exact proposal reviewer action required');const original=structuredClone(state.connector);const result=replay(state.connector,state.proposal.patch);if(!result.passed)throw Error('Replay failed');state.applied=original;for(const field of state.connector.fields)field.value=result.values[field.name];state.phase='applied';state.proposal=null;break;}
     case 'rollback':{if(role!=='reviewer'||state.phase!=='applied'||!state.applied)throw Error('No applied repair to roll back');state.connector=state.applied;state.applied=null;state.proposal=null;state.phase='rolled_back';break;}
     default:throw Error('Unknown case action');
    }state.revision++;
   }
   const head=this.db.prepare('SELECT sequence,hash FROM journal WHERE case_id=? ORDER BY sequence DESC LIMIT 1').get(id) as {sequence:number;hash:string}|undefined;
   const event={sequence:(head?.sequence??0)+1,revision:state.revision,command,role,stateHash:hash(state)},previousHash=head?.hash??'0'.repeat(64),receipt=hash({previous:previousHash,event});const result={state,receipt};
   this.db.prepare('INSERT INTO cases VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,body=excluded.body').run(id,state.revision,JSON.stringify(state));this.db.prepare('INSERT INTO journal VALUES(?,?,?,?,?)').run(id,event.sequence,previousHash,receipt,JSON.stringify(event));this.db.prepare('INSERT INTO ops VALUES(?,?,?,?)').run(id,key,requestHash,JSON.stringify(result));this.db.exec('COMMIT');return result;
  }catch(error){this.db.exec('ROLLBACK');throw error;}
 }
 export(id:string){const state=this.load(id);const events=this.db.prepare('SELECT previous,hash,body FROM journal WHERE case_id=? ORDER BY sequence').all(id) as {previous:string;hash:string;body:string}[];let previous='0'.repeat(64);for(const [i,row]of events.entries()){const event=JSON.parse(row.body);if(row.previous!==previous||event.sequence!==i+1||hash({previous,event})!==row.hash)throw Error('Case journal corruption');previous=row.hash;}if(!events.length||JSON.parse(events.at(-1)!.body).stateHash!==hash(state))throw Error('Case state/journal mismatch');return {state,events:events.map(e=>({...e,body:JSON.parse(e.body)})),head:previous,solution:repair(state.connector)};}
}
