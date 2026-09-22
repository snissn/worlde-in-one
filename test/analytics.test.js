import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { initializeAnalytics, trackEvent } from "../src/analytics.js";
import { dateKeyForPuzzle } from "../src/puzzle.js";

test("GA loads once on production, excludes challenge identifiers, and preserves attribution", () => {
  const scripts = [];
  const window = {
    location: new URL("https://word-in-one.com/?seed=abc234&utm_source=friends&utm_medium=share#abc234"),
    document: {
      referrer: "https://word-in-one.com/?seed=abc234",
      createElement: () => ({}),
      head: { append: (script) => scripts.push(script) }
    }
  };
  initializeAnalytics(window);
  initializeAnalytics(window);
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].async, true);
  const config = window.dataLayer[1][2];
  assert.equal(config.page_location, "https://word-in-one.com/?utm_source=friends&utm_medium=share");
  assert.equal(config.page_referrer, "https://word-in-one.com/");
  assert.equal(config.page_title, "Word in One");
  trackEvent("level_end", { game_mode: "daily", seed: "abc234", guess: "cigar", answer: "cigar" }, undefined, window);
  assert.deepEqual(window.dataLayer[2][2], { game_name: "word_in_one", game_mode: "daily" });
  assert.doesNotMatch(JSON.stringify(window.dataLayer), /abc234|cigar/);
});

test("local and preview traffic stays out of GA, and missing or broken telemetry is harmless", () => {
  for (const hostname of ["localhost", "127.0.0.1", "preview.workers.dev", "word-in-one.com.evil.example"]) {
    const window = {
      location: new URL(`https://${hostname}/`),
      gtag: () => assert.fail("non-production event sent")
    };
    initializeAnalytics(window);
    trackEvent("game_ready", {}, undefined, window);
  }
  for (const hostname of ["word-in-one.com", "www.word-in-one.com", "wordle-in-one.com", "www.wordle-in-one.com"]) {
    const window = { location: new URL(`https://${hostname}/`) };
    assert.doesNotThrow(() => trackEvent("game_ready", {}, undefined, window));
    let called = false;
    window.gtag = () => { called = true; throw new Error("blocked"); };
    assert.doesNotThrow(() => trackEvent("game_ready", {}, undefined, window));
    assert.equal(called, true);
  }
});

// The game uses a small DOM surface; exercise its real handlers without a browser dependency.
class Element {
  constructor(tagName = "div") {
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.listeners = new Map();
    this.style = { setProperty() {} };
    const classes = new Set();
    this.classList = {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
      toggle: (name, on) => on ? classes.add(name) : classes.delete(name)
    };
  }
  set innerHTML(value) { this.children = []; }
  append(...children) {
    for (const child of children) { child.parentElement = this; this.children.push(child); }
  }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  setAttribute() {}
  removeAttribute() {}
  addEventListener(name, callback) {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), callback]);
  }
  dispatch(name, values = {}) {
    for (const callback of this.listeners.get(name) ?? []) {
      callback({ target: this, preventDefault() {}, stopPropagation() {}, ...values });
    }
  }
  querySelectorAll() {
    return this.children.flatMap((child) => [child, ...child.querySelectorAll()]).filter((child) => child.tagName === "button");
  }
  querySelector(selector) {
    if (selector === ".completion-share-label") return this.label ??= new Element();
    return this.querySelectorAll().find((child) => child.dataset.key === "enter");
  }
  matches() { return ["a", "button", "input", "textarea", "select"].includes(this.tagName); }
  showModal() { this.open = true; }
  close() { this.open = false; }
  focus() {}
  remove() { this.parentElement.children = this.parentElement.children.filter((child) => child !== this); }
  get firstElementChild() { return this.children[0]; }
}

const annual = JSON.parse(await readFile(new URL("../daily/2026.json", import.meta.url), "utf8"));
const encoded = Object.values(annual.days)[0];
let appNumber = 0;
const settle = () => new Promise((resolve) => setImmediate(resolve));

