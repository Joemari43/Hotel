const bookingForm = document.getElementById('booking-form');
const sendCodeBtn = document.getElementById('send-code-btn');
const feedback = document.getElementById('feedback');
const verificationInput = document.getElementById('verificationCode');
const submitBtn = bookingForm.querySelector('button[type="submit"]');
const checkInInput = document.getElementById('checkIn');
const checkOutInput = document.getElementById('checkOut');
const paymentMethodInput = document.getElementById('paymentMethod');
const paymentReferenceInput = document.getElementById('paymentReference');
const paymentAmountInput = document.getElementById('paymentAmount');
const depositDisplays = document.querySelectorAll('.deposit-amount');
const gcashButton = document.getElementById('gcash-payment-btn');
const yearEl = document.getElementById('year');

let countdownTimer = null;
let countdownRemaining = 0;
let minimumDeposit = 2000;
let gcashIntegrationEnabled = false;

if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

setMinimumDates();
updateDepositUI();
loadConfiguration();

if (gcashButton) {
  gcashButton.addEventListener('click', () => {
    generateGcashPaymentLink().catch((error) => {
      renderFeedback('error', error.message);
    });
  });
}

if (paymentReferenceInput) {
  paymentReferenceInput.addEventListener('input', () => {
    if (paymentReferenceInput.value && !paymentMethodInput.value) {
      paymentMethodInput.value = 'GCash';
    }
  });
}

sendCodeBtn.addEventListener('click', async () => {
  const { fullName, email, phone } = collectFormValues();

  if (!fullName || !email || !phone) {
    renderFeedback('error', 'Add your name, email, and phone number to receive a code.');
    return;
  }

  if (sendCodeBtn.disabled && countdownRemaining > 0) {
    return;
  }

  await requestVerificationCode({ fullName, email, phone });
});

bookingForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formValues = collectFormValues();

  const validationError = validateBooking(formValues);
  if (validationError) {
    renderFeedback('error', validationError);
    return;
  }

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';
    renderFeedback('info', 'Submitting your booking...');

    const response = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formValues),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || 'Unable to confirm the booking right now.');
    }

    bookingForm.reset();
    setMinimumDates();
    clearCountdown();
    verificationInput.value = '';
    updateDepositUI();
    renderFeedback('success', `${data.message} Your booking ID is ${data.bookingId}.`);
  } catch (error) {
    renderFeedback('error', error.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Confirm Booking';
  }
});

checkInInput.addEventListener('change', () => {
  if (checkInInput.value) {
    const checkInDate = checkInInput.value;
    const minCheckout = new Date(checkInDate);
    minCheckout.setDate(minCheckout.getDate() + 1);
    checkOutInput.min = toDateInputValue(minCheckout);

    if (checkOutInput.value && checkOutInput.value <= checkInInput.value) {
      checkOutInput.value = '';
    }
  }
});

function setMinimumDates() {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const todayValue = toDateInputValue(today);
  const tomorrowValue = toDateInputValue(tomorrow);

  checkInInput.min = todayValue;
  checkOutInput.min = tomorrowValue;
  if (checkInInput.value && checkInInput.value < todayValue) {
    checkInInput.value = todayValue;
  }
  if (checkOutInput.value && checkOutInput.value < tomorrowValue) {
    checkOutInput.value = '';
  }
}

async function requestVerificationCode({ fullName, email, phone }) {
  try {
    sendCodeBtn.disabled = true;
    sendCodeBtn.textContent = 'Sending...';
    renderFeedback('info', 'Sending verification code...');

    const response = await fetch('/api/verification/request-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, email, phone }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || 'Unable to send verification code.');
    }

    renderFeedback(
      'success',
      'Verification code sent! Check your email within the next few minutes. Enter the code to finish your booking.'
    );
    verificationInput.focus();
    startCountdown(60);
  } catch (error) {
    sendCodeBtn.disabled = false;
    sendCodeBtn.textContent = 'Send Code';
    renderFeedback('error', error.message);
  }
}

function collectFormValues() {
  const formData = new FormData(bookingForm);
  return {
    fullName: formData.get('fullName')?.trim(),
    email: formData.get('email')?.trim(),
    phone: formData.get('phone')?.trim(),
    checkIn: formData.get('checkIn'),
    checkOut: formData.get('checkOut'),
    guests: formData.get('guests'),
    roomType: formData.get('roomType'),
    specialRequests: formData.get('specialRequests')?.trim(),
    verificationCode: formData.get('verificationCode')?.trim(),
    paymentMethod: formData.get('paymentMethod'),
    paymentReference: formData.get('paymentReference')?.trim(),
    paymentAmount: formData.get('paymentAmount'),
  };
}

