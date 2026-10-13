import { DEFAULT_ORDER_STATUS, DEFAULT_PRIORITY } from '../utils/constants.js';

/**
 * Factory function for creating a structured Order entity
 * @param {Object} params
 * @returns {Object} Order
 */
export function createOrder({
  id,
  customerName,
  customerPhone,
  location,
  latitude,
  longitude,
  priority = DEFAULT_PRIORITY,
  status = DEFAULT_ORDER_STATUS,
  assignedAgentId = null,
  createdAt = new Date().toISOString(),
}) {
  return {
    id,
    customerName: String(customerName).trim(),
    customerPhone: String(customerPhone).trim(),
    location: String(location).trim(),
    latitude: Number(latitude),
    longitude: Number(longitude),
    priority,
    status,
    assignedAgentId,
    createdAt,
  };
}
