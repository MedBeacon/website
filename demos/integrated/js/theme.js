/**
 * Colour theme selection.
 *
 * Loaded from <head> as a *blocking* external script rather than an inline one.
 * Blocking matters: it sets data-theme on <html> before the body paints, so
 * there is no flash of the wrong palette. External matters: the CSP allows no
 * inline script, and a theme toggle is not a good reason to weaken it.
 *
 * Three themes, not two. PowerChart is a light application and the panel has to
 * sit next to it without looking broken, but a full-white card under fluorescent
 * light for a twelve-hour shift is its own problem — so "dim" is a mid-grey that
 * still reads as a light UI. It is the default for that reason.
 */
(function () {
  'use strict';

  var THEMES = ['light', 'dim', 'dark'];
  var DEFAULT_THEME = 'dim';
  var STORAGE_KEY = 'medbeacon.theme';

  var current = DEFAULT_THEME;

  /**
   * localStorage is not guaranteed here. Inside the PowerChart iframe this is
   * third-party storage, so it can be partitioned or refused outright, and
   * Safari throws rather than returning null in private mode. A colour
   * preference is not worth an exception on boot, so every access is guarded
   * and failure just means the choice lasts for this page view only.
   */
  function readStored() {
    try {
      var stored = window.localStorage.getItem(STORAGE_KEY);
      return THEMES.indexOf(stored) === -1 ? null : stored;
    } catch (e) {
      return null;
    }
  }

  function writeStored(theme) {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      // Storage blocked. The theme still applies; it just will not persist.
    }
  }

  function apply(theme) {
    current = THEMES.indexOf(theme) === -1 ? DEFAULT_THEME : theme;
    document.documentElement.setAttribute('data-theme', current);
    syncButtons();
  }

  function syncButtons() {
    var buttons = document.querySelectorAll('[data-theme-choice]');
    for (var i = 0; i < buttons.length; i += 1) {
      var isActive = buttons[i].getAttribute('data-theme-choice') === current;
      buttons[i].setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }
  }

  function onClick(event) {
    var button = event.target.closest
      ? event.target.closest('[data-theme-choice]')
      : null;
    if (!button) return;

    apply(button.getAttribute('data-theme-choice'));
    writeStored(current);

    // The palette does not change layout, but the MPage frame is sized from a
    // measurement taken earlier and re-syncing is free.
    var lib = window.CernerSmartEmbeddableLib;
    if (lib && typeof lib.setFrameHeight === 'function') {
      try {
        lib.setFrameHeight(lib.calcFrameHeight() + 'px');
      } catch (e) {
        // Not embedded. Not fatal.
      }
    }
  }

  // Runs at parse time, before <body> exists, which is the whole point.
  apply(readStored() || DEFAULT_THEME);

  document.addEventListener('DOMContentLoaded', function () {
    var bar = document.getElementById('theme-bar');
    if (!bar) return;
    bar.addEventListener('click', onClick);
    syncButtons();
  });

  window.MedBeaconTheme = {
    get: function () { return current; },
    set: function (theme) { apply(theme); writeStored(current); }
  };
}());
