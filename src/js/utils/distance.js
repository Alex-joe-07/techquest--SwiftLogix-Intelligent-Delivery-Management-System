/**
 * Earth radius in kilometers
 */
const EARTH_RADIUS_KM = 6371;

/**
 * Convert degrees to radians
 * @param {number} degrees 
 * @returns {number}
 */
function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

/**
 * Validate geographic coordinate numbers
 * @param {number} lat 
 * @param {number} lon 
 * @returns {boolean}
 */
export function areCoordinatesValid(lat, lon) {
  const numLat = Number(lat);
  const numLon = Number(lon);

  if (!Number.isFinite(numLat) || !Number.isFinite(numLon)) {
    return false;
  }

  return numLat >= -90 && numLat <= 90 && numLon >= -180 && numLon <= 180;
}

/**
 * Calculate distance between two coordinate pairs using the Haversine formula
 * @param {number} lat1 Latitude of point 1
 * @param {number} lon1 Longitude of point 1
 * @param {number} lat2 Latitude of point 2
 * @param {number} lon2 Longitude of point 2
 * @returns {number|null} Distance in kilometers rounded to 2 decimal places, or null if coordinates are invalid
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!areCoordinatesValid(lat1, lon1) || !areCoordinatesValid(lat2, lon2)) {
    return null;
  }

  const dLat = toRadians(Number(lat2) - Number(lat1));
  const dLon = toRadians(Number(lon2) - Number(lon1));

  const radLat1 = toRadians(Number(lat1));
  const radLat2 = toRadians(Number(lat2));

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(radLat1) * Math.cos(radLat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_KM * c;

  return Math.round(distance * 100) / 100;
}

/**
 * Format a kilometer value into a human-readable string
 * @param {number|null} km 
 * @returns {string}
 */
export function formatDistance(km) {
  if (km === null || km === undefined || !Number.isFinite(km)) {
    return 'Distance unavailable';
  }
  return `${km.toFixed(2)} km`;
}
