import { getLocationForecastData } from "../../../../../lib/forecast-model.js";
import { buildForecast } from "../../../../../lib/forecast-service.js";

export async function GET(_request, { params }) {
  const { id } = await params;
  const data = getLocationForecastData(id);

  if (!data) return Response.json({ error: "Location not found" }, { status: 404 });
  return Response.json(buildForecast(data));
}
