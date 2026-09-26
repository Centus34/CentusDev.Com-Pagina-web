/* =========================================================
   Centus Dev · interacción
   ========================================================= */

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(pointer: fine)").matches;

// Datos de vídeos: los genera scripts/update-videos.mjs (GitHub Actions, cada 6 h).
// Se lee primero la copia de GitHub (siempre la más reciente) y la local como respaldo.
const VIDEO_SOURCES = [
  "https://raw.githubusercontent.com/Centus34/CentusDev.Com-Pagina-web/main/data/videos.json",
  "data/videos.json"
];

// Respaldo mínimo por si no se puede cargar ningún JSON (p. ej. abriendo el archivo en local).
const FALLBACK_VIDEOS = {
  channel: { totalViews: 1540061, subscribersText: "1,59 K" },
  socials: { tiktok: { followers: 1058 }, instagram: { followers: 1772 } },
  latest: [
    { id: "vhIYaLjqqa4", title: "¿LOS COCHES DEL GTA 6 VUELCAN?", published: "2026-09-15T11:45:53+00:00", views: 20324 },
    { id: "-XdnIwE7FO4", title: "COMO FUNCIONAN LAS CÁMARAS EN VIDEOJUEGOS 📸", published: "2026-09-12T16:06:24+00:00", views: 21550 },
    { id: "_7Wrmim4T28", title: "¿POR QUÉ TE DAN SI ESTÁS OCULTO? 🧐", published: "2026-09-09T11:56:44+00:00", views: 21589 },
    { id: "M4yzi5K2rMM", title: "¿SABES EN REALIDAD QUE ES UNA HITBOX?", published: "2026-09-02T14:52:08+00:00", views: 6524 },
    { id: "aXBwQrR-WAM", title: "¿COMO SE SABE CUANDO HAS HECHO UN COMBO?", published: "2026-08-28T17:13:19+00:00", views: 5696 }
  ],
  top: [
    { id: "Jm5UDzh4qYg", title: "COMO SABEN TU POSICIÓN LOS JUEGOS DE CARRERAS", views: 562000 },
    { id: "uiSyshrIEpM", title: "¿TOMODACHI LIFE ES ALEATORIO?", views: 349000 },
    { id: "ydSJJxax8II", title: "NO SABES CÓMO SE ROMPEN LOS OBJETOS EN VIDEOJUEGOS", views: 49525 },
    { id: "SneNTNXegdU", title: "UNA PILA HA SALVADO TU PARTIDA DE POKEMON 😱", views: 46208 }
  ]
};

// Preguntas reales de vídeos del canal para la tarjeta del hero.
const HOOKS = [
  { text: "¿Por qué los coches de tantos videojuegos son, en realidad, esferas?", id: "GBgDwVcaLh4" },
  { text: "¿Cómo pudo una pila salvar tu partida de Pokémon?", id: "SneNTNXegdU" },
  { text: "¿Cómo sabe un juego de carreras en qué posición vas?", id: "Jm5UDzh4qYg" },
  { text: "¿Por qué te dan si estás escondido?", id: "_7Wrmim4T28" },
  { text: "¿Cómo sabe el juego que has hecho un combo?", id: "aXBwQrR-WAM" },
  { text: "¿Cómo vuelven a casa los aldeanos de Minecraft?", id: "lUEYK3jJtSA" },
  { text: "¿Qué es, de verdad, una hitbox?", id: "M4yzi5K2rMM" }
];

const compact = new Intl.NumberFormat("es", { notation: "compact", maximumFractionDigits: 1 });
const relative = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const storage = {
  get(key) {
    try { return window.localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { window.localStorage.setItem(key, value); } catch { /* sin almacenamiento: no pasa nada */ }
  }
};

function timeAgo(dateString) {
  const days = Math.round((new Date(dateString) - Date.now()) / 86400000);
  if (Math.abs(days) < 14) return relative.format(days, "day");
  if (Math.abs(days) < 31) return relative.format(Math.round(days / 7), "week");
  return relative.format(Math.round(days / 30), "month");
}

function escapeHtml(text = "") {
  return text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
}

/* ===== Cabecera y navegación ===== */

function setupHeader() {
  const header = $(".site-header");
  const toggle = $(".menu-toggle");

  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 10);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const closeMenu = () => {
    toggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("menu-open");
  };

  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("menu-open", open);
  });

  $$(".site-nav a").forEach((link) => link.addEventListener("click", closeMenu));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  // Marca en el menú la sección visible
  const links = new Map($$(".site-nav a:not(.nav-cta)").map((link) => [link.hash.slice(1), link]));
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const link = links.get(entry.target.id);
      if (link) link.classList.toggle("is-active", entry.isIntersecting);
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  links.forEach((_, id) => {
    const section = document.getElementById(id);
    if (section) observer.observe(section);
  });
}

