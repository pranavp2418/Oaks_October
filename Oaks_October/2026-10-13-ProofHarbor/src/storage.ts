export function openStore(name='proofharbor-journal'):Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    const r=indexedDB.open(name,1);
    r.onupgradeneeded=()=>r.result.createObjectStore('journal');
    r.onsuccess=()=>resolve(r.result);
    r.onerror=()=>reject(r.error);
  });
}
export function readJournal(db:IDBDatabase):Promise<any[]>{
  return new Promise((resolve,reject)=>{
    const t=db.transaction('journal'),r=t.objectStore('journal').get('workspace');
    r.onsuccess=()=>resolve(r.result??[]);r.onerror=()=>reject(r.error);
  });
}
export function saveJournal(db:IDBDatabase,expected:any[],next:any[]):Promise<void>{
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('journal','readwrite'),store=tx.objectStore('journal');
    const r=store.get('workspace');let error:Error|undefined;
    r.onsuccess=()=>{
      if(JSON.stringify(r.result??[])!==JSON.stringify(expected)){error=Error('Another tab changed this workspace. Reopen before retrying.');tx.abort();return;}
      store.put(next,'workspace');
    };
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(error??tx.error);tx.onabort=()=>reject(error??tx.error);
  });
}
