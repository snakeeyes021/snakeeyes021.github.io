/*
  Site-wide settings and the shared bits of behaviour.
  Plain script, no build step. Loaded after works/catalogue.js on pages that list works.
*/

window.SITE = {
  /*
    TODO (Matt): choose the Creative Commons license. Once chosen, set both fields, e.g.
      name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/"
    Every page that mentions the license reads it from here.
  */
  license: {
    name: "[Creative Commons license: not chosen yet]",
    url: "",
    chosen: false
  },
  composer: "Matthew Samson",
  email: "me@matthewsamson.com"
};

(function () {
  "use strict";

  const SITE = window.SITE;

  /* ---------- small helpers ---------- */

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [key, value] of Object.entries(attrs)) {
        if (value === undefined || value === null || value === false) continue;
        if (key === "class") node.className = value;
        else if (key === "text") node.textContent = value;
        else node.setAttribute(key, value === true ? "" : value);
      }
    }
    (children || []).forEach((child) => {
      if (child === null || child === undefined || child === false) return;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return node;
  }

  function licenseFor(work) {
    return (work && work.license) || SITE.license;
  }

  function readerHref(work, fileIndex) {
    const q = new URLSearchParams({ work: work.id });
    if (fileIndex) q.set("file", String(fileIndex));
    return "read.html?" + q.toString();
  }

  function sortedWorks() {
    const works = Array.isArray(window.WORKS) ? window.WORKS.slice() : [];
    const yearOf = (w) => parseInt(String(w.year), 10) || 0;
    return works.sort((a, b) => yearOf(b) - yearOf(a) || a.title.localeCompare(b.title));
  }

  /* ---------- license text everywhere ---------- */

  function fillLicense(root) {
    (root || document).querySelectorAll("[data-license]").forEach((node) => {
      const lic = SITE.license;
      node.textContent = "";
      if (lic.url) {
        node.append(el("a", { href: lic.url, rel: "license", text: lic.name }));
      } else {
        node.append(el("span", { class: lic.chosen ? null : "todo", text: lic.name }));
      }
    });
  }

  /* ---------- one work, as a list item ---------- */

  function renderWork(work, opts) {
    const options = Object.assign({ note: true, files: true, headingLink: true }, opts);
    const heading = el("h3", null, [
      options.headingLink
        ? el("a", { href: "music.html#" + encodeURIComponent(work.id), text: work.title })
        : work.title,
      work.placeholder ? " " : null,
      work.placeholder ? el("span", { class: "placeholder-tag", text: "placeholder" }) : null
    ]);

    const metaBits = [work.instrumentation, work.duration, work.text].filter(Boolean);
    const meta = el("p", { class: "meta" }, metaBits.map((bit) => el("span", { text: bit })));

    const body = el("div", null, [heading, meta]);

    if (options.note && work.note) {
      const note = el("div", { class: "note" });
      String(work.note)
        .split(/\n\s*\n/)
        .forEach((para) => note.append(el("p", { text: para.trim() })));
      body.append(note);
    }

    if (options.files && Array.isArray(work.files) && work.files.length) {
      const files = el("div", { class: "files" });
      work.files.forEach((file, i) => {
        files.append(
          el("span", { class: "file" }, [
            el("a", { href: readerHref(work, i), text: file.label || "Score" }),
            el("a", {
              href: file.path,
              download: "",
              "aria-label": "Download " + (file.label || "score") + " (PDF)",
              text: "PDF ↓"
            })
          ])
        );
      });
      body.append(files);
    }

    if (options.files && Array.isArray(work.listen) && work.listen.length) {
      const listen = el("p", { class: "listen" }, ["Listen: "]);
      work.listen.forEach((link) => listen.append(el("a", { href: link.url, text: link.label })));
      body.append(listen);
    }

    return el("li", { class: "work", id: work.id }, [
      el("span", { class: "year", text: work.year || "" }),
      body
    ]);
  }

  /* ---------- home page: the newest few ---------- */

  function renderLatest() {
    const list = document.querySelector("[data-latest]");
    if (!list) return;
    const n = parseInt(list.getAttribute("data-latest"), 10) || 3;
    sortedWorks()
      .slice(0, n)
      .forEach((work) => list.append(renderWork(work, { note: false, files: false })));
  }

  /* ---------- catalogue page: everything, with search + category filter ---------- */

  function renderCatalogue() {
    const list = document.querySelector("[data-catalogue]");
    if (!list) return;

    const works = sortedWorks();
    const search = document.querySelector("[data-search]");
    const chipsBox = document.querySelector("[data-chips]");
    const count = document.querySelector("[data-count]");
    const empty = document.querySelector("[data-empty]");

    const items = works.map((work) => ({ work, node: renderWork(work, { headingLink: false }) }));
    items.forEach(({ node }) => list.append(node));

    const categories = Array.from(new Set(works.map((w) => w.category).filter(Boolean))).sort();
    let active = "All";

    function makeChip(name) {
      const chip = el("button", { type: "button", class: "chip", "aria-pressed": String(name === active), text: name });
      chip.addEventListener("click", () => {
        active = name;
        chipsBox.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c.textContent === name)));
        apply();
      });
      return chip;
    }
    if (chipsBox && categories.length > 1) {
      ["All"].concat(categories).forEach((name) => chipsBox.append(makeChip(name)));
    }

    function haystack(work) {
      return [work.title, work.year, work.category, work.instrumentation, work.text, work.note]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    }

    function apply() {
      const q = (search && search.value.trim().toLowerCase()) || "";
      let shown = 0;
      items.forEach(({ work, node }) => {
        const ok = (active === "All" || work.category === active) && (!q || haystack(work).includes(q));
        node.hidden = !ok;
        if (ok) shown += 1;
      });
      if (count) count.textContent = shown + (shown === 1 ? " piece" : " pieces");
      if (empty) empty.hidden = shown !== 0;
    }

    if (search) search.addEventListener("input", apply);
    apply();

    // If we arrived on music.html#some-id, scroll after rendering.
    if (location.hash) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) target.scrollIntoView();
    }
  }

  function fillYear() {
    document.querySelectorAll("[data-year]").forEach((node) => {
      node.textContent = String(new Date().getFullYear());
    });
  }

  // Exposed for the reader.
  window.SiteKit = { el, licenseFor, readerHref, fillLicense };

  function init() {
    fillLicense();
    fillYear();
    renderLatest();
    renderCatalogue();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
