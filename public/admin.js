const TOKEN_KEY = 'hb_portal_token';
const ROLE_KEY = 'hb_portal_role';
const USERNAME_KEY = 'hb_portal_username';
const SERVICE_PORTAL_TOKEN_KEY = 'hv_service_token';
const SERVICE_PORTAL_ROLE_KEY = 'hv_service_role';
const SERVICE_PORTAL_USERNAME_KEY = 'hv_service_username';
const ADMIN_PORTAL_ROLES = new Set(['staff', 'owner', 'cashier', 'restaurant']);
const ROLE_HOME_SECTIONS = {
  owner: 'owner-overview',
  staff: 'reservations-section',
  cashier: 'billing-management',
  restaurant: 'order-management',
};
const SERVICE_PORTAL_BASE_PATH = '/service-team';
const harborviewFetch =
  typeof window.harborviewFetch === 'function' ? window.harborviewFetch : window.fetch.bind(window);


const loginPanel = document.getElementById('login-panel');

const loginForm = document.getElementById('login-form');

const loginFeedback = document.getElementById('login-feedback');



const dashboard = document.getElementById('dashboard');

const dashboardHeading = document.getElementById('dashboard-heading');

const dashboardSubtitle = document.getElementById('dashboard-subtitle');

const welcomeName = document.getElementById('welcome-name');

const roleBadge = document.getElementById('role-badge');

const logoutBtn = document.getElementById('logout-btn');

const refreshBtn = document.getElementById('refresh-btn');



const overviewSection = document.getElementById('owner-overview');

const statTotalBookings = document.getElementById('stat-total-bookings');

const statAvailableRooms = document.getElementById('stat-available-rooms');

const statCheckedIn = document.getElementById('stat-checked-in');

const statCheckedOut = document.getElementById('stat-checked-out');

const statWalkIns = document.getElementById('stat-walk-ins');

const statOnlineReservations = document.getElementById('stat-online-reservations');

const statSalesDaily = document.getElementById('stat-sales-daily');

const statSalesWeekly = document.getElementById('stat-sales-weekly');

const statSalesMonthly = document.getElementById('stat-sales-monthly');

const statSalesYearly = document.getElementById('stat-sales-yearly');

const salesSelectedLabel = document.getElementById('sales-selected-label');

const salesSelectedRange = document.getElementById('sales-selected-range');

const salesStatusText = document.getElementById('sales-status-text');

const salesSelectedTotal = document.getElementById('sales-selected-total');

let salesFilterButtons = [];

const availabilityBody = document.getElementById('availability-body');

const roomManagementSection = document.getElementById('room-management');

const roomCreateForm = document.getElementById('room-create-form');

const roomCreateFeedback = document.getElementById('room-create-feedback');

const roomManagementTableBody = document.getElementById('room-management-table-body');



const minDepositLabel = document.getElementById('admin-min-deposit');

const directBookingForm = document.getElementById('direct-booking-form');

const directBookingFeedback = document.getElementById('direct-booking-feedback');

const adminCheckInInput = directBookingForm?.elements?.checkIn;

const adminCheckOutInput = directBookingForm?.elements?.checkOut;



const bookingsTableBody = document.getElementById('booking-table-body');

const reservationsFeedback = document.getElementById('reservations-feedback');

const bookingFilterForm = document.getElementById('booking-filter-form');

const bookingFilterStart = document.getElementById('booking-filter-start');

const bookingFilterEnd = document.getElementById('booking-filter-end');

const bookingFilterReset = document.getElementById('booking-filter-reset');

const guestSection = document.getElementById('guest-management');

const guestFilterForm = document.getElementById('guest-filter-form');

const guestSearchInput = document.getElementById('guest-search-input');

const guestFilterReset = document.getElementById('guest-filter-reset');

const guestFeedback = document.getElementById('guest-feedback');

const guestTableBody = document.getElementById('guest-table-body');

const guestDetailCard = document.getElementById('guest-detail-card');

const guestDetailName = document.getElementById('guest-detail-name');

const guestDetailSubtitle = document.getElementById('guest-detail-subtitle');

const guestDetailStatus = document.getElementById('guest-detail-status');

const guestDetailEmail = document.getElementById('guest-detail-email');

const guestDetailPhone = document.getElementById('guest-detail-phone');

const guestDetailVip = document.getElementById('guest-detail-vip');

const guestDetailMarketing = document.getElementById('guest-detail-marketing');

const guestDetailPreferredRoom = document.getElementById('guest-detail-preferred-room');

const guestDetailLastRoom = document.getElementById('guest-detail-last-room');

const guestDetailTotals = document.getElementById('guest-detail-totals');

const guestDetailLifetime = document.getElementById('guest-detail-lifetime');

const guestDetailLastStay = document.getElementById('guest-detail-last-stay');

const guestDetailNextStay = document.getElementById('guest-detail-next-stay');

const guestDetailNotes = document.getElementById('guest-detail-notes');

const guestDetailPreferences = document.getElementById('guest-detail-preferences');

const guestUpcomingList = document.getElementById('guest-upcoming-list');

const guestHistoryList = document.getElementById('guest-history-list');

const orderSection = document.getElementById('order-management');
const ordersFeedback = document.getElementById('orders-feedback');
const orderTableBody = document.getElementById('order-table-body');
const orderStatusFilter = document.getElementById('order-status-filter');
const orderDepartmentFilter = document.getElementById('order-department-filter');
const billingSection = document.getElementById('billing-management');
const billingTableBody = document.getElementById('billing-table-body');
const billingFeedback = document.getElementById('billing-feedback');
const directBookingSection = document.getElementById('direct-booking-section');
const reservationsSection = document.getElementById('reservations-section');
const serviceSection = document.getElementById('service-management');
const serviceTableBody = document.getElementById('service-table-body');
const serviceFeedback = document.getElementById('service-feedback');
const serviceFilterType = document.getElementById('service-filter-type');
const serviceFilterStatus = document.getElementById('service-filter-status');
const serviceFilterReadiness = document.getElementById('service-filter-readiness');
const serviceRefreshBtn = document.getElementById('service-refresh-btn');
const serviceCreateToggle = document.getElementById('service-create-toggle');
const serviceCreateForm = document.getElementById('service-create-form');
const serviceCreateFeedback = document.getElementById('service-create-feedback');
const serviceCancelCreate = document.getElementById('service-cancel-create');
const serviceRoomInput = document.getElementById('service-room-input');
const serviceTypeInput = document.getElementById('service-type-input');
const serviceTitleInput = document.getElementById('service-title-input');
const serviceDetailsInput = document.getElementById('service-details-input');
const servicePriorityInput = document.getElementById('service-priority-input');
const serviceReadinessInput = document.getElementById('service-readiness-input');
const serviceScheduledInput = document.getElementById('service-scheduled-input');
const serviceAssignedInput = document.getElementById('service-assigned-input');
const serviceStatScheduled = document.getElementById('service-stat-scheduled');
const serviceStatProgress = document.getElementById('service-stat-progress');
const serviceStatReady = document.getElementById('service-stat-ready');
const serviceStatOut = document.getElementById('service-stat-out');


let minimumDeposit = 0;

const bookingFilters = {

  startDate: '',

  endDate: '',

};

const ownerFilters = {

  salesWindow: 'daily',

};

let overviewRequestToken = 0;

let latestOverview = null;

let latestOverviewFetchedAt = null;

const guestFilters = {

  search: '',

};

let guestRows = [];

let selectedGuestId = null;

let guestDetailRequestToken = 0;

const guestDetailCache = new Map();

const orderFilters = {

  status: 'active',

  department: '',

};

let currentOrders = [];

const ORDER_FINAL_STATUSES = new Set(['completed', 'cancelled']);
let billingSummary = [];
let billingSummaryById = new Map();
let billingTotals = null;
let billingPaymentMethods = ['Cash', 'GCash', 'PayMaya', 'Credit Card'];
let billingRequestToken = 0;
const serviceFilters = {
  type: 'all',
  status: 'active',
  readiness: 'all',
};
let serviceTasks = [];
let serviceSummary = null;
const SERVICE_STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];
const SERVICE_PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Standard' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];
const SERVICE_READINESS_OPTIONS = [
  { value: '', label: 'No change' },
  { value: 'ready', label: 'Ready' },
  { value: 'dirty', label: 'Dirty' },
  { value: 'inspection', label: 'Needs inspection' },
  { value: 'out_of_service', label: 'Out of service' },
];
const SERVICE_TYPE_LABELS = {
  housekeeping: 'Housekeeping',
  maintenance: 'Maintenance',
};
const SERVICE_TASK_TYPES = new Set(['housekeeping', 'maintenance']);
const SERVICE_STATUS_LABELS = SERVICE_STATUS_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});
const SERVICE_PRIORITY_LABELS = SERVICE_PRIORITY_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});
const SERVICE_READINESS_LABELS = {
  ready: 'Ready',
  dirty: 'Dirty',
  inspection: 'Needs inspection',
  out_of_service: 'Out of service',
};
const SERVICE_TEAM_ROLES = new Set(['housekeeping', 'maintenance']);
const SERVICE_DEPARTMENT_BY_ROLE = {
  housekeeping: 'housekeeping',
  maintenance: 'engineering',
};
const SERVICE_TEAM_DEPARTMENTS = new Set(['housekeeping', 'engineering']);

function normalizeRole(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().toLowerCase();
}

function isServiceTeamDepartment(department) {
  if (!department) {
    return false;
  }
  return SERVICE_TEAM_DEPARTMENTS.has(department.trim().toLowerCase());
}

function buildServicePortalUrl(role) {
  const normalized = normalizeRole(role);
  const hash = SERVICE_TEAM_ROLES.has(normalized) ? `#${normalized}` : '';
  return `${SERVICE_PORTAL_BASE_PATH}${hash}`;
}

function storeServicePortalAuth(token, role, username) {
  if (!token || !role) {
    return;
  }
  try {
    localStorage.setItem(SERVICE_PORTAL_TOKEN_KEY, token);
    localStorage.setItem(SERVICE_PORTAL_ROLE_KEY, normalizeRole(role));
    localStorage.setItem(SERVICE_PORTAL_USERNAME_KEY, username || '');
  } catch (error) {
    console.warn('Unable to persist service portal session', error);
  }
}

function focusRoleHome(role, behavior = 'auto', targetIdOverride = undefined) {
  const normalized = normalizeRole(role);
  let targetId = targetIdOverride || ROLE_HOME_SECTIONS[normalized];
  if (!targetId) {
    if (window.location.hash) {
      try {
        history.replaceState(null, '', `${window.location.pathname}${window.location.search || ''}`);
      } catch (error) {
        window.location.hash = '';
      }
    }
    return;
  }

  const target = document.getElementById(targetId);
  if (!target) {
    const fallbackId = ROLE_HOME_SECTIONS[normalized];
    if (targetIdOverride && fallbackId && fallbackId !== targetIdOverride) {
      focusRoleHome(normalized, behavior, fallbackId);
    }
    return;
  }

  try {
    const basePath = `${window.location.pathname}${window.location.search || ''}`;
    if (history.replaceState) {
      history.replaceState(null, '', `${basePath}#${targetId}`);
    } else {
      window.location.hash = targetId;
    }
  } catch (error) {
    window.location.hash = targetId;
  }

  if (typeof target.scrollIntoView === 'function') {
    const options =
      behavior === 'smooth'
        ? { behavior: 'smooth', block: 'start', inline: 'nearest' }
        : { block: 'start', inline: 'nearest' };
    target.scrollIntoView(options);
  }
}

function applyAdminRoute(role, redirectTarget, behavior = 'auto') {
  const normalized = normalizeRole(role);
  let targetId = ROLE_HOME_SECTIONS[normalized];
  let nextUrl = null;

  if (typeof redirectTarget === 'string' && redirectTarget.trim()) {
    try {
      const parsed = new URL(redirectTarget, window.location.origin);
      nextUrl = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      if (parsed.hash) {
        targetId = parsed.hash.slice(1) || targetId;
      }
    } catch (error) {
      // Ignore malformed redirect targets; fall back to defaults.
    }
  }

  if (nextUrl) {
    const currentUrl = `${window.location.pathname}${window.location.search || ''}${window.location.hash || ''}`;
    if (currentUrl !== nextUrl) {
      try {
        history.replaceState(null, '', nextUrl);
      } catch (error) {
        if (targetId) {
          window.location.hash = targetId;
        }
      }
    }
  }

  focusRoleHome(normalized, behavior, targetId);
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


document.addEventListener('DOMContentLoaded', () => {

  initializeConfig()

    .catch(() => {

      // Config failure is non-blocking; continue with defaults.

    })

    .finally(() => initializePortal());

});



function initializePortal() {

  salesFilterButtons = Array.from(document.querySelectorAll('[data-sales-window]'));

  loginForm?.addEventListener('submit', handleLogin);

  logoutBtn?.addEventListener('click', handleLogout);

  refreshBtn?.addEventListener('click', () => {

    refreshPortalData().catch((error) => setFeedback(reservationsFeedback, 'error', error.message));

  });

  directBookingForm?.addEventListener('submit', handleDirectBooking);

  bookingsTableBody?.addEventListener('click', handleTableClick);

  roomCreateForm?.addEventListener('submit', handleRoomCreateSubmit);

  bookingFilterForm?.addEventListener('submit', handleBookingFilterSubmit);

  bookingFilterReset?.addEventListener('click', handleBookingFilterReset);

  guestFilterForm?.addEventListener('submit', handleGuestFilterSubmit);
  guestFilterReset?.addEventListener('click', handleGuestFilterReset);
  guestTableBody?.addEventListener('click', handleGuestTableClick);
  orderStatusFilter?.addEventListener('change', handleOrderFilterChange);
  orderDepartmentFilter?.addEventListener('change', handleOrderFilterChange);
  orderTableBody?.addEventListener('click', handleOrderTableClick);
  billingTableBody?.addEventListener('click', handleBillingTableClick);
  serviceFilterType?.addEventListener('change', handleServiceFilterChange);
  serviceFilterStatus?.addEventListener('change', handleServiceFilterChange);
  serviceFilterReadiness?.addEventListener('change', handleServiceFilterChange);
  serviceRefreshBtn?.addEventListener('click', handleServiceRefreshClick);
  serviceCreateToggle?.addEventListener('click', () => toggleServiceCreateForm());
  serviceCancelCreate?.addEventListener('click', () => toggleServiceCreateForm(false));
  serviceCreateForm?.addEventListener('submit', handleServiceCreateSubmit);
  serviceTableBody?.addEventListener('click', handleServiceTableClick);
  salesFilterButtons.forEach((button) => button.addEventListener('click', handleSalesFilterClick));
  setAdminDateBounds();
  adminCheckInInput?.addEventListener('change', handleAdminDateChange);
  syncBookingFilterInputs();
  updateSalesFilterButtons();
  applySalesHighlight(ownerFilters.salesWindow, latestOverview);



  attemptAutoLogin();
  attemptUrlLogin();
}


async function handleLogin(event) {
  event.preventDefault();
  setFeedback(loginFeedback, '', '');

  const formData = new FormData(loginForm);
  const payload = {
    username: formData.get('username')?.toString().trim(),
    password: formData.get('password'),
  };

  if (!payload.username || !payload.password) {
    setFeedback(loginFeedback, 'error', 'Enter both username and password.');
    return;
  }

  try {
    loginForm.querySelector('button[type="submit"]').disabled = true;
    setFeedback(loginFeedback, 'info', 'Signing in...');

    const response = await harborviewFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || 'Unable to sign in.');
    }

    const role = normalizeRole(data.role);
    const username = data.username || payload.username || '';
    const redirectTarget = typeof data.redirect === 'string' ? data.redirect : null;

    if (!role) {
      throw new Error('Account role missing. Contact your administrator.');
    }
    if (!ADMIN_PORTAL_ROLES.has(role) && !SERVICE_TEAM_ROLES.has(role)) {
      throw new Error('Your role is not authorized for this portal.');
    }
    if (!data.token) {
      throw new Error('Unable to issue a session token. Please try again.');
    }

    clearAuth();

    if (SERVICE_TEAM_ROLES.has(role)) {
      storeServicePortalAuth(data.token, role, username);
      setFeedback(loginFeedback, 'info', 'Redirecting to the Service Team portal...');
      const targetUrl = redirectTarget || buildServicePortalUrl(role);
      window.location.href = targetUrl;
      return;
    }

    setAuth(data.token, role, username);
    setFeedback(loginFeedback, '', '');
    showDashboard(role, username);
    applyAdminRoute(role, redirectTarget, 'smooth');
    await refreshPortalData();
  } catch (error) {
    setFeedback(loginFeedback, 'error', error?.message || 'Unable to sign in.');
  } finally {
    loginForm.querySelector('button[type="submit"]').disabled = false;
  }
}



