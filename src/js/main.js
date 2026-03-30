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

// ── Card gallery ─────────────────────────────────────────────────────────
//  6 fixe Slots (Treppe). Wheel/Touch → Offset +1/-1 → data-slot auf Cards.
//  CSS erledigt alle Transforms (GPU) und den Flip für Slot 5.
(function () {
  var sticky = document.getElementById('gallery-sticky');
  if (!sticky) return;

  var cards  = Array.prototype.slice.call(sticky.querySelectorAll('.card'));
  var TOTAL  = cards.length;   // 8 (oder mehr)
  var VISIBLE = 6;
  var offset  = 0;
  var locked  = false;

  function place() {
    cards.forEach(function (card, i) {
      var slot = ((VISIBLE - 1 - i - offset) % TOTAL + TOTAL) % TOTAL;
      if (slot < VISIBLE) {
        card.dataset.slot = slot;
      } else {
        delete card.dataset.slot;
      }
    });
  }

  place(); // Startzustand ohne Animation

  function step(dir) {
    if (locked) return;
    locked = true;
    setTimeout(function () { locked = false; }, 680);
    offset = (offset + dir + TOTAL) % TOTAL;
    place();
  }

  // Wheel
  sticky.addEventListener('wheel', function (e) {
    e.preventDefault();
    step(e.deltaY > 0 ? -1 : 1);
  }, { passive: false });

  // Touch
  var touchX = 0;
  sticky.addEventListener('touchstart', function (e) {
    touchX = e.touches[0].clientX;
  }, { passive: true });
  sticky.addEventListener('touchend', function (e) {
    var diff = touchX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) step(diff > 0 ? -1 : 1);
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
