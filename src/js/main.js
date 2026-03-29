/* mozartforschung.de — main.js */

var REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── Mobile navigation toggle ──────────────────────────────────────────────
(function () {
  var toggle = document.querySelector('.site-nav__toggle');
  var navLinks = document.querySelector('.site-nav__links');
  if (!toggle || !navLinks) return;

  toggle.addEventListener('click', function () {
    var open = navLinks.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  });

  navLinks.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () {
      navLinks.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && navLinks.classList.contains('is-open')) {
      navLinks.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      toggle.focus();
    }
  });
}());

// ── Article TOC: mobile toggle ─────────────────────────────────────────────
(function () {
  var tocToggle = document.querySelector('.toc-toggle');
  var tocEl = document.querySelector('.article-toc');
  if (!tocToggle || !tocEl) return;

  tocToggle.addEventListener('click', function () {
    var open = tocEl.classList.toggle('is-open');
    tocToggle.setAttribute('aria-expanded', String(open));
    tocToggle.querySelector('.toc-toggle__label').textContent =
      open ? 'Inhaltsverzeichnis schließen ↑' : 'Inhaltsverzeichnis ↓';
  });
}());

// ── Article TOC: auto-generate from headings ───────────────────────────────
(function () {
  var tocList = document.getElementById('toc-list');
  var articleMain = document.querySelector('.article-main');
  if (!tocList || !articleMain) return;

  var headings = articleMain.querySelectorAll('p.U1-Titel, p.U2-Titel');
  if (!headings.length) return;

  var counter = 0;
  var tocLinks = [];

  headings.forEach(function (h) {
    var id = 'sec-' + (++counter);
    h.id = id;

    var text = h.textContent.trim().replace(/\s+/g, ' ');
    var label = text.length > 60 ? text.slice(0, 58) + '…' : text;

    var li = document.createElement('li');
    li.className = h.classList.contains('U1-Titel') ? 'toc-level-1' : 'toc-level-2';

    var a = document.createElement('a');
    a.href = '#' + id;
    a.textContent = label;
    li.appendChild(a);
    tocList.appendChild(li);
    tocLinks.push({ el: a, target: h });
  });

  if (!('IntersectionObserver' in window)) return;

  var currentActive = null;
  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var link = tocLinks.find(function (t) { return t.target === entry.target; });
        if (!link) return;
        if (currentActive) currentActive.classList.remove('is-active');
        link.el.classList.add('is-active');
        currentActive = link.el;

        var toc = document.querySelector('.article-toc');
        if (toc) {
          var linkTop = link.el.offsetTop;
          var tocScrollTop = toc.scrollTop;
          var tocHeight = toc.clientHeight;
          if (linkTop < tocScrollTop || linkTop > tocScrollTop + tocHeight - 60) {
            toc.scrollTo({ top: linkTop - tocHeight / 3, behavior: 'smooth' });
          }
        }
      });
    },
    { rootMargin: '-8% 0px -80% 0px', threshold: 0 }
  );

  tocLinks.forEach(function (t) { observer.observe(t.target); });
}());

