import assert from 'node:assert';
import { calculateDistance, areCoordinatesValid, formatDistance } from '../src/js/utils/distance.js';
import {
  ORDER_STATUS,
  PRIORITY,
  AGENT_AVAILABILITY,
  VALID_STATUS_TRANSITIONS,
} from '../src/js/utils/constants.js';
import {
  validateOrderInput,
  validateAgentInput,
  validateAssignment,
  validateStatusTransition,
  isValidPhone,
} from '../src/js/utils/validation.js';
import {
  getAssignmentConfig,
  updateAssignmentConfig,
  resetAssignmentConfig,
  DEFAULT_ASSIGNMENT_CONFIG,
} from '../src/js/services/assignmentConfig.js';
import {
  getAgents,
  getAgentById,
  createAgentRecord,
  updateAgentAvailability,
  updateAgentWorkload,
  resetAgentStore,
} from '../src/js/services/agentService.js';
import {
  getOrders,
  getOrderById,
  createOrderRecord,
  updateOrderStatus,
  resetOrderStore,
} from '../src/js/services/orderService.js';
import {
  evaluateAgentForOrder,
  getAgentRecommendationsForOrder,
  assignOrderToAgent,
  autoAssignOrder,
} from '../src/js/services/assignmentService.js';

let passedCount = 0;
let totalCount = 0;

function test(name, fn) {
  totalCount++;
  try {
    fn();
    passedCount++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
    throw err;
  }
}

console.log('\n--- Running Unit Test Suite ---');

// 1. Distance & Coordinate Tests
console.log('\n[1] Geographic Distance Calculation');
test('areCoordinatesValid accepts valid coordinates', () => {
  assert.strictEqual(areCoordinatesValid(37.7749, -122.4194), true);
  assert.strictEqual(areCoordinatesValid(0, 0), true);
  assert.strictEqual(areCoordinatesValid(-90, -180), true);
  assert.strictEqual(areCoordinatesValid(90, 180), true);
});

test('areCoordinatesValid rejects out-of-range coordinates', () => {
  assert.strictEqual(areCoordinatesValid(91, 0), false);
  assert.strictEqual(areCoordinatesValid(-91, 0), false);
  assert.strictEqual(areCoordinatesValid(0, 181), false);
  assert.strictEqual(areCoordinatesValid('invalid', 50), false);
});

test('calculateDistance returns 0 for identical points', () => {
  const dist = calculateDistance(37.7749, -122.4194, 37.7749, -122.4194);
  assert.strictEqual(dist, 0);
});

test('calculateDistance accurately measures known distance', () => {
  // SF City Hall to Ferry Building: ~2.89 km
  const dist = calculateDistance(37.7792, -122.4191, 37.7955, -122.3937);
  assert.ok(dist >= 2.5 && dist <= 3.2, `Expected ~2.9 km, got ${dist}`);
});

test('calculateDistance safely returns null for invalid coordinates', () => {
  assert.strictEqual(calculateDistance(95, 0, 10, 10), null);
});

test('formatDistance produces readable strings', () => {
  assert.strictEqual(formatDistance(2.891), '2.89 km');
  assert.strictEqual(formatDistance(null), 'Distance unavailable');
});

// 2. Validation Tests
console.log('\n[2] Input & Domain Validation');
test('isValidPhone checks proper formats', () => {
  assert.strictEqual(isValidPhone('555-0123'), true);
  assert.strictEqual(isValidPhone('+1 (555) 012-3456'), true);
  assert.strictEqual(isValidPhone('123'), false);
  assert.strictEqual(isValidPhone('abcd'), false);
});

test('validateOrderInput catches missing required fields', () => {
  const result = validateOrderInput({});
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.customerName);
  assert.ok(result.errors.customerPhone);
  assert.ok(result.errors.location);
  assert.ok(result.errors.coordinates);
});