function validateBooking(values) {
  if (!values.verificationCode || values.verificationCode.length !== 6) {
    return 'Enter the six-digit verification code we sent to your email.';
  }

  if (!values.checkIn || !values.checkOut) {
    return 'Select both check-in and check-out dates.';
  }

  if (values.checkOut <= values.checkIn) {
    return 'Check-out date must be after your check-in date.';
  }

  if (!values.guests || Number(values.guests) <= 0) {
    return 'Guest count must be at least 1.';
  }

  if (!values.roomType) {
    return 'Please choose a room type.';
  }

  if (!values.paymentMethod) {
    return 'Select a payment method.';
  }

  if (!values.paymentReference || values.paymentReference.length < 6) {
    return 'Enter the payment reference or authorization code.';
  }

  const depositAmount = Number(values.paymentAmount);
  if (Number.isNaN(depositAmount) || depositAmount < minimumDeposit) {
    return `Down payment must be at least PHP ${minimumDeposit.toFixed(2)}.`;
  }

  return null;
}

function updateDepositUI() {
  const formatted = minimumDeposit.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  depositDisplays.forEach((el) => {
    el.textContent = formatted;
  });

  if (paymentAmountInput) {
    const currentValue = Number.parseFloat(paymentAmountInput.value);
    if (!paymentAmountInput.value || Number.isNaN(currentValue) || currentValue < minimumDeposit) {
      paymentAmountInput.value = minimumDeposit.toFixed(2);
    }
    paymentAmountInput.min = minimumDeposit.toFixed(2);
  }
}

async function loadConfiguration() {
  try {
    const response = await fetch('/api/config');
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    if (typeof data.minimumDeposit === 'number' && !Number.isNaN(data.minimumDeposit)) {
      minimumDeposit = data.minimumDeposit;
      updateDepositUI();
    }

    gcashIntegrationEnabled = Boolean(data?.gcashIntegrationEnabled);
    if (gcashButton) {
      gcashButton.disabled = !gcashIntegrationEnabled;
      gcashButton.classList.toggle('is-hidden', !gcashIntegrationEnabled);
    }
  } catch (error) {
    console.info('Using default deposit amount due to configuration fetch issue.', error);
  }
}

async function generateGcashPaymentLink() {
  if (!gcashIntegrationEnabled) {
    throw new Error('GCash payment integration is currently unavailable.');
  }

  if (!gcashButton) {
    throw new Error('GCash payment option is not available.');
  }

  const formValues = collectFormValues();

  if (!formValues.fullName || !formValues.email) {
    throw new Error('Enter your full name and email before generating a GCash payment link.');
  }

  const depositAmount = Number.parseFloat(paymentAmountInput.value || minimumDeposit);
  if (Number.isNaN(depositAmount) || depositAmount < minimumDeposit) {
    paymentAmountInput.value = minimumDeposit.toFixed(2);
  }

  gcashButton.disabled = true;
  gcashButton.textContent = 'Creating link...';
  renderFeedback('info', 'Generating a secure GCash payment link...');

  try {
    const response = await fetch('/api/payments/gcash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Number.parseFloat(paymentAmountInput.value),
        customerName: formValues.fullName,
        email: formValues.email,
        remarks: `Harborview down payment for ${formValues.fullName}`,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.message || 'Unable to generate a GCash link right now.');
    }

    if (payload.referenceNumber) {
      paymentReferenceInput.value = payload.referenceNumber;
    }

    paymentMethodInput.value = 'GCash';

    renderFeedback(
      'success',
      'GCash checkout opened in a new tab. Complete the payment and the reference number will be stored here.'
    );

    if (payload.checkoutUrl) {
      window.open(payload.checkoutUrl, '_blank', 'noopener');
    }
  } finally {
    gcashButton.disabled = !gcashIntegrationEnabled;
    gcashButton.textContent = 'Generate GCash Payment Link';
  }
}

function renderFeedback(type, message) {
  if (!message) {
    feedback.textContent = '';
    feedback.removeAttribute('data-type');
    return;
  }
  feedback.dataset.type = type;
  feedback.textContent = message;
}

function startCountdown(seconds) {
  clearCountdown();
  countdownRemaining = seconds;
  updateCountdownLabel();

  countdownTimer = window.setInterval(() => {
    countdownRemaining -= 1;
    if (countdownRemaining <= 0) {
      clearCountdown();
      return;
    }
    updateCountdownLabel();
  }, 1000);
}

function updateCountdownLabel() {
  if (countdownRemaining <= 0) {
    sendCodeBtn.disabled = false;
    sendCodeBtn.textContent = 'Send Code';
    return;
  }
  sendCodeBtn.disabled = true;
  sendCodeBtn.textContent = `Resend in ${countdownRemaining}s`;
}

function clearCountdown() {
  if (countdownTimer) {
    window.clearInterval(countdownTimer);
    countdownTimer = null;
  }
  countdownRemaining = 0;
  sendCodeBtn.disabled = false;
  sendCodeBtn.textContent = 'Send Code';
}

function toDateInputValue(date) {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().split('T')[0];
}

