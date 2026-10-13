import { createOrder } from '../models/order.js';
import {
  DEFAULT_ORDER_STATUS,
  ORDER_STATUS,
  PRIORITY_LEVELS,
  STORAGE_KEYS,
} from '../utils/constants.js';
import { storage } from '../utils/storage.js';
import { sanitizeText, validateOrderInput, validateStatusTransition } from '../utils/validation.js';
import { updateAgentWorkload } from './agentService.js';

const defaultSeedOrders = [
  {
    id: 'ORD-1001',
    customerName: 'Ava Thompson',
    customerPhone: '555-0111',
    location: '550 Market St, Downtown',
    latitude: 37.7900,
    longitude: -122.4010,
    priority: 'URGENT',
    status: ORDER_STATUS.PENDING,
    assignedAgentId: null,
    createdAt: '2026-09-10T09:30:00.000Z',
  },
  {
    id: 'ORD-1002',
    customerName: 'Noah Patel',
    customerPhone: '555-0112',
    location: '742 Mission St, SoMa',
    latitude: 37.7865,
    longitude: -122.4035,
    priority: 'HIGH',
    status: ORDER_STATUS.PENDING,
    assignedAgentId: null,
    createdAt: '2026-09-10T10:00:00.000Z',
  },
  {
    id: 'ORD-1003',
    customerName: 'Elena Rostova',
    customerPhone: '555-0113',
    location: '1200 Valencia St, Mission',
    latitude: 37.7525,
    longitude: -122.4208,
    priority: 'NORMAL',
    status: ORDER_STATUS.ASSIGNED,
    assignedAgentId: 'AGT-002',
    createdAt: '2026-09-10T10:15:00.000Z',
  },
  {
    id: 'ORD-1004',
    customerName: 'Liam Gallagher',
    customerPhone: '555-0114',
    location: '333 Post St, Union Square',
    latitude: 37.7885,
    longitude: -122.4075,
    priority: 'LOW',
    status: ORDER_STATUS.IN_TRANSIT,
    assignedAgentId: 'AGT-003',
    createdAt: '2026-09-10T08:45:00.000Z',
  },
  {
    id: 'ORD-1005',
    customerName: 'Maya Lin',
    customerPhone: '555-0115',
    location: '1600 California St, Nob Hill',
    latitude: 37.7915,
    longitude: -122.4190,
    priority: 'HIGH',
    status: ORDER_STATUS.DELIVERED,
    assignedAgentId: 'AGT-001',
    createdAt: '2026-09-10T08:00:00.000Z',
  },
];

function getNextOrderNumber(orders) {
  const matches = orders
    .map((order) => Number.parseInt(String(order.id).replace(/\D/g, ''), 10))
    .filter((value) => Number.isFinite(value));

  const highest = matches.length > 0 ? Math.max(...matches) : 1000;
  return highest + 1;
}

function persistOrders(orders) {
  storage.set(STORAGE_KEYS.orders, orders);
}

/**
 * Initialize order store from storage or mock data
 * @returns {Promise<Array>}
 */
export async function initializeOrderStore() {
  const existing = storage.get(STORAGE_KEYS.orders, null);
  if (Array.isArray(existing) && existing.length > 0) {
    return existing;
  }

  try {
    const res = await fetch('./data/orders.json');
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json) && json.length > 0) {
        persistOrders(json);
        return json;
      }
    }
  } catch (err) {
    console.warn('Could not load orders.json, using built-in seed orders.', err);
  }

  persistOrders(defaultSeedOrders);
  return defaultSeedOrders;
}

/**
 * Retrieve orders matching optional filters
 * @param {Object} [filters]
 * @param {string} [filters.status]
 * @param {string} [filters.priority]
 * @param {string} [filters.search]
 * @returns {Array}
 */