test('validateOrderInput validates valid order input', () => {
  const result = validateOrderInput({
    customerName: 'Alice Green',
    customerPhone: '555-0987',
    location: '123 Market St',
    latitude: 37.78,
    longitude: -122.41,
    priority: PRIORITY.HIGH,
  });
  assert.strictEqual(result.valid, true);
});

test('validateAgentInput enforces valid capacity and availability', () => {
  const badCapacity = validateAgentInput({
    name: 'Bob',
    phone: '555-4433',
    location: 'Depot',
    latitude: 37.78,
    longitude: -122.41,
    availability: AGENT_AVAILABILITY.AVAILABLE,
    maxCapacity: -1,
  });
  assert.strictEqual(badCapacity.valid, false);
  assert.ok(badCapacity.errors.maxCapacity);
});

test('validateStatusTransition enforces correct lifecycle order', () => {
  assert.strictEqual(validateStatusTransition(ORDER_STATUS.PENDING, ORDER_STATUS.ASSIGNED).valid, true);
  assert.strictEqual(validateStatusTransition(ORDER_STATUS.ASSIGNED, ORDER_STATUS.PICKED_UP).valid, true);
  assert.strictEqual(validateStatusTransition(ORDER_STATUS.PICKED_UP, ORDER_STATUS.IN_TRANSIT).valid, true);
  assert.strictEqual(validateStatusTransition(ORDER_STATUS.IN_TRANSIT, ORDER_STATUS.DELIVERED).valid, true);
  // Cannot skip from PENDING directly to DELIVERED
  assert.strictEqual(validateStatusTransition(ORDER_STATUS.PENDING, ORDER_STATUS.DELIVERED).valid, false);
  // Terminal status cannot transition
  assert.strictEqual(validateStatusTransition(ORDER_STATUS.DELIVERED, ORDER_STATUS.IN_TRANSIT).valid, false);
});

// 3. Assignment Scoring & Config
console.log('\n[3] Assignment Scoring & Configuration');
test('getAssignmentConfig returns default weights summing to 1.0', () => {
  const cfg = getAssignmentConfig();
  const sum = cfg.distanceWeight + cfg.availabilityWeight + cfg.workloadWeight + cfg.priorityWeight;
  assert.ok(Math.abs(sum - 1.0) < 0.001);
});

test('updateAssignmentConfig modifies settings', () => {
  updateAssignmentConfig({ distanceWeight: 0.5, availabilityWeight: 0.2 });
  const cfg = getAssignmentConfig();
  assert.strictEqual(cfg.distanceWeight, 0.5);
  assert.strictEqual(cfg.availabilityWeight, 0.2);
  resetAssignmentConfig();
  assert.strictEqual(getAssignmentConfig().distanceWeight, DEFAULT_ASSIGNMENT_CONFIG.distanceWeight);
});

// 4. Smart Assignment Algorithm Tests
console.log('\n[4] Smart Assignment Ranking & Explanations');
test('evaluateAgentForOrder excludes offline agents', () => {
  const offlineAgent = {
    id: 'AGT-999',
    name: 'Offline Driver',
    availability: AGENT_AVAILABILITY.OFFLINE,
    activeOrders: 0,
    maxCapacity: 3,
    latitude: 37.78,
    longitude: -122.40,
  };
  const order = { latitude: 37.78, longitude: -122.40, priority: PRIORITY.NORMAL };
  const evalResult = evaluateAgentForOrder(offlineAgent, order);
  assert.strictEqual(evalResult.eligible, false);
  assert.ok(evalResult.reason.includes('OFFLINE'));
});

test('evaluateAgentForOrder excludes at-capacity agents', () => {
  const busyFullAgent = {
    id: 'AGT-888',
    name: 'Full Driver',
    availability: AGENT_AVAILABILITY.BUSY,
    activeOrders: 3,
    maxCapacity: 3,
    latitude: 37.78,
    longitude: -122.40,
  };
  const order = { latitude: 37.78, longitude: -122.40, priority: PRIORITY.NORMAL };
  const evalResult = evaluateAgentForOrder(busyFullAgent, order);
  assert.strictEqual(evalResult.eligible, false);
  assert.ok(evalResult.reason.includes('maximum capacity'));
});

