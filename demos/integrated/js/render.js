/**
 * DOM rendering.
 *
 * Everything here writes with textContent. FHIR resources carry a `text.div`
 * narrative that is real HTML authored upstream, and free-text fields pass
 * through whatever was typed into the chart — none of it gets to be markup.
 */
window.MedBeaconRender = (function () {
  'use strict';

  var LOINC = 'http://loinc.org';

  // ---------------------------------------------------------------- elements

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  function definition(list, term, value, valueClass) {
    list.appendChild(el('dt', 'mb-dl__term', term));
    list.appendChild(el('dd', valueClass || 'mb-dl__value', value));
  }

  function message(node, className, text) {
    clear(node).appendChild(el('p', className, text));
  }

  /**
   * Busy state for a card.
   *
   * role="status" announces the label to screen readers when it appears; the
   * spinner itself is decorative and hidden from them. Labels are per-card
   * rather than a generic "Loading" so a slow section identifies itself.
   */
  function loading(node, label) {
    var wrap = el('div', 'mb-loading-state');
    wrap.setAttribute('role', 'status');

    var spinner = el('div', 'mb-spinner');
    spinner.setAttribute('aria-hidden', 'true');

    wrap.appendChild(spinner);
    wrap.appendChild(el('span', 'mb-loading-state__label', label || 'Loading…'));
    clear(node).appendChild(wrap);
  }

  // -------------------------------------------------------------------- time

  function parseDate(value) {
    if (!value) return null;
    var date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  var dateTimeFormat = new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  var dateFormat = new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'short', day: 'numeric'
  });

  function formatDateTime(value) {
    var date = parseDate(value);
    return date ? dateTimeFormat.format(date) : '—';
  }

  function formatDate(value) {
    var date = parseDate(value);
    return date ? dateFormat.format(date) : '—';
  }

  function formatDuration(ms) {
    if (!isFinite(ms) || ms <= 0) return null;
    var minutes = ms / 60000;
    if (minutes < 90) return Math.round(minutes) + ' min';
    var hours = minutes / 60;
    if (hours < 48) return Math.round(hours) + ' h';
    return Math.round(hours / 24) + ' d';
  }

  function ageFrom(birthDate) {
    var born = parseDate(birthDate);
    if (!born) return null;
    var now = new Date();
    var years = now.getFullYear() - born.getFullYear();
    var monthDelta = now.getMonth() - born.getMonth();
    if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < born.getDate())) years -= 1;
    return years >= 0 ? years : null;
  }

  // ------------------------------------------------------------------- FHIR

  function bundleEntries(bundle) {
    if (!bundle || !Array.isArray(bundle.entry)) return [];
    return bundle.entry
      .map(function (entry) { return entry && entry.resource; })
      .filter(Boolean);
  }

  function humanName(patient) {
    var names = patient && Array.isArray(patient.name) ? patient.name : [];
    if (!names.length) return 'Unnamed patient';

    var preferred = names.filter(function (n) { return n.use === 'official'; })[0]
      || names.filter(function (n) { return n.use === 'usual'; })[0]
      || names[0];

    if (preferred.text) return preferred.text;

    var given = Array.isArray(preferred.given) ? preferred.given.join(' ') : '';
    return [given, preferred.family].filter(Boolean).join(' ') || 'Unnamed patient';
  }

  function medicalRecordNumber(patient) {
    var identifiers = patient && Array.isArray(patient.identifier) ? patient.identifier : [];

    var mrn = identifiers.filter(function (id) {
      var codings = id.type && Array.isArray(id.type.coding) ? id.type.coding : [];
      return codings.some(function (c) { return c.code === 'MR'; });
    })[0];

    if (!mrn) {
      mrn = identifiers.filter(function (id) {
        return id.type && typeof id.type.text === 'string'
          && /mrn|medical record/i.test(id.type.text);
      })[0];
    }

    return mrn ? mrn.value : null;
  }

  function codeableText(concept) {
    if (!concept) return null;
    if (concept.text) return concept.text;
    var codings = Array.isArray(concept.coding) ? concept.coding : [];
    for (var i = 0; i < codings.length; i += 1) {
      if (codings[i].display) return codings[i].display;
    }
    return codings.length ? codings[0].code : null;
  }

  /** Stable grouping key: LOINC when present, display text otherwise. */
  function observationKey(observation) {
    var codings = observation.code && Array.isArray(observation.code.coding)
      ? observation.code.coding : [];
    for (var i = 0; i < codings.length; i += 1) {
      if (codings[i].system === LOINC && codings[i].code) return LOINC + '|' + codings[i].code;
    }
    return 'text|' + (codeableText(observation.code) || 'Unknown');
  }

  function quantityText(quantity) {
    if (!quantity || quantity.value === undefined || quantity.value === null) return null;
    var unit = quantity.unit || quantity.code || '';
    return unit ? quantity.value + ' ' + unit : String(quantity.value);
  }

  /**
   * Blood pressure arrives as a panel with no top-level value — systolic and
   * diastolic live in `component[]`. Rendering only `valueQuantity` shows a
   * blank row for the one vital sepsis screening cares most about.
   */
  function observationValue(observation) {
    var direct = quantityText(observation.valueQuantity);
    if (direct) return direct;

    if (typeof observation.valueString === 'string') return observation.valueString;
    if (observation.valueCodeableConcept) return codeableText(observation.valueCodeableConcept);
    if (observation.valueBoolean !== undefined) return observation.valueBoolean ? 'Yes' : 'No';

    var components = Array.isArray(observation.component) ? observation.component : [];
    if (components.length) {
      var systolic = null;
      var diastolic = null;
      var others = [];

      components.forEach(function (component) {
        var label = codeableText(component.code) || '';
        var value = quantityText(component.valueQuantity);
        if (!value) return;
        if (/systolic/i.test(label)) systolic = component.valueQuantity;
        else if (/diastolic/i.test(label)) diastolic = component.valueQuantity;
        else others.push(label + ' ' + value);
      });

      if (systolic && diastolic) {
        var unit = systolic.unit || diastolic.unit || '';
        return systolic.value + '/' + diastolic.value + (unit ? ' ' + unit : '');
      }
      if (others.length) return others.join(', ');
    }

    if (observation.dataAbsentReason) {
      return codeableText(observation.dataAbsentReason) || 'Not recorded';
    }
    return null;
  }

  function observationTime(observation) {
    return observation.effectiveDateTime
      || (observation.effectivePeriod && observation.effectivePeriod.start)
      || observation.issued
      || null;
  }

  function isAbnormal(observation) {
    var interpretations = Array.isArray(observation.interpretation)
      ? observation.interpretation : [];
    return interpretations.some(function (entry) {
      var codings = Array.isArray(entry.coding) ? entry.coding : [];
      return codings.some(function (c) {
        return ['H', 'HH', 'L', 'LL', 'A', 'AA', 'POS'].indexOf(c.code) !== -1;
      });
    });
  }

  // -------------------------------------------------------------- renderers

  function patientBanner(patient, elements) {
    var age = ageFrom(patient.birthDate);
    var parts = [];
    if (patient.gender) parts.push(patient.gender);
    if (age !== null) parts.push(age + ' yr');
    if (patient.birthDate) parts.push('DOB ' + formatDate(patient.birthDate));

    elements.name.textContent = humanName(patient);
    elements.meta.textContent = parts.join(' · ');

    var mrn = medicalRecordNumber(patient);
    elements.mrn.textContent = mrn ? 'MRN ' + mrn : '';

    if (patient.deceasedBoolean || patient.deceasedDateTime) {
      elements.banner.classList.add('mb-banner--deceased');
      elements.meta.textContent += ' · Deceased';
    }
  }

  function demographics(node, patient) {
    var list = el('dl', 'mb-dl');
    var age = ageFrom(patient.birthDate);

    definition(list, 'Name', humanName(patient));
    definition(list, 'Sex', patient.gender || '—');
    definition(list, 'Date of birth',
      patient.birthDate ? formatDate(patient.birthDate) + (age !== null ? ' (' + age + ' yr)' : '') : '—');
    definition(list, 'MRN', medicalRecordNumber(patient) || '—', 'mb-dl__value mb-dl__value--mono');

    var maritalStatus = codeableText(patient.maritalStatus);
    if (maritalStatus) definition(list, 'Marital status', maritalStatus);

    if (patient.deceasedBoolean || patient.deceasedDateTime) {
      definition(list, 'Deceased',
        patient.deceasedDateTime ? formatDate(patient.deceasedDateTime) : 'Yes',
        'mb-dl__value mb-dl__value--alert');
    }

    definition(list, 'FHIR id', patient.id || '—', 'mb-dl__value mb-dl__value--mono');

    clear(node).appendChild(list);
  }

  /**
   * Groups vitals by measure and reports the latest reading plus how often it
   * is recorded.
   *
   * The cadence column is not decoration: the sepsis detection model needs a
   * known sampling interval, and Millennium's real recording frequency is one
   * of the open questions this skeleton exists to answer.
   */
  function vitals(node, observations, noteNode) {
    if (!observations.length) {
      message(node, 'mb-empty-line', 'No vital-sign observations returned for this patient.');
      if (noteNode) noteNode.textContent = '';
      return;
    }

    var groups = {};
    observations.forEach(function (observation) {
      var key = observationKey(observation);
      if (!groups[key]) {
        groups[key] = { label: codeableText(observation.code) || 'Unknown', readings: [] };
      }
      groups[key].readings.push(observation);
    });

    var rows = Object.keys(groups).map(function (key) {
      var group = groups[key];

      group.readings.sort(function (a, b) {
        var left = parseDate(observationTime(a));
        var right = parseDate(observationTime(b));
        return (right ? right.getTime() : 0) - (left ? left.getTime() : 0);
      });

      var stamps = group.readings
        .map(function (o) { return parseDate(observationTime(o)); })
        .filter(Boolean)
        .map(function (d) { return d.getTime(); });

      var cadence = null;
      if (stamps.length > 1) {
        var gaps = [];
        for (var i = 1; i < stamps.length; i += 1) gaps.push(stamps[i - 1] - stamps[i]);
        gaps.sort(function (a, b) { return a - b; });
        cadence = formatDuration(gaps[Math.floor(gaps.length / 2)]);
      }

      return {
        label: group.label,
        latest: group.readings[0],
        count: group.readings.length,
        cadence: cadence,
        sortKey: stamps.length ? stamps[0] : 0
      };
    });

    rows.sort(function (a, b) { return b.sortKey - a.sortKey; });

    var table = el('table', 'mb-table');
    var head = el('thead');
    var headRow = el('tr');
    ['Measure', 'Latest', 'Recorded', 'n', 'Median gap'].forEach(function (label, index) {
      var cell = el('th', index === 0 ? 'mb-table__th' : 'mb-table__th mb-table__th--num', label);
      cell.setAttribute('scope', 'col');
      headRow.appendChild(cell);
    });
    head.appendChild(headRow);
    table.appendChild(head);

    var body = el('tbody');
    rows.forEach(function (row) {
      var tr = el('tr', 'mb-table__row');
      tr.appendChild(el('td', 'mb-table__td', row.label));

      var valueText = observationValue(row.latest);
      var valueCell = el('td', 'mb-table__td mb-table__td--value', valueText || '—');
      if (isAbnormal(row.latest)) {
        valueCell.classList.add('mb-table__td--abnormal');
        valueCell.title = 'Flagged abnormal by the source system';
      }
      tr.appendChild(valueCell);

      tr.appendChild(el('td', 'mb-table__td mb-table__td--num',
        formatDateTime(observationTime(row.latest))));
      tr.appendChild(el('td', 'mb-table__td mb-table__td--num', String(row.count)));
      tr.appendChild(el('td', 'mb-table__td mb-table__td--num', row.cadence || '—'));
      body.appendChild(tr);
    });

    table.appendChild(body);

    // The frame can be narrower than the table's minimum. Scroll the table,
    // never the page — a horizontal scrollbar on the body is an embedding bug.
    var scroller = el('div', 'mb-table-wrap');
    scroller.appendChild(table);
    clear(node).appendChild(scroller);

    if (noteNode) {
      noteNode.textContent = rows.length + ' measures · '
        + observations.length + ' observations';
    }
  }

  /**
   * Millennium ignores `_count` on Condition — it returns the patient's entire
   * active problem list in one page, with no `next` link. Sandbox patient
   * 12724066 comes back with 472. Capping is done here rather than pretending
   * the server paginated.
   */
  var CONDITION_DISPLAY_LIMIT = 25;

  function conditions(node, resources, noteNode) {
    if (!resources.length) {
      message(node, 'mb-empty-line', 'No active conditions returned for this patient.');
      if (noteNode) noteNode.textContent = '';
      return;
    }

    var sorted = resources.slice().sort(function (a, b) {
      var left = parseDate(a.recordedDate || a.onsetDateTime);
      var right = parseDate(b.recordedDate || b.onsetDateTime);
      return (right ? right.getTime() : 0) - (left ? left.getTime() : 0);
    });

    var shown = sorted.slice(0, CONDITION_DISPLAY_LIMIT);

    // --columns lets the card use its full width instead of running the list
    // down a single narrow ribbon. See .mb-list--columns in app.css.
    var list = el('ul', 'mb-list mb-list--columns');
    shown.forEach(function (condition) {
      var item = el('li', 'mb-list__item');

      item.appendChild(el('span', 'mb-list__label',
        codeableText(condition.code) || 'Unspecified condition'));

      var meta = el('span', 'mb-list__meta');
      var status = codeableText(condition.clinicalStatus);
      if (status) meta.appendChild(el('span', 'mb-badge', status));

      var when = condition.onsetDateTime || condition.recordedDate;
      if (when) meta.appendChild(el('span', 'mb-list__when', formatDate(when)));

      item.appendChild(meta);
      list.appendChild(item);
    });

    clear(node).appendChild(list);

    if (sorted.length > shown.length) {
      node.appendChild(el(
        'p',
        'mb-empty-line',
        'Showing the ' + shown.length + ' most recent of ' + sorted.length
          + '. Millennium returns the full problem list in one page.'
      ));
    }

    if (noteNode) {
      noteNode.textContent = sorted.length > shown.length
        ? shown.length + ' of ' + sorted.length
        : sorted.length + ' active';
    }
  }

  /**
   * dt/dd are wrapped per pair so the bar can be a grid of items rather than a
   * grid of loose cells, which is what lets terms stay attached to their values
   * as the frame narrows. HTML5 permits dl > div > (dt, dd).
   */
  function statusItem(list, term, value, mono) {
    var wrap = el('div', 'mb-status__item');
    wrap.appendChild(el('dt', 'mb-status__term', term));
    wrap.appendChild(el('dd', mono ? 'mb-status__value mb-status__value--mono' : 'mb-status__value', value));
    list.appendChild(wrap);
  }

  function statusBar(node, context, extras) {
    var list = clear(node);

    statusItem(list, 'User', context.fhirUser || context.userId || '—');
    statusItem(list, 'Tenant', context.tenant || '—', true);
    statusItem(list, 'FHIR base', context.fhirBaseUrl || '—', true);

    if (context.encounterId) statusItem(list, 'Encounter', context.encounterId, true);
    if (context.expiresAt) statusItem(list, 'Token expires', formatDateTime(context.expiresAt * 1000));

    statusItem(list, 'Embedded', (extras && extras.powerChart) ? 'PowerChart' : 'Standalone browser');
  }

  return {
    el: el,
    clear: clear,
    message: message,
    loading: loading,
    bundleEntries: bundleEntries,
    humanName: humanName,
    patientBanner: patientBanner,
    demographics: demographics,
    vitals: vitals,
    conditions: conditions,
    statusBar: statusBar
  };
}());
