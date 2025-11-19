const TOKEN_KEY = 'hv_service_token';
const ROLE_KEY = 'hv_service_role';
const USERNAME_KEY = 'hv_service_username';

const SERVICE_TEAM_ROLES = new Set(['housekeeping', 'maintenance']);
const ROLE_DEPARTMENT = {
  housekeeping: 'housekeeping',
  maintenance: 'engineering',
};
const harborviewFetch =
  typeof window.harborviewFetch === 'function' ? window.harborviewFetch : window.fetch.bind(window);

function normalizeRole(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().toLowerCase();
}

function applyServiceRoute(role, redirectTarget) {
  const normalized = normalizeRole(role);
  let targetHash = normalized ? `#${normalized}` : '';

  if (typeof redirectTarget === 'string' && redirectTarget.trim()) {
    try {
      const parsed = new URL(redirectTarget, window.location.origin);
      const nextHash = parsed.hash || targetHash;
      const nextUrl = `${parsed.pathname}${parsed.search}${nextHash}`;
      const currentUrl = `${window.location.pathname}${window.location.search || ''}${window.location.hash || ''}`;
      if (currentUrl !== nextUrl) {
        history.replaceState(null, '', nextUrl);
      }
      targetHash = nextHash || targetHash;
    } catch (error) {
      // Ignore malformed redirect targets; fall back to default behavior.
    }
  }

  if (targetHash) {
    try {
      const basePath = `${window.location.pathname}${window.location.search || ''}`;
      if (history.replaceState) {
        history.replaceState(null, '', `${basePath}${targetHash}`);
      } else {
        window.location.hash = targetHash;
      }
    } catch (error) {
      window.location.hash = targetHash;
    }
  }
}


function attemptUrlLogin() {
  if (!loginForm || getToken()) {
    removeAuthQueryParams();
    return;
  }

  const params = new URLSearchParams(window.location.search || '');
  const providedUsername = params.get('username');
  const providedPassword = params.get('password');
  if (!providedUsername || !providedPassword) {
    return;
  }

  const usernameInput = loginForm.querySelector('input[name="username"]');
  const passwordInput = loginForm.querySelector('input[name="password"]');
  if (!usernameInput || !passwordInput) {
    return;
  }

  usernameInput.value = providedUsername;
  passwordInput.value = providedPassword;

  removeAuthQueryParams(params);

  const submitEvent = new Event('submit', { cancelable: true });
  loginForm.dispatchEvent(submitEvent);
}