// ── Card gallery: Flush-Left-Karussell ───────────────────────────────────
//
//  Schlüsselidee: Alle Kacheln werden nach slotPos sortiert und lückenlos
//  nebeneinander gesetzt (flush-left). Keine festen cumX-Positionen —
//  jede Kachel liegt direkt an der rechten Kante der vorherigen.
//  Dadurch können keine Lücken entstehen.
//
//  Eintritt: Kachel wächst aus Ecke (0, H) heraus (Größe 0 → sizes[0]).
//  Austritt: Kachel blendet rechts aus, ohne die anderen zu verschieben.
//
(function () {
  var section = document.querySelector('.gallery-section');
  var sticky  = document.querySelector('.gallery-sticky');
  var track   = document.querySelector('.gallery-track');
  if (!section || !sticky || !track) return;

  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';

  var cards = Array.prototype.slice.call(track.querySelectorAll('.card'));
  var N     = cards.length;
  if (N < 2) return;

  var FRAC_MIN = 0.12, FRAC_MAX = 0.74, FRAC_EXP = 1.4;
  var ENTRY    = 0.70;
  var EXIT     = 0.65;
  var FRICTION = 0.96;
  var MAX_VP   = 0.10;
  var STOP_AT  = 0.0002;  // unter diesem Wert: Loop stoppen, Flimmern verhindern

  // Pre-allozierte Arbeits-Arrays (kein GC im Loop)
  var sizes  = new Array(N);
  var items  = new Array(N);
  for (var ii = 0; ii < N; ii++) {
    items[ii] = { card: cards[ii], sp: 0, size: 0, opacity: 1, x: 0 };
  }
  var cachedH = 0;

  var BASE = 500;   // wird bei erstem computeSizes auf sizes[N-1] gesetzt

  function computeSizes(H) {
    if (H === cachedH) return;
    cachedH = H;
    for (var s = 0; s < N; s++) {
      var ft = s / (N - 1);
      sizes[s] = Math.round((FRAC_MIN + (FRAC_MAX - FRAC_MIN) * Math.pow(ft, FRAC_EXP)) * H);
    }
    // BASE = größte Kachel → scale immer ≤ 1 → kein Upscaling, kein Blur
    BASE = sizes[N - 1];
    sticky.style.setProperty('--card-base', BASE + 'px');
  }

  var P       = 0;
  var vP      = 0;
  var running = false;

  var hint = document.createElement('p');
  hint.className = 'gallery-scroll-hint';
  hint.textContent = 'Scrollen';
  sticky.appendChild(hint);

  function suggestCard() {
    var w = window.innerWidth;
    var fromRight = w >= 1500 ? 4 : w >= 1000 ? 5 : Math.round(N / 2) + 1;
    var idx = N - fromRight;
    if (idx >= 0) items[idx].card.classList.add('card--suggested');
  }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function posMod(v, m) { return ((v % m) + m) % m; }
  function easeInOut(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }

  // ── Render: width/height für scharfe Darstellung, translateX GPU-seitig ──
  function draw() {
    var H = sticky.clientHeight;
    computeSizes(H);

    var exitStart = N - 1 - EXIT;
    var i, item, sp, t, lo, hi;

    for (i = 0; i < N; i++) {
      item = items[i];
      sp   = posMod((N - 1 - i) + P, N);
      if (sp > N - ENTRY) sp -= N;
      item.sp = sp;

      if (sp < 0) {
        t            = (sp + ENTRY) / ENTRY;
        item.size    = Math.round(sizes[0] * easeInOut(t));
        item.opacity = t < 0.4 ? t / 0.4 : 1;
      } else {
        lo           = sp | 0;
        hi           = lo + 1;
        t            = sp - lo;
        item.size    = Math.round(lerp(sizes[lo < N ? lo : N-1],
                                       sizes[hi < N ? hi : N-1], t));
        item.opacity = sp > exitStart ? (N - 1 - sp) / EXIT : 1;
      }
    }

    items.sort(function (a, b) { return a.sp - b.sp; });

    var curX = 0;
    for (i = 0; i < N; i++) {
      item = items[i];
      var px = Math.round(curX);
      var sc = item.size / BASE;
      // Nur transform + opacity — kein width/height = kein Text-Reflow
      item.card.style.transform = 'translateX(' + px + 'px) scale(' + sc + ')';
      item.card.style.opacity   = item.opacity;
      item.card.style.zIndex    = i + 1;
      curX += item.size;
    }
  }

  // ── Loop: stoppt wenn Bewegung zu klein → kein Flimmern im Ruhezustand ──
  function loop() {
    if (vP >  MAX_VP) vP =  MAX_VP;
    if (vP < -MAX_VP) vP = -MAX_VP;
    vP *= FRICTION;
    P  += vP;
    draw();
    if (Math.abs(vP) < STOP_AT) {
      vP      = 0;
      running = false;
      track.classList.remove('carousel-moving');
      // Vorschlag-Karte markieren: 4. von rechts auf kleinen, 6. auf großen Displays
      suggestCard();
      return;   // Loop hält an
    }
    requestAnimationFrame(loop);
  }

  function startLoop() {
    if (!running) {
      running = true;
      track.classList.add('carousel-moving');
      requestAnimationFrame(loop);
    } else {
      track.classList.add('carousel-moving');
    }
    // Vorschlag-Markierung beim nächsten Scrollen entfernen
    cards.forEach(function (c) { c.classList.remove('card--suggested'); });
  }

  draw();        // einmaliger Initialrender
  suggestCard(); // Vorschlag sofort beim Laden

  document.addEventListener('wheel', function (e) {
    e.preventDefault();
    var delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 20;
    if (e.deltaMode === 2) delta *= 400;
    vP += delta * 0.0010;
    startLoop();
  }, { passive: false });

  var touchY = 0;
  document.addEventListener('touchstart', function (e) {
    touchY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchmove', function (e) {
    var dy = touchY - e.touches[0].clientY;
    touchY = e.touches[0].clientY;
    vP += dy * 0.004;
    startLoop();
    e.preventDefault();
  }, { passive: false });

  window.addEventListener('resize', function () {
    cachedH = 0;
    draw();
    cards.forEach(function (c) { c.classList.remove('card--suggested'); });
    if (!running) suggestCard();
  }, { passive: true });
}());



