import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import BestTimeToGoForecast, { ForecastResultCard } from "../components/BestTimeToGoForecast.js";
import { getLocationForecast } from "../lib/forecast-api.js";

const sampleForecast = {
  location: { id: "asu-memorial-union", name: "ASU Memorial Union" },
  dataMode: "demo",
  dataQuality: { status: "sufficient" },
  lastUpdated: "2026-11-07T20:00:00.000Z",
  current_status: "busy",
  hourly_predictions: [
    { start: "2026-11-07T21:00:00.000Z", end: "2026-11-07T22:00:00.000Z", status: "moderate" },
    { start: "2026-11-07T22:00:00.000Z", end: "2026-11-07T23:00:00.000Z", status: "busy" },
    { start: "2026-11-07T23:00:00.000Z", end: "2026-11-08T00:00:00.000Z", status: "quiet" },
  ],
  confidence: { score: 0.75, level: "high" },
  recommended_visit_window: {
    start: "2026-11-07T23:00:00.000Z",
    end: "2026-11-07T23:30:00.000Z",
    status: "quiet",
  },
  reasons: ["Four recent crowd reports were weighted by freshness.", "An event raises the earlier estimate."],
};

test("renders selected location, data badge, status, predictions, recommendation, reasons, and update time", () => {
  const markup = renderToStaticMarkup(createElement(ForecastResultCard, { forecast: sampleForecast }));

  for (const text of [
    "Best Time to Go",
    "ASU Memorial Union",
    "Demo data",
    "busy",
    "Next three hours",
    "CONFIDENCE",
    "75%",
    "RECOMMENDED VISIT",
    "Why this forecast?",
    "Four recent crowd reports were weighted by freshness.",
    "Last updated:",
  ]) {
    assert.ok(markup.includes(text), `Expected rendered card to include ${text}`);
  }
  assert.equal((markup.match(/<li/g) || []).length, 5);
});

test("renders insufficient-data state without a visit recommendation", () => {
  const forecast = {
    ...sampleForecast,
    dataMode: "verified",
    dataQuality: { status: "insufficient_data" },
    current_status: "insufficient_data",
    recommended_visit_window: null,
  };
  const markup = renderToStaticMarkup(createElement(ForecastResultCard, { forecast }));

  assert.ok(markup.includes("Live data"));
  assert.ok(markup.includes("Not enough data yet"));
  assert.ok(markup.includes("No recommendation available"));
  assert.ok(!markup.includes("23:00"));
});

test("location picker renders all locations and a loading state", () => {
  const markup = renderToStaticMarkup(createElement(BestTimeToGoForecast, {
    initialLocationId: "asu-hayden-library",
  }));
  assert.ok(markup.includes("Choose an ASU location"));
  assert.ok(markup.includes("ASU Hayden Library"));
  assert.ok(markup.includes("ASU Sun Devil Fitness Complex"));
  assert.ok(markup.includes("Loading forecast"));
});

test("API client encodes location ids and reports server errors", async () => {
  let requestedUrl;
  const result = await getLocationForecast("asu/library", {
    fetchImpl: async (url) => {
      requestedUrl = url;
      return { ok: true, json: async () => sampleForecast };
    },
  });
  assert.equal(requestedUrl, "/api/locations/asu%2Flibrary/forecast");
  assert.equal(result, sampleForecast);

  await assert.rejects(
    getLocationForecast("missing", {
      fetchImpl: async () => ({
        ok: false,
        status: 404,
        json: async () => ({ error: "Location not found" }),
      }),
    }),
    /Location not found/,
  );
});
