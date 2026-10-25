// Browser script. render.ts inlines it as a module, with a ClientConfig as JSON in #config.

/**
 * @param {string} selector
 * @param {ParentNode} [root]
 */
const $ = (selector, root = document) => {
  const el = root.querySelector(selector);
  if (!(el instanceof HTMLElement)) throw new Error(`No element for ${selector}`);
  return el;
};

/**
 * @param {string} selector
 * @param {ParentNode} [root]
 */
const $$ = (selector, root = document) =>
  [...root.querySelectorAll(selector)].filter((el) => el instanceof HTMLElement);

/** @param {HTMLElement} li */
const startOf = (li) => Date.parse(li.dataset.start ?? "");

/** @type {import("./types.ts").ClientConfig} */
const config = JSON.parse($("#config").textContent ?? "");
const now = Date.now();
const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: config.timeZone }).format;
const when = new Intl.DateTimeFormat("en-GB", {
  timeZone: config.timeZone,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
}).format;

// The page is rebuilt every 30 minutes, so drop Classes that started since
$$("li[data-start]").forEach((li) => {
  if (startOf(li) < now) li.remove();
});

const today = localDate(now);
const tomorrow = localDate(now + config.dayMs);
$$(".day").forEach((day) => {
  const rel = day.dataset.date === today ? "Today" : day.dataset.date === tomorrow ? "Tomorrow" : "";
  if (!rel) return;
  $(".big", day).textContent = rel;
  $(".small", day).textContent = day.dataset.label ?? "";
});

const stale = config.freshness.flatMap(({ name, fetchedAt }) => {
  if (!fetchedAt) return [`${name}: no data yet`];
  const t = Date.parse(fetchedAt);
  return now - t > config.staleAfterMs ? [`${name}: data from ${when(t)}`] : [];
});
const staleBox = $(".stale");
staleBox.hidden = stale.length === 0;
staleBox.replaceChildren(...stale.map((s) => Object.assign(document.createElement("p"), { textContent: s })));

const key = "yoga.hiddenStudios";
/** @type {string[]} */
let hidden = [];
try {
  hidden = JSON.parse(localStorage.getItem(key) || "[]");
} catch {}
const empty = $(".empty");
const buttons = $$(".filter button");
const days = $$(".day");

const apply = () => {
  buttons.forEach((b) => b.setAttribute("aria-pressed", String(!hidden.includes(b.dataset.studio ?? ""))));
  let visible = 0;
  days.forEach((day) => {
    const rows = $$("li", day);
    rows.forEach((li) => (li.hidden = hidden.includes(li.dataset.studio ?? "")));
    const shown = rows.filter((li) => !li.hidden);
    // Print a start time once per run of same-time Classes, and space out long breaks in the day
    shown.forEach((li, i) => {
      const prev = shown[i - 1];
      const gap = prev ? startOf(li) - startOf(prev) : 0;
      li.classList.toggle("same", !!prev && gap === 0);
      li.classList.toggle("gap", gap >= config.clusterGapMs);
    });
    day.hidden = shown.length === 0;
    visible += shown.length;
  });
  empty.hidden = visible > 0;
  empty.textContent =
    hidden.length === buttons.length
      ? "All studios are hidden. Turn one on above."
      : `No classes in the next ${config.upcomingDays} days.`;
};

buttons.forEach((b) =>
  b.addEventListener("click", () => {
    const id = b.dataset.studio ?? "";
    hidden = hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id];
    try {
      localStorage.setItem(key, JSON.stringify(hidden));
    } catch {}
    apply();
  }),
);
apply();
