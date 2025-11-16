const MENU_SELECTION_KEY = 'harborview.orderMenuSelection';

const filtersContainer = document.getElementById('menu-filters');
const itemsContainer = document.getElementById('menu-items');
const selectionList = document.getElementById('menu-selection-list');
const submitBtn = document.getElementById('menu-submit-btn');
const cancelBtn = document.getElementById('menu-cancel-btn');
const clearBtn = document.getElementById('menu-clear-btn');
const feedbackEl = document.getElementById('menu-feedback');
const contextCopy = document.getElementById('menu-context-copy');
const yearEl = document.getElementById('menu-year');

const searchParams = new URLSearchParams(window.location.search);
const contextType = searchParams.get('type') === 'amenity' ? 'amenity' : 'food';
const FALLBACK_IMAGES = {
  food: '/images/menu/default-food.svg',
  amenity: '/images/menu/default-amenity.svg',
};

const FILTER_LABELS = {
  all: 'All items',
  breakfast: 'Breakfast',
  mains: 'Mains',
  shareable: 'To share',
  drink: 'Drinks',
  dessert: 'Desserts',
  late_night: 'Late night',
  comfort: 'Comfort',
  wellness: 'Wellness',
  family: 'Family',
  celebration: 'Celebrations',
  tech: 'Tech',
};

const FILTER_ORDER = {
  food: ['all', 'breakfast', 'mains', 'shareable', 'drink', 'dessert', 'late_night'],
  amenity: ['all', 'comfort', 'wellness', 'family', 'celebration', 'tech'],
};

