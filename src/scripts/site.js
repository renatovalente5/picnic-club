// Picnic Club — small progressive enhancements. Everything works without this file.
(() => {
  const root = document.documentElement;
  const motionOK = window.matchMedia('(prefers-reduced-motion: no-preference)').matches;

  // ------------------------------------------------------------ header over the film
  // The <head> already wrote data-scrolled before the first paint. Hysteresis: turn solid
  // after 80px, transparent again only above 40px, so the header never flickers.
  if (root.dataset.hero === 'on') {
    const decide = () => {
      const y = window.scrollY;
      const now = root.dataset.scrolled;
      if (now !== 'yes' && y > 80) root.dataset.scrolled = 'yes';
      else if (now !== 'no' && y < 40) root.dataset.scrolled = 'no';
    };
    window.addEventListener('scroll', decide, { passive: true });
    window.addEventListener('pageshow', decide);
    document.addEventListener('visibilitychange', decide);
    decide();
  }
  // Transitions are armed only after the first state has painted.
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('is-ready')));

  // ------------------------------------------------------------ mobile menu
  const menu = document.getElementById('menu');
  const opener = document.querySelector('.menu-button');
  if (menu && opener && typeof menu.showModal === 'function') {
    opener.addEventListener('click', () => {
      menu.showModal();
      opener.setAttribute('aria-expanded', 'true');
    });
    menu.addEventListener('close', () => {
      opener.setAttribute('aria-expanded', 'false');
      opener.focus();
    });
    menu.addEventListener('click', (event) => {
      if (event.target.closest('[data-close]') || event.target.closest('a')) menu.close();
    });
    opener.setAttribute('aria-expanded', 'false');
  }

  // ------------------------------------------------------------ hero film
  const video = document.querySelector('.hero__video');
  const pause = document.querySelector('.hero__pause');
  const saveData = navigator.connection && navigator.connection.saveData;
  if (video && pause && !saveData) {
    const portrait = window.matchMedia('(orientation: portrait)');
    const sourceFor = () => (portrait.matches ? video.dataset.portrait : video.dataset.landscape);
    // Only the visitor decides to stop the film. A refused play() (hidden tab, power saving)
    // is retried when the page is visible again; reduced motion waits for the button.
    let userPaused = !motionOK;

    const load = () => {
      const src = sourceFor();
      if (video.getAttribute('src') === src) return;
      const t = video.currentTime || 0;
      video.src = src;
      video.addEventListener('loadedmetadata', () => { if (t) video.currentTime = t; }, { once: true });
      if (!userPaused) play();
    };
    const play = () => {
      if (document.hidden) return;
      const p = video.play();
      if (p && p.catch) p.catch(() => showState(false));
    };
    const label = pause.querySelector('.hero__pause-label');
    const showState = (playing) => {
      pause.dataset.state = playing ? 'playing' : 'paused';
      label.textContent = playing ? 'Pause video' : 'Play video';
      pause.title = label.textContent;
    };
    video.addEventListener('playing', () => { video.classList.add('is-playing'); showState(true); });
    video.addEventListener('pause', () => showState(false));
    pause.addEventListener('click', () => {
      if (pause.dataset.state === 'playing') {
        userPaused = true;
        video.pause();
      } else {
        userPaused = false;
        if (!video.getAttribute('src')) load();
        play();
      }
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && !userPaused && video.paused) play(); });
    portrait.addEventListener('change', () => { if (video.getAttribute('src')) load(); });
    pause.hidden = false;
    if (!userPaused) load();
  }

  // ------------------------------------------------------------ gallery films
  // Each film loads and plays only while it is on screen, and stops when it leaves.
  // One button pauses them all (moving pictures need a way to stop them, WCAG 2.2.2).
  // With reduced motion or data saving they stay as photographs until the visitor asks.
  const wall = document.querySelector('.moments');
  const films = wall ? [...wall.querySelectorAll('video[data-src]')] : [];
  const filmsButton = wall && wall.querySelector('.moments__pause');
  if (films.length && filmsButton && 'IntersectionObserver' in window) {
    let filmsPaused = !motionOK || Boolean(saveData);
    const onScreen = new Set();
    const label = filmsButton.querySelector('.moments__pause-label');
    const showState = () => {
      filmsButton.dataset.state = filmsPaused ? 'paused' : 'playing';
      label.textContent = filmsPaused ? 'Play videos' : 'Pause videos';
    };
    const start = (film) => {
      if (filmsPaused || document.hidden) return;
      if (!film.getAttribute('src')) film.src = film.dataset.src;
      const p = film.play();
      if (p && p.catch) p.catch(() => {});
    };
    films.forEach((film) => film.addEventListener('playing', () => film.classList.add('is-playing')));
    const watch = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          onScreen.add(entry.target);
          start(entry.target);
        } else {
          onScreen.delete(entry.target);
          entry.target.pause();
        }
      });
    }, { threshold: 0.2 });
    films.forEach((film) => watch.observe(film));
    filmsButton.addEventListener('click', () => {
      filmsPaused = !filmsPaused;
      showState();
      if (filmsPaused) films.forEach((film) => film.pause());
      else onScreen.forEach(start);
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) onScreen.forEach(start); });
    showState();
    filmsButton.hidden = false;
  }

  // ------------------------------------------------------------ reveals
  const revealables = document.querySelectorAll('[data-reveal]');
  if (motionOK && 'IntersectionObserver' in window && revealables.length) {
    const inView = (el) => {
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight * 0.92 && r.bottom > 0;
    };
    revealables.forEach((el) => { if (inView(el)) el.classList.add('is-in'); });
    root.classList.add('reveal-on');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revealables.forEach((el) => { if (!el.classList.contains('is-in')) io.observe(el); });
  }

  // ------------------------------------------------------------ forms
  const MESSAGES = {
    enquiry: {
      title: 'Thank you.',
      text: 'We’ve received your enquiry and will be in touch shortly.',
    },
    review: {
      title: 'Thank you.',
      text: 'Your review has reached us. It will appear on this page once we have read it.',
    },
  };
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function errorFor(field) {
    if (field.type === 'checkbox') return field.required && !field.checked ? 'Please tick this box to continue.' : '';
    const value = field.value.trim();
    if (field.required && !value) return field.tagName === 'SELECT' ? 'Please choose an option.' : 'Please fill this in.';
    if (value && field.type === 'email' && !EMAIL.test(value)) return 'Please check the email address, for example name@example.com.';
    if (value && field.minLength > 0 && value.length < field.minLength) return `Please write at least ${field.minLength} characters.`;
    if (value && field.type === 'number' && field.min && Number(value) < Number(field.min)) return `Please enter ${field.min} or more.`;
    return '';
  }

  function showError(field, message) {
    const box = document.getElementById(`${field.id}-error`);
    const hint = document.getElementById(`${field.id}-hint`);
    if (message) {
      field.setAttribute('aria-invalid', 'true');
      field.setAttribute('aria-describedby', [hint && hint.id, box && box.id].filter(Boolean).join(' '));
      if (box) { box.textContent = message; box.hidden = false; }
    } else {
      field.removeAttribute('aria-invalid');
      if (hint) field.setAttribute('aria-describedby', hint.id); else field.removeAttribute('aria-describedby');
      if (box) { box.textContent = ''; box.hidden = true; }
    }
  }

  document.querySelectorAll('form[data-kind]').forEach((form) => {
    const kind = form.dataset.kind;
    const status = form.querySelector('.form__status');
    const fields = [...form.querySelectorAll('input, select, textarea')];

    // ?experience=marriage-proposal preselects the experience
    const wantedExperience = new URLSearchParams(location.search).get('experience');
    const select = form.querySelector('select[name="experience"]');
    if (select && wantedExperience && [...select.options].some((o) => o.value === wantedExperience)) select.value = wantedExperience;

    fields.forEach((field) => {
      field.addEventListener(field.type === 'checkbox' || field.tagName === 'SELECT' ? 'change' : 'blur', () => {
        if (field.getAttribute('aria-invalid') === 'true' || field.value) showError(field, errorFor(field));
      });
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      let first = null;
      fields.forEach((field) => {
        const message = errorFor(field);
        showError(field, message);
        if (message && !first) first = field;
      });
      if (first) {
        status.textContent = 'Some details need your attention.';
        first.focus();
        return;
      }
      const endpoint = form.dataset.endpoint;
      if (!endpoint) {
        status.textContent = 'This preview is not connected yet. Please write to hello@picnicclub.pt or message us on WhatsApp.';
        return;
      }
      const button = form.querySelector('button[type="submit"]');
      button.setAttribute('aria-busy', 'true');
      status.textContent = 'Sending…';
      const data = Object.fromEntries(new FormData(form).entries());
      try {
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (!response.ok) throw new Error(String(response.status));
        const done = document.createElement('div');
        done.className = 'form-done';
        const h = document.createElement('h2');
        h.className = 'display';
        h.tabIndex = -1;
        h.textContent = MESSAGES[kind].title;
        const p = document.createElement('p');
        p.textContent = MESSAGES[kind].text;
        done.append(h, p);
        form.replaceWith(done);
        h.focus();
      } catch {
        button.removeAttribute('aria-busy');
        status.textContent = 'We could not send this just now. Please try again in a moment, or write to hello@picnicclub.pt.';
      }
    });
  });
})();