function removeAuthQueryParams(existingParams) {
  const params = existingParams
    ? new URLSearchParams(existingParams.toString())
    : new URLSearchParams(window.location.search || '');
  const hadAuthParams = params.has('username') || params.has('password');
  params.delete('username');
  params.delete('password');
  if (!hadAuthParams) {
    return;
  }
  const search = params.toString();
  const nextUrl = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash || ''}`;
  try {
    if (history.replaceState) {
      history.replaceState(null, '', nextUrl);
    } else {
      window.location.search = search;
    }
  } catch (error) {
    window.location.search = search;
  }
}

const loginCard = document.getElementById('service-login-card');
const loginForm = document.getElementById('service-login-form');
const loginFeedback = document.getElementById('service-login-feedback');

const dashboard = document.getElementById('service-dashboard');
const heading = document.getElementById('portal-heading');
const subtitle = document.getElementById('portal-subtitle');
const welcomeName = document.getElementById('portal-username');
const roleBadge = document.getElementById('portal-role');
const refreshBtn = document.getElementById('portal-refresh');
const logoutBtn = document.getElementById('portal-logout');

const ordersFeedback = document.getElementById('orders-feedback');
const ordersTableBody = document.getElementById('orders-table-body');

const tasksFeedback = document.getElementById('tasks-feedback');
const tasksTableBody = document.getElementById('tasks-table-body');

let currentRole = null;
let isRefreshing = false;

document.addEventListener('DOMContentLoaded', () => {
  loginForm?.addEventListener('submit', handleLogin);
  ordersTableBody?.addEventListener('click', handleOrderActionClick);
  refreshBtn?.addEventListener('click', () => refreshData(true));
  logoutBtn?.addEventListener('click', handleLogout);
  attemptAutoLogin();
  attemptUrlLogin();
});

function setFeedback(element, type, message) {
  if (!element) {
    return;
  }
  element.textContent = message || '';
  element.className = 'portal-feedback';
  if (type === 'error') {
    element.classList.add('portal-feedback--error');
  } else if (type === 'success') {
    element.classList.add('portal-feedback--success');
  } else if (type === 'info') {
    element.classList.add('portal-feedback--info');
  }
}

async function handleLogin(event) {
  event.preventDefault();

  if (isRefreshing) {
    return;
  }

  const formData = new FormData(loginForm);
  const username = formData.get('username')?.toString().trim();
  const password = formData.get('password')?.toString();

  if (!username || !password) {
    setFeedback(loginFeedback, 'error', 'Enter both username and password.');
    return;
  }

  try {
    loginForm.querySelector('button[type="submit"]').disabled = true;
    setFeedback(loginFeedback, 'info', 'Signing in...');

    const response = await harborviewFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Invalid credentials.');
    }

    const data = await response.json();
    const role = normalizeRole(data.role);
    const redirectTarget = typeof data.redirect === 'string' ? data.redirect : null;
    if (!SERVICE_TEAM_ROLES.has(role)) {
      throw new Error('This portal is only for housekeeping and maintenance teams.');
    }
    if (!data.token) {
      throw new Error('Unable to issue a session token. Please try again.');
    }

    setAuth(data.token, role, data.username || username);
    setFeedback(loginFeedback, '', '');
    applyServiceRoute(role, redirectTarget);
    showDashboard(role, data.username || username);
    await refreshData();
  } catch (error) {
    console.error('Service login failed', error);
    setFeedback(loginFeedback, 'error', error?.message || 'Unable to sign in. Please try again.');
    clearAuth();
    showLogin();
  } finally {
    loginForm.querySelector('button[type="submit"]').disabled = false;
  }
}

function showLogin() {
  dashboard?.classList.add('is-hidden');
  loginCard?.classList.remove('is-hidden');
  currentRole = null;
}

function showDashboard(role = getRole(), username = getUsername()) {
  const normalizedRole = normalizeRole(role);
  currentRole = normalizedRole;
  loginCard?.classList.add('is-hidden');
  dashboard?.classList.remove('is-hidden');

  if (heading) {
    heading.textContent = 'Service Dashboard';
  }
  if (subtitle) {
    subtitle.textContent =
      normalizedRole === 'maintenance'
        ? 'Handle engineering calls, coordinate repairs, and keep rooms service-ready.'
        : 'Review guest amenity requests, schedule turn-downs, and keep rooms spotless.';
  }
  if (welcomeName) {
    welcomeName.textContent = username || 'team member';
  }
  if (roleBadge) {
    roleBadge.textContent = capitalize(normalizedRole);
  }
}

async function refreshData(showMessage = false) {
  if (isRefreshing) {
    return;
  }
  const token = getToken();
  const role = normalizeRole(getRole());
  if (!token || !SERVICE_TEAM_ROLES.has(role)) {
    clearAuth();
    showLogin();
    return;
  }

  isRefreshing = true;
  if (showMessage) {
    setFeedback(ordersFeedback, 'info', 'Refreshing requests...');
    setFeedback(tasksFeedback, 'info', 'Refreshing tasks...');
  }

  try {
    await Promise.all([loadOrders(role), loadTasks(role)]);
  } catch (error) {
    console.error('Failed to refresh service data', error);
  } finally {
    isRefreshing = false;
  }
}

async function loadOrders(role) {
  const params = new URLSearchParams();
  params.set('status', 'active');
  params.set('limit', '100');
  const department = ROLE_DEPARTMENT[role];
  if (department) {
    params.set('department', department);
  }

  try {
    const response = await authFetch(`/api/orders?${params.toString()}`);
    if (response.status === 204) {
      renderOrders([]);
      return;
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Unable to load guest requests.');
    }
    const orders = await response.json().catch(() => []);
    renderOrders(Array.isArray(orders) ? orders : []);
    setFeedback(ordersFeedback, '', '');
  } catch (error) {
    if (error?.isAuthError) {
      throw error;
    }
    setFeedback(ordersFeedback, 'error', error?.message || 'Unable to load guest requests.');
    renderOrders([]);
  }
}

function renderOrders(orders) {
  if (!ordersTableBody) {
    return;
  }

  if (!orders.length) {
    ordersTableBody.innerHTML =
      '<tr><td colspan="5" class="text-muted">No active requests for your team right now.</td></tr>';
    return;
  }

  const rows = orders.map((order) => {
    const createdAt = formatDateTime(order.createdAt);
    const requestedFor = order.requestedFor ? formatDateTime(order.requestedFor) : null;
    const summary = order.itemsSummary || summarizeItems(order.items);
    const statusBadge = `<span class="status-badge" data-status="${escapeHtml(
      order.status || ''
    )}">${escapeHtml((order.status || '').replace(/_/g, ' ') || 'pending')}</span>`;
    const actions = buildOrderActions(order);

    return `
      <tr>
        <td>
          <strong>${escapeHtml(createdAt)}</strong>
          ${requestedFor ? `<div class="portal-meta">For ${escapeHtml(requestedFor)}</div>` : ''}
          <div class="portal-meta">Code ${escapeHtml(order.orderCode || '')}</div>
        </td>
        <td>
          <strong>${escapeHtml(capitalize(order.orderType || 'request'))}</strong>
          <div class="portal-meta">${escapeHtml(summary || 'No items listed')}</div>
          ${
            order.specialInstructions
              ? `<div class="portal-meta portal-meta--note">Note: ${escapeHtml(
                  order.specialInstructions
                )}</div>`
              : ''
          }
        </td>
        <td>
          <strong>${escapeHtml(order.fullName || 'Guest')}</strong>
          ${order.roomNumber ? `<div class="portal-meta">Room ${escapeHtml(order.roomNumber)}</div>` : ''}
          ${
            order.phone ? `<div class="portal-meta">${escapeHtml(order.phone)}</div>` : ''
          }
        </td>
        <td>
          ${statusBadge}
          ${order.handledBy ? `<div class="portal-meta">Handler: ${escapeHtml(order.handledBy)}</div>` : ''}
          ${order.statusNote ? `<div class="portal-meta">Update: ${escapeHtml(order.statusNote)}</div>` : ''}
        </td>
        <td class="portal-order-actions-cell">
          ${actions}
        </td>
      </tr>
    `;
  });

  ordersTableBody.innerHTML = rows.join('');
}