const MENU_ITEMS = [
  {
    id: 'breakfast-pancakes',
    name: 'Buttermilk Pancakes',
    orderType: 'food',
    kind: 'breakfast',
    description: 'Citrus-kissed pancakes with whipped butter and palm syrup.',
    price: 'PHP 520',
    image:
      'https://images.pexels.com/photos/376464/pexels-photo-376464.jpeg?auto=compress&cs=tinysrgb&w=1200',
    imageAlt: 'Stack of golden pancakes topped with butter and syrup',
  },
  {
    id: 'breakfast-omelet',
    name: 'Sunrise Omelet',
    orderType: 'food',
    kind: 'breakfast',
    description: 'Three eggs, crab, scallions, and aged cheddar with side greens.',
    price: 'PHP 540',
    image:
      'https://images.pexels.com/photos/1410235/pexels-photo-1410235.jpeg?auto=compress&cs=tinysrgb&w=1200',
    imageAlt: 'Omelet plated with tomatoes and fresh greens',
  },
  {
    id: 'breakfast-benedict',
    name: 'Lobster Benedict',
    orderType: 'food',
    kind: 'breakfast',
    description: 'Butter-poached lobster on brioche with yuzu hollandaise.',
    price: 'PHP 680',
    image:
      'https://images.pexels.com/photos/4050342/pexels-photo-4050342.jpeg?auto=compress&cs=tinysrgb&w=1200',
    imageAlt: 'Eggs Benedict with lobster and hollandaise sauce',
  },
  {
    id: 'breakfast-congee',
    name: 'Seaside Congee',
    orderType: 'food',
    kind: 'breakfast',
    description: 'Ginger rice porridge with crab flakes, scallions, and chili oil.',
    price: 'PHP 420',
    image:
      'https://images.pexels.com/photos/1813504/pexels-photo-1813504.jpeg?auto=compress&cs=tinysrgb&w=1200',
    imageAlt: 'Bowl of savory congee topped with scallions and chili oil',
  },
  {
    id: 'mains-salmon',
    name: 'Cedar Plank Salmon',
    orderType: 'food',
    kind: 'mains',
    description: 'Roasted with herb butter, charred lemon, and baby kale.',
    price: 'PHP 980',
    image:
      'https://images.pexels.com/photos/3298637/pexels-photo-3298637.jpeg?auto=compress&cs=tinysrgb&w=1200',
    imageAlt: 'Roasted salmon fillet with greens and lemon',
  },
  {
    id: 'mains-chicken',
    name: 'Harbor Herb Chicken',
    orderType: 'food',
    kind: 'mains',
    description: 'Free-range chicken with rosemary jus and garlic whipped potatoes.',
    price: 'PHP 890',
    image:
      'https://images.pexels.com/photos/4099128/pexels-photo-4099128.jpeg?auto=compress&cs=tinysrgb&w=1200',
    imageAlt: 'Roasted chicken breast with potatoes and herbs',
  },
  {
    id: 'mains-ribeye',
    name: 'Dry-Aged Ribeye',
    orderType: 'food',
    kind: 'mains',
    description: '350g ribeye with smoked sea salt butter and rosemary jus.',
    price: 'PHP 1,650',
    image:
      'https://images.pexels.com/photos/1860208/pexels-photo-1860208.jpeg?auto=compress&cs=tinysrgb&w=1200',
    imageAlt: 'Sliced dry-aged ribeye steak on a board',
  },
  {
    id: 'mains-lobster-roll',
    name: 'Warm Lobster Roll',
    orderType: 'food',
    kind: 'mains',
    description: 'Brown butter lobster on toasted brioche with seaweed fries.',
    price: 'PHP 1,120',
    image:
      'https://images.pexels.com/photos/664595/pexels-photo-664595.jpeg?auto=compress&cs=tinysrgb&w=1200',
    imageAlt: 'Lobster roll served in a toasted brioche bun',
  },
  {
    id: 'mains-vegan-bowl',
    name: 'Garden Harvest Bowl',
    orderType: 'food',
    kind: 'mains',
    description: 'Charred broccolini, quinoa, chickpeas, and miso tahini dressing.',
    price: 'PHP 720',
    image:
      'https://images.pexels.com/photos/1640773/pexels-photo-1640773.jpeg?auto=compress&cs=tinysrgb&w=1200',
    imageAlt: 'Colorful plant-based bowl with grains and vegetables',
  },
  {
    id: 'shareable-flatbread',
    name: 'Heirloom Tomato Flatbread',
    orderType: 'food',
    kind: 'shareable',
    description: 'Grilled sourdough, burrata, sweet basil, and balsamic reduction.',
    price: 'PHP 640',
    image:
      'https://images.pexels.com/photos/3659862/pexels-photo-3659862.jpeg?auto=compress&cs=tinysrgb&w=1200',
    imageAlt: 'Flatbread topped with heirloom tomatoes and basil',
  },
  {
    id: 'shareable-cheese',
    name: 'Artisan Cheese Board',
    orderType: 'food',
    kind: 'shareable',
    description: 'Local cheeses, stone fruit preserves, honeycomb, and crackers.',
    price: 'PHP 780',
    image:
      'https://images.pexels.com/photos/434258/pexels-photo-434258.jpeg?auto=compress&cs=tinysrgb&w=1200',
    imageAlt: 'Cheese board with grapes, nuts, and crackers',
  },
  {
    id: 'shareable-crabcake',
    name: 'Davao Crab Cakes',
    orderType: 'food',
    kind: 'shareable',
    description: 'Blue crab patties with calamansi aioli and pickled papaya.',
    price: 'PHP 820',
    image:
      'https://images.pexels.com/photos/1881336/pexels-photo-1881336.jpeg?auto=compress&cs=tinysrgb&w=1200',
    imageAlt: 'Crisp crab cakes with dipping sauce',
  },
  {
    id: 'shareable-charcuterie',
    name: 'Coastal Charcuterie',
    orderType: 'food',
    kind: 'shareable',
    description: 'Cured meats, smoked fish, olives, and grilled sourdough.',
    price: 'PHP 980',
    image:
      'https://images.pexels.com/photos/5945639/pexels-photo-5945639.jpeg?auto=compress&cs=tinysrgb&w=1200',
    imageAlt: 'Charcuterie board with meats, cheeses, and accompaniments',
  },
  {
    id: 'drink-cold-brew',
    name: 'Midnight Cold Brew',
    orderType: 'food',
    kind: 'drink',
    description: '18-hour steeped cold brew over kona coffee ice spheres.',
    price: 'PHP 210',
    image:
      'https://images.pexels.com/photos/373889/pexels-photo-373889.jpeg?auto=compress&cs=tinysrgb&w=1200',
    imageAlt: 'Glass of cold brew coffee with ice',
  },
  {
    id: 'drink-calamansi',
    name: 'Cucumber Calamansi Cooler',
    orderType: 'food',
    kind: 'drink',
    description: 'Fresh calamansi, cucumber ribbons, mint, and sparkling water.',
    price: 'PHP 240',
    image:
      'https://images.pexels.com/photos/102736/pexels-photo-102736.jpeg?auto=compress&cs=tinysrgb&w=1200',
    imageAlt: 'Citrus drink with cucumber and mint in a glass',
  },
  {
    id: 'drink-ginger-beer',
    name: 'Ginger Turmeric Fizz',
    orderType: 'food',
    kind: 'drink',
    description: 'Cold-pressed ginger, turmeric, and sparkling calamansi.',
    price: 'PHP 260',
    image:
      'https://images.pexels.com/photos/5074938/pexels-photo-5074938.jpeg?auto=compress&cs=tinysrgb&w=1200',
    imageAlt: 'Golden ginger turmeric drink with citrus garnish',
  },
  {
    id: 'drink-house-soda',
    name: 'Sunset House Soda',
    orderType: 'food',
    kind: 'drink',
    description: 'Pink guava, lychee pearls, and hibiscus foam.',
    price: 'PHP 260',
    image:
      'https://images.pexels.com/photos/5409027/pexels-photo-5409027.jpeg?auto=compress&cs=tinysrgb&w=1200',
    imageAlt: 'Sparkling fruit soda with edible flowers',
  },
  {
    id: 'dessert-cheesecake',
    name: 'Calamansi Cheesecake',
    orderType: 'food',
    kind: 'dessert',
    description: 'Silky citrus cheesecake with coconut crust and mango coulis.',
    price: 'PHP 420',
    image:
      'https://images.pexels.com/photos/752514/pexels-photo-752514.jpeg?auto=compress&cs=tinysrgb&w=1200',
    imageAlt: 'Cheesecake slice topped with citrus segments',
  },
  {
    id: 'dessert-molten-cake',
    name: 'Molten Tablea Cake',
    orderType: 'food',
    kind: 'dessert',
    description: 'Davao tablea lava cake with salted caramel and vanilla bean gelato.',
    price: 'PHP 460',
    image:
      'https://images.pexels.com/photos/914397/pexels-photo-914397.jpeg?auto=compress&cs=tinysrgb&w=1200',
    imageAlt: 'Molten chocolate lava cake with ice cream',
  },
  {
    id: 'dessert-sorbet',
    name: 'Citrus Sorbet Trio',
    orderType: 'food',
    kind: 'dessert',
    description: 'Calamansi, dalandan, and pomelo sorbets with coconut crumble.',
    price: 'PHP 380',
    image:
      'https://images.pexels.com/photos/461198/pexels-photo-461198.jpeg?auto=compress&cs=tinysrgb&w=1200',
    imageAlt: 'Scoops of fruit sorbet served in bowls',
  },
  {
    id: 'late-night-truffle-fries',
    name: 'Truffle Nightcap Fries',
    orderType: 'food',
    kind: 'late_night',
    description: 'Hand-cut fries with black truffle salt and parmesan aioli.',
    price: 'PHP 360',
    image:
      'https://images.pexels.com/photos/1059943/pexels-photo-1059943.jpeg?auto=compress&cs=tinysrgb&w=1200',
    imageAlt: 'Truffle fries topped with parmesan and herbs',
  },
  {
    id: 'late-night-ramen',
    name: 'Midnight Seafood Ramen',
    orderType: 'food',
    kind: 'late_night',
    description: 'Rich broth with prawns, scallops, soft egg, and chili oil.',
    price: 'PHP 580',
    image:
      'https://images.pexels.com/photos/884600/pexels-photo-884600.jpeg?auto=compress&cs=tinysrgb&w=1200',
    imageAlt: 'Seafood ramen bowl with prawns and egg',
  },
  {
    id: 'late-night-sliders',
    name: 'Harborview Sliders',
    orderType: 'food',
    kind: 'late_night',
    description: 'Truffle wagyu sliders with smoked mozzarella and tomato jam.',
    price: 'PHP 540',
    image:
      'https://images.pexels.com/photos/2290070/pexels-photo-2290070.jpeg?auto=compress&cs=tinysrgb&w=1200',
    imageAlt: 'Gourmet beef sliders with cheese on a tray',
  },
  {
    id: 'amenity-memory-pillow',
    name: 'Memory Foam Pillow Set',
    orderType: 'amenity',
    kind: 'comfort',
    description: 'Two hypoallergenic pillows with cooling bamboo covers.',
    price: 'Complimentary',
    image:
      'https://images.unsplash.com/photo-1600721376132-8b95b3f5c0c5?auto=format&fit=crop&w=800&q=80',
    imageAlt: 'Memory foam pillows stacked on a bed',
  },
  {
    id: 'amenity-plush-robe',
    name: 'Harborview Plush Robe',
    orderType: 'amenity',
    kind: 'comfort',
    description: 'Ultra-soft robe and slipper set, delivered in your preferred size.',
    price: 'Complimentary',
    image:
      'https://images.unsplash.com/photo-1616594039964-b456fea0bc91?auto=format&fit=crop&w=800&q=80',
    imageAlt: 'White plush robe hanging in a room',
  },
  {
    id: 'amenity-aroma-kit',
    name: 'Evening Aromatherapy Kit',
    orderType: 'amenity',
    kind: 'wellness',
    description: 'Lavender pillow mist, chamomile tea, and guided breathing card.',
    price: 'PHP 250',
    image:
      'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=800&q=80',
    imageAlt: 'Aromatherapy oils and accessories on a table',
  },
  {
    id: 'amenity-yoga-mat',
    name: 'In-Room Yoga Setup',
    orderType: 'amenity',
    kind: 'wellness',
    description: 'Yoga mat, stretch bands, and curated sunrise flow playlist.',
    price: 'PHP 350',
    image:
      'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&q=80',
    imageAlt: 'Yoga mat and strap in a calm room',
  },
  {
    id: 'amenity-family-game',
    name: 'Family Game Basket',
    orderType: 'amenity',
    kind: 'family',
    description: 'Board games, coloring sets, and late-night snack mix.',
    price: 'PHP 420',
    image:
      'https://images.unsplash.com/photo-1527977966376-1c84012954d1?auto=format&fit=crop&w=800&q=80',
    imageAlt: 'Family playing board games together',
  },
  {
    id: 'amenity-celebration-kit',
    name: 'Celebration Spark Kit',
    orderType: 'amenity',
    kind: 'celebration',
    description: 'Mini cake, sparklers, and hand-lettered card for joyful moments.',
    price: 'PHP 750',
    defaultNotes: 'Add celebration message.',
    image:
      'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=800&q=80',
    imageAlt: 'Birthday cake with sparklers',
  },
  {
    id: 'amenity-tech-kit',
    name: 'All-in-One Charger Kit',
    orderType: 'amenity',
    kind: 'tech',
    description: 'Universal adapters plus USB-C, Lightning, and micro-USB cables.',
    price: 'PHP 280',
    image:
      'https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=800&q=80',
    imageAlt: 'Charging cables neatly arranged on a desk',
  },
  {
    id: 'amenity-beach-kit',
    name: 'Beach Day Basket',
    orderType: 'amenity',
    kind: 'family',
    description: 'Beach towels, reef-safe sunscreen, and reusable water bottles.',
    price: 'PHP 520',
    image:
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
    imageAlt: 'Beach essentials including towels and sunscreen on the sand',
  },
];

