/**
 * "Today", for an Indian coaching centre.
 *
 * Client code used to build the date with `toISOString()`, which is the date in
 * *UTC*. India is UTC+5:30, so between midnight and 05:30 IST that string is
 * still YESTERDAY — while the server (cron, billing) worked in IST. The two
 * disagreed for five and a half hours every night:
 *
 *   - a payment recorded at 1am IST was filed under the previous day;
 *   - on the 1st of a month before 05:30 the "current period" was still last
 *     month, so a fee raised then landed in the wrong month's books;
 *   - attendance marked before an early batch belonged to the day before.
 *
 * Both sides now come through here. IST has no daylight saving, so a fixed
 * +5:30 offset is exact — no timezone database needed, and it gives the same
 * answer in a browser in Kolkata, a serverless function in Mumbai, and a build
 * machine running in UTC.
 */

/** IST is UTC+5:30, year round. */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Today in IST, split into the parts the app actually uses. */
export function istToday(now: Date = new Date()): { ymd: string; mmdd: string; year: number } {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const ymd = ist.toISOString().slice(0, 10);
  return { ymd, mmdd: ymd.slice(5), year: ist.getUTCFullYear() };
}

/** Today in IST as "YYYY-MM-DD" — the shape every date column stores. */
export function todayIso(now?: Date): string {
  return istToday(now).ymd;
}

/** The current billing period in IST, "YYYY-MM". */
export function currentPeriod(now?: Date): string {
  return todayIso(now).slice(0, 7);
}