function handleLogout() {

  clearAuth();

  bookingsTableBody.innerHTML = '';

  setFeedback(reservationsFeedback, '', '');

  setFeedback(directBookingFeedback, '', '');

  bookingFilters.startDate = '';

  bookingFilters.endDate = '';

  syncBookingFilterInputs();

  roomManagementSection?.classList.add('is-hidden');

  guestRows = [];

  selectedGuestId = null;

  guestDetailRequestToken = 0;

  guestDetailCache.clear();

  guestSection?.classList.add('is-hidden');

  if (guestTableBody) {

    guestTableBody.innerHTML = '';

  }

  setFeedback(guestFeedback, '', '');

  renderGuestDetail(null);

  orderSection?.classList.add('is-hidden');

  currentOrders = [];

  if (orderTableBody) {

    orderTableBody.innerHTML = '';

  }

  setFeedback(ordersFeedback, '', '');

  if (orderStatusFilter) {

    orderStatusFilter.value = 'active';

  }

  if (orderDepartmentFilter) {
    orderDepartmentFilter.value = '';
    orderDepartmentFilter.disabled = false;
  }
  billingSection?.classList.add('is-hidden');
  serviceSection?.classList.add('is-hidden');
  serviceTasks = [];
  serviceSummary = null;
  serviceFilters.type = 'all';
  serviceFilters.status = 'active';
  serviceFilters.readiness = 'all';
  if (serviceFilterType) {
    serviceFilterType.disabled = false;
    serviceFilterType.value = 'all';
  }
  if (serviceFilterStatus) {
    serviceFilterStatus.value = serviceFilters.status;
  }
  if (serviceFilterReadiness) {
    serviceFilterReadiness.value = serviceFilters.readiness;
  }
  if (serviceTableBody) {
    serviceTableBody.innerHTML = '';
  }
  resetServiceSummary();
  setFeedback(serviceFeedback, '', '');
  if (typeof toggleServiceCreateForm === 'function') {
    toggleServiceCreateForm(false);
  }
  billingSummary = [];
  billingSummaryById = new Map();
  billingTotals = null;
  billingRequestToken = 0;
  billingPaymentMethods = ['Cash', 'GCash', 'PayMaya', 'Credit Card'];
  if (billingTableBody) {

    billingTableBody.innerHTML = '';

  }

  setFeedback(billingFeedback, '', '');

  showLogin();

}



async function handleDirectBooking(event) {

  event.preventDefault();

  setFeedback(directBookingFeedback, '', '');



  const formData = new FormData(directBookingForm);

  const payload = Object.fromEntries(formData.entries());



  try {

    const depositValue = Number.parseFloat(payload.paymentAmount);

    if (Number.isNaN(depositValue) || depositValue < minimumDeposit) {

      throw new Error(`Deposit must be at least PHP ${minimumDeposit.toFixed(2)}.`);

    }



    const response = await authFetch('/api/bookings/direct', {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify(payload),

    });



    if (!response.ok) {

      const data = await response.json();

      throw new Error(data?.message || 'Unable to save booking.');

    }



    directBookingForm.reset();

    await refreshPortalData();

    setFeedback(directBookingFeedback, 'success', 'Booking recorded successfully.');

  } catch (error) {

    setFeedback(directBookingFeedback, 'error', error.message);

  }

}



function handleBookingFilterSubmit(event) {

  event.preventDefault();



  const startValue = bookingFilterStart?.value?.trim() || '';

  const endValue = bookingFilterEnd?.value?.trim() || '';



  if (startValue && endValue && startValue > endValue) {

    setFeedback(reservationsFeedback, 'error', 'Start date must be before end date.');

    return;

  }



  bookingFilters.startDate = startValue;

  bookingFilters.endDate = endValue;

  syncBookingFilterInputs();

  setFeedback(reservationsFeedback, '', '');

  refreshPortalData().catch((error) => setFeedback(reservationsFeedback, 'error', error.message));

}



function handleBookingFilterReset() {

  bookingFilters.startDate = '';

  bookingFilters.endDate = '';

  syncBookingFilterInputs();

  setFeedback(reservationsFeedback, '', '');

  refreshPortalData().catch((error) => setFeedback(reservationsFeedback, 'error', error.message));

}



function syncBookingFilterInputs() {

  if (bookingFilterStart) {

    bookingFilterStart.value = bookingFilters.startDate || '';

  }

  if (bookingFilterEnd) {

    bookingFilterEnd.value = bookingFilters.endDate || '';

  }

}



function handleTableClick(event) {

  const checkoutTarget = event.target.closest('[data-checkout-id]');

  if (checkoutTarget) {

    handleCheckoutClick(event);

    return;

  }



  const checkinTarget = event.target.closest('[data-checkin-id]');

  if (checkinTarget && typeof handleCheckinClick === 'function') {

    handleCheckinClick(event);

  }

}



async function handleRoomCreateSubmit(event) {

  event.preventDefault();

  setFeedback(roomCreateFeedback, '', '');



  const formData = new FormData(roomCreateForm);

  const payload = {

    name: formData.get('name')?.trim(),

    totalRooms: formData.get('totalRooms'),

    baseRate: formData.get('baseRate'),

    description: formData.get('description')?.trim() || '',

    sleeps: formData.get('sleeps'),

    brochureUrl: formData.get('brochureUrl')?.trim() || '',

    imageUrl: formData.get('imageUrl')?.trim() || '',

  };



  if (!payload.name || payload.name.length < 3) {

    setFeedback(roomCreateFeedback, 'error', 'Room name must be at least 3 characters.');

    return;

  }



  if (payload.sleeps) {

    const parsedSleeps = Number.parseInt(payload.sleeps, 10);

    if (Number.isNaN(parsedSleeps) || parsedSleeps <= 0) {

      setFeedback(roomCreateFeedback, 'error', 'Sleeps must be a positive number.');

      return;

    }

  }



  const submitButton = roomCreateForm.querySelector('button[type="submit"]');

  submitButton?.setAttribute('disabled', 'disabled');



  try {

    const response = await authFetch('/api/room-types', {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify(payload),

    });



    const data = await response.json().catch(() => ({}));

    if (!response.ok) {

      throw new Error(data?.message || 'Unable to add room type.');

    }



    roomCreateForm.reset();

    setFeedback(roomCreateFeedback, 'success', 'Room type added.');

    await loadRoomManagement();

  } catch (error) {

    setFeedback(roomCreateFeedback, 'error', error.message);

  } finally {

    submitButton?.removeAttribute('disabled');

  }

}



async function handleSalesFilterClick(event) {

  const button = event.currentTarget;

  const value = normalizeSalesWindow(button?.dataset?.salesWindow);

  if (!value) {

    return;

  }

  if (ownerFilters.salesWindow === value) {

    return;

  }

  ownerFilters.salesWindow = value;

  updateSalesFilterButtons();

  setSalesHighlightLoading(value);

  setSalesButtonsDisabled(true);

  console.info(`[admin] Loading ${value} sales window.`);

  let refreshed = false;

  try {

    await loadOwnerOverview();

    refreshed = true;

  } catch (error) {

    setFeedback(reservationsFeedback, 'error', error.message || 'Unable to refresh sales summary.');

    console.error('[admin] Failed to load sales window', value, error);

    if (salesStatusText) {

      salesStatusText.textContent = 'Unable to refresh sales summary.';

    }

  } finally {

    setSalesButtonsDisabled(false);

    if (!refreshed) {

      applySalesHighlight(ownerFilters.salesWindow, latestOverview);

      if (salesStatusText) {

        salesStatusText.textContent = 'Unable to refresh sales summary.';

      }

    }

  }

}



function updateSalesFilterButtons() {

  salesFilterButtons.forEach((button) => {

    const value = normalizeSalesWindow(button?.dataset?.salesWindow);

    if (!value) {

      return;

    }

    const isActive = value === ownerFilters.salesWindow;

    button.classList.toggle('is-active', isActive);

    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');

  });

}



function setSalesButtonsDisabled(disabled) {

  const flag = Boolean(disabled);

  salesFilterButtons.forEach((button) => {

    button.disabled = flag;

    button.classList.toggle('is-disabled', flag);

  });

  const group = salesFilterButtons.length ? salesFilterButtons[0].parentElement : null;

  if (group) {

    group.setAttribute('aria-busy', flag ? 'true' : 'false');

  }

}



async function handleCheckinClick(event) {

  const button = event.target.closest('[data-checkin-id]');

  if (!button) {

    return;

  }



  const bookingId = Number.parseInt(button.dataset.checkinId, 10);

  if (Number.isNaN(bookingId)) {

    return;

  }



  const providedRoom = window.prompt('Enter the assigned room code (e.g., DK-01).', button.dataset.roomCode || '');

  if (providedRoom == null) {

    return;

  }

  const roomNumber = providedRoom.trim();

  if (!roomNumber) {

    setFeedback(reservationsFeedback, 'error', 'Room number is required to check in a guest.');

    return;

  }

  if (roomNumber.length > 20) {

    setFeedback(reservationsFeedback, 'error', 'Room numbers must be 20 characters or less.');

    return;

  }



  button.disabled = true;

  try {

    const response = await authFetch(`/api/bookings/${bookingId}/checkin`, {

      method: 'PATCH',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify({ roomNumber }),

    });

    if (!response.ok) {

      const data = await response.json().catch(() => ({}));

      throw new Error(data?.message || 'Unable to check the guest in.');

    }

    setFeedback(reservationsFeedback, 'success', `Guest checked in to ${roomNumber}.`);

    await refreshPortalData();

  } catch (error) {

    setFeedback(reservationsFeedback, 'error', error?.message || 'Unable to check the guest in.');

  } finally {

    button.disabled = false;

  }

}



async function handleCheckoutClick(event) {

  const button = event.target.closest('[data-checkout-id]');

  if (!button) {

    return;

  }



  const bookingId = Number.parseInt(button.dataset.checkoutId, 10);

  if (Number.isNaN(bookingId)) {

    return;

  }



  button.disabled = true;

  try {

    const response = await authFetch(`/api/bookings/${bookingId}/checkout`, { method: 'PATCH' });

    if (!response.ok) {

      const data = await response.json().catch(() => ({}));

      throw new Error(data?.message || 'Unable to complete checkout.');

    }

    setFeedback(reservationsFeedback, 'success', 'Guest checked out.');

    await refreshPortalData();

  } catch (error) {

    setFeedback(reservationsFeedback, 'error', error.message);

  } finally {

    button.disabled = false;

  }

}



async function initializeConfig() {

  const response = await harborviewFetch('/api/config');

  if (!response.ok) {

    throw new Error('Unable to load configuration.');

  }

  const data = await response.json();

  minimumDeposit = Number(data?.minimumDeposit || 0);

  if (Number.isNaN(minimumDeposit)) {

    minimumDeposit = 0;

  }

  if (minDepositLabel) {

    minDepositLabel.textContent = minimumDeposit.toLocaleString('en-PH', {

      minimumFractionDigits: 2,

      maximumFractionDigits: 2,

    });

  }

  const paymentAmountInput = directBookingForm?.elements?.paymentAmount;

  if (paymentAmountInput) {

    paymentAmountInput.value = minimumDeposit.toFixed(2);

  }

}



function attemptAutoLogin() {
  const token = getToken();
  const role = normalizeRole(getRole());
  const username = getUsername();

  if (!token || !role) {
    showLogin();
    return;
  }

  if (SERVICE_TEAM_ROLES.has(role)) {
    storeServicePortalAuth(token, role, username);
    clearAuth();
    window.location.replace(buildServicePortalUrl(role));
    return;
  }

  if (!ADMIN_PORTAL_ROLES.has(role)) {
    clearAuth();
    showLogin();
    return;
  }

  showDashboard(role, username);
  applyAdminRoute(role, window.location.href);
  refreshPortalData().catch(() => {
    clearAuth();
    showLogin();
  });
}



