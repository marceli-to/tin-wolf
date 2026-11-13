// Landing page behaviour: touch-only devices, the hero loop and the screenshot lightbox. No Three.js here.

// Phones and tablets cannot play (no touch controls): say so instead of sending them into the game.
const touchOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
if (touchOnly) {
  document.querySelector<HTMLElement>('.touch-note')!.hidden = false;
  for (const a of document.querySelectorAll<HTMLAnchorElement>('.play-link')) {
    if (a.classList.contains('btn-big')) a.textContent = 'Play on a computer';
  }
}

// The hero loop stays still for people who prefer reduced motion (the poster shows instead).
const hero = document.querySelector<HTMLVideoElement>('.hero-video');
if (hero) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const apply = (): void => {
    if (reduce.matches) {
      hero.pause();
      hero.removeAttribute('autoplay');
    } else void hero.play().catch(() => undefined);
  };
  apply();
  reduce.addEventListener('change', apply);
}

// Screenshot lightbox: click a thumbnail; the arrow buttons or keys step through, Esc closes.
const box = document.querySelector<HTMLDialogElement>('.lightbox');
const shots = [...document.querySelectorAll<HTMLButtonElement>('.gallery button[data-full]')];
if (box && shots.length) {
  const img = box.querySelector('img')!;
  let index = 0;
  const show = (i: number): void => {
    index = (i + shots.length) % shots.length;
    const b = shots[index]!;
    img.src = b.dataset.full!;
    img.alt = b.querySelector('img')?.alt ?? '';
  };
  shots.forEach((b, i) =>
    b.addEventListener('click', () => {
      show(i);
      box.showModal();
    }),
  );
  box.querySelector('.lb-close')!.addEventListener('click', () => box.close());
  box.querySelector('.lb-prev')!.addEventListener('click', () => show(index - 1));
  box.querySelector('.lb-next')!.addEventListener('click', () => show(index + 1));
  box.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(index - 1);
    if (e.key === 'ArrowRight') show(index + 1);
  });
  // A click on the dark backdrop (outside the picture) closes it.
  box.addEventListener('click', (e) => {
    if (e.target === box) box.close();
  });
  box.addEventListener('close', () => shots[index]?.focus());
}