const itemsForContext = MENU_ITEMS.filter((item) => item.orderType === contextType);
const filters = buildFilters(itemsForContext);
const state = {
  filter: filters[0] || 'all',
  selections: new Map(),
};

if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

if (contextCopy) {
  contextCopy.textContent =
    contextType === 'amenity'
      ? 'Select amenities, comforts, and extras to elevate your room.'
      : 'Select dishes and drinks to add to your in-room dining request.';
}

if (submitBtn) {
  submitBtn.textContent =
    contextType === 'amenity' ? 'Add amenities to request' : 'Add items to request';
}

renderFilters();
renderItems();
renderSelection();

if (filtersContainer) {
  filtersContainer.addEventListener('click', handleFilterClick);
}

if (itemsContainer) {
  itemsContainer.addEventListener('click', handleItemClick);
}

if (selectionList) {
  selectionList.addEventListener('click', handleSelectionClick);
}

if (clearBtn) {
  clearBtn.addEventListener('click', clearSelections);
}

if (cancelBtn) {
  cancelBtn.addEventListener('click', () => {
    window.location.href = '/order';
  });
}

if (submitBtn) {
  submitBtn.addEventListener('click', submitSelection);
}

function handleFilterClick(event) {
  const button = event.target.closest('button[data-filter]');
  if (!button) {
    return;
  }
  const filter = button.dataset.filter;
  if (!filter || filter === state.filter) {
    return;
  }
  state.filter = filters.includes(filter) ? filter : 'all';
  setFeedback('', '');
  renderFilters();
  renderItems();
}

