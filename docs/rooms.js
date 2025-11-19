const roomGrid = document.getElementById("rooms-grid");
const roomsError = document.getElementById("rooms-error");
const yearEl = document.getElementById("year");

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1505691723518-36a5ac3be353?auto=format&fit=crop&w=1200&q=80";

const marketingPresets = {
  "Deluxe King": {
    imageUrl:
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80",
    sleeps: 2,
    amenities: ["Balcony", "Copper soaking tub", "Smart TV"],
    description:
      "Our most-loved suite pairs a floating king bed with a Juliet balcony, artisan coffee service, and sunset views framed by floor-to-ceiling windows.",
  },
  "Twin Suite": {
    imageUrl:
      "https://images.unsplash.com/photo-1562790351-d273a961e0e9?auto=format&fit=crop&w=1200&q=80",
    sleeps: 3,
    amenities: ["Convertible lounge", "Creative workspace", "Kitchenette"],
    description:
      "Designed for duos or small crews with two plush twins, a modular lounge, and a bay-facing workspace stocked with analog and digital inspiration.",
  },
  "Ocean View Loft": {
    imageUrl:
      "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=80",
    sleeps: 4,
    amenities: ["Private terrace", "Barista station", "Living room"],
    description:
      "A two-level aerie with a floating staircase, wraparound terrace, Dyson styling suite, and an espresso program curated by our barista team.",
  },
  "Garden Retreat": {
    imageUrl:
      "https://images.unsplash.com/photo-1505691723518-36a5ac3be353?auto=format&fit=crop&w=1200&q=80",
    sleeps: 2,
    amenities: ["Private patio", "Spa access", "Evening turndown"],
    description:
      "Ground-level hideaway with a fern-filled courtyard, slow mornings on the daybed, and nightly aromatherapy turndown curated by our spa botanists.",
  },
};

function formatPhp(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return null;
  }
  return `PHP ${Number(value).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function createAmenityChips(amenities = []) {
  if (!amenities || amenities.length === 0) {
    return "";
  }
  return `
    <div class="room-card__amenities">
      ${amenities.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
    </div>
  `;
}

function escapeHtml(value) {
  if (value == null) {
    return "";
  }
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildRoomCard(room) {
  const preset = marketingPresets[room.name] || {};
  const imageUrl = preset.imageUrl || room.imageUrl || FALLBACK_IMAGE;
  const sleepsCount = room.sleeps != null ? Number(room.sleeps) : preset.sleeps;
  const sleepsLabel = Number.isFinite(sleepsCount) ? `Sleeps ${sleepsCount}` : 'Sleeps —';
  const rateLabel = room.baseRate != null ? `${formatPhp(room.baseRate)}/night` : 'Contact us for rates';
  const description =
    room.description && room.description.trim().length > 0
      ? room.description.trim()
      : preset.description || 'Discover handcrafted comforts and harbor views throughout your stay.';
  const amenities = Array.isArray(preset.amenities) ? preset.amenities : [];

  return `
    <article class="room-card">
      <img src="${imageUrl}" alt="${escapeHtml(room.name)}" loading="lazy" />
      <div class="room-card__body">
        <h3>${escapeHtml(room.name)}</h3>
        <div class="room-card__meta">
          <span>${escapeHtml(sleepsLabel)}</span>
          <span>${escapeHtml(rateLabel)}</span>
        </div>
        <p>${escapeHtml(description)}</p>
        ${createAmenityChips(amenities)}
        <a class="room-card__cta" href="/book#booking">Book this room</a>
      </div>
    </article>
  `;
}

function setRoomsError(message) {
  if (!roomsError) {
    return;
  }
  roomsError.textContent = message || "";
}

async function loadRooms() {
  if (!roomGrid) {
    return;
  }
  roomGrid.innerHTML = "";
  setRoomsError("Loading rooms...");

  try {
    const response = await fetch("/api/public/room-types");
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || "Unable to load rooms right now.");
    }

    const roomTypes = await response.json();
    if (!Array.isArray(roomTypes) || roomTypes.length === 0) {
      setRoomsError("Check back soon—our creative team is crafting new suites.");
      return;
    }

    const cards = roomTypes.map((room) => buildRoomCard(room)).join("");
    roomGrid.innerHTML = cards;
    setRoomsError("");
  } catch (error) {
    console.error("Failed to load rooms", error);
    setRoomsError(error.message || "Unable to load rooms right now.");
  }
}

function init() {
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
  loadRooms();
}

document.addEventListener("DOMContentLoaded", init);
