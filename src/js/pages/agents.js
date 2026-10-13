import {
  getAgents,
  createAgentRecord,
  updateAgentAvailability,
} from '../services/agentService.js';
import { getOrders } from '../services/orderService.js';
import {
  AGENT_AVAILABILITY,
  AGENT_AVAILABILITY_LABELS,
  DEFAULT_MAX_CAPACITY,
  ORDER_STATUS_LABELS,
} from '../utils/constants.js';
import { showToast } from '../utils/notifications.js';

let currentFilter = {
  availability: 'ALL',
  search: '',
};

// Agent hub presets for testing
const AGENT_LOCATION_PRESETS = [
  { name: 'Downtown Hub', lat: 37.7890, lon: -122.4020, address: 'Downtown Metro Hub' },
  { name: 'Mission Center', lat: 37.7550, lon: -122.4180, address: 'Mission District Center' },
  { name: 'SoMa Station', lat: 37.7810, lon: -122.4050, address: 'SoMa Station' },
  { name: 'Presidio Outpost', lat: 37.7980, lon: -122.4660, address: 'Presidio Outpost' },
];

export function renderAgentsPage() {
  const container = document.getElementById('agents-view');
  if (!container) return;

  container.innerHTML = `
    <!-- Top Filter & Search Toolbar -->
    <div class="filter-toolbar">
      <div class="filter-toolbar__search">
        <input
          type="text"
          id="agents-search-input"
          class="form-input"
          placeholder="Search agents by name, ID, phone, or location..."
          value="${escapeHtml(currentFilter.search)}"
        />
      </div>

      <div class="filter-toolbar__selects">
        <select id="agents-availability-filter" class="form-select">
          <option value="ALL" ${currentFilter.availability === 'ALL' ? 'selected' : ''}>All Availability</option>
          ${Object.entries(AGENT_AVAILABILITY_LABELS)
            .map(([val, label]) => `<option value="${val}" ${currentFilter.availability === val ? 'selected' : ''}>${label}</option>`)
            .join('')}
        </select>
      </div>
    </div>

    <!-- 2-Column Split: Registration Form (Left) / Agents Fleet Cards Grid (Right) -->
    <div class="agents-layout">
      <!-- Left: Agent Registration Form -->
      <div>
        <div class="card">
          <div class="card__header">
            <h2 class="card__title">Register Delivery Agent</h2>
            <span class="card__subtitle">Add a courier to the active fleet</span>
          </div>

          <form id="create-agent-form">
            <div class="form-group">
              <label class="form-label" for="agent-name">Agent Full Name *</label>
              <input type="text" id="agent-name" name="name" class="form-input" placeholder="e.g. Maya Lin" required />
            </div>

            <div class="form-group">
              <label class="form-label" for="agent-phone">Phone Number *</label>
              <input type="text" id="agent-phone" name="phone" class="form-input" placeholder="e.g. 555-0312" required />
            </div>

            <div class="form-group">
              <label class="form-label" for="agent-location">Base Station / Location *</label>
              <input type="text" id="agent-location" name="location" class="form-input" placeholder="e.g. Central Hub" required />
              <div class="form-hint">Quick Hub Presets:</div>
              <div class="form-helper-chips">
                ${AGENT_LOCATION_PRESETS.map(
                  (p, i) => `
                  <button type="button" class="helper-chip agent-preset-chip" data-idx="${i}">
                    ${p.name}
                  </button>
                `
                ).join('')}
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="agent-lat">Latitude *</label>
                <input type="number" step="any" id="agent-lat" name="latitude" class="form-input" placeholder="37.7890" required />
              </div>
              <div class="form-group">
                <label class="form-label" for="agent-lon">Longitude *</label>
                <input type="number" step="any" id="agent-lon" name="longitude" class="form-input" placeholder="-122.4020" required />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="agent-avail">Initial Status *</label>
                <select id="agent-avail" name="availability" class="form-select">
                  <option value="${AGENT_AVAILABILITY.AVAILABLE}">Available</option>
                  <option value="${AGENT_AVAILABILITY.BUSY}">Busy</option>
                  <option value="${AGENT_AVAILABILITY.OFFLINE}">Offline</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" for="agent-capacity">Max Capacity *</label>
                <input
                  type="number"
                  id="agent-capacity"
                  name="maxCapacity"
                  class="form-input"
                  min="1"
                  max="10"
                  value="${DEFAULT_MAX_CAPACITY}"
                  required
                />
              </div>
            </div>

            <div style="margin-top: 8px;">
              <button type="submit" class="btn btn--primary" style="width: 100%;">
                + Register Agent
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Right: Agents Grid & Active Orders Inspector -->
      <div>
        <div class="card">
          <div class="card__header">
            <h2 class="card__title">Fleet Roster</h2>
            <span class="card__subtitle" id="agents-count-label"></span>
          </div>

          <div class="agents-grid" id="agents-grid">
            <!-- Rendered via JS -->
          </div>
        </div>
      </div>
    </div>
  `;

  setupAgentEvents(container);
  refreshAgentsGrid();
}

