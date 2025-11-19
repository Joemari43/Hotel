const orderForm = document.getElementById('order-form');
const orderFeedback = document.getElementById('order-feedback');
const orderTypeSelect = document.getElementById('order-type');
const requestedForInput = document.getElementById('requested-for');
const itemNameInput = document.getElementById('item-name-input');
const itemQuantityInput = document.getElementById('item-quantity-input');
const itemNotesInput = document.getElementById('item-notes-input');
const addItemBtn = document.getElementById('add-item-btn');
const roomSelect = document.getElementById('order-room');
const orderItemsList = document.getElementById('order-items-list');
const orderItemsText = document.getElementById('order-items-text');
const orderNotesInput = document.getElementById('order-notes');
const yearEl = document.getElementById('order-year');
const orderItemFields = document.querySelector('.order-item-fields');
const orderItemsHelp = document.getElementById('order-items-help');
const orderMenuBtn = document.getElementById('order-menu-btn');
const orderItemsTextWrapper = orderItemsText ? orderItemsText.closest('.form-field') : null;

const MENU_SELECTION_KEY = 'harborview.orderMenuSelection';
const MENU_TYPES = new Set(['food', 'amenity']);
const defaultItemsHelpText = orderItemsHelp ? orderItemsHelp.textContent.trim() : '';

const itemsState = [];

if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

renderItems();
loadRoomOptions().catch((error) => {
  console.error('[order] failed to load room options', error);
  setFeedback('error', 'Unable to load room numbers right now. Please call the front desk.');
  if (roomSelect) {
    roomSelect.innerHTML = '<option value="">Room selection unavailable</option>';
    roomSelect.disabled = true;
  }
});

if (addItemBtn) {
  addItemBtn.addEventListener('click', handleAddItem);
}

if (orderItemsList) {
  orderItemsList.addEventListener('click', handleRemoveItem);
}

if (orderForm) {
  orderForm.addEventListener('submit', handleSubmitOrder);
}

if (orderTypeSelect) {
  orderTypeSelect.addEventListener('change', handleOrderTypeChange);
}

if (orderMenuBtn) {
  orderMenuBtn.addEventListener('click', handleMenuNavigation);
}

handleOrderTypeChange();
restoreMenuSelection();

function handleAddItem() {
  const name = itemNameInput?.value?.trim() || '';
  if (!name) {
    setFeedback('error', 'Enter an item name before adding it to the list.');
    itemNameInput?.focus();
    return;
  }

  if (itemsState.length >= 50) {
    setFeedback('error', 'You can list up to 50 items per request. Add notes if you need more.');
    return;
  }

  const quantityValue = Number.parseInt(itemQuantityInput?.value ?? '1', 10);
  const quantity = Number.isFinite(quantityValue) && quantityValue > 0 ? Math.min(quantityValue, 99) : 1;
  const notes = itemNotesInput?.value?.trim() || null;

  itemsState.push({
    name,
    quantity,
    notes,
  });

  renderItems();
  clearItemInputs();
  setFeedback('', '');
  itemNameInput?.focus();
}

function handleRemoveItem(event) {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }
  const index = Number.parseInt(target.dataset.removeIndex ?? '-1', 10);
  if (Number.isNaN(index) || index < 0 || index >= itemsState.length) {
    return;
  }
  itemsState.splice(index, 1);
  renderItems();
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

async function handleSubmitOrder(event) {
  event.preventDefault();
  if (!orderForm) {
    return;
  }

  const formData = new FormData(orderForm);
  const payload = {
    fullName: formData.get('fullName')?.trim(),
    email: formData.get('email')?.trim(),
    phone: formData.get('phone')?.trim(),
    roomNumber: roomSelect?.value?.trim(),
    orderType: orderTypeSelect?.value?.trim(),
    requestedFor: requestedForInput?.value || undefined,
    specialInstructions: orderNotesInput?.value?.trim() || undefined,
    items: itemsState.map((item) => ({ ...item })),
  };

  const fallbackItems = orderItemsText?.value?.trim() || undefined;
  if (fallbackItems) {
    payload.itemsText = fallbackItems;
  }

  if (!payload.fullName || payload.fullName.length < 2) {
    setFeedback('error', 'Enter your full name so we can verify the request.');
    return;
  }

  if (!payload.email || !payload.email.includes('@')) {
    setFeedback('error', 'Add a valid email address so we can send confirmation.');
    return;
  }

  if (!payload.phone) {
    setFeedback('error', 'Add the phone number we can call or text for updates.');
    return;
  }

  if (!payload.roomNumber) {
    setFeedback('error', 'Enter your room number so we can deliver the request.');
    return;
  }

  if (!payload.orderType) {
    setFeedback('error', 'Choose what type of request you are making.');
    return;
  }

  if (payload.items.length === 0 && !payload.itemsText) {
    setFeedback('error', 'Add at least one item or describe what you need.');
    return;
  }

  const submitBtn = orderForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  setFeedback('info', 'Sending your request...');

  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.message || 'Unable to send your request right now.');
    }

    itemsState.splice(0, itemsState.length);
    renderItems();
    orderForm.reset();
    setFeedback(
      'success',
      data?.message
        ? `${data.message} Reference: ${data.orderCode ?? 'n/a'}.`
        : 'Request sent! Our team will reach out shortly.'
    );
    itemQuantityInput.value = '1';
  } catch (error) {
    setFeedback('error', error.message || 'Unable to submit your request right now.');
  } finally {
    submitBtn.disabled = false;
  }
}

