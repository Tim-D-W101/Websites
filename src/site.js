/* Front Door Sites: menu, calculators, enquiry form, examples filter and the open/closed demo.
   Plain JavaScript, no libraries. FDSCalc comes from calc.js (bundled in front of this file). */
(function () {
  'use strict';

  var Calc = window.FDSCalc;

  /* ---------- mobile menu: close on outside tap, Escape or link tap ---------- */
  var menu = document.querySelector('details.menu');
  if (menu) {
    document.addEventListener('click', function (e) {
      if (menu.open && !menu.contains(e.target)) menu.open = false;
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.open) {
        menu.open = false;
        menu.querySelector('summary').focus();
      }
    });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) menu.open = false;
    });
  }

  /* ---------- calculators ---------- */
  function number(input) {
    if (!input) return NaN;
    var s = String(input.value).replace(/[^\d.,]/g, '').replace(',', '.');
    return s === '' ? NaN : parseFloat(s);
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  function initCalc(box) {
    var type = box.getAttribute('data-calc');
    var care = Number(box.getAttribute('data-care'));
    var unit = box.getAttribute('data-unit');
    var units = box.getAttribute('data-units');
    var ok = box.querySelector('[data-ok]');
    var err = box.querySelector('[data-err]');

    function field(name) { return box.querySelector('[name="' + name + '"]'); }
    function out(key, text) {
      var els = box.querySelectorAll('[data-out="' + key + '"]');
      for (var i = 0; i < els.length; i++) els[i].textContent = text;
    }

    function update() {
      var band = box.querySelector('input[name="build"]:checked');
      var build = Number(band.value);
      var r;
      if (type === 'commission') {
        var percent = Number(field('percent').value);
        out('percent', percent + '%');
        r = Calc.commission({ rate: number(field('rate')), nights: number(field('nights')), percent: percent, build: build, care: care });
        if (r) {
          out('paid', Calc.rand(Calc.about(r.paid)));
          out('perYear', Calc.rand(Calc.about(r.perYear)));
          out('perNight', Calc.rand(r.perNight));
          out('payback', plural(r.payback, 'direct night', 'direct nights'));
        }
      } else {
        r = Calc.payback({ price: number(field('price')), build: build, care: care });
        if (r) out('payback', plural(r.payback, unit, units));
      }
      if (r) {
        out('paybackVerb', r.payback === 1 ? 'pays' : 'pay');
        out('care', String(r.care));
        out('careVerb', r.care === 1 ? 'covers' : 'cover');
      }
      out('bandLabel', band.getAttribute('data-band-name') + ' (' + Calc.rand(build) + ')');
      ok.hidden = !r;
      err.hidden = !!r;
    }

    box.addEventListener('input', update);
    box.addEventListener('change', update);
    update();
  }

  var calcs = document.querySelectorAll('[data-calc]');
  for (var i = 0; i < calcs.length; i++) initCalc(calcs[i]);

  /* ---------- enquiry form -> WhatsApp (or email) ---------- */
  var form = document.querySelector('form[data-enquiry]');
  if (form) initEnquiry(form);

  function initEnquiry(form) {
    var wa = form.getAttribute('data-wa');
    var email = form.getAttribute('data-email');
    var firstName = form.getAttribute('data-name');
    var status = form.querySelector('.form-status');
    var emailField = form.querySelector('[data-when="email"]');
    var phoneField = form.querySelector('[data-when="phone"]');
    var label = form.querySelector('[data-submit-label]');
    var details = form.elements.details;
    var count = document.getElementById('ef-details-count');
    var max = Number(details.getAttribute('maxlength')) || 600;
    var lastVia = wa ? 'whatsapp' : 'email';

    function value(name) { return String(form.elements[name].value || '').trim(); }
    function need() { return form.querySelector('input[name="need"]:checked'); }
    function replyBy() { return form.querySelector('input[name="reply"]:checked').value; }

    // The button and the link field follow the "What do you need?" answer.
    function syncNeed() {
      var n = need();
      var key = n ? n.getAttribute('data-key') : '';
      label.textContent = n ? n.getAttribute('data-button') : 'Get my free quote';
      var hide = form.querySelectorAll('[data-hide-for]');
      for (var i = 0; i < hide.length; i++) hide[i].hidden = hide[i].getAttribute('data-hide-for') === key;
    }

    // Ask for an email address only when they want an email reply,
    // and for a WhatsApp number only when the message itself goes by email.
    function syncReply() {
      var r = replyBy();
      emailField.hidden = r !== 'Email';
      form.elements.email.required = r === 'Email';
      var needPhone = r === 'WhatsApp' && lastVia === 'email';
      phoneField.hidden = !needPhone;
      form.elements.phone.required = needPhone;
    }

    function syncCount() {
      var left = max - details.value.length;
      count.textContent = details.value.length ? left + ' characters left' : 'Up to ' + max + ' characters';
    }

    form.addEventListener('change', function (e) {
      if (e.target.name === 'need') { syncNeed(); clearNeedError(); }
      if (e.target.name === 'reply') syncReply();
      if (e.target.tagName === 'SELECT' && e.target.getAttribute('aria-invalid') === 'true') check(e.target);
    });
    // Clear an error while the person types, not on blur: removing it on blur
    // would move the Send button just as they tap it.
    form.addEventListener('input', function (e) {
      if (e.target === details) syncCount();
      if (e.target.getAttribute('aria-invalid') === 'true') check(e.target);
    });
    syncNeed();
    syncReply();
    syncCount();

    var messages = {
      business: 'Please enter your business name.',
      type: 'Please tell me what kind of business it is.',
      town: 'Please enter your town.',
      details: 'Please tell me a little about what you need.',
      name: 'Please enter your name.',
      email: 'Please enter your email address, so I can reply.',
      phone: 'Please enter your WhatsApp number, so I can reply.'
    };

    function showError(el, anchor, id, text) {
      var msg = document.getElementById(id);
      if (!msg) {
        msg = document.createElement('p');
        msg.className = 'field-error';
        msg.id = id;
        anchor.appendChild(msg);
      }
      msg.textContent = text;
      el.setAttribute('aria-invalid', 'true');
      var base = el.getAttribute('data-describedby') || '';
      el.setAttribute('aria-describedby', (base ? base + ' ' : '') + id);
    }
    function clearError(el, id) {
      var msg = document.getElementById(id);
      if (msg) msg.remove();
      el.removeAttribute('aria-invalid');
      var base = el.getAttribute('data-describedby');
      if (base) el.setAttribute('aria-describedby', base); else el.removeAttribute('aria-describedby');
    }
    if (details.getAttribute('aria-describedby')) details.setAttribute('data-describedby', details.getAttribute('aria-describedby'));

    function check(input) {
      var v = String(input.value || '').trim();
      var bad = input.required && !v;
      if (!bad && input.type === 'email' && v) bad = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      if (!bad && input.type === 'tel' && v) bad = v.replace(/\D/g, '').length < 9;
      var id = input.id + '-error';
      if (bad) showError(input, input.parentNode, id, messages[input.name] || 'Please check this field.');
      else clearError(input, id);
      return !bad;
    }

    var needSet = form.querySelector('.need-toggle');
    var firstNeed = form.querySelector('input[name="need"]');
    function clearNeedError() { clearError(firstNeed, 'ef-need-error'); }
    function checkNeed() {
      if (need()) { clearNeedError(); return true; }
      showError(firstNeed, needSet, 'ef-need-error', 'Please choose what you need.');
      return false;
    }

    // One field per line; empty optional fields are left out.
    function buildMessage() {
      var n = need();
      var lines = [
        (firstName ? 'Hi ' + firstName + '! ' : 'Hi! ') + n.getAttribute('data-intro'),
        '',
        'What I need: ' + n.value,
        'Business name: ' + value('business'),
        'Type of business: ' + value('type'),
        'Town: ' + value('town'),
        'Details: ' + value('details').replace(/\s*\n+\s*/g, ' ')
      ];
      var linkField = form.elements.link;
      if (value('link') && !linkField.closest('[hidden]')) lines.push('Link: ' + value('link'));
      if (value('budget')) lines.push('Budget: ' + value('budget'));
      if (value('timing')) lines.push('When: ' + value('timing'));
      lines.push('My name: ' + value('name'));
      var r = replyBy();
      if (r === 'Email') lines.push('Please reply by email: ' + value('email'));
      else if (value('phone')) lines.push('Please reply on WhatsApp: ' + value('phone'));
      else lines.push('Please reply on WhatsApp.');
      return lines.join('\n');
    }

    function urlFor(via, text) {
      if (via === 'whatsapp') return 'https://wa.me/' + wa + '?text=' + encodeURIComponent(text);
      return 'mailto:' + email + '?subject=' + encodeURIComponent('Quote request: ' + value('business')) +
        '&body=' + encodeURIComponent(text.replace(/\n/g, '\r\n'));
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var via = (e.submitter && e.submitter.value) || (wa ? 'whatsapp' : 'email');
      if (via === 'whatsapp' && !wa) via = 'email';
      if (via === 'email' && !email) via = 'whatsapp';
      lastVia = via;
      syncReply();

      var firstBad = checkNeed() ? null : firstNeed;
      var fields = form.querySelectorAll('input, select, textarea');
      for (var i = 0; i < fields.length; i++) {
        var f = fields[i];
        if (f.type === 'radio' || f.closest('[hidden]')) continue;
        if (!check(f) && !firstBad) firstBad = f;
      }
      if (firstBad) {
        status.textContent = 'Please fill in the highlighted fields.';
        status.className = 'form-status is-error';
        firstBad.focus();
        return;
      }

      var url = urlFor(via, buildMessage());
      status.className = 'form-status is-ok';
      status.innerHTML = '';
      var p = document.createElement('p');
      p.textContent = via === 'whatsapp'
        ? 'WhatsApp should now open with your message ready. Just press send.'
        : 'Your email app should now open with your message ready. Just press send.';
      var again = document.createElement('a');
      again.href = url;
      again.textContent = via === 'whatsapp' ? 'Didn’t open? Tap here to open WhatsApp.' : 'Didn’t open? Tap here to try again.';
      status.appendChild(p);
      status.appendChild(again);

      if (via === 'email' || window.matchMedia('(pointer: coarse)').matches) {
        window.location.href = url;
      } else {
        var w = window.open(url, '_blank');
        if (w) w.opener = null;
        else window.location.href = url;
      }
    });
  }

  /* ---------- examples filter (only shown when there are websites and tools) ---------- */
  var filter = document.querySelector('[data-filter]');
  if (filter) {
    var cards = document.querySelectorAll('[data-examples] [data-kind]');
    var buttons = filter.querySelectorAll('button');
    filter.hidden = false;
    filter.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var show = b.getAttribute('data-show');
      for (var i = 0; i < buttons.length; i++) buttons[i].setAttribute('aria-pressed', String(buttons[i] === b));
      for (var j = 0; j < cards.length; j++) cards[j].hidden = show !== 'all' && cards[j].getAttribute('data-kind') !== show;
    });
  }

  /* ---------- live "open now / closed" demo (South African time) ---------- */
  var demo = document.querySelector('[data-open-status]');
  if (demo) initOpenStatus(demo);

  function initOpenStatus(el) {
    var hours = JSON.parse(el.getAttribute('data-hours'));
    var keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    var names = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
    var pill = el.querySelector('[data-status-pill]');
    var text = el.querySelector('[data-status-text]');

    function mins(hhmm) { var p = hhmm.split(':'); return Number(p[0]) * 60 + Number(p[1]); }

    function saNow() {
      var parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Johannesburg', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      }).formatToParts(new Date());
      var o = {};
      parts.forEach(function (p) { o[p.type] = p.value; });
      return { day: keys.indexOf(o.weekday.toLowerCase().slice(0, 3)), minutes: Number(o.hour) * 60 + Number(o.minute) };
    }

    function update() {
      var now = saNow();
      var todayKey = keys[now.day];
      var today = hours[todayKey];
      var open = false, label;
      if (today && now.minutes >= mins(today[0]) && now.minutes < mins(today[1])) {
        open = true;
        label = 'Closes at ' + today[1];
      } else if (today && now.minutes < mins(today[0])) {
        label = 'Opens today at ' + today[0];
      } else {
        for (var d = 1; d <= 7; d++) {
          var k = keys[(now.day + d) % 7];
          if (hours[k]) {
            label = 'Opens ' + (d === 1 ? 'tomorrow' : names[k]) + ' at ' + hours[k][0];
            break;
          }
        }
      }
      pill.textContent = open ? 'Open now' : 'Closed';
      pill.className = 'status-pill ' + (open ? 'is-open' : 'is-closed');
      text.textContent = label || '';
      var rows = el.querySelectorAll('tr[data-day]');
      for (var i = 0; i < rows.length; i++) rows[i].classList.toggle('is-today', rows[i].getAttribute('data-day') === todayKey);
    }

    update();
    setInterval(update, 60000);
  }
})();
