/* Kleines Skript für die wenigen interaktiven Teile der Website.
 *
 * Ersetzt jQuery, das Bootstrap-JS-Bundle und clean-blog.min.js: davon wurde
 * am Ende nur noch das Aufklappen der Navigation gebraucht (keine Modals,
 * keine Dropdowns). Das spart rund 164 KB JavaScript pro Seitenaufruf.
 */
(function () {
  'use strict';

  /* --- Navigation aufklappen (ersetzt Bootstrap Collapse) ---------------- */

  function initNavToggle() {
    var toggler = document.querySelector('.navbar-toggler[data-target]');
    if (!toggler) { return; }

    var target = document.querySelector(toggler.getAttribute('data-target'));
    if (!target) { return; }

    function setOpen(open) {
      target.classList.toggle('show', open);
      toggler.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    toggler.addEventListener('click', function () {
      setOpen(!target.classList.contains('show'));
    });

    // Nach einem Klick auf einen Menüpunkt wieder schließen.
    target.addEventListener('click', function (e) {
      if (e.target.closest('a')) { setOpen(false); }
    });

    // Beim Wechsel auf Desktopbreite den Zustand zurücksetzen.
    var wide = window.matchMedia('(min-width: 992px)');
    var reset = function () { if (wide.matches) { setOpen(false); } };
    if (wide.addEventListener) { wide.addEventListener('change', reset); }
  }

  /* --- Navigationsleiste beim Scrollen ein- und ausblenden --------------- */
  /* Verhalten aus clean-blog.min.js, nur ohne jQuery.                      */

  function initNavScroll() {
    var nav = document.getElementById('mainNav');
    if (!nav || window.innerWidth <= 992) { return; }

    var navHeight = nav.offsetHeight;
    var previousTop = window.pageYOffset;
    var ticking = false;

    function update() {
      var current = window.pageYOffset;
      if (current < previousTop) {
        if (current > 0 && nav.classList.contains('is-fixed')) {
          nav.classList.add('is-visible');
        } else {
          nav.classList.remove('is-visible', 'is-fixed');
        }
      } else if (current > previousTop) {
        nav.classList.remove('is-visible');
        if (current > navHeight && !nav.classList.contains('is-fixed')) {
          nav.classList.add('is-fixed');
        }
      }
      previousTop = current;
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });
  }

  /* --- Schwebende Beschriftungen im Kontaktformular ---------------------- */

  function initFloatingLabels() {
    var groups = document.querySelectorAll('.floating-label-form-group');
    if (!groups.length) { return; }

    Array.prototype.forEach.call(groups, function (group) {
      var field = group.querySelector('input, textarea, select');
      if (!field) { return; }

      function sync() {
        group.classList.toggle('floating-label-form-group-with-value', !!field.value);
      }

      field.addEventListener('input', sync);
      field.addEventListener('change', sync);
      field.addEventListener('focus', function () {
        group.classList.add('floating-label-form-group-with-focus');
      });
      field.addEventListener('blur', function () {
        group.classList.remove('floating-label-form-group-with-focus');
      });
      sync();
    });
  }

  /* --- Jahreszahl in der Fußzeile ---------------------------------------- */

  function initCurrentYear() {
    var el = document.getElementById('currentYear');
    if (el) { el.textContent = new Date().getFullYear(); }
  }

  function init() {
    initNavToggle();
    initNavScroll();
    initFloatingLabels();
    initCurrentYear();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