function refreshAgentsGrid() {
  const gridEl = document.getElementById('agents-grid');
  const countLabel = document.getElementById('agents-count-label');
  if (!gridEl) return;

  const agents = getAgents(currentFilter);
  const allOrders = getOrders();

  if (countLabel) {
    countLabel.textContent = `${agents.length} agent${agents.length !== 1 ? 's' : ''}`;
  }

  if (agents.length === 0) {
    gridEl.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <span class="empty-state__icon">👥</span>
        <div class="empty-state__title">No agents found</div>
        <div class="empty-state__text">Try changing your search or filter criteria.</div>
      </div>
    `;
    return;
  }

  gridEl.innerHTML = agents
    .map((agent) => {
      const activeCount = agent.activeOrders || 0;
      const maxCap = agent.maxCapacity || DEFAULT_MAX_CAPACITY;
      const loadPct = Math.min(100, Math.round((activeCount / maxCap) * 100));

      // Get assigned active orders for this agent
      const assignedOrders = allOrders.filter(
        (o) => o.assignedAgentId === agent.id && o.status !== 'DELIVERED' && o.status !== 'CANCELLED'
      );

      const initials = agent.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

      let progressColor = 'primary';
      if (loadPct >= 100) progressColor = 'danger';
      else if (loadPct >= 66) progressColor = 'warning';

      return `
        <div class="agent-card">
          <div class="agent-card__header">
            <div class="agent-card__avatar-group">
              <div class="agent-avatar">${initials}</div>
              <div>
                <div class="agent-name">${escapeHtml(agent.name)}</div>
                <div class="agent-id">${agent.id}</div>
              </div>
            </div>
            <span class="badge badge--${agent.availability.toLowerCase()}">
              ${AGENT_AVAILABILITY_LABELS[agent.availability] || agent.availability}
            </span>
          </div>

          <div class="agent-meta">
            <div class="agent-meta__item">📍 ${escapeHtml(agent.location)}</div>
            <div class="agent-meta__item">🌐 ${agent.latitude.toFixed(4)}, ${agent.longitude.toFixed(4)}</div>
            <div class="agent-meta__item">📞 <a href="tel:${escapeHtml(agent.phone)}">${escapeHtml(agent.phone)}</a></div>
          </div>

          <!-- Workload Bar -->
          <div class="agent-workload-box">
            <div class="agent-workload-box__header">
              <span>Workload</span>
              <span>${activeCount} / ${maxCap} Orders (${loadPct}%)</span>
            </div>
            <div class="progress-bar">
              <div class="progress-bar__fill progress-bar__fill--${progressColor}" style="width: ${loadPct}%;"></div>
            </div>
          </div>

          ${
            assignedOrders.length > 0
              ? `
            <div style="font-size: 11px; margin-bottom: 12px; color: var(--color-text-muted);">
              <strong>Active Dispatches (${assignedOrders.length}):</strong>
              <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;">
                ${assignedOrders
                  .map(
                    (o) => `
                  <span class="badge badge--${o.status.toLowerCase()}" style="font-size: 10px;">
                    ${o.id} (${ORDER_STATUS_LABELS[o.status] || o.status})
                  </span>
                `
                  )
                  .join('')}
              </div>
            </div>
          `
              : '<div style="font-size: 11px; color: var(--color-text-subtle); margin-bottom: 12px;">No active orders</div>'
          }

          <!-- Card Footer: Quick Availability Switcher -->
          <div class="agent-card__footer">
            <label style="font-size: 11px; font-weight: 600; color: var(--color-text-muted);">
              Status:
            </label>
            <select class="status-select-sm agent-status-select" data-agent-id="${agent.id}">
              <option value="${AGENT_AVAILABILITY.AVAILABLE}" ${agent.availability === AGENT_AVAILABILITY.AVAILABLE ? 'selected' : ''}>Available</option>
              <option value="${AGENT_AVAILABILITY.BUSY}" ${agent.availability === AGENT_AVAILABILITY.BUSY ? 'selected' : ''}>Busy</option>
              <option value="${AGENT_AVAILABILITY.OFFLINE}" ${agent.availability === AGENT_AVAILABILITY.OFFLINE ? 'selected' : ''}>Offline</option>
            </select>
          </div>
        </div>
      `;
    })
    .join('');

  // Attach status change listeners
  gridEl.querySelectorAll('.agent-status-select').forEach((sel) => {
    sel.addEventListener('change', (e) => {
      const agentId = sel.dataset.agentId;
      const newAvail = e.target.value;

      try {
        updateAgentAvailability(agentId, newAvail);
        showToast(`Agent ${agentId} availability updated to ${AGENT_AVAILABILITY_LABELS[newAvail]}.`, 'info');
        refreshAgentsGrid();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

function setupAgentEvents(container) {
  // Preset chips
  container.querySelectorAll('.agent-preset-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const idx = Number(chip.dataset.idx);
      const preset = AGENT_LOCATION_PRESETS[idx];
      if (preset) {
        document.getElementById('agent-location').value = preset.address;
        document.getElementById('agent-lat').value = preset.lat;
        document.getElementById('agent-lon').value = preset.lon;
      }
    });
  });

  // Search input
  const searchInput = document.getElementById('agents-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentFilter.search = e.target.value.trim();
      refreshAgentsGrid();
    });
  }

  // Availability filter
  const availFilter = document.getElementById('agents-availability-filter');
  if (availFilter) {
    availFilter.addEventListener('change', (e) => {
      currentFilter.availability = e.target.value;
      refreshAgentsGrid();
    });
  }

  // Registration form
  const form = document.getElementById('create-agent-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(form);

      try {
        const newAgent = createAgentRecord({
          name: formData.get('name'),
          phone: formData.get('phone'),
          location: formData.get('location'),
          latitude: formData.get('latitude'),
          longitude: formData.get('longitude'),
          availability: formData.get('availability'),
          maxCapacity: Number(formData.get('maxCapacity')),
        });

        form.reset();
        document.getElementById('agent-capacity').value = DEFAULT_MAX_CAPACITY;
        showToast(`Agent ${newAgent.name} (${newAgent.id}) registered successfully!`, 'success');
        refreshAgentsGrid();
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