(function () {
  if (REDUCED_MOTION) return;
  if (!('IntersectionObserver' in window)) return;

  var EASING   = 'cubic-bezier(0.33, 1, 0.68, 1)';
  var DURATION = '1.1s';

  // Elements to reveal on the home page
  var PAGE_SELECTORS = [
    '.gallery-label'
  ].join(',');

  // Elements to reveal on sub-pages (impressum etc.)
  var SUB_SELECTORS = [
    '.subsite-content h3',
    '.subsite-content h5',
    '.subsite-content h6',
    '.subsite-content p'
  ].join(',');

  var elements = document.querySelectorAll(PAGE_SELECTORS + ',' + SUB_SELECTORS);
  if (!elements.length) return;

  // Assign stagger delays to pub-items within each group
  document.querySelectorAll('.pub-group').forEach(function (group) {
    group.querySelectorAll('.pub-item').forEach(function (item, i) {
      item.dataset.revealDelay = i * 70;
    });
  });

  // Apply initial hidden state via inline style (progressive enhancement)
  elements.forEach(function (el) {
    el.style.opacity    = '0';
    el.style.transform  = 'translateY(38px)';
    el.style.transition =
      'opacity ' + DURATION + ' ' + EASING + ', ' +
      'transform ' + DURATION + ' ' + EASING;
    el.dataset.revealPending = '1';
  });

  var revealObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el    = entry.target;
        var delay = parseInt(el.dataset.revealDelay || '0', 10);

        setTimeout(function () {
          el.style.opacity   = '1';
          el.style.transform = 'translateY(0)';
          delete el.dataset.revealPending;
        }, delay);

        revealObserver.unobserve(el);
      });
    },
    { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
  );

  elements.forEach(function (el) { revealObserver.observe(el); });
}());

// ── Score strip: scroll-driven 3D wheel ───────────────────────────────────
//
//  The `.score-strip__stage` has a fixed rotateY(28deg) in CSS which creates
//  the 3D perspective gradient: left side small (far), right side large (near).
//  JS drives `.score-strip__track` translateX based on scroll delta,
//  creating the "wheel turning" illusion.
//
(function () {
  var strip = document.querySelector('.score-strip');
  var track = document.querySelector('.score-strip__track');
  if (!strip || !track || REDUCED_MOTION) return;

  var offset   = 0;
  var prevY    = window.scrollY;
  var halfW    = 0;           // calculated after images load
  var ticking  = false;

  function getHalfWidth() {
    // Track contains duplicated images; half-width is the loop point
    halfW = track.scrollWidth / 2;
  }

  function update() {
    ticking = false;
    var currentY = window.scrollY;
    var delta    = currentY - prevY;
    prevY        = currentY;

    // Only animate while strip is near the viewport
    var rect = strip.getBoundingClientRect();
    if (rect.top > window.innerHeight * 1.2 || rect.bottom < -window.innerHeight * 0.2) return;

    // Accumulate offset, wrap seamlessly at half-width
    offset += delta * 0.55;
    if (!halfW) getHalfWidth();
    if (halfW > 0) {
      offset = ((offset % halfW) + halfW) % halfW;
    }

    track.style.transform = 'translateX(-' + offset + 'px)';
  }

  window.addEventListener('scroll', function () {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });

  // Recalculate on resize
  window.addEventListener('resize', getHalfWidth, { passive: true });

  // Initial measurement once images are loaded
  window.addEventListener('load', getHalfWidth);
}());

// ── Scroll-reveal: notation images in article ──────────────────────────────
(function () {
  var imgs = document.querySelectorAll('.article-main img');
  if (!imgs.length) return;

  if (!('IntersectionObserver' in window) || REDUCED_MOTION) {
    imgs.forEach(function (img) { img.classList.add('is-visible'); });
    return;
  }

  var imgObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          imgObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08 }
  );

  imgs.forEach(function (img) {
    img.setAttribute('loading', 'lazy');
    imgObserver.observe(img);
  });
}());

// ── Email obfuscation ──────────────────────────────────────────────────────
window.sendMail = function () {
  var addr = ['kontakt', 'mozartforschung.de'].join('@');
  document.querySelectorAll('#sendMailAnchor, #dshmt').forEach(function (a) {
    a.href = 'mailto:' + addr;
    a.textContent = addr;
  });
};