async function loadApp(storage = new Map(), navigator = {}) {
  const elements = new Map();
  const events = [];
  const timers = new Map();
  const navigations = [];
  let nextTimer = 0;
  const document = Object.assign(new Element("document"), {
    documentElement: new Element(), body: new Element("body"), referrer: "",
    querySelector: (selector) => {
      if (!elements.has(selector)) elements.set(selector, new Element());
      return elements.get(selector);
    },
    createElement: (tag) => new Element(tag),
    createElementNS: (_, tag) => new Element(tag)
  });
  const location = new URL("https://word-in-one.com/?utm_source=friends");
  location.assign = (href) => { navigations.push(href); location.href = href; };
  const window = {
    document, location, innerHeight: 800,
    gtag: (kind, name, parameters) => events.push({ kind, name, ...parameters }),
    requestAnimationFrame: (callback) => queueMicrotask(callback),
    setTimeout: (callback, delay) => { timers.set(++nextTimer, { callback, delay }); return nextTimer; },
    clearTimeout: (id) => timers.delete(id),
    addEventListener() {},
    localStorage: { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value) }
  };
  Object.assign(globalThis, { window, document, HTMLElement: Element, HTMLButtonElement: Element });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: navigator });
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ version: 1, days: { [dateKeyForPuzzle()]: encoded } }) });
  await import(`../src/main.js?test=${++appNumber}`);
  for (let attempt = 0; !events.some((event) => event.name === "game_ready") && attempt < 30; attempt++) await settle();
  assert.equal(events.filter((event) => event.name === "game_ready").length, 1);
  return {
    events, storage, navigator, location, window, timers, navigations,
    click: (selector) => elements.get(selector).dispatch("click"),
    key: (key) => document.dispatch("keydown", { key, target: document.body }),
    puzzle: (index) => elements.get("#puzzle-tabs").children[index].dispatch("pointerdown"),
    screenKey: (key) => elements.get("#keyboard").querySelectorAll().find((button) => button.dataset.key === key).dispatch("pointerdown")
  };
}

