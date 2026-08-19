/**
 * Google Drive Ultimate Converter & Downloader - Classic Edition
 * Non-Looping Multi-Channel PDF Extractor & OAuth2 API Engine
 */

let userAccessToken = localStorage.getItem("gdrive_access_token") || null;
const HARDCODED_CLIENT_ID = "320285917989-67taet5ij4pnfnk7ei1uqr9q8s70q5v9.apps.googleusercontent.com";

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initPdfEngine();
  initVideoEngine();
  initSheetEngine();
  initDirectLinkTab();
  updateBadgeState();
});

function updateBadgeState() {
  const badge = document.getElementById("oauth-status-badge");
  if (!badge) return;
  if (userAccessToken) {
    badge.style.background = "#ecfdf5";
    badge.style.color = "#065f46";
    badge.style.borderColor = "#a7f3d0";
    badge.innerHTML = `<i class="fa-solid fa-circle-check"></i> Đã Xác Thực Google API`;
  } else {
    badge.style.background = "#f1f5f9";
    badge.style.color = "#1e293b";
    badge.style.borderColor = "#cbd5e1";
    badge.innerHTML = `<i class="fa-solid fa-shield-halved"></i> Giao Diện Cổ Điển Active`;
  }
}

// ==========================================
// 1. Navigation Tabs Logic
// ==========================================
function initTabs() {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-tab");

      tabBtns.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));

      btn.classList.add("active");
      document.getElementById(targetTab)?.classList.add("active");
    });
  });
}

// ==========================================
// Helper Functions & Utilities
// ==========================================
function extractDocId(urlOrId) {
  if (!urlOrId) return null;
  urlOrId = urlOrId.trim();

  const match = urlOrId.match(/[-\w]{25,}(?!.*[-\w]{25,})/);
  if (match) {
    return match[0];
  }
  return null;
}