/* ===== Aparición al hacer scroll ===== */

let revealObserver = null;

function setupReveal(scope = document) {
  const targets = $$(".reveal:not(.is-visible)", scope);
  if (reduceMotion || !("IntersectionObserver" in window)) {
    targets.forEach((target) => target.classList.add("is-visible"));
    return;
  }

  revealObserver ||= new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const siblings = $$(".reveal", entry.target.parentElement);
      const index = Math.max(0, siblings.indexOf(entry.target));
      entry.target.style.transitionDelay = `${Math.min(index, 4) * 70}ms`;
      entry.target.classList.add("is-visible");
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

  targets.forEach((target) => revealObserver.observe(target));
}

/* ===== Lente de rayos X sobre el avatar ===== */

function setupXray() {
  const stage = $("#xrayStage");
  const frame = $(".stage-frame", stage);
  if (!frame) return;

  const state = { x: 0.5, y: 0.34, r: 0, tx: 0.5, ty: 0.34, tr: 0, hover: false, visible: true, t: 0 };
  let raf = 0;

  const setTarget = (event) => {
    const rect = frame.getBoundingClientRect();
    state.tx = (event.clientX - rect.left) / rect.width;
    state.ty = (event.clientY - rect.top) / rect.height;
  };

  frame.addEventListener("pointerenter", (event) => {
    state.hover = true;
    stage.classList.add("has-interacted");
    setTarget(event);
  });
  frame.addEventListener("pointermove", setTarget);
  frame.addEventListener("pointerdown", (event) => {
    state.hover = true;
    stage.classList.add("has-interacted");
    setTarget(event);
  });
  frame.addEventListener("pointerleave", () => { state.hover = false; });

  new IntersectionObserver(([entry]) => {
    state.visible = entry.isIntersecting;
    if (state.visible && !raf) raf = requestAnimationFrame(tick);
  }).observe(frame);

  function tick(time) {
    raf = 0;
    if (!state.visible) return;

    const size = frame.clientWidth;
    if (!state.hover) {
      // Paseo automático de la lente para invitar a interactuar
      state.t = time / 1000;
      if (reduceMotion) {
        state.tx = 0.48;
        state.ty = 0.38;
      } else {
        state.tx = 0.5 + Math.sin(state.t * 0.55) * 0.26;
        state.ty = 0.42 + Math.sin(state.t * 0.9 + 1) * 0.2;
      }
      state.tr = size * 0.19;
    } else {
      state.tr = size * 0.24;
    }

    const ease = reduceMotion ? 1 : 0.14;
    state.x += (state.tx - state.x) * ease;
    state.y += (state.ty - state.y) * ease;
    state.r += (state.tr - state.r) * 0.1;

    frame.style.setProperty("--x", `${(state.x * 100).toFixed(2)}%`);
    frame.style.setProperty("--y", `${(state.y * 100).toFixed(2)}%`);
    frame.style.setProperty("--r", `${state.r.toFixed(1)}px`);

    raf = requestAnimationFrame(tick);
  }

  raf = requestAnimationFrame(tick);
}

/* ===== Tarjeta de preguntas rotativa ===== */

function setupHooks() {
  const card = $("#hookCard");
  const text = $("#hookText");
  if (!card || reduceMotion) return;

  let index = 0;
  let paused = false;
  card.addEventListener("mouseenter", () => { paused = true; });
  card.addEventListener("mouseleave", () => { paused = false; });
  card.addEventListener("focus", () => { paused = true; });
  card.addEventListener("blur", () => { paused = false; });

  window.setInterval(() => {
    if (paused || document.hidden) return;
    index = (index + 1) % HOOKS.length;
    text.classList.add("is-swapping");
    window.setTimeout(() => {
      text.textContent = HOOKS[index].text;
      card.href = `https://www.youtube.com/shorts/${HOOKS[index].id}`;
      text.classList.remove("is-swapping");
    }, 300);
  }, 4200);
}

