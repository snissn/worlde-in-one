export const CANONICAL_ORIGIN = "https://wordle-in-one.com";

export function canonicalAppUrl(seed = "") {
  const url = new URL("/", CANONICAL_ORIGIN);

  if (seed) {
    url.searchParams.set("seed", seed);
  }

  return url.toString();
}

export function canonicalAssetUrl(pathname) {
  return new URL(pathname, CANONICAL_ORIGIN).toString();
}

export function deploymentAppUrl(href, seed) {
  const url = new URL(href);
  url.searchParams.set("seed", seed);
  return url.toString();
}
