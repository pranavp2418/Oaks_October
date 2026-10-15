export function openStore(name = "wirewake-single-user-v1") {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(name, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("snapshots");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export function read(db) {
  return new Promise((resolve, reject) => {
    const r = db
      .transaction("snapshots")
      .objectStore("snapshots")
      .get("current");
    r.onsuccess = () => resolve(r.result ?? { revision: 0, workspace: null });
    r.onerror = () => reject(r.error);
  });
}
export function save(db, expected, workspace) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("snapshots", "readwrite"),
      store = tx.objectStore("snapshots"),
      r = store.get("current");
    let value, error;
    r.onsuccess = () => {
      const old = r.result ?? { revision: 0 };
      if (old.revision !== expected) {
        error = Error(
          "A newer tab saved this workspace. Reopen before retrying; result was not saved.",
        );
        tx.abort();
        return;
      }
      value = { revision: expected + 1, workspace };
      store.put(value, "current");
    };
    tx.oncomplete = () => resolve(value);
    tx.onabort = () => reject(error ?? tx.error);
    tx.onerror = () => reject(error ?? tx.error);
  });
}
