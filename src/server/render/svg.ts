/**
 * SVG renderers used by the mock providers and the seed script.
 * They let the full product flow run without any AI keys, and are clearly marked as previews.
 */
import { escapeXml, hashString, seededRandom } from "@/lib/utils";

const PALETTES = [
  ["#F4EDE4", "#E3D3C1", "#C9B29B"],
  ["#EEF1F6", "#D6DEEA", "#AFC0D8"],
  ["#F6EEF2", "#EBD3DE", "#D6A9BE"],
  ["#EEF4EF", "#D2E3D5", "#A9C9AF"],
  ["#F5F1E8", "#E8DCC2", "#CDB78C"],
  ["#EFEDF7", "#DAD5F0", "#B6ACE3"],
  ["#1E1E24", "#2E2E38", "#4A4A5A"],
];

export function paletteFor(key: string) {
  return PALETTES[hashString(key) % PALETTES.length];
}

/* ── Creator avatar (illustrated portrait) ─────────────────────── */

const SKIN = ["#F3D6C1", "#E8BFA0", "#D7A27E", "#B97E57", "#8D5A3B", "#5E3A26"];
const HAIR = { black: "#1B1716", brown: "#4A2F22", blonde: "#D8B46A", red: "#9C3F22", grey: "#A9A6A3", auburn: "#7A3B23" };

export function renderAvatarSvg(opts: { name: string; skinIndex: number; hairColor: keyof typeof HAIR; hairLength: "short" | "long" | "medium" | "curly" | "buzz"; bg: [string, string]; outfit: string }) {
  const skin = SKIN[opts.skinIndex % SKIN.length];
  const hair = HAIR[opts.hairColor];
  const hairShape =
    opts.hairLength === "long"
      ? `<path d="M118 150c0-60 40-92 82-92s82 32 82 92v140c-18 10-36 12-46 8V170c-20-14-52-14-72 0v128c-10 4-28 2-46-8z" fill="${hair}"/>`
      : opts.hairLength === "medium"
        ? `<path d="M120 160c0-62 38-96 80-96s80 34 80 96v60c-10 6-20 6-28 2v-56c-26-18-78-18-104 0v56c-8 4-18 4-28-2z" fill="${hair}"/>`
        : opts.hairLength === "curly"
          ? `<g fill="${hair}">${Array.from({ length: 14 }, (_, i) => {
              const a = (Math.PI * (i + 0.5)) / 14;
              return `<circle cx="${200 - Math.cos(a) * 78}" cy="${150 - Math.sin(a) * 82}" r="26"/>`;
            }).join("")}</g>`
          : opts.hairLength === "buzz"
            ? `<path d="M134 150c0-52 30-80 66-80s66 28 66 80c-20-18-112-18-132 0z" fill="${hair}" opacity=".85"/>`
            : `<path d="M128 156c0-58 34-90 72-90s72 32 72 90c-14-26-30-34-72-34s-58 8-72 34z" fill="${hair}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" width="400" height="500">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${opts.bg[0]}"/><stop offset="1" stop-color="${opts.bg[1]}"/></linearGradient></defs>
  <rect width="400" height="500" fill="url(#bg)"/>
  <path d="M70 500c0-96 58-150 130-150s130 54 130 150z" fill="${opts.outfit}"/>
  <rect x="176" y="250" width="48" height="70" rx="20" fill="${skin}"/>
  <ellipse cx="200" cy="190" rx="70" ry="84" fill="${skin}"/>
  ${hairShape}
  <ellipse cx="174" cy="196" rx="6" ry="7" fill="#2a1d18" opacity=".8"/>
  <ellipse cx="226" cy="196" rx="6" ry="7" fill="#2a1d18" opacity=".8"/>
  <path d="M184 238q16 12 32 0" stroke="#8c4a3c" stroke-width="5" fill="none" stroke-linecap="round"/>
</svg>`;
}

/* ── Photo preview (mock image provider) ───────────────────────── */

const ASPECT_SIZE: Record<string, [number, number]> = { "1:1": [1080, 1080], "4:5": [1080, 1350], "9:16": [1080, 1920] };