async function refreshPortalData() {
  const role = normalizeRole(getRole());
  if (role === 'cashier') {
    await loadBillingSummary();
    return;
  }

  setSalesHighlightLoading(ownerFilters.salesWindow);

  const loaders = [];
  const isServiceTeam = SERVICE_TEAM_ROLES.has(role);

  if (role === 'owner') {
    loaders.push(
      loadBookings(),
      loadOwnerOverview(),
      loadRoomManagement(),
      loadGuests(),
      loadOrders(),
      loadServiceTasks()
    );
    billingSection?.classList.add('is-hidden');
    if (serviceFilterType) {
      serviceFilterType.disabled = false;
      serviceFilterType.value = 'all';
    }
    serviceFilters.type = 'all';
    serviceFilters.status = 'active';
    serviceFilters.readiness = 'all';
    orderFilters.department = '';
    if (orderDepartmentFilter) {
      orderDepartmentFilter.disabled = false;
      orderDepartmentFilter.value = '';
    }
    if (serviceFilterStatus) {
      serviceFilterStatus.value = serviceFilters.status;
    }
    if (serviceFilterReadiness) {
      serviceFilterReadiness.value = serviceFilters.readiness;
    }
  } else if (role === 'staff') {
    loaders.push(loadBookings(), loadGuests(), loadOrders(), loadServiceTasks());
    overviewSection?.classList.add('is-hidden');
    billingSection?.classList.add('is-hidden');
    if (serviceFilterType) {
      serviceFilterType.disabled = false;
      serviceFilterType.value = 'all';
    }
    serviceFilters.type = 'all';
    serviceFilters.status = 'active';
    serviceFilters.readiness = 'all';
    orderFilters.department = '';
    if (orderDepartmentFilter) {
      orderDepartmentFilter.disabled = false;
      orderDepartmentFilter.value = '';
    }
    if (serviceFilterStatus) {
      serviceFilterStatus.value = serviceFilters.status;
    }
    if (serviceFilterReadiness) {
      serviceFilterReadiness.value = serviceFilters.readiness;
    }
  } else if (role === 'restaurant') {
    loaders.push(loadOrders());
    overviewSection?.classList.add('is-hidden');
    roomManagementSection?.classList.add('is-hidden');
    guestSection?.classList.add('is-hidden');
    billingSection?.classList.add('is-hidden');
    directBookingSection?.classList.add('is-hidden');
    reservationsSection?.classList.add('is-hidden');
    serviceSection?.classList.add('is-hidden');
    orderSection?.classList.remove('is-hidden');
    orderFilters.status = 'active';
    if (orderStatusFilter) {
      orderStatusFilter.value = 'active';
    }
    orderFilters.department = 'restaurant';
    if (orderDepartmentFilter) {
      orderDepartmentFilter.value = 'restaurant';
      orderDepartmentFilter.disabled = true;
    }
    if (serviceFilterType) {
      serviceFilterType.disabled = true;
      serviceFilterType.value = 'all';
    }
    serviceFilters.type = 'all';
    serviceFilters.status = 'active';
    serviceFilters.readiness = 'all';
  } else if (isServiceTeam) {
    const department = SERVICE_DEPARTMENT_BY_ROLE[role] || '';
    if (department) {
      orderFilters.department = department;
      if (orderDepartmentFilter) {
        orderDepartmentFilter.value = department;
        orderDepartmentFilter.disabled = true;
      }
    }
    serviceFilters.type = role;
    serviceFilters.status = 'active';
    serviceFilters.readiness = 'all';
    if (serviceFilterType) {
      serviceFilterType.value = role;
      serviceFilterType.disabled = true;
    }
    if (serviceFilterStatus) {
      serviceFilterStatus.value = serviceFilters.status;
    }
    if (serviceFilterReadiness) {
      serviceFilterReadiness.value = serviceFilters.readiness;
    }
    loaders.push(loadOrders(), loadServiceTasks());
    overviewSection?.classList.add('is-hidden');
    roomManagementSection?.classList.add('is-hidden');
    guestSection?.classList.add('is-hidden');
    billingSection?.classList.add('is-hidden');
    directBookingSection?.classList.add('is-hidden');
    reservationsSection?.classList.add('is-hidden');
  } else {
    roomManagementSection?.classList.add('is-hidden');
    guestSection?.classList.add('is-hidden');
    orderSection?.classList.add('is-hidden');
    billingSection?.classList.add('is-hidden');
    serviceSection?.classList.add('is-hidden');
    directBookingSection?.classList.add('is-hidden');
    reservationsSection?.classList.add('is-hidden');
    if (serviceFilterType) {
      serviceFilterType.disabled = false;
      serviceFilterType.value = 'all';
    }
    serviceFilters.type = 'all';
    orderFilters.department = '';
    if (orderDepartmentFilter) {
      orderDepartmentFilter.disabled = false;
      orderDepartmentFilter.value = '';
    }
    currentOrders = [];
    renderGuestDetail(null);
    if (guestTableBody) {
      guestTableBody.innerHTML = '';
    }
    setFeedback(guestFeedback, '', '');

    if (orderTableBody) {
      orderTableBody.innerHTML = '';
    }
    setFeedback(ordersFeedback, '', '');
    serviceTasks = [];
    serviceSummary = null;
    if (serviceTableBody) {
      serviceTableBody.innerHTML = '';
    }
    resetServiceSummary();
    setFeedback(serviceFeedback, '', '');
  }

  await Promise.all(loaders);
}

async function loadBookings() {

  const params = new URLSearchParams();

  if (bookingFilters.startDate) {

    params.set('startDate', bookingFilters.startDate);

  }

  if (bookingFilters.endDate) {

    params.set('endDate', bookingFilters.endDate);

  }



  const queryString = params.toString();

  const response = await authFetch(queryString ? `/api/bookings?${queryString}` : '/api/bookings');

  if (!response.ok) {

    if (response.status === 401) {

      clearAuth();

      showLogin();

      throw new Error('Session expired. Please sign in again.');

    }

    const data = await response.json().catch(() => ({}));

    throw new Error(data?.message || 'Unable to load reservations.');

  }



  const bookings = await response.json();

  renderBookings(Array.isArray(bookings) ? bookings : []);

  if (bookingFilters.startDate || bookingFilters.endDate) {

    const descriptor = [

      bookingFilters.startDate ? `from ${formatDate(bookingFilters.startDate)}` : '',

      bookingFilters.endDate ? `to ${formatDate(bookingFilters.endDate)}` : '',

    ]

      .filter(Boolean)

      .join(' ');

    setFeedback(

      reservationsFeedback,

      'info',

      descriptor ? `Showing reservations ${descriptor}.` : 'Showing filtered reservations.'

    );

  } else {

    setFeedback(reservationsFeedback, '', '');

  }

}



async function loadOwnerOverview() {

  if (getRole() !== 'owner') {

    overviewSection?.classList.add('is-hidden');

    return;

  }



  const requestId = ++overviewRequestToken;



  const params = new URLSearchParams();

  if (ownerFilters.salesWindow) {

    params.set('salesWindow', ownerFilters.salesWindow);

  }



  const response = await authFetch(params.toString() ? `/api/overview?${params}` : '/api/overview');

  if (!response.ok) {

    const data = await response.json().catch(() => ({}));

    if (requestId === overviewRequestToken) {

      throw new Error(data?.message || 'Unable to load overview.');

    }

    return;

  }



  const overview = await response.json();

  if (requestId !== overviewRequestToken) {

    return;

  }



  latestOverview = overview;

  const selectedUpdatedAt = overview?.sales?.selected?.updatedAt;

  latestOverviewFetchedAt = selectedUpdatedAt ? new Date(selectedUpdatedAt) : new Date();

  if (Number.isNaN(latestOverviewFetchedAt.getTime())) {

    latestOverviewFetchedAt = new Date();

  }



  overviewSection?.classList.remove('is-hidden');

  const sales = overview.sales || {};

  if (statTotalBookings) {

    statTotalBookings.textContent = overview.totalBookings ?? 0;

  }

  if (statAvailableRooms) {

    statAvailableRooms.textContent = overview.availableRooms ?? 0;

  }

  if (statCheckedIn) {

    statCheckedIn.textContent = overview.checkedInGuests ?? 0;

  }

  if (statCheckedOut) {

    statCheckedOut.textContent = overview.checkedOutToday ?? 0;

  }

  if (statWalkIns) {

    statWalkIns.textContent = overview.walkIns ?? 0;

  }

  if (statOnlineReservations) {

    statOnlineReservations.textContent = overview.onlineReservations ?? 0;

  }

  if (statSalesDaily) {

    statSalesDaily.textContent = formatCurrency(sales.daily);

  }

  if (statSalesWeekly) {

    statSalesWeekly.textContent = formatCurrency(sales.weekly);

  }

  if (statSalesMonthly) {

    statSalesMonthly.textContent = formatCurrency(sales.monthly);

  }

  if (statSalesYearly) {

    statSalesYearly.textContent = formatCurrency(sales.yearly);

  }



  applySalesHighlight(ownerFilters.salesWindow, latestOverview);

  console.info(

    `[admin] Sales summary updated for ${ownerFilters.salesWindow}: total=${formatCurrency(

      getSalesTotal(ownerFilters.salesWindow, latestOverview)

    )}, range=${salesSelectedRange ? salesSelectedRange.textContent : 'n/a'}`

  );



  if (availabilityBody) {

    const rows = Array.isArray(overview.availabilityByType)

      ? overview.availabilityByType

          .map((entry) => {

            const totalRooms = Number(entry.totalRooms ?? 0);

            const occupied = Number(entry.occupied ?? 0);

            const available = Number(entry.available ?? Math.max(totalRooms - occupied, 0));

            const safeRoomType = entry.roomType || 'Unspecified';

            const baseRateValue =

              entry.baseRate != null

                ? formatCurrency(entry.baseRate).replace(/^PHP\\s*/, '')

                : 'N/A';

            return `

              <tr>

                <td>${safeRoomType}</td>

                <td>${totalRooms}</td>

                <td>${occupied}</td>

                <td>${available}</td>

                <td>${baseRateValue}</td>

              </tr>

            `;

          })

          .join('')

      : '';

    availabilityBody.innerHTML =

      rows ||

      '<tr><td colspan="5" class="text-muted">No room availability data for the selected criteria.</td></tr>';

  }

}



function handleGuestFilterSubmit(event) {

  event.preventDefault();

  const value = guestSearchInput?.value?.trim() || '';

  guestFilters.search = value;

  loadGuests().catch((error) => {

    if (error?.isAuthError) {

      return;

    }

    console.error('[admin] guest search failed', error);

  });

}



function handleGuestFilterReset() {

  guestFilters.search = '';

  if (guestSearchInput) {

    guestSearchInput.value = '';

  }

  setFeedback(guestFeedback, '', '');

  loadGuests().catch((error) => {

    if (error?.isAuthError) {

      return;

    }

    console.error('[admin] guest filter reset failed', error);

  });

}



function handleGuestTableClick(event) {

  const target = event.target;

  if (!target) {

    return;

  }

  const row =

    typeof target.closest === 'function'

      ? target.closest('tr[data-guest-id]')

      : null;

  if (!row) {

    return;

  }

  const id = Number.parseInt(row.getAttribute('data-guest-id'), 10);

  if (Number.isNaN(id) || id <= 0) {

    return;

  }

  selectGuest(id, { preferCache: true }).catch((error) => {

    if (error?.isAuthError) {

      return;

    }

    console.error('[admin] failed to load guest detail', error);

  });

}



async function loadGuests() {

  if (!guestSection || !guestTableBody) {

    return;

  }



  const role = getRole();

  if (role !== 'staff' && role !== 'owner') {

    guestSection.classList.add('is-hidden');

    return;

  }



  guestSection.classList.remove('is-hidden');

  setFeedback(guestFeedback, '', '');

  guestTableBody.innerHTML =

    '<tr><td colspan="3" class="text-muted">Loading guest profiles...</td></tr>';



  const params = new URLSearchParams();

  if (guestFilters.search) {

    params.set('search', guestFilters.search);

  }



  const queryString = params.toString();



  try {

    const response = await authFetch(queryString ? `/api/guests?${queryString}` : '/api/guests');

    if (!response.ok) {

      if (response.status === 401) {

        clearAuth();

        showLogin();

        const authError = new Error('Session expired. Please sign in again.');

        authError.isAuthError = true;

        throw authError;

      }

      const data = await response.json().catch(() => ({}));

      throw new Error(data?.message || 'Unable to load guest profiles.');

    }



    const rawGuests = await response.json().catch(() => []);

    guestRows = Array.isArray(rawGuests) ? rawGuests : [];

    renderGuestTable(guestRows);



    if (guestRows.length === 0) {

      selectedGuestId = null;

      renderGuestDetail(null);

      if (guestFilters.search) {

        setFeedback(guestFeedback, 'info', 'No guests matched your search.');

      } else {

        setFeedback(guestFeedback, 'info', 'No guest profiles on record yet.');

      }

      return;

    }



    const hasSelected = guestRows.some((guest) => guest.id === selectedGuestId);

    if (!hasSelected) {

      selectedGuestId = guestRows[0].id;

    }

    updateGuestRowActiveState();



    if (guestFilters.search) {

      const resultCount = guestRows.length;

      setFeedback(

        guestFeedback,

        'info',

        resultCount === 1

          ? 'Found 1 guest matching your search.'

          : `Found ${resultCount} guests matching your search.`

      );

    } else {

      setFeedback(guestFeedback, '', '');

    }



    if (selectedGuestId) {

      await selectGuest(selectedGuestId, { preferCache: true });

    } else {

      renderGuestDetail(null);

    }

  } catch (error) {

    if (error?.isAuthError) {

      throw error;

    }

    console.error('[admin] loadGuests failed', error);

    guestTableBody.innerHTML =

      '<tr><td colspan="3" class="text-muted">Guest list unavailable.</td></tr>';

    if (error?.message) {

      setFeedback(guestFeedback, 'error', error.message);

    }

  }

}



