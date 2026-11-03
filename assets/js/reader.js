/*
  Score reader. Opens read.html?work=<id>&file=<n>&page=<p>
  Uses PDF.js (vendored in assets/vendor/pdfjs) to draw each page onto a canvas,
  lazily, as it scrolls into view.
*/

import * as pdfjsLib from "../vendor/pdfjs/pdf.min.mjs";

const VENDOR = new URL("../vendor/pdfjs/", import.meta.url);
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdf.worker.min.mjs", VENDOR).href;

const CSS_UNITS = 96 / 72; // PDF points to CSS pixels, so 100% looks like the printed page
const ZOOM_STEPS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
// px around and between the pages; tighter on phones so the score gets the width
const narrow = () => window.matchMedia("(max-width: 640px)").matches;
const padPx = () => (narrow() ? 10 : 24);
const GAP = 16;

const $ = (id) => document.getElementById(id);
const ui = {
  title: $("rd-title"),
  sub: $("rd-sub"),
  file: $("rd-file"),
  download: $("rd-download"),
  prev: $("rd-prev"),
  next: $("rd-next"),
  page: $("rd-page"),
  pages: $("rd-pages"),
  zoomOut: $("rd-zoom-out"),
  zoomIn: $("rd-zoom-in"),
  zoom: $("rd-zoom"),
  spread: $("rd-spread"),
  full: $("rd-full"),
  viewport: $("rd-viewport"),
  box: $("rd-box"),
  status: $("rd-status"),
  credit: $("rd-credit")
};

const state = {
  work: null,
  fileIndex: 0,
  pdf: null,
  sizes: [], // [{w, h}] in PDF points at scale 1
  mode: "width", // "width" | "page" | number
  scale: 1, // effective zoom, 1 = 100%
  spread: false,
  current: 1,
  pageEls: [],
  rendered: new Map(), // pageNumber -> { canvas, task }
  observer: null,
  loadToken: 0
};

/* ---------- status / errors ---------- */

function showStatus(message, html) {
  ui.status.hidden = false;
  if (html) ui.status.innerHTML = html;
  else ui.status.textContent = message;
}
function hideStatus() {
  ui.status.hidden = true;
}

/* ---------- which work / file ---------- */

function readParams() {
  const q = new URLSearchParams(location.search);
  return {
    id: q.get("work"),
    file: Math.max(0, parseInt(q.get("file") || "0", 10) || 0),
    page: Math.max(1, parseInt(q.get("page") || "1", 10) || 1)
  };
}

let urlTimer;
function writeParams() {
  clearTimeout(urlTimer);
  urlTimer = setTimeout(() => {
    const q = new URLSearchParams({ work: state.work.id });
    if (state.fileIndex) q.set("file", String(state.fileIndex));
    if (state.current > 1) q.set("page", String(state.current));
    history.replaceState(null, "", "read.html?" + q.toString());
  }, 250);
}

function setupWork(work, fileIndex) {
  const { el, licenseFor } = window.SiteKit;
  state.work = work;
  document.title = work.title + " · Matthew Samson";
  ui.title.textContent = work.title;
  ui.sub.textContent = [work.instrumentation, work.year].filter(Boolean).join(" · ");

  if (work.files.length > 1) {
    ui.file.hidden = false;
    ui.file.textContent = "";
    work.files.forEach((f, i) => ui.file.append(el("option", { value: String(i), text: f.label || "File " + (i + 1) })));
    ui.file.value = String(fileIndex);
  }

  const lic = licenseFor(work);
  ui.credit.textContent = "";
  ui.credit.append(
    "“" + work.title + "” by Matthew Samson · ",
    lic.url ? el("a", { href: lic.url, rel: "license", text: lic.name }) : el("span", { class: lic.chosen ? null : "todo", text: lic.name }),
    " · ",
    el("a", { href: "use.html", text: "How to use and credit it" })
  );
}

/* ---------- loading a PDF ---------- */