function buildOrderActions(order) {
  if (!order) {
    return '<span class="portal-meta text-muted">No actions available.</span>';
  }

  const actions = [];
  switch (order.status) {
    case 'pending':
      actions.push({ label: 'Acknowledge', status: 'acknowledged', variant: 'secondary' });
      actions.push({ label: 'Complete', status: 'completed', variant: 'primary' });
      actions.push({ label: 'Cancel', status: 'cancelled', variant: 'secondary' });
      break;
    case 'acknowledged':
      actions.push({ label: 'In progress', status: 'in_progress', variant: 'secondary' });
      actions.push({ label: 'Complete', status: 'completed', variant: 'primary' });
      actions.push({ label: 'Cancel', status: 'cancelled', variant: 'secondary' });
      break;
    case 'in_progress':
      actions.push({ label: 'Complete', status: 'completed', variant: 'primary' });
      actions.push({ label: 'Cancel', status: 'cancelled', variant: 'secondary' });
      break;
    case 'completed':
    case 'cancelled':
      actions.push({ label: 'Re-open', status: 'pending', variant: 'secondary' });
      break;
    default:
      actions.push({ label: 'Complete', status: 'completed', variant: 'primary' });
      break;
  }

  if (!actions.length) {
    return '<span class="portal-meta text-muted">No actions available.</span>';
  }

  const buttons = actions
    .map((action) => {
      const classes =
        action.variant === 'primary' ? 'primary-btn portal-order-action' : 'secondary-btn portal-order-action';
      return `<button type="button" class="${classes}" data-order-id="${order.id}" data-order-status="${action.status}">${escapeHtml(action.label)}</button>`;
    })
    .join('');
  return `<div class="portal-order-actions">${buttons}</div>`;
}

async function handleOrderActionClick(event) {
  const button =
    event.target instanceof HTMLElement ? event.target.closest('[data-order-status]') : null;
  if (!button) {
    return;
  }
  const orderId = Number.parseInt(button.dataset.orderId ?? '', 10);
  const nextStatus = button.dataset.orderStatus;
  if (Number.isNaN(orderId) || !nextStatus) {
    return;
  }

  button.disabled = true;
  setFeedback(ordersFeedback, 'info', `Updating request...`);
  try {
    await submitOrderStatus(orderId, nextStatus);
    await refreshData();
    setFeedback(ordersFeedback, 'success', `Request marked as ${formatStatusLabel(nextStatus)}.`);
  } catch (error) {
    if (error?.isAuthError) {
      return;
    }
    console.error('Failed to update service request status', error);
    setFeedback(ordersFeedback, 'error', error?.message || 'Unable to update the request.');
  } finally {
    button.disabled = false;
  }
}

