import {
  ORDER_STATUS,
  PRIORITY_LEVELS,
  AGENT_AVAILABILITY,
  VALID_STATUS_TRANSITIONS,
} from './constants.js';
import { areCoordinatesValid } from './distance.js';

/**
 * Trim string value safely
 * @param {*} value 
 * @returns {string}
 */
export function sanitizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Basic phone number format validation
 * Allows digits, spaces, hyphens, plus, parentheses (at least 7 digits)
 * @param {string} phone 
 * @returns {boolean}
 */
export function isValidPhone(phone) {
  const sanitized = sanitizeText(phone);
  const digitsOnly = sanitized.replace(/\D/g, '');
  return digitsOnly.length >= 7 && /^[0-9+\s\-()]{7,20}$/.test(sanitized);
}

/**
 * Check if a priority string is valid
 * @param {string} priority 
 * @returns {boolean}
 */
export function isValidPriority(priority) {
  return PRIORITY_LEVELS.includes(priority);
}

/**
 * Check if order status is valid
 * @param {string} status 
 * @returns {boolean}
 */
export function isValidOrderStatus(status) {
  return Object.values(ORDER_STATUS).includes(status);
}

/**
 * Check if agent availability is valid
 * @param {string} availability 
 * @returns {boolean}
 */
export function isValidAgentAvailability(availability) {
  return Object.values(AGENT_AVAILABILITY).includes(availability);
}

/**
 * Validate input when creating an order
 * @param {Object} order 
 * @returns {{ valid: boolean, errors: Object }}
 */
export function validateOrderInput(order) {
  const errors = {};
  const customerName = sanitizeText(order.customerName);
  const customerPhone = sanitizeText(order.customerPhone);
  const location = sanitizeText(order.location);
  const priority = sanitizeText(order.priority);
  const lat = order.latitude !== undefined && order.latitude !== '' ? Number(order.latitude) : null;
  const lon = order.longitude !== undefined && order.longitude !== '' ? Number(order.longitude) : null;

  if (!customerName) {
    errors.customerName = 'Customer name is required.';
  } else if (customerName.length < 2) {
    errors.customerName = 'Customer name must be at least 2 characters.';
  }

  if (!customerPhone) {
    errors.customerPhone = 'Customer phone number is required.';
  } else if (!isValidPhone(customerPhone)) {
    errors.customerPhone = 'Please enter a valid phone number (at least 7 digits).';
  }

  if (!location) {
    errors.location = 'Delivery location/address is required.';
  }

  if (!priority || !isValidPriority(priority)) {
    errors.priority = 'Priority must be LOW, NORMAL, HIGH, or URGENT.';
  }

  if (lat === null || lon === null || !areCoordinatesValid(lat, lon)) {
    errors.coordinates = 'Valid latitude (-90 to 90) and longitude (-180 to 180) are required.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validate input when registering an agent
 * @param {Object} agent 
 * @returns {{ valid: boolean, errors: Object }}
 */
export function validateAgentInput(agent) {
  const errors = {};
  const name = sanitizeText(agent.name);
  const phone = sanitizeText(agent.phone);
  const location = sanitizeText(agent.location);
  const availability = sanitizeText(agent.availability);
  const maxCapacity = Number(agent.maxCapacity);
  const lat = agent.latitude !== undefined && agent.latitude !== '' ? Number(agent.latitude) : null;
  const lon = agent.longitude !== undefined && agent.longitude !== '' ? Number(agent.longitude) : null;

  if (!name) {
    errors.name = 'Agent name is required.';
  } else if (name.length < 2) {
    errors.name = 'Agent name must be at least 2 characters.';
  }

  if (!phone) {
    errors.phone = 'Agent phone number is required.';
  } else if (!isValidPhone(phone)) {
    errors.phone = 'Please enter a valid phone number (at least 7 digits).';
  }

  if (!location) {
    errors.location = 'Current base location is required.';
  }

  if (!availability || !isValidAgentAvailability(availability)) {
    errors.availability = 'Availability must be AVAILABLE, BUSY, or OFFLINE.';
  }

  if (!Number.isInteger(maxCapacity) || maxCapacity <= 0 || maxCapacity > 20) {
    errors.maxCapacity = 'Maximum capacity must be an integer between 1 and 20.';
  }

  if (lat === null || lon === null || !areCoordinatesValid(lat, lon)) {
    errors.coordinates = 'Valid latitude (-90 to 90) and longitude (-180 to 180) are required.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validate assignment of an order to an agent
 * @param {Object} order 
 * @param {Object} agent 
 * @returns {{ valid: boolean, reason: string|null }}
 */
export function validateAssignment(order, agent) {
  if (!order) {
    return { valid: false, reason: 'Order not found.' };
  }

  if (!agent) {
    return { valid: false, reason: 'Agent not found.' };
  }

  if (order.status === ORDER_STATUS.DELIVERED) {
    return { valid: false, reason: 'Cannot assign an already delivered order.' };
  }

  if (order.status === ORDER_STATUS.CANCELLED) {
    return { valid: false, reason: 'Cannot assign a cancelled order.' };
  }

  if (order.assignedAgentId && String(order.assignedAgentId) === String(agent.id)) {
    return { valid: false, reason: 'This order is already assigned to this agent.' };
  }

  if (agent.availability === AGENT_AVAILABILITY.OFFLINE) {
    return { valid: false, reason: `Agent ${agent.name} is currently OFFLINE.` };
  }

  const activeOrdersCount = Number(agent.activeOrders) || 0;
  const maxCap = Number(agent.maxCapacity) || 3;

  if (activeOrdersCount >= maxCap) {
    return {
      valid: false,
      reason: `Agent ${agent.name} is at maximum capacity (${activeOrdersCount}/${maxCap} orders).`,
    };
  }

  return { valid: true, reason: null };
}

/**
 * Check if a status transition is valid
 * @param {string} currentStatus 
 * @param {string} targetStatus 
 * @returns {{ valid: boolean, reason: string|null }}
 */
export function validateStatusTransition(currentStatus, targetStatus) {
  if (!isValidOrderStatus(targetStatus)) {
    return { valid: false, reason: `"${targetStatus}" is not a valid order status.` };
  }

  if (currentStatus === targetStatus) {
    return { valid: false, reason: `Order is already in "${currentStatus}" status.` };
  }

  const allowedNext = VALID_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowedNext.includes(targetStatus)) {
    return {
      valid: false,
      reason: `Cannot transition order status from ${currentStatus} to ${targetStatus}. Allowed: [${allowedNext.join(', ') || 'none'}].`,
    };
  }

  return { valid: true, reason: null };
}