async function openFile(fileIndex, startPage) {
  const token = ++state.loadToken;
  const file = state.work.files[fileIndex];
  state.fileIndex = fileIndex;
  ui.download.href = file.path;
  ui.download.setAttribute("download", file.path.split("/").pop());

  teardownPages();
  if (state.pdf) {
    state.pdf.destroy();
    state.pdf = null;
  }
  showStatus("Opening " + (file.label || "score").toLowerCase() + "…");

  try {
    const task = pdfjsLib.getDocument({
      url: file.path,
      standardFontDataUrl: new URL("standard_fonts/", VENDOR).href
    });
    task.onProgress = ({ loaded, total }) => {
      if (token === state.loadToken && total) showStatus("Opening… " + Math.round((loaded / total) * 100) + "%");
    };
    const pdf = await task.promise;
    if (token !== state.loadToken) return pdf.destroy();
    state.pdf = pdf;

    const sizes = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const vp = page.getViewport({ scale: 1 });
      sizes.push({ w: vp.width, h: vp.height });
    }
    if (token !== state.loadToken) return;
    state.sizes = sizes;
    ui.pages.textContent = String(pdf.numPages);
    ui.page.max = String(pdf.numPages);
    hideStatus();
    layout(Math.min(startPage || 1, pdf.numPages));
  } catch (err) {
    console.error(err);
    if (token !== state.loadToken) return;
    showStatus(
      "",
      'Sorry, this PDF wouldn’t open in the reader. <a href="' +
        encodeURI(file.path) +
        '">Open the PDF directly</a> instead.'
    );
  }
}

/* ---------- layout ---------- */

function maxSize() {
  return state.sizes.reduce((m, s) => ({ w: Math.max(m.w, s.w), h: Math.max(m.h, s.h) }), { w: 0, h: 0 });
}

function computeScale() {
  const { w, h } = maxSize();
  const across = state.spread ? 2 : 1;
  const PAD = padPx();
  const availW = ui.viewport.clientWidth - PAD * 2 - (across - 1) * GAP;
  const availH = ui.viewport.clientHeight - PAD * 2;
  const fitW = availW / (w * CSS_UNITS * across);
  const fitP = Math.min(fitW, availH / (h * CSS_UNITS));
  if (state.mode === "width") return Math.max(0.1, fitW);
  if (state.mode === "page") return Math.max(0.1, fitP);
  return state.mode;
}

function teardownPages() {
  if (state.observer) state.observer.disconnect();
  state.rendered.forEach(({ task }) => task && task.cancel());
  state.rendered.clear();
  state.pageEls = [];
  ui.box.textContent = "";
}

function layout(goToPage) {
  if (!state.pdf) return;
  const keep = goToPage || state.current;
  teardownPages();
  state.scale = computeScale();
  ui.box.classList.toggle("is-spread", state.spread);
  ui.box.style.setProperty("--pad", padPx() + "px");
  ui.box.style.setProperty("--gap", GAP + "px");

  const per = state.spread ? 2 : 1;
  let row;
  state.sizes.forEach((size, i) => {
    if (i % per === 0) {
      row = document.createElement("div");
      row.className = "rd-row";
      ui.box.append(row);
    }
    const page = document.createElement("div");
    page.className = "rd-page";
    page.dataset.page = String(i + 1);
    page.style.width = Math.floor(size.w * CSS_UNITS * state.scale) + "px";
    page.style.height = Math.floor(size.h * CSS_UNITS * state.scale) + "px";
    page.setAttribute("role", "img");
    page.setAttribute("aria-label", "Page " + (i + 1) + " of " + state.sizes.length);
    row.append(page);
    state.pageEls.push(page);
  });

  state.observer = new IntersectionObserver(onIntersect, {
    root: ui.viewport,
    rootMargin: "150% 0px 150% 0px"
  });
  state.pageEls.forEach((p) => state.observer.observe(p));

  updateZoomUI();
  goTo(keep, true);
}

function onIntersect(entries) {
  entries.forEach((entry) => {
    const n = Number(entry.target.dataset.page);
    if (entry.isIntersecting) renderPage(n);
    else unrenderPage(n);
  });
}

async function renderPage(n) {
  if (state.rendered.has(n) || !state.pdf) return;
  const holder = state.pageEls[n - 1];
  const record = { canvas: null, task: null };
  state.rendered.set(n, record);
  try {
    const page = await state.pdf.getPage(n);
    if (state.rendered.get(n) !== record) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const viewport = page.getViewport({ scale: state.scale * CSS_UNITS * dpr });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    record.canvas = canvas;
    record.task = page.render({ canvas, canvasContext: ctx, viewport });
    await record.task.promise;
    if (state.rendered.get(n) !== record) return;
    holder.append(canvas);
    holder.classList.add("is-ready");
  } catch (err) {
    if (err && err.name === "RenderingCancelledException") return;
    console.error(err);
  }
}

