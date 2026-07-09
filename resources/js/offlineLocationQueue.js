const DB_NAME = "flowdrop-location-queue";
const STORE_NAME = "locations";
const DB_VERSION = 1;
const LOCAL_STORAGE_KEY = "flowdrop.location.queue";

function openQueueDb() {
  if (!("indexedDB" in window)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

function localQueue() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveLocalQueue(records) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(records));
}

function riderApiId(rider) {
  return String(rider?._apiId || "");
}

export async function enqueueRiderLocation(rider, payload) {
  const record = {
    createdAt: new Date().toISOString(),
    payload,
    retryCount: 0,
    riderApiId: riderApiId(rider),
  };
  const db = await openQueueDb();

  if (!db) {
    const records = localQueue();
    records.push({ ...record, id: Date.now() + Math.random() });
    saveLocalQueue(records);
    return record;
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const request = transaction.objectStore(STORE_NAME).add(record);

    request.onsuccess = () => resolve({ ...record, id: request.result });
    request.onerror = () => reject(request.error);
  });
}

export async function getQueuedRiderLocations(rider) {
  const id = riderApiId(rider);
  const db = await openQueueDb();

  if (!db) {
    return localQueue().filter((record) => record.riderApiId === id);
  }

  return new Promise((resolve) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).getAll();

    request.onsuccess = () => resolve(request.result.filter((record) => record.riderApiId === id));
    request.onerror = () => resolve([]);
  });
}

export async function removeQueuedLocation(recordId) {
  const db = await openQueueDb();

  if (!db) {
    saveLocalQueue(localQueue().filter((record) => record.id !== recordId));
    return;
  }

  await new Promise((resolve) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const request = transaction.objectStore(STORE_NAME).delete(recordId);

    request.onsuccess = resolve;
    request.onerror = resolve;
  });
}

export async function bumpQueuedLocationRetry(record) {
  const updated = {
    ...record,
    lastRetryAt: new Date().toISOString(),
    retryCount: Number(record.retryCount || 0) + 1,
  };
  const db = await openQueueDb();

  if (!db) {
    saveLocalQueue(localQueue().map((item) => (item.id === record.id ? updated : item)));
    return updated;
  }

  await new Promise((resolve) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const request = transaction.objectStore(STORE_NAME).put(updated);

    request.onsuccess = resolve;
    request.onerror = resolve;
  });

  return updated;
}

export async function countQueuedRiderLocations(rider) {
  return (await getQueuedRiderLocations(rider)).length;
}