function renderGuestTable(guests) {

  if (!guestTableBody) {

    return;

  }



  if (!Array.isArray(guests) || guests.length === 0) {

    guestTableBody.innerHTML =

      '<tr><td colspan="3" class="text-muted">No guest profiles found.</td></tr>';

    return;

  }



  const rows = guests

    .map((guest) => {

      const name = guest.fullName || 'Guest';

      const totalStays = Number(guest.totalStays ?? 0);

      const totalNights = Number(guest.totalNights ?? 0);

      const staySummary = `${totalStays} stay${totalStays === 1 ? '' : 's'} - ${totalNights} night${totalNights === 1 ? '' : 's'}`;

      const lifetimeLabel = formatCurrency(guest.lifetimeValue || 0);

      const upcomingLabel = guest.nextStayAt ? formatDate(guest.nextStayAt) : 'No upcoming stay';

      const roomSummary = guest.lastRoomType

        ? `Last room: ${guest.lastRoomType}`

        : guest.preferredRoomType

        ? `Prefers: ${guest.preferredRoomType}`

        : 'No recent room data';

      const contactParts = [

        guest.email ? `<span class="text-muted">${escapeHtml(guest.email)}</span>` : '',

        guest.phone ? `<span class="text-muted">${escapeHtml(guest.phone)}</span>` : '',

      ].filter(Boolean);

      const contactLines =

        contactParts.length > 0

          ? contactParts.join('<br />')

          : '<span class="text-muted">No contact details</span>';

      const infoParts = [];

      if (guest.vipStatus) {

        infoParts.push(`VIP: ${guest.vipStatus}`);

      }

      if (guest.marketingOptIn) {

        infoParts.push('Marketing: yes');

      }

      const infoLine =
        infoParts.length > 0
          ? `<br /><span class="text-muted">${escapeHtml(infoParts.join(' | '))}</span>`
          : '';


      return `

        <tr class="guest-row" data-guest-id="${guest.id}">

          <td>

            <strong>${escapeHtml(name)}</strong><br />

            ${contactLines}

            ${infoLine}

          </td>

          <td>

            <strong>${escapeHtml(staySummary)}</strong><br />

            <span class="text-muted">${escapeHtml(lifetimeLabel)}</span>

          </td>

          <td>

            ${escapeHtml(upcomingLabel)}<br />

            <span class="text-muted">${escapeHtml(roomSummary)}</span>

          </td>

        </tr>

      `;

    })

    .join('');



  guestTableBody.innerHTML = rows;

  updateGuestRowActiveState();

}



function updateGuestRowActiveState() {

  if (!guestTableBody) {

    return;

  }

  const rows = guestTableBody.querySelectorAll('tr.guest-row');

  rows.forEach((row) => {

    const rowId = Number.parseInt(row.getAttribute('data-guest-id'), 10);

    if (!Number.isNaN(rowId) && rowId === selectedGuestId) {

      row.classList.add('is-active');

    } else {

      row.classList.remove('is-active');

    }

  });

}



async function selectGuest(guestId, options = {}) {

  const numericId = Number.parseInt(guestId, 10);

  if (Number.isNaN(numericId) || numericId <= 0) {

    selectedGuestId = null;

    updateGuestRowActiveState();

    renderGuestDetail(null);

    return;

  }



  if (selectedGuestId !== numericId) {

    selectedGuestId = numericId;

  }

  updateGuestRowActiveState();



  if (options.preferCache && guestDetailCache.has(numericId)) {

    setFeedback(guestDetailStatus, '', '');

    renderGuestDetail(guestDetailCache.get(numericId));

    return;

  }



  await loadGuestDetail(numericId, options);

}



async function loadGuestDetail(guestId, options = {}) {

  if (!guestDetailCard) {

    return null;

  }



  if (guestDetailCache.has(guestId) && !options.forceReload && !options.preferCache) {

    const cachedGuest = guestDetailCache.get(guestId);

    renderGuestDetail(cachedGuest);

    setFeedback(guestDetailStatus, '', '');

    return cachedGuest;

  }



  const requestId = ++guestDetailRequestToken;

  setFeedback(guestDetailStatus, 'info', 'Loading guest profile...');



  try {

    const response = await authFetch(`/api/guests/${guestId}`);

    if (!response.ok) {

      if (response.status === 401) {

        clearAuth();

        showLogin();

        const authError = new Error('Session expired. Please sign in again.');

        authError.isAuthError = true;

        throw authError;

      }

      if (response.status === 404) {

        const notFoundError = new Error('Guest profile was not found.');

        notFoundError.isNotFound = true;

        throw notFoundError;

      }

      const data = await response.json().catch(() => ({}));

      throw new Error(data?.message || 'Unable to load guest profile.');

    }



    const guest = await response.json();

    if (requestId !== guestDetailRequestToken) {

      return guest;

    }



    guestDetailCache.set(guestId, guest);

    setFeedback(guestDetailStatus, '', '');

    renderGuestDetail(guest);

    return guest;

  } catch (error) {

    if (error?.isAuthError) {

      setFeedback(guestDetailStatus, 'error', error.message);

      throw error;

    }

    if (error?.isNotFound) {

      setFeedback(guestDetailStatus, 'error', 'Guest profile no longer exists.');

      guestDetailCache.delete(guestId);

      guestRows = guestRows.filter((row) => row.id !== guestId);

      renderGuestTable(guestRows);

      if (guestRows.length > 0) {

        selectedGuestId = guestRows[0].id;

        await selectGuest(selectedGuestId, { preferCache: true, forceReload: true });

      } else {

        selectedGuestId = null;

        renderGuestDetail(null);

      }

      return null;

    }



    console.error('[admin] loadGuestDetail failed', error);

    if (requestId === guestDetailRequestToken) {

      setFeedback(

        guestDetailStatus,

        'error',

        error?.message || 'Unable to load guest profile.'

      );

    }

    return null;

  }

}



function renderGuestDetail(guest) {

  if (!guestDetailCard) {

    return;

  }



  if (!guest) {

    if (guestDetailName) {

      guestDetailName.textContent = 'Select a guest';

    }

    if (guestDetailSubtitle) {

      guestDetailSubtitle.textContent =

        'Choose a guest to review their profile and booking history.';

      guestDetailSubtitle.classList.add('text-muted');

    }

    setDetailValue(guestDetailEmail, null, '-');

    setDetailValue(guestDetailPhone, null, '-');

    setDetailValue(guestDetailVip, null, 'Standard');

    setDetailValue(guestDetailMarketing, null, 'No');

    setDetailValue(guestDetailPreferredRoom, null, 'Not specified');

    setDetailValue(guestDetailLastRoom, null, 'Not recorded');


    setDetailValue(guestDetailLifetime, null, formatCurrency(0));

    setDetailValue(guestDetailTotals, null, '0 stays - 0 nights');

    setDetailValue(guestDetailNextStay, null, 'No upcoming stay');

    updateGuestDetailCopy(guestDetailNotes, '', 'No notes on file.');

    updateGuestDetailCopy(guestDetailPreferences, '', 'No preferences recorded.');

    renderGuestHistoryList(guestUpcomingList, [], 'No upcoming stays.');

    renderGuestHistoryList(guestHistoryList, [], 'No booking history yet.');

    setFeedback(guestDetailStatus, '', '');

    return;

  }



  if (guestDetailName) {

    guestDetailName.textContent = guest.fullName || 'Guest';

  }

  if (guestDetailSubtitle) {

    const updatedAt = guest.updatedAt || guest.createdAt;

    guestDetailSubtitle.textContent = updatedAt

      ? `Profile updated ${formatDateTime(updatedAt)}`

      : 'Profile details from current records.';

    guestDetailSubtitle.classList.remove('text-muted');

  }



  setDetailValue(guestDetailEmail, guest.email, '-');

  setDetailValue(guestDetailPhone, guest.phone, '-');

  setDetailValue(guestDetailVip, guest.vipStatus, 'Standard');

  setDetailValue(guestDetailMarketing, guest.marketingOptIn ? 'Yes' : 'No', 'No');

  setDetailValue(guestDetailPreferredRoom, guest.preferredRoomType, 'Not specified');

  setDetailValue(

    guestDetailLastRoom,

    guest.lastRoomType || guest.preferredRoomType,

    'Not recorded'

  );

  const totalStays = Number(guest.totalStays ?? 0);

  const totalNights = Number(guest.totalNights ?? 0);



  const totalsLabel = `${totalStays} stay${totalStays === 1 ? '' : 's'} - ${totalNights} night${totalNights === 1 ? '' : 's'}`;


  setDetailValue(guestDetailLifetime, formatCurrency(guest.lifetimeValue || 0), formatCurrency(0));

  setDetailValue(guestDetailTotals, totalsLabel, '0 stays - 0 nights');

  setDetailValue(
    guestDetailLastStay,
    guest.lastStayAt ? formatDate(guest.lastStayAt) : null,
    'No stays yet'
  );

  setDetailValue(

    guestDetailNextStay,

    guest.nextStayAt ? formatDate(guest.nextStayAt) : null,

    'No upcoming stay'

  );

  updateGuestDetailCopy(guestDetailNotes, guest.notes, 'No notes on file.');

  updateGuestDetailCopy(

    guestDetailPreferences,

    formatGuestPreferences(guest.preferences),

    'No preferences recorded.'

  );

  renderGuestHistoryList(guestUpcomingList, guest.upcomingBookings || [], 'No upcoming stays.', {

    limit: 5,

    upcoming: true,

  });

  renderGuestHistoryList(guestHistoryList, guest.history || [], 'No booking history yet.', {

    limit: 10,

  });

}



function renderGuestHistoryList(container, bookings, emptyMessage, options = {}) {

  if (!container) {

    return;

  }



  if (!Array.isArray(bookings) || bookings.length === 0) {

    container.innerHTML = `<li class="text-muted">${escapeHtml(emptyMessage)}</li>`;

    return;

  }



  const limit =

    Number.isInteger(options.limit) && options.limit > 0 ? options.limit : bookings.length;

  const items = bookings

    .slice(0, limit)

    .map((booking) => createGuestHistoryItem(booking, options))

    .join('');



  container.innerHTML = items;

}



function createGuestHistoryItem(booking, options = {}) {

  if (!booking) {

    return '';

  }



  const stayRange = formatStayRange(booking.checkIn, booking.checkOut);

  const nights = Number(booking.nights ?? 0);

  const nightsLabel = nights > 0 ? `${nights} night${nights === 1 ? '' : 's'}` : '';

  const guestsLabel =

    booking.guests != null ? `${booking.guests} guest${booking.guests === 1 ? '' : 's'}` : '';

  const statusLabel = options.upcoming

    ? 'Upcoming'

    : formatStatusLabel(booking.status || 'unknown');

  const paymentLabel = formatCurrency(booking.paymentAmount || 0);

  const roomLabel = booking.roomType ? `Room: ${booking.roomType}` : '';

  const referenceLabel = booking.paymentReference ? `Ref ${booking.paymentReference}` : '';

  const sourceLabel = booking.source ? `Source: ${humanizeLabel(booking.source)}` : '';



  const firstRowParts = [statusLabel, nightsLabel, guestsLabel].filter(Boolean);

  const secondRowParts = [roomLabel, paymentLabel, referenceLabel, sourceLabel].filter(Boolean);



  const firstRow =

    firstRowParts.length > 0

      ? `<div class="guest-history-meta">${firstRowParts

          .map((part) => `<span>${escapeHtml(part)}</span>`)

          .join('')}</div>`

      : '';

  const secondRow =

    secondRowParts.length > 0

      ? `<div class="guest-history-meta">${secondRowParts

          .map((part) => `<span>${escapeHtml(part)}</span>`)

          .join('')}</div>`

      : '';



  return `

    <li class="guest-history-item">

      <strong>${escapeHtml(stayRange)}</strong>

      ${firstRow}

      ${secondRow}

    </li>

  `;

}



function formatGuestPreferences(preferences) {

  if (preferences == null || preferences === '') {

    return '';

  }

  if (Array.isArray(preferences)) {

    const parts = preferences

      .map((item) => String(item || '').trim())

      .filter(Boolean);

    return parts.join(', ');

  }

  if (typeof preferences === 'object') {

    const entries = Object.entries(preferences)

      .map(([key, value]) => {

        if (value == null || value === '') {

          return '';

        }

        const normalized =

          Array.isArray(value)

            ? value.map((item) => String(item || '').trim()).filter(Boolean).join(', ')

            : String(value).trim();

        if (!normalized) {

          return '';

        }

        return `${humanizeLabel(key)}: ${normalized}`;

      })

      .filter(Boolean);

    return entries.join('; ');

  }

  return String(preferences);

}



function humanizeLabel(value) {

  if (value == null) {

    return '';

  }

  return String(value)

    .replace(/[_-]+/g, ' ')

    .replace(/\s+/g, ' ')

    .trim()

    .replace(/\b\w/g, (char) => char.toUpperCase());

}



function formatStatusLabel(value) {

  if (!value) {

    return 'Unknown';

  }

  return humanizeLabel(value);

}



function formatStayRange(checkIn, checkOut) {

  const start = formatDate(checkIn);

  const end = formatDate(checkOut);

  if (start === '-' && end === '-') {

    return 'No stay dates';

  }

  if (start === '-') {

    return end;

  }

  if (end === '-') {

    return start;

  }

  return `${start} - ${end}`;

}



function updateGuestDetailCopy(element, value, fallback) {

  if (!element) {

    return;

  }

  const hasValue = value != null && String(value).trim() !== '';

  element.textContent = hasValue ? String(value) : fallback;

  element.classList.toggle('text-muted', !hasValue);

}



function setDetailValue(element, value, fallback = '-') {

  if (!element) {

    return;

  }

  const hasValue = value != null && String(value).trim() !== '';

  element.textContent = hasValue ? String(value) : fallback;

}