test('evaluateAgentForOrder gives closer agent higher score', () => {
  const order = { latitude: 37.78, longitude: -122.40, priority: PRIORITY.NORMAL };
  const closeAgent = {
    id: 'AGT-001',
    name: 'Close Agent',
    availability: AGENT_AVAILABILITY.AVAILABLE,
    activeOrders: 0,
    maxCapacity: 3,
    latitude: 37.781,
    longitude: -122.401,
  };
  const farAgent = {
    id: 'AGT-002',
    name: 'Far Agent',
    availability: AGENT_AVAILABILITY.AVAILABLE,
    activeOrders: 0,
    maxCapacity: 3,
    latitude: 37.70,
    longitude: -122.40,
  };

  const closeEval = evaluateAgentForOrder(closeAgent, order);
  const farEval = evaluateAgentForOrder(farAgent, order);

  assert.ok(closeEval.score > farEval.score, `Close agent (${closeEval.score}) should score higher than far agent (${farEval.score})`);
  assert.ok(closeEval.distanceScore > farEval.distanceScore);
});

// 5. End-to-End Assignment & Lifecycle Flow
console.log('\n[5] End-to-End Assignment and Lifecycle');
test('Full cycle: order creation -> smart recommendation -> assignment -> status transitions -> delivery workload release', () => {
  resetOrderStore();
  resetAgentStore();

  // 1. Create order
  const newOrder = createOrderRecord({
    customerName: 'Jane Test',
    customerPhone: '555-7788',
    location: '500 Howard St',
    latitude: 37.788,
    longitude: -122.399,
    priority: PRIORITY.URGENT,
  });

  assert.strictEqual(newOrder.status, ORDER_STATUS.PENDING);
  assert.strictEqual(newOrder.assignedAgentId, null);

  // 2. Get recommendations
  const recs = getAgentRecommendationsForOrder(newOrder.id);
  assert.ok(recs.eligible.length > 0, 'Should have eligible agents');
  assert.ok(recs.recommendedAgent, 'Should have a recommended top agent');
  assert.ok(recs.recommendedAgent.reason.length > 0, 'Should include explanation reason');

  const topAgent = recs.recommendedAgent.agent;
  const initialActive = topAgent.activeOrders;

  // 3. Assign to recommended agent
  const assignResult = assignOrderToAgent(newOrder.id, topAgent.id);
  assert.strictEqual(assignResult.order.status, ORDER_STATUS.ASSIGNED);
  assert.strictEqual(assignResult.order.assignedAgentId, topAgent.id);
  assert.strictEqual(assignResult.agent.activeOrders, initialActive + 1);

  // 4. Status progression: ASSIGNED -> PICKED_UP -> IN_TRANSIT -> DELIVERED
  updateOrderStatus(newOrder.id, ORDER_STATUS.PICKED_UP);
  let current = getOrderById(newOrder.id);
  assert.strictEqual(current.status, ORDER_STATUS.PICKED_UP);

  updateOrderStatus(newOrder.id, ORDER_STATUS.IN_TRANSIT);
  current = getOrderById(newOrder.id);
  assert.strictEqual(current.status, ORDER_STATUS.IN_TRANSIT);

  // 5. Deliver order: should release agent workload
  updateOrderStatus(newOrder.id, ORDER_STATUS.DELIVERED);
  current = getOrderById(newOrder.id);
  assert.strictEqual(current.status, ORDER_STATUS.DELIVERED);

  const updatedAgent = getAgentById(topAgent.id);
  assert.strictEqual(updatedAgent.activeOrders, initialActive, 'Delivering order should decrement agent activeOrders');
});

console.log(`\n========================================`);
console.log(`All ${passedCount}/${totalCount} unit tests passed successfully!`);
console.log(`========================================\n`);