function unrenderPage(n) {
  const record = state.rendered.get(n);
  if (!record) return;
  if (record.task) record.task.cancel();
  if (record.canvas) {
    record.canvas.width = 0; // free memory on iOS
    record.canvas.remove();
  }
  const holder = state.pageEls[n - 1];
  if (holder) holder.classList.remove("is-ready");
  state.rendered.delete(n);
}

/* ---------- navigation ---------- */

function goTo(n, instant) {
  if (!state.pageEls.length) return;
  n = Math.max(1, Math.min(n, state.pageEls.length));
  const row = state.pageEls[n - 1].parentElement;
  ui.viewport.scrollTo({ top: row.offsetTop - padPx() / 2, behavior: instant ? "auto" : "smooth" });
  setCurrent(n);
}

function step(dir) {
  const per = state.spread ? 2 : 1;
  let base = state.current;
  if (state.spread) base = base - ((base - 1) % 2); // first page of the current spread
  goTo(base + dir * per);
}

function setCurrent(n) {
  state.current = n;
  if (document.activeElement !== ui.page) ui.page.value = String(n);
  ui.prev.disabled = n <= 1;
  const per = state.spread ? 2 : 1;
  const base = state.spread ? n - ((n - 1) % 2) : n;
  ui.next.disabled = base + per > state.pageEls.length;
  if (state.work) writeParams();
}

let scrollQueued = false;
function onScroll() {
  if (scrollQueued) return;
  scrollQueued = true;
  requestAnimationFrame(() => {
    scrollQueued = false;
    const line = ui.viewport.scrollTop + ui.viewport.clientHeight * 0.3;
    let found = 1;
    for (const el of state.pageEls) {
      if (el.parentElement.offsetTop <= line) found = Number(el.dataset.page);
      else break;
    }
    if (state.spread) found = found - ((found - 1) % 2);
    if (found !== state.current) setCurrent(found);
  });
}

/* ---------- zoom ---------- */

function updateZoomUI() {
  const pct = Math.round(state.scale * 100) + "%";
  const custom = ui.zoom.querySelector('option[data-custom]');
  if (typeof state.mode === "number") {
    custom.hidden = false;
    custom.value = String(state.mode);
    custom.textContent = pct;
    ui.zoom.value = String(state.mode);
  } else {
    custom.hidden = true;
    ui.zoom.value = state.mode;
  }
  ui.zoom.title = "Zoom: " + pct;
  ui.spread.setAttribute("aria-pressed", String(state.spread));
}

function setMode(mode) {
  state.mode = mode;
  layout(state.current);
}

function zoomBy(dir) {
  const now = state.scale;
  let next;
  if (dir > 0) next = ZOOM_STEPS.find((z) => z > now + 0.01) || ZOOM_STEPS[ZOOM_STEPS.length - 1];
  else next = [...ZOOM_STEPS].reverse().find((z) => z < now - 0.01) || ZOOM_STEPS[0];
  setMode(next);
}

/* ---------- full screen ---------- */

function fullscreenSupported() {
  const d = document.documentElement;
  return !!(d.requestFullscreen || d.webkitRequestFullscreen);
}
function toggleFullscreen() {
  const d = document.documentElement;
  const isFull = document.fullscreenElement || document.webkitFullscreenElement;
  if (isFull) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  else (d.requestFullscreen || d.webkitRequestFullscreen).call(d);
}

/* ---------- wiring ---------- */

