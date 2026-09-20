/* =====================================================
   PRIVACY POLICY — script.js
   ===================================================== */

/* ── Dates ── */
(function setDates() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const el = document.getElementById('last-updated');
  if (el) el.textContent = fmt.format(now);

  const yr = document.getElementById('year');
  if (yr) yr.textContent = now.getFullYear();
})();

/* ── Build Table of Contents from sections ── */
(function buildTOC() {
  const sections = document.querySelectorAll('.policy-section');
  const tocList  = document.getElementById('toc-list');
  if (!tocList) return;

  sections.forEach((sec, i) => {
    const title = sec.querySelector('.section-title');
    if (!title) return;

    // Ensure each section has an id
    if (!sec.id) sec.id = 'section-' + i;

    const li  = document.createElement('li');
    const a   = document.createElement('a');
    const num = document.createElement('span');

    num.className   = 'toc-num';
    num.textContent = String(i + 1).padStart(2, '0');

    a.href      = '#' + sec.id;
    a.textContent = title.textContent;
    a.prepend(num);

    li.appendChild(a);
    tocList.appendChild(li);
  });
})();

/* ── Scroll progress bar ── */
(function scrollProgress() {
  const bar = document.createElement('div');
  bar.className = 'progress-bar';
  document.body.prepend(bar);

  document.addEventListener('scroll', () => {
    const scrollTop  = document.documentElement.scrollTop || document.body.scrollTop;
    const docHeight  = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const progress   = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    bar.style.width  = progress.toFixed(1) + '%';
  }, { passive: true });
})();

/* ── Back-to-top button ── */
(function backToTop() {
  const btn = document.createElement('button');
  btn.className   = 'back-top';
  btn.innerHTML   = '↑';
  btn.title       = 'Retour en haut';
  btn.setAttribute('aria-label', 'Retour en haut de la page');
  document.body.appendChild(btn);

  window.addEventListener('scroll', () => {
    btn.classList.toggle('show', window.scrollY > 400);
  }, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();

/* ── Intersection Observer — reveal sections on scroll ── */
(function revealOnScroll() {
  const items = document.querySelectorAll('.policy-section, .toc-card');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });

  items.forEach((el, i) => {
    el.style.transitionDelay = (i * 0.04) + 's';
    observer.observe(el);
  });
})();

/* ── Active TOC link highlight ── */
(function activeTOC() {
  const sections = document.querySelectorAll('.policy-section');
  const links    = document.querySelectorAll('.toc-list a');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        links.forEach(a => {
          a.style.color = a.getAttribute('href') === '#' + id
            ? 'var(--accent)'
            : '';
        });
      }
    });
  }, { rootMargin: '-30% 0px -60% 0px' });

  sections.forEach(sec => observer.observe(sec));
})();

/* ── Smooth anchor scroll with offset ── */
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const offset = 24;
    const top    = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});