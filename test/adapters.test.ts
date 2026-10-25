import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { parseMindbody } from "../src/adapters/mindbody.ts";
import { parseTeamup, type TeamupPage } from "../src/adapters/teamup.ts";
import { parseWix, type WixServices, type WixTimeSlots } from "../src/adapters/wix.ts";
import { studios } from "../src/studios.ts";
import type { MindbodyStudio, TeamupStudio, WixStudio, YogaClass } from "../src/types.ts";

// Fixtures are real responses captured on 2026-10-25, with fake teacher names. TeamUp and Wix are cut to the
// fields the adapters read; Mindbody is the full widget page, because the adapter parses its flight data.
const fixture = (name: string) => readFile(new URL(`fixtures/${name}`, import.meta.url), "utf8");
const studio = <T>(id: string) => studios.find((s) => s.id === id) as T;

function assertWellFormed(classes: YogaClass[]) {
  for (const c of classes) {
    assert.ok(c.name.length > 0, "name");
    assert.ok(!Number.isNaN(Date.parse(c.start)) && !Number.isNaN(Date.parse(c.end)), `dates for ${c.name}`);
    assert.ok(Date.parse(c.end) > Date.parse(c.start), `end after start for ${c.name}`);
    assert.ok(c.bookingUrl.startsWith("https://"), "bookingUrl");
  }
}

describe("TeamUp (The Shala)", async () => {
  const page = JSON.parse(await fixture("teamup-events.json")) as TeamupPage;
  const classes = parseTeamup([page], studio<TeamupStudio>("shala"));

  it("keeps every in-studio class", () => {
    assert.equal(classes.length, 24);
    assertWellFormed(classes);
  });

  it("links to the single class", () => {
    assert.match(classes[0]!.bookingUrl, /^https:\/\/goteamup\.com\/p\/10213813-.+\/e\/\d+-/);
  });

  it("reads the teacher", () => {
    assert.equal(classes[0]!.teacher, "Alex Abbott");
  });
});

describe("Mindbody (Yoga Loft)", async () => {
  const classes = parseMindbody(await fixture("mindbody-schedule.html"), studio<MindbodyStudio>("yogaloft"));

  it("extracts classes from the flight data", () => {
    assert.equal(classes.length, 49);
    assertWellFormed(classes);
  });

  it("resolves teacher references", () => {
    assert.ok(classes.every((c) => c.teacher && !c.teacher.startsWith("$")));
  });

  it("converts UTC to an instant", () => {
    const first = classes.find((c) => c.name === "Heated Vinyasa");
    assert.equal(first?.start, "2026-10-26T04:00:00.000Z");
  });

  it("fails loudly on a page without classes", () => {
    assert.throws(() => parseMindbody("<html>Just a moment...</html>", studio<MindbodyStudio>("yogaloft")));
  });
});

describe("Wix Bookings (Lighthouse)", async () => {
  const { services } = JSON.parse(await fixture("wix-services.json")) as { services: WixServices };
  const { timeSlots } = JSON.parse(await fixture("wix-time-slots.json")) as { timeSlots: WixTimeSlots };
  const classes = parseWix(services, timeSlots, studio<WixStudio>("lighthouse"));
  const names = new Set(classes.map((c) => c.name));

  it("keeps yoga and drops everything else", () => {
    assertWellFormed(classes);
    assert.ok(names.has("Evening Flow"));
    for (const notYoga of ["Sauna | Heat Therapy", "Day Drop-in", "Gong Sound Bath"]) {
      assert.ok(!names.has(notYoga), notYoga);
    }
  });

  it("marks a class with no remaining capacity as Full", () => {
    const evening = timeSlots.find((s) => s.eventInfo?.eventTitle === "Evening Flow")!;
    const [full] = parseWix(services, [{ ...evening, remainingCapacity: 0 }], studio<WixStudio>("lighthouse"));
    assert.equal(full?.full, true);
    assert.equal(full?.spotsLeft, 0);
  });

  it("uses staff as the teacher, not the room", () => {
    const morning = classes.find((c) => c.name === "Morning Yoga");
    assert.ok(morning?.teacher && morning.teacher !== "Studio");
  });

  it("opens the booking calendar on the day of the class", () => {
    const evening = classes.find((c) => c.start.startsWith("2026-10-27T17:15"));
    assert.equal(
      evening?.bookingUrl,
      "https://www.lighthouseholistic.co.za/booking-calendar/evening-flow?timezone=Africa%2FJohannesburg&date=2026-10-27",
    );
  });

  it("links to the site when a service has no booking page", () => {
    const evening = timeSlots.find((s) => s.eventInfo?.eventTitle === "Evening Flow")!;
    const withoutUrls = services.map((s) => (s.id === evening.serviceId ? { ...s, urls: undefined } : s));
    const [linked] = parseWix(withoutUrls, [evening], studio<WixStudio>("lighthouse"));
    assert.equal(linked?.bookingUrl, "https://www.lighthouseholistic.co.za/");
  });
});

describe("Lighthouse yoga rule", () => {
  const { isYoga } = studio<WixStudio>("lighthouse");

  it("follows the categories, with yoga workshops and no placeholders", () => {
    assert.ok(isYoga({ name: "Pranayama & Meditation", category: "DAILY YOGA" }));
    assert.ok(isYoga({ name: "Aerial Yoga", category: "AERIAL YOGA" }));
    assert.ok(isYoga({ name: "Aerial Yin & Nidra", category: "WORKSHOPS" }));
    assert.ok(!isYoga({ name: "Gong Sound Bath", category: "WORKSHOPS" }));
    assert.ok(!isYoga({ name: "Closed (Public Holiday)", category: "DAILY YOGA" }));
    assert.ok(!isYoga({ name: "Sauna | Heat Therapy", category: "SAUNA" }));
  });
});
