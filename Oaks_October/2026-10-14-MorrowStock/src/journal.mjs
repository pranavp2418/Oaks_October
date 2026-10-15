export const empty = () => ({
  revision: 0,
  workspace: { schema: 1, journal: [] },
});
export function validateRecord(record) {
  if (
    !record ||
    !Number.isSafeInteger(record.revision) ||
    record.revision < 0 ||
    record.workspace?.schema !== 1 ||
    !Array.isArray(record.workspace.journal)
  )
    throw Error("Invalid local workspace envelope.");
  return record;
}
export function replace(current, expected, workspace) {
  validateRecord(current);
  if (current.revision !== expected)
    throw Error(
      "Another tab changed this workspace. Reload before retrying; this response was not saved.",
    );
  if (workspace?.schema !== 1 || !Array.isArray(workspace.journal))
    throw Error("Server returned an invalid workspace.");
  return { revision: current.revision + 1, workspace };
}
export function openStore(name = "morrowstock-v1") {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(name, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("records");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export function read(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("records"),
      r = tx.objectStore("records").get("workspace");
    r.onsuccess = () => {
      try {
        resolve(validateRecord(r.result ?? empty()));
      } catch (e) {
        reject(e);
      }
    };
    r.onerror = () => reject(r.error);
  });
}
export function save(db, expected, workspace) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("records", "readwrite"),
      s = tx.objectStore("records"),
      r = s.get("workspace");
    let next, failure;
    r.onsuccess = () => {
      try {
        next = replace(r.result ?? empty(), expected, workspace);
        s.put(next, "workspace");
      } catch (e) {
        failure = e;
        tx.abort();
      }
    };
    tx.oncomplete = () => resolve(next);
    tx.onerror = () => reject(failure ?? tx.error);
    tx.onabort = () => reject(failure ?? tx.error ?? Error("Save aborted."));
  });
}
