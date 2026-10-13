import { calculateDistance } from '../utils/distance.js';
import {
  AGENT_AVAILABILITY,
  DEFAULT_MAX_CAPACITY,
  ORDER_STATUS,
} from '../utils/constants.js';
import { validateAssignment } from '../utils/validation.js';
import { getAssignmentConfig } from './assignmentConfig.js';
import { getAgents, getAgentById, updateAgentWorkload } from './agentService.js';
import { getOrderById, setOrderAssignedAgent } from './orderService.js';

/**
 * Generate human-readable explanation of why an agent was scored/recommended
 * @param {Object} details 
 * @returns {string}
 */
function buildExplanationReason({
  agent,
  distanceKm,
  score,
  orderPriority,
  isTop,
}) {
  const distanceDesc = `${distanceKm} km away`;
  const capacityDesc = `${agent.activeOrders}/${agent.maxCapacity} orders active`;
  const statusDesc = agent.availability.toLowerCase();

  if (isTop) {
    if (distanceKm <= 3 && agent.activeOrders === 0) {
      return `Prime match: Located nearby (${distanceDesc}) with zero active orders and full availability. Match score ${score}%.`;
    }
    if (orderPriority === 'URGENT' || orderPriority === 'HIGH') {
      return `Best candidate for ${orderPriority} priority: Strong proximity (${distanceDesc}) and ready capacity (${capacityDesc}). Match score ${score}%.`;
    }
    return `Optimal recommendation: ${distanceDesc}, ${statusDesc} with ${capacityDesc}. Composite score ${score}%.`;
  }

  return `Eligible candidate: ${distanceDesc}, ${capacityDesc}. Score ${score}%.`;
}

/**
 * Evaluate a single agent against an order using deterministic scoring
 * @param {Object} agent 
 * @param {Object} order 
 * @param {Object} config 
 * @returns {Object} Evaluation result
 */
export function evaluateAgentForOrder(agent, order, config = getAssignmentConfig()) {
  // Check eligibility criteria
  if (agent.availability === AGENT_AVAILABILITY.OFFLINE) {
    return {
      agentId: agent.id,
      agentName: agent.name,
      agent,
      eligible: false,
      score: 0,
      reason: `Agent is currently ${agent.availability}.`,
    };
  }

  const maxCapacity = agent.maxCapacity || DEFAULT_MAX_CAPACITY;
  const activeOrders = agent.activeOrders || 0;

  if (activeOrders >= maxCapacity) {
    return {
      agentId: agent.id,
      agentName: agent.name,
      agent,
      eligible: false,
      score: 0,
      reason: `Agent has reached maximum capacity (${activeOrders}/${maxCapacity} orders).`,
    };
  }

  const distanceKm = calculateDistance(
    agent.latitude,
    agent.longitude,
    order.latitude,
    order.longitude
  );

  if (distanceKm === null) {
    return {
      agentId: agent.id,
      agentName: agent.name,
      agent,
      eligible: false,
      score: 0,
      reason: 'Invalid or missing geographic coordinates.',
    };
  }

  // 1. Distance Score (0 to 100)
  const maxDist = config.maxDistanceThresholdKm || 25;
  const distanceRatio = Math.min(distanceKm / maxDist, 1);
  const distanceScore = Math.max(0, Math.round((1 - distanceRatio) * 100));

  // 2. Availability Score (0 to 100)
  let availabilityScore = 0;
  if (agent.availability === AGENT_AVAILABILITY.AVAILABLE) {
    availabilityScore = 100;
  } else if (agent.availability === AGENT_AVAILABILITY.BUSY) {
    availabilityScore = 50;
  }

  // 3. Workload Score (0 to 100)
  const freeCapacityRatio = (maxCapacity - activeOrders) / maxCapacity;
  const workloadScore = Math.max(0, Math.min(100, Math.round(freeCapacityRatio * 100)));

  // 4. Priority Score (0 to 100)
  const priorityScore =
    (config.priorityScores && config.priorityScores[order.priority]) !== undefined
      ? config.priorityScores[order.priority]
      : 50;

  // Weighted Composite Score (0 to 100)
  const rawScore =
    distanceScore * config.distanceWeight +
    availabilityScore * config.availabilityWeight +
    workloadScore * config.workloadWeight +
    priorityScore * config.priorityWeight;

  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  return {
    agentId: agent.id,
    agentName: agent.name,
    agent,
    eligible: true,
    score,
    distanceKm,
    distanceScore,
    availabilityScore,
    workloadScore,
    priorityScore,
    reason: '', // populated after ranking
  };
}

/**
 * Run the Smart Assignment algorithm for an order
 * Returns ranked eligible agents and ineligible agents with reasons
 * @param {string} orderId 
 * @returns {{ eligible: Array, ineligible: Array, recommendedAgent: Object|null, order: Object }}
 */
export function getAgentRecommendationsForOrder(orderId) {
  const order = getOrderById(orderId);
  if (!order) {
    throw new Error(`Order with ID "${orderId}" not found.`);
  }

  const agents = getAgents();
  const config = getAssignmentConfig();

  const eligible = [];
  const ineligible = [];

  for (const agent of agents) {
    const evaluation = evaluateAgentForOrder(agent, order, config);
    if (evaluation.eligible) {
      eligible.push(evaluation);
    } else {
      ineligible.push(evaluation);
    }
  }

  // Sort eligible agents descending by score, tie-breaker: closer distance, then fewer active orders
  eligible.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (a.distanceKm !== b.distanceKm) {
      return a.distanceKm - b.distanceKm;
    }
    return a.agent.activeOrders - b.agent.activeOrders;
  });

  // Populate human-readable explanation reason
  eligible.forEach((item, index) => {
    item.reason = buildExplanationReason({
      agent: item.agent,
      distanceKm: item.distanceKm,
      score: item.score,
      orderPriority: order.priority,
      isTop: index === 0,
    });
  });

  const recommendedAgent = eligible.length > 0 ? eligible[0] : null;

  return {
    order,
    eligible,
    ineligible,
    recommendedAgent,
  };
}

/**
 * Assign an order to an agent (manual or smart)
 * Validates assignment constraints, increments agent activeOrders, and updates order
 * @param {string} orderId 
 * @param {string} agentId 
 * @returns {{ success: boolean, order: Object, agent: Object }}
 */
export function assignOrderToAgent(orderId, agentId) {
  const order = getOrderById(orderId);
  if (!order) {
    throw new Error(`Order with ID "${orderId}" was not found.`);
  }

  const agent = getAgentById(agentId);
  if (!agent) {
    throw new Error(`Agent with ID "${agentId}" was not found.`);
  }

  const validation = validateAssignment(order, agent);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  // Atomically update order and agent
  const updatedOrder = setOrderAssignedAgent(orderId, agent.id);
  const updatedAgent = updateAgentWorkload(agent.id, +1);

  return {
    success: true,
    order: updatedOrder,
    agent: updatedAgent,
  };
}

/**
 * Automatically assign the highest-scoring recommended agent to an order
 * @param {string} orderId 
 * @returns {Object} Assignment outcome with explanation
 */
export function autoAssignOrder(orderId) {
  const recommendations = getAgentRecommendationsForOrder(orderId);

  if (!recommendations.recommendedAgent) {
    throw new Error(
      'No eligible agents available for assignment. All agents are either offline or at maximum capacity.'
    );
  }

  const top = recommendations.recommendedAgent;
  const result = assignOrderToAgent(orderId, top.agentId);

  return {
    ...result,
    recommendationDetails: top,
  };
}
