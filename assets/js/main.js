(function () {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const header = $('#header');
  const btn = $('#menuBtn');
  const menu = $('#menu');
  const hero = $('#inicio');
  const heroContent = $('#heroContent');
  const progress = $('#progress');

  /* ---------- Menú móvil ---------- */
  function setMenu(open) {
    menu.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  }
  btn.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
  $$('a', menu).forEach(a => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && menu.classList.contains('open')) { setMenu(false); btn.focus(); }
  });

  /* ---------- Titulares palabra por palabra ---------- */
  function splitNode(node, counter) {
    Array.from(node.childNodes).forEach(child => {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const w = document.createElement('span');
          w.className = 'w';
          const inner = document.createElement('span');
          inner.textContent = part;
          inner.style.setProperty('--wi', counter.n++);
          w.appendChild(inner);
          frag.appendChild(w);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === 1) {
        splitNode(child, counter);
      }
    });
  }
  $$('[data-split]').forEach(el => splitNode(el, { n: 0 }));

  /* ---------- Retardos y escalonado ---------- */
  $$('[data-delay]').forEach(el => el.style.setProperty('--d', el.dataset.delay + 'ms'));
  $$('[data-stagger]').forEach(group => {
    const from = group.dataset.from || 'up';
    Array.from(group.children).forEach((child, i) => {
      if (!child.hasAttribute('data-anim')) child.setAttribute('data-anim', from);
      child.style.setProperty('--d', i * 90 + 'ms');
    });
  });
  $$('[data-stagger-clip]').forEach(group => {
    Array.from(group.children).forEach((child, i) => child.style.setProperty('--d', i * 120 + 'ms'));
  });

  /* ---------- Revelar al entrar en pantalla ---------- */
  // Las fotos con clip-path arrancan totalmente recortadas y el navegador las trata como invisibles,
  // así que se observa su contenedor y se revelan todas las fotos del grupo a la vez.
  const clipGroups = new Map();
  $$('[data-clip]').forEach(el => {
    const g = el.parentElement;
    if (!clipGroups.has(g)) clipGroups.set(g, []);
    clipGroups.get(g).push(el);
  });
  const targets = $$('[data-anim], [data-split]').concat(Array.from(clipGroups.keys()));
  const reveal = el => {
    if (clipGroups.has(el)) clipGroups.get(el).forEach(c => c.classList.add('in'));
    else el.classList.add('in');
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { reveal(e.target); io.unobserve(e.target); }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
    targets.forEach(el => io.observe(el));
  } else {
    targets.forEach(reveal);
  }

  /* ---------- Hero: entrada al cargar ---------- */
  requestAnimationFrame(() => requestAnimationFrame(() => hero.classList.add('loaded')));

  /* ---------- Menú: sección activa ---------- */
  const links = $$('a[href^="#"]', menu).filter(a => a.getAttribute('href').length > 1 && !a.classList.contains('btn'));
  const map = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver(entries => {
      entries.forEach(e => {
        const a = map.get(e.target.id);
        if (!a) return;
        if (e.isIntersecting) {
          links.forEach(l => l.removeAttribute('aria-current'));
          a.setAttribute('aria-current', 'true');
        } else if (a.getAttribute('aria-current')) {
          a.removeAttribute('aria-current');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    map.forEach((_, id) => { const s = document.getElementById(id); if (s) spy.observe(s); });
  }

  /* ---------- Scroll: progreso, header y parallax ---------- */
  const heroImgs = $$('.hero-col img');
  const parallaxEls = $$('[data-parallax]');
  const progressEls = $$('[data-progress]');
  let lastY = window.scrollY;
  let ticking = false;

  function frame() {
    ticking = false;
    const y = window.scrollY;
    const vh = window.innerHeight;
    const docH = document.documentElement.scrollHeight - vh;

    progress.style.setProperty('--p', docH > 0 ? (y / docH).toFixed(4) : 0);
    header.classList.toggle('scrolled', y > 10);

    // Oculta el header al bajar, lo muestra al subir
    const goingDown = y > lastY + 4;
    const goingUp = y < lastY - 4;
    if (menu.classList.contains('open') || y < 200) header.classList.remove('hide');
    else if (goingDown) header.classList.add('hide');
    else if (goingUp) header.classList.remove('hide');
    if (goingDown || goingUp) lastY = y;

    if (reduce) return;

    // Hero: columnas a distinta velocidad + texto que se desvanece
    const heroH = hero.offsetHeight;
    if (y < heroH) {
      heroImgs.forEach(img => img.style.setProperty('--py', (y * parseFloat(img.dataset.speed)).toFixed(1) + 'px'));
      const t = clamp(y / (heroH * 0.75), 0, 1);
      heroContent.style.transform = `translate3d(0,${(y * 0.16).toFixed(1)}px,0)`;
      heroContent.style.opacity = (1 - t).toFixed(3);
    }

    // Parallax de fotos y fondos
    parallaxEls.forEach(el => {
      const r = el.parentElement.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) return;
      const offset = r.top + r.height / 2 - vh / 2;
      // Límite = margen extra que tiene la imagen (inset -8% en .pimg, -30% en el fondo del CTA)
      const max = r.height * (el.classList.contains('pimg') ? 0.07 : 0.28);
      el.style.setProperty('--py', clamp(-offset * parseFloat(el.dataset.parallax), -max, max).toFixed(1) + 'px');
    });

    // Líneas que se dibujan al avanzar
    progressEls.forEach(el => {
      const r = el.getBoundingClientRect();
      const p = clamp((vh * 0.82 - r.top) / (r.height * 0.9 + vh * 0.1), 0, 1);
      el.style.setProperty('--p', p.toFixed(3));
    });
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  frame();

  $('#year').textContent = new Date().getFullYear();


  /* ---------- Aviso de cookies ---------- */
  (function cookies() {
    const KEY = 'sipca_cookie_consent';
    const box = $('#cookie');
    const panel = $('#ckPanel');
    const cfg = $('#ckConfig');
    const save = $('#ckSave');
    const analytics = $('#ckAnalytics');
    let opener = null;

    const read = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } };
    const write = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} };

    function publish(c) {
      window.sipcaConsent = c;
      document.dispatchEvent(new CustomEvent('sipca:consent', { detail: c }));
      // Si algún día se agrega analítica (p. ej. Google Analytics), cargarla aquí SOLO si c.analytics === true.
    }
    function sizeBody() {
      document.body.style.setProperty('--ck-h', box.offsetHeight + 32 + 'px');
    }
    function open(focus) {
      opener = document.activeElement;
      const c = read();
      analytics.checked = !!(c && c.analytics);
      box.hidden = false;
      document.body.classList.add('has-cookie');
      sizeBody();
      requestAnimationFrame(() => box.classList.add('show'));
      if (focus) $('#ckAccept').focus();
    }
    function close() {
      box.classList.remove('show');
      document.body.classList.remove('has-cookie');
      setTimeout(() => { box.hidden = true; }, 400);
      if (opener && opener.id === 'ckReopen') opener.focus();
    }
    function decide(analyticsOk) {
      const c = { necessary: true, analytics: analyticsOk, ts: new Date().toISOString() };
      write(c); publish(c); close();
    }

    $('#ckAccept').addEventListener('click', () => decide(true));
    $('#ckReject').addEventListener('click', () => decide(false));
    save.addEventListener('click', () => decide(analytics.checked));
    cfg.addEventListener('click', () => {
      const show = panel.hidden;
      panel.hidden = !show;
      save.hidden = !show;
      cfg.setAttribute('aria-expanded', String(show));
      cfg.textContent = show ? 'Ocultar opciones' : 'Configurar';
      sizeBody();
    });
    $('#ckReopen').addEventListener('click', () => {
      panel.hidden = false; save.hidden = false;
      cfg.setAttribute('aria-expanded', 'true'); cfg.textContent = 'Ocultar opciones';
      open(true);
    });
    window.addEventListener('resize', () => { if (!box.hidden) sizeBody(); });

    const saved = read();
    if (saved) publish(saved);
    else setTimeout(() => open(false), 900);
  })();

  /* ---------- Lightbox ---------- */
  const lb = $('#lightbox');
  const lbImg = $('#lbImg');
  let lastShot = null;
  $$('.shot').forEach(s => s.addEventListener('click', () => {
    lastShot = s;
    lbImg.src = s.dataset.src;
    lbImg.alt = s.dataset.alt;
    if (typeof lb.showModal === 'function') lb.showModal();
  }));
  $('#lbClose').addEventListener('click', () => lb.close());
  lb.addEventListener('click', e => { if (e.target === lb) lb.close(); });
  lb.addEventListener('close', () => { if (lastShot) lastShot.focus(); });

  /* ---------- Postulación: Trabaja con nosotros ---------- */
  const job = $('#jobForm');
  const jobFrame = $('#jobFrame');
  const jobNote = $('#jobNote');
  const jobBtn = $('button[type="submit"]', job);
  const jf = job.elements;
  const MAX_CV = 5 * 1024 * 1024;
  let jobSending = false;
  let jobTimer = null;

  function jobErr(id, msg, field) {
    $('#' + id).textContent = msg;
    field.setAttribute('aria-invalid', msg ? 'true' : 'false');
    return !msg;
  }
  const jobCheck = {
    nombre: () => jobErr('je-nombre', jf.nombre.value.trim().length >= 3 ? '' : 'Escribe tu nombre completo.', jf.nombre),
    puesto: () => jobErr('je-puesto', jf.puesto.value.trim().length >= 3 ? '' : 'Indica el puesto al que aspiras.', jf.puesto),
    ok: () => jobErr('je-ok', jf.consentimiento.checked ? '' : 'Debes autorizar el uso de tus datos para poder enviar.', jf.consentimiento),
    cv: async () => {
      const file = jf.attachment.files[0];
      let msg = '';
      if (!file) msg = 'Adjunta tu currículum en PDF.';
      else if (!/\.pdf$/i.test(file.name)) msg = 'El archivo debe ser un PDF.';
      else if (file.size === 0) msg = 'El archivo está vacío.';
      else if (file.size > MAX_CV) msg = 'El archivo pesa más de 5 MB. Redúcelo e inténtalo de nuevo.';
      else {
        const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
        if (String.fromCharCode(...head) !== '%PDF-') msg = 'El archivo no parece ser un PDF válido.';
      }
      return jobErr('je-cv', msg, jf.attachment);
    }
  };

  jf.nombre.addEventListener('blur', jobCheck.nombre);
  jf.puesto.addEventListener('blur', jobCheck.puesto);
  jf.attachment.addEventListener('change', jobCheck.cv);
  jf.consentimiento.addEventListener('change', jobCheck.ok);
  [jf.nombre, jf.puesto].forEach(el => el.addEventListener('input', () => {
    if (el.getAttribute('aria-invalid') === 'true') (el === jf.nombre ? jobCheck.nombre : jobCheck.puesto)();
  }));

  function jobReset(btnText) {
    jobSending = false;
    clearTimeout(jobTimer);
    jobBtn.disabled = false;
    jobBtn.textContent = btnText || 'Enviar postulación';
  }

  // El envío se hace con un formulario normal dirigido a un iframe oculto (así se puede adjuntar el PDF
  // y la persona no sale de la página). Cuando el iframe termina de cargar, se asume que el envío se realizó.
  jobFrame.addEventListener('load', () => {
    if (!jobSending) return;
    jobReset();
    job.reset();
    jobNote.className = 'form-note ok';
    jobNote.textContent = '¡Postulación enviada! Gracias por tu interés en SIPCA.';
  });

  job.addEventListener('submit', async ev => {
    ev.preventDefault();
    if (jobSending) return;
    jobNote.className = 'form-note';
    jobNote.textContent = '';

    const results = [
      [jf.nombre, jobCheck.nombre()],
      [jf.puesto, jobCheck.puesto()],
      [jf.attachment, await jobCheck.cv()],
      [jf.consentimiento, jobCheck.ok()]
    ];
    const bad = results.find(r => !r[1]);
    if (bad) {
      jobNote.classList.add('err-msg');
      jobNote.textContent = 'Revisa los campos marcados.';
      bad[0].focus();
      return;
    }
    if (jf._honey.value) {            // robot: se simula el éxito sin enviar nada
      job.reset();
      jobNote.classList.add('ok');
      jobNote.textContent = '¡Postulación enviada! Gracias por tu interés en SIPCA.';
      return;
    }

    jobSending = true;
    jobBtn.disabled = true;
    jobBtn.textContent = 'Enviando…';
    jobNote.textContent = 'Enviando tu postulación…';
    jobTimer = setTimeout(() => {
      if (!jobSending) return;
      jobReset();
      jobNote.className = 'form-note err-msg';
      jobNote.textContent = 'No pudimos confirmar el envío. Inténtalo de nuevo en unos minutos o comunícate al (0283) 2554034.';
    }, 40000);
    job.submit();                     // envío nativo (multipart) hacia el iframe oculto
  });
})();
