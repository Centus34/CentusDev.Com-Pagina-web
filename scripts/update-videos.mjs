// Actualiza data/videos.json con los últimos Shorts de youtube.com/@CentusDev
// y los seguidores de YouTube, TikTok e Instagram.
//
// Fuentes (todas públicas, sin API key):
//   1. Feed RSS de la lista de Shorts del canal  -> datos exactos de los ~15 últimos Shorts.
//   2. Pestaña /shorts del canal                -> títulos y visitas (redondeadas) de Shorts antiguos.
//   3. Página /about del canal                  -> visualizaciones totales y suscriptores.
//   4. Perfiles públicos de TikTok e Instagram  -> seguidores.
//
// Si alguna fuente falla, se conservan los datos anteriores: el JSON nunca se vacía.
// Uso: node scripts/update-videos.mjs   (lo ejecuta .github/workflows/update-videos.yml)

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CHANNEL_ID = "UCvpACFi3Lidlauv1GoH4f8w";
const HANDLE = "CentusDev";
const TIKTOK = "centusdev";
const INSTAGRAM = "centusdev";
const SHORTS_FEED = `https://www.youtube.com/feeds/videos.xml?playlist_id=UUSH${CHANNEL_ID.slice(2)}`;
const CHANNEL_FEED = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
const LATEST_COUNT = 8;
const TOP_COUNT = 4;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outFile = join(root, "data", "videos.json");

const headers = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36",
  "Accept-Language": "es-ES,es;q=0.9"
};

async function getText(url, extraHeaders = {}) {
  const response = await fetch(url, { headers: { ...headers, ...extraHeaders } });
  if (!response.ok) {
    throw new Error(`${url} -> HTTP ${response.status}`);
  }
  return response.text();
}

function decodeXml(value = "") {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function pick(block, regex) {
  const match = block.match(regex);
  return match ? decodeXml(match[1].trim()) : "";
}

function parseFeed(xml) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, block]) => ({
    id: pick(block, /<yt:videoId>([^<]+)<\/yt:videoId>/),
    title: pick(block, /<title>([^<]*)<\/title>/),
    published: pick(block, /<published>([^<]+)<\/published>/),
    views: Number(pick(block, /<media:statistics views="(\d+)"/)) || 0,
    description: pick(block, /<media:description>([\s\S]*?)<\/media:description>/).split("\n")[0].slice(0, 160),
    exact: true
  })).filter((video) => video.id);
}

// "562 mil visualizaciones" / "1,2 M de visualizaciones" / "92 visualizaciones" -> número aproximado
function parseSpanishCount(text) {
  const match = text.match(/([\d.,]+)\s*(mil|K|M|millones?)?/i);
  if (!match) {
    return 0;
  }
  const number = Number(match[1].replace(/\./g, "").replace(",", "."));
  const unit = (match[2] || "").toLowerCase();
  if (unit === "mil" || unit === "k") return Math.round(number * 1e3);
  if (unit.startsWith("m")) return Math.round(number * 1e6);
  return Math.round(number);
}

function parseShortsTab(html) {
  return html.split("shortsLockupViewModel").slice(1).map((chunk) => {
    const id = (chunk.match(/"videoId":"([A-Za-z0-9_-]{11})"/) || [])[1];
    const label = (chunk.match(/"accessibilityText":"([^"]{3,200})"/) || [])[1];
    if (!id || !label) {
      return null;
    }
    const [title, rest = ""] = label.split(/,\s(?=[\d.,]+\s*(?:mil|K|M)?\s*(?:de\s)?visualizaci)/i);
    return { id, title: title.trim(), views: parseSpanishCount(rest), exact: false };
  }).filter(Boolean);
}

function parseAbout(html) {
  const views = (html.match(/"viewCountText":"([\d.,\s]+)\s*visualizaciones"/) || [])[1];
  const subscribers = (html.match(/"subscriberCountText":"([^"]+)"/) || [])[1];
  return {
    totalViews: views ? Number(views.replace(/[^\d]/g, "")) : null,
    subscribersText: subscribers ? subscribers.replace(/\s*suscriptores?/i, "").trim() : null
  };
}