function handleOrderTypeChange() {
  const type = orderTypeSelect ? orderTypeSelect.value : '';
  const isMenuType = MENU_TYPES.has(type);

  if (orderMenuBtn) {
    orderMenuBtn.classList.toggle('is-hidden', !isMenuType);
    if (isMenuType) {
      orderMenuBtn.dataset.type = type;
      orderMenuBtn.textContent = type === 'amenity' ? 'Browse amenities' : 'Browse food & drinks';
    } else {
      orderMenuBtn.dataset.type = '';
    }
  }

  if (orderItemFields) {
    orderItemFields.classList.toggle('is-hidden', isMenuType);
  }

  if (orderItemsTextWrapper) {
    orderItemsTextWrapper.classList.toggle('is-hidden', isMenuType);
  }

  if (orderItemsHelp) {
    if (isMenuType) {
      orderItemsHelp.textContent =
        type === 'amenity'
          ? 'Use the menu to add amenities to your request. Add extra details in special instructions.'
          : 'Use the menu to add dishes and drinks to your request. Add extra details in special instructions.';
    } else if (defaultItemsHelpText) {
      orderItemsHelp.textContent = defaultItemsHelpText;
    }
  }
}

function handleMenuNavigation() {
  let preferredType = 'food';
  if (orderMenuBtn && MENU_TYPES.has(orderMenuBtn.dataset.type)) {
    preferredType = orderMenuBtn.dataset.type;
  } else if (orderTypeSelect && MENU_TYPES.has(orderTypeSelect.value)) {
    preferredType = orderTypeSelect.value;
  }

  const params = new URLSearchParams();
  if (preferredType) {
    params.set('type', preferredType);
  }

  const targetUrl = `/menu?${params.toString()}`;
  window.location.href = targetUrl;
}

function restoreMenuSelection() {
  let rawSelection = null;
  try {
    rawSelection = sessionStorage.getItem(MENU_SELECTION_KEY);
    if (rawSelection) {
      sessionStorage.removeItem(MENU_SELECTION_KEY);
    }
  } catch (error) {
    console.warn('[order] unable to access sessionStorage for menu selections', error);
  }

  if (!rawSelection) {
    return;
  }

  try {
    const payload = JSON.parse(rawSelection);
    const selections = Array.isArray(payload?.items) ? payload.items : [];
    const menuType = typeof payload?.orderType === 'string' ? payload.orderType : '';

    if (menuType && orderTypeSelect) {
      orderTypeSelect.value = menuType;
    }

    handleOrderTypeChange();

    let addedCount = 0;
    selections.forEach((item) => {
      if (mergeMenuItem(item)) {
        addedCount += 1;
      }
    });

    if (addedCount > 0) {
      renderItems();
      setFeedback(
        'success',
        addedCount === 1 ? 'Added 1 item from the menu.' : `Added ${addedCount} items from the menu.`
      );
    }
  } catch (error) {
    console.error('[order] unable to restore menu selection', error);
  }
}

function mergeMenuItem(selection) {
  const name = selection?.name?.trim();
  if (!name) {
    return false;
  }

  const quantityValue = Number.parseInt(selection?.quantity, 10);
  const quantity =
    Number.isFinite(quantityValue) && quantityValue > 0 ? Math.min(quantityValue, 99) : 1;
  const notes = selection?.notes?.trim() || null;

  const existing = itemsState.find(
    (item) =>
      item.name.toLowerCase() === name.toLowerCase() && (item.notes || '') === (notes || '')
  );

  if (existing) {
    existing.quantity = Math.min(existing.quantity + quantity, 99);
  } else {
    itemsState.push({
      name,
      quantity,
      notes,
    });
  }

  return true;
}

function renderItems() {
  if (!orderItemsList) {
    return;
  }

  if (itemsState.length === 0) {
    orderItemsList.innerHTML =
      '<li class="order-items__placeholder text-muted">No items added yet.</li>';
    return;
  }

  const listHtml = itemsState
    .map((item, index) => {
      const summary = `${item.quantity > 1 ? `${item.quantity} × ` : ''}${escapeHtml(item.name)}`;
      const notes = item.notes ? `<span class="text-muted">(${escapeHtml(item.notes)})</span>` : '';
      return `
        <li class="order-items__row">
          <span>${summary} ${notes}</span>
          <button type="button" class="link-btn" data-remove-index="${index}">Remove</button>
        </li>
      `;
    })
    .join('');

  orderItemsList.innerHTML = listHtml;
}

function clearItemInputs() {
  if (itemNameInput) {
    itemNameInput.value = '';
  }
  if (itemQuantityInput) {
    itemQuantityInput.value = '1';
  }
  if (itemNotesInput) {
    itemNotesInput.value = '';
  }
}

function setFeedback(type, message) {
  if (!orderFeedback) {
    return;
  }
  orderFeedback.dataset.type = type || '';
  orderFeedback.textContent = message || '';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