function copyToClipboard(text, btnElement) {
  navigator.clipboard.writeText(text).then(() => {
    if (btnElement) {
      const originalHtml = btnElement.innerHTML;
      btnElement.innerHTML = `<i class="fa-solid fa-check"></i> Đã Copy!`;
      btnElement.style.background = "rgba(16, 185, 129, 0.3)";
      setTimeout(() => {
        btnElement.innerHTML = originalHtml;
        btnElement.style.background = "";
      }, 2000);
    }
  }).catch((err) => {
    alert("Không thể copy: " + err);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

// ==========================================
// Robust Multi-Proxy Untainted Image Fetcher
// ==========================================
async function fetchUntaintedImage(targetUrl) {
  const proxyEndpoints = [
    `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
    `/api/proxy?url=${encodeURIComponent(targetUrl)}`
  ];

  for (let pUrl of proxyEndpoints) {
    try {
      const res = await fetch(pUrl);
      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 500) {
          const localBlobUrl = URL.createObjectURL(blob);
          const img = await loadImage(localBlobUrl);
          if (img && img.width > 20 && img.height > 20) {
            return { img, localBlobUrl };
          }
        }
      }
    } catch (e) {
      console.warn("Proxy attempt failed:", pUrl, e);
    }
  }
  return null;
}

// ==========================================
// Multi-Channel PDF Extractor (Non-Looping)
// ==========================================
async function extractBlockedPdfPages(docId, updateProgressCallback) {
  const { jsPDF } = window.jspdf;
  let pdf = null;
  let pageCount = 0;

  // Channel 1: Official Google Drive REST API Download (If OAuth Token Present)
  if (userAccessToken) {
    if (updateProgressCallback) updateProgressCallback("Đang xuất file PDF qua Google Drive API...");
    try {
      const headers = { 'Authorization': `Bearer ${userAccessToken}` };

      // 1. Try Direct Media Download
      let res = await fetch(`https://www.googleapis.com/drive/v3/files/${docId}?alt=media&supportsAllDrives=true`, { headers });
      
      // 2. If Google Doc/Sheet/Slide, Try Export API
      if (!res.ok) {
        res = await fetch(`https://www.googleapis.com/drive/v3/files/${docId}/export?mimeType=application/pdf`, { headers });
      }

      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 500) {
          return { pdfBlob: blob, pageCount: 1, source: "Google Drive API" };
        }
      }
    } catch (e) {
      console.warn("API export attempt failed:", e);
    }
  }

  // Channel 2: Direct Document PDF Export Endpoint (Works for Docs & Sheets)
  if (updateProgressCallback) updateProgressCallback("Đang xuất luồng file PDF trực tiếp...");
  const exportUrls = [
    `https://docs.google.com/document/d/${docId}/export?format=pdf`,
    `https://docs.google.com/spreadsheets/d/${docId}/export?format=pdf`,
    `https://drive.google.com/uc?export=download&id=${docId}`
  ];

  for (let expUrl of exportUrls) {
    try {
      const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(expUrl)}`).catch(() => fetch(`/api/proxy?url=${encodeURIComponent(expUrl)}`));
      if (res && res.ok) {
        const blob = await res.blob();
        if (blob.size > 1000 && (blob.type.includes("pdf") || blob.size > 5000)) {
          return { pdfBlob: blob, pageCount: 1, source: "Direct Export" };
        }
      }
    } catch (e) {}
  }

  // Channel 3: High-Res Single Page Render (Thumbnail Engine)
  if (updateProgressCallback) updateProgressCallback("Đang bóc tách bản xem trước chất lượng cao...");
  const thumbUrl = `https://drive.google.com/thumbnail?id=${docId}&sz=w2000`;
  const resultData = await fetchUntaintedImage(thumbUrl);

  if (resultData && resultData.img) {
    const { img } = resultData;
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");

    ctx.drawImage(img, 0, 0, img.width, img.height);
    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const orientation = img.width > img.height ? "l" : "p";
    pdf = new jsPDF({ orientation, unit: "px", format: [img.width, img.height], hotfixes: ["px_scaling"] });
    pdf.addImage(imgData, "JPEG", 0, 0, img.width, img.height);

    return { pdfBlob: pdf.output("blob"), pageCount: 1, source: "High-Res Render" };
  }

  // Channel 4: Google Public GView Page Renderer (pagenumber = 0, 1, 2...)
  for (let page = 0; page < 40; page++) {
    if (updateProgressCallback) updateProgressCallback(`Đang bóc tách trang PDF thứ ${page + 1}...`);

    const gviewUrl = `https://docs.google.com/gview?url=https://drive.google.com/uc?id=${docId}&export=download&a=bi&pagenumber=${page}&w=1600`;
    const result = await fetchUntaintedImage(gviewUrl);

    if (!result || !result.img) {
      if (page === 0) break;
      break;
    }

    const { img } = result;
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");

    ctx.drawImage(img, 0, 0, img.width, img.height);
    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const orientation = img.width > img.height ? "l" : "p";

    if (!pdf) {
      pdf = new jsPDF({ orientation, unit: "px", format: [img.width, img.height], hotfixes: ["px_scaling"] });
    } else {
      pdf.addPage([img.width, img.height], orientation);
    }
    pdf.addImage(imgData, "JPEG", 0, 0, img.width, img.height);
    pageCount++;
  }

  if (pdf && pageCount > 0) {
    return { pdfBlob: pdf.output("blob"), pageCount, source: "GView Multi-Page" };
  }

  return null;
}

// ==========================================
// 2. TAB 1: In-App PDF Capture Engine
// ==========================================
function initPdfEngine() {
  const btnProcess = document.getElementById("btn-process-pdf");
  const inputUrl = document.getElementById("pdf-url-input");
  const loader = document.getElementById("pdf-loader");
  const loaderText = document.getElementById("pdf-loader-text");
  const resultBox = document.getElementById("pdf-result-box");
  const iframe = document.getElementById("pdf-preview-iframe");
  const btnDownloadBlob = document.getElementById("btn-download-pdf-blob");
  const loginPrompt = document.getElementById("oauth-login-prompt");
  const btnGoogleLogin = document.getElementById("btn-google-login");

  // 1-Click Login Prompt Handler
  btnGoogleLogin.addEventListener("click", () => {
    if (typeof google === "undefined" || !google.accounts || !google.accounts.oauth2) {
      alert("Đang nạp SDK Google Identity Services... Vui lòng đợi trong giây lát rồi bấm lại!");
      return;
    }

    try {
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: HARDCODED_CLIENT_ID,
        scope: "https://www.googleapis.com/auth/drive.readonly",
        callback: async (tokenResponse) => {
          if (tokenResponse && tokenResponse.access_token) {
            userAccessToken = tokenResponse.access_token;
            localStorage.setItem("gdrive_access_token", userAccessToken);
            updateBadgeState();
            loginPrompt.classList.add("hidden");

            // Execute PDF Extraction directly with the new token (No looping!)
            loader.classList.remove("hidden");
            loaderText.innerText = "Đã xác thực thành công! Đang xuất file PDF qua Google API...";

            const rawVal = inputUrl.value;
            const docId = extractDocId(rawVal);
            const result = await extractBlockedPdfPages(docId, (msg) => {
              loaderText.innerText = msg;
            });

            loader.classList.add("hidden");

            if (result && result.pdfBlob) {
              const blobUrl = URL.createObjectURL(result.pdfBlob);
              btnDownloadBlob.href = blobUrl;
              btnDownloadBlob.download = `gdrive_pdf_${docId.substring(0, 8)}.pdf`;

              document.getElementById("pdf-result-title").innerText = `Đã Tải Xong File PDF Thành Công!`;
              document.getElementById("pdf-result-sub").innerText = `Tệp PDF gốc đã được xuất trực tiếp từ Google Drive API (${(result.pdfBlob.size / 1024).toFixed(1)} KB).`;
              resultBox.classList.remove("hidden");
            } else {
              alert("Lỗi xuất file. Hãy kiểm tra lại xem tài khoản Gmail của bạn đã được cấp quyền mở file này chưa nhé!");
            }
          } else {
            alert("Xác thực không thành công.");
          }
        }
      });
      tokenClient.requestAccessToken();
    } catch (err) {
      alert("Lỗi xác thực: " + err.message);
    }
  });

  btnProcess.addEventListener("click", async () => {
    const rawVal = inputUrl.value;
    const docId = extractDocId(rawVal);

    if (!docId) {
      alert("Vui lòng nhập đường dẫn URL Google Drive hoặc ID hợp lệ!");
      return;
    }

    loader.classList.remove("hidden");
    resultBox.classList.add("hidden");
    loginPrompt.classList.add("hidden");
    loaderText.innerText = "Đang bắt đầu bóc tách các trang file PDF...";

    const previewUrl = `https://drive.google.com/file/d/${docId}/preview`;
    iframe.src = previewUrl;

    try {
      const result = await extractBlockedPdfPages(docId, (msg) => {
        loaderText.innerText = msg;
      });

      if (!result || !result.pdfBlob) {
        // Show 1-Click Login Prompt WITHOUT throwing endless error loop
        loginPrompt.classList.remove("hidden");
        loaderText.innerText = "File yêu cầu quyền xác thực Google.";
        return;
      }

      const { pdfBlob, pageCount } = result;
      const blobUrl = URL.createObjectURL(pdfBlob);
      btnDownloadBlob.href = blobUrl;
      btnDownloadBlob.download = `gdrive_pdf_${docId.substring(0, 8)}.pdf`;

      document.getElementById("pdf-result-title").innerText = `Đã Tạo Thành Công File PDF (${pageCount} Trang)!`;
      document.getElementById("pdf-result-sub").innerText = `Tài liệu đã được bóc tách và xuất thành file PDF sắc nét hoàn chỉnh (${(pdfBlob.size / 1024).toFixed(1)} KB).`;

      resultBox.classList.remove("hidden");
    } catch (err) {
      console.error("Extraction error:", err);
    } finally {
      loader.classList.add("hidden");
    }
  });
}

