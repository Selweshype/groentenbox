/* api.js — kleine adapter: zelfde vorm als claude.ai's `sample`, maar praat
   rechtstreeks met de Anthropic Messages API vanuit de browser.

   sample(prompt, {signal, onText, effort, images, modelTier}) -> Promise<string>
   sample.json(prompt, opts)                                   -> Promise<any>
   sample.limits()                                             -> Promise<{images:true}>
   Fouten worden gegooid als {code}, net als bij het origineel. */

// Modellen (bron: Anthropic model-overzicht). Snel voor uitlezen en "Ander recept",
// sterker voor het weekmenu.
export const MODEL_FAST = "claude-haiku-5-5";
export const MODEL_STRONG = "claude-opus-5-5";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
// Server-side fallback: als Claude een verzoek weigert, probeert de API het zelf
// op een ander model. Alleen voor het sterke model (Haiku heeft geen fallback).
const FALLBACK_BETA = "server-side-fallback-2026-07-01";
const MAX_SIDE = 1568;
const KEY_NAME = "gbk.apikey";

/* ---------- Sleutel: alleen in localStorage ---------- */
export const apiKey = {
  get() { try { return localStorage.getItem(KEY_NAME) || ""; } catch { return ""; } },
  set(v) { try { localStorage.setItem(KEY_NAME, v); } catch {} },
  clear() { try { localStorage.removeItem(KEY_NAME); } catch {} }
};

/* ---------- Afbeeldingen: verkleinen tot max 1568 px, base64 ---------- */
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject({ code: "image_rejected" }); };
    img.src = url;
  });
}
async function imageBlock(file) {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); // transparante PNG's niet zwart maken
  ctx.drawImage(img, 0, 0, w, h);
  const data = c.toDataURL("image/jpeg", 0.9).split(",")[1];
  return { type: "image", source: { type: "base64", media_type: "image/jpeg", data } };
}

/* ---------- Request ---------- */
function buildBody(content, opts, stream) {
  const strong = opts.modelTier !== "quick";
  const body = {
    model: strong ? MODEL_STRONG : MODEL_FAST,
    max_tokens: stream ? 32000 : 16000,
    messages: [{ role: "user", content }],
    output_config: { effort: opts.effort || "low" }
  };
  if (stream) body.stream = true;
  if (strong) body.fallbacks = "default";
  return body;
}
async function request(prompt, opts, stream) {
  const key = apiKey.get();
  if (!key) throw { code: "no_key" };
  const content = [];
  for (const f of opts.images || []) content.push(await imageBlock(f));
  content.push({ type: "text", text: prompt });
  const body = buildBody(content, opts, stream);
  const headers = {
    "content-type": "application/json",
    "x-api-key": key,
    "anthropic-version": API_VERSION,
    "anthropic-dangerous-direct-browser-access": "true"
  };
  if (body.fallbacks) headers["anthropic-beta"] = FALLBACK_BETA;
  let res;
  try {
    res = await fetch(API_URL, { method: "POST", headers, body: JSON.stringify(body), signal: opts.signal });
  } catch (e) {
    throw e?.name === "AbortError" ? { code: "cancelled" } : { code: "network" };
  }
  if (!res.ok) throw await httpError(res, opts.images?.length);
  return res;
}
async function httpError(res, hadImages) {
  let m = "";
  try { m = String((await res.json())?.error?.message || ""); } catch {}
  const low = m.toLowerCase();
  if (res.status === 401 || res.status === 403) return { code: "bad_key" };
  if (res.status === 402 || low.includes("credit balance")) return { code: "no_credit" };
  if (res.status === 429) return { code: "rate_limited" };
  if (res.status === 400 && hadImages && low.includes("image")) return { code: "image_rejected" };
  if (res.status === 529 || res.status >= 500) return { code: "overloaded" };
  return { code: "http", status: res.status, message: m };
}
function streamError(err) {
  const t = err?.type || "";
  if (t === "overloaded_error" || t === "api_error") return { code: "overloaded" };
  if (t === "rate_limit_error") return { code: "rate_limited" };
  if (t === "authentication_error") return { code: "bad_key" };
  return { code: "http", message: err?.message };
}

/* ---------- SSE: tekst stukje voor stukje doorgeven ---------- */
async function readStream(res, onText, signal) {
  const reader = res.body.getReader(), dec = new TextDecoder();
  let buf = "", text = "", stop = null;
  const handle = line => {
    if (!line.startsWith("data:")) return;
    let ev; try { ev = JSON.parse(line.slice(5).trim()); } catch { return; }
    if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
      text += ev.delta.text; onText?.({ delta: ev.delta.text, text });
    } else if (ev.type === "message_delta" && ev.delta?.stop_reason) {
      stop = ev.delta.stop_reason;
    } else if (ev.type === "error") {
      throw streamError(ev.error);
    }
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop();
      lines.forEach(handle);
    }
    handle(buf);
  } catch (e) {
    if (e?.code) throw e;
    throw signal?.aborted || e?.name === "AbortError" ? { code: "cancelled" } : { code: "network" };
  }
  if (stop === "refusal") throw { code: "refused" };
  return text;
}

/* ---------- Publieke vorm ---------- */
export async function sample(prompt, opts = {}) {
  const res = await request(prompt, opts, true);
  return readStream(res, opts.onText, opts.signal);
}
sample.json = async (prompt, opts = {}) => {
  const res = await request(prompt, opts, false);
  let data;
  try { data = await res.json(); } catch (e) { throw opts.signal?.aborted ? { code: "cancelled" } : { code: "network" }; }
  if (data.stop_reason === "refusal") throw { code: "refused" };
  const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  return parseJson(text);
};
sample.limits = async () => ({ images: true });

function parseJson(text) {
  const t = text.replace(/```(?:json)?/gi, "").trim();
  try { return JSON.parse(t); } catch {}
  const a = t.search(/[[{]/), b = Math.max(t.lastIndexOf("]"), t.lastIndexOf("}"));
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch {} }
  throw { code: "invalid_json" };
}
