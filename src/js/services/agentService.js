import { createAgent } from '../models/agent.js';
import {
  STORAGE_KEYS,
  AGENT_AVAILABILITY,
  DEFAULT_AGENT_AVAILABILITY,
  DEFAULT_MAX_CAPACITY,
} from '../utils/constants.js';
import { storage } from '../utils/storage.js';
import { sanitizeText, validateAgentInput } from '../utils/validation.js';

const defaultSeedAgents = [
  {
    id: 'AGT-001',
    name: 'Alex Rivera',
    phone: '555-0201',
    location: 'Downtown Metro Hub',
    latitude: 37.7890,
    longitude: -122.4020,
    availability: AGENT_AVAILABILITY.AVAILABLE,
    activeOrders: 0,
    maxCapacity: 3,
    createdAt: '2026-09-01T08:00:00.000Z',
  },
  {
    id: 'AGT-002',
    name: 'Marcus Chen',
    phone: '555-0202',
    location: 'Mission District Center',
    latitude: 37.7550,
    longitude: -122.4180,
    availability: AGENT_AVAILABILITY.AVAILABLE,
    activeOrders: 1,
    maxCapacity: 3,
    createdAt: '2026-09-01T08:30:00.000Z',
  },
  {
    id: 'AGT-003',
    name: 'Sarah Jenkins',
    phone: '555-0203',
    location: 'SoMa Station',
    latitude: 37.7810,
    longitude: -122.4050,
    availability: AGENT_AVAILABILITY.BUSY,
    activeOrders: 2,
    maxCapacity: 3,
    createdAt: '2026-09-01T09:00:00.000Z',
  },
  {
    id: 'AGT-004',
    name: 'David Kim',
    phone: '555-0204',
    location: 'Presidio Outpost',
    latitude: 37.7980,
    longitude: -122.4660,
    availability: AGENT_AVAILABILITY.OFFLINE,
    activeOrders: 0,
    maxCapacity: 3,
    createdAt: '2026-09-02T10:00:00.000Z',
  },
];

function getNextAgentNumber(agents) {
  const matches = agents
    .map((agent) => Number.parseInt(String(agent.id).replace(/\D/g, ''), 10))
    .filter((value) => Number.isFinite(value));

  const highest = matches.length > 0 ? Math.max(...matches) : 0;
  return highest + 1;
}

function persistAgents(agents) {
  storage.set(STORAGE_KEYS.agents, agents);
}

/**
 * Initialize agent store with persistence fallback
 * @returns {Promise<Array>}
 */
export async function initializeAgentStore() {
  const existing = storage.get(STORAGE_KEYS.agents, null);
  if (Array.isArray(existing) && existing.length > 0) {
    return existing;
  }

  try {
    const res = await fetch('./data/agents.json');
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json) && json.length > 0) {
        persistAgents(json);
        return json;
      }
    }
  } catch (err) {
    console.warn('Could not load agents.json, using built-in seed agents.', err);
  }

  persistAgents(defaultSeedAgents);
  return defaultSeedAgents;
}

/**
 * Retrieve all agents with optional filtering
 * @param {Object} [filters]
 * @param {string} [filters.availability]
 * @param {string} [filters.search]
 * @returns {Array}
 */
export function getAgents(filters = {}) {
  const agents = storage.get(STORAGE_KEYS.agents, defaultSeedAgents);

  return agents.filter((agent) => {
    if (filters.availability && filters.availability !== 'ALL') {
      if (agent.availability !== filters.availability) {
        return false;
      }
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      const matchName = agent.name.toLowerCase().includes(q);
      const matchPhone = agent.phone.includes(q);
      const matchLocation = agent.location.toLowerCase().includes(q);
      const matchId = agent.id.toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchLocation && !matchId) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Get an agent by ID
 * @param {string} agentId 
 * @returns {Object|null}
 */
export function getAgentById(agentId) {
  if (!agentId) return null;
  const agents = storage.get(STORAGE_KEYS.agents, defaultSeedAgents);
  return agents.find((a) => String(a.id) === String(agentId)) || null;
}

/**
 * Register a new agent
 * @param {Object} formValues 
 * @returns {Object} Newly created agent
 */
export function createAgentRecord(formValues) {
  const values = {
    name: sanitizeText(formValues.name),
    phone: sanitizeText(formValues.phone),
    location: sanitizeText(formValues.location),
    latitude: formValues.latitude,
    longitude: formValues.longitude,
    availability: formValues.availability || DEFAULT_AGENT_AVAILABILITY,
    maxCapacity: formValues.maxCapacity || DEFAULT_MAX_CAPACITY,
  };

  const { valid, errors } = validateAgentInput(values);
  if (!valid) {
    const firstError = Object.values(errors)[0];
    throw new Error(firstError);
  }

  const agents = storage.get(STORAGE_KEYS.agents, defaultSeedAgents);
  const nextNum = getNextAgentNumber(agents);
  const newAgent = createAgent({
    id: `AGT-${String(nextNum).padStart(3, '0')}`,
    name: values.name,
    phone: values.phone,
    location: values.location,
    latitude: values.latitude,
    longitude: values.longitude,
    availability: values.availability,
    activeOrders: 0,
    maxCapacity: values.maxCapacity,
  });

  agents.push(newAgent);
  persistAgents(agents);
  return newAgent;
}

/**
 * Update agent availability
 * @param {string} agentId 
 * @param {string} newAvailability 
 * @returns {Object} Updated agent
 */
export function updateAgentAvailability(agentId, newAvailability) {
  const agents = storage.get(STORAGE_KEYS.agents, defaultSeedAgents);
  const agentIndex = agents.findIndex((a) => String(a.id) === String(agentId));

  if (agentIndex === -1) {
    throw new Error(`Agent with ID "${agentId}" was not found.`);
  }

  agents[agentIndex].availability = newAvailability;
  persistAgents(agents);
  return agents[agentIndex];
}

/**
 * Adjust active order workload count for an agent
 * @param {string} agentId 
 * @param {number} delta e.g. +1 or -1
 * @returns {Object} Updated agent
 */
export function updateAgentWorkload(agentId, delta) {
  const agents = storage.get(STORAGE_KEYS.agents, defaultSeedAgents);
  const agentIndex = agents.findIndex((a) => String(a.id) === String(agentId));

  if (agentIndex === -1) {
    throw new Error(`Agent with ID "${agentId}" was not found.`);
  }

  const agent = agents[agentIndex];
  const newActive = Math.max(0, (agent.activeOrders || 0) + delta);
  agent.activeOrders = newActive;

  // Automatically sync busy status if at capacity
  if (agent.availability !== AGENT_AVAILABILITY.OFFLINE) {
    if (newActive >= (agent.maxCapacity || DEFAULT_MAX_CAPACITY)) {
      agent.availability = AGENT_AVAILABILITY.BUSY;
    } else if (agent.availability === AGENT_AVAILABILITY.BUSY && newActive < (agent.maxCapacity || DEFAULT_MAX_CAPACITY)) {
      agent.availability = AGENT_AVAILABILITY.AVAILABLE;
    }
  }

  persistAgents(agents);
  return agent;
}

/**
 * Reset agents to defaults
 */
export function resetAgentStore() {
  persistAgents(defaultSeedAgents);
  return [...defaultSeedAgents];
}