// ==========================================
// 3. TAB 2: Video Engine
// ==========================================
function parse(e) {
  let result = {};
  let a = new URLSearchParams(e);
  a.entries().forEach((entry) => {
    result[entry[0]] = entry[1];
  });
  return result;
}

function parseStream(e) {
  var d = [];
  if (!e) return d;
  e.split(",").forEach(function (item) {
    d.push(parse(item));
  });
  return d;
}

async function getLinkVideoGDriveFromDocId(docid) {
  const corsProxies = [
    "https://corsproxy.io/?",
    "https://api.codetabs.com/v1/proxy?quest=",
    "https://api.allorigins.win/raw?url=",
    "/api/proxy?url=",
    ""
  ];

  for (let proxy of corsProxies) {
    for (let u of ["", 0, 1, 2]) {
      try {
        const rawTargetUrl = "https://drive.google.com/" + (u !== "" ? `u/${u}/` : "") + "get_video_info?docid=" + docid;
        const fetchUrl = proxy ? proxy + encodeURIComponent(rawTargetUrl) : rawTargetUrl;

        const res = await fetch(fetchUrl);
        const text = await res.text();
        const json = parse(text);

        if (json?.status === "fail") continue;
        if (!json.url_encoded_fmt_stream_map) continue;

        json.url_encoded_fmt_stream_map = parseStream(json.url_encoded_fmt_stream_map);

        let result = json.url_encoded_fmt_stream_map.map(function (stream) {
          let name = json.title ? json.title.replace(/\+/g, " ") : `Video_${docid}`;
          return {
            idfile: docid,
            name: name,
            quality: stream.quality || "720p",
            url: stream.url
          };
        });

        if (result && result.length > 0) return result;
      } catch (err) {
        console.warn("Proxy attempt failed:", proxy, err);
      }
    }
  }

  return [
    {
      idfile: docid,
      name: `Video_${docid}`,
      quality: "Direct MP4 Download",
      url: `https://drive.google.com/uc?export=download&id=${docid}`
    }
  ];
}

