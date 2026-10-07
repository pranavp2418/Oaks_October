// The supplied animation belongs only to the CraftsmanAI project panel.
const panel = document.querySelector('.feature-visual.static-brand');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let seen = false;
let motionOff = false;
try {
  seen = sessionStorage.getItem('craftsmanai-loader') === 'seen';
  motionOff = localStorage.getItem('portfolio-motion') === 'off';
} catch {}

if (panel && !seen && !motionOff && !reducedMotion.matches) {
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    observer.disconnect();
    if (document.documentElement.classList.contains('no-motion')) return;

    const loader = document.createElement('div');
    loader.className = 'craft-loader';
    loader.setAttribute('role', 'group');
    loader.setAttribute('aria-label', 'CraftsmanAI introduction');
    loader.innerHTML = '<video muted playsinline preload="auto" aria-hidden="true" poster="/assets/craftsmanai-poster.jpg"><source src="/assets/craftsmanai-film.mp4" type="video/mp4"></video><div class="loader-foot"><span>CRAFTSMANAI / MEET THE PRODUCT</span><button type="button">Skip animation</button></div><div class="loader-line"></div>';
    panel.append(loader);
    const video = loader.querySelector('video');
    let finished = false;
    const dismiss = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      motionObserver.disconnect();
      reducedMotion.removeEventListener('change', dismiss);
      video.pause();
      if (loader.contains(document.activeElement)) {
        panel.tabIndex = -1;
        panel.focus({ preventScroll: true });
      }
      loader.classList.add('loader-exit');
      try { sessionStorage.setItem('craftsmanai-loader', 'seen'); } catch {}
      setTimeout(() => loader.remove(), 350);
    };
    const timer = setTimeout(dismiss, 4200);
    const motionObserver = new MutationObserver(() => {
      if (document.documentElement.classList.contains('no-motion')) dismiss();
    });
    motionObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    reducedMotion.addEventListener('change', dismiss);
    loader.querySelector('button').addEventListener('click', dismiss);
    loader.addEventListener('keydown', event => { if (event.key === 'Escape') dismiss(); });
    video.addEventListener('error', dismiss);
    video.addEventListener('ended', dismiss);
    video.play().catch(dismiss);
  }, { threshold: 0.2 });
  observer.observe(panel);
}
