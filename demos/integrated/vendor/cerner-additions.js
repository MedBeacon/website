/*
 * Adapted from cerner/fhir-client-cerner-additions (Apache-2.0, Cerner
 * Innovation Inc.). That repository was archived 2024-02-12 and was never
 * published to npm, so it is vendored here rather than installed.
 *
 * Upstream does exactly one thing: detect PowerChart and, when detected, set
 * `FHIR.oauth2.settings.fullSessionStorageSupport = false` so fhir-client stops
 * using sessionStorage. PowerChart runs its embedded browser instances on a
 * single thread and they share sessionStorage, so two MPages can read each
 * other's SMART state.
 *
 * What changed here and why:
 *
 *   MedBeacon completes the OAuth handshake on the server and keeps the token
 *   in a server-side session, so the browser never has SMART state to store.
 *   The sessionStorage hazard upstream defends against does not exist in this
 *   architecture. The upstream override is still applied if a fhir-client
 *   global is ever loaded into the page, so adding that library later cannot
 *   silently reintroduce the problem.
 *
 *   The PowerChart detection itself is kept verbatim and exported, because the
 *   rest of the app needs to know whether it is embedded.
 */
(function (window) {
  'use strict';

  /**
   * PowerChart exposes a Discern COM factory on window.external. This is the
   * upstream detection, unchanged.
   */
  function isPowerChart() {
    return !!(window.external && typeof window.external.DiscernObjectFactory !== 'undefined');
  }

  /**
   * Upstream behavior, applied only if fhir-client is present. A no-op in the
   * current architecture; a real safeguard if fhir-client is added later.
   */
  function applyFullSessionStorageSupport() {
    var FHIR = window.FHIR;
    if (FHIR && FHIR.oauth2 && FHIR.oauth2.settings) {
      FHIR.oauth2.settings.fullSessionStorageSupport = !isPowerChart();
      return true;
    }
    return false;
  }

  applyFullSessionStorageSupport();

  window.MedBeaconCernerAdditions = {
    isPowerChart: isPowerChart,
    applyFullSessionStorageSupport: applyFullSessionStorageSupport
  };
}(window));
