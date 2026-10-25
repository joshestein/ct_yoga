import { z } from "zod";
import { getJson, postJson } from "../http.ts";
import { TIME_ZONE, fromLocalDateTime, toLocalDateTime } from "../time.ts";
import type { TimeWindow, WixStudio, YogaClass } from "../types.ts";

const WIX_BOOKINGS_APP_ID = "13d21c63-b5ec-5912-8397-c3a5ddb27a97";

const AccessTokens = z.object({
  apps: z.record(z.string(), z.object({ instance: z.string() })),
});

const ServicesPage = z.object({
  services: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      category: z.object({ name: z.string() }).optional(),
      urls: z.object({ bookingPage: z.object({ url: z.string() }).optional() }).optional(),
    }),
  ),
  pagingMetadata: z.object({ hasNext: z.boolean().optional() }).optional(),
});

const TimeSlotsPage = z.object({
  timeSlots: z.array(
    z.object({
      serviceId: z.string(),
      localStartDate: z.string(),
      localEndDate: z.string(),
      remainingCapacity: z.number(),
      location: z.object({ locationType: z.string() }),
      eventInfo: z.object({ eventTitle: z.string().optional() }).optional(),
      nonBookableReasons: z.object({ eventCancelled: z.boolean().optional() }).optional(),
      availableResources: z
        .array(z.object({ resourceTypeId: z.string(), resources: z.array(z.object({ name: z.string() })) }))
        .optional(),
    }),
  ),
  pagingMetadata: z
    .object({ hasNext: z.boolean().optional(), cursors: z.object({ next: z.string().optional() }).optional() })
    .optional(),
});

export type WixServices = z.infer<typeof ServicesPage>["services"];
export type WixTimeSlots = z.infer<typeof TimeSlotsPage>["timeSlots"];

export async function fetchWix(studio: WixStudio, window: TimeWindow): Promise<YogaClass[]> {
  // Anonymous visitor token, the same one the public site uses
  const tokens = AccessTokens.parse(await getJson(`${studio.siteUrl}/_api/v1/access-tokens`));
  const instance = tokens.apps[WIX_BOOKINGS_APP_ID]?.instance;
  if (!instance) throw new Error("Wix: no Bookings app token for site");
  const auth = { Authorization: instance };

  const servicesPage = ServicesPage.parse(
    await postJson(`${studio.siteUrl}/_api/bookings/v2/services/query`, { query: { paging: { limit: 100 } } }, auth),
  );
  if (servicesPage.pagingMetadata?.hasNext) throw new Error("Wix: more than 100 services, add paging");

  const slots: WixTimeSlots = [];
  let cursor: string | undefined;
  do {
    const body = cursor
      ? { cursorPaging: { limit: 1000, cursor } }
      : {
          fromLocalDate: toLocalDateTime(window.from),
          toLocalDate: toLocalDateTime(window.to),
          timeZone: TIME_ZONE,
          cursorPaging: { limit: 1000 },
        };
    const page = TimeSlotsPage.parse(
      await postJson(`${studio.siteUrl}/_api/service-availability/v2/time-slots/event`, body, auth),
    );
    slots.push(...page.timeSlots);
    cursor = page.pagingMetadata?.hasNext ? page.pagingMetadata.cursors?.next : undefined;
  } while (cursor);

  return parseWix(servicesPage.services, slots, studio);
}

export function parseWix(services: WixServices, slots: WixTimeSlots, studio: WixStudio): YogaClass[] {
  const serviceById = new Map(services.map((s) => [s.id, s]));

  return slots.flatMap((slot): YogaClass[] => {
    const service = serviceById.get(slot.serviceId);
    if (!service || service.type !== "CLASS") return [];
    if (slot.location.locationType !== "BUSINESS" || slot.nonBookableReasons?.eventCancelled) return [];
    if (!studio.isYoga({ name: service.name, category: service.category?.name })) return [];

    // The booking calendar opens on `date` with this Class's time ready to tap.
    // A service without a booking page links to the Studio's site instead.
    const bookingPage = service.urls?.bookingPage?.url;
    const bookingUrl = new URL(bookingPage ?? studio.siteUrl);
    if (bookingPage) {
      bookingUrl.searchParams.set("timezone", TIME_ZONE);
      bookingUrl.searchParams.set("date", slot.localStartDate.slice(0, 10));
    }

    const teacher = (slot.availableResources ?? [])
      .filter((r) => r.resourceTypeId === studio.staffResourceTypeId)
      .flatMap((r) => r.resources.map((p) => p.name))
      .join(", ");
    const spotsLeft = Math.max(0, slot.remainingCapacity);

    return [
      {
        studio: studio.id,
        name: (slot.eventInfo?.eventTitle ?? service.name).trim(),
        teacher: teacher || null,
        start: fromLocalDateTime(slot.localStartDate),
        end: fromLocalDateTime(slot.localEndDate),
        spotsLeft,
        full: spotsLeft === 0,
        bookingUrl: bookingUrl.toString(),
      },
    ];
  });
}