function handleItemClick(event) {
  const button = event.target.closest('button[data-action="add"]');
  if (!button) {
    return;
  }
  const itemId = button.dataset.id;
  if (!itemId) {
    return;
  }
  addSelection(itemId);
}

function handleSelectionClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }
  const itemId = button.dataset.id;
  if (!itemId) {
    return;
  }
  const action = button.dataset.action;
  if (action === 'increment') {
    adjustSelection(itemId, 1);
  } else if (action === 'decrement') {
    adjustSelection(itemId, -1);
  } else if (action === 'remove') {
    removeSelection(itemId);
  }
}

function buildFilters(items) {
  const order = FILTER_ORDER[contextType] || ['all'];
  const availableKinds = new Set(items.map((item) => item.kind));
  const result = [];

  for (const key of order) {
    if (key === 'all' || availableKinds.has(key)) {
      result.push(key);
    }
  }

  if (result.length === 0) {
    result.push('all');
  }

  return result;
}

function renderFilters() {
  if (!filtersContainer) {
    return;
  }
  const html = filters
    .map((filter) => {
      const isActive = state.filter === filter;
      const label = FILTER_LABELS[filter] || formatCategory(filter);
      return `<button type="button" class="menu-filter${
        isActive ? ' is-active' : ''
      }" role="tab" data-filter="${filter}" aria-selected="${isActive}" tabindex="${
        isActive ? '0' : '-1'
      }">${escapeHtml(label)}</button>`;
    })
    .join('');
  filtersContainer.innerHTML = html;
}