/* ===== Vídeos (se actualizan solos) ===== */

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, { cache: "no-cache", signal: controller.signal });
    if (!response.ok) throw new Error(response.status);
    return await response.json();
  } finally {
    window.clearTimeout(timer);
  }
}

async function loadVideos() {
  const results = await Promise.allSettled(VIDEO_SOURCES.map(fetchJson));
  const valid = results
    .filter((result) => result.status === "fulfilled" && result.value?.latest?.length)
    .map((result) => result.value)
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  return valid[0] || FALLBACK_VIDEOS;
}

function thumb(id) {
  return `https://i.ytimg.com/vi/${id}/oardefault.jpg`;
}

// YouTube devuelve un 404 con una imagen gris de 120×90 cuando un Short no tiene
// miniatura vertical: se detecta por tamaño y se cambia por la miniatura estándar.
function setupThumbFallbacks(scope = document) {
  $$("img[data-fallback]", scope).forEach((img) => {
    const swap = () => {
      if (img.src !== img.dataset.fallback) img.src = img.dataset.fallback;
    };
    const check = () => {
      if (img.naturalWidth && img.naturalWidth <= 120) swap();
    };
    img.addEventListener("error", swap, { once: true });
    if (img.complete) check();
    else img.addEventListener("load", check, { once: true });
  });
}

function renderVideos(data) {
  const rail = $("#videoRail");
  const latest = data.latest.slice(0, 5);

  rail.innerHTML = latest.map((video, index) => {
    const isNew = Date.now() - new Date(video.published) < 7 * 86400000;
    const views = video.views ? ` · ${compact.format(video.views)} visual.` : "";
    return `
      <button class="video-card reveal" type="button" data-video="${escapeHtml(video.id)}" data-title="${escapeHtml(video.title)}" data-hitbox="Short ${index + 1}">
        <img src="${thumb(video.id)}" alt="" loading="${index < 3 ? "eager" : "lazy"}" data-fallback="https://i.ytimg.com/vi/${escapeHtml(video.id)}/hqdefault.jpg">
        ${isNew ? '<span class="video-card-new">NUEVO</span>' : ""}
        <span class="video-card-play" aria-hidden="true">▶</span>
        <span class="video-card-body">
          <span class="video-card-title">${escapeHtml(video.title)}</span>
          <span class="video-card-meta">${timeAgo(video.published)}${views}</span>
        </span>
        <span class="video-card-hitbox" aria-hidden="true"></span>
      </button>`;
  }).join("");

  setupThumbFallbacks(rail);

  // Etiqueta de tamaño en la "hitbox" de cada tarjeta
  const sizeObserver = new ResizeObserver((entries) => {
    entries.forEach((entry) => {
      const box = $(".video-card-hitbox", entry.target);
      if (box) box.dataset.size = `${Math.round(entry.contentRect.width)}×${Math.round(entry.contentRect.height)}`;
    });
  });
  $$(".video-card", rail).forEach((card) => sizeObserver.observe(card));

  $("#recordsList").innerHTML = (data.top || []).slice(0, 4).map((video, index) => `
    <li>
      <button class="record" type="button" data-video="${escapeHtml(video.id)}" data-title="${escapeHtml(video.title)}">
        <span class="record-rank">${index + 1}º</span>
        <span class="record-title">${escapeHtml(video.title)}</span>
        <span class="record-views">${compact.format(video.views)}</span>
      </button>
    </li>`).join("");

  renderStats(data);

  setupReveal(rail);
}

// "1,59 K" (texto de YouTube) -> 1590
function parseCompact(text = "") {
  const match = text.replace(/\s/g, "").match(/([\d.,]+)(K|M|mil)?/i);
  if (!match) return 0;
  const number = Number(match[1].replace(/\./g, "").replace(",", "."));
  const unit = (match[2] || "").toLowerCase();
  return Math.round(number * (unit === "m" ? 1e6 : unit ? 1e3 : 1));
}

