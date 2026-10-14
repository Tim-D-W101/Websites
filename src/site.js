/* Front Door Sites: menu, calculators, mock-up form and the open/closed demo.
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

  function initCalc(form) {
    var type = form.getAttribute('data-calc');
    function field(name) { return form.querySelector('[name="' + name + '"]'); }
    var unit = form.getAttribute('data-unit');
    var units = form.getAttribute('data-units');
    var ok = form.querySelector('[data-ok]');
    var err = form.querySelector('[data-err]');

    function out(key, text) {
      var els = form.querySelectorAll('[data-out="' + key + '"]');
      for (var i = 0; i < els.length; i++) els[i].textContent = text;
    }

    function update() {
      var plan = form.querySelector('input[type="radio"]:checked');
      var monthly = Number(plan.value);
      var r;
      if (type === 'commission') {
        var percent = Number(field('percent').value);
        out('percent', percent + '%');
        r = Calc.commission({ rate: number(field('rate')), nights: number(field('nights')), percent: percent, monthly: monthly });
        if (r) {
          out('paid', Calc.rand(Calc.about(r.paid)));
          out('needed', plural(r.needed, 'booking', 'bookings'));
          out('perBooking', Calc.rand(r.perBooking));
        }
      } else {
        var price = number(field('price'));
        r = Calc.breakEven({ price: price, monthly: monthly });
        if (r) {
          out('needed', plural(r.needed, 'extra ' + unit, 'extra ' + units));
          out('price', Calc.rand(price));
        }
      }
      out('planLabel', plan.getAttribute('data-plan-name') + ' at ' + Calc.rand(monthly) + '/month');
      ok.hidden = !r;
      err.hidden = !!r;
    }

    form.addEventListener('input', update);
    form.addEventListener('change', update);
    update();
  }

  var calcs = document.querySelectorAll('[data-calc]');
  for (var i = 0; i < calcs.length; i++) initCalc(calcs[i]);

  /* ---------- free mock-up form -> WhatsApp (or email) ---------- */
  var form = document.querySelector('form[data-mockup]');
  if (form) initMockup(form);

  function initMockup(form) {
    var wa = form.getAttribute('data-wa');
    var email = form.getAttribute('data-email');
    var firstName = form.getAttribute('data-name');
    var status = form.querySelector('.form-status');
    var emailField = form.querySelector('[data-when="email"]');
    var phoneField = form.querySelector('[data-when="phone"]');
    var lastVia = wa ? 'whatsapp' : 'email';

    function value(name) { return String(form.elements[name].value || '').trim(); }
    function replyBy() { return form.querySelector('input[name="reply"]:checked').value; }

    // Ask for an email address only when they want an email reply,
    // and for a WhatsApp number only when the message itself goes by email.
    function syncFields() {
      var r = replyBy();
      emailField.hidden = r !== 'Email';
      form.elements.email.required = r === 'Email';
      var needPhone = r === 'WhatsApp' && lastVia === 'email';
      phoneField.hidden = !needPhone;
      form.elements.phone.required = needPhone;
    }
    form.addEventListener('change', function (e) {
      if (e.target.name === 'reply') syncFields();
      if (e.target.tagName === 'SELECT' && e.target.getAttribute('aria-invalid') === 'true') check(e.target);
    });
    // Clear an error while the person types, not on blur: removing it on blur
    // would move the Send button just as they tap it.
    form.addEventListener('input', function (e) {
      if (e.target.getAttribute('aria-invalid') === 'true') check(e.target);
    });
    syncFields();

    var messages = {
      business: 'Please enter your business name.',
      type: 'Please choose your type of business.',
      town: 'Please enter your town.',
      name: 'Please enter your name.',
      email: 'Please enter your email address, so I can reply.',
      phone: 'Please enter your WhatsApp number, so I can reply.'
    };

    function check(input) {
      var v = String(input.value || '').trim();
      var bad = input.required && !v;
      if (!bad && input.type === 'email' && v) bad = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      if (!bad && input.type === 'tel' && v) bad = v.replace(/\D/g, '').length < 9;
      var id = input.id + '-error';
      var msg = document.getElementById(id);
      if (bad) {
        if (!msg) {
          msg = document.createElement('p');
          msg.className = 'field-error';
          msg.id = id;
          input.parentNode.appendChild(msg);
        }
        msg.textContent = messages[input.name] || 'Please check this field.';
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', id);
      } else {
        if (msg) msg.remove();
        input.removeAttribute('aria-invalid');
        input.removeAttribute('aria-describedby');
      }
      return !bad;
    }

    function buildMessage() {
      var lines = [
        (firstName ? 'Hi ' + firstName + '!' : 'Hi!') + " I'd like a free website mock-up, please.",
        '',
        'Business name: ' + value('business'),
        'Type of business: ' + value('type'),
        'Town: ' + value('town')
      ];
      if (value('link')) lines.push('Link: ' + value('link'));
      lines.push('My name: ' + value('name'));
      var r = replyBy();
      if (r === 'Email') lines.push('Please reply by email: ' + value('email'));
      else if (value('phone')) lines.push('Please reply on WhatsApp: ' + value('phone'));
      else lines.push('Please reply on WhatsApp.');
      return lines.join('\n');
    }

    function urlFor(via, text) {
      if (via === 'whatsapp') return 'https://wa.me/' + wa + '?text=' + encodeURIComponent(text);
      return 'mailto:' + email + '?subject=' + encodeURIComponent('Free mock-up request: ' + value('business')) +
        '&body=' + encodeURIComponent(text.replace(/\n/g, '\r\n'));
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var via = (e.submitter && e.submitter.value) || (wa ? 'whatsapp' : 'email');
      if (via === 'whatsapp' && !wa) via = 'email';
      if (via === 'email' && !email) via = 'whatsapp';
      lastVia = via;
      syncFields();

      var fields = form.querySelectorAll('input, select');
      var firstBad = null;
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