async function submitOrderStatus(orderId, status) {
  const response = await authFetch(`/api/orders/${orderId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearAuth();
      showLogin();
      const authError = new Error('Session expired. Please sign in again.');
      authError.isAuthError = true;
      throw authError;
    }
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || 'Unable to update the request.');
  }

  return response.json().catch(() => ({}));
}

function formatStatusLabel(status) {
  if (!status) {
    return '';
  }
  return capitalize(status.replace(/_/g, ' '));
}

async function loadTasks(role) {
  const params = new URLSearchParams();
  params.set('status', 'active');
  params.set('limit', '100');
  params.set('type', role);

  try {
    const response = await authFetch(`/api/rooms/service-tasks?${params.toString()}`);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Unable to load room service tasks.');
    }
    const tasks = await response.json().catch(() => []);
    renderTasks(Array.isArray(tasks) ? tasks : []);
    setFeedback(tasksFeedback, '', '');
  } catch (error) {
    if (error?.isAuthError) {
      throw error;
    }
    setFeedback(tasksFeedback, 'error', error?.message || 'Unable to load room service tasks.');
    renderTasks([]);
  }
}

function renderTasks(tasks) {
  if (!tasksTableBody) {
    return;
  }

  if (!tasks.length) {
    tasksTableBody.innerHTML =
      '<tr><td colspan="4" class="text-muted">No open room tasks assigned to your team.</td></tr>';
    return;
  }

  const rows = tasks.map((task) => {
    const scheduled = task.scheduledFor ? formatDateTime(task.scheduledFor) : 'Unscheduled';
    const updated = task.updatedAt ? formatDateTime(task.updatedAt) : null;
    const priorityLabel = capitalize(task.priority || 'normal');
    const readinessLabel = task.readiness ? capitalize(task.readiness) : 'Not set';

    return `
      <tr>
        <td>
          <strong>${escapeHtml(task.roomNumber || 'Room')}</strong>
          <div class="portal-meta">Type: ${escapeHtml(capitalize(task.taskType || 'task'))}</div>
        </td>
        <td>
          <strong>${escapeHtml(task.title || 'Task')}</strong>
          <div class="portal-meta">${escapeHtml(task.details || 'No additional notes')}</div>
          <div class="portal-meta">Readiness: ${escapeHtml(readinessLabel)}</div>
        </td>
        <td>
          <span class="priority-pill priority-pill--${escapeHtml(task.priority || 'normal')}">
            ${escapeHtml(priorityLabel)}
          </span>
          ${task.assignedTo ? `<div class="portal-meta">Assigned: ${escapeHtml(task.assignedTo)}</div>` : ''}
          ${task.reportedBy ? `<div class="portal-meta">Reported by: ${escapeHtml(task.reportedBy)}</div>` : ''}
        </td>
        <td>
          <div class="portal-meta">Scheduled: ${escapeHtml(scheduled)}</div>
          ${
            updated
              ? `<div class="portal-meta">Updated: ${escapeHtml(updated)}</div>`
              : ''
          }
        </td>
      </tr>
    `;
  });

  tasksTableBody.innerHTML = rows.join('');
}

function attemptAutoLogin() {
  const token = getToken();
  const role = normalizeRole(getRole());
  if (!token || !SERVICE_TEAM_ROLES.has(role)) {
    clearAuth();
    showLogin();
    return;
  }
  applyServiceRoute(role, window.location.href);
  showDashboard(role, getUsername());
  refreshData().catch((error) => {
    if (error?.isAuthError) {
      return;
    }
    console.error('Auto refresh failed', error);
  });
}

function handleLogout() {
  clearAuth();
  showLogin();
  setFeedback(loginFeedback, 'info', 'You have been signed out.');
}

function setAuth(token, role, username) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ROLE_KEY, normalizeRole(role));
  localStorage.setItem(USERNAME_KEY, username || '');
}

function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(USERNAME_KEY);
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getRole() {
  return localStorage.getItem(ROLE_KEY);
}

function getUsername() {
  return localStorage.getItem(USERNAME_KEY) || '';
}

async function authFetch(url, options = {}) {
  const token = getToken();
  if (!token) {
    const authError = new Error('Authentication required.');
    authError.isAuthError = true;
    throw authError;
  }

  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);

  const response = await harborviewFetch(url, { ...options, headers });

  if (response.status === 401) {
    clearAuth();
    showLogin();
    const authError = new Error('Session expired. Please sign in again.');
    authError.isAuthError = true;
    throw authError;
  }

  return response;
}

function escapeHtml(value) {
  if (value == null) {
    return '';
  }
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateTime(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function summarizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return '';
  }
  return items
    .slice(0, 3)
    .map((item) => {
      const quantity = item.quantity > 1 ? `${item.quantity}× ` : '';
      return `${quantity}${item.name}`;
    })
    .join(', ');
}

function capitalize(value) {
  if (!value) {
    return '';
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}














