// Group transport by explicit itinerary day, not by calendar dates or array positions.
export function itineraryDayNumber(value?: string): number | null {
  const text = String(value || '').trim();
  const match = /^(?:DAY\s*|第\s*)(\d+)\s*(?:天|日)?$/i.exec(text) || /^(\d+)\s*(?:天|日)$/.exec(text);
  const day = match ? Number(match[1]) : NaN;
  return Number.isSafeInteger(day) && day > 0 ? day : null;
}