function renderStats(data) {
  const setText = (selector, value) => {
    const element = $(selector);
    if (element && value) element.textContent = value;
  };

  if (data.channel?.totalViews) setText("#statViews", `+${compact.format(data.channel.totalViews)}`);
  if (data.top?.[0]) setText("#statTop", compact.format(data.top[0].views));

  const followers = {
    youtube: parseCompact(data.channel?.subscribersText),
    tiktok: data.socials?.tiktok?.followers || 0,
    instagram: data.socials?.instagram?.followers || 0
  };
  if (followers.youtube) setText("#ytFollowers", compact.format(followers.youtube));
  if (followers.tiktok) setText("#ttFollowers", compact.format(followers.tiktok));
  if (followers.instagram) setText("#igFollowers", compact.format(followers.instagram));

  const total = followers.youtube + followers.tiktok + followers.instagram;
  if (followers.youtube && followers.tiktok && followers.instagram) setText("#statFollowers", compact.format(total));
}

/* ===== Reproductor ===== */

function setupVideoModal() {
  const modal = $("#videoModal");
  const frame = $("#videoFrame");
  const link = $("#videoModalLink");

  const open = (id, title) => {
    frame.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&playsinline=1" title="${escapeHtml(title || "Vídeo de Centus Dev")}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    link.href = `https://www.youtube.com/shorts/${encodeURIComponent(id)}`;
    if (typeof modal.showModal === "function") {
      modal.showModal();
    } else {
      window.open(link.href, "_blank", "noopener");
    }
  };

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-video]");
    if (!trigger) return;
    event.preventDefault();
    open(trigger.dataset.video, trigger.dataset.title);
  });

  setupModalClose(modal, () => { frame.innerHTML = ""; });
}

function setupModalClose(modal, onClose) {
  modal.addEventListener("click", (event) => {
    if (event.target === modal || event.target.closest("[data-close]")) modal.close();
  });
  modal.addEventListener("close", () => onClose?.());
}

/* ===== Partidas guardadas: carrusel horizontal con disquetes ===== */

function setupSlots() {
  const track = $("#slots");
  const bar = $("#slotsBar");
  if (!track) return;
  const slots = $$(".slot", track);

  // La tarjeta más cercana al borde izquierdo es la "partida cargada"
  const setActive = () => {
    const left = track.getBoundingClientRect().left;
    let best = slots[0];
    let bestDistance = Infinity;
    slots.forEach((slot) => {
      const distance = Math.abs(slot.getBoundingClientRect().left - left);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = slot;
      }
    });
    slots.forEach((slot) => slot.classList.toggle("is-active", slot === best));
  };

  let ticking = false;
  const update = () => {
    const max = track.scrollWidth - track.clientWidth;
    const progress = max > 0 ? (track.scrollLeft + track.clientWidth) / track.scrollWidth : 1;
    bar.style.width = `${Math.min(100, progress * 100)}%`;
    setActive();
    ticking = false;
  };
  const requestUpdate = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };
  track.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
  update();

  const step = (dir) => {
    const slot = slots[0];
    const width = slot ? slot.getBoundingClientRect().width + 20 : 300;
    track.scrollBy({ left: width * dir, behavior: reduceMotion ? "auto" : "smooth" });
  };

  $$(".slots-btn").forEach((button) => {
    button.addEventListener("click", () => step(Number(button.dataset.dir)));
  });

  // Clic en una tarjeta: se "carga" esa partida. Clic en la activa: avanza a la siguiente.
  const goTo = (slot) => {
    const offset = slot.getBoundingClientRect().left - track.getBoundingClientRect().left - 6;
    track.scrollBy({ left: offset, behavior: reduceMotion ? "auto" : "smooth" });
  };

  slots.forEach((slot, index) => {
    slot.addEventListener("click", (event) => {
      if (event.target.closest("a") || justDragged) return;
      if (slot.classList.contains("is-active")) {
        goTo(slots[(index + 1) % slots.length]);
      } else {
        goTo(slot);
      }
    });
  });

  track.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      step(event.key === "ArrowRight" ? 1 : -1);
    }
  });

  // Arrastrar con el ratón
  let startX = 0;
  let startScroll = 0;
  let dragging = false;
  let moved = 0;
  let justDragged = false;
  track.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.target.closest("a")) return;
    dragging = true;
    moved = 0;
    startX = event.clientX;
    startScroll = track.scrollLeft;
  });
  track.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    moved = Math.max(moved, Math.abs(event.clientX - startX));
    // Solo es arrastre a partir de unos píxeles: así un clic normal llega a la tarjeta
    if (moved <= 6) return;
    if (!track.classList.contains("is-dragging")) {
      track.classList.add("is-dragging");
      track.setPointerCapture(event.pointerId);
    }
    track.scrollLeft = startScroll - (event.clientX - startX);
  });
  const stop = () => {
    // Un arrastre no debe contar como clic en la tarjeta que hay debajo
    if (moved > 6) {
      justDragged = true;
      window.setTimeout(() => { justDragged = false; }, 0);
    }
    moved = 0;
    dragging = false;
    track.classList.remove("is-dragging");
  };
  track.addEventListener("pointerup", stop);
  track.addEventListener("pointercancel", stop);
}

