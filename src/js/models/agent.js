import { DEFAULT_AGENT_AVAILABILITY, DEFAULT_MAX_CAPACITY } from '../utils/constants.js';

/**
 * Factory function for creating a structured Agent entity
 * @param {Object} params
 * @returns {Object} Agent
 */
export function createAgent({
  id,
  name,
  phone,
  location,
  latitude,
  longitude,
  availability = DEFAULT_AGENT_AVAILABILITY,
  activeOrders = 0,
  maxCapacity = DEFAULT_MAX_CAPACITY,
  createdAt = new Date().toISOString(),
}) {
  return {
    id,
    name: String(name).trim(),
    phone: String(phone).trim(),
    location: String(location).trim(),
    latitude: Number(latitude),
    longitude: Number(longitude),
    availability,
    activeOrders: Math.max(0, Number(activeOrders) || 0),
    maxCapacity: Math.max(1, Number(maxCapacity) || DEFAULT_MAX_CAPACITY),
    createdAt,
  };
}
