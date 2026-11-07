const CROWD_SCORES = {
  quiet: 0.15,
  moderate: 0.45,
  busy: 0.72,
  "very busy": 0.92,
};

const REPORT_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const MIN_REPORT_COUNT = 2;
const MIN_EFFECTIVE_REPORT_WEIGHT = 1.25;
const HOUR_MS = 60 * 60 * 1000;

function getLocalParts(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return {
    weekday: values.weekday.toLowerCase(),
    minutes: Number(values.hour) * 60 + Number(values.minute),
  };
}

function parseTime(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value ?? "");
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function isWithinHours(location, start, end) {
  if (!Array.isArray(location.operatingHours)) return null;

  const timezone = location.timezone || "America/Phoenix";
  const startLocal = getLocalParts(start, timezone);
  const endLocal = getLocalParts(new Date(end.getTime() - 1), timezone);

  for (const range of location.operatingHours) {
    const opens = parseTime(range.open);
    const closes = parseTime(range.close);
    if (opens === null || closes === null) continue;

    const sameDay = startLocal.weekday === endLocal.weekday;
    if (opens < closes) {
      if (range.day === startLocal.weekday
        && sameDay
        && startLocal.minutes >= opens
        && endLocal.minutes < closes) return true;
      continue;
    }

    if (range.day === startLocal.weekday
      && startLocal.minutes >= opens
      && (sameDay || endLocal.minutes < closes)) return true;

    if (range.day !== startLocal.weekday
      && startLocal.minutes < closes
      && endLocal.weekday === startLocal.weekday) {
      const weekdayIndex = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const previousDay = weekdayIndex[(weekdayIndex.indexOf(startLocal.weekday) + 6) % 7];
      if (range.day === previousDay) return true;
    }
  }

  return false;
}

function getRecentReports(reports, now) {
  return reports.flatMap((report) => {
    const timestamp = Date.parse(report.reportedAt);
    const crowdScore = CROWD_SCORES[String(report.crowdLevel).toLowerCase()];
    const age = now.getTime() - timestamp;
    if (!Number.isFinite(timestamp) || crowdScore === undefined || age < 0 || age > REPORT_MAX_AGE_MS) {
      return [];
    }

    return [{ crowdScore, weight: Math.exp(-age / (2 * 60 * 60 * 1000)) }];
  });
}

function getConfidence(reportCount, effectiveWeight) {
  if (reportCount < MIN_REPORT_COUNT || effectiveWeight < MIN_EFFECTIVE_REPORT_WEIGHT) {
    return { score: 0, level: "low" };
  }

  const countCoverage = Math.min(1, reportCount / 5);
  const score = Math.min(0.98, (1 - Math.exp(-effectiveWeight / 2)) * (0.6 + 0.4 * countCoverage));
  const roundedScore = Math.round(score * 100) / 100;
  return {
    score: roundedScore,
    level: roundedScore >= 0.75 ? "high" : roundedScore >= 0.45 ? "medium" : "low",
  };
}

function getEventImpact(events, start, end) {
  const duration = end.getTime() - start.getTime();
  return Math.min(0.3, events.reduce((total, event) => {
    const eventStart = Date.parse(event.startsAt);
    const eventEnd = Date.parse(event.endsAt);
    const attendance = Number(event.expectedAttendance);
    if (!Number.isFinite(eventStart) || !Number.isFinite(eventEnd)
      || !Number.isFinite(attendance) || attendance <= 0 || eventEnd <= eventStart) return total;

    const overlap = Math.max(0, Math.min(end.getTime(), eventEnd) - Math.max(start.getTime(), eventStart));
    return total + Math.min(0.25, attendance / 1000 * 0.25) * overlap / duration;
  }, 0));
}

function getStatus(score) {
  if (score < 0.33) return "quiet";
  if (score < 0.6) return "moderate";
  if (score < 0.82) return "busy";
  return "very busy";
}

function estimateWindow(data, reports, start, end) {
  const open = isWithinHours(data.location, start, end);
  if (open === false) {
    return { status: "closed", crowdScore: null, confidence: { score: 1, level: "high" } };
  }

  if (open === null || !data.eventsAvailable || reports.length < MIN_REPORT_COUNT) {
    return { status: "insufficient_data", crowdScore: null, confidence: { score: 0, level: "low" } };
  }

  const effectiveWeight = reports.reduce((sum, report) => sum + report.weight, 0);
  const confidence = getConfidence(reports.length, effectiveWeight);
  if (effectiveWeight < MIN_EFFECTIVE_REPORT_WEIGHT) {
    return { status: "insufficient_data", crowdScore: null, confidence };
  }

  const reportAverage = reports.reduce((sum, report) => sum + report.crowdScore * report.weight, 0)
    / effectiveWeight;
  const crowdScore = Math.min(1, reportAverage + getEventImpact(data.events, start, end));
  return {
    status: getStatus(crowdScore),
    crowdScore: Math.round(crowdScore * 100),
    confidence,
  };
}

