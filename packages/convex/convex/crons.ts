import { cronJobs } from "convex/server";
import { internal } from "./_generated/api.js";

const crons = cronJobs();

// Documents left in the recycle bin for 30 days are erased for good.
crons.daily("empty expired recycle bin items", { hourUTC: 3, minuteUTC: 0 }, internal.trash._purgeExpired, {});

export default crons;