function renderBookings(bookings) {
  if (!bookingsTableBody) {
    return;
  }

  if (!Array.isArray(bookings) || bookings.length === 0) {
    bookingsTableBody.innerHTML =
      '<tr><td colspan="6" class="text-muted">No reservations found.</td></tr>';
    return;
  }

  const rows = bookings
    .map((booking) => {
      const stayLabel = `${formatDate(booking.checkIn)} - ${formatDate(booking.checkOut)}`;

      const paymentMethod = (booking.paymentMethod || '').trim() || 'Unspecified';
      const paymentReference = (booking.paymentReference || '').trim() || 'No reference';
      const paymentAmount = Number(booking.paymentAmount || 0).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const paymentLabel = `${paymentMethod} | ${paymentReference} | PHP ${paymentAmount}`;

      const contactLines = [
        booking.email ? `<span class="text-muted">${escapeHtml(booking.email)}</span>` : '',
        booking.phone ? `<span class="text-muted">${escapeHtml(booking.phone)}</span>` : '',
      ]
        .filter(Boolean)
        .join('<br />');

      const contactHtml =
        contactLines || '<span class="text-muted">No contact details</span>';

      const statusBadge = `<span class="status-badge" data-status="${escapeHtml(
        booking.status || 'unknown'
      )}">${escapeHtml((booking.status || 'unknown').replace('_', ' '))}</span>`;
      const assignedRoom = booking.roomNumber
        ? `<div class="text-muted">Assigned: ${escapeHtml(booking.roomNumber)}</div>`
        : '<div class="text-muted">No room assigned</div>';

      let actionHtml = '<span class="text-muted">Completed</span>';
      if (booking.status === 'checked_in') {
        actionHtml = `<button type="button" class="secondary-btn" data-checkout-id="${booking.id}">Check out</button>`;
      } else if (booking.status !== 'checked_out') {
        actionHtml = `<button type="button" class="secondary-btn" data-checkin-id="${booking.id}" data-room-code="${escapeHtml(
          booking.roomNumber || ''
        )}">Check in</button>`;
      }

      return `
        <tr>
          <td>
            <strong>${escapeHtml(booking.fullName || 'Guest')}</strong><br />
            ${contactHtml}
          </td>
          <td>${escapeHtml(stayLabel)}</td>
          <td>
            <strong>${escapeHtml(booking.roomType || 'Unassigned')}</strong>
            ${assignedRoom}
          </td>
          <td>${escapeHtml(paymentLabel)}</td>
          <td>${statusBadge}</td>
          <td class="table-actions">${actionHtml}</td>
        </tr>
      `;
    })
    .join('');

  bookingsTableBody.innerHTML = rows;
}



async function loadRoomManagement() {

  if (!roomManagementSection || !roomManagementTableBody) {

    return;

  }



  const role = getRole();

  if (role !== 'staff' && role !== 'owner') {

    roomManagementSection.classList.add('is-hidden');

    return;

  }



  roomManagementSection.classList.remove('is-hidden');

  setFeedback(roomCreateFeedback, '', '');



  try {

    roomManagementTableBody.innerHTML =

      '<tr><td colspan="5" class="text-muted">Loading rooms...</td></tr>'

    const response = await authFetch('/api/room-types');

    if (!response.ok) {

      const data = await response.json().catch(() => ({}));

      throw new Error(data?.message || 'Unable to load room types.');

    }



    const roomTypes = await response.json();

    renderRoomManagement(Array.isArray(roomTypes) ? roomTypes : []);

  } catch (error) {

    roomManagementTableBody.innerHTML =

      '<tr><td colspan="5" class="text-muted">Unable to load rooms right now.</td></tr>';

    console.error(error);

  }

}



function renderRoomManagement(roomTypes) {
  if (!roomManagementTableBody) {
    return;
  }

  if (!Array.isArray(roomTypes) || roomTypes.length === 0) {
    roomManagementTableBody.innerHTML =
      '<tr><td colspan="5" class="text-muted">No room types found. Add your first one above.</td></tr>';
    return;
  }

  const rows = roomTypes
    .map((room) => {
      const name = room.name || 'Unspecified';
      const totalRooms = Number(room.totalRooms ?? 0);
      const sleepsValue = room.sleeps != null ? Number(room.sleeps) : 'Not set';
      const baseRateLabel =
        room.baseRate != null
          ? formatCurrency(room.baseRate).replace(/^PHP\s*/, '')
          : 'N/A';
      const description = room.description
        ? escapeHtml(room.description)
        : 'No description provided';

      return `
        <tr>
          <td>${escapeHtml(name)}</td>
          <td>${totalRooms}</td>
          <td>${escapeHtml(String(sleepsValue))}</td>
          <td>${escapeHtml(baseRateLabel)}</td>
          <td>${description}</td>
        </tr>
      `;
    })
    .join('');

  roomManagementTableBody.innerHTML = rows;
}



function handleOrderFilterChange() {

  orderFilters.status = orderStatusFilter?.value || 'active';

  orderFilters.department = orderDepartmentFilter?.value || '';

  loadOrders().catch((error) => {

    if (error?.isAuthError) {

      return;

    }

    console.error('[admin] order filter change failed', error);

    setFeedback(ordersFeedback, 'error', error.message);

  });

}



async function handleOrderTableClick(event) {

  const followUpButton =
    event.target instanceof HTMLElement ? event.target.closest('[data-order-action="follow_up"]') : null;
  if (followUpButton) {
    const followUpOrderId = Number.parseInt(followUpButton.dataset.orderId ?? '', 10);
    if (Number.isNaN(followUpOrderId)) {
      return;
    }
    followUpButton.disabled = true;
    try {
      await triggerOrderFollowUp(followUpOrderId);
    } catch (error) {
      if (!error?.isAuthError) {
        console.error('[admin] failed to trigger follow-up', error);
      }
    } finally {
      followUpButton.disabled = false;
    }
    return;
  }

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

  try {

    await updateOrderStatus(orderId, nextStatus);

  } catch (error) {

    if (!error?.isAuthError) {

      console.error('[admin] failed to update order status', error);

    }

  } finally {

    button.disabled = false;

  }

}



async function loadOrders() {

  if (!orderSection || !orderTableBody) {

    return;

  }



  const role = getRole();
  const isServiceTeam = SERVICE_TEAM_ROLES.has(role);
  const isRestaurantRole = role === 'restaurant';
  if (role !== 'staff' && role !== 'owner' && !isServiceTeam && !isRestaurantRole) {
    orderSection.classList.add('is-hidden');
    return;
  }

  if (isServiceTeam) {
    const department = SERVICE_DEPARTMENT_BY_ROLE[role] || '';
    if (department) {
      orderFilters.department = department;
      if (orderDepartmentFilter) {
        orderDepartmentFilter.value = department;
      }
    }
  } else if (isRestaurantRole) {
    orderFilters.department = 'restaurant';
    if (orderDepartmentFilter) {
      orderDepartmentFilter.value = 'restaurant';
    }
  }

  if (orderDepartmentFilter) {
    orderDepartmentFilter.disabled = isServiceTeam || isRestaurantRole;
  }

  orderSection.classList.remove('is-hidden');


  if (orderTableBody.innerHTML.trim() === '' || orderTableBody.children.length === 0) {

    orderTableBody.innerHTML =

      '<tr><td colspan="5" class="text-muted">Loading service requests...</td></tr>';

  }



  try {

    const params = new URLSearchParams();

    params.set('limit', '100');

    if (orderFilters.status && orderFilters.status !== 'active' && orderFilters.status !== 'all') {

      params.set('status', orderFilters.status);

    }

    if (orderFilters.department) {

      params.set('department', orderFilters.department);

    }



    const queryString = params.toString();

    const response = await authFetch(queryString ? `/api/orders?${queryString}` : '/api/orders');

    if (!response.ok) {

      if (response.status === 401) {

        clearAuth();

        showLogin();

        const authError = new Error('Session expired. Please sign in again.');

        authError.isAuthError = true;

        setFeedback(ordersFeedback, 'error', authError.message);

        throw authError;

      }

      const data = await response.json().catch(() => ({}));

      throw new Error(data?.message || 'Unable to load service orders.');

    }



    const orders = await response.json().catch(() => []);

    currentOrders = Array.isArray(orders) ? orders : [];



    const visibleOrders = applyOrderFilters(currentOrders);

    renderOrders(visibleOrders);



    if (visibleOrders.length === 0) {

      const message =

        orderFilters.status === 'active'

          ? 'No active service requests at the moment.'

          : 'No service requests match the selected filters.';

      setFeedback(ordersFeedback, 'info', message);

    } else {

      setFeedback(ordersFeedback, '', '');

    }

  } catch (error) {

    if (error?.isAuthError) {

      throw error;

    }

    setFeedback(

      ordersFeedback,

      'error',

      error?.message || 'Unable to load service orders right now.'

    );

    throw error;

  }

}



async function updateOrderStatus(orderId, status) {

  try {

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

        setFeedback(ordersFeedback, 'error', authError.message);

        throw authError;

      }

      const data = await response.json().catch(() => ({}));

      throw new Error(data?.message || 'Unable to update the service order.');

    }



    const updatedOrder = await response.json();

    if (updatedOrder && typeof updatedOrder === 'object') {

      const index = currentOrders.findIndex((order) => order.id === updatedOrder.id);

      if (index > -1) {

        currentOrders[index] = updatedOrder;

      } else {

        currentOrders.unshift(updatedOrder);

      }

      const visibleOrders = applyOrderFilters(currentOrders);

      renderOrders(visibleOrders);

      setFeedback(

        ordersFeedback,

        'success',

        `Order ${updatedOrder.orderCode || String(orderId)} marked ${humanizeLabel(

          updatedOrder.status

        )}.`

      );

    } else {

      await loadOrders();

    }

  } catch (error) {

    if (error?.isAuthError) {

      throw error;

    }

    setFeedback(

      ordersFeedback,

      'error',

      error?.message || 'Unable to update the service order right now.'

    );

    throw error;

  }

}

async function triggerOrderFollowUp(orderId) {
  try {
    const response = await authFetch(`/api/orders/${orderId}/follow-up`, {
      method: 'POST',
    });

    if (!response.ok) {
      if (response.status === 401) {
        clearAuth();
        showLogin();
        const authError = new Error('Session expired. Please sign in again.');
        authError.isAuthError = true;
        setFeedback(ordersFeedback, 'error', authError.message);
        throw authError;
      }
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Unable to send the follow-up alert.');
    }

    const data = await response.json().catch(() => ({}));
    setFeedback(ordersFeedback, 'success', data?.message || 'Service team alerted.');
  } catch (error) {
    if (error?.isAuthError) {
      throw error;
    }
    setFeedback(ordersFeedback, 'error', error?.message || 'Unable to send the follow-up alert.');
    throw error;
  }
}



async function loadServiceTasks() {
  if (!serviceSection || !serviceTableBody) {
    return;
  }

  const role = getRole();
  if (role !== 'staff' && role !== 'owner') {
    serviceSection.classList.add('is-hidden');
    return;
  }

  serviceSection.classList.remove('is-hidden');

  if (serviceTableBody.innerHTML.trim() === '') {
    serviceTableBody.innerHTML =
      '<tr><td colspan="4" class="text-muted">Loading room service tasks...</td></tr>';
  }

  try {
    setFeedback(serviceFeedback, 'info', 'Loading tasks...');
    const params = new URLSearchParams();
    params.set('limit', '200');
    if (serviceFilters.type && serviceFilters.type !== 'all') {
      params.set('type', serviceFilters.type);
    }
    if (serviceFilters.status && serviceFilters.status !== 'all') {
      params.set('status', serviceFilters.status);
    }
    if (serviceFilters.readiness && serviceFilters.readiness !== 'all') {
      params.set('readiness', serviceFilters.readiness);
    }

    const queryString = params.toString();
    const [tasksResponse, summaryResponse] = await Promise.all([
      authFetch(queryString ? `/api/rooms/service-tasks?${queryString}` : '/api/rooms/service-tasks'),
      authFetch(
        queryString
          ? `/api/rooms/service-tasks/summary?${queryString}`
          : '/api/rooms/service-tasks/summary'
      ),
    ]);

    const processResponse = async (response, defaultMessage) => {
      if (response.ok) {
        return response;
      }
      if (response.status === 401) {
        clearAuth();
        showLogin();
        const authError = new Error('Session expired. Please sign in again.');
        authError.isAuthError = true;
        setFeedback(serviceFeedback, 'error', authError.message);
        throw authError;
      }
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || defaultMessage);
    };

    const checkedTasksResponse = await processResponse(
      tasksResponse,
      'Unable to load service tasks.'
    );
    const checkedSummaryResponse = await processResponse(
      summaryResponse,
      'Unable to load task summary.'
    );

    const tasksPayload = await checkedTasksResponse.json().catch(() => []);
    const summaryPayload = await checkedSummaryResponse.json().catch(() => ({}));

    serviceTasks = Array.isArray(tasksPayload) ? tasksPayload : [];
    renderServiceTasks(serviceTasks);

    serviceSummary =
      summaryPayload && typeof summaryPayload === 'object'
        ? summaryPayload
        : { status: {}, readiness: {} };
    renderServiceSummary(serviceSummary);

    if (serviceTasks.length === 0) {
      const emptyMessage =
        serviceFilters.status === 'active'
          ? 'All rooms are accounted for - no active housekeeping or maintenance tasks.'
          : 'No tasks match the selected filters.';
      setFeedback(serviceFeedback, 'info', emptyMessage);
    } else {
      setFeedback(serviceFeedback, '', '');
    }
  } catch (error) {
    if (error?.isAuthError) {
      throw error;
    }
    console.error('Failed to load service tasks', error);
    setFeedback(
      serviceFeedback,
      'error',
      error?.message || 'Unable to load service tasks right now.'
    );
    serviceTasks = [];
    renderServiceTasks(serviceTasks);
    resetServiceSummary();
  }
}

function handleServiceFilterChange() {
  if (serviceFilterType) {
    serviceFilters.type = serviceFilterType.value || 'all';
  }
  if (serviceFilterStatus) {
    serviceFilters.status = serviceFilterStatus.value || 'active';
  }
  if (serviceFilterReadiness) {
    serviceFilters.readiness = serviceFilterReadiness.value || 'all';
  }
  loadServiceTasks().catch((error) => {
    if (error?.isAuthError) {
      return;
    }
  });
}

function handleServiceRefreshClick() {
  loadServiceTasks().catch((error) => {
    if (error?.isAuthError) {
      return;
    }
  });
}

