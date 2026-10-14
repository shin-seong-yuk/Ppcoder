const range = document.querySelector('#range');
const crosshair = document.querySelector('#crosshair');
const effects = document.querySelector('#effects');
const weaponButtons = [...document.querySelectorAll('.weapon')];
const weaponReadout = document.querySelector('#weapon-readout');

const weaponNames = {
  sword: 'SWORD / SLASH',
  bow: 'BOW / ARROW',
  gun: 'RIFLE / SINGLE FIRE',
  staff: 'STAFF / ARCANE',
  dagger: 'DAGGER / THROW'
};

let selectedWeapon = 'gun';

weaponButtons.forEach((button) => {
  button.addEventListener('click', () => {
    selectedWeapon = button.dataset.weapon;
    weaponButtons.forEach((item) => {
      const isSelected = item === button;
      item.classList.toggle('is-selected', isSelected);
      item.setAttribute('aria-checked', String(isSelected));
    });
    weaponReadout.textContent = weaponNames[selectedWeapon];
    range.dataset.weapon = selectedWeapon;
  });
});

function pointInRange(clientX, clientY) {
  const bounds = range.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(bounds.width, clientX - bounds.left)),
    y: Math.max(0, Math.min(bounds.height, clientY - bounds.top))
  };
}

range.addEventListener('pointermove', (event) => {
  const point = pointInRange(event.clientX, event.clientY);
  crosshair.style.left = `${point.x}px`;
  crosshair.style.top = `${point.y}px`;
});

function fireEffect(x, y) {
  const effect = document.createElement('span');
  effect.className = `fx ${selectedWeapon}`;
  effect.style.setProperty('--x', `${x}px`);
  effect.style.setProperty('--y', `${y}px`);
  effects.append(effect);
  effect.addEventListener('animationend', () => effect.remove(), { once: true });
  window.setTimeout(() => effect.remove(), 800);
}

range.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  const point = pointInRange(event.clientX, event.clientY);
  fireEffect(point.x, point.y);

  const target = event.target.closest('.target');
  if (!target) return;

  target.classList.remove('is-hit');
  void target.offsetWidth;
  target.classList.add('is-hit');
  const destination = document.querySelector(target.dataset.destination);
  window.setTimeout(() => destination?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 420);
});

document.querySelectorAll('.target').forEach((target) => {
  target.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    const destination = document.querySelector(target.dataset.destination);
    destination?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});
