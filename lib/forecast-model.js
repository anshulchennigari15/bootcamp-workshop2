import { getDemoLocationForecastData } from "./forecast-sample-fixture.js";

// Verified inputs stay empty until a trusted report, hours, and events feed is connected.
export const locations = [
  { id: "asu-memorial-union", name: "ASU Memorial Union", timezone: "America/Phoenix", operatingHours: null },
  { id: "asu-hayden-library", name: "ASU Hayden Library", timezone: "America/Phoenix", operatingHours: null },
  {
    id: "asu-sdfc-tempe",
    name: "ASU Sun Devil Fitness Complex (Tempe)",
    timezone: "America/Phoenix",
    operatingHours: null,
  },
];

export const reports = [];
export const events = [];

export function getLocationForecastData(id, {
  now = new Date(),
  mode = process.env.NODE_ENV === "development" ? "demo" : "verified",
} = {}) {
  if (mode !== "demo" && mode !== "verified") {
    throw new TypeError('mode must be "demo" or "verified"');
  }

  if (mode === "demo") {
    return getDemoLocationForecastData(id, now);
  }

  const location = locations.find((item) => item.id === id);
  if (!location) return null;

  return {
    location,
    reports: reports.filter((report) => report.locationId === id),
    events: events.filter((event) => event.locationId === id),
    eventsAvailable: false,
    dataMode: "verified",
    sources: [],
    lastUpdated: null,
  };
}
