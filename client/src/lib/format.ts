import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

// `fromNow()` is localised by the active dayjs locale, so "5 minutes ago"
// becomes Georgian without a translation key of our own.
dayjs.extend(relativeTime);

const amountFormatter = new Intl.NumberFormat("ka-GE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const money = (
  value: number | string | null | undefined,
  currency = "GEL",
): string => {
  const amount =
    typeof value === "string" ? Number.parseFloat(value) : (value ?? 0);
  return `${amountFormatter.format(Number.isFinite(amount) ? amount : 0)} ${currency}`;
};

export const dateTime = (value: string | null | undefined): string =>
  value ? dayjs(value).format("DD.MM.YYYY HH:mm") : "-";

export const date = (value: string | null | undefined): string =>
  value ? dayjs(value).format("DD.MM.YYYY") : "-";

/** `2026-03` -> `Mar 2026` / `მარ 2026`, for chart axes. */
export const monthLabel = (month: string): string =>
  dayjs(`${month}-01`).format("MMM YYYY");

/**
 * Localised "x ago". `neverLabel` comes from the caller so the translation
 * stays in the component layer.
 */
export const relative = (
  value: string | null | undefined,
  neverLabel = "-",
): string => (value ? dayjs(value).fromNow() : neverLabel);
