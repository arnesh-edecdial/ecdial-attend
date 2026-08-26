/**
 * Calculate the great-circle distance between two points on the Earth's surface (in meters)
 * using the Haversine formula.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c * 10) / 10; // Round to 1 decimal place (meters)
}

/**
 * Validate whether the device location falls within allowed radius
 */
export function isWithinOfficeRadius(
  userLat: number,
  userLon: number,
  officeLat: number,
  officeLon: number,
  allowedRadiusMeters: number
): { isWithin: boolean; distanceMeters: number } {
  const distanceMeters = calculateHaversineDistance(userLat, userLon, officeLat, officeLon);
  return {
    isWithin: distanceMeters <= allowedRadiusMeters,
    distanceMeters,
  };
}