export function renderPhotoPreviewSvg(opts: {
  productDataUri: string;
  creatorAvatarDataUri?: string | null;
  creatorName?: string | null;
  title: string;
  presetLabel: string;
  location: string;
  camera: string;
  aspect: string;
  seed: number;
}) {
  const [w, h] = ASPECT_SIZE[opts.aspect] ?? ASPECT_SIZE["4:5"];
  const rand = seededRandom(opts.seed);
  const pal = paletteFor(opts.location + opts.presetLabel);
  const dark = pal[0] === "#1E1E24";
  const text = dark ? "#FFFFFF" : "#16161D";
  const rot = (rand() * 8 - 4).toFixed(2);
  const scale = 0.62 + rand() * 0.14;
  const pw = w * scale;
  const ph = h * scale * 0.82;
  const px = (w - pw) / 2 + (rand() * 80 - 40);
  const py = h * 0.12 + rand() * 40;
  const blobs = Array.from({ length: 3 }, (_, i) => {
    const cx = rand() * w;
    const cy = rand() * h;
    return `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${(260 + rand() * 260).toFixed(0)}" fill="${pal[(i % 2) + 1]}" opacity=".55"/>`;
  }).join("");
  const avatar = opts.creatorAvatarDataUri
    ? `<g transform="translate(64 ${h - 210})">
        <rect width="${Math.min(560, 200 + (opts.creatorName?.length ?? 0) * 22)}" height="140" rx="70" fill="${dark ? "#ffffff22" : "#ffffffcc"}"/>
        <clipPath id="av"><circle cx="70" cy="70" r="54"/></clipPath>
        <image href="${opts.creatorAvatarDataUri}" x="16" y="6" width="108" height="135" clip-path="url(#av)" preserveAspectRatio="xMidYMid slice"/>
        <text x="146" y="62" font-family="Inter,Arial" font-size="30" font-weight="600" fill="${text}">${escapeXml(opts.creatorName ?? "")}</text>
        <text x="146" y="100" font-family="Inter,Arial" font-size="24" fill="${text}" opacity=".6">AI creator</text>
      </g>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${pal[0]}"/><stop offset="1" stop-color="${pal[1]}"/></linearGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="90"/></filter>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="40" stdDeviation="40" flood-opacity=".22"/></filter>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <g filter="url(#blur)">${blobs}</g>
  <ellipse cx="${w / 2}" cy="${py + ph + 30}" rx="${pw * 0.42}" ry="40" fill="#000" opacity=".12" filter="url(#blur)"/>
  <g transform="rotate(${rot} ${w / 2} ${h / 2})" filter="url(#shadow)">
    <image href="${opts.productDataUri}" x="${px.toFixed(0)}" y="${py.toFixed(0)}" width="${pw.toFixed(0)}" height="${ph.toFixed(0)}" preserveAspectRatio="xMidYMid meet"/>
  </g>
  <g font-family="Inter,Arial" fill="${text}">
    <text x="64" y="96" font-size="28" font-weight="600" letter-spacing="4" opacity=".55">${escapeXml(opts.presetLabel.toUpperCase())}</text>
    <text x="64" y="140" font-size="26" opacity=".5">${escapeXml(opts.location)} · ${escapeXml(opts.camera)}</text>
  </g>
  ${avatar}
  <text x="${w - 64}" y="${h - 60}" text-anchor="end" font-family="Inter,Arial" font-size="22" fill="${text}" opacity=".4">PREVIEW · connect an image provider for photoreal output</text>
</svg>`;
}

/* ── Video preview (mock video provider): animated storyboard ───── */

export function renderVideoPreviewSvg(opts: {
  productDataUri: string;
  creatorAvatarDataUri?: string | null;
  creatorName?: string | null;
  presetLabel: string;
  scenes: { title: string; overlay?: string; line?: string; durationSec: number }[];
  seed: number;
}) {
  const w = 1080;
  const h = 1920;
  const total = Math.max(1, opts.scenes.reduce((s, x) => s + x.durationSec, 0));
  const pal = paletteFor(opts.presetLabel + opts.seed);
  let t = 0;
  const frames = opts.scenes.map((s, i) => {
    const start = t / total;
    t += s.durationSec;
    const end = t / total;
    const eps = 0.0001;
    const kt = [0, Math.max(0, start - eps), start, Math.max(start, end - eps), end, 1]
      .map((v) => Math.min(1, Math.max(0, v)).toFixed(4));
    const values = i === 0 ? "1;1;1;1;0;0" : "0;0;1;1;0;0";
    const zoomFrom = i % 2 === 0 ? 1 : 1.18;
    const zoomTo = i % 2 === 0 ? 1.18 : 1;
    const caption = escapeXml(s.overlay || s.line || s.title);
    const lines = wrap(caption, 26);
    return `<g opacity="${i === 0 ? 1 : 0}">
      <animate attributeName="opacity" values="${values}" keyTimes="${kt.join(";")}" dur="${total}s" repeatCount="indefinite"/>
      <rect width="${w}" height="${h}" fill="${i % 2 ? pal[1] : pal[0]}"/>
      <g transform="translate(${w / 2} ${h * 0.46})">
        <g>
          <animateTransform attributeName="transform" type="scale" values="${zoomFrom};${zoomTo}" dur="${s.durationSec}s" repeatCount="indefinite"/>
          <image href="${opts.productDataUri}" x="-420" y="-520" width="840" height="1040" preserveAspectRatio="xMidYMid meet"/>
        </g>
      </g>
      <g font-family="Inter,Arial" text-anchor="middle">
        ${lines.map((ln, j) => `<text x="${w / 2}" y="${h * 0.78 + j * 74}" font-size="60" font-weight="800" fill="#fff" stroke="#000" stroke-width="10" paint-order="stroke" stroke-linejoin="round">${ln}</text>`).join("")}
      </g>
      <text x="60" y="140" font-family="Inter,Arial" font-size="34" font-weight="700" fill="#16161D" opacity=".55">${i + 1}/${opts.scenes.length} · ${escapeXml(s.title)}</text>
    </g>`;
  });
  const avatar = opts.creatorAvatarDataUri
    ? `<clipPath id="vav"><circle cx="${w - 120}" cy="${h - 520}" r="62"/></clipPath>
       <circle cx="${w - 120}" cy="${h - 520}" r="68" fill="#fff"/>
       <image href="${opts.creatorAvatarDataUri}" x="${w - 182}" y="${h - 600}" width="124" height="155" clip-path="url(#vav)" preserveAspectRatio="xMidYMid slice"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  ${frames.join("\n")}
  ${avatar}
  <rect x="60" y="60" width="${w - 120}" height="8" rx="4" fill="#00000022"/>
  <rect x="60" y="60" width="0" height="8" rx="4" fill="#16161D">
    <animate attributeName="width" from="0" to="${w - 120}" dur="${total}s" repeatCount="indefinite"/>
  </rect>
  <text x="${w / 2}" y="${h - 60}" text-anchor="middle" font-family="Inter,Arial" font-size="26" fill="#16161D" opacity=".45">STORYBOARD PREVIEW · connect a video provider for rendered video</text>
</svg>`;
}

function wrap(text: string, max: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    if ((cur + " " + word).trim().length > max) {
      if (cur) lines.push(cur);
      cur = word;
    } else cur = (cur + " " + word).trim();
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 4);
}
