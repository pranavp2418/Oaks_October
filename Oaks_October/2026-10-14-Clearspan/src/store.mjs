export function openStore(name = "clearspan-single-user-v1") {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(name, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("workspaces");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export const blank = () => ({ revision: 0, workspace: null });
export function read(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("workspaces"),
      r = tx.objectStore("workspaces").get("active");
    r.onsuccess = () => resolve(r.result ?? blank());
    r.onerror = () => reject(r.error);
  });
}
export function save(db, expected, workspace) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("workspaces", "readwrite"),
      store = tx.objectStore("workspaces"),
      r = store.get("active");
    let next, error;
    r.onsuccess = () => {
      const current = r.result ?? blank();
      if (current.revision !== expected) {
        error = Error(
          "Another tab saved newer work. Reopen saved workspace before retrying.",
        );
        tx.abort();
        return;
      }
      next = { revision: expected + 1, workspace };
      store.put(next, "active");
    };
    tx.oncomplete = () => resolve(next);
    tx.onabort = () => reject(error ?? tx.error);
    tx.onerror = () => reject(error ?? tx.error);
  });
}