function toggleServiceCreateForm(forceOpen) {
  if (!serviceCreateForm || !serviceCreateToggle) {
    return;
  }
  const shouldOpen =
    typeof forceOpen === 'boolean'
      ? forceOpen
      : serviceCreateForm.classList.contains('is-hidden');

  if (shouldOpen) {
    serviceCreateForm.classList.remove('is-hidden');
    serviceCreateToggle.textContent = 'Hide form';
    serviceCreateToggle.setAttribute('aria-expanded', 'true');
    resetServiceCreateForm();
  } else {
    serviceCreateForm.classList.add('is-hidden');
    serviceCreateToggle.textContent = 'New task';
    serviceCreateToggle.setAttribute('aria-expanded', 'false');
    setFeedback(serviceCreateFeedback, '', '');
  }
}

function resetServiceCreateForm() {
  if (!serviceCreateForm) {
    return;
  }
  if (serviceCreateForm.reset) {
    serviceCreateForm.reset();
  }
  if (serviceRoomInput) {
    serviceRoomInput.value = '';
  }
  if (serviceTypeInput) {
    const preferredType =
      serviceFilters.type && serviceFilters.type !== 'all' ? serviceFilters.type : 'housekeeping';
    serviceTypeInput.value = SERVICE_TASK_TYPES.has(preferredType) ? preferredType : 'housekeeping';
  }
  if (servicePriorityInput) {
    servicePriorityInput.value = 'normal';
  }
  if (serviceReadinessInput) {
    serviceReadinessInput.value = '';
  }
  if (serviceScheduledInput) {
    serviceScheduledInput.value = '';
  }
  if (serviceAssignedInput) {
    serviceAssignedInput.value = '';
  }
  if (serviceTitleInput) {
    serviceTitleInput.value = '';
  }
  if (serviceDetailsInput) {
    serviceDetailsInput.value = '';
  }
  setFeedback(serviceCreateFeedback, '', '');
}

async function handleServiceCreateSubmit(event) {
  event.preventDefault();
  if (!serviceCreateForm) {
    return;
  }
  setFeedback(serviceCreateFeedback, '', '');

  const roomNumber = serviceRoomInput?.value?.trim() || '';
  if (!roomNumber) {
    setFeedback(serviceCreateFeedback, 'error', 'Enter the room number.');
    serviceRoomInput?.focus();
    return;
  }

  const taskTypeValue = serviceTypeInput?.value || 'housekeeping';
  if (!SERVICE_TASK_TYPES.has(taskTypeValue)) {
    setFeedback(serviceCreateFeedback, 'error', 'Select a valid task type.');
    serviceTypeInput?.focus();
    return;
  }

  const titleValue = serviceTitleInput?.value?.trim() || '';
  if (!titleValue) {
    setFeedback(serviceCreateFeedback, 'error', 'Add a short title for the task.');
    serviceTitleInput?.focus();
    return;
  }

  const payload = {
    roomNumber,
    taskType: taskTypeValue,
    title: titleValue,
    details: serviceDetailsInput?.value?.trim() || null,
    priority: servicePriorityInput?.value || 'normal',
    readiness: serviceReadinessInput?.value || null,
    scheduledFor: serviceScheduledInput?.value || null,
    assignedTo: serviceAssignedInput?.value?.trim() || null,
  };

  if (!payload.priority) {
    payload.priority = 'normal';
  }
  if (payload.details === '') {
    payload.details = null;
  }
  if (payload.readiness === '') {
    payload.readiness = null;
  }
  if (payload.scheduledFor === '') {
    payload.scheduledFor = null;
  }
  if (payload.assignedTo === '') {
    payload.assignedTo = null;
  }

  setFeedback(serviceCreateFeedback, 'info', 'Saving task...');
  const submitBtn = serviceCreateForm.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
  }

  try {
    const response = await authFetch('/api/rooms/service-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      if (response.status === 401) {
        clearAuth();
        showLogin();
        const authError = new Error('Session expired. Please sign in again.');
        authError.isAuthError = true;
        setFeedback(serviceCreateFeedback, 'error', authError.message);
        return;
      }
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Unable to create the task.');
    }

    await response.json().catch(() => ({}));
    setFeedback(serviceCreateFeedback, '', '');
    toggleServiceCreateForm(false);
    await loadServiceTasks();
    setFeedback(serviceFeedback, 'success', `Task created for room ${roomNumber}.`);
  } catch (error) {
    if (error?.isAuthError) {
      return;
    }
    console.error('Failed to create service task', error);
    setFeedback(
      serviceCreateFeedback,
      'error',
      error?.message || 'Unable to create the task right now.'
    );
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
    }
  }
}

function handleServiceTableClick(event) {
  const button = event.target.closest('button[data-action="update-task"]');
  if (!button) {
    return;
  }
  const row = button.closest('tr[data-task-id]');
  if (!row) {
    return;
  }
  const taskId = Number.parseInt(row.dataset.taskId, 10);
  if (!Number.isFinite(taskId)) {
    return;
  }
  const task = serviceTasks.find((item) => item && item.id === taskId);
  if (!task) {
    setFeedback(serviceFeedback, 'error', 'Unable to locate task details.');
    return;
  }
  submitServiceTaskUpdate(task, row, button);
}

