"use client";

import { createElement, useEffect, useState } from "react";
import { getLocationForecast } from "../lib/forecast-api.js";

const LOCATIONS = [
  { id: "asu-memorial-union", name: "ASU Memorial Union" },
  { id: "asu-hayden-library", name: "ASU Hayden Library" },
  { id: "asu-sdfc-tempe", name: "ASU Sun Devil Fitness Complex (Tempe)" },
];

const colors = {
  maroon: "#8c1d40",
  gold: "#ffc627",
  ink: "#191919",
  muted: "#5c5c5c",
  border: "#e5e0dc",
  soft: "#faf7f5",
  warning: "#fff7e0",
  error: "#8b1e2d",
};

function h(tag, props, ...children) {
  return createElement(tag, props, ...children);
}

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Time unavailable"
    : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDateTime(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not available"
    : date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
}

function getConfidenceText(confidence) {
  if (!confidence || !Number.isFinite(confidence.score)) return "Unavailable";
  const percent = Math.round(Math.max(0, Math.min(1, confidence.score)) * 100);
  const level = confidence.level
    ? `${confidence.level[0].toUpperCase()}${confidence.level.slice(1)}`
    : "Estimated";
  return `${level} · ${percent}%`;
}

function DataBadge({ isDemo }) {
  return h("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      borderRadius: 999,
      padding: "7px 12px",
      background: isDemo ? colors.warning : "#e8f4ec",
      color: isDemo ? "#6d4a00" : "#205c34",
      fontSize: 14,
      fontWeight: 800,
      letterSpacing: "0.01em",
      whiteSpace: "nowrap",
    },
    "data-testid": "data-mode-badge",
  }, isDemo ? "Demo data" : "Live data");
}

export function ForecastResultCard({ forecast }) {
  if (!forecast) return null;

  const isDemo = forecast.dataMode === "demo";
  const insufficient = forecast.dataQuality?.status === "insufficient_data"
    || forecast.current_status === "insufficient_data";
  const updatedAt = formatDateTime(forecast.lastUpdated);

  return h("article", {
    "aria-labelledby": "forecast-title",
    style: {
      border: `1px solid ${colors.border}`,
      borderTop: `5px solid ${colors.maroon}`,
      borderRadius: 16,
      padding: 22,
      background: "#ffffff",
      color: colors.ink,
      boxShadow: "0 8px 26px rgba(40, 20, 20, 0.07)",
    },
  },
  h("header", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
      flexWrap: "wrap",
    },
  },
  h("div", null,
    h("p", { style: { margin: "0 0 4px", color: colors.maroon, fontWeight: 800, fontSize: 13 } }, "DEVILPULSE · ASU"),
    h("h2", { id: "forecast-title", style: { margin: "0 0 4px", fontSize: 24 } }, "Best Time to Go"),
    h("p", { style: { margin: 0, color: colors.muted } }, forecast.location?.name || "Selected location"),
  ),
  h(DataBadge, { isDemo })),
  insufficient
    ? h("section", {
      role: "status",
      "data-testid": "insufficient-data",
      style: {
        marginTop: 18,
        padding: 16,
        borderRadius: 12,
        background: colors.warning,
        border: "1px solid #f0dda0",
      },
    },
    h("h3", { style: { margin: "0 0 5px", fontSize: 18 } }, "Not enough data yet"),
    h("p", { style: { margin: 0 } }, "We can’t make a reliable crowd forecast or recommend a visit time right now."),
    )
    : h("section", {
      style: {
        marginTop: 18,
        padding: 16,
        borderRadius: 12,
        background: colors.soft,
      },
    },
    h("p", { style: { margin: "0 0 4px", color: colors.muted, fontSize: 14, fontWeight: 700 } }, "RIGHT NOW"),
    h("p", {
      "data-testid": "current-status",
      style: { margin: 0, color: colors.maroon, fontSize: 26, fontWeight: 850, textTransform: "capitalize" },
    }, forecast.current_status || "Status unavailable"),
    ),
  h("section", { style: { marginTop: 20 } },
    h("h3", { style: { margin: "0 0 10px", fontSize: 17 } }, "Next three hours"),
    Array.isArray(forecast.hourly_predictions) && forecast.hourly_predictions.length
      ? h("ol", {
        "data-testid": "hourly-predictions",
        style: {
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: 8,
        },
      }, ...forecast.hourly_predictions.slice(0, 3).map((prediction, index) => h("li", {
        key: prediction.start || index,
        style: { padding: 12, border: `1px solid ${colors.border}`, borderRadius: 10 },
      },
      h("p", { style: { margin: "0 0 4px", color: colors.muted, fontSize: 13 } },
        `${formatTime(prediction.start)}–${formatTime(prediction.end)}`),
      h("p", { style: { margin: 0, fontWeight: 750, textTransform: "capitalize" } },
        prediction.status || "Unavailable"),
      )))
      : h("p", { style: { color: colors.muted } }, "Hourly predictions are not available."),
  ),
  h("section", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
      gap: 12,
      marginTop: 18,
    },
  },
  h("div", { style: { padding: 14, borderRadius: 10, background: colors.soft } },
    h("p", { style: { margin: "0 0 4px", color: colors.muted, fontSize: 13 } }, "CONFIDENCE"),
    h("p", { "data-testid": "confidence", style: { margin: 0, fontSize: 17, fontWeight: 750 } },
      getConfidenceText(forecast.confidence)),
  ),
  h("div", {
    "data-testid": "recommendation",
    style: { padding: 14, borderRadius: 10, background: colors.soft },
  },
  h("p", { style: { margin: "0 0 4px", color: colors.muted, fontSize: 13 } }, "RECOMMENDED VISIT"),
  insufficient || !forecast.recommended_visit_window
    ? h("p", { style: { margin: 0, fontWeight: 700 } }, "No recommendation available")
    : h("p", { style: { margin: 0, fontWeight: 750 } },
      `${formatTime(forecast.recommended_visit_window.start)}–${formatTime(forecast.recommended_visit_window.end)}`,
      h("br"),
      h("span", { style: { fontWeight: 500, textTransform: "capitalize" } },
        `${forecast.recommended_visit_window.status || "Visit"} crowd level`),
    ),
  )),
  h("section", { style: { marginTop: 18 } },
    h("h3", { style: { margin: "0 0 6px", fontSize: 16 } }, "Why this forecast?"),
    Array.isArray(forecast.reasons) && forecast.reasons.length
      ? h("ul", { "data-testid": "forecast-reasons", style: { margin: 0, paddingLeft: 20 } },
        ...forecast.reasons.map((reason, index) => h("li", { key: `${index}-${reason}`, style: { marginBottom: 4 } }, reason)))
      : h("p", { style: { margin: 0, color: colors.muted } }, "No forecast reasons are available."),
  ),
  h("footer", {
    style: { marginTop: 18, paddingTop: 12, borderTop: `1px solid ${colors.border}`, color: colors.muted, fontSize: 13 },
  }, `Last updated: ${updatedAt}`),
  );
}