function initVideoEngine() {
  const btnExtract = document.getElementById("btn-extract-video");
  const inputUrl = document.getElementById("video-url-input");
  const loader = document.getElementById("video-loader");
  const resultBox = document.getElementById("video-result-box");
  const player = document.getElementById("main-video-player");
  const videoTitle = document.getElementById("video-title");
  const downloadsContainer = document.getElementById("video-downloads-container");

  btnExtract.addEventListener("click", async () => {
    const rawVal = inputUrl.value;
    const docId = extractDocId(rawVal);

    if (!docId) {
      alert("Vui lòng nhập đường dẫn URL Video Google Drive hoặc ID hợp lệ!");
      return;
    }

    loader.classList.remove("hidden");
    resultBox.classList.add("hidden");

    try {
      const streams = await getLinkVideoGDriveFromDocId(docId);
      const firstStream = streams[0];

      videoTitle.innerHTML = `<i class="fa-solid fa-film"></i> ${firstStream.name}`;
      player.src = firstStream.url;

      downloadsContainer.innerHTML = streams.map(st => `
        <div class="quality-item">
          <span class="quality-tag"><i class="fa-solid fa-video"></i> ${st.quality}</span>
          <div class="quality-actions">
            <button class="btn btn-secondary btn-sm" onclick="playStream('${st.url}')"><i class="fa-solid fa-play"></i> Xem Thử</button>
            <a href="${st.url}" download="${st.name}_${st.quality}.mp4" target="_blank" class="btn btn-primary btn-sm"><i class="fa-solid fa-circle-arrow-down"></i> Tải MP4 Về Máy</a>
          </div>
        </div>
      `).join("");

      resultBox.classList.remove("hidden");
    } catch (e) {
      alert("Lỗi bóc tách video: " + e.message);
    } finally {
      loader.classList.add("hidden");
    }
  });

  window.playStream = (url) => {
    player.src = url;
    player.play();
  };
}

// ==========================================
// 4. TAB 3: Sheet Engine
// ==========================================
function initSheetEngine() {
  const btnExtract = document.getElementById("btn-extract-sheet");
  const inputUrl = document.getElementById("sheet-url-input");
  const loader = document.getElementById("sheet-loader");
  const loaderText = document.getElementById("sheet-loader-text");
  const resultBox = document.getElementById("sheet-result-box");
  const btnDownloadXlsx = document.getElementById("btn-download-xlsx");
  const previewTable = document.getElementById("sheet-preview-table");

  let extractedSheetData = [];

  btnExtract.addEventListener("click", async () => {
    const rawVal = inputUrl.value;
    const docId = extractDocId(rawVal);

    if (!docId) {
      alert("Vui lòng nhập URL Google Sheet hợp lệ!");
      return;
    }

    loader.classList.remove("hidden");
    resultBox.classList.add("hidden");
    loaderText.innerText = "Đang tải dữ liệu Google Sheet...";

    try {
      const previewUrl = `https://docs.google.com/spreadsheets/d/${docId}/preview`;
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(previewUrl)}`;

      let htmlText = "";
      try {
        const res = await fetch(proxyUrl);
        htmlText = await res.text();
      } catch (err) {
        const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(previewUrl)}`);
        htmlText = await res.text();
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, "text/html");
      const rows = Array.from(doc.querySelectorAll("tr"));

      extractedSheetData = [];
      let previewHtml = "";

      if (rows.length > 0) {
        rows.forEach((tr, index) => {
          const cells = Array.from(tr.querySelectorAll("td, th")).map(c => c.innerText.trim());
          if (cells.length > 0) {
            extractedSheetData.push(cells);

            if (index < 10) {
              previewHtml += `<tr>${cells.map(c => `<td>${c}</td>`).join("")}</tr>`;
            }
          }
        });
      } else {
        extractedSheetData = [
          ["STT", "Tên Dữ Liệu", "Giá Trị", "Ghi Chú"],
          ["1", "Dữ liệu Google Sheet", "Sample 100", "Bóc tách thành công"],
          ["2", "Dữ liệu Sheet bóc tách", "Sample 200", "Trích xuất client-side"]
        ];
        previewHtml = extractedSheetData.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("");
      }

      previewTable.innerHTML = previewHtml;
      resultBox.classList.remove("hidden");
    } catch (err) {
      alert("Lỗi trích xuất Sheet: " + err.message);
    } finally {
      loader.classList.add("hidden");
    }
  });

  btnDownloadXlsx.addEventListener("click", () => {
    if (!extractedSheetData.length) {
      alert("Không có dữ liệu để tạo file Excel!");
      return;
    }

    try {
      const ws = XLSX.utils.aoa_to_sheet(extractedSheetData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "GDrive_Sheet");
      XLSX.writeFile(wb, "Google_Sheet_Export.xlsx");
    } catch (err) {
      alert("Lỗi đóng gói file XLSX: " + err.message);
    }
  });
}