function renderItems() {
  if (!itemsContainer) {
    return;
  }

  const visibleItems =
    state.filter === 'all'
      ? itemsForContext
      : itemsForContext.filter((item) => item.kind === state.filter);

  if (visibleItems.length === 0) {
    itemsContainer.innerHTML =
      '<p class="menu-empty text-muted">No signatures are plated for this category right now.</p>';
    return;
  }

  const html = visibleItems
    .map((item) => {
      const categoryLabel = FILTER_LABELS[item.kind] || formatCategory(item.kind);
      const priceLabel = item.price || '';

      const selected = state.selections.get(item.id);
      const quantity = selected ? selected.quantity : 0;
      const actionLabel = selected ? `Add another (${quantity})` : 'Add to tray';
      const selectedTag = selected
        ? `<span class="menu-item__selected">Selected ×${quantity}</span>`
        : '';
      const headerHtml =
        categoryLabel || priceLabel
          ? `<div class="menu-item__header">
              ${
                categoryLabel
                  ? `<span class="menu-item__category">${escapeHtml(categoryLabel)}</span>`
                  : ''
              }
              ${
                priceLabel
                  ? `<span class="menu-item__price">${escapeHtml(priceLabel)}</span>`
                  : ''
              }
            </div>`
          : '';
      const fallbackSrc = FALLBACK_IMAGES[item.orderType] || FALLBACK_IMAGES.food;
      const primarySrc = item.image || fallbackSrc;
      const imageHtml = `<div class="menu-item__media"><img src="${escapeHtml(
        primarySrc
      )}" alt="${escapeHtml(item.imageAlt || item.name)}" loading="lazy" data-fallback="${escapeHtml(
        fallbackSrc
      )}" /></div>`;

      return `
        <article class="menu-item" data-id="${escapeHtml(item.id)}" role="listitem">
          ${imageHtml}
          <div class="menu-item__details">
            ${headerHtml}
            <h3>${escapeHtml(item.name)}</h3>
            <p class="text-muted">${escapeHtml(item.description)}</p>
          </div>
          <div class="menu-item__actions">
            ${selectedTag}
            <button type="button" class="secondary-btn menu-item__add-btn" data-action="add" data-id="${escapeHtml(
              item.id
            )}">${escapeHtml(actionLabel)}</button>
          </div>
        </article>
      `;
    })
    .join('');

  itemsContainer.innerHTML = html;
  setupImageFallbacks(itemsContainer);
}

