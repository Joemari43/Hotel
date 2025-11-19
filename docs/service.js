const form = document.getElementById('service-request-form');
const feedback = document.getElementById('service-feedback');
const requestTypeInputs = document.querySelectorAll('input[name="requestType"]');
const housekeepingGroup = document.getElementById('housekeeping-options');
const maintenanceGroup = document.getElementById('maintenance-options');
const summaryInput = document.getElementById('service-summary');
const detailsInput = document.getElementById('service-details');
const priorityInput = document.getElementById('service-priority');
const requestedForInput = document.getElementById('service-requested-for');
const instructionsInput = document.getElementById('service-instructions');
const nameInput = document.getElementById('service-name');
const emailInput = document.getElementById('service-email');
const phoneInput = document.getElementById('service-phone');
const roomSelect = document.getElementById('service-room');
const serviceYear = document.getElementById('service-year');

const SERVICE_SELECTIONS = {
  housekeeping: housekeepingGroup ? Array.from(housekeepingGroup.querySelectorAll('input[type="checkbox"]')) : [],
  maintenance: maintenanceGroup ? Array.from(maintenanceGroup.querySelectorAll('input[type="checkbox"]')) : [],
};

if (serviceYear) {
  serviceYear.textContent = new Date().getFullYear();
}

if (requestTypeInputs) {
  requestTypeInputs.forEach((input) => {
    input.addEventListener('change', handleRequestTypeChange);
  });
}

if (form) {
  form.addEventListener('submit', handleSubmit);
}

loadRoomOptions().catch((error) => {
  console.error('[service] failed to load room options', error);
  setFeedback(
    'error',
    'We can’t display available rooms right now. Please call the front desk for assistance.'
  );
  if (roomSelect) {
    roomSelect.innerHTML = '<option value="">Room selection unavailable</option>';
    roomSelect.disabled = true;
  }
});

handleRequestTypeChange();

function handleRequestTypeChange() {
  const selectedType = getSelectedType();
  if (housekeepingGroup) {
    housekeepingGroup.classList.toggle('is-hidden', selectedType !== 'housekeeping');
  }
  if (maintenanceGroup) {
    maintenanceGroup.classList.toggle('is-hidden', selectedType !== 'maintenance');
  }
  setFeedback('', '');
}

function getSelectedType() {
  const checked = Array.from(requestTypeInputs || []).find((input) => input.checked);
  return checked ? checked.value : 'housekeeping';
}

async function handleSubmit(event) {
  event.preventDefault();
  setFeedback('', '');

  if (!form) {
    return;
  }

  const payload = buildPayload();
  if (!payload) {
    return;
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
  }
  setFeedback('info', 'Sending your request...');

  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.message || 'Unable to submit your request at the moment.');
    }

    form.reset();
    handleRequestTypeChange();
    setFeedback('success', data?.message || 'Request sent! Our service team will follow up shortly.');
  } catch (error) {
    console.error('[service] failed to submit request', error);
    setFeedback('error', error.message || 'Unable to submit your request right now.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
    }
  }
}

function buildPayload() {
  const fullName = nameInput?.value?.trim() || '';
  if (!fullName || fullName.length < 2) {
    setFeedback('error', 'Enter your full name so we can verify the request.');
    nameInput?.focus();
    return null;
  }

  const email = emailInput?.value?.trim() || '';
  if (!email || !email.includes('@')) {
    setFeedback('error', 'Add the email address we can use for confirmation.');
    emailInput?.focus();
    return null;
  }

  const phone = phoneInput?.value?.trim() || '';
  if (!phone) {
    setFeedback('error', 'Share a phone number so we can coordinate timing.');
    phoneInput?.focus();
    return null;
  }

  const roomNumber = roomSelect?.value?.trim() || '';
  if (!roomNumber) {
    setFeedback('error', 'Select your room number.');
    roomSelect?.focus();
    return null;
  }

  const orderType = getSelectedType();
  const selectedOptions = gatherSelectedOptions(orderType);
  const summary = summaryInput?.value?.trim() || '';
  const details = detailsInput?.value?.trim() || '';

  if (!selectedOptions.length && !summary) {
    setFeedback(
      'error',
      'Select at least one item or add a brief summary so our team knows what to prepare.'
    );
    summaryInput?.focus();
    return null;
  }

  const items = selectedOptions.map((label) => ({
    name: label,
    quantity: 1,
    notes: orderType === 'maintenance' && details ? details : null,
  }));

  if (summary) {
    const notes =
      orderType === 'maintenance' && details && selectedOptions.length
        ? null
        : details || null;
    items.push({
      name: summary,
      quantity: 1,
      notes,
    });
  }

  const priority = priorityInput?.value || 'normal';
  const requestedFor = requestedForInput?.value || '';
  const instructions = instructionsInput?.value?.trim() || '';

  const instructionParts = [];
  if (priority && priority !== 'normal') {
    instructionParts.push(`Priority: ${formatPriorityLabel(priority)}`);
  }
  if (instructions) {
    instructionParts.push(instructions);
  }

  const payload = {
    fullName,
    email,
    phone,
    roomNumber,
    orderType,
    items,
  };

  if (instructionParts.length) {
    payload.specialInstructions = instructionParts.join('\n');
  }

  if (requestedFor) {
    payload.requestedFor = requestedFor;
  }

  return payload;
}

function gatherSelectedOptions(type) {
  const source = SERVICE_SELECTIONS[type] || [];
  return source.filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value);
}

function formatPriorityLabel(value) {
  switch (value) {
    case 'high':
      return 'High';
    case 'urgent':
      return 'Urgent';
    default:
      return 'Standard';
  }
}

async function loadRoomOptions() {
  if (!roomSelect) {
    return;
  }

  roomSelect.disabled = true;
  roomSelect.innerHTML = '<option value="">Loading rooms…</option>';

  const response = await fetch('/api/rooms/inventory');
  if (!response.ok) {
    throw new Error('Unable to fetch room list.');
  }

  const payload = await response.json();
  const rooms = Array.isArray(payload?.rooms) ? payload.rooms : Array.isArray(payload) ? payload : [];
  if (!rooms.length) {
    roomSelect.innerHTML = '<option value="">No rooms found</option>';
    roomSelect.disabled = true;
    throw new Error('Room list is empty.');
  }

  const options = [
    '<option value="">Select your room</option>',
    ...rooms.map((room) => {
      const value = room.value || room.code || room.label || room.roomNumber || '';
      const label =
        room.label || `${room.roomType || 'Room'} • ${room.code || room.value || room.roomNumber || ''}`;
      return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
    }),
  ];

  roomSelect.innerHTML = options.join('');
  roomSelect.disabled = false;
}

function setFeedback(type, message) {
  if (!feedback) {
    return;
  }
  feedback.dataset.type = type || '';
  feedback.textContent = message || '';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
