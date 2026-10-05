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

// Notifications older than 90 days are deleted.
crons.daily("prune old notifications", { hourUTC: 3, minuteUTC: 30 }, internal.notifications._pruneOld, {});

// Everyone on a document is reminded 7, 3 and 1 days before its deadline.
crons.daily("remind upcoming deadlines", { hourUTC: 8, minuteUTC: 0 }, internal.goals._remindDeadlines, {});

export default crons;
