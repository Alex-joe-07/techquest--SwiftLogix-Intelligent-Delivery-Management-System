import { getOrders } from '../services/orderService.js';
import { getAgents } from '../services/agentService.js';
import {
  ORDER_STATUS,
  AGENT_AVAILABILITY,
  PRIORITY,
} from '../utils/constants.js';

export function renderDashboard() {
  const container = document.getElementById('dashboard-view');
  if (!container) return;

  const orders = getOrders();
  const agents = getAgents();

  // Calculate Order statistics
  const totalOrders = orders.length;
  const pendingOrders = orders.filter((o) => o.status === ORDER_STATUS.PENDING);
  const assignedOrders = orders.filter((o) => o.status === ORDER_STATUS.ASSIGNED);
  const pickedUpOrders = orders.filter((o) => o.status === ORDER_STATUS.PICKED_UP);
  const inTransitOrders = orders.filter((o) => o.status === ORDER_STATUS.IN_TRANSIT);
  const deliveredOrders = orders.filter((o) => o.status === ORDER_STATUS.DELIVERED);
  const cancelledOrders = orders.filter((o) => o.status === ORDER_STATUS.CANCELLED);

  // Urgent/High unassigned orders
  const urgentUnassigned = pendingOrders.filter(
    (o) => o.priority === PRIORITY.URGENT || o.priority === PRIORITY.HIGH
  );

  // Calculate Agent statistics
  const totalAgents = agents.length;
  const availableAgents = agents.filter((a) => a.availability === AGENT_AVAILABILITY.AVAILABLE);
  const busyAgents = agents.filter((a) => a.availability === AGENT_AVAILABILITY.BUSY);
  const offlineAgents = agents.filter((a) => a.availability === AGENT_AVAILABILITY.OFFLINE);

  // Total fleet capacity & load
  const totalCapacity = agents.reduce((sum, a) => sum + (a.maxCapacity || 3), 0);
  const activeFleetOrders = agents.reduce((sum, a) => sum + (a.activeOrders || 0), 0);
  const fleetUtilizationPct = totalCapacity > 0 ? Math.round((activeFleetOrders / totalCapacity) * 100) : 0;

  // Percentage calculations
  const pendingPct = totalOrders > 0 ? Math.round((pendingOrders.length / totalOrders) * 100) : 0;
  const inTransitPct = totalOrders > 0 ? Math.round((inTransitOrders.length / totalOrders) * 100) : 0;
  const deliveredPct = totalOrders > 0 ? Math.round((deliveredOrders.length / totalOrders) * 100) : 0;

  // Recent 5 orders
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  container.innerHTML = `
    ${
      urgentUnassigned.length > 0
        ? `
      <div class="alert-banner">
        <div class="alert-banner__content">
          <span class="alert-banner__icon">⚠</span>
          <span class="alert-banner__text">
            <strong>${urgentUnassigned.length} High/Urgent order${urgentUnassigned.length > 1 ? 's' : ''}</strong>
            currently waiting for delivery assignment!
          </span>
        </div>
        <button class="btn btn--warning btn--sm" id="btn-quick-assign">
          ⚡ Smart Assign Now
        </button>
      </div>
    `
        : ''
    }

    <!-- Top KPI Stat Cards -->
    <div class="dashboard-stats-grid">
      <div class="stat-card stat-card--primary">
        <div class="stat-card__header">
          <span class="stat-card__label">Total Orders</span>
          <span class="stat-card__icon">📦</span>
        </div>
        <div class="stat-card__value">${totalOrders}</div>
        <div class="stat-card__subtext">Across all locations</div>
      </div>

      <div class="stat-card stat-card--warning">
        <div class="stat-card__header">
          <span class="stat-card__label">Pending Orders</span>
          <span class="stat-card__icon">⏳</span>
        </div>
        <div class="stat-card__value">${pendingOrders.length}</div>
        <div class="stat-card__subtext">Awaiting agent dispatch</div>
      </div>

      <div class="stat-card">
        <div class="stat-card__header">
          <span class="stat-card__label">In Transit</span>
          <span class="stat-card__icon">🚚</span>
        </div>
        <div class="stat-card__value">${inTransitOrders.length}</div>
        <div class="stat-card__subtext">Currently out for delivery</div>
      </div>

      <div class="stat-card stat-card--success">
        <div class="stat-card__header">
          <span class="stat-card__label">Delivered</span>
          <span class="stat-card__icon">✓</span>
        </div>
        <div class="stat-card__value">${deliveredOrders.length}</div>
        <div class="stat-card__subtext">Successfully fulfilled</div>
      </div>

      <div class="stat-card stat-card--success">
        <div class="stat-card__header">
          <span class="stat-card__label">Available Agents</span>
          <span class="stat-card__icon">👤</span>
        </div>
        <div class="stat-card__value">${availableAgents.length} / ${totalAgents}</div>
        <div class="stat-card__subtext">Ready for new dispatches</div>
      </div>
    </div>

    <!-- Main Dashboard Split Columns -->
    <div class="dashboard-columns">
      <!-- Left Column: Operations Overview & Recent Orders -->
      <div>
        <div class="card">
          <div class="card__header">
            <h2 class="card__title">Order Status Pipeline</h2>
            <span class="card__subtitle">${totalOrders} total orders processed</span>
          </div>

          <div class="metric-row">
            <div class="metric-row__header">
              <span>Pending</span>
              <span>${pendingOrders.length} (${pendingPct}%)</span>
            </div>
            <div class="progress-bar">
              <div class="progress-bar__fill progress-bar__fill--warning" style="width: ${pendingPct}%"></div>
            </div>
          </div>

          <div class="metric-row">
            <div class="metric-row__header">
              <span>Assigned & Picked Up</span>
              <span>${assignedOrders.length + pickedUpOrders.length}</span>
            </div>
            <div class="progress-bar">
              <div class="progress-bar__fill progress-bar__fill--primary" style="width: ${
                totalOrders > 0 ? Math.round(((assignedOrders.length + pickedUpOrders.length) / totalOrders) * 100) : 0
              }%"></div>
            </div>
          </div>

          <div class="metric-row">
            <div class="metric-row__header">
              <span>In Transit</span>
              <span>${inTransitOrders.length} (${inTransitPct}%)</span>
            </div>
            <div class="progress-bar">
              <div class="progress-bar__fill progress-bar__fill--purple" style="width: ${inTransitPct}%"></div>
            </div>
          </div>

          <div class="metric-row">
            <div class="metric-row__header">
              <span>Delivered</span>
              <span>${deliveredOrders.length} (${deliveredPct}%)</span>
            </div>
            <div class="progress-bar">
              <div class="progress-bar__fill progress-bar__fill--success" style="width: ${deliveredPct}%"></div>
            </div>
          </div>
        </div>

        <!-- Recent Orders Table -->
        <div class="card">
          <div class="card__header">
            <h2 class="card__title">Recent Activity</h2>
            <button class="btn btn--secondary btn--sm" id="btn-view-all-orders">View All Orders</button>
          </div>

          ${
            recentOrders.length === 0
              ? '<p class="empty-state">No orders yet.</p>'
              : `
            <table class="recent-orders-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Location</th>
                  <th>Priority</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${recentOrders
                  .map(
                    (order) => `
                  <tr>
                    <td><strong>${order.id}</strong></td>
                    <td>${order.customerName}</td>
                    <td>${order.location}</td>
                    <td><span class="badge badge--${order.priority.toLowerCase()}">${order.priority}</span></td>
                    <td><span class="badge badge--${order.status.toLowerCase()}">${order.status}</span></td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          `
          }
        </div>
      </div>

      <!-- Right Column: Fleet Status & Fleet Capacity -->
      <div>
        <div class="card">
          <div class="card__header">
            <h2 class="card__title">Fleet Utilization</h2>
            <span class="badge ${fleetUtilizationPct > 80 ? 'badge--urgent' : 'badge--normal'}">
              ${fleetUtilizationPct}% Loaded
            </span>
          </div>

          <div style="margin-bottom: 20px;">
            <div class="metric-row__header">
              <span>Active Orders Load</span>
              <span>${activeFleetOrders} / ${totalCapacity} Max Capacity</span>
            </div>
            <div class="progress-bar">
              <div class="progress-bar__fill progress-bar__fill--primary" style="width: ${fleetUtilizationPct}%"></div>
            </div>
          </div>

          <div class="metric-row">
            <div class="metric-row__header">
              <span>🟢 Available Agents</span>
              <span>${availableAgents.length}</span>
            </div>
          </div>

          <div class="metric-row">
            <div class="metric-row__header">
              <span>🟡 Busy Agents</span>
              <span>${busyAgents.length}</span>
            </div>
          </div>

          <div class="metric-row">
            <div class="metric-row__header">
              <span>⚪ Offline Agents</span>
              <span>${offlineAgents.length}</span>
            </div>
          </div>

          <div style="margin-top: 20px; padding-top: 14px; border-top: 1px solid var(--color-border);">
            <button class="btn btn--secondary btn--sm" style="width: 100%;" id="btn-manage-agents">
              Manage Delivery Agents →
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach event handlers
  const quickAssignBtn = document.getElementById('btn-quick-assign');
  if (quickAssignBtn) {
    quickAssignBtn.addEventListener('click', () => {
      window.location.hash = '#assignment';
    });
  }

  const viewAllOrdersBtn = document.getElementById('btn-view-all-orders');
  if (viewAllOrdersBtn) {
    viewAllOrdersBtn.addEventListener('click', () => {
      window.location.hash = '#orders';
    });
  }

  const manageAgentsBtn = document.getElementById('btn-manage-agents');
  if (manageAgentsBtn) {
    manageAgentsBtn.addEventListener('click', () => {
      window.location.hash = '#agents';
    });
  }
}
