import { openStore, read, save } from './journal.mjs';
const style = document.createElement('style');
style.textContent = 'body{margin:24px;background:#f5f2e8;color:#252b1b;font:16px system-ui}main{max-width:1200px;margin:auto}button{padding:12px;margin:4px;border:2px solid #4c6029;background:white;color:#252b1b;cursor:pointer}button:focus-visible{outline:3px solid #a73a28;outline-offset:3px}pre{white-space:pre-wrap;overflow-wrap:anywhere;min-height:100px}iframe{max-width:100%;border:2px solid #4c6029;display:block;background:#f5f2e8}';
document.head.append(style);
const result = document.querySelector('#result');
const frame = document.querySelector('#product');
document.querySelector('#mobile').onclick = () => frame.width = '390';
document.querySelector('#desktop').onclick = () => frame.width = '1150';
document.querySelector('#storage').onclick = async () => {
  const connections = [];
  const name = 'morrowstock-verification-' + crypto.randomUUID();
  try {
    result.textContent = 'Running real IndexedDB race…';
    for (let i = 0; i < 8; i++) connections.push(await openStore(name));
    const workspace = { schema: 1, journal: [] };
    const races = await Promise.allSettled(connections.map(db => save(db, 0, workspace)));
    const successes = races.filter(x => x.status === 'fulfilled').length;
    const conflicts = races.filter(x => x.status === 'rejected' && x.reason.message.startsWith('Another tab')).length;
    connections.forEach(db => db.close()); connections.length = 0;
    const reopened = await openStore(name); connections.push(reopened);
    const stored = await read(reopened);
    if (successes !== 1 || conflicts !== 7 || stored.revision !== 1) throw Error('CAS invariant failed');
    result.textContent = JSON.stringify({ passed: true, writers: 8, successes, conflicts, reopened_revision: stored.revision, isolation: name, scope: 'separate verification DB; product data untouched' }, null, 2);
  } catch (e) { result.textContent = JSON.stringify({passed:false,error:e.message}); }
  finally { connections.forEach(db => db.close()); indexedDB.deleteDatabase(name); }
};
document.querySelector('#frames').onclick = () => {
  if (document.visibilityState !== 'visible') { result.textContent = 'Not measured: page hidden'; return; }
  result.textContent = 'Measuring 120 frame intervals. Keep the page visible.';
  const intervals = []; let last; let interrupted = false;
  const onVisibility = () => { if (document.visibilityState !== 'visible') interrupted = true; };
  document.addEventListener('visibilitychange', onVisibility);
  function tick(t) {
    if (interrupted || document.visibilityState !== 'visible') {
      document.removeEventListener('visibilitychange', onVisibility);
      result.textContent = 'Not measured: visibility changed during sampling. Keep the tab visible and start a fresh measurement.';
      return;
    }
    if (last !== undefined) intervals.push(t - last);
    last = t;
    if (intervals.length < 120) requestAnimationFrame(tick);
    else {
      document.removeEventListener('visibilitychange', onVisibility);
      intervals.sort((a,b) => a-b);
      result.textContent = JSON.stringify({samples:120,frame_interval_p50_ms:intervals[59],frame_interval_p95_ms:intervals[113],max_ms:intervals[119],user_agent:navigator.userAgent,scope:'Visible steady-state browser/frame wrapper; not input latency, physical mobile or production load'},null,2);
    }
  }
  requestAnimationFrame(tick);
};
