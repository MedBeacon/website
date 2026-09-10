/**
 * Static-demo replacement for api.js.
 *
 * The published demo (medbeacon.ai/demos/integrated/) has no server, so the
 * two things the server did for the browser have to happen here instead:
 * supply the launch context, and reach FHIR.
 *
 * That is possible only because Cerner publishes an *open* R4 sandbox at
 * fhir-open.cerner.com. It serves the same synthetic patients as the secure
 * endpoint, takes no authorization at all, and answers with
 * `Access-Control-Allow-Origin: *`, so the browser can read it directly. No
 * token, no client secret, and nothing here that is not already public.
 *
 * What this file gives up, and why that is acceptable for a demo:
 *   - The patient-context guard lived in the proxy. Here the patient id is a
 *     constant and every patient-scoped search is bound to it below, so there
 *     is no user-supplied input that could widen the query.
 *   - Bundle paging links point at Cerner rather than being rewritten. The
 *     demo renders the first page only, which is what the cards show anyway.
 *
 * This file is swapped in for api.js by scripts/build-static-demo.mjs. It is
 * never served by the real app, which keeps its token server-side.
 */
window.MedBeaconApi = (function () {
  'use strict';

  /** Cerner's open R4 sandbox. Public, unauthenticated, synthetic data. */
  var FHIR_BASE =
    'https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d';

  /**
   * Valerie Smart — the sandbox patient whose vitals actually trip a sepsis
   * screen (39.3 C, HR 131, RR 30, BP 82/50: SIRS 3, qSOFA 2) with septic
   * shock on the problem list. Picked because it exercises every renderer.
   * See docs/sandbox-findings.md.
   */
  var PATIENT_ID = '12724071';

  /**
   * Resource types in the patient compartment. Mirrors PATIENT_SCOPED in
   * server/lib/fhir-allowlist.js: these get the patient bound in, so a search
   * cannot come back with someone else's data.
   */
  var PATIENT_SCOPED = [
    'Encounter', 'Observation', 'Condition', 'DiagnosticReport', 'Specimen',
    'MedicationAdministration', 'AllergyIntolerance', 'Procedure',
    'MedicationRequest'
  ];

  /** Same shape publicContext() returns, so app.js needs no changes. */
  var CONTEXT = {
    authenticated: true,
    patientId: PATIENT_ID,
    encounterId: null,
    userId: null,
    userResourceType: null,
    fhirUser: null,
    tenant: 'ec2458f2-1e24-41c8-b71b-0e701af7583d',
    // No PowerChart around this build, so the app draws its own banner.
    needPatientBanner: true,
    smartStyleUrl: null,
    grantedScope: '(static demo - open endpoint, unauthenticated)',
    expiresAt: null,
    fhirBaseUrl: FHIR_BASE
  };

  function request(url) {
    return fetch(url, {
      method: 'GET',
      // Cerner answers 406 without this.
      headers: { Accept: 'application/fhir+json' }
    }).then(function (response) {
      return response.text().then(function (text) {
        var body;
        try {
          body = text ? JSON.parse(text) : {};
        } catch (e) {
          body = { message: text };
        }

        if (!response.ok) {
          var err = new Error(
            (body.issue && body.issue[0] && body.issue[0].diagnostics)
              || body.message || response.statusText || 'Request failed'
          );
          err.status = response.status;
          err.payload = body;
          throw err;
        }
        return body;
      });
    });
  }

  function resourceTypeOf(path) {
    return String(path).split('/')[0];
  }

  return {
    completeAuth: function () { return Promise.resolve(CONTEXT); },

    context: function () { return Promise.resolve(CONTEXT); },

    fhir: function (path, params) {
      var search = new URLSearchParams();
      if (params) {
        Object.keys(params).forEach(function (key) {
          if (params[key] !== undefined && params[key] !== null) {
            search.set(key, params[key]);
          }
        });
      }

      // The proxy used to bind this. A read of a single resource by id
      // (`Patient/123`) is already specific, so it only applies to searches.
      var type = resourceTypeOf(path);
      var isSearch = String(path).indexOf('/') === -1;
      if (isSearch && PATIENT_SCOPED.indexOf(type) !== -1) {
        search.set('patient', PATIENT_ID);
      }

      var query = search.toString();
      return request(FHIR_BASE + '/' + path + (query ? '?' + query : ''));
    }
  };
}());
