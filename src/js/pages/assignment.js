import {
  getOrders,
  getOrderById,
} from '../services/orderService.js';
import {
  getAgentRecommendationsForOrder,
  assignOrderToAgent,
  autoAssignOrder,
} from '../services/assignmentService.js';
import {
  getAssignmentConfig,
  updateAssignmentConfig,
  resetAssignmentConfig,
} from '../services/assignmentConfig.js';
import { ORDER_STATUS, AGENT_AVAILABILITY_LABELS } from '../utils/constants.js';
import { showToast } from '../utils/notifications.js';

let selectedOrderIdForAssignment = null;

export function renderAssignmentPage() {
  const container = document.getElementById('assignment-view');
  if (!container) return;

  const orders = getOrders();
  // Filter for unassigned orders (PENDING, or any without assigned agent)
  const assignableOrders = orders.filter(
    (o) => o.status === ORDER_STATUS.PENDING || (!o.assignedAgentId && o.status !== 'DELIVERED' && o.status !== 'CANCELLED')
  );

  if (
    (!selectedOrderIdForAssignment ||
      !assignableOrders.some((o) => o.id === selectedOrderIdForAssignment)) &&
    assignableOrders.length > 0
  ) {
    selectedOrderIdForAssignment = assignableOrders[0].id;
  }

  container.innerHTML = `
    <div class="assignment-layout">
      <!-- Left Column: Pending Orders Queue -->
      <div>
        <div class="card">
          <div class="card__header">
            <h2 class="card__title">Pending Orders Queue</h2>
            <span class="card__subtitle">${assignableOrders.length} waiting</span>
          </div>

          <div class="pending-orders-panel" id="assign-orders-panel">
            ${
              assignableOrders.length === 0
                ? `
              <div class="empty-state">
                <span class="empty-state__icon">🎉</span>
                <div class="empty-state__title">All orders dispatched!</div>
                <div class="empty-state__text">There are currently no pending orders waiting for assignment. Create a new order to run smart dispatch.</div>
                <a href="#orders" class="btn btn--primary btn--sm" style="margin-top: 10px;">+ Create New Order</a>
              </div>
            `
                : assignableOrders
                    .map(
                      (order) => `
                <div class="assign-order-item ${order.id === selectedOrderIdForAssignment ? 'selected' : ''}" data-order-id="${order.id}">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span class="order-id">${order.id}</span>
                    <span class="badge badge--${order.priority.toLowerCase()}">${order.priority}</span>
                  </div>
                  <div style="font-weight: 600; font-size: 13px; color: var(--color-text); margin-bottom: 2px;">
                    ${escapeHtml(order.customerName)}
                  </div>
                  <div style="font-size: 12px; color: var(--color-text-muted);">
                    📍 ${escapeHtml(order.location)}
                  </div>
                </div>
              `
                    )
                    .join('')
            }
          </div>
        </div>

        <!-- Live Scoring Weights Config Card -->
        <div class="card scoring-weights-card">
          <div class="card__header">
            <h3 class="card__title" style="font-size: 14px;">Scoring Weights Configuration</h3>
            <button type="button" class="btn btn--secondary btn--sm" id="btn-reset-weights">Reset</button>
          </div>
          <p style="font-size: 12px; color: var(--color-text-muted);">
            Tune deterministic scoring weights. Total must equal 100%.
          </p>

          <form id="weights-config-form">
            <div class="weights-grid">
              <div class="weight-input-group">
                <label>Distance Weight</label>
                <input type="number" step="0.05" min="0" max="1" id="weight-dist" class="form-input" />
              </div>
              <div class="weight-input-group">
                <label>Availability Weight</label>
                <input type="number" step="0.05" min="0" max="1" id="weight-avail" class="form-input" />
              </div>
              <div class="weight-input-group">
                <label>Workload Weight</label>
                <input type="number" step="0.05" min="0" max="1" id="weight-load" class="form-input" />
              </div>
              <div class="weight-input-group">
                <label>Priority Weight</label>
                <input type="number" step="0.05" min="0" max="1" id="weight-prio" class="form-input" />
              </div>
            </div>
            <button type="submit" class="btn btn--secondary btn--sm" style="margin-top: 12px; width: 100%;">
              Apply Custom Weights
            </button>
          </form>
        </div>
      </div>

      <!-- Right Column: Smart Assignment Workspace -->
      <div id="smart-assignment-workspace">
        <!-- Rendered via JS based on selectedOrderIdForAssignment -->
      </div>
    </div>
  `;

  setupAssignmentEvents(container);
  populateWeightsForm();
  renderSelectedOrderRecommendations();
}

