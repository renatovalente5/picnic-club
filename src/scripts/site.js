// Picnic Club — small progressive enhancements. Everything works without this file.
(() => {
  const root = document.documentElement;
  const motionOK = window.matchMedia('(prefers-reduced-motion: no-preference)').matches;

  // The words this file writes, in the page's language.
  const TEXT = {
    en: {
      playVideo: 'Play video', pauseVideo: 'Pause video', playVideos: 'Play videos', pauseVideos: 'Pause videos',
      enquiryTitle: 'Thank you.', enquiryText: 'We’ve received your enquiry and will be in touch shortly.',
      reviewTitle: 'Thank you.', reviewText: 'Your review has reached us. It will appear on this page once we have read it.',
      tick: 'Please tick this box to continue.', choose: 'Please choose an option.', fill: 'Please fill this in.',
      email: 'Please check the email address, for example name@example.com.',
      minLength: 'Please write at least {n} characters.', min: 'Please enter {n} or more.',
      attention: 'Some details need your attention.',
      notConnected: 'This preview is not connected yet. Please write to hello@picnicclub.pt or message us on WhatsApp.',
      sending: 'Sending…', failed: 'We could not send this just now. Please try again in a moment, or write to hello@picnicclub.pt.',
      wait: 'We have received several messages from this connection. Please try again in an hour, or write to hello@picnicclub.pt.',
      check: 'Please check this.',
    },
    pt: {
      playVideo: 'Reproduzir o vídeo', pauseVideo: 'Pausar o vídeo', playVideos: 'Reproduzir os vídeos', pauseVideos: 'Pausar os vídeos',
      enquiryTitle: 'Obrigado.', enquiryText: 'Recebemos o seu pedido e entraremos em contacto muito em breve.',
      reviewTitle: 'Obrigado.', reviewText: 'O seu testemunho chegou até nós. Vai aparecer nesta página depois de o lermos.',
      tick: 'Assinale esta caixa para continuar.', choose: 'Escolha uma opção.', fill: 'Preencha este campo.',
      email: 'Confirme o endereço de email, por exemplo nome@exemplo.pt.',
      minLength: 'Escreva pelo menos {n} caracteres.', min: 'Indique {n} ou mais.',
      attention: 'Alguns campos precisam da sua atenção.',
      notConnected: 'Esta pré-visualização ainda não está ligada. Escreva-nos para hello@picnicclub.pt ou envie-nos uma mensagem pelo WhatsApp.',
      sending: 'A enviar…', failed: 'Não foi possível enviar agora. Tente de novo daqui a pouco, ou escreva-nos para hello@picnicclub.pt.',
      wait: 'Recebemos várias mensagens a partir desta ligação. Tente de novo daqui a uma hora, ou escreva-nos para hello@picnicclub.pt.',
      check: 'Confirme este campo.',
    },
  };
  const say = TEXT[root.lang.startsWith('pt') ? 'pt' : 'en'];

  // ------------------------------------------------------------ language
  // The PT/EN switch is the only thing that writes a choice on the device (see the Cookies page);
  // the <head> of an English page reads it on the first page of a visit.
  document.querySelectorAll('[data-lang]').forEach((link) => {
    link.addEventListener('click', () => {
      try { localStorage.setItem('picnic-lang', link.dataset.lang); } catch (e) { /* private window: the switch still works */ }
    });
  });

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
    // Closed with a tap, the focus goes back to the menu button without the ring, which Safari on a
    // phone otherwise leaves drawn round it; closed from the keyboard, it comes back with the ring.
    let byPointer = false;
    opener.addEventListener('click', () => {
      menu.showModal();
      // The browser hands the focus to the first link, the logo, and Safari rings it even after
      // a tap. The menu itself takes it instead: nothing is ringed, and Tab still starts at the logo.
      menu.focus({ preventScroll: true });
      opener.setAttribute('aria-expanded', 'true');
    });
    menu.addEventListener('close', () => {
      opener.setAttribute('aria-expanded', 'false');
      opener.focus({ focusVisible: !byPointer });
      byPointer = false;
    });
    menu.addEventListener('click', (event) => {
      if (event.target.closest('[data-close]') || event.target.closest('a')) {
        byPointer = event.detail > 0; // a tap or a click; Enter and Space give 0
        menu.close();
      }
    });
    opener.setAttribute('aria-expanded', 'false');
  }

  // ------------------------------------------------------------ experiences panel
  // CSS opens it on hover and on focus; Escape closes it and leaves the focus on «Experiences»,
  // and it stays closed until the pointer or the focus leaves it.
  const drop = document.querySelector('.nav__drop');
  if (drop) {
    const reopen = () => { delete drop.dataset.closed; };
    drop.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || drop.dataset.closed !== undefined) return;
      drop.dataset.closed = '';
      drop.querySelector('.nav__drop-link').focus();
    });
    // Back in reach when the pointer comes in again or the focus leaves. Not when the pointer leaves:
    // the focus is still on «Experiences» then, and the panel would open again by itself.
    drop.addEventListener('pointerenter', reopen);
    drop.addEventListener('focusout', (event) => { if (!drop.contains(event.relatedTarget)) reopen(); });
  }

  // ------------------------------------------------------------ a refused autoplay
  // An iPhone in Low Power Mode (and some data savers) refuses every film that starts by itself, on
  // every site: play() fails with NotAllowedError. That is not the visitor's choice, so their first tap
  // anywhere on the page starts the refused films (a tap is a gesture, and a gesture may play; a scroll
  // is not one and cannot). The play/pause buttons are left to their own handlers.
  const refused = new Set();
  const isRefusal = (error) => Boolean(error) && error.name === 'NotAllowedError';
  const onGesture = (event) => {
    if (!refused.size) return;
    if (event.target && event.target.closest && event.target.closest('.round-pause, [data-films-toggle]')) return;
    const again = [...refused];
    refused.clear();
    again.forEach((retry) => retry());
  };
  ['touchend', 'click', 'keydown'].forEach((type) => document.addEventListener(type, onGesture, { capture: true, passive: true }));

  // ------------------------------------------------------------ hero film
  // The film starts by itself, as early as the browser can (the page gives it `autoplay` and its two
  // <source>, portrait and landscape; the script right after it takes the autoplay away with reduced
  // motion or data saving, and fades it in on its first frame — src/templates/pages.mjs, filmGate).
  // This adds the button, the retries and the switch when the phone turns.
  const video = document.querySelector('.hero__video');
  const pause = document.querySelector('.hero__pause');
  const saveData = navigator.connection && navigator.connection.saveData;
  if (video && pause) {
    const portrait = window.matchMedia('(orientation: portrait)');
    const sourceFor = () => (portrait.matches ? video.dataset.portrait : video.dataset.landscape);
    const pathOf = (url) => { try { return new URL(url, location.href).pathname; } catch (e) { return ''; } };
    // Only the visitor decides to stop the film. A play() refused by a hidden tab is retried when the
    // page is visible again; reduced motion and data saving wait for the button.
    let userPaused = !motionOK || Boolean(saveData);

    // REFUSED BY THE PHONE (an iPhone in Low Power Mode, or with «Auto-Play Video Previews» off,
    // refuses every film that starts by itself, on every site): Safari still plays the same MP4 as an
    // IMAGE — an <img>, silent and looping, which Low Power Mode leaves alone and the «Animated
    // Images» setting still stops (WebKit's ImageDecoderAVFObjC; Ana, 6 Oct 2026). A browser that
    // cannot (only Safari can) fails it, and then the first tap anywhere starts the film.
    let moving = null;
    const showMoving = () => {
      if (moving || userPaused) return;
      const img = document.createElement('img');
      img.className = 'hero__moving';
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      img.decoding = 'async';
      img.addEventListener('error', () => {
        img.remove();
        if (moving !== img) return;
        moving = null;
        showState(false);
        if (!userPaused) refused.add(retry);
      }, { once: true });
      img.src = sourceFor();
      video.after(img);
      moving = img;
      showState(true);
    };
    const hideMoving = () => { if (moving) { moving.remove(); moving = null; } };

    const play = () => {
      if (document.hidden) return;
      const p = video.play();
      if (p && p.catch) {
        p.catch((error) => {
          if (isRefusal(error) && !userPaused) { showMoving(); return; }
          if (!moving) showState(false);
        });
      }
    };
    const retry = () => { if (!userPaused) play(); };
    // The film for the way the phone is held (a browser that ignores <source media> took the first).
    const fitSource = () => {
      const want = sourceFor();
      if (!video.currentSrc || pathOf(video.currentSrc) === pathOf(want)) return;
      const t = video.currentTime || 0;
      if (moving) moving.src = want;
      video.src = want;
      video.addEventListener('loadedmetadata', () => { if (t) video.currentTime = t; }, { once: true });
      if (!userPaused) play();
    };
    const label = pause.querySelector('.round-pause__label');
    const showState = (playing) => {
      pause.dataset.state = playing ? 'playing' : 'paused';
      label.textContent = playing ? say.pauseVideo : say.playVideo;
      pause.title = label.textContent;
    };
    video.addEventListener('playing', () => { hideMoving(); video.classList.add('is-playing'); showState(true); });
    video.addEventListener('pause', () => { if (!moving) showState(false); });
    pause.addEventListener('click', () => {
      refused.delete(retry);   // the button decided; a later tap elsewhere must not undo it
      if (pause.dataset.state === 'playing') {
        userPaused = true;
        hideMoving();   // the photograph again (an image cannot be paused)
        video.pause();
        showState(false);
      } else {
        userPaused = false;
        fitSource();
        play();
      }
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && !userPaused && video.paused) play(); });
    portrait.addEventListener('change', fitSource);
    video.addEventListener('loadstart', fitSource, { once: true });
    pause.hidden = false;
    // The film is about to start by itself (or already has): the button says «pause» from the first
    // moment, and turns to «play» only if it does not start. A «play» shown while the film was still
    // loading on a phone read as «tap to start» (Ana, 4 Oct 2026).
    if (!userPaused) {
      if (!video.paused && video.readyState > 2) video.classList.add('is-playing');
      showState(true);
      fitSource();
      play();
    } else {
      video.pause();
      showState(false);
    }
  }

  // ------------------------------------------------------------ short films (gallery, enquiry page)
  // Each film loads and plays only while it is on screen, and stops when it leaves.
  // Each group has one button that pauses its films (moving pictures need a way to stop, WCAG 2.2.2).
  // With reduced motion or data saving they stay as photographs until the visitor asks.
  document.querySelectorAll('[data-films]').forEach((group) => {
    const films = [...group.querySelectorAll('video[data-src]')];
    const button = group.querySelector('[data-films-toggle]');
    if (!films.length || !button || !('IntersectionObserver' in window)) return;
    const label = button.querySelector('[data-films-label]');
    const words = films.length > 1 ? [say.playVideos, say.pauseVideos] : [say.playVideo, say.pauseVideo];
    let paused = !motionOK || Boolean(saveData);
    const onScreen = new Set();
    const showState = () => {
      button.dataset.state = paused ? 'paused' : 'playing';
      label.textContent = words[paused ? 0 : 1];
      if (button.dataset.filmsToggle === 'icon') button.title = label.textContent;
    };
    // Refused (Low Power Mode): the button says «play», truthfully, until the first tap starts them.
    const resume = () => {
      paused = false;
      showState();
      onScreen.forEach(start);
    };
    const start = (film) => {
      if (paused || document.hidden) return;
      if (!film.getAttribute('src')) film.src = film.dataset.src;
      const p = film.play();
      if (p && p.catch) {
        p.catch((error) => {
          if (!isRefusal(error) || paused) return;
          paused = true;
          showState();
          refused.add(resume);
        });
      }
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
    button.addEventListener('click', () => {
      refused.delete(resume);   // the button decided; a later tap elsewhere must not undo it
      paused = !paused;
      showState();
      if (paused) films.forEach((film) => film.pause());
      else onScreen.forEach(start);
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) onScreen.forEach(start); });
    showState();
    button.hidden = false;
  });

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
    enquiry: { title: say.enquiryTitle, text: say.enquiryText },
    review: { title: say.reviewTitle, text: say.reviewText },
  };
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function errorFor(field) {
    if (field.type === 'checkbox') return field.required && !field.checked ? say.tick : '';
    const value = field.value.trim();
    if (field.required && !value) return field.tagName === 'SELECT' ? say.choose : say.fill;
    if (value && field.type === 'email' && !EMAIL.test(value)) return say.email;
    if (value && field.minLength > 0 && value.length < field.minLength) return say.minLength.replace('{n}', field.minLength);
    if (value && field.type === 'number' && field.min && Number(value) < Number(field.min)) return say.min.replace('{n}', field.min);
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

  // When the page opened: a form sent within seconds of it was not typed by a person (the Worker
  // drops it). Sent along with the page's language, so Ana knows which language to answer in.
  const opened = Date.now();
  document.querySelectorAll('form[data-kind]').forEach((form) => {
    const kind = form.dataset.kind;
    const status = form.querySelector('.form__status');
    const fields = [...form.querySelectorAll('input, select, textarea')].filter((f) => f.name !== 'website');

    // ?experience=marriage-proposal preselects the experience
    const wantedExperience = new URLSearchParams(location.search).get('experience');
    const select = form.querySelector('select[name="experience"]');
    if (select && wantedExperience && [...select.options].some((o) => o.value === wantedExperience)) select.value = wantedExperience;

    fields.forEach((field) => {
      field.addEventListener(field.type === 'checkbox' || field.tagName === 'SELECT' ? 'change' : 'blur', () => {
        if (field.getAttribute('aria-invalid') === 'true' || field.value) showError(field, errorFor(field));
      });
      // An error goes as soon as the answer is right, while typing: left for the blur, it went as the
      // finger came down on «Send», the button moved up and the tap missed it.
      field.addEventListener('input', () => {
        if (field.getAttribute('aria-invalid') === 'true' && !errorFor(field)) showError(field, '');
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
        status.textContent = say.attention;
        first.focus();
        return;
      }
      const endpoint = form.dataset.endpoint;
      if (!endpoint) {
        status.textContent = say.notConnected;
        return;
      }
      const button = form.querySelector('button[type="submit"]');
      button.setAttribute('aria-busy', 'true');
      status.textContent = say.sending;
      const data = { ...Object.fromEntries(new FormData(form).entries()), lang: root.lang.startsWith('pt') ? 'pt' : 'en', t: Date.now() - opened };
      try {
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (response.status === 429) {
          button.removeAttribute('aria-busy');
          status.textContent = say.wait;
          return;
        }
        if (response.status === 400) {
          // the Worker names the fields it refused (the same checks as here, and a few more)
          const answer = await response.json().catch(() => ({}));
          const named = fields.filter((f) => (answer.campos || []).includes(f.name));
          if (named.length) {
            named.forEach((f) => showError(f, errorFor(f) || say.check));
            button.removeAttribute('aria-busy');
            status.textContent = say.attention;
            named[0].focus();
            return;
          }
        }
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
        status.textContent = say.failed;
      }
    });
  });
})();
