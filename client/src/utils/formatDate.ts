/**
 * Format an ISO date string (YYYY-MM-DD or full ISO timestamp) in Indian format: DD/MM/YYYY
 */
export function formatIndianDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  // Handle pure YYYY-MM-DD safely in UTC so timezone offsets don't shift the day
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim());
  const d = isDateOnly ? new Date(`${dateStr.trim()}T00:00:00Z`) : new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: isDateOnly ? "UTC" : "Asia/Kolkata",
  });
}

export function formatIndianDateTime(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const datePart = d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
  const timePart = d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
  return `${datePart} ${timePart}`;
}
