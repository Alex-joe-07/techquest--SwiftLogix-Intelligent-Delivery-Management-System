import { storage } from '../utils/storage.js';
import { STORAGE_KEYS } from '../utils/constants.js';

export const DEFAULT_ASSIGNMENT_CONFIG = {
  distanceWeight: 0.40,
  availabilityWeight: 0.30,
  workloadWeight: 0.20,
  priorityWeight: 0.10,
  maxDistanceThresholdKm: 25,
  priorityScores: {
    URGENT: 100,
    HIGH: 80,
    NORMAL: 50,
    LOW: 20,
  },
};

/**
 * Retrieve current assignment configuration from storage or defaults
 * @returns {Object}
 */
export function getAssignmentConfig() {
  const saved = storage.get(STORAGE_KEYS.config, null);
  if (!saved || typeof saved !== 'object') {
    return { ...DEFAULT_ASSIGNMENT_CONFIG };
  }
  return {
    ...DEFAULT_ASSIGNMENT_CONFIG,
    ...saved,
    priorityScores: {
      ...DEFAULT_ASSIGNMENT_CONFIG.priorityScores,
      ...(saved.priorityScores || {}),
    },
  };
}

/**
 * Update assignment configuration and persist to storage
 * @param {Object} partialConfig 
 * @returns {Object} Updated configuration
 */
export function updateAssignmentConfig(partialConfig) {
  const current = getAssignmentConfig();
  const updated = {
    ...current,
    ...partialConfig,
  };
  storage.set(STORAGE_KEYS.config, updated);
  return updated;
}

/**
 * Reset assignment configuration to defaults
 * @returns {Object}
 */
export function resetAssignmentConfig() {
  storage.set(STORAGE_KEYS.config, DEFAULT_ASSIGNMENT_CONFIG);
  return { ...DEFAULT_ASSIGNMENT_CONFIG };
}
