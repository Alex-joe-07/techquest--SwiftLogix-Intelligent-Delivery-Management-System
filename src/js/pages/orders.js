import {
  getOrders,
  getOrderById,
  createOrderRecord,
  updateOrderStatus,
  getPriorityOptions,
} from '../services/orderService.js';
import { getAgentById } from '../services/agentService.js';
import { ORDER_STATUS, ORDER_STATUS_LABELS } from '../utils/constants.js';
import { showToast } from '../utils/notifications.js';

let selectedOrderId = null;
let currentFilters = {
  status: 'ALL',
  priority: 'ALL',
  search: '',
};

// Preset locations to make testing fast and enjoyable
const LOCATION_PRESETS = [
  { name: 'Downtown (Market St)', lat: 37.7900, lon: -122.4010, address: '550 Market St, Downtown' },
  { name: 'SoMa (Mission St)', lat: 37.7865, lon: -122.4035, address: '742 Mission St, SoMa' },
  { name: 'Mission (Valencia)', lat: 37.7525, lon: -122.4208, address: '1200 Valencia St, Mission' },
  { name: 'Union Square (Post St)', lat: 37.7885, lon: -122.4075, address: '333 Post St, Union Square' },
  { name: 'Nob Hill (California St)', lat: 37.7915, lon: -122.4190, address: '1600 California St, Nob Hill' },
];

export function renderOrdersPage() {
  const container = document.getElementById('orders-view');
  if (!container) return;

  const orders = getOrders();
  if (!selectedOrderId && orders.length > 0) {
    selectedOrderId = orders[0].id;
  }

  container.innerHTML = `
    <!-- Top Filter & Search Toolbar -->
    <div class="filter-toolbar">
      <div class="filter-toolbar__search">
        <input
          type="text"
          id="orders-search-input"
          class="form-input"
          placeholder="Search by ID, customer, phone, location..."
          value="${escapeHtml(currentFilters.search)}"
        />
      </div>

      <div class="filter-toolbar__selects">
        <select id="orders-status-filter" class="form-select">
          <option value="ALL" ${currentFilters.status === 'ALL' ? 'selected' : ''}>All Statuses</option>
          ${Object.entries(ORDER_STATUS_LABELS)
            .map(([val, label]) => `<option value="${val}" ${currentFilters.status === val ? 'selected' : ''}>${label}</option>`)
            .join('')}
        </select>

        <select id="orders-priority-filter" class="form-select">
          <option value="ALL" ${currentFilters.priority === 'ALL' ? 'selected' : ''}>All Priorities</option>
          ${getPriorityOptions()
            .map((p) => `<option value="${p}" ${currentFilters.priority === p ? 'selected' : ''}>${p}</option>`)
            .join('')}
        </select>
      </div>
    </div>

    <!-- Main 2-Column Split: Form + Orders List (Left) / Order Details (Right) -->
    <div class="orders-layout">
      <!-- Left Column: New Order Form & Orders List -->
      <div>
        <!-- Create Order Card -->
        <div class="card">
          <div class="card__header">
            <h2 class="card__title">Create New Order</h2>
            <span class="card__subtitle">Dispatch a new customer package</span>
          </div>

          <form id="create-order-form">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="order-cust-name">Customer Name *</label>
                <input type="text" id="order-cust-name" name="customerName" class="form-input" placeholder="e.g. Rachel Adams" required />
              </div>
              <div class="form-group">
                <label class="form-label" for="order-cust-phone">Phone Number *</label>
                <input type="text" id="order-cust-phone" name="customerPhone" class="form-input" placeholder="e.g. 555-0199" required />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="order-location">Delivery Address *</label>
              <input type="text" id="order-location" name="location" class="form-input" placeholder="e.g. 100 Main St, Suite 400" required />
              <div class="form-hint">Quick Presets:</div>
              <div class="form-helper-chips">
                ${LOCATION_PRESETS.map(
                  (p, i) => `
                  <button type="button" class="helper-chip order-preset-chip" data-idx="${i}">
                    ${p.name}
                  </button>
                `
                ).join('')}
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="order-latitude">Latitude (-90 to 90) *</label>
                <input type="number" step="any" id="order-latitude" name="latitude" class="form-input" placeholder="37.7749" required />
              </div>
              <div class="form-group">
                <label class="form-label" for="order-longitude">Longitude (-180 to 180) *</label>
                <input type="number" step="any" id="order-longitude" name="longitude" class="form-input" placeholder="-122.4194" required />
              </div>
              <div class="form-group">
                <label class="form-label" for="order-priority">Priority *</label>
                <select id="order-priority" name="priority" class="form-select" required>
                  <option value="NORMAL">NORMAL</option>
                  <option value="LOW">LOW</option>
                  <option value="HIGH">HIGH</option>
                  <option value="URGENT">URGENT</option>
                </select>
              </div>
            </div>

            <div style="margin-top: 8px;">
              <button type="submit" class="btn btn--primary" style="width: 100%;">
                + Create Order
              </button>
            </div>
          </form>
        </div>

        <!-- Filtered Orders List -->
        <div class="card">
          <div class="card__header">
            <h2 class="card__title">Orders List</h2>
            <span class="card__subtitle" id="orders-count-label"></span>
          </div>

          <div class="order-list-container">
            <ul class="order-items-list" id="order-items-list">
              <!-- Rendered via JS -->
            </ul>
          </div>
        </div>
      </div>

      <!-- Right Column: Selected Order Details & Delivery Lifecycle Inspector -->
      <div>
        <div class="card order-detail-panel" id="order-detail-panel">
          <!-- Rendered via JS -->
        </div>
      </div>
    </div>
  `;

  setupOrderEvents(container);
  refreshOrdersList();
  renderSelectedOrderDetail();
}