/* ===== Copiar email ===== */

function setupCopy() {
  $$("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(button.dataset.copy);
        button.textContent = "¡Copiado!";
      } catch {
        button.textContent = "Selecciónalo y copia";
      }
      button.classList.add("is-done");
      window.setTimeout(() => {
        button.textContent = "Copiar";
        button.classList.remove("is-done");
      }, 2000);
    });
  });
}

/* ===== Modo debug (recompensa del minijuego) ===== */

const DEBUG_KEY = "centus-debug-unlocked";

function setupDebug() {
  const toggle = $(".debug-toggle");
  const fps = $("#debugFps");
  const pos = $("#debugPos");
  let raf = 0;
  let frames = 0;
  let last = performance.now();

  const loop = (now) => {
    frames += 1;
    if (now - last > 500) {
      fps.textContent = `${Math.round((frames * 1000) / (now - last))} fps`;
      frames = 0;
      last = now;
    }
    raf = requestAnimationFrame(loop);
  };

  const set = (on) => {
    document.body.classList.toggle("is-debug", on);
    toggle.setAttribute("aria-pressed", String(on));
    cancelAnimationFrame(raf);
    if (on) raf = requestAnimationFrame(loop);
  };

  const unlock = () => {
    storage.set(DEBUG_KEY, "1");
    toggle.hidden = false;
  };

  if (storage.get(DEBUG_KEY) === "1") toggle.hidden = false;

  toggle.addEventListener("click", () => set(!document.body.classList.contains("is-debug")));

  document.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() !== "d" || toggle.hidden) return;
    if (event.target.closest("input, textarea, [contenteditable]") || event.metaKey || event.ctrlKey || event.altKey) return;
    if ($("dialog[open]")) return;
    set(!document.body.classList.contains("is-debug"));
  });

  document.addEventListener("pointermove", (event) => {
    if (document.body.classList.contains("is-debug")) {
      pos.textContent = `x ${event.pageX} · y ${event.pageY}`;
    }
  }, { passive: true });

  return { unlock, enable: () => set(true) };
}

/* ===== Minijuego secreto ===== */

function setupSecretGame(debug) {
  const car = $("#secretCar");
  const modal = $("#gameModal");
  const canvas = $("#gameCanvas");
  let game = null;
  let loading = null;

  const loadGame = () => {
    if (window.CentusGame) return Promise.resolve(window.CentusGame);
    if (!loading) {
      loading = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "centus-game.js?v=12";
        script.onload = () => resolve(window.CentusGame);
        script.onerror = reject;
        document.head.append(script);
      });
    }
    return loading;
  };

  car.addEventListener("click", async () => {
    modal.showModal();
    const CentusGame = await loadGame();
    game = CentusGame.create(canvas, {
      touchButtons: $$(".game-touch button", modal),
      onWin: () => debug.unlock(),
      onDebug: () => {
        modal.close();
        debug.enable();
      }
    });
  });

  setupModalClose(modal, () => {
    game?.destroy();
    game = null;
  });
}

/* ===== Inicio ===== */

function init() {
  $("#year").textContent = new Date().getFullYear();
  setupHeader();
  setupReveal();
  setupThumbFallbacks();
  setupXray();
  setupHooks();
  setupVideoModal();
  setupSlots();
  setupCopy();
  const debug = setupDebug();
  setupSecretGame(debug);

  // Esqueletos mientras llegan los datos
  $("#videoRail").innerHTML = '<div class="video-skeleton"></div>'.repeat(5);
  loadVideos().then(renderVideos).catch(() => renderVideos(FALLBACK_VIDEOS));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