export function getOrders(filters = {}) {
  const orders = storage.get(STORAGE_KEYS.orders, defaultSeedOrders);

  return orders.filter((order) => {
    if (filters.status && filters.status !== 'ALL') {
      if (order.status !== filters.status) return false;
    }

    if (filters.priority && filters.priority !== 'ALL') {
      if (order.priority !== filters.priority) return false;
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      const matchCustomer = order.customerName.toLowerCase().includes(q);
      const matchPhone = order.customerPhone.includes(q);
      const matchLocation = order.location.toLowerCase().includes(q);
      const matchId = order.id.toLowerCase().includes(q);
      if (!matchCustomer && !matchPhone && !matchLocation && !matchId) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Get an order by its unique ID
 * @param {string} orderId 
 * @returns {Object|null}
 */
export function getOrderById(orderId) {
  if (!orderId) return null;
  const orders = storage.get(STORAGE_KEYS.orders, defaultSeedOrders);
  return orders.find((order) => String(order.id) === String(orderId)) || null;
}

/**
 * Create a new order record
 * @param {Object} formValues 
 * @returns {Object} Newly created order
 */
export function createOrderRecord(formValues) {
  const values = {
    customerName: sanitizeText(formValues.customerName),
    customerPhone: sanitizeText(formValues.customerPhone),
    location: sanitizeText(formValues.location),
    latitude: formValues.latitude,
    longitude: formValues.longitude,
    priority: sanitizeText(formValues.priority),
  };

  const { valid, errors } = validateOrderInput(values);
  if (!valid) {
    const firstError = Object.values(errors)[0];
    throw new Error(firstError);
  }

  const orders = storage.get(STORAGE_KEYS.orders, defaultSeedOrders);
  const nextOrderNumber = getNextOrderNumber(orders);
  const order = createOrder({
    id: `ORD-${String(nextOrderNumber).padStart(4, '0')}`,
    customerName: values.customerName,
    customerPhone: values.customerPhone,
    location: values.location,
    latitude: values.latitude,
    longitude: values.longitude,
    priority: values.priority,
    status: DEFAULT_ORDER_STATUS,
    assignedAgentId: null,
    createdAt: new Date().toISOString(),
  });

  orders.unshift(order);
  persistOrders(orders);
  return order;
}

/**
 * Advance or change an order's delivery lifecycle status
 * Automatically handles agent activeOrders adjustment when completed/cancelled
 * @param {string} orderId 
 * @param {string} newStatus 
 * @returns {Object} Updated order
 */
export function updateOrderStatus(orderId, newStatus) {
  const orders = storage.get(STORAGE_KEYS.orders, defaultSeedOrders);
  const index = orders.findIndex((o) => String(o.id) === String(orderId));

  if (index === -1) {
    throw new Error(`Order with ID "${orderId}" was not found.`);
  }

  const order = orders[index];
  const validation = validateStatusTransition(order.status, newStatus);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  const previousStatus = order.status;
  order.status = newStatus;

  // If order was active with an agent and now reached a terminal status (DELIVERED or CANCELLED)
  const wasActiveWithAgent =
    order.assignedAgentId &&
    [ORDER_STATUS.ASSIGNED, ORDER_STATUS.PICKED_UP, ORDER_STATUS.IN_TRANSIT].includes(previousStatus);

  const isTerminalStatus =
    newStatus === ORDER_STATUS.DELIVERED || newStatus === ORDER_STATUS.CANCELLED;

  if (wasActiveWithAgent && isTerminalStatus) {
    try {
      updateAgentWorkload(order.assignedAgentId, -1);
    } catch (err) {
      console.warn(`Could not update agent workload for agent ${order.assignedAgentId}:`, err);
    }
  }

  persistOrders(orders);
  return order;
}

/**
 * Assign an agent to an order and update order status to ASSIGNED
 * @param {string} orderId 
 * @param {string} agentId 
 * @returns {Object} Updated order
 */
export function setOrderAssignedAgent(orderId, agentId) {
  const orders = storage.get(STORAGE_KEYS.orders, defaultSeedOrders);
  const index = orders.findIndex((o) => String(o.id) === String(orderId));

  if (index === -1) {
    throw new Error(`Order with ID "${orderId}" not found.`);
  }

  orders[index].assignedAgentId = agentId;
  orders[index].status = ORDER_STATUS.ASSIGNED;

  persistOrders(orders);
  return orders[index];
}

/**
 * Return list of valid priority options
 * @returns {Array<string>}
 */
export function getPriorityOptions() {
  return [...PRIORITY_LEVELS];
}

/**
 * Reset orders to default seed data
 */
export function resetOrderStore() {
  persistOrders(defaultSeedOrders);
  return [...defaultSeedOrders];
}
