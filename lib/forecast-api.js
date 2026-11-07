export async function getLocationForecast(locationId, { signal, fetchImpl = fetch } = {}) {
  if (!locationId || typeof locationId !== "string") {
    throw new TypeError("locationId must be a non-empty string");
  }

  const response = await fetchImpl(
    `/api/locations/${encodeURIComponent(locationId)}/forecast`,
    { signal, headers: { Accept: "application/json" } },
  );
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || `Forecast request failed (${response.status})`);
  }
  return payload;
}
