/* Tin Kettle Kitchen (demo website): the live open/closed line, today's hours, menu tabs,
   the table request and its WhatsApp preview, the rating tooltip and demo toasts.
   Plain JavaScript. Nothing is sent or stored: the table request only shows what would be sent. */
(function () {
  'use strict';

  var dataEl = document.getElementById('tk-data');
  var data = dataEl ? JSON.parse(dataEl.textContent) : { hours: {} };
  var hours = data.hours || {};
  var KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  var DAYS = { sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday' };
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function mins(hhmm) { var p = hhmm.split(':'); return Number(p[0]) * 60 + Number(p[1]); }
  function hhmm(m) { return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2); }
  function longDate(d) { return DAYS[KEYS[d.getDay()]] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()]; }

  /* ---------- open now / closed, from the browser's clock ---------- */
  function status(now) {
    var key = KEYS[now.getDay()];
    var today = hours[key];
    var m = now.getHours() * 60 + now.getMinutes();
    if (today && m >= mins(today[0]) && m < mins(today[1])) return { open: true, text: 'Open now, closes ' + today[1] };
    if (today && m < mins(today[0])) return { open: false, text: 'Closed. Opens today ' + today[0] };
    for (var i = 1; i <= 7; i++) {
      var k = KEYS[(now.getDay() + i) % 7];
      if (hours[k]) return { open: false, text: 'Closed. Opens ' + (i === 1 ? 'tomorrow' : DAYS[k]) + ' ' + hours[k][0] };
    }
    return { open: false, text: 'Closed' };
  }

  var lines = document.querySelectorAll('[data-tk-status]');
  function paintStatus() {
    var s = status(new Date());
    for (var i = 0; i < lines.length; i++) {
      lines[i].classList.toggle('is-open', s.open);
      lines[i].classList.toggle('is-closed', !s.open);
      var text = lines[i].querySelector('[data-tk-status-text]');
      if (text) text.textContent = s.text;
    }
  }
  if (lines.length) { paintStatus(); setInterval(paintStatus, 30000); }

  // Today's row in every hours table.
  var todayKey = KEYS[new Date().getDay()];
  var rows = document.querySelectorAll('tr[data-day="' + todayKey + '"]');
  for (var r = 0; r < rows.length; r++) {
    rows[r].classList.add('is-today');
    var th = rows[r].querySelector('th');
    if (th && !th.querySelector('.tk-today-tag')) {
      var tag = document.createElement('span');
      tag.className = 'tk-today-tag';
      tag.textContent = 'Today';
      th.appendChild(tag);
    }
  }

  /* ---------- mobile menu: close on outside tap or Escape ---------- */
  var menu = document.querySelector('details.tk-menu');
  if (menu) {
    document.addEventListener('click', function (e) { if (menu.open && !menu.contains(e.target)) menu.open = false; });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary').focus(); }
    });
  }

  /* ---------- toasts for the buttons a real site would wire up (call, WhatsApp, directions) ---------- */
  var region = document.querySelector('[data-tk-toasts]');
  var toastTimer = null;
  function toast(text) {
    if (!region) return;
    clearTimeout(toastTimer);
    region.innerHTML = '';
    var p = document.createElement('p');
    p.className = 'tk-toast';
    p.textContent = text;
    region.appendChild(p);
    toastTimer = setTimeout(function () { region.innerHTML = ''; }, 3600);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-tk-toast]');
    if (!b) return;
    e.preventDefault();
    toast(b.getAttribute('data-tk-toast'));
  });

  /* ---------- rating tooltip: hover, focus or tap ---------- */
  var tips = document.querySelectorAll('.tk-tip');
  for (var t = 0; t < tips.length; t++) {
    (function (tip) {
      var btn = tip.querySelector('button');
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = !tip.classList.contains('is-open');
        tip.classList.toggle('is-open', open);
        btn.setAttribute('aria-expanded', String(open));
      });
      document.addEventListener('click', function () { tip.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { tip.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); } });
    })(tips[t]);
  }

  /* ---------- menu tabs: without JavaScript every category shows, one under the other ---------- */
  var tabBox = document.querySelector('[data-tk-tabs]');
  if (tabBox) initTabs(tabBox);

  function initTabs(box) {
    var list = box.querySelector('[data-tk-tablist]');
    var tabs = list.querySelectorAll('[data-tk-tab]');
    var panels = box.querySelectorAll('[data-tk-panel]');
    list.hidden = false;
    box.classList.add('tk-menu-live');
    for (var p = 0; p < panels.length; p++) {
      panels[p].setAttribute('role', 'tabpanel');
      panels[p].setAttribute('tabindex', '0');
    }
    function select(n, focus) {
      for (var i = 0; i < tabs.length; i++) {
        var on = i === n;
        tabs[i].setAttribute('aria-selected', String(on));
        tabs[i].tabIndex = on ? 0 : -1;
        panels[i].hidden = !on;
      }
      if (focus) tabs[n].focus();
    }
    list.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tk-tab]');
      if (!b) return;
      var n = Array.prototype.indexOf.call(tabs, b);
      select(n, false);
      if (history.replaceState) history.replaceState(null, '', '#' + b.getAttribute('data-tk-tab'));
    });
    list.addEventListener('keydown', function (e) {
      var n = Array.prototype.indexOf.call(tabs, document.activeElement);
      var next = { ArrowRight: n + 1, ArrowLeft: n - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (n < 0 || next === undefined) return;
      e.preventDefault();
      select((next + tabs.length) % tabs.length, true);
    });
    // Open the category named in the address (menu#grill), or the first one.
    var start = 0;
    for (var i = 0; i < tabs.length; i++) if ('#' + tabs[i].getAttribute('data-tk-tab') === location.hash) start = i;
    select(start, false);
  }

  /* ---------- book a table: the form, then the message Nandi would get ---------- */
  var form = document.querySelector('form[data-tk-book]');
  if (form) initBooking(form);

  function initBooking(form) {
    var dateIn = form.elements.date;
    var timeIn = form.elements.time;
    var sheet = document.querySelector('[data-tk-sheet]');
    var bubble = sheet.querySelector('[data-tk-message]');
    var stamp = sheet.querySelector('[data-tk-stamp]');
    var closers = sheet.querySelectorAll('[data-tk-close]');
    var lastFocus = null;

    function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
    function fromIso(s) { var p = s.split('-'); return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])); }

    var today = new Date();
    var max = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 60);
    dateIn.min = iso(today);
    dateIn.max = iso(max);

    // Tables from opening time until an hour before closing, every 30 minutes;
    // today, only times at least 30 minutes from now.
    function fillTimes() {
      var keep = timeIn.value;
      timeIn.innerHTML = '';
      var d = dateIn.value ? fromIso(dateIn.value) : null;
      var day = d ? hours[KEYS[d.getDay()]] : null;
      var list = [];
      if (day) {
        var from = mins(day[0]);
        var to = mins(day[1]) - 60;
        var now = new Date();
        var soonest = d && iso(d) === iso(now) ? now.getHours() * 60 + now.getMinutes() + 30 : 0;
        for (var m = from; m <= to; m += 30) if (m >= soonest) list.push(hhmm(m));
      }
      var first = document.createElement('option');
      first.value = '';
      first.textContent = !d ? 'Choose a date first' : list.length ? 'Choose a time' : 'No tables left that day';
      timeIn.appendChild(first);
      list.forEach(function (v) {
        var o = document.createElement('option');
        o.value = v;
        o.textContent = v;
        if (v === keep) o.selected = true;
        timeIn.appendChild(o);
      });
    }
    function setToday() {
      dateIn.value = iso(new Date());
      fillTimes();
      // Nothing left today? Start on tomorrow.
      if (timeIn.options.length < 2) {
        var t = new Date();
        dateIn.value = iso(new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1));
        fillTimes();
      }
    }
    setToday();
    dateIn.addEventListener('change', function () { fillTimes(); check(dateIn); });

    var messages = {
      date: 'Please choose a date.',
      time: 'Please choose a time.',
      people: 'How many people are coming?',
      name: 'Please tell us your name.'
    };
    function check(input) {
      var v = String(input.value || '').trim();
      var bad = input.required && !v;
      if (!bad && input === dateIn && v) bad = v < dateIn.min || v > dateIn.max;
      var id = input.id + '-err';
      var msg = document.getElementById(id);
      if (bad) {
        if (!msg) {
          msg = document.createElement('p');
          msg.className = 'tk-err';
          msg.id = id;
          input.parentNode.appendChild(msg);
        }
        msg.textContent = input === dateIn && v ? 'Please choose a date in the next two months.' : messages[input.name];
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', id);
      } else {
        if (msg) msg.remove();
        input.removeAttribute('aria-invalid');
        input.removeAttribute('aria-describedby');
      }
      return !bad;
    }
    form.addEventListener('input', function (e) { if (e.target.getAttribute('aria-invalid') === 'true') check(e.target); });
    form.addEventListener('change', function (e) { if (e.target.getAttribute('aria-invalid') === 'true') check(e.target); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var firstBad = null;
      ['date', 'time', 'people', 'name'].forEach(function (n) {
        if (!check(form.elements[n]) && !firstBad) firstBad = form.elements[n];
      });
      if (firstBad) { firstBad.focus(); return; }
      var lines = [
        'Hi ' + (data.short || 'there') + '! I’d like to book a table.',
        '',
        'Date: ' + longDate(fromIso(dateIn.value)),
        'Time: ' + timeIn.value,
        'People: ' + form.elements.people.value,
        'Name: ' + form.elements.name.value.trim()
      ];
      var note = form.elements.note.value.trim().replace(/\s*\n+\s*/g, ' ');
      if (note) lines.push('Note: ' + note);
      bubble.textContent = lines.join('\n');
      var who = form.elements.name.value.trim();
      sheet.querySelector('[data-tk-from]').textContent = who;
      sheet.querySelector('[data-tk-initial]').textContent = who.charAt(0).toUpperCase();
      var now = new Date();
      stamp.textContent = hhmm(now.getHours() * 60 + now.getMinutes());
      lastFocus = document.activeElement;
      sheet.hidden = false;
      document.body.classList.add('tk-locked');
      sheet.querySelector('h2').focus();
    });

    function close() {
      sheet.hidden = true;
      document.body.classList.remove('tk-locked');
      form.reset();
      setToday();
      var errs = form.querySelectorAll('.tk-err');
      for (var i = 0; i < errs.length; i++) errs[i].remove();
      dateIn.focus();
      lastFocus = null;
    }
    for (var c = 0; c < closers.length; c++) closers[c].addEventListener('click', close);
    sheet.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
      // Keep Tab inside the panel while it's open.
      if (e.key !== 'Tab') return;
      var f = sheet.querySelectorAll('button, [href], [tabindex="-1"]');
      var a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    });
  }
})();
