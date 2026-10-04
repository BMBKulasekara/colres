import { cronJobs } from "convex/server";
import { internal } from "./_generated/api.js";
import { INDEX_INTERVAL_MINUTES } from "./lib/searchText.js";
import { CAPTURE_INTERVAL_MINUTES } from "./lib/versionPolicy.js";

const crons = cronJobs();

// Documents left in the recycle bin for 30 days are erased for good.
crons.daily("empty expired recycle bin items", { hourUTC: 3, minuteUTC: 0 }, internal.trash._purgeExpired, {});

// Recently edited documents get an automatic version for the History panel.
crons.interval(
  "capture document versions",
  { minutes: CAPTURE_INTERVAL_MINUTES },
  internal.versions._captureRecent,
  {}
);

// Recently saved documents are refreshed in the full-text search index.
crons.interval(
  "index documents for search",
  { minutes: INDEX_INTERVAL_MINUTES },
  internal.search._indexRecent,
  {}
);

export default crons;