test("gameplay events follow actual interaction, restored progress, and asynchronous share outcomes", async (t) => {
  const globals = ["window", "document", "HTMLElement", "HTMLButtonElement", "navigator", "fetch"];
  const originals = globals.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  t.after(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });

  let app = await loadApp();
  app.click("#reveal");
  assert.deepEqual(app.events.map(({ name, used_reveal }) => [name, used_reveal]), [
    ["game_ready", "no"],
    ["game_start", "yes"],
    ["level_start", "yes"],
    ["answer_reveal", "yes"]
  ], "Reveal-first play is attributed before start events are emitted");

  app = await loadApp();
  assert.deepEqual(app.events.map((event) => event.name), ["game_ready"]);
  app.puzzle(1);
  app.puzzle(0);
  app.key("Backspace");
  assert.equal(app.events.length, 1, "browsing tabs and deleting an empty guess do not start play");
  app.screenKey("enter");
  app.key("Enter");
  assert.deepEqual(app.events.map((event) => event.name), ["game_ready", "game_start", "level_start", "guess_rejected", "guess_rejected"]);
  assert.equal(app.events.at(-1).rejection_reason, "too_short");
  app.click("#help-button");
  assert.equal(app.events.at(-1).name, "help_open");
  app.click("#help-close");
  app.click("#reveal");
  assert.equal(app.events.at(-1).name, "answer_reveal");
  assert.equal(app.events.at(-1).used_reveal, "yes");

  app = await loadApp(app.storage);
  app.key("Enter");
  assert.equal(app.events.at(-1).name, "level_end");
  assert.equal(app.events.at(-1).used_reveal, "yes");
  for (let index = 1; index < 5; index++) {
    app.puzzle(index);
    for (const letter of encoded[index][0]) app.key(letter);
    app.screenKey("enter");
    assert.equal(app.events.filter((event) => event.name === "level_end").at(-1).used_reveal, "no");
  }
  assert.equal(app.events.filter((event) => event.name === "game_start").length, 1);
  assert.equal(app.events.filter((event) => event.name === "level_start").length, 5);
  assert.equal(app.events.filter((event) => event.name === "game_complete").length, 1);
  assert.equal(app.events.at(-1).used_reveal, "yes");
  app.key("Enter");
  app.click("#reveal");
  assert.equal(app.events.filter((event) => event.name === "game_complete").length, 1);

  app = await loadApp(app.storage);
  app.key("Enter");
  app.click("#reveal");
  assert.deepEqual(app.events.map((event) => event.name), ["game_ready"], "refresh never fabricates starts or completions");

  let finishShare;
  app.navigator.share = () => new Promise((resolve) => { finishShare = resolve; });
  app.puzzle(0);
  app.click("#share-seed-game");
  assert.equal(app.events.at(-1).name, "share_attempt");
  app.puzzle(4);
  finishShare();
  await settle();
  assert.equal(app.events.at(-1).name, "share");
  assert.equal(app.events.at(-1).method, "native");
  assert.equal(app.events.at(-1).puzzle_number, 1, "async share preserves click-time context");

  app.navigator.share = async () => { throw { name: "AbortError" }; };
  app.navigator.clipboard = { writeText: () => assert.fail("cancelled native share must not copy") };
  app.click("#share-seed-game");
  await settle();
  assert.equal(app.events.at(-1).name, "share_failed");
  assert.equal(app.events.at(-1).failure_reason, "cancelled");

  app.navigator.share = async () => { throw new Error("private native error"); };
  let copied;
  app.navigator.clipboard = { writeText: async (text) => { copied = text; } };
  app.click("#share-seed-link");
  await settle();
  assert.match(copied, /https:\/\/word-in-one.com\//);
  assert.equal(app.events.at(-1).name, "share");
  assert.equal(app.events.at(-1).method, "clipboard");
  assert.equal(app.events.at(-1).content_type, "daily_result");
  assert.equal(app.events.at(-1).entry_point, "completion");
  assert.equal(app.events.at(-1).puzzle_number, undefined);

  app.navigator.clipboard.writeText = async () => { throw new Error("private clipboard error"); };
  app.click("#share-seed-link");
  await settle();
  assert.equal(app.events.at(-1).name, "share_failed");
  assert.equal(app.events.at(-1).failure_reason, "unavailable");
  assert.doesNotMatch(JSON.stringify(app.events), /private|seed|guess":|answer":/);

  app.click("#new-seed-game");
  assert.equal(app.events.at(-1).name, "challenge_start");
  assert.equal(app.events.at(-1).entry_point, "completion");
  assert.equal(app.navigations.length, 0, "navigation waits for event delivery");
  const challengeEvent = app.events.at(-1);
  assert.equal(challengeEvent.event_timeout, 500);
  const fallback = [...app.timers.values()].find((timer) => timer.delay === 500);
  assert.ok(fallback, "a real JS fallback is scheduled even if gtag never loads");
  app.click("#start-seed-game");
  assert.equal(app.events.at(-1), challengeEvent, "repeated clicks do not enqueue another navigation");
  challengeEvent.event_callback();
  challengeEvent.event_callback();
  fallback.callback();
  assert.equal(app.navigations.length, 1, "callback and fallback race navigates only once");
  assert.ok(![...app.timers.values()].some((timer) => timer.delay === 500), "callback clears fallback timer");
  assert.equal(app.location.searchParams.get("utm_source"), "friends");
  assert.ok(app.location.searchParams.get("seed"));
  app.click("#start-seed-game");
  assert.notEqual(app.events.at(-1), challengeEvent, "navigation handoff releases the guard for a restored page");
  app.events.at(-1).event_callback();
  assert.equal(app.navigations.length, 2);

  app = await loadApp();
  app.click("#start-seed-game");
  assert.equal(app.events.at(-1).entry_point, "options");
  assert.equal(app.navigations.length, 0);
  [...app.timers.values()].find((timer) => timer.delay === 500).callback();
  app.events.at(-1).event_callback();
  assert.equal(app.navigations.length, 1, "blocked tag times out, and a late callback does not navigate again");

  for (const unavailable of ["missing", "throwing", "local"]) {
    app = await loadApp();
    if (unavailable === "missing") delete app.window.gtag;
    if (unavailable === "throwing") app.window.gtag = () => { throw new Error("blocked"); };
    if (unavailable === "local") app.location.href = "http://localhost:8000/?utm_source=friends";
    app.click("#start-seed-game");
    assert.equal(app.navigations.length, 1, `${unavailable} analytics navigates immediately`);
    assert.ok(![...app.timers.values()].some((timer) => timer.delay === 500));
  }
});