function wire() {
  ui.prev.addEventListener("click", () => step(-1));
  ui.next.addEventListener("click", () => step(1));
  ui.page.addEventListener("change", () => goTo(parseInt(ui.page.value, 10) || 1));
  ui.page.addEventListener("blur", () => (ui.page.value = String(state.current)));
  ui.zoomIn.addEventListener("click", () => zoomBy(1));
  ui.zoomOut.addEventListener("click", () => zoomBy(-1));
  ui.zoom.addEventListener("change", () => {
    const v = ui.zoom.value;
    setMode(v === "width" || v === "page" ? v : parseFloat(v));
  });
  ui.spread.addEventListener("click", () => {
    state.spread = !state.spread;
    try { localStorage.setItem("reader.spread", state.spread ? "1" : "0"); } catch (e) { /* private mode */ }
    layout(state.current);
  });
  ui.file.addEventListener("change", () => openFile(parseInt(ui.file.value, 10) || 0, 1));

  if (fullscreenSupported()) {
    ui.full.hidden = false;
    ui.full.addEventListener("click", toggleFullscreen);
  }

  ui.viewport.addEventListener("scroll", onScroll, { passive: true });

  // Ctrl/Cmd + wheel (and trackpad pinch) zooms the score, not the page.
  ui.viewport.addEventListener(
    "wheel",
    (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1 : -1);
    },
    { passive: false }
  );

  // Keyboard, including page-turn pedals (they usually send arrows or Page Up/Down).
  document.addEventListener("keydown", (e) => {
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.isContentEditable)) return;
    if (e.altKey) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key === "=" || e.key === "+")) { e.preventDefault(); zoomBy(1); return; }
    if (mod && e.key === "-") { e.preventDefault(); zoomBy(-1); return; }
    if (mod && e.key === "0") { e.preventDefault(); setMode("width"); return; }
    if (mod) return;
    switch (e.key) {
      case "ArrowRight":
      case "PageDown":
        e.preventDefault(); step(1); break;
      case "ArrowLeft":
      case "PageUp":
        e.preventDefault(); step(-1); break;
      case "Home":
        e.preventDefault(); goTo(1); break;
      case "End":
        e.preventDefault(); goTo(state.pageEls.length); break;
      case "+":
      case "=":
        zoomBy(1); break;
      case "-":
        zoomBy(-1); break;
      case "f":
        if (fullscreenSupported()) toggleFullscreen(); break;
      case "d":
        ui.spread.click(); break;
      default:
    }
  });

  let resizeTimer;
  let lastW = ui.viewport.clientWidth;
  let lastH = ui.viewport.clientHeight;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const w = ui.viewport.clientWidth;
      const h = ui.viewport.clientHeight;
      const changed = Math.abs(w - lastW) > 2 || (state.mode === "page" && Math.abs(h - lastH) > 2);
      lastW = w;
      lastH = h;
      if (changed && typeof state.mode !== "number") layout(state.current);
    }, 150);
  });
}

/* ---------- start ---------- */

function start() {
  const params = readParams();
  const works = Array.isArray(window.WORKS) ? window.WORKS : [];
  const work = works.find((w) => w.id === params.id);

  // Published elsewhere: no PDF here, so point to the publisher's page.
  if (work && work.publisher && work.publisher.url && !(Array.isArray(work.files) && work.files.length)) {
    const { el } = window.SiteKit;
    document.title = work.title + " · Matthew Samson";
    ui.title.textContent = work.title;
    ui.sub.textContent = [work.instrumentation, work.year].filter(Boolean).join(" · ");
    showStatus("");
    ui.status.append(
      "Published by ",
      el("a", { href: work.publisher.url, rel: "external", text: work.publisher.name || "the publisher" }),
      "."
    );
    document.body.classList.add("is-empty");
    return;
  }

  if (!work || !Array.isArray(work.files) || !work.files.length) {
    ui.title.textContent = params.id ? "Piece not found" : "Choose a piece";
    showStatus(
      "",
      (params.id ? "I couldn’t find that piece. " : "") +
        'Pick something from <a href="music.html">the music page</a> to open it here.'
    );
    document.body.classList.add("is-empty");
    return;
  }

  try { state.spread = localStorage.getItem("reader.spread") === "1"; } catch (e) { /* private mode */ }
  // Big landscape screens default to a whole page in view. Portrait screens, and phones
  // turned sideways (where a whole page would be tiny), default to fitting the width.
  const vw = ui.viewport.clientWidth;
  const vh = ui.viewport.clientHeight;
  state.mode = vw > vh && vh >= 560 ? "page" : "width";

  const fileIndex = Math.min(params.file, work.files.length - 1);
  setupWork(work, fileIndex);
  wire();
  openFile(fileIndex, params.page);
}

start();
