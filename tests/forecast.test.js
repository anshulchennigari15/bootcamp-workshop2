import assert from "node:assert/strict";
import test from "node:test";
import { buildForecast } from "../lib/forecast-service.js";
import { getLocationForecastData } from "../lib/forecast-model.js";

const now = new Date("2026-01-05T15:15:00.000Z");
const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function makeData({ reports = [], events = [], operatingHours = weekdays.map((day) => ({
  day,
  open: "00:00",
  close: "23:59",
})) } = {}) {
  return {
    location: {
      id: "test-location",
      name: "Test location",
      timezone: "America/Phoenix",
      operatingHours,
    },
    reports,
    events,
    eventsAvailable: true,
    dataMode: "verified",
    sources: ["Test fixture"],
    lastUpdated: now.toISOString(),
  };
}

function recentReports(crowdLevel = "quiet") {
  return [-5, -12, -20].map((minutes, index) => ({
    id: `report-${index}`,
    crowdLevel,
    reportedAt: new Date(now.getTime() + minutes * 60 * 1000).toISOString(),
  }));
}

test("returns three hourly predictions and a 30-minute recommendation when data is sufficient", () => {
  const result = buildForecast(makeData({ reports: recentReports() }), now);

  assert.equal(result.current_status, "quiet");
  assert.equal(result.hourly_predictions.length, 3);
  assert.ok(result.hourly_predictions.every((prediction) => prediction.status === "quiet"));
  assert.ok(result.recommended_visit_window);
  assert.equal(
    Date.parse(result.recommended_visit_window.end) - Date.parse(result.recommended_visit_window.start),
    30 * 60 * 1000,
  );
  assert.ok(result.confidence.score > 0);
});

test("returns insufficient_data when reports are missing or stale", () => {
  const empty = buildForecast(makeData(), now);
  const stale = buildForecast(makeData({
    reports: [{
      crowdLevel: "busy",
      reportedAt: new Date(now.getTime() - 7 * 60 * 60 * 1000).toISOString(),
    }, {
      crowdLevel: "quiet",
      reportedAt: new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString(),
    }],
  }), now);

  for (const result of [empty, stale]) {
    assert.equal(result.current_status, "insufficient_data");
    assert.equal(result.recommended_visit_window, null);
    assert.equal(result.confidence.score, 0);
    assert.equal(result.hourly_predictions.length, 3);
    assert.ok(result.reasons.length > 0);
    assert.equal(result.dataQuality.status, "insufficient_data");
  }
});

test("fresh reports carry more weight than older reports", () => {
  const mixedAgeReports = [
    { crowdLevel: "busy", reportedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString() },
    { crowdLevel: "quiet", reportedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString() },
    { crowdLevel: "quiet", reportedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString() },
  ];
  const mixed = buildForecast(makeData({ reports: mixedAgeReports }), now);
  const even = buildForecast(makeData({ reports: recentReports("moderate") }), now);

  assert.ok(mixed.hourly_predictions[0].crowd_score > even.hourly_predictions[0].crowd_score);
  assert.deepEqual(buildForecast(makeData({ reports: mixedAgeReports }), now), mixed);
});

test("operating hours mark closed periods and events raise crowd predictions", () => {
  const closed = buildForecast(makeData({
    reports: recentReports(),
    operatingHours: [],
  }), now);
  const ordinary = buildForecast(makeData({ reports: recentReports("quiet") }), now);
  const event = buildForecast(makeData({
    reports: recentReports("quiet"),
    events: [{
      startsAt: "2026-01-05T16:00:00.000Z",
      endsAt: "2026-01-05T17:00:00.000Z",
      expectedAttendance: 1000,
    }],
  }), now);

  assert.equal(closed.current_status, "closed");
  assert.ok(closed.hourly_predictions.every((prediction) => prediction.status === "closed"));
  assert.ok(event.hourly_predictions[0].crowd_score > ordinary.hourly_predictions[0].crowd_score);
  assert.ok(event.reasons.some((reason) => reason.includes("scheduled event")));
});

test("development demo provider supplies three labeled ASU locations with fresh sample inputs", () => {
  const locations = ["asu-memorial-union", "asu-hayden-library", "asu-sdfc-tempe"];

  for (const id of locations) {
    const data = getLocationForecastData(id, { now, mode: "demo" });
    assert.ok(data);
    assert.equal(data.dataMode, "demo");
    assert.deepEqual(data.sources, ["Demo data"]);
    assert.equal(data.location.operatingHours.length, 7);
    assert.equal(data.reports.length, 4);
    assert.ok(data.reports.every((report) => Number.isFinite(Date.parse(report.reportedAt))));
    assert.equal(data.events.length, 1);
    assert.ok(Number.isFinite(Date.parse(data.events[0].startsAt)));

    const result = buildForecast(data, now);
    assert.equal(result.label, "Demo data");
    assert.equal(result.dataQuality.status, "sufficient");
    assert.equal(result.dataMode, "demo");
    assert.equal(result.lastUpdated, now.toISOString());
    assert.ok(result.sources.includes("Demo data"));
    assert.notEqual(result.current_status, "insufficient_data");
  }
});

test("verified provider never falls back to demo inputs when production data is missing", () => {
  const data = getLocationForecastData("asu-memorial-union", { now, mode: "verified" });
  assert.ok(data);
  assert.equal(data.dataMode, "verified");
  assert.deepEqual(data.sources, []);
  assert.equal(data.lastUpdated, null);
  assert.equal(data.reports.length, 0);
  assert.equal(data.eventsAvailable, false);

  const result = buildForecast(data, now);
  assert.equal(result.dataMode, "verified");
  assert.equal(result.dataQuality.status, "insufficient_data");
  assert.equal(result.current_status, "insufficient_data");
  assert.equal(result.recommended_visit_window, null);
  assert.equal(result.label, undefined);
  assert.equal(getLocationForecastData("unknown-location", { now, mode: "demo" }), null);
});