async function submitServiceTaskUpdate(task, row, button) {
  const payload = gatherServiceTaskPayload(row, task);
  if (Object.keys(payload).length === 0) {
    setFeedback(serviceFeedback, 'info', 'No changes to apply.');
    return;
  }

  if (button) {
    button.disabled = true;
  }
  setFeedback(serviceFeedback, 'info', 'Updating task...');

  try {
    const response = await authFetch(`/api/rooms/service-tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      if (response.status === 401) {
        clearAuth();
        showLogin();
        const authError = new Error('Session expired. Please sign in again.');
        authError.isAuthError = true;
        setFeedback(serviceFeedback, 'error', authError.message);
        return;
      }
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Unable to update the task.');
    }

    await response.json().catch(() => ({}));
    await loadServiceTasks();
    setFeedback(serviceFeedback, 'success', 'Task updated.');
  } catch (error) {
    if (error?.isAuthError) {
      return;
    }
    console.error('Failed to update service task', error);
    setFeedback(
      serviceFeedback,
      'error',
      error?.message || 'Unable to update the task right now.'
    );
  } finally {
    if (button) {
      button.disabled = false;
    }
  }
}

function gatherServiceTaskPayload(row, task) {
  const payload = {};
  if (!row || !task) {
    return payload;
  }

  const statusSelect = row.querySelector('select[data-field="status"]');
  if (statusSelect) {
    const value = statusSelect.value;
    if (value && value !== task.status) {
      payload.status = value;
    }
  }

  const readinessSelect = row.querySelector('select[data-field="readiness"]');
  if (readinessSelect) {
    const value = readinessSelect.value;
    const current = task.readiness || '';
    if (value !== current) {
      payload.readiness = value || null;
    }
  }

  const prioritySelect = row.querySelector('select[data-field="priority"]');
  if (prioritySelect) {
    const value = prioritySelect.value;
    const current = task.priority || 'normal';
    if (value && value !== current) {
      payload.priority = value;
    }
  }

  const assignedInput = row.querySelector('input[data-field="assignedTo"]');
  if (assignedInput) {
    const value = assignedInput.value.trim();
    const current = task.assignedTo || '';
    if (value !== current) {
      payload.assignedTo = value || null;
    }
  }

  const scheduledInput = row.querySelector('input[data-field="scheduledFor"]');
  if (scheduledInput) {
    const value = scheduledInput.value;
    const current = toDateTimeInputValue(task.scheduledFor) || '';
    if ((value || '') !== current) {
      payload.scheduledFor = value || null;
    }
  }

  return payload;
}

function renderServiceTasks(tasks) {
  if (!serviceTableBody) {
    return;
  }
  if (!Array.isArray(tasks) || tasks.length === 0) {
    serviceTableBody.innerHTML =
      '<tr><td colspan="4" class="text-muted">No tasks match the selected filters.</td></tr>';
    return;
  }
  const rows = tasks.map((task) => renderServiceTaskRow(task)).join('');
  serviceTableBody.innerHTML = rows;
}

function renderServiceTaskRow(task) {
  const rowClass = [
    'service-row',
    task.status ? `service-row--${task.status}` : '',
    task.readiness ? `service-row--readiness-${task.readiness}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const statusOptionsHtml = SERVICE_STATUS_OPTIONS.map(
    (option) =>
      `<option value="${option.value}"${option.value === task.status ? ' selected' : ''}>${escapeHtml(
        option.label
      )}</option>`
  ).join('');
  const readinessOptionsHtml = SERVICE_READINESS_OPTIONS.map(
    (option) =>
      `<option value="${option.value}"${
        (option.value || '') === (task.readiness || '') ? ' selected' : ''
      }>${escapeHtml(option.label)}</option>`
  ).join('');
  const priorityOptionsHtml = SERVICE_PRIORITY_OPTIONS.map(
    (option) =>
      `<option value="${option.value}"${
        option.value === (task.priority || 'normal') ? ' selected' : ''
      }>${escapeHtml(option.label)}</option>`
  ).join('');

  const readinessPill =
    task.readiness && SERVICE_READINESS_LABELS[task.readiness]
      ? `<span class="service-pill service-pill--readiness">${escapeHtml(
          SERVICE_READINESS_LABELS[task.readiness]
        )}</span>`
      : '';

  return `
    <tr class="${rowClass}" data-task-id="${task.id}">
      <td>
        <div class="service-room">${escapeHtml(task.roomNumber || 'Unassigned')}</div>
        <div class="service-pill-row">
          <span class="service-pill service-pill--type">${escapeHtml(
            formatServiceTaskType(task.taskType)
          )}</span>
          <span class="service-pill service-pill--priority-${escapeHtml(
            task.priority || 'normal'
          )}">${escapeHtml(formatServicePriority(task.priority))}</span>
          ${readinessPill}
        </div>
      </td>
      <td>
        <div class="service-task-title">${escapeHtml(task.title)}</div>
        <p class="service-task-notes">
          ${
            task.details
              ? escapeHtml(task.details)
              : '<span class="text-muted">No additional notes.</span>'
          }
        </p>
        <ul class="service-task-meta">
          <li>
            <span class="service-task-meta__label">Scheduled</span>
            <span>${escapeHtml(formatDateTime(task.scheduledFor))}</span>
          </li>
          <li>
            <span class="service-task-meta__label">Updated</span>
            <span>${escapeHtml(formatDateTime(task.updatedAt))}</span>
          </li>
          <li>
            <span class="service-task-meta__label">Reported by</span>
            <span>${escapeHtml(task.reportedBy || 'Unknown')}</span>
          </li>
          <li>
            <span class="service-task-meta__label">Last updated by</span>
            <span>${escapeHtml(task.lastUpdatedBy || 'Unknown')}</span>
          </li>
        </ul>
      </td>
      <td>
        <label class="service-field">
          <span>Assigned to</span>
          <input
            type="text"
            data-field="assignedTo"
            value="${escapeHtml(task.assignedTo || '')}"
            maxlength="120"
            placeholder="Team member"
          />
        </label>
        <label class="service-field">
          <span>Scheduled for</span>
          <input
            type="datetime-local"
            data-field="scheduledFor"
            value="${escapeHtml(toDateTimeInputValue(task.scheduledFor) || '')}"
          />
        </label>
      </td>
      <td class="service-actions">
        <label class="service-field">
          <span>Status</span>
          <select data-field="status">
            ${statusOptionsHtml}
          </select>
        </label>
        <label class="service-field">
          <span>Readiness</span>
          <select data-field="readiness">
            ${readinessOptionsHtml}
          </select>
        </label>
        <label class="service-field">
          <span>Priority</span>
          <select data-field="priority">
            ${priorityOptionsHtml}
          </select>
        </label>
        <button type="button" class="secondary-btn service-save-btn" data-action="update-task">
          Save
        </button>
      </td>
    </tr>
  `;
}

function renderServiceSummary(summary) {
  if (!summary) {
    resetServiceSummary();
    return;
  }
  const statusCounts = summary.status || {};
  const readinessCounts = summary.readiness || {};
  updateServiceStat(serviceStatScheduled, statusCounts.scheduled || 0);
  updateServiceStat(serviceStatProgress, statusCounts.in_progress || 0);
  updateServiceStat(serviceStatReady, readinessCounts.ready || 0);
  updateServiceStat(serviceStatOut, readinessCounts.out_of_service || 0);
}

function resetServiceSummary() {
  updateServiceStat(serviceStatScheduled, 0);
  updateServiceStat(serviceStatProgress, 0);
  updateServiceStat(serviceStatReady, 0);
  updateServiceStat(serviceStatOut, 0);
}

function updateServiceStat(element, value) {
  if (!element) {
    return;
  }
  element.textContent = String(value ?? 0);
}

function formatServiceTaskType(value) {
  if (!value) {
    return 'Task';
  }
  return SERVICE_TYPE_LABELS[value] || humanizeLabel(value);
}

function formatServicePriority(value) {
  const normalized = value && SERVICE_PRIORITY_LABELS[value] ? value : 'normal';
  return SERVICE_PRIORITY_LABELS[normalized] || humanizeLabel(normalized);
}

function formatServiceReadiness(value) {
  if (!value) {
    return 'Not set';
  }
  return SERVICE_READINESS_LABELS[value] || humanizeLabel(value);
}

function toDateTimeInputValue(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function applyOrderFilters(orders) {
  if (!Array.isArray(orders)) {
    return [];
  }
  return orders.filter((order) => {
    if (!order) {
      return false;
    }
    if (orderFilters.status === 'active') {
      if (ORDER_FINAL_STATUSES.has(order.status)) {
        return false;
      }
    } else if (orderFilters.status !== 'all' && order.status !== orderFilters.status) {
      return false;
    }
    if (orderFilters.department && order.targetDepartment !== orderFilters.department) {
      return false;
    }
    return true;
  });
}



function renderOrders(orders) {

  if (!orderTableBody) {

    return;

  }



  if (!Array.isArray(orders) || orders.length === 0) {

    orderTableBody.innerHTML =

      '<tr><td colspan="5" class="text-muted">No service requests to display.</td></tr>';

    return;

  }



  const rows = orders.map((order) => renderOrderRow(order)).join('');

  orderTableBody.innerHTML = rows;

}



function renderOrderRow(order) {
  const createdAtLabel = formatDateTime(order.createdAt);
  const requestedLabel = order.requestedFor ? formatDateTime(order.requestedFor) : null;

  let itemsHtml = '';
  if (Array.isArray(order.items) && order.items.length > 0) {
    itemsHtml = `<ul class="order-items-list">${order.items
      .map((item) => {
        const quantityLabel = item.quantity > 1 ? `${item.quantity} \u00D7 ` : '';
        const nameLabel = escapeHtml(item.name || 'Item');
        const notesLabel = item.notes ? ` <span class="text-muted">${escapeHtml(item.notes)}</span>` : '';
        return `<li>${quantityLabel}${nameLabel}${notesLabel}</li>`;
      })
      .join('')}</ul>`;
  } else if (order.itemsSummary) {
    itemsHtml = `<span class="text-muted">${escapeHtml(order.itemsSummary)}</span>`;
  } else {
    itemsHtml = '<span class="text-muted">No items listed.</span>';
  }

  const notesHtml = order.specialInstructions
    ? `<p class="order-notes">${escapeHtml(order.specialInstructions)}</p>`
    : '';

  const requestedMeta = requestedLabel
    ? `<span class="order-meta">Requested for ${requestedLabel}</span>`
    : '';

  const handledMeta = order.handledBy
    ? `<span class="order-meta">Handler: ${escapeHtml(order.handledBy)}</span>`
    : '';

  const departmentLabel = humanizeLabel(order.targetDepartment);
  const referenceMeta = order.orderCode
    ? `<span class="order-meta">Ref ${escapeHtml(order.orderCode)}</span>`
    : '';
  const totalMeta =
    order.totalAmount != null
      ? `<span class="order-meta">Total: ${formatCurrency(order.totalAmount)}</span>`
      : '';

  return `
    <tr data-order-id="${order.id}">
      <td>
        <strong>${createdAtLabel}</strong>
        ${referenceMeta}
        ${requestedMeta}
      </td>
      <td>
        <strong>${escapeHtml(order.fullName || 'Guest')}</strong>
        <span class="order-meta">${escapeHtml(order.email || '')}</span>
        ${order.phone ? `<span class="order-meta">${escapeHtml(order.phone)}</span>` : ''}
        ${order.roomNumber ? `<span class="order-meta">Room ${escapeHtml(order.roomNumber)}</span>` : ''}
      </td>
      <td>
        ${itemsHtml}
        ${notesHtml}
      </td>
      <td>
        <span class="status-badge" data-status="${escapeHtml(order.status)}">${humanizeLabel(
          order.status
        )}</span>
        <span class="order-meta">${departmentLabel}</span>
        ${handledMeta}
      </td>
      <td>
        <div class="order-actions">
          ${buildOrderActions(order)}
        </div>
      </td>
    </tr>
  `;
}



function buildOrderActions(order) {
  if (!order) {
    return '<span class="text-muted">No actions available</span>';
  }

  if (isServiceTeamDepartment(order.targetDepartment)) {
    return buildServiceFollowUpAction(order);
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
    return '<span class="text-muted">No actions available</span>';
  }

  return actions
    .map((action) => {
      const classes =
        action.variant === 'primary' ? 'primary-btn order-action-btn' : 'secondary-btn order-action-btn';
      return `<button type="button" class="${classes}" data-order-id="${order.id}" data-order-status="${action.status}">${escapeHtml(action.label)}</button>`;
    })
    .join('');
}

function buildServiceFollowUpAction(order) {
  if (!order) {
    return '<span class="text-muted">No actions available</span>';
  }
  if (ORDER_FINAL_STATUSES.has(order.status)) {
    return '<span class="text-muted">Request closed</span>';
  }
  return `<button type="button" class="secondary-btn order-action-btn" data-order-id="${order.id}" data-order-action="follow_up">Follow up</button>`;
}



async function loadBillingSummary() {

  if (!billingSection || !billingTableBody) {

    return;

  }



  const requestId = ++billingRequestToken;

  billingSection.classList.remove('is-hidden');

  billingSummaryById = new Map();

  billingTableBody.innerHTML =

    '<tr><td colspan="4" class="text-muted">Loading billing records...</td></tr>';



  try {

    const response = await authFetch('/api/billing');

    if (!response.ok) {

      if (response.status === 401) {

        clearAuth();

        showLogin();

        const authError = new Error('Session expired. Please sign in again.');

        authError.isAuthError = true;

        throw authError;

      }

      const data = await response.json().catch(() => ({}));

      throw new Error(data?.message || 'Unable to load billing summary.');

    }



    const data = await response.json().catch(() => ({}));

    if (requestId !== billingRequestToken) {

      return;

    }



    if (Array.isArray(data?.paymentOptions) && data.paymentOptions.length > 0) {

      billingPaymentMethods = data.paymentOptions.slice();

    }



    billingSummary = Array.isArray(data?.summary) ? data.summary : [];

    billingTotals = data?.totals || null;

    billingSummaryById = new Map(billingSummary.map((entry) => [entry.bookingId, entry]));



    renderBillingSummary(billingSummary, billingTotals);

    if (billingSummary.length === 0) {

      setFeedback(

        billingFeedback,

        'info',

        'No stays require billing right now. Refresh when guests are ready to check out.'

      );

    } else {

      setFeedback(billingFeedback, '', '');

    }

  } catch (error) {

    if (error?.isAuthError) {

      return;

    }

    if (requestId !== billingRequestToken) {

      return;

    }

    billingTableBody.innerHTML =

      '<tr><td colspan="4" class="text-muted">Unable to load billing records.</td></tr>';

    setFeedback(

      billingFeedback,

      'error',

      error?.message || 'Unable to load billing summary right now.'

    );

  }

}



function renderBillingSummary(summary, totals) {

  if (!billingTableBody) {

    return;

  }



  if (!Array.isArray(summary) || summary.length === 0) {

    billingSummaryById = new Map();

    billingTableBody.innerHTML =

      '<tr><td colspan="4" class="text-muted">No stays require billing right now.</td></tr>';

    return;

  }



  const rows = summary.map((entry) => {

    billingSummaryById.set(entry.bookingId, entry);

    return buildBillingTableRow(entry);

  });



  if (totals) {

    rows.push(buildBillingTotalsRow(totals));

  }



  billingTableBody.innerHTML = rows.join('');

}



function buildBillingTableRow(entry) {

  const guest = entry.guest || {};

  const stayLabel = formatDateRange(entry.checkIn, entry.checkOut);

  const nightsLabel =

    entry.nights === 1 ? '1 night' : `${entry.nights ?? 0} nights`;



  const chargesLines = [

    `${formatCurrency(entry.accommodation?.total || 0)} accommodation (${nightsLabel})`,

  ];

  if (entry.meals?.total) {

    chargesLines.push(`${formatCurrency(entry.meals.total)} meals & refreshments`);

  }

  if (entry.services?.total) {

    chargesLines.push(`${formatCurrency(entry.services.total)} additional services`);

  }



  const serviceOrdersMarkup = createServiceOrdersMarkup(entry.serviceOrders);

  const chargesMarkup = `

    <div class="billing-charges">

      <div><strong>${formatCurrency(entry.totalDue || 0)}</strong> total charges</div>

      <ul class="billing-breakdown-list">

        ${chargesLines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}

      </ul>

      ${serviceOrdersMarkup}

    </div>

  `;



  const payment = entry.payment || {};

  const paymentLines = [];

  paymentLines.push(

    `${formatCurrency(payment.amount || 0)} ${payment.received ? 'received' : 'pending'}`

  );

  if (payment.method) {

    paymentLines.push(`Method: ${payment.method}`);

  }

  if (payment.reference) {

    paymentLines.push(`Reference: ${payment.reference}`);

  }



  const balanceClass =

    entry.balanceDue > 0.01

      ? 'balance-due balance-positive'

      : entry.balanceDue < -0.01

      ? 'balance-due balance-credit'

      : 'balance-due balance-zero';



  return `

    <tr data-booking-id="${entry.bookingId}">

      <td>

        <strong>${escapeHtml(guest.fullName || 'Guest')}</strong>

        ${guest.email ? `<div class="billing-meta">${escapeHtml(guest.email)}</div>` : ''}

        ${guest.phone ? `<div class="billing-meta">${escapeHtml(guest.phone)}</div>` : ''}

        ${entry.roomType ? `<span class="billing-tag">${escapeHtml(entry.roomType)}</span>` : ''}

        ${stayLabel ? `<div class="billing-meta">${escapeHtml(stayLabel)}</div>` : ''}

      </td>

      <td>${chargesMarkup}</td>

      <td>

        <div class="billing-payments">

          ${

            paymentLines.length

              ? paymentLines.map((line) => `<div>${escapeHtml(line)}</div>`).join('')

              : '<div>No payment recorded yet.</div>'

          }

          <div class="${balanceClass}">Balance: ${formatCurrency(entry.balanceDue || 0)}</div>

        </div>

      </td>

      <td>

        <div class="order-actions">

          <button type="button" class="secondary-btn order-action-btn" data-action="record-payment" data-booking-id="${entry.bookingId}">

            Record payment

          </button>

          <button type="button" class="secondary-btn order-action-btn" data-action="print-receipt" data-booking-id="${entry.bookingId}">

            Print receipt

          </button>

        </div>

      </td>

    </tr>

  `;

}



function buildBillingTotalsRow(totals) {

  return `

    <tr class="billing-totals">

      <td colspan="2">

        <strong>Totals</strong>

        <div class="billing-meta">

        <div class="billing-meta">
          Accommodation: ${formatCurrency(totals.accommodation || 0)} | Meals: ${formatCurrency(totals.meals || 0)} | Services: ${formatCurrency(totals.services || 0)}
        </div>
        </div>

      </td>

      <td>

        <div>Payments received: ${formatCurrency(totals.payments || 0)}</div>

        <div>Outstanding balance: ${formatCurrency(totals.balance || 0)}</div>

      </td>

      <td></td>

    </tr>

  `;

}



function createServiceOrdersMarkup(serviceOrders) {
  if (!Array.isArray(serviceOrders) || serviceOrders.length === 0) {
    return '';
  }

  const items = serviceOrders
    .map((order) => {
      const label = `${humanizeLabel(order.orderType)} | ${formatCurrency(order.totalAmount || 0)}`;
      const summary = order.itemsSummary ? ` - ${escapeHtml(order.itemsSummary)}` : '';
      return `<li>${escapeHtml(label)}${summary}</li>`;
    })
    .join('');

  return `
    <details class="billing-services">
      <summary>Service orders (${serviceOrders.length})</summary>
      <ul>${items}</ul>
    </details>
  `;
}



function handleBillingTableClick(event) {

  const button =

    event.target instanceof HTMLElement ? event.target.closest('[data-action]') : null;

  if (!button) {

    return;

  }

  const bookingId = Number.parseInt(button.dataset.bookingId, 10);

  if (Number.isNaN(bookingId)) {

    return;

  }

  const entry = billingSummaryById.get(bookingId);

  if (!entry) {

    return;

  }

  const action = button.dataset.action;

  if (action === 'record-payment') {

    promptPaymentDetails(entry);

  } else if (action === 'print-receipt') {

    openReceiptWindow(entry);

  }

}



async function promptPaymentDetails(entry) {

  const defaultMethod = entry.payment?.method || billingPaymentMethods[0] || 'Cash';

  let method = window.prompt(

    `Payment method (${billingPaymentMethods.join(', ')}):`,

    defaultMethod

  );

  if (method === null) {

    return;

  }

  method = method.trim();

  if (!method) {

    window.alert('Payment method is required.');

    return;

  }



  const suggestedAmount =

    entry.balanceDue && Math.abs(entry.balanceDue) > 0.01 ? entry.balanceDue : entry.totalDue || 0;

  const defaultAmount =

    suggestedAmount > 0 ? suggestedAmount : entry.payment?.amount || suggestedAmount || 0;

  let amountInput = window.prompt('Amount received (PHP):', defaultAmount.toFixed(2));

  if (amountInput === null) {

    return;

  }

  const amount = Number.parseFloat(amountInput);

  if (Number.isNaN(amount) || amount < 0) {

    window.alert('Enter a valid non-negative amount.');

    return;

  }



  let reference = window.prompt('Payment reference (optional):', entry.payment?.reference || '');

  if (reference === null) {

    return;

  }

  reference = reference.trim();



  const payload = {

    paymentMethod: method,

    paymentReference: reference || null,

    paymentAmount: amount,

    paymentReceived: amount > 0 ? true : entry.payment?.received ?? false,

  };



  await recordPayment(entry.bookingId, payload);

}



async function recordPayment(bookingId, payload) {

  try {

    setFeedback(billingFeedback, 'info', 'Updating payment details...');

    const response = await authFetch(`/api/billing/${bookingId}/payment`, {

      method: 'PATCH',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify(payload),

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

      throw new Error(data?.message || 'Unable to update payment details.');

    }



    const data = await response.json().catch(() => ({}));

    setFeedback(billingFeedback, 'success', data?.message || 'Payment details updated.');

    await loadBillingSummary();

  } catch (error) {

    if (error?.isAuthError) {

      return;

    }

    setFeedback(

      billingFeedback,

      'error',

      error?.message || 'Unable to update payment details right now.'

    );

  }

}



function openReceiptWindow(entry) {

  if (!entry) {

    return;

  }

  const receiptWindow = window.open('', '_blank', 'width=720,height=900');

  if (!receiptWindow) {

    setFeedback(

      billingFeedback,

      'error',

      'Unable to open the receipt window. Allow pop-ups to print receipts.'

    );

    return;

  }

  const html = buildReceiptHtml(entry);

  receiptWindow.document.write(html);

  receiptWindow.document.close();

  receiptWindow.focus();

  receiptWindow.print();

}



function buildReceiptHtml(entry) {

  const guest = entry.guest || {};

  const stayLabel = formatDateRange(entry.checkIn, entry.checkOut);

  const charges = [

    { label: 'Accommodation', amount: entry.accommodation?.total || 0 },

    { label: 'Meals & refreshments', amount: entry.meals?.total || 0 },

    { label: 'Additional services', amount: entry.services?.total || 0 },

  ].filter((item) => item.amount && item.amount !== 0);



  const serviceOrders = Array.isArray(entry.serviceOrders) ? entry.serviceOrders : [];

  const serviceItems = serviceOrders
    .map((order) => {
      const label = `${humanizeLabel(order.orderType)} | ${formatCurrency(order.totalAmount || 0)}`;
      const summary = order.itemsSummary ? ` - ${escapeHtml(order.itemsSummary)}` : '';
      return `<li>${escapeHtml(label)}${summary}</li>`;
    })
    .join('');



  return `<!DOCTYPE html>

  <html>

    <head>

      <meta charset="utf-8" />

      <title>Receipt for ${escapeHtml(guest.fullName || 'Guest')}</title>

      <style>

        body { font-family: 'Inter', Arial, sans-serif; margin: 2rem; color: #182029; }

        h1 { margin-bottom: 0.25rem; }

        .subtitle { margin-top: 0; color: #5a6b7c; }

        .section { margin-top: 1.75rem; }

        .charges-table { width: 100%; border-collapse: collapse; margin-top: 1rem; }

        .charges-table th, .charges-table td { padding: 0.5rem 0; text-align: left; border-bottom: 1px solid #d7e0ea; }

        .totals { font-weight: 700; }

        .muted { color: #5a6b7c; font-size: 0.9rem; }

      </style>

    </head>

    <body>

      <header>

        <h1>Harborview Hotel</h1>

        <p class="subtitle">Billing receipt</p>

      </header>

      <section class="section">

        <h2>Guest</h2>

        <p>

          <strong>${escapeHtml(guest.fullName || 'Guest')}</strong><br />

          ${guest.email ? `${escapeHtml(guest.email)}<br />` : ''}

          ${guest.phone ? `${escapeHtml(guest.phone)}<br />` : ''}

          ${stayLabel ? `Stay: ${escapeHtml(stayLabel)}<br />` : ''}

          Room type: ${escapeHtml(entry.roomType || 'Unspecified')}

        </p>

      </section>

      <section class="section">

        <h2>Charges</h2>

        <table class="charges-table">

          <thead>

            <tr>

              <th>Description</th>

              <th>Amount (PHP)</th>

            </tr>

          </thead>

          <tbody>

            ${charges

              .map(

                (charge) => `

              <tr>

                <td>${escapeHtml(charge.label)}</td>

                <td>${formatCurrency(charge.amount)}</td>

              </tr>`

              )

              .join('')}

            <tr class="totals">

              <td>Total charges</td>

              <td>${formatCurrency(entry.totalDue || 0)}</td>

            </tr>

            <tr>

              <td>Payments received</td>

              <td>${formatCurrency(entry.payment?.amount || 0)}</td>

            </tr>

            <tr class="totals">

              <td>Balance due</td>

              <td>${formatCurrency(entry.balanceDue || 0)}</td>

            </tr>

          </tbody>

        </table>

        ${

          serviceItems

            ? `<p class="muted">Service orders:</p><ul class="muted">${serviceItems}</ul>`

            : ''

        }

      </section>

      <section class="section">

        <h2>Notes</h2>

        <p class="muted">

          ${escapeHtml(entry.specialRequests || 'No special requests recorded.')}

        </p>

      </section>

      <footer class="section muted">

        Generated ${formatDateTime(new Date().toISOString())}

      </footer>

    </body>

  </html>`;

}



function formatDateRange(checkIn, checkOut) {

  const start = formatDate(checkIn);

  const end = formatDate(checkOut);

  if (start && end) {

    return `${start} to ${end}`;

  }

  return start || end || '';

}



function showLogin() {

  loginPanel?.classList.remove('is-hidden');

  dashboard?.classList.add('is-hidden');

  setFeedback(loginFeedback, '', '');

}



function showDashboard(role = getRole(), username = getUsername()) {

  loginPanel?.classList.add('is-hidden');

  dashboard?.classList.remove('is-hidden');



  updateRoomManagementVisibility();

  applyRoleLayout(role);



  if (dashboardHeading) {

    let heading = 'Staff Dashboard';

    if (role === 'owner') {
      heading = 'Owner Dashboard';
    } else if (role === 'cashier') {
      heading = 'Cashier Dashboard';
    } else if (role === 'restaurant') {
      heading = 'Restaurant Dashboard';
    } else if (SERVICE_TEAM_ROLES.has(role)) {
      heading = 'Service Dashboard';
    }
    dashboardHeading.textContent = heading;

  }

  if (dashboardSubtitle) {

    let subtitle =

      'Review reservations, capture walk-in bookings, and keep departures on schedule.';

    if (role === 'owner') {
      subtitle = 'Monitor performance metrics, upcoming stays, and reservation activity.';
    } else if (role === 'cashier') {
      subtitle = 'Generate billing breakdowns, record payments, and issue guest receipts.';
    } else if (role === 'restaurant') {
      subtitle = 'Track dining orders, update their status, and coordinate with the kitchen.';
    } else if (SERVICE_TEAM_ROLES.has(role)) {
      subtitle = 'Track room readiness, respond to maintenance calls, and close service tickets.';
    }
    dashboardSubtitle.textContent = subtitle;

  }

  if (welcomeName) {

    welcomeName.textContent = username || 'team member';

  }

  if (roleBadge) {
    roleBadge.textContent = role ? humanizeLabel(role) : '';
  }
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

  return localStorage.getItem(USERNAME_KEY);

}



async function authFetch(url, options = {}) {

  const token = getToken();

  const headers = new Headers(options.headers || {});

  if (token) {

    headers.set('Authorization', `Bearer ${token}`);

  }

  return harborviewFetch(url, { ...options, headers });

}



function setFeedback(element, type, message) {

  if (!element) {

    return;

  }

  element.dataset.type = type || '';

  element.textContent = message || '';

}



function updateRoomManagementVisibility() {

  if (!roomManagementSection) {

    return;

  }

  const role = normalizeRole(getRole());

  if (role === 'staff' || role === 'owner') {

    roomManagementSection.classList.remove('is-hidden');

  } else {

    roomManagementSection.classList.add('is-hidden');

  }

}



function applyRoleLayout(role) {
  const normalizedRole = normalizeRole(role);
  const isServiceTeam = SERVICE_TEAM_ROLES.has(normalizedRole);
  if (normalizedRole === 'cashier') {
    overviewSection?.classList.add('is-hidden');
    roomManagementSection?.classList.add('is-hidden');
    guestSection?.classList.add('is-hidden');
    orderSection?.classList.add('is-hidden');
    directBookingSection?.classList.add('is-hidden');
    reservationsSection?.classList.add('is-hidden');
    billingSection?.classList.remove('is-hidden');
    serviceSection?.classList.add('is-hidden');
    return;
  }

  if (normalizedRole === 'restaurant') {
    overviewSection?.classList.add('is-hidden');
    roomManagementSection?.classList.add('is-hidden');
    guestSection?.classList.add('is-hidden');
    directBookingSection?.classList.add('is-hidden');
    reservationsSection?.classList.add('is-hidden');
    billingSection?.classList.add('is-hidden');
    serviceSection?.classList.add('is-hidden');
    orderSection?.classList.remove('is-hidden');
    return;
  }

  billingSection?.classList.add('is-hidden');
  if (normalizedRole === 'owner') {
    overviewSection?.classList.remove('is-hidden');
  } else if (!isServiceTeam) {
    overviewSection?.classList.add('is-hidden');
  }

  if (normalizedRole === 'staff' || normalizedRole === 'owner') {
    directBookingSection?.classList.remove('is-hidden');
    reservationsSection?.classList.remove('is-hidden');
    serviceSection?.classList.remove('is-hidden');
    orderSection?.classList.remove('is-hidden');
  } else if (isServiceTeam) {
    directBookingSection?.classList.add('is-hidden');
    reservationsSection?.classList.add('is-hidden');
    roomManagementSection?.classList.add('is-hidden');
    guestSection?.classList.add('is-hidden');
    orderSection?.classList.remove('is-hidden');
    serviceSection?.classList.remove('is-hidden');
  } else {
    directBookingSection?.classList.add('is-hidden');
    reservationsSection?.classList.add('is-hidden');
    serviceSection?.classList.add('is-hidden');
    orderSection?.classList.add('is-hidden');
  }
}

function setSalesHighlightLoading(window, message = 'Refreshing data...') {

  const label = formatSalesWindowLabel(window);

  if (salesSelectedLabel) {

    salesSelectedLabel.textContent = `${label} sales`;

  }

  if (salesSelectedRange) {

    salesSelectedRange.textContent = 'Updating...';

  }

  if (salesSelectedTotal) {

    salesSelectedTotal.textContent = '...';

  }

  if (salesStatusText) {

    salesStatusText.textContent = message;

  }

}



function applySalesHighlight(window, overview) {

  const normalized = normalizeSalesWindow(window) || 'daily';

  const snapshot = getSalesSnapshot(normalized, overview);

  if (!snapshot) {

    const message = overview ? 'Refreshing data...' : 'Waiting for data...';

    setSalesHighlightLoading(normalized, message);

    if (!overview && salesSelectedTotal) {

      salesSelectedTotal.textContent = formatCurrency(0);

    }

    return;

  }



  updateSalesFilterButtons();



  if (salesSelectedLabel) {

    salesSelectedLabel.textContent = `${snapshot.label} sales`;

  }

  if (salesSelectedRange) {

    salesSelectedRange.textContent = formatSalesRange(snapshot.range, snapshot.label);

  }

  if (salesSelectedTotal) {

    salesSelectedTotal.textContent = formatCurrency(snapshot.total);

  }

  if (salesStatusText) {

    salesStatusText.textContent = latestOverviewFetchedAt

      ? `Last updated ${formatDateTime(latestOverviewFetchedAt)}`

      : 'Data ready.';

  }

}



function normalizeSalesWindow(value) {

  if (typeof value !== 'string') {

    return null;

  }

  const lower = value.toLowerCase();

  return ['daily', 'weekly', 'monthly', 'yearly'].includes(lower) ? lower : null;

}



function formatSalesWindowLabel(window) {

  const normalized = normalizeSalesWindow(window) || 'daily';

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);

}



function getSalesSnapshot(window, overview) {

  if (!overview || !overview.sales) {

    return null;

  }



  const normalized = normalizeSalesWindow(window) || 'daily';

  const sales = overview.sales;

  const selectedWindow = normalizeSalesWindow(sales.selected?.window);



  if (selectedWindow === normalized) {

    return {

      label: sales.selected.label || formatSalesWindowLabel(normalized),

      total: Number(sales.selected.total || 0),

      range: sales.selected.range,

    };

  }



  return {

    label: formatSalesWindowLabel(normalized),

    total: getSalesTotal(normalized, overview),

    range: calculateSalesRange(normalized),

  };

}



function getSalesTotal(window, overview) {

  if (!overview?.sales) {

    return 0;

  }

  const normalized = normalizeSalesWindow(window) || 'daily';

  switch (normalized) {

    case 'weekly':

      return Number(overview.sales.weekly || 0);

    case 'monthly':

      return Number(overview.sales.monthly || 0);

    case 'yearly':

      return Number(overview.sales.yearly || 0);

    case 'daily':

    default:

      return Number(overview.sales.daily || 0);

  }

}



function calculateSalesRange(window) {

  const normalized = normalizeSalesWindow(window) || 'daily';

  const end = new Date();

  const start = new Date(end);



  switch (normalized) {

    case 'weekly':

      start.setUTCDate(start.getUTCDate() - 7);

      break;

    case 'monthly':

      start.setUTCMonth(start.getUTCMonth() - 1);

      break;

    case 'yearly':

      start.setUTCFullYear(start.getUTCFullYear() - 1);

      break;

    case 'daily':

    default:

      start.setUTCDate(start.getUTCDate() - 1);

      break;

  }



  return {

    start: start.toISOString(),

    end: end.toISOString(),

  };

}



function formatSalesRange(range, fallbackLabel) {

  if (!range || (!range.start && !range.end)) {

    return (fallbackLabel || 'Selected') + ' totals across full history';

  }



  const startText = range.start ? formatDateTime(range.start) : null;

  const endText = range.end ? formatDateTime(range.end) : null;



  if (startText && endText) {

    return startText + ' - ' + endText;

  }



  if (startText) {

    return 'Since ' + startText;

  }



  if (endText) {

    return 'Up to ' + endText;

  }



  return (fallbackLabel || 'Selected') + ' window';

}



function formatCurrency(value) {

  const numeric = Number(value || 0);

  return 'PHP ' + numeric.toLocaleString('en-PH', {

    minimumFractionDigits: 2,

    maximumFractionDigits: 2,

  });

}



function escapeHtml(value) {

  if (value === null || value === undefined) {

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

    return '-';

  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {

    return value;

  }

  return date.toLocaleString('en-PH', {

    dateStyle: 'medium',

    timeStyle: 'short',

  });

}



function formatDate(value) {

  if (!value) {

    return '-';

  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {

    return value;

  }

  return date.toLocaleDateString();

}



function setAdminDateBounds() {

  if (!adminCheckInInput || !adminCheckOutInput) {

    return;

  }

  const today = new Date();

  const tomorrow = new Date();

  tomorrow.setDate(today.getDate() + 1);



  adminCheckInInput.min = toDateInputValue(today);

  adminCheckOutInput.min = toDateInputValue(tomorrow);

}



function handleAdminDateChange() {

  if (!adminCheckInInput || !adminCheckOutInput) {

    return;

  }

  if (adminCheckInInput.value) {

    const minCheckout = new Date(adminCheckInInput.value);

    minCheckout.setDate(minCheckout.getDate() + 1);

    const minCheckoutValue = toDateInputValue(minCheckout);

    adminCheckOutInput.min = minCheckoutValue;

    if (adminCheckOutInput.value && adminCheckOutInput.value <= adminCheckInInput.value) {

      adminCheckOutInput.value = '';

    }

  }

}



function toDateInputValue(date) {

  const offset = date.getTimezoneOffset();

  const localDate = new Date(date.getTime() - offset * 60 * 1000);

  return localDate.toISOString().split('T')[0];

}






