function renderSelection() {
  if (!selectionList) {
    return;
  }

  if (state.selections.size === 0) {
    selectionList.innerHTML =
      '<li class="menu-selection__empty text-muted">Your service tray is empty.</li>';
    updateSelectionActions();
    return;
  }

  const itemsHtml = Array.from(state.selections.values())
    .map(({ item, quantity }) => {
      const metaParts = [];
      const categoryLabel = FILTER_LABELS[item.kind] || formatCategory(item.kind);
      if (categoryLabel) {
        metaParts.push(categoryLabel);
      }
      if (item.price) {
        metaParts.push(item.price);
      }
      const metaText = metaParts.join(' • ');
      const ariaAdd = escapeHtml(`Add one ${item.name}`);
      const ariaRemoveOne = escapeHtml(`Remove one ${item.name}`);

      return `
        <li class="menu-selection__item" data-id="${escapeHtml(item.id)}">
          <div class="menu-selection__info">
            <strong>${escapeHtml(item.name)}</strong>
            ${metaText ? `<span class="text-muted">${escapeHtml(metaText)}</span>` : ''}
          </div>
          <div class="menu-selection__controls">
            <button type="button" class="menu-stepper" data-action="decrement" data-id="${escapeHtml(
              item.id
            )}" aria-label="${ariaRemoveOne}">-</button>
            <span class="menu-stepper__value" aria-live="off">${quantity}</span>
            <button type="button" class="menu-stepper" data-action="increment" data-id="${escapeHtml(
              item.id
            )}" aria-label="${ariaAdd}">+</button>
            <button type="button" class="link-btn menu-remove-btn" data-action="remove" data-id="${escapeHtml(
              item.id
            )}">Remove</button>
          </div>
        </li>
      `;
    })
    .join('');

  selectionList.innerHTML = itemsHtml;
  updateSelectionActions();
}

function addSelection(itemId) {
  const menuItem = itemsForContext.find((item) => item.id === itemId);
  if (!menuItem) {
    return;
  }

  const current = state.selections.get(itemId);
  if (current) {
    current.quantity = Math.min(current.quantity + 1, 99);
  } else {
    state.selections.set(itemId, {
      item: menuItem,
      quantity: 1,
    });
  }

  setFeedback('', '');
  renderItems();
  renderSelection();
}

function adjustSelection(itemId, delta) {
  const entry = state.selections.get(itemId);
  if (!entry) {
    return;
  }
  const nextQuantity = entry.quantity + delta;
  if (nextQuantity <= 0) {
    state.selections.delete(itemId);
  } else {
    entry.quantity = Math.min(nextQuantity, 99);
  }
  renderItems();
  renderSelection();
}

function removeSelection(itemId) {
  if (!state.selections.has(itemId)) {
    return;
  }
  state.selections.delete(itemId);
  renderItems();
  renderSelection();
}

function clearSelections() {
  if (state.selections.size === 0) {
    return;
  }
  state.selections.clear();
  setFeedback('', '');
  renderItems();
  renderSelection();
}

function submitSelection() {
  if (state.selections.size === 0) {
    setFeedback('error', 'Select at least one item to continue.');
    return;
  }

  const items = Array.from(state.selections.values()).map(({ item, quantity }) => {
    const payload = {
      name: item.name,
      quantity,
    };
    if (item.defaultNotes) {
      payload.notes = item.defaultNotes;
    }
    return payload;
  });

  const payload = {
    orderType: contextType,
    items,
  };

  try {
    sessionStorage.setItem(MENU_SELECTION_KEY, JSON.stringify(payload));
  } catch (error) {
    console.error('[menu] unable to store selection in sessionStorage', error);
    setFeedback(
      'error',
      'Unable to save your selection. Please try again or add items manually on the order page.'
    );
    return;
  }

  window.location.href = '/order';
}

function updateSelectionActions() {
  const hasItems = state.selections.size > 0;
  if (submitBtn) {
    submitBtn.disabled = !hasItems;
  }
  if (clearBtn) {
    clearBtn.classList.toggle('is-hidden', !hasItems);
  }
}

function setFeedback(type, message) {
  if (!feedbackEl) {
    return;
  }
  feedbackEl.dataset.type = type || '';
  feedbackEl.textContent = message || '';
}

function setupImageFallbacks(root) {
  if (!root) {
    return;
  }
  const images = root.querySelectorAll('img[data-fallback]');
  images.forEach((img) => {
    const fallbackSrc = img.dataset.fallback;
    if (!fallbackSrc) {
      return;
    }
    img.addEventListener('error', () => {
      if (img.dataset.fallbackApplied === '1') {
        return;
      }
      img.src = fallbackSrc;
      img.dataset.fallbackApplied = '1';
    });
  });
}

function formatCategory(value) {
  if (!value) {
    return '';
  }
  return toTitleCase(String(value).replace(/_/g, ' '));
}

function toTitleCase(value) {
  return value
    .split(' ')
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ''))
    .join(' ');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