function refreshOrdersList() {
  const listEl = document.getElementById('order-items-list');
  const countLabel = document.getElementById('orders-count-label');
  if (!listEl) return;

  const filtered = getOrders(currentFilters);

  if (countLabel) {
    countLabel.textContent = `${filtered.length} order${filtered.length !== 1 ? 's' : ''}`;
  }

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <li class="empty-state">
        <span class="empty-state__icon">🔍</span>
        <div class="empty-state__title">No matching orders</div>
        <div class="empty-state__text">Try adjusting your search query or filters.</div>
      </li>
    `;
    return;
  }

  listEl.innerHTML = filtered
    .map(
      (order) => `
      <li class="order-card-item ${order.id === selectedOrderId ? 'selected' : ''}" data-id="${order.id}">
        <div class="order-card-item__header">
          <span class="order-id">${order.id}</span>
          <span class="badge badge--${order.priority.toLowerCase()}">${order.priority}</span>
        </div>
        <div class="order-customer">${escapeHtml(order.customerName)}</div>
        <div class="order-location">📍 ${escapeHtml(order.location)}</div>
        <div class="order-card-item__footer">
          <span class="badge badge--${order.status.toLowerCase()}">${ORDER_STATUS_LABELS[order.status] || order.status}</span>
          <span>${order.assignedAgentId ? `Agent: ${order.assignedAgentId}` : 'Unassigned'}</span>
        </div>
      </li>
    `
    )
    .join('');

  listEl.querySelectorAll('.order-card-item').forEach((item) => {
    item.addEventListener('click', () => {
      selectedOrderId = item.dataset.id;
      listEl.querySelectorAll('.order-card-item').forEach((i) => i.classList.remove('selected'));
      item.classList.add('selected');
      renderSelectedOrderDetail();
    });
  });
}

function renderSelectedOrderDetail() {
  const panel = document.getElementById('order-detail-panel');
  if (!panel) return;

  const order = getOrderById(selectedOrderId);
  if (!order) {
    panel.innerHTML = `
      <div class="empty-state">
        <span class="empty-state__icon">📦</span>
        <div class="empty-state__title">No order selected</div>
        <div class="empty-state__text">Select an order from the list to view full details and lifecycle actions.</div>
      </div>
    `;
    return;
  }

  const assignedAgent = order.assignedAgentId ? getAgentById(order.assignedAgentId) : null;

  // Stepper calculations
  const steps = [
    { key: ORDER_STATUS.PENDING, label: 'Pending' },
    { key: ORDER_STATUS.ASSIGNED, label: 'Assigned' },
    { key: ORDER_STATUS.PICKED_UP, label: 'Picked Up' },
    { key: ORDER_STATUS.IN_TRANSIT, label: 'In Transit' },
    { key: ORDER_STATUS.DELIVERED, label: 'Delivered' },
  ];

  const currentIdx = steps.findIndex((s) => s.key === order.status);
  const isCancelled = order.status === ORDER_STATUS.CANCELLED;

  panel.innerHTML = `
    <div class="card__header">
      <div>
        <span class="order-id" style="font-size: 16px;">${order.id}</span>
        <div class="card__subtitle">Created ${new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
      <div style="display: flex; gap: 8px;">
        <span class="badge badge--${order.priority.toLowerCase()}">${order.priority}</span>
        <span class="badge badge--${order.status.toLowerCase()}">${ORDER_STATUS_LABELS[order.status] || order.status}</span>
      </div>
    </div>

    <!-- Lifecycle Stepper -->
    ${
      isCancelled
        ? `
      <div class="alert-banner" style="background: var(--color-danger-light); border-color: #FECACA; margin: 16px 0;">
        <div class="alert-banner__content">
          <span class="alert-banner__icon" style="color: var(--color-danger);">✕</span>
          <span class="alert-banner__text" style="color: var(--color-danger);">
            This order was <strong>CANCELLED</strong>. No further delivery actions are permitted.
          </span>
        </div>
      </div>
    `
        : `
      <div class="lifecycle-stepper">
        ${steps
          .map((step, idx) => {
            let stateClass = '';
            if (currentIdx > idx) stateClass = 'completed';
            else if (currentIdx === idx) stateClass = 'active';

            return `
              <div class="stepper-step ${stateClass}">
                <div class="stepper-node">${currentIdx > idx ? '✓' : idx + 1}</div>
                <div class="stepper-label">${step.label}</div>
              </div>
            `;
          })
          .join('')}
      </div>
    `
    }

    <!-- Order Meta Definition List -->
    <dl class="detail-dl">
      <dt>Customer</dt>
      <dd>${escapeHtml(order.customerName)}</dd>

      <dt>Phone</dt>
      <dd><a href="tel:${escapeHtml(order.customerPhone)}">${escapeHtml(order.customerPhone)}</a></dd>

      <dt>Address</dt>
      <dd>${escapeHtml(order.location)}</dd>

      <dt>Coordinates</dt>
      <dd>${order.latitude.toFixed(4)}, ${order.longitude.toFixed(4)}</dd>

      <dt>Assigned Agent</dt>
      <dd>
        ${
          assignedAgent
            ? `<strong>${escapeHtml(assignedAgent.name)}</strong> (${assignedAgent.id}) - 📞 ${escapeHtml(assignedAgent.phone)}`
            : `<span style="color: var(--color-warning);">Unassigned</span> — <a href="#assignment" style="color: var(--color-primary); font-weight: 600;">Assign Agent</a>`
        }
      </dd>
    </dl>

    <!-- Lifecycle Action Buttons -->
    <div class="lifecycle-actions">
      ${buildLifecycleButtons(order)}
    </div>
  `;

  // Attach lifecycle button listeners
  panel.querySelectorAll('[data-transition-to]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextStatus = btn.dataset.transitionTo;
      try {
        updateOrderStatus(order.id, nextStatus);
        showToast(`Order ${order.id} status updated to ${ORDER_STATUS_LABELS[nextStatus]}.`, 'success');
        refreshOrdersList();
        renderSelectedOrderDetail();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

function buildLifecycleButtons(order) {
  if (order.status === ORDER_STATUS.PENDING) {
    return `
      <a href="#assignment" class="btn btn--primary btn--sm">
        ⚡ Smart Assign Agent
      </a>
      <button type="button" class="btn btn--danger btn--sm" data-transition-to="${ORDER_STATUS.CANCELLED}">
        Cancel Order
      </button>
    `;
  }

  if (order.status === ORDER_STATUS.ASSIGNED) {
    return `
      <button type="button" class="btn btn--primary btn--sm" data-transition-to="${ORDER_STATUS.PICKED_UP}">
        📦 Mark Picked Up
      </button>
      <button type="button" class="btn btn--danger btn--sm" data-transition-to="${ORDER_STATUS.CANCELLED}">
        Cancel Order
      </button>
    `;
  }

  if (order.status === ORDER_STATUS.PICKED_UP) {
    return `
      <button type="button" class="btn btn--primary btn--sm" data-transition-to="${ORDER_STATUS.IN_TRANSIT}">
        🚚 Mark In Transit
      </button>
      <button type="button" class="btn btn--danger btn--sm" data-transition-to="${ORDER_STATUS.CANCELLED}">
        Cancel Order
      </button>
    `;
  }

  if (order.status === ORDER_STATUS.IN_TRANSIT) {
    return `
      <button type="button" class="btn btn--success btn--sm" data-transition-to="${ORDER_STATUS.DELIVERED}">
        ✓ Mark Delivered
      </button>
      <button type="button" class="btn btn--danger btn--sm" data-transition-to="${ORDER_STATUS.CANCELLED}">
        Cancel Order
      </button>
    `;
  }

  if (order.status === ORDER_STATUS.DELIVERED) {
    return `
      <div style="font-size: 13px; color: var(--color-success); font-weight: 600;">
        ✓ Order delivered successfully. Agent capacity released.
      </div>
    `;
  }

  return '';
}

function setupOrderEvents(container) {
  // Preset chips
  container.querySelectorAll('.order-preset-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const idx = Number(chip.dataset.idx);
      const preset = LOCATION_PRESETS[idx];
      if (preset) {
        document.getElementById('order-location').value = preset.address;
        document.getElementById('order-latitude').value = preset.lat;
        document.getElementById('order-longitude').value = preset.lon;
      }
    });
  });

  // Search input
  const searchInput = document.getElementById('orders-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentFilters.search = e.target.value.trim();
      refreshOrdersList();
    });
  }

  // Status filter
  const statusFilter = document.getElementById('orders-status-filter');
  if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
      currentFilters.status = e.target.value;
      refreshOrdersList();
    });
  }

  // Priority filter
  const priorityFilter = document.getElementById('orders-priority-filter');
  if (priorityFilter) {
    priorityFilter.addEventListener('change', (e) => {
      currentFilters.priority = e.target.value;
      refreshOrdersList();
    });
  }

  // Form submission
  const form = document.getElementById('create-order-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(form);

      try {
        const newOrder = createOrderRecord({
          customerName: formData.get('customerName'),
          customerPhone: formData.get('customerPhone'),
          location: formData.get('location'),
          latitude: formData.get('latitude'),
          longitude: formData.get('longitude'),
          priority: formData.get('priority'),
        });

        form.reset();
        selectedOrderId = newOrder.id;
        showToast(`Order ${newOrder.id} created successfully!`, 'success');
        refreshOrdersList();
        renderSelectedOrderDetail();
      } catch (err) {
        showToast(err.message, 'error');
      }
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
