const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const DEMO_LOCATIONS = [
  { id: "asu-memorial-union", name: "ASU Memorial Union" },
  { id: "asu-hayden-library", name: "ASU Hayden Library" },
  { id: "asu-sdfc-tempe", name: "ASU Sun Devil Fitness Complex (Tempe)" },
];

function openEveryDay() {
  return DAYS.map((day) => ({ day, open: "00:00", close: "23:59" }));
}

export function getDemoLocationForecastData(id, now = new Date()) {
  const identity = DEMO_LOCATIONS.find((location) => location.id === id);
  if (!identity) return null;

  const currentTime = new Date(now);
  if (!Number.isFinite(currentTime.getTime())) throw new TypeError("now must be a valid date");

  const reportLevels = {
    "asu-memorial-union": ["busy", "moderate", "busy", "moderate"],
    "asu-hayden-library": ["quiet", "moderate", "quiet", "moderate"],
    "asu-sdfc-tempe": ["moderate", "busy", "moderate", "busy"],
  };
  const index = DEMO_LOCATIONS.findIndex((location) => location.id === id);
  const reports = reportLevels[id].map((crowdLevel, reportIndex) => ({
    id: `demo-${id}-report-${reportIndex + 1}`,
    locationId: id,
    crowdLevel,
    reportedAt: new Date(currentTime.getTime() - (5 + reportIndex * 12) * 60 * 1000).toISOString(),
    source: "Demo data",
  }));
  const eventStart = new Date(currentTime.getTime() + 60 * 60 * 1000);
  const events = [{
    id: `demo-${id}-event`,
    locationId: id,
    name: ["Student organization fair", "Study skills workshop", "Intramural tournament"][index],
    startsAt: eventStart.toISOString(),
    endsAt: new Date(eventStart.getTime() + 60 * 60 * 1000).toISOString(),
    expectedAttendance: [240, 100, 320][index],
    source: "Demo data",
  }];

  return {
    location: {
      ...identity,
      timezone: "America/Phoenix",
      operatingHours: openEveryDay(),
    },
    reports,
    events,
    eventsAvailable: true,
    dataMode: "demo",
    sources: ["Demo data"],
    lastUpdated: currentTime.toISOString(),
  };
}
