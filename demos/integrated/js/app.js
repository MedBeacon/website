/**
 * Redirect URI entry point — https://localhost:3000/index.html
 *
 * Cerner sends the browser back here with `code` and `state`. Those go to the
 * server, which does the token exchange with the client secret and hands back
 * launch context only. From then on every read goes through /api/fhir.
 */
(function () {
  'use strict';

  var R = window.MedBeaconRender;
  var Api = window.MedBeaconApi;

  var ui = {
    boot: document.getElementById('boot'),
    bootStatus: document.getElementById('boot-status'),
    fatal: document.getElementById('fatal'),
    fatalTitle: document.getElementById('fatal-title'),
    fatalBody: document.getElementById('fatal-body'),
    fatalHint: document.getElementById('fatal-hint'),
    fatalRetry: document.getElementById('fatal-retry'),
    app: document.getElementById('app'),
    banner: document.getElementById('banner'),
    bannerName: document.getElementById('banner-name'),
    bannerMeta: document.getElementById('banner-meta'),
    bannerMrn: document.getElementById('banner-mrn'),
    noPatient: document.getElementById('no-patient'),
    grid: document.getElementById('grid'),
    demographics: document.getElementById('demographics'),
    vitals: document.getElementById('vitals'),
    vitalsNote: document.getElementById('vitals-note'),
    conditions: document.getElementById('conditions'),
    conditionsNote: document.getElementById('conditions-note'),
    statusList: document.getElementById('status-list')
  };

  function inPowerChart() {
    return !!(window.MedBeaconCernerAdditions
      && window.MedBeaconCernerAdditions.isPowerChart());
  }

  /**
   * Tells the MPage container how tall we are.
   *
   * The frame does not resize itself, so without this the app is clipped at
   * whatever height PowerChart guessed.
   */
  function syncFrameHeight() {
    var lib = window.CernerSmartEmbeddableLib;
    if (!lib || typeof lib.setFrameHeight !== 'function') return;
    try {
      lib.setFrameHeight(lib.calcFrameHeight() + 'px');
    } catch (e) {
      // Not embedded, or the consumer never authorized us. Not fatal.
    }
  }

  function showFatal(title, body, hint, onRetry) {
    ui.boot.hidden = true;
    ui.app.hidden = true;
    ui.fatalTitle.textContent = title;
    ui.fatalBody.textContent = body;

    if (hint) {
      ui.fatalHint.textContent = hint;
      ui.fatalHint.hidden = false;
    } else {
      ui.fatalHint.hidden = true;
    }

    if (onRetry) {
      ui.fatalRetry.hidden = false;
      ui.fatalRetry.onclick = onRetry;
    } else {
      ui.fatalRetry.hidden = true;
    }

    ui.fatal.hidden = false;
    syncFrameHeight();
  }

  function describeFailure(error) {
    var payload = error.payload || {};

    // Never having launched and having launched an hour ago are different
    // situations. Telling someone their session "ended" when they simply opened
    // the page directly sends them looking for a problem that is not there.
    if (payload.error === 'no_session') {
      return {
        title: 'Not launched',
        body: 'This page is where Oracle Health sends you back to after '
          + 'sign-in, so opening it directly leaves nothing to restore.',
        hint: 'Launch MedBeacon from a patient\'s chart in PowerChart to start '
          + 'a session.'
      };
    }

    if (error.status === 401 || payload.reauth) {
      return {
        title: 'Session ended',
        body: 'The SMART session is no longer valid.',
        hint: 'Relaunch MedBeacon from the patient chart in PowerChart. The '
          + 'launch token is single-use, so refreshing this page will not '
          + 'recover it.'
      };
    }
    return {
      title: 'Could not load the chart',
      body: error.message || 'The request failed.',
      hint: error.payload && error.payload.hint ? error.payload.hint : null
    };
  }

  /** One card failing should not blank the ones that loaded. */
  function cardError(node, noteNode, error) {
    var text = error.status === 403
      ? 'Blocked: ' + (error.message || 'outside the launched patient context.')
      : (error.message || 'Could not load this section.');
    R.message(node, 'mb-error-line', text);
    if (noteNode) noteNode.textContent = '';
  }

  function loadDemographics(patientId) {
    R.loading(ui.demographics, 'Loading demographics…');

    return Api.fhir('Patient/' + encodeURIComponent(patientId))
      .then(function (patient) {
        R.demographics(ui.demographics, patient);

        // need_patient_banner false means PowerChart is already showing one.
        // Drawing a second is a standard review finding.
        if (!ui.banner.hidden) {
          R.patientBanner(patient, {
            banner: ui.banner,
            name: ui.bannerName,
            meta: ui.bannerMeta,
            mrn: ui.bannerMrn
          });
        }
      })
      .catch(function (error) { cardError(ui.demographics, null, error); })
      // Cards land at different times, so the frame is resized as each settles
      // rather than only once everything has arrived.
      .then(syncFrameHeight);
  }

  function loadVitals() {
    R.loading(ui.vitals, 'Loading vitals…');

    // No patient param: the proxy binds the launched patient. `category` is
    // required here — Cerner will not run an unqualified Observation search.
    return Api.fhir('Observation', { category: 'vital-signs', _count: 100 })
      .then(function (bundle) {
        R.vitals(ui.vitals, R.bundleEntries(bundle), ui.vitalsNote);
      })
      .catch(function (error) { cardError(ui.vitals, ui.vitalsNote, error); })
      .then(syncFrameHeight);
  }

  function loadConditions() {
    // The slowest of the three: Millennium ignores _count here and returns the
    // entire active problem list, which is why this card needs its own label.
    R.loading(ui.conditions, 'Loading conditions…');

    return Api.fhir('Condition', { 'clinical-status': 'active', _count: 50 })
      .then(function (bundle) {
        R.conditions(ui.conditions, R.bundleEntries(bundle), ui.conditionsNote);
      })
      .catch(function (error) { cardError(ui.conditions, ui.conditionsNote, error); })
      .then(syncFrameHeight);
  }

  function onContext(context) {
    // Drop `code` and `state` from the visible URL. They are spent, and leaving
    // them in place means a refresh retries a code the server already used.
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    ui.boot.hidden = true;
    ui.app.hidden = false;

    R.statusBar(ui.statusList, context, { powerChart: inPowerChart() });

    if (!context.patientId) {
      // No-patient provider launch. Milestone 4 turns this into the acuity list;
      // nothing above needs to change for that.
      ui.noPatient.hidden = false;
      syncFrameHeight();
      return Promise.resolve();
    }

    ui.banner.hidden = context.needPatientBanner === false;
    ui.grid.hidden = false;

    return Promise.all([
      loadDemographics(context.patientId),
      loadVitals(),
      loadConditions()
    ]).then(syncFrameHeight);
  }

  function start() {
    var search = window.location.search;
    var params = new URLSearchParams(search);

    if (params.get('error')) {
      showFatal(
        'Authorization denied',
        params.get('error_description') || params.get('error'),
        'Oracle Health refused the authorization request.'
      );
      return;
    }

    var hasCode = params.has('code');
    ui.bootStatus.textContent = hasCode
      ? 'Completing sign-in…'
      : 'Restoring session…';

    var pending = hasCode ? Api.completeAuth(search) : Api.context();

    pending
      .then(onContext)
      .catch(function (error) {
        var described = describeFailure(error);
        showFatal(described.title, described.body, described.hint);
      });
  }

  start();
}());