function getReasonList(data, reports, current, now) {
  const reasons = [];
  if (!Array.isArray(data.location.operatingHours)) {
    reasons.push("Operating hours are not available from a verified source.");
  }
  if (reports.length < MIN_REPORT_COUNT) {
    reasons.push(`Only ${reports.length} recent crowd report(s) are available; at least ${MIN_REPORT_COUNT} are needed.`);
  } else {
    reasons.push(`${reports.length} reports from the last 6 hours are weighted by freshness.`);
  }

  const currentEnd = new Date(now.getTime() + 30 * 60 * 1000);
  if (!data.eventsAvailable) {
    reasons.push("Event data is not available from a verified source.");
  } else if (getEventImpact(data.events, now, currentEnd) > 0) {
    reasons.push("A scheduled event overlaps the current 30-minute window and increases the crowd estimate.");
  } else {
    reasons.push("No scheduled event with an attendance estimate overlaps the current 30-minute window.");
  }
  if (current.status === "closed") reasons.push("The location is closed during the current 30-minute window.");
  return reasons;
}

export function buildForecast(data, now = new Date()) {
  const currentTime = new Date(now);
  if (!Number.isFinite(currentTime.getTime())) throw new TypeError("now must be a valid date");

  const recentReports = getRecentReports(data.reports, currentTime);
  const currentEnd = new Date(currentTime.getTime() + 30 * 60 * 1000);
  const current = estimateWindow(data, recentReports, currentTime, currentEnd);
  const firstHour = new Date(Math.floor(currentTime.getTime() / HOUR_MS) * HOUR_MS + HOUR_MS);

  const hourlyPredictions = Array.from({ length: 3 }, (_, index) => {
    const start = new Date(firstHour.getTime() + index * HOUR_MS);
    const end = new Date(start.getTime() + HOUR_MS);
    const prediction = estimateWindow(data, recentReports, start, end);
    return {
      start: start.toISOString(),
      end: end.toISOString(),
      status: prediction.status,
      crowd_score: prediction.crowdScore,
      confidence: prediction.confidence,
    };
  });

  const candidateWindows = hourlyPredictions.flatMap((hour) => {
    const hourStart = new Date(hour.start);
    return [0, 30].map((offset) => {
      const start = new Date(hourStart.getTime() + offset * 60 * 1000);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      return { start, end, prediction: estimateWindow(data, recentReports, start, end) };
    });
  }).filter(({ prediction }) => prediction.crowdScore !== null);

  candidateWindows.sort((a, b) => a.prediction.crowdScore - b.prediction.crowdScore);
  const recommended = candidateWindows[0];
  const effectiveWeight = recentReports.reduce((sum, report) => sum + report.weight, 0);
  const operatingHoursAvailable = Array.isArray(data.location.operatingHours);
  const dataQualityStatus = operatingHoursAvailable
    && data.eventsAvailable
    && recentReports.length >= MIN_REPORT_COUNT
    && effectiveWeight >= MIN_EFFECTIVE_REPORT_WEIGHT
    ? "sufficient"
    : "insufficient_data";

  return {
    location: { id: data.location.id, name: data.location.name },
    as_of: currentTime.toISOString(),
    dataMode: data.dataMode,
    ...(data.dataMode === "demo" ? { label: "Demo data" } : {}),
    sources: data.sources,
    lastUpdated: data.lastUpdated,
    dataQuality: {
      status: dataQualityStatus,
      recentReportCount: recentReports.length,
      requiredReportCount: MIN_REPORT_COUNT,
      operatingHoursAvailable,
      eventsAvailable: data.eventsAvailable,
    },
    current_status: current.status,
    hourly_predictions: hourlyPredictions,
    recommended_visit_window: recommended
      ? {
        start: recommended.start.toISOString(),
        end: recommended.end.toISOString(),
        status: recommended.prediction.status,
      }
      : null,
    confidence: getConfidence(recentReports.length, effectiveWeight),
    reasons: getReasonList(data, recentReports, current, currentTime),
  };
}
