import { initializeOrderStore, resetOrderStore, getOrders } from './services/orderService.js';
import { initializeAgentStore, resetAgentStore } from './services/agentService.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderOrdersPage } from './pages/orders.js';
import { renderAgentsPage } from './pages/agents.js';
import { renderAssignmentPage } from './pages/assignment.js';
import { showToast } from './utils/notifications.js';
import { ORDER_STATUS } from './utils/constants.js';

const ROUTES = {
  dashboard: {
    title: 'Operations Dashboard',
    subtitle: 'Real-time overview of fleet and deliveries',
    render: renderDashboard,
  },
  orders: {
    title: 'Orders Management',
    subtitle: 'Dispatch, track, and inspect delivery orders',
    render: renderOrdersPage,
  },
  agents: {
    title: 'Fleet & Agent Management',
    subtitle: 'Register couriers, monitor workload and status',
    render: renderAgentsPage,
  },
  assignment: {
    title: 'Smart Order Assignment',
    subtitle: 'Deterministic proximity, availability, and priority scoring',
    render: renderAssignmentPage,
  },
};

let currentRoute = 'dashboard';

function updateNavBadges() {
  const pendingBadge = document.getElementById('nav-pending-badge');
  if (pendingBadge) {
    const orders = getOrders();
    const pendingCount = orders.filter((o) => o.status === ORDER_STATUS.PENDING).length;
    pendingBadge.textContent = pendingCount;
    pendingBadge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
  }
}

function navigateTo(routeKey) {
  const targetRoute = ROUTES[routeKey] ? routeKey : 'dashboard';
  currentRoute = targetRoute;

  // Update URL hash without extra history spam
  if (window.location.hash !== `#${targetRoute}`) {
    window.location.hash = `#${targetRoute}`;
  }

  // Update Navigation active state
  document.querySelectorAll('.nav-link').forEach((link) => {
    const route = link.dataset.route;
    if (route === targetRoute) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Update Page View visibility
  document.querySelectorAll('.page-view').forEach((page) => {
    if (page.id === `${targetRoute}-view`) {
      page.classList.add('active');
    } else {
      page.classList.remove('active');
    }
  });

  // Update Top Bar titles
  const titleEl = document.getElementById('top-bar-title');
  const subtitleEl = document.getElementById('top-bar-subtitle');
  if (titleEl) titleEl.textContent = ROUTES[targetRoute].title;
  if (subtitleEl) subtitleEl.textContent = ROUTES[targetRoute].subtitle;

  // Render Target Page
  ROUTES[targetRoute].render();
  updateNavBadges();
}

async function initializeApp() {
  try {
    await Promise.all([initializeOrderStore(), initializeAgentStore()]);
  } catch (err) {
    console.warn('Store init warning:', err);
  }

  // Attach nav menu click listeners
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const route = link.dataset.route;
      navigateTo(route);
    });
  });

  // Hash change routing
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (ROUTES[hash] && hash !== currentRoute) {
      navigateTo(hash);
    }
  });

  // Reset Demo Data Button
  const resetBtn = document.getElementById('btn-reset-demo');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Reset orders and agents to initial sample data?')) {
        resetOrderStore();
        resetAgentStore();
        showToast('Sample data reset successfully!', 'info');
        navigateTo(currentRoute);
      }
    });
  }

  // Initial Route resolution
  const initialHash = window.location.hash.replace('#', '');
  const startRoute = ROUTES[initialHash] ? initialHash : 'dashboard';
  navigateTo(startRoute);
}

document.addEventListener('DOMContentLoaded', initializeApp);