export default function BestTimeToGoForecast({ locations = LOCATIONS, initialLocationId }) {
  const initialId = initialLocationId || locations[0]?.id || "";
  const [selectedId, setSelectedId] = useState(initialId);
  const [forecast, setForecast] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(initialId));

  useEffect(() => {
    if (!selectedId) {
      setLoading(false);
      setForecast(null);
      return undefined;
    }

    const controller = new AbortController();
    setForecast(null);
    setError("");
    setLoading(true);
    getLocationForecast(selectedId, { signal: controller.signal })
      .then(setForecast)
      .catch((requestError) => {
        if (requestError.name !== "AbortError") setError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [selectedId]);

  return h("section", {
    "aria-label": "Best Time to Go forecast",
    style: { display: "grid", gap: 14 },
  },
  h("label", { htmlFor: "forecast-location", style: { display: "grid", gap: 6, fontWeight: 700 } },
    "Choose an ASU location",
    h("select", {
      id: "forecast-location",
      value: selectedId,
      onChange: (event) => setSelectedId(event.target.value),
      style: {
        width: "100%",
        padding: "11px 12px",
        border: `1px solid ${colors.border}`,
        borderRadius: 9,
        background: "#fff",
        color: colors.ink,
        font: "inherit",
      },
    }, ...locations.map((location) => h("option", { key: location.id, value: location.id }, location.name)),
    ),
  ),
  loading
    ? h("p", { role: "status", style: { margin: 0, color: colors.muted } }, "Loading forecast…")
    : null,
  error
    ? h("p", { role: "alert", style: { margin: 0, color: colors.error } }, `Couldn’t load this forecast: ${error}`)
    : null,
  !loading && !error ? h(ForecastResultCard, { forecast }) : null,
  );
}
