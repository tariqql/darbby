/**
 * Google Maps API utilities for route fetching and distance matrix.
 * Falls back to straight-line encoding if GOOGLE_MAPS_API_KEY is not set.
 */

const GMAPS_KEY = process.env.GOOGLE_MAPS_API_KEY;

export interface RouteResult {
  polyline: string;
  distanceMeters: number;
  durationSeconds: number;
  distanceText: string;
  durationText: string;
}

export async function getRouteFromGoogle(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<RouteResult> {
  if (!GMAPS_KEY) {
    const dist = haversineMeters(originLat, originLng, destLat, destLng);
    return {
      polyline: encodeStraightLine(originLat, originLng, destLat, destLng),
      distanceMeters: Math.round(dist),
      durationSeconds: Math.round(dist / 13.89),
      distanceText: `${(dist / 1000).toFixed(1)} km`,
      durationText: `${Math.round(dist / 13.89 / 60)} mins`,
    };
  }

  const url =
    `https://maps.googleapis.com/maps/api/directions/json` +
    `?origin=${originLat},${originLng}` +
    `&destination=${destLat},${destLng}` +
    `&key=${GMAPS_KEY}`;

  const res = await fetch(url);
  const data = (await res.json()) as any;

  if (data.status !== "OK" || !data.routes?.length) {
    throw new Error(`Google Maps error: ${data.status}`);
  }

  const route = data.routes[0];
  const leg = route.legs[0];
  return {
    polyline: route.overview_polyline.points,
    distanceMeters: leg.distance.value,
    durationSeconds: leg.duration.value,
    distanceText: leg.distance.text,
    durationText: leg.duration.text,
  };
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function encodeStraightLine(lat1: number, lng1: number, lat2: number, lng2: number): string {
  return encodePolyline([
    [lat1, lng1],
    [lat2, lng2],
  ]);
}

function encodePolyline(points: [number, number][]): string {
  let result = "";
  let prevLat = 0;
  let prevLng = 0;

  for (const [lat, lng] of points) {
    result += encodeValue(Math.round(lat * 1e5) - prevLat);
    result += encodeValue(Math.round(lng * 1e5) - prevLng);
    prevLat = Math.round(lat * 1e5);
    prevLng = Math.round(lng * 1e5);
  }
  return result;
}

function encodeValue(value: number): string {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let result = "";
  while (v >= 0x20) {
    result += String.fromCharCode(((0x20 | (v & 0x1f)) + 63));
    v >>= 5;
  }
  result += String.fromCharCode((v + 63));
  return result;
}
