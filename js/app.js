/* =========================================================
   Singh Dental Clinic — scroll experience & shared behavior
   Works on every page; heavy canvas logic runs only on home.
   ========================================================= */
(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  gsap.registerPlugin(ScrollTrigger);

  /* ---------- Lenis smooth scroll ---------- */
  let lenis;
  if (!reduceMotion) {
    lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    window.__lenis = lenis; // exposed for tooling/screenshots
  }

  /* ---------- Header: scrolled state + mobile menu + anchor links ---------- */
  const header = document.getElementById("site-header");
  const navToggle = document.getElementById("nav-toggle");

  function onScrollHeader(y) {
    if (!header) return;
    header.classList.toggle("scrolled", y > 24);
  }
  if (lenis) lenis.on("scroll", ({ scroll }) => onScrollHeader(scroll));
  window.addEventListener("scroll", () => onScrollHeader(window.scrollY), { passive: true });
  onScrollHeader(window.scrollY);

  if (navToggle && header) {
    navToggle.addEventListener("click", () => {
      const open = header.classList.toggle("menu-open");
      navToggle.setAttribute("aria-expanded", String(open));
    });
    header.querySelectorAll(".nav-link").forEach((a) =>
      a.addEventListener("click", () => {
        header.classList.remove("menu-open");
        navToggle.setAttribute("aria-expanded", "false");
      })
    );
  }

  // smooth in-page anchors through Lenis
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: -80 });
      else target.scrollIntoView({ behavior: "smooth" });
    });
  });

  /* ---------- Generic [data-reveal] entrances (all pages) ---------- */
  function initReveals() {
    const els = gsap.utils.toArray("[data-reveal]");
    els.forEach((el) => {
      gsap.fromTo(
        el,
        { y: 38, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 86%", toggleActions: "play none none reverse" },
        }
      );
    });
  }

  /* ---------- Counters ---------- */
  function animateCounters(scope) {
    scope.querySelectorAll(".stat-number").forEach((el) => {
      if (el.dataset.counted) return;
      el.dataset.counted = "1";
      const target = parseFloat(el.dataset.value);
      const dec = parseInt(el.dataset.decimals || "0", 10);
      const obj = { v: 0 };
      gsap.to(obj, {
        v: target,
        duration: 1.8,
        ease: "power1.out",
        onUpdate() { el.textContent = obj.v.toFixed(dec); },
        onComplete() { el.textContent = target.toFixed(dec); },
      });
    });
  }

  /* =======================================================
     HOME ONLY — canvas frame scrubbing + section choreography
     ======================================================= */
  const canvas = document.getElementById("canvas");
  const scrollContainer = document.getElementById("scroll-container");
  const isHome = canvas && scrollContainer;

  if (!isHome) {
    // Other pages: just reveals + counters, then bail.
    initReveals();
    document.querySelectorAll(".section-stats, .stats-block").forEach((s) =>
      ScrollTrigger.create({ trigger: s, start: "top 75%", once: true, onEnter: () => animateCounters(s) })
    );
    ScrollTrigger.refresh();
    return;
  }

  const FRAME_COUNT = 240;
  const FRAME_SPEED = 2.0;
  const IMAGE_SCALE = 0.86;
  const framePath = (i) => `frames/frame_${String(i + 1).padStart(4, "0")}.webp`;

  const ctx = canvas.getContext("2d", { alpha: false });
  const frames = new Array(FRAME_COUNT);
  let currentFrame = -1;
  let bgColor = "#f4f1ea";

  /* --- sizing --- */
  function sizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    if (currentFrame >= 0) drawFrame(currentFrame);
  }

  /* --- sample bg color from frame edges --- */
  const sampler = document.createElement("canvas");
  sampler.width = sampler.height = 24;
  const sctx = sampler.getContext("2d", { willReadFrequently: true });
  function sampleBgColor(img) {
    try {
      sctx.drawImage(img, 0, 0, 24, 24);
      const corners = [
        sctx.getImageData(0, 0, 1, 1).data,
        sctx.getImageData(23, 0, 1, 1).data,
        sctx.getImageData(0, 23, 1, 1).data,
        sctx.getImageData(23, 23, 1, 1).data,
      ];
      let r = 0, g = 0, b = 0;
      corners.forEach((c) => { r += c[0]; g += c[1]; b += c[2]; });
      r = Math.round(r / 4); g = Math.round(g / 4); b = Math.round(b / 4);
      bgColor = `rgb(${r},${g},${b})`;
    } catch (_) { /* ignore */ }
  }

  /* --- draw padded-cover --- */
  function drawFrame(index) {
    const img = frames[index];
    if (!img) return;
    const cw = canvas.width, ch = canvas.height;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const scale = Math.max(cw / iw, ch / ih) * IMAGE_SCALE;
    const dw = iw * scale, dh = ih * scale;
    const dx = (cw - dw) / 2, dy = (ch - dh) / 2;
    if (index % 20 === 0) sampleBgColor(img);
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  /* --- preload --- */
  const loader = document.getElementById("loader");
  const barFill = document.getElementById("loader-bar-fill");
  const percentEl = document.getElementById("loader-percent");
  let loaded = 0;

  function setProgress() {
    const pct = Math.round((loaded / FRAME_COUNT) * 100);
    if (barFill) barFill.style.width = pct + "%";
    if (percentEl) percentEl.textContent = pct + "%";
  }

  function loadFrame(i) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = img.onerror = () => {
        frames[i] = img.complete && img.naturalWidth ? img : null;
        loaded++;
        setProgress();
        resolve();
      };
      img.src = framePath(i);
    });
  }

  function hideLoader() {
    if (!loader) return;
    loader.classList.add("hidden");
    setTimeout(() => loader.remove(), 800);
  }

  async function preload() {
    sizeCanvas();
    // phase 1: first 12 frames for instant paint
    const firstBatch = [];
    for (let i = 0; i < Math.min(12, FRAME_COUNT); i++) firstBatch.push(loadFrame(i));
    await Promise.all(firstBatch);
    currentFrame = 0;
    drawFrame(0);
    // phase 2: the rest, in parallel-ish batches
    const rest = [];
    for (let i = 12; i < FRAME_COUNT; i++) rest.push(loadFrame(i));
    await Promise.all(rest);
  }

  /* --- master scroll wiring --- */
  function build() {
    const hero = document.getElementById("hero");
    const canvasWrap = document.getElementById("canvas-wrap");
    const overlay = document.getElementById("dark-overlay");
    const marquee = document.getElementById("marquee");
    const marqueeText = marquee ? marquee.querySelector(".marquee-text") : null;

    /* hero word reveal */
    const words = document.querySelectorAll(".hero-heading .word > span");
    gsap.from(words, { yPercent: 115, duration: 1, ease: "power4.out", stagger: 0.06, delay: 0.15 });
    gsap.from(".hero-standalone .section-label, .hero-tagline, .hero-actions", {
      y: 24, opacity: 0, duration: 0.9, ease: "power3.out", stagger: 0.12, delay: 0.5,
    });

    /* section timelines */
    const sectionData = [];
    document.querySelectorAll(".scroll-section").forEach((sec) => {
      const type = sec.dataset.animation;
      const kids = sec.querySelectorAll(
        ".section-label, .section-heading, .section-body, .section-note, .cta-button, .stat"
      );
      const tl = gsap.timeline({ paused: true });
      switch (type) {
        case "fade-up": tl.from(kids, { y: 50, opacity: 0, stagger: 0.12, duration: 0.9, ease: "power3.out" }); break;
        case "slide-left": tl.from(kids, { x: -90, opacity: 0, stagger: 0.14, duration: 0.95, ease: "power3.out" }); break;
        case "slide-right": tl.from(kids, { x: 90, opacity: 0, stagger: 0.14, duration: 0.95, ease: "power3.out" }); break;
        case "scale-up": tl.from(kids, { scale: 0.82, opacity: 0, stagger: 0.12, duration: 1.0, ease: "power2.out", transformOrigin: "left center" }); break;
        case "rotate-in": tl.from(kids, { y: 40, rotation: 3, opacity: 0, stagger: 0.1, duration: 0.9, ease: "power3.out" }); break;
        case "stagger-up": tl.from(kids, { y: 64, opacity: 0, stagger: 0.13, duration: 0.85, ease: "power3.out" }); break;
        case "clip-reveal": tl.from(kids, { clipPath: "inset(100% 0 0 0)", opacity: 0, stagger: 0.14, duration: 1.1, ease: "power4.inOut" }); break;
        default: tl.from(kids, { y: 50, opacity: 0, stagger: 0.12, duration: 0.9, ease: "power3.out" });
      }
      const enter = parseFloat(sec.dataset.enter) / 100;
      const leave = parseFloat(sec.dataset.leave) / 100;
      // distribute each section along the tall container at its scroll midpoint
      sec.style.top = ((enter + leave) / 2) * 100 + "%";
      sectionData.push({
        el: sec,
        tl,
        enter,
        leave,
        persist: sec.dataset.persist === "true",
        isStats: sec.classList.contains("section-stats"),
        active: false,
      });
    });

    const overlayEnter = 0.70, overlayLeave = 0.845, fade = 0.04;

    ScrollTrigger.create({
      trigger: scrollContainer,
      start: "top top",
      end: "bottom bottom",
      scrub: true,
      onUpdate: (self) => {
        const p = self.progress;

        /* 1. frame scrub */
        const accel = Math.min(p * FRAME_SPEED, 1);
        const idx = Math.min(Math.floor(accel * FRAME_COUNT), FRAME_COUNT - 1);
        if (idx !== currentFrame && frames[idx]) {
          currentFrame = idx;
          drawFrame(idx);
        }

        /* 2. hero fade + circle-wipe reveal */
        if (hero) hero.style.opacity = String(Math.max(0, 1 - p * 16));
        const wipe = Math.min(1, Math.max(0, (p - 0.008) / 0.06));
        canvasWrap.style.clipPath = `circle(${wipe * 78}% at 50% 50%)`;

        /* 3. section play / reverse */
        sectionData.forEach((d) => {
          const within = p >= d.enter - 0.015 && (d.persist ? true : p <= d.leave + 0.01);
          const wantActive = within && p >= d.enter - 0.015;
          if (wantActive && !d.active) {
            d.active = true;
            d.tl.play();
            if (d.isStats) animateCounters(d.el);
          } else if (!wantActive && d.active && !d.persist) {
            d.active = false;
            d.tl.reverse();
          }
        });

        /* 4. dark overlay around stats */
        let oOp = 0;
        if (p >= overlayEnter - fade && p < overlayEnter) oOp = (p - (overlayEnter - fade)) / fade;
        else if (p >= overlayEnter && p <= overlayLeave) oOp = 0.9;
        else if (p > overlayLeave && p <= overlayLeave + fade) oOp = 0.9 * (1 - (p - overlayLeave) / fade);
        if (overlay) overlay.style.opacity = String(oOp);
        if (header) header.classList.toggle("over-dark", oOp > 0.45);

        /* 5. marquee fade (visible mid-scroll only) */
        if (marquee) {
          let mOp = 0;
          if (p > 0.18 && p < 0.66) mOp = Math.min(1, Math.min((p - 0.18) / 0.05, (0.66 - p) / 0.05));
          marquee.style.opacity = String(Math.max(0, mOp));
        }
      },
    });

    /* marquee horizontal slide */
    if (marqueeText) {
      const speed = parseFloat(marquee.dataset.scrollSpeed) || -28;
      gsap.to(marqueeText, {
        xPercent: speed,
        ease: "none",
        scrollTrigger: { trigger: scrollContainer, start: "top top", end: "bottom bottom", scrub: true },
      });
    }

    initReveals();
    ScrollTrigger.refresh();
  }

  /* --- kick off --- */
  window.addEventListener("resize", () => { sizeCanvas(); ScrollTrigger.refresh(); });

  if (reduceMotion) {
    // static: load one frame, show it, no scrubbing
    loadFrame(Math.floor(FRAME_COUNT / 2)).then(() => {
      currentFrame = Math.floor(FRAME_COUNT / 2);
      sizeCanvas();
      drawFrame(currentFrame);
      document.getElementById("canvas-wrap").style.clipPath = "none";
      hideLoader();
      initReveals();
    });
  } else {
    preload().then(() => {
      hideLoader();
      build();
    });
    // safety fallback: never trap the user behind the loader
    setTimeout(() => { if (loaded > 12) hideLoader(); }, 9000);
  }
})();