function populateWeightsForm() {
  const cfg = getAssignmentConfig();
  const distEl = document.getElementById('weight-dist');
  const availEl = document.getElementById('weight-avail');
  const loadEl = document.getElementById('weight-load');
  const prioEl = document.getElementById('weight-prio');

  if (distEl) distEl.value = cfg.distanceWeight;
  if (availEl) availEl.value = cfg.availabilityWeight;
  if (loadEl) loadEl.value = cfg.workloadWeight;
  if (prioEl) prioEl.value = cfg.priorityWeight;
}

function renderSelectedOrderRecommendations() {
  const workspace = document.getElementById('smart-assignment-workspace');
  if (!workspace) return;

  if (!selectedOrderIdForAssignment) {
    workspace.innerHTML = `
      <div class="card">
        <div class="empty-state">
          <span class="empty-state__icon">⚡</span>
          <div class="empty-state__title">Select an order from the queue</div>
          <div class="empty-state__text">Choose an unassigned order on the left to run the Smart Assignment evaluation.</div>
        </div>
      </div>
    `;
    return;
  }

  let recommendations;
  try {
    recommendations = getAgentRecommendationsForOrder(selectedOrderIdForAssignment);
  } catch (err) {
    workspace.innerHTML = `
      <div class="card">
        <div class="empty-state">
          <span class="empty-state__icon">⚠</span>
          <div class="empty-state__title">Evaluation Error</div>
          <div class="empty-state__text">${err.message}</div>
        </div>
      </div>
    `;
    return;
  }

  const { order, eligible, ineligible, recommendedAgent } = recommendations;

  workspace.innerHTML = `
    <!-- Top Recommendation Hero -->
    ${
      recommendedAgent
        ? `
      <div class="recommendation-hero">
        <div class="recommendation-hero__badge">⚡ Best Match Recommendation</div>
        <div class="recommendation-hero__content">
          <div>
            <div class="recommendation-hero__agent-name">
              ${escapeHtml(recommendedAgent.agentName)} (${recommendedAgent.agentId})
            </div>
            <div class="recommendation-hero__details">
              📍 ${escapeHtml(recommendedAgent.agent.location)} • <strong>${recommendedAgent.distanceKm} km</strong> from customer<br />
              📦 ${recommendedAgent.agent.activeOrders}/${recommendedAgent.agent.maxCapacity} active orders (${recommendedAgent.agent.availability.toLowerCase()})<br />
              💡 <em>${recommendedAgent.reason}</em>
            </div>
            <div style="margin-top: 16px;">
              <button type="button" class="btn btn--success" id="btn-auto-assign" data-order-id="${order.id}">
                ⚡ Assign Recommended Agent
              </button>
            </div>
          </div>

          <div class="recommendation-hero__score-badge">
            <div class="recommendation-hero__score-num">${recommendedAgent.score}%</div>
            <div class="recommendation-hero__score-label">Match Score</div>
          </div>
        </div>
      </div>
    `
        : `
      <div class="card" style="border-left: 4px solid var(--color-warning);">
        <h3 style="font-size: 15px; margin-bottom: 6px;">No Eligible Agents Available</h3>
        <p style="font-size: 13px; color: var(--color-text-muted);">
          All registered agents are currently either OFFLINE or operating at maximum capacity.
        </p>
      </div>
    `
    }

    <!-- Ranked Eligible Agents List -->
    <div class="card">
      <div class="card__header">
        <div>
          <h2 class="card__title">Agent Candidate Rankings</h2>
          <span class="card__subtitle">Evaluated based on distance, availability, workload & priority</span>
        </div>
        <span class="badge badge--normal">${eligible.length} eligible</span>
      </div>

      <div class="candidates-list">
        ${
          eligible.length === 0
            ? '<p class="empty-state">No eligible candidates meet the criteria.</p>'
            : eligible
                .map((cand, idx) => {
                  const isTop = idx === 0;
                  return `
              <div class="candidate-card ${isTop ? 'candidate-card--top' : ''}">
                <div class="candidate-card__header">
                  <div class="candidate-card__info">
                    <div class="candidate-rank-badge">#${idx + 1}</div>
                    <div>
                      <div class="candidate-name">${escapeHtml(cand.agentName)} (${cand.agentId})</div>
                      <div class="candidate-subtext">
                        📍 ${escapeHtml(cand.agent.location)} • <strong>${cand.distanceKm} km away</strong> • 
                        ${cand.agent.activeOrders}/${cand.agent.maxCapacity} active dispatches
                      </div>
                    </div>
                  </div>
                  <div class="candidate-score-pill">${cand.score}%</div>
                </div>

                <!-- 4-Factor Breakdown Metrics -->
                <div class="score-breakdown-grid">
                  <div class="score-metric-col">
                    <span class="score-metric-col__label">Distance (40%)</span>
                    <span class="score-metric-col__val">${cand.distanceScore}/100</span>
                  </div>
                  <div class="score-metric-col">
                    <span class="score-metric-col__label">Availability (30%)</span>
                    <span class="score-metric-col__val">${cand.availabilityScore}/100</span>
                  </div>
                  <div class="score-metric-col">
                    <span class="score-metric-col__label">Workload (20%)</span>
                    <span class="score-metric-col__val">${cand.workloadScore}/100</span>
                  </div>
                  <div class="score-metric-col">
                    <span class="score-metric-col__label">Priority (10%)</span>
                    <span class="score-metric-col__val">${cand.priorityScore}/100</span>
                  </div>
                </div>

                <div class="candidate-explanation">
                  <strong>Why this score:</strong> ${cand.reason}
                </div>

                <div class="candidate-card__actions">
                  <button type="button" class="btn btn--primary btn--sm btn-manual-assign" data-order-id="${order.id}" data-agent-id="${cand.agentId}">
                    Manual Assign to ${escapeHtml(cand.agentName)}
                  </button>
                </div>
              </div>
            `;
                })
                .join('')
        }
      </div>

      <!-- Ineligible Agents Section -->
      ${
        ineligible.length > 0
          ? `
        <div class="ineligible-section">
          <h3 style="font-size: 13px; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; margin-bottom: 10px;">
            Ineligible Agents (${ineligible.length})
          </h3>
          ${ineligible
            .map(
              (item) => `
            <div class="ineligible-card">
              <div>
                <strong>${escapeHtml(item.agentName)}</strong> (${item.agentId}) - 
                <span class="badge badge--${item.agent.availability.toLowerCase()}" style="font-size: 10px;">
                  ${AGENT_AVAILABILITY_LABELS[item.agent.availability] || item.agent.availability}
                </span>
              </div>
              <div class="ineligible-reason">✕ ${item.reason}</div>
            </div>
          `
            )
            .join('')}
        </div>
      `
          : ''
      }
    </div>
  `;

  // Attach assignment click events
  const autoAssignBtn = document.getElementById('btn-auto-assign');
  if (autoAssignBtn) {
    autoAssignBtn.addEventListener('click', () => {
      try {
        const res = autoAssignOrder(order.id);
        showToast(
          `Order ${order.id} automatically assigned to ${res.agent.name}!`,
          'success'
        );
        renderAssignmentPage();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  workspace.querySelectorAll('.btn-manual-assign').forEach((btn) => {
    btn.addEventListener('click', () => {
      const orderId = btn.dataset.orderId;
      const agentId = btn.dataset.agentId;
      try {
        const res = assignOrderToAgent(orderId, agentId);
        showToast(`Order ${orderId} assigned to ${res.agent.name}!`, 'success');
        renderAssignmentPage();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

function setupAssignmentEvents(container) {
  // Order selection list
  container.querySelectorAll('.assign-order-item').forEach((item) => {
    item.addEventListener('click', () => {
      selectedOrderIdForAssignment = item.dataset.orderId;
      container.querySelectorAll('.assign-order-item').forEach((i) => i.classList.remove('selected'));
      item.classList.add('selected');
      renderSelectedOrderRecommendations();
    });
  });

  // Weights configuration form
  const weightsForm = document.getElementById('weights-config-form');
  if (weightsForm) {
    weightsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const dist = parseFloat(document.getElementById('weight-dist').value);
      const avail = parseFloat(document.getElementById('weight-avail').value);
      const load = parseFloat(document.getElementById('weight-load').value);
      const prio = parseFloat(document.getElementById('weight-prio').value);

      const sum = dist + avail + load + prio;
      if (Math.abs(sum - 1.0) > 0.05) {
        showToast(`Weights must sum to 1.0 (currently ${(sum * 100).toFixed(0)}%).`, 'warning');
      }

      updateAssignmentConfig({
        distanceWeight: dist,
        availabilityWeight: avail,
        workloadWeight: load,
        priorityWeight: prio,
      });

      showToast('Assignment weights updated! Re-evaluating scores...', 'success');
      renderSelectedOrderRecommendations();
    });
  }

  // Reset weights button
  const resetBtn = document.getElementById('btn-reset-weights');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetAssignmentConfig();
      populateWeightsForm();
      showToast('Weights reset to default values.', 'info');
      renderSelectedOrderRecommendations();
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
