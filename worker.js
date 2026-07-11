import { canonicalAppUrl, canonicalAssetUrl } from "./src/urls.js";

const DEFAULT_TITLE = "Wordle in One";
const DEFAULT_DESCRIPTION = "Five Wordle boards. One possible answer each.";
const SHARE_SEED_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
const SHARE_SEED_LENGTH = 6;
const SHARE_SEED_CHARACTERS = new Set(SHARE_SEED_ALPHABET);

export function normalizeChallengeCode(input) {
  return String(input ?? "")
    .toLowerCase()
    .split("")
    .filter((character) => SHARE_SEED_CHARACTERS.has(character))
    .join("")
    .slice(0, SHARE_SEED_LENGTH);
}

function displayChallengeCode(code) {
  return code.toUpperCase();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function previewMetaForUrl(href) {
  const url = new URL(href);
  const challengeCode = normalizeChallengeCode(url.searchParams.get("seed"));
  const hasChallenge = challengeCode.length >= 4;
  const displayCode = displayChallengeCode(challengeCode);
  const title = hasChallenge ? `Wordle in One Challenge ${displayCode}` : DEFAULT_TITLE;
  const description = hasChallenge
    ? `Challenge ${displayCode}: five Wordle boards, one possible answer each.`
    : DEFAULT_DESCRIPTION;
  const image = canonicalAssetUrl("/share-preview.png");

  return {
    title,
    description,
    image,
    imageAlt: `${title} preview`,
    url: canonicalAppUrl(hasChallenge ? challengeCode : "")
  };
}

function replaceTitle(html, title) {
  return html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
}

function replaceMetaContent(html, attribute, key, content) {
  const tagPattern = new RegExp(`<meta\\s+[^>]*${attribute}="${escapeRegExp(key)}"[^>]*>`, "i");

  return html.replace(tagPattern, (tag) =>
    tag.replace(/\scontent="[^"]*"/i, ` content="${escapeAttribute(content)}"`)
  );
}

function replaceLinkHref(html, rel, href) {
  const tagPattern = new RegExp(`<link\\s+[^>]*rel="${escapeRegExp(rel)}"[^>]*>`, "i");

  return html.replace(tagPattern, (tag) =>
    tag.replace(/\shref="[^"]*"/i, ` href="${escapeAttribute(href)}"`)
  );
}

export function applyPreviewMeta(html, meta) {
  let next = replaceTitle(html, meta.title);

  next = replaceMetaContent(next, "name", "description", meta.description);
  next = replaceMetaContent(next, "property", "og:title", meta.title);
  next = replaceMetaContent(next, "property", "og:description", meta.description);
  next = replaceMetaContent(next, "property", "og:url", meta.url);
  next = replaceMetaContent(next, "property", "og:image", meta.image);
  next = replaceMetaContent(next, "property", "og:image:secure_url", meta.image);
  next = replaceMetaContent(next, "property", "og:image:alt", meta.imageAlt);
  next = replaceMetaContent(next, "name", "twitter:title", meta.title);
  next = replaceMetaContent(next, "name", "twitter:description", meta.description);
  next = replaceMetaContent(next, "name", "twitter:image", meta.image);
  next = replaceMetaContent(next, "name", "twitter:image:alt", meta.imageAlt);
  next = replaceLinkHref(next, "canonical", meta.url);

  return next;
}

function shouldRewriteHtml(request) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return false;
  }

  const { pathname } = new URL(request.url);
  return pathname === "/" || pathname === "/index.html";
}

async function htmlResponse(request, env) {
  const assetRequest = new Request("https://assets.local/index.html", {
    headers: request.headers,
    method: "GET"
  });
  const response = await env.ASSETS.fetch(assetRequest);
  const html = applyPreviewMeta(await response.text(), previewMetaForUrl(request.url));
  const headers = new Headers(response.headers);

  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "public, max-age=300, must-revalidate");
  headers.delete("content-encoding");
  headers.delete("content-length");
  headers.delete("etag");

  return new Response(request.method === "HEAD" ? null : html, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export default {
  async fetch(request, env) {
    if (shouldRewriteHtml(request)) {
      return htmlResponse(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};
