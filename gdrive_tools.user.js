// ==UserScript==
// @name         Google Drive All-in-One Downloader PRO
// @namespace    https://useful-scripts-extension.github.io/
// @version      1.4
// @description  Tải video, PDF bị khóa, Document, Sheet, Slide & Folder Video hàng loạt ngay trên trang Google Drive.
// @author       Useful-Scripts
// @match        https://drive.google.com/*
// @match        https://docs.google.com/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // 1. Register Direct Menu Commands inside Tampermonkey Popup Menu
  if (typeof GM_registerMenuCommand === "function") {
    GM_registerMenuCommand("📄 Tải PDF (Bypass Khóa Download)", runPdfDownloader);
    GM_registerMenuCommand("🎬 Bóc Tách Link Video (Page/Viewer)", runVideoDownloader);
    GM_registerMenuCommand("📂 Tải Mọi Video Trong Folder", runFolderVideoDownloader);
    GM_registerMenuCommand("📊 Copy Sheet Text (Preview)", runCopySheet);
    GM_registerMenuCommand("📝 Tải Google Doc sang PDF", runDocPdfDownloader);
  }

  // 2. Inject Floating FAB Button & Control Panel into Google Drive Web Pages
  function initOverlayUI() {
    if (document.getElementById("gdrive-tools-widget")) return;

    const widget = document.createElement("div");
    widget.id = "gdrive-tools-widget";
    widget.style = `
      position: fixed;
      bottom: 30px;
      right: 30px;
      z-index: 99999999;
      font-family: sans-serif;
    `;

    widget.innerHTML = `
      <button id="gdrive-tools-fab" style="
        background: linear-gradient(135deg, #6366f1, #06b6d4);
        color: white;
        border: 2px solid #ffffff;
        padding: 16px 24px;
        border-radius: 40px;
        font-weight: bold;
        font-size: 15px;
        cursor: pointer;
        box-shadow: 0 10px 30px rgba(99,102,241,0.7);
        display: flex;
        align-items: center;
        gap: 10px;
        transition: all 0.3s ease;
      ">
        🚀 GDrive Tools PRO (Bấm vào đây)
      </button>

      <div id="gdrive-tools-menu" style="
        display: none;
        position: absolute;
        bottom: 65px;
        right: 0;
        width: 340px;
        background: #0f172ae6;
        backdrop-filter: blur(16px);
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 18px;
        padding: 18px;
        box-shadow: 0 25px 60px rgba(0,0,0,0.9);
        color: white;
      ">
        <h4 style="margin: 0 0 14px 0; color: #38bdf8; font-size: 16px; border-bottom: 1px solid #ffffff20; padding-bottom: 10px; font-weight: bold;">
          ⚡ GDrive Downloader Dashboard
        </h4>
        <button id="btn-user-download-pdf" class="menu-btn">📄 Tải PDF (Bypass Khóa Download)</button>
        <button id="btn-user-download-video" class="menu-btn">🎬 Bóc Tách Link Video (Page/Viewer)</button>
        <button id="btn-user-folder-videos" class="menu-btn">📂 Tải Mọi Video Trong Folder</button>
        <button id="btn-user-copy-sheet" class="menu-btn">📊 Copy Sheet Text (Preview)</button>
        <button id="btn-user-doc-pdf" class="menu-btn">📝 Tải Google Doc sang PDF</button>
      </div>

      <style>
        #gdrive-tools-fab:hover {
          transform: translateY(-2px) scale(1.05);
          box-shadow: 0 15px 40px rgba(6,182,212,0.8);
        }
        .menu-btn {
          width: 100%;
          background: #1e293b;
          color: #f1f5f9;
          border: 1px solid #334155;
          padding: 12px;
          margin-bottom: 10px;
          border-radius: 10px;
          text-align: left;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .menu-btn:hover {
          background: #334155;
          color: #38bdf8;
          border-color: #38bdf8;
          transform: translateX(3px);
        }
      </style>
    `;

    document.body.appendChild(widget);

    const fab = document.getElementById("gdrive-tools-fab");
    const menu = document.getElementById("gdrive-tools-menu");

    fab.addEventListener("click", () => {
      menu.style.display = menu.style.display === "none" ? "block" : "none";
    });

    document.getElementById("btn-user-download-pdf").addEventListener("click", runPdfDownloader);
    document.getElementById("btn-user-download-video").addEventListener("click", runVideoDownloader);
    document.getElementById("btn-user-folder-videos").addEventListener("click", runFolderVideoDownloader);
    document.getElementById("btn-user-copy-sheet").addEventListener("click", runCopySheet);
    document.getElementById("btn-user-doc-pdf").addEventListener("click", runDocPdfDownloader);
  }

  // ----------------------------------------------------
  // 1. PDF Downloader Engine (Audit & Hardened)
  // ----------------------------------------------------
  async function runPdfDownloader() {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) { alert("Thư viện jsPDF chưa sẵn sàng!"); return; }

    // Query PDF page containers across all GDrive UI versions
    let pageContainers = Array.from(document.querySelectorAll(
      ".ndfHFb-c4YZDc-cYSp0e-DARUcf, .drive-viewer-paginated-page, .drive-viewer-page, [role='region'], [data-page-number], .kix-page, canvas"
    ));

    // Fallback: Check if pages are inside iframe
    if (!pageContainers.length) {
      document.querySelectorAll("iframe").forEach(iframe => {
        try {
          const iframeDocs = iframe.contentDocument?.querySelectorAll(".ndfHFb-c4YZDc-cYSp0e-DARUcf, img[src^='blob:'], canvas");
          if (iframeDocs && iframeDocs.length) {
            pageContainers.push(...Array.from(iframeDocs));
          }
        } catch (e) {}
      });
    }

    // Fallback: Direct Image / Canvas Detection
    if (!pageContainers.length) {
      pageContainers = Array.from(document.querySelectorAll("img[src^='blob:'], img[src*='googleusercontent'], canvas"));
    }

    if (!pageContainers.length) {
      alert("Không tìm thấy trang PDF nào. Hãy thử cuộn tay xuống vài trang rồi bấm Tải PDF lại!");
      return;
    }

    let delay = prompt(`Tìm thấy ${pageContainers.length} trang PDF.\nNhập độ trễ cuộn trang (ms, mặc định 50):`, "50");
    if (delay === null) return;
    delay = parseInt(delay) || 50;

    let info = createNotice("Đang tự động cuộn nạp toàn bộ trang PDF...");

    for (let i = 0; i < pageContainers.length; i++) {
      try {
        pageContainers[i].scrollIntoView({ behavior: "instant", block: "center" });
      } catch (e) {}
      info.innerText = `Đang cuộn nạp trang: ${i + 1}/${pageContainers.length}`;
      await sleep(delay);
    }

    let checkCount = 0;
    let lastLoadedCount = 0;

    let interval = setInterval(() => {
      checkCount++;
      let imgs = Array.from(document.querySelectorAll("img[src^='blob:'], img[src*='googleusercontent'], canvas")).filter(el => el.complete || el.tagName === "CANVAS");

      info.innerText = `Đang xử lý hình ảnh trang: ${imgs.length}/${pageContainers.length}`;

      if (imgs.length > lastLoadedCount) {
        lastLoadedCount = imgs.length;
        checkCount = 0; // reset check count if new images are still loading
      }

      if (imgs.length >= pageContainers.length || checkCount >= 10) {
        clearInterval(interval);
        info.innerText = "Đang đóng gói file PDF hoàn chỉnh...";

        let canvas = document.createElement("canvas");
        let ctx = canvas.getContext("2d");
        let pdf = null;

        for (let i = 0; i < imgs.length; i++) {
          let el = imgs[i];
          let width = el.width || el.naturalWidth || 800;
          let height = el.height || el.naturalHeight || 1100;

          canvas.width = width;
          canvas.height = height;

          try {
            ctx.drawImage(el, 0, 0, width, height);
            let imgData = canvas.toDataURL("image/jpeg", 0.95);
            let orientation = width > height ? "l" : "p";

            if (!pdf) {
              pdf = new jsPDF({ orientation: orientation, unit: "px", format: [width, height], hotfixes: ["px_scaling"] });
            } else {
              pdf.addPage([width, height], orientation);
            }
            pdf.addImage(imgData, "JPEG", 0, 0, width, height);
          } catch (e) {
            console.warn("Draw image failed for page:", i, e);
          }
        }

        info.remove();
        if (pdf) {
          const fileName = sanitizeName(document.title || "gdrive_downloaded") + ".pdf";
          pdf.save(fileName);
        } else {
          alert("Lỗi đóng gói PDF. Vui lòng cuộn qua các trang rồi thử lại.");
        }
      }
    }, 1000);
  }

  // ----------------------------------------------------
  // 2. Video Downloader Engine (Audit & Hardened)
  // ----------------------------------------------------
  async function runVideoDownloader() {
    let docid = window?.viewerData?.config?.id || matchDocId(location.href);

    // Fallback: Check player_response in URL or DOM
    if (!docid) {
      const urlParams = new URLSearchParams(location.search);
      const playerResp = urlParams.get("player_response");
      if (playerResp) {
        try {
          const json = JSON.parse(playerResp);
          if (json?.streamingData?.formats) {
            let html = json.streamingData.formats.map(_ => `<p style="margin-bottom:8px;"><a href="${_.url}" target="_blank" download style="color:#38bdf8;font-weight:bold;">${_.quality || 'Video'} - Tải Video MP4</a></p>`).join("");
            showModal(`<h3>Links Video (${document.title})</h3>${html}`);
            return;
          }
        } catch (e) {}
      }
    }

    if (!docid) {
      docid = prompt("Nhập link hoặc ID Video Google Drive:");
      docid = matchDocId(docid);
    }

    if (!docid) { alert("Không tìm thấy Doc ID hợp lệ!"); return; }

    let info = createNotice("Đang giải mã link stream video...");
    try {
      let res = await getLinkVideoGDriveFromDocId(docid);
      info.remove();
      if (!res?.length) { alert("Không tìm được link video!"); return; }

      let html = res.map(_ => `<p style="margin-bottom:8px;"><a href="${_.url}" target="_blank" download style="color:#38bdf8;font-weight:bold;">${_.quality} - Tải Video MP4</a></p>`).join("");
      showModal(`<h3>Links Video (${res[0].name})</h3>${html}`);
    } catch (e) {
      info.remove();
      alert("Lỗi: " + e.message);
    }
  }

  // ----------------------------------------------------
  // 3. Folder Video Downloader Engine (Audit & Hardened with Virtualized Auto-Scroll)
  // ----------------------------------------------------
  async function runFolderVideoDownloader() {
    let info = createNotice("Đang quét toàn bộ danh sách video trong thư mục...");

    // Auto-scroll folder container to populate virtualized items
    const mainContainer = document.querySelector("[role='main']") || document.body;
    for (let s = 0; s < 5; s++) {
      mainContainer.scrollTop = mainContainer.scrollHeight;
      await sleep(300);
    }

    let docs = Array.from(document.querySelectorAll("[role='main'] [data-id]")).map(_ => ({
      id: _.dataset.id,
      name: _.querySelector(".KL4NAf")?.innerText || _.innerText || `Video_${_.dataset.id}`
    }));

    if (!docs.length) {
      info.remove();
      alert("Không tìm thấy video nào trong folder này!");
      return;
    }

    info.innerText = `Tìm thấy ${docs.length} video. Đang bóc tách luồng...`;
    let urls = [];

    for (let i = 0; i < docs.length; i++) {
      info.innerText = `Đang bóc tách: ${i + 1}/${docs.length} (${sanitizeName(docs[i].name)})`;
      try {
        let streams = await getLinkVideoGDriveFromDocId(docs[i].id);
        streams.forEach(s => urls.push(s.url));
      } catch (e) {
        urls.push(`https://drive.google.com/uc?export=download&id=${docs[i].id}`);
      }
    }

    info.remove();
    showModal(`
      <h3>Danh sách link video (${urls.length} links):</h3>
      <p style="font-size:12px;color:#94a3b8;margin-bottom:8px;">Copy paste vào IDM / FDM để tải hàng loạt:</p>
      <textarea style="width:100%;height:200px;background:#1e293b;color:white;padding:10px;font-family:monospace;">${urls.join("\n")}</textarea>
    `);
  }

  // 4. Copy Sheet Text
  function runCopySheet() {
    const cleanUrl = location.href.replace(/\/edit.*$/, "/preview").replace(/\/view.*$/, "/preview");
    location.href = cleanUrl.includes("/preview") ? cleanUrl : cleanUrl + "/preview";
  }

  // 5. Doc to PDF
  async function runDocPdfDownloader() {
    const { jsPDF } = window.jspdf || {};
    let canvases = Array.from(document.querySelectorAll("canvas"));
    if (!canvases.length) { alert("Không tìm thấy canvas trong Google Doc!"); return; }

    let pdf = null;
    for (let canvas of canvases) {
      canvas.scrollIntoView();
      await sleep(300);
      let imgData = canvas.toDataURL("image/jpeg", 1.0);
      let width = canvas.width || 800;
      let height = canvas.height || 1100;

      if (!pdf) {
        let ori = width > height ? "l" : "p";
        pdf = new jsPDF({ orientation: ori, unit: "px", format: [width, height], hotfixes: ["px_scaling"] });
      } else {
        pdf.addPage([width, height], width > height ? "l" : "p");
      }
      pdf.addImage(imgData, "JPEG", 0, 0, width, height);
    }
    pdf.save(sanitizeName(document.title || "document") + ".pdf");
  }

  // Helper Core Functions
  function matchDocId(url) {
    return url ? url.match(/[-\w]{25,}(?!.*[-\w]{25,})/)?.[0] : null;
  }

  function sanitizeName(name) {
    if (typeof name !== "string") return "gdrive_downloaded";
    return name.replace(/[\/\?<>\\:\*\|"’#]/g, "").trim() || "gdrive_downloaded";
  }

  function parse(e) {
    let result = {};
    new URLSearchParams(e).forEach((v, k) => { result[k] = v; });
    return result;
  }

  async function getLinkVideoGDriveFromDocId(docid) {
    const userIndices = ["", 0, 1, 2, 3, 4, 5];
    for (let u of userIndices) {
      try {
        let res = await fetch("https://drive.google.com/" + (u !== "" ? `u/${u}/` : "") + "get_video_info?docid=" + docid);
        let text = await res.text();
        let json = parse(text);
        if (json?.status === "fail") continue;
        if (json.url_encoded_fmt_stream_map) {
          let streams = json.url_encoded_fmt_stream_map.split(",").map(parse);
          return streams.map(s => ({
            idfile: docid,
            name: sanitizeName((json.title || "video").replace(/\+/g, " ")),
            quality: s.quality || "720p",
            url: s.url
          }));
        }
      } catch (e) {}
    }
    return [{ idfile: docid, name: `Video_${docid}`, quality: "Direct", url: `https://drive.google.com/uc?export=download&id=${docid}` }];
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function createNotice(msg) {
    let d = document.createElement("div");
    d.style = "position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#0f172ae6;color:#38bdf8;padding:12px 24px;border-radius:30px;z-index:99999999;font-weight:bold;box-shadow:0 10px 30px #000;font-family:sans-serif;";
    d.innerText = msg;
    document.body.appendChild(d);
    return d;
  }

  function showModal(contentHtml) {
    let m = document.createElement("div");
    m.style = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#0f172a;color:white;padding:24px;border-radius:16px;z-index:99999999;max-width:500px;width:90%;box-shadow:0 20px 60px #000;border:1px solid #334155;font-family:sans-serif;";
    m.innerHTML = contentHtml + `<br/><button onclick="this.parentElement.remove()" style="margin-top:10px;padding:8px 16px;background:#ef4444;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">Đóng</button>`;
    document.body.appendChild(m);
  }

  // Run Immediately
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initOverlayUI);
  } else {
    initOverlayUI();
  }
})();
