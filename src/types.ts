export type StudioId = "shala" | "yogaloft" | "lighthouse";

/** One scheduled, in-studio yoga occurrence. See CONTEXT.md "Yoga Class". */
export type YogaClass = {
  studio: StudioId;
  name: string;
  teacher: string | null;
  /** ISO 8601 with offset */
  start: string;
  end: string;
  /** null when the Booking Platform does not expose spots left */
  spotsLeft: number | null;
  full: boolean;
  bookingUrl: string;
};

export type Snapshot = {
  fetchedAt: string;
  classes: YogaClass[];
};

export type TimeWindow = { from: Date; to: Date };

/** Server values the browser script reads from the page's #config JSON */
export type ClientConfig = {
  freshness: { name: string; fetchedAt: string | null }[];
  staleAfterMs: number;
  clusterGapMs: number;
  dayMs: number;
  timeZone: string;
  upcomingDays: number;
};

/** What a Booking Platform tells us about an offering, used to decide if it is a Yoga Class. */
export type Offering = { name: string; category?: string };

type StudioBase = {
  id: StudioId;
  name: string;
  color: string;
  isYoga: (offering: Offering) => boolean;
};

export type TeamupStudio = StudioBase & { platform: "teamup"; providerId: number; venueName: string };
export type MindbodyStudio = StudioBase & { platform: "mindbody"; widgetId: string };
export type WixStudio = StudioBase & { platform: "wix"; siteUrl: string; staffResourceTypeId: string };

export type Studio = TeamupStudio | MindbodyStudio | WixStudio;
