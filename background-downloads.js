const pendingFileNames = [];
const pendingDownloadCaptures = [];

function now() {
  return Date.now();
}

function normalizeFileName(fileName) {
  return String(fileName || "")
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    .trim();
}

function cleanupExpiredCaptures() {
  const current = now();
  for (let i = pendingDownloadCaptures.length - 1; i >= 0; i--) {
    const item = pendingDownloadCaptures[i];
    if (current > item.expireAt) {
      pendingDownloadCaptures.splice(i, 1);
      item.sendResponse({
        success: false,
        message: "Timeout menunggu download dibuat oleh Chrome."
      });
    }
  }

  for (let i = pendingFileNames.length - 1; i >= 0; i--) {
    if (current > pendingFileNames[i].expireAt) {
      pendingFileNames.splice(i, 1);
    }
  }
}

function cleanupDownloadedFile(downloadId, attempt = 1, sendResponse = null) {
  chrome.downloads.search({ id: downloadId }, (items) => {
    if (chrome.runtime.lastError) {
      if (sendResponse) sendResponse({ success: false, message: chrome.runtime.lastError.message });
      return;
    }

    const item = items && items[0];
    if (!item) {
      if (sendResponse) sendResponse({ success: false, message: "Download tidak ditemukan." });
      return;
    }

    if (item.state !== "complete" && attempt < 20) {
      setTimeout(() => cleanupDownloadedFile(downloadId, attempt + 1, sendResponse), 1000);
      return;
    }

    if (item.state !== "complete") {
      if (sendResponse) sendResponse({ success: false, message: "File belum selesai diunduh, tidak bisa dihapus." });
      return;
    }

    chrome.downloads.removeFile(downloadId, () => {
      const removeError = chrome.runtime.lastError;

      chrome.downloads.erase({ id: downloadId }, () => {
        if (sendResponse) {
          if (removeError) {
            sendResponse({ success: false, message: removeError.message });
          } else {
            sendResponse({ success: true });
          }
        }
      });
    });
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "queueDownloadFileName") {
    if (request.filename) {
      pendingFileNames.push({
        filename: request.filename,
        expireAt: now() + (request.timeoutMs || 30000)
      });
      console.log("Nama file masuk antrian:", request.filename);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, message: "Filename kosong." });
    }
    return true;
  }

  if (request.action === "prepareDownloadCapture") {
    pendingDownloadCaptures.push({
      expectedFileName: request.expectedFileName || "",
      startedAt: now(),
      expireAt: now() + (request.timeoutMs || 15000),
      sendResponse
    });

    setTimeout(cleanupExpiredCaptures, request.timeoutMs || 15000);
    return true;
  }

  if (request.action === "cleanupDownloadedFile") {
    if (!request.downloadId) {
      sendResponse({ success: false, message: "downloadId kosong." });
      return true;
    }

    cleanupDownloadedFile(request.downloadId, 1, sendResponse);
    return true;
  }
});

chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
  cleanupExpiredCaptures();

  if (pendingFileNames.length === 0) {
    suggest();
    return;
  }

  const queuedFile = pendingFileNames.shift();
  const customFileName = queuedFile.filename;

  suggest({
    filename: customFileName,
    conflictAction: "uniquify"
  });

  console.log("Download diganti nama menjadi:", customFileName);
});

chrome.downloads.onCreated.addListener((downloadItem) => {
  cleanupExpiredCaptures();

  if (pendingDownloadCaptures.length === 0) {
    return;
  }

  let captureIndex = 0;
  const downloadFileName = normalizeFileName(downloadItem.filename);

  if (downloadFileName) {
    const matchingIndex = pendingDownloadCaptures.findIndex((item) =>
      normalizeFileName(item.expectedFileName) === downloadFileName
    );
    if (matchingIndex >= 0) captureIndex = matchingIndex;
    if (matchingIndex < 0) return;
  }

  const capture = pendingDownloadCaptures.splice(captureIndex, 1)[0];

  capture.sendResponse({
    success: true,
    downloadId: downloadItem.id,
    url: downloadItem.url || "",
    finalUrl: downloadItem.finalUrl || "",
    filename: downloadItem.filename || "",
    mime: downloadItem.mime || ""
  });

  console.log("Download terdeteksi untuk ekstraksi:", {
    id: downloadItem.id,
    url: downloadItem.url,
    finalUrl: downloadItem.finalUrl,
    filename: downloadItem.filename,
    mime: downloadItem.mime
  });
});