// Seguidores de TikTok e Instagram (páginas públicas). Pueden bloquear peticiones
// automáticas: en ese caso se mantiene el último valor conocido.
async function getTikTokFollowers() {
  const html = await getText(`https://www.tiktok.com/@${TIKTOK}`);
  const match = html.match(/"followerCount":(\d+)/);
  if (!match) throw new Error("TikTok: sin followerCount");
  return Number(match[1]);
}

async function getInstagramFollowers() {
  // Con un User-Agent mínimo Instagram devuelve la versión con metaetiquetas og:
  const html = await getText(`https://www.instagram.com/${INSTAGRAM}/`, { "User-Agent": "Mozilla/5.0" });
  const match = html.match(/content="([\d.,]+)\s*([KkMm])?\s*(?:Followers|seguidores)/i);
  if (!match) throw new Error("Instagram: sin seguidores en og:description");
  const base = Number(match[1].replace(/,/g, ""));
  const unit = (match[2] || "").toLowerCase();
  return Math.round(unit === "k" ? base * 1e3 : unit === "m" ? base * 1e6 : base);
}

async function loadPrevious() {
  try {
    return JSON.parse(await readFile(outFile, "utf8"));
  } catch {
    return { archive: {}, channel: {} };
  }
}

async function main() {
  const previous = await loadPrevious();
  const archive = { ...(previous.archive || {}) };
  const channel = { ...(previous.channel || {}) };
  const warnings = [];

  let feedVideos = [];
  for (const url of [SHORTS_FEED, CHANNEL_FEED]) {
    try {
      feedVideos = parseFeed(await getText(url));
      if (feedVideos.length) break;
    } catch (error) {
      warnings.push(error.message);
    }
  }

  try {
    const tab = parseShortsTab(await getText(`https://www.youtube.com/@${HANDLE}/shorts?hl=es&gl=ES`));
    tab.forEach((video) => {
      const known = archive[video.id];
      // Una cifra exacta antigua solo se sustituye si la redondeada ya es mayor.
      if (!known || !known.exact || video.views > known.views) {
        archive[video.id] = { ...known, ...video };
      }
    });
  } catch (error) {
    warnings.push(error.message);
  }

  feedVideos.forEach((video) => {
    archive[video.id] = { ...archive[video.id], ...video };
  });

  try {
    const about = parseAbout(await getText(`https://www.youtube.com/@${HANDLE}/about?hl=es&gl=ES`));
    if (about.totalViews) channel.totalViews = about.totalViews;
    if (about.subscribersText) channel.subscribersText = about.subscribersText;
  } catch (error) {
    warnings.push(error.message);
  }

  const socials = { ...(previous.socials || {}) };
  for (const [key, getter] of [["tiktok", getTikTokFollowers], ["instagram", getInstagramFollowers]]) {
    try {
      socials[key] = { followers: await getter(), checkedAt: new Date().toISOString() };
    } catch (error) {
      warnings.push(error.message);
    }
  }

  const latest = (feedVideos.length ? feedVideos : previous.latest || [])
    .slice()
    .sort((a, b) => new Date(b.published) - new Date(a.published))
    .slice(0, LATEST_COUNT);

  const top = Object.values(archive)
    .sort((a, b) => b.views - a.views)
    .slice(0, TOP_COUNT)
    .map(({ id, title, views }) => ({ id, title, views }));

  if (!latest.length && !Object.keys(archive).length) {
    throw new Error(`Sin datos de YouTube. ${warnings.join(" | ")}`);
  }

  const data = {
    updatedAt: new Date().toISOString(),
    channel: { handle: `@${HANDLE}`, id: CHANNEL_ID, ...channel },
    socials,
    latest,
    top,
    archive
  };

  // Las fechas de comprobación no cuentan como cambio (evita commits cada 6 h sin novedades)
  const comparable = (value) => JSON.stringify({ ...value, updatedAt: null }, (key, v) => (key === "checkedAt" ? undefined : v));
  const sameContent = comparable(previous) === comparable(data);
  if (sameContent) {
    console.log("Sin cambios.");
    warnings.forEach((warning) => console.warn(`Aviso: ${warning}`));
    return;
  }

  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`OK: ${latest.length} recientes, ${Object.keys(archive).length} en archivo, top: ${top.map((v) => v.views).join(", ")}`);
  warnings.forEach((warning) => console.warn(`Aviso: ${warning}`));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