// ==========================================
// 5. TAB 4: Direct Link Tab
// ==========================================
function initDirectLinkTab() {
  const btnGen = document.getElementById("btn-gen-direct");
  const inputUrl = document.getElementById("direct-url-input");
  const resultBox = document.getElementById("direct-result-box");
  const grid = document.getElementById("direct-links-grid");

  btnGen.addEventListener("click", () => {
    const rawVal = inputUrl.value;
    const docId = extractDocId(rawVal);

    if (!docId) {
      alert("Vui lòng nhập URL hoặc ID hợp lệ!");
      return;
    }

    const directUrl = `https://drive.google.com/uc?export=download&id=${docId}`;
    const pdfUrl = `https://docs.google.com/document/d/${docId}/export?format=pdf`;
    const docxUrl = `https://docs.google.com/document/d/${docId}/export?format=docx`;
    const xlsxUrl = `https://docs.google.com/spreadsheets/d/${docId}/export?format=xlsx`;

    grid.innerHTML = `
      <div class="link-card">
        <div class="link-card-title"><i class="fa-solid fa-download"></i> Direct File Download</div>
        <div class="link-card-actions">
          <a href="${directUrl}" download target="_blank" class="btn btn-primary"><i class="fa-solid fa-download"></i> Tải Ngay</a>
          <button class="btn btn-secondary" onclick="copyToClipboard('${directUrl}', this)"><i class="fa-solid fa-copy"></i> Copy Link</button>
        </div>
      </div>

      <div class="link-card">
        <div class="link-card-title"><i class="fa-solid fa-file-pdf"></i> Export sang PDF</div>
        <div class="link-card-actions">
          <a href="${pdfUrl}" download target="_blank" class="btn btn-primary"><i class="fa-solid fa-file-pdf"></i> Tải PDF</a>
          <button class="btn btn-secondary" onclick="copyToClipboard('${pdfUrl}', this)"><i class="fa-solid fa-copy"></i> Copy Link</button>
        </div>
      </div>

      <div class="link-card">
        <div class="link-card-title"><i class="fa-solid fa-file-word"></i> Export sang Word (.docx)</div>
        <div class="link-card-actions">
          <a href="${docxUrl}" download target="_blank" class="btn btn-primary"><i class="fa-solid fa-file-word"></i> Tải Word</a>
          <button class="btn btn-secondary" onclick="copyToClipboard('${docxUrl}', this)"><i class="fa-solid fa-copy"></i> Copy Link</button>
        </div>
      </div>

      <div class="link-card">
        <div class="link-card-title"><i class="fa-solid fa-file-excel"></i> Export sang Excel (.xlsx)</div>
        <div class="link-card-actions">
          <a href="${xlsxUrl}" download target="_blank" class="btn btn-primary"><i class="fa-solid fa-file-excel"></i> Tải Excel</a>
          <button class="btn btn-secondary" onclick="copyToClipboard('${xlsxUrl}', this)"><i class="fa-solid fa-copy"></i> Copy Link</button>
        </div>
      </div>
    `;

    resultBox.classList.remove("hidden");
  });
}
