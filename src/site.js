/* Front Door Sites: menu, calculators, enquiry form, the open/closed demo, the Examples page
   (live previews, its in-page nav, buttons that fill in the form), and the home page's front door
   and tour. Also: things rising into view, cards that tilt.
   Plain JavaScript, no libraries. FDSCalc comes from calc.js (bundled in front of this file). */
(function () {
  'use strict';

  var Calc = window.FDSCalc;
  var motion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }
  function easeInOut(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

  /* ---------- one scroll loop: measure everything first, then change everything ---------- */
  var loops = [];
  var queued = false;
  function frame() {
    queued = false;
    var vh = window.innerHeight;
    var i;
    for (i = 0; i < loops.length; i++) if (loops[i].read) loops[i].read(vh);
    for (i = 0; i < loops.length; i++) if (loops[i].write) loops[i].write(vh);
  }
  function queue() {
    if (!queued) { queued = true; window.requestAnimationFrame(frame); }
  }
  function resized() {
    for (var i = 0; i < loops.length; i++) if (loops[i].resize) loops[i].resize();
    queue();
  }
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', resized);

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

    // With a toggle, the checked build; with a single build, the price on the calculator.
    function update() {
      var band = box.querySelector('input[name="build"]:checked');
      var build = Number(band ? band.value : box.getAttribute('data-build'));
      var buildName = band ? band.getAttribute('data-band-name') : box.getAttribute('data-build-name');
      var one = type === 'commission' ? 'direct night' : unit;
      var many = type === 'commission' ? 'direct nights' : units;
      var r;
      if (type === 'commission') {
        var percent = Number(field('percent').value);
        out('percent', percent + '%');
        r = Calc.commission({ rate: number(field('rate')), nights: number(field('nights')), percent: percent, build: build, care: care });
        if (r) {
          out('paid', Calc.rand(Calc.about(r.paid)));
          out('perYear', Calc.rand(Calc.about(r.perYear)));
          out('perNight', Calc.rand(r.perNight));
        }
      } else {
        r = Calc.payback({ price: number(field('price')), build: build, care: care });
      }
      if (r) {
        out('payback', plural(r.payback, one, many));
        out('paybackVerb', r.payback === 1 ? 'pays' : 'pay');
        out('care', plural(r.care, one, many));
        out('careVerb', r.care === 1 ? 'covers' : 'cover');
      }
      out('bandLabel', buildName + ' (' + Calc.rand(build) + ')');
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

  /* ---------- Examples page: live previews of the demo website, scaled to fit their frames ---------- */
  var fits = document.querySelectorAll('[data-fit]');
  if (fits.length) initFits(fits);

  function initFits(list) {
    function size() {
      for (var i = 0; i < list.length; i++) {
        var w = list[i].clientWidth;
        if (w) list[i].style.setProperty('--fit', (w / Number(list[i].getAttribute('data-fit'))).toFixed(4));
      }
    }
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(size);
      for (var i = 0; i < list.length; i++) ro.observe(list[i]);
    } else {
      loops.push({ resize: size });
    }
    size();
  }

  // The phones' status bars show the time.
  var clocks = document.querySelectorAll('[data-clock]');
  if (clocks.length) {
    var tick = function () {
      var d = new Date();
      var s = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
      for (var i = 0; i < clocks.length; i++) clocks[i].textContent = s;
    };
    tick();
    setInterval(tick, 15000);
  }

  /* ---------- Examples page: the in-page nav shows where you are ---------- */
  var exnav = document.querySelector('[data-exnav]');
  if (exnav) initExNav(exnav);

  function initExNav(nav) {
    var list = nav.querySelector('ul');
    var links = nav.querySelectorAll('a[href^="#"]');
    var targets = [];
    var tops = [];
    var current = -2;
    for (var i = 0; i < links.length; i++) targets.push(document.getElementById(links[i].getAttribute('href').slice(1)));
    loops.push({
      read: function () {
        for (var j = 0; j < targets.length; j++) tops[j] = targets[j] ? targets[j].getBoundingClientRect().top : Infinity;
      },
      write: function (vh) {
        var line = Math.min(vh * 0.35, 280);
        var active = -1;
        for (var j = 0; j < tops.length; j++) if (tops[j] <= line) active = j;
        if (active === current) return;
        current = active;
        for (var k = 0; k < links.length; k++) {
          if (k === active) links[k].setAttribute('aria-current', 'true');
          else links[k].removeAttribute('aria-current');
        }
        // On phones the chips scroll sideways: keep the current one in view.
        if (active === -1 && list.scrollLeft) list.scrollTo({ left: 0, behavior: motion ? 'smooth' : 'auto' });
        if (active > -1 && list.scrollWidth > list.clientWidth) {
          var a = links[active];
          var left = a.getBoundingClientRect().left - list.getBoundingClientRect().left + list.scrollLeft;
          list.scrollTo({ left: left - (list.clientWidth - a.offsetWidth) / 2, behavior: motion ? 'smooth' : 'auto' });
        }
      }
    });
  }

  /* ---------- "I want a site like this", "Get one like this": fill in the enquiry form ---------- */
  // Only fields that are empty, or still hold what an earlier button put there, are changed.
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-prefill-need]');
    var f = document.querySelector('form[data-enquiry]');
    if (!b || !f) return;
    var need = f.querySelector('input[name="need"][data-key="' + b.getAttribute('data-prefill-need') + '"]');
    if (need && !need.checked) {
      need.checked = true;
      need.dispatchEvent(new Event('change', { bubbles: true }));
    }
    var type = b.getAttribute('data-prefill-type');
    var typeIn = f.elements.type;
    if (!typeIn.value.trim() || typeIn.value === f.fdsType) { typeIn.value = type || ''; f.fdsType = type || ''; }
    var details = b.getAttribute('data-prefill-details');
    var d = f.elements.details;
    if (details && (!d.value.trim() || d.value === f.fdsDetails)) {
      d.value = details;
      f.fdsDetails = details;
      d.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

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

  /* ---------- the front door (home page) ----------
     The door section is tall and its stage stays pinned while you scroll through it. Progress
     (0 to 1) becomes CSS variables: --text (the words fade), --center (the door moves to the
     middle), --knob, --door (it swings open and the things inside come out), --zoom (through
     the doorway) and --flood (into the light). */
  var door = document.querySelector('[data-door]');
  if (door) initDoor(door);

  function initDoor(hero) {
    var stage = hero.querySelector('.door-stage');
    var zoom = hero.querySelector('.door-zoom');
    var live = false;
    var rect = null;
    var stageH = 0;
    var last = '';
    var finishTyping = initBubble(hero);

    function set(name, value) { hero.style.setProperty(name, value); }

    // Only with motion allowed, and on a screen tall enough to pin the door (and, on wide
    // screens, its words beside it).
    function fits() {
      return motion && window.innerWidth >= 320 && window.innerHeight >= (window.innerWidth >= 900 ? 600 : 500);
    }

    // Layout position, unaffected by transforms (the scene is still animating in on load).
    function offset(el) {
      var x = 0, y = 0;
      while (el && el !== stage) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; }
      return { x: x, y: y };
    }

    function resize() {
      var want = fits();
      if (want !== live) {
        live = want;
        last = '';
        hero.classList.toggle('is-live', live);
        if (!live) ['--text', '--center', '--knob', '--door', '--zoom', '--flood'].forEach(function (k) { hero.style.removeProperty(k); });
      }
      if (!live) return;
      // How far the doorway moves to reach the middle of the screen, and how much bigger the
      // door can get there and still fit.
      var o = offset(zoom);
      var w = zoom.offsetWidth;
      var h = zoom.offsetHeight;
      set('--zx', Math.round(stage.clientWidth / 2 - (o.x + w / 2)) + 'px');
      set('--zy', Math.round(stage.clientHeight / 2 - (o.y + h * 0.6)) + 'px');
      var fit = Math.min(stage.clientWidth * 0.8 / w, stage.clientHeight * 0.86 / h, 1.5);
      set('--grow', Math.max(0, fit - 1).toFixed(3));
    }

    loops.push({
      resize: resize,
      read: function () {
        if (!live) return;
        rect = hero.getBoundingClientRect();
        stageH = stage.offsetHeight;
      },
      write: function () {
        if (!live || !rect) return;
        var total = rect.height - stageH;
        var p = total > 0 ? clamp(-rect.top / total, 0, 1) : 0;
        var key = p.toFixed(4);
        if (key === last) return;
        last = key;
        if (p > 0.005) finishTyping();
        var through = clamp((p - 0.6) / 0.36, 0, 1);
        set('--text', clamp(p / 0.22, 0, 1).toFixed(3));
        set('--center', easeInOut(clamp((p - 0.06) / 0.36, 0, 1)).toFixed(3));
        set('--knob', clamp((p - 0.06) / 0.06, 0, 1).toFixed(3));
        set('--door', easeInOut(clamp((p - 0.1) / 0.48, 0, 1)).toFixed(3));
        set('--zoom', (through * through).toFixed(4));
        set('--flood', clamp((through - 0.35) / 0.55, 0, 1).toFixed(3));
      }
    });
    resize();
  }

  // The speech bubble types itself out just after it pops up. Its full text stays in place
  // (hidden), so the bubble doesn't change size while it types. Returns "finish now".
  function initBubble(hero) {
    var bubble = hero.querySelector('.door-bubble');
    var typed = hero.querySelector('[data-type]');
    var done = false;
    var timer = null;
    var full = typed ? typed.textContent : '';
    function finish() {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (typed) typed.textContent = full;
      if (bubble) bubble.classList.remove('is-typing');
    }
    var now = window.performance && performance.now ? performance.now() : 0;
    // Skip it if the page took a while to load: the bubble is already showing.
    if (!typed || !motion || now > 1200) { done = true; return finish; }
    var shown = document.createTextNode('');
    var caret = document.createElement('i');
    var rest = document.createElement('span');
    caret.className = 'caret';
    rest.className = 'ghost';
    rest.textContent = full;
    typed.textContent = '';
    typed.appendChild(shown);
    typed.appendChild(caret);
    typed.appendChild(rest);
    var n = 0;
    timer = setTimeout(function step() {
      if (done) return;
      bubble.classList.add('is-typing');
      n += 1;
      shown.nodeValue = full.slice(0, n);
      rest.textContent = full.slice(n);
      if (n >= full.length) { timer = setTimeout(finish, 900); return; }
      timer = setTimeout(step, /[,.]/.test(full.charAt(n - 1)) ? 240 : 28);
    }, Math.max(0, 1650 - now));
    return finish;
  }

  /* ---------- the tour bar: which chapter you're in, and how far through you are ---------- */
  var storybar = document.querySelector('[data-storybar]');
  if (storybar) initStorybar(storybar);

  function initStorybar(bar) {
    var links = bar.querySelectorAll('[data-story-link]');
    var targets = [];
    for (var i = 0; i < links.length; i++) targets.push(document.getElementById(links[i].getAttribute('href').slice(1)));
    var start = document.getElementById('tour');
    var end = document.getElementById('enquiry');
    var num = bar.querySelector('[data-sb-num]');
    var label = bar.querySelector('[data-sb-label]');
    var tops = [];
    var startTop = 0;
    var endTop = 0;
    var on = false;
    var current = -1;
    var lastLine = '';
    loops.push({
      read: function () {
        startTop = start ? start.getBoundingClientRect().top : 0;
        endTop = end ? end.getBoundingClientRect().top : document.documentElement.scrollHeight;
        for (var j = 0; j < targets.length; j++) tops[j] = targets[j] ? targets[j].getBoundingClientRect().top : Infinity;
      },
      write: function (vh) {
        var show = startTop < vh * 0.6;
        if (show !== on) { on = show; bar.classList.toggle('is-on', on); }
        var line = vh * 0.4;
        var active = 0;
        for (var j = 0; j < tops.length; j++) if (tops[j] <= line) active = j;
        if (active !== current) {
          current = active;
          for (var k = 0; k < links.length; k++) {
            if (k === active) links[k].setAttribute('aria-current', 'true');
            else links[k].removeAttribute('aria-current');
            links[k].classList.toggle('is-done', k < active);
          }
          num.textContent = String(active + 1);
          label.textContent = links[active].lastElementChild.textContent;
        }
        var progress = clamp((line - tops[0]) / Math.max(1, endTop - tops[0]), 0, 1).toFixed(4);
        if (progress !== lastLine) { lastLine = progress; bar.style.setProperty('--sb', progress); }
      }
    });
  }

  /* ---------- why: the phone follows the step you're reading ---------- */
  var journey = document.querySelector('[data-journey]');
  if (journey) initJourney(journey);

  function initJourney(el) {
    var steps = el.querySelectorAll('.journey-step');
    var screens = el.querySelectorAll('.ps');
    var phone = el.querySelector('.journey-phone');
    var search = el.querySelector('.ps-search');
    var query = el.querySelector('[data-query]');
    var full = query ? query.textContent : '';
    var mobileBar = document.querySelector('.mobile-bar');
    var centers = [];
    var focus = 0;
    var inView = false;
    var current = -1;
    var typing = null;
    el.classList.add('is-live');

    // The search types itself out each time you come back to the first step.
    function typeQuery() {
      if (!query || !motion) return;
      clearTimeout(typing);
      var n = 0;
      search.classList.add('is-typing');
      (function step() {
        n += 1;
        query.textContent = full.slice(0, n);
        if (n < full.length) typing = setTimeout(step, 65);
        else typing = setTimeout(function () { search.classList.remove('is-typing'); }, 1400);
      })();
    }

    function show(n) {
      current = n;
      for (var i = 0; i < steps.length; i++) steps[i].classList.toggle('is-active', i === n);
      for (var j = 0; j < screens.length; j++) {
        screens[j].classList.toggle('is-on', j === n);
        screens[j].classList.toggle('is-past', j < n);
      }
      if (n === 0) typeQuery();
    }

    loops.push({
      read: function (vh) {
        var r = el.getBoundingClientRect();
        inView = r.bottom > 0 && r.top < vh;
        if (!inView) return;
        // The step being read is the one nearest the middle of the space left for the text:
        // below the phone on narrow screens (the phone sits at the top), the whole screen on wide ones.
        var below = window.innerWidth < 900 ? Math.max(0, phone.getBoundingClientRect().bottom) : 0;
        var bottom = vh - (mobileBar ? mobileBar.getBoundingClientRect().height : 0);
        focus = (below + bottom) / 2;
        for (var i = 0; i < steps.length; i++) {
          var s = steps[i].getBoundingClientRect();
          centers[i] = s.top + s.height / 2;
        }
      },
      write: function () {
        if (!inView) return;
        var best = 0;
        var dist = Infinity;
        for (var i = 0; i < centers.length; i++) {
          var d = Math.abs(centers[i] - focus);
          if (d < dist) { dist = d; best = i; }
        }
        if (best !== current) show(best);
      }
    });
    show(0);
  }

  /* ---------- tabs (ideas for each kind of business) ---------- */
  var tabBoxes = document.querySelectorAll('[data-tabs]');
  for (var tb = 0; tb < tabBoxes.length; tb++) initTabs(tabBoxes[tb]);

  // Without JavaScript every panel shows, one under the other; this turns them into tabs.
  function initTabs(box) {
    var list = box.querySelector('[data-tablist]');
    var tabs = list.querySelectorAll('[data-tab]');
    var panels = box.querySelectorAll('[data-panel]');
    list.hidden = false;
    list.setAttribute('role', 'tablist');
    box.classList.add('is-live');
    for (var i = 0; i < tabs.length; i++) {
      var key = tabs[i].getAttribute('data-tab');
      tabs[i].setAttribute('role', 'tab');
      tabs[i].id = 'tab-' + key;
      tabs[i].setAttribute('aria-controls', 'panel-' + key);
      panels[i].setAttribute('role', 'tabpanel');
      panels[i].setAttribute('aria-labelledby', 'tab-' + key);
      panels[i].setAttribute('tabindex', '0');
    }
    function select(n, byUser, focus) {
      for (var j = 0; j < tabs.length; j++) {
        var on = j === n;
        tabs[j].setAttribute('aria-selected', String(on));
        tabs[j].tabIndex = on ? 0 : -1;
        panels[j].hidden = !on;
        panels[j].classList.toggle('is-shown', on && byUser);
      }
      if (focus) tabs[n].focus();
    }
    list.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tab]');
      if (b) select(Array.prototype.indexOf.call(tabs, b), true, false);
    });
    list.addEventListener('keydown', function (e) {
      var n = Array.prototype.indexOf.call(tabs, document.activeElement);
      var next = { ArrowRight: n + 1, ArrowLeft: n - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (n < 0 || next === undefined) return;
      e.preventDefault();
      select((next + tabs.length) % tabs.length, true, true);
    });
    select(0, false, false);
  }

  /* ---------- what a website could earn: sliders, sums and the 12-month chart ---------- */
  var earn = document.querySelector('[data-earn]');
  if (earn) initEarn(earn);

  function initEarn(box) {
    var build = Number(box.getAttribute('data-build'));
    var care = Number(box.getAttribute('data-care'));
    var spendIn = box.querySelector('[name="spend"]');
    var custIn = box.querySelector('[name="customers"]');
    var min = Number(spendIn.getAttribute('data-min'));
    var max = Number(spendIn.getAttribute('data-max'));
    var sums = box.querySelector('[data-sums]');
    var sr = box.querySelector('[data-sums-sr]');
    var chart = box.querySelector('[data-chart]');
    var bars = chart.querySelectorAll('.bar');
    var line = chart.querySelector('.cost-line');
    var flag = chart.querySelector('.pay-flag');
    var top = Number(chart.getAttribute('data-top'));
    var bottom = Number(chart.getAttribute('data-bottom'));
    var gap = Number(chart.getAttribute('data-gap'));
    var width = chart.viewBox.baseVal.width;
    var n = bars.length;
    var bw = (width - gap * (n + 1)) / n;
    var srTimer = null;
    var chartFrame = 0;
    var state = null;
    box.classList.add('is-live');

    function out(key) { return box.querySelector('[data-out="' + key + '"]'); }
    function text(key, value) { var el = out(key); if (el) el.textContent = value; }

    // Amounts roll to their new value.
    function roll(key, to) {
      var el = out(key);
      if (!el) return;
      var from = el.fdsValue === undefined ? to : el.fdsValue;
      el.fdsValue = to;
      window.cancelAnimationFrame(el.fdsFrame);
      if (!motion || from === to) { el.textContent = Calc.rand(to); return; }
      var t0 = null;
      el.fdsFrame = window.requestAnimationFrame(function step(ts) {
        if (t0 === null) t0 = ts;
        var k = Math.min(1, (ts - t0) / 420);
        el.textContent = Calc.rand(from + (to - from) * (1 - Math.pow(1 - k, 3)));
        if (k < 1) el.fdsFrame = window.requestAnimationFrame(step);
      });
    }

    // The chart's moving parts as numbers: each bar's top, the cost line, the flag's x and y.
    function readChart() {
      var s = [];
      for (var i = 0; i < n; i++) s.push(Number(bars[i].getAttribute('y')));
      var m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(flag.getAttribute('transform')) || [0, 0, 0];
      s.push(Number(line.getAttribute('y1')), Number(m[1]), Number(m[2]));
      return s;
    }
    function paint(s) {
      for (var i = 0; i < n; i++) {
        bars[i].setAttribute('y', s[i].toFixed(1));
        bars[i].setAttribute('height', Math.max(0, bottom - s[i]).toFixed(1));
      }
      line.setAttribute('y1', s[n].toFixed(1));
      line.setAttribute('y2', s[n].toFixed(1));
      flag.setAttribute('transform', 'translate(' + s[n + 1].toFixed(1) + ' ' + s[n + 2].toFixed(1) + ')');
    }
    function drawChart(r) {
      var most = Math.max(build * 1.25, r.monthly * n);
      function y(v) { return bottom - (Math.min(v, most) / most) * (bottom - top); }
      var target = [];
      for (var i = 0; i < n; i++) {
        var v = r.monthly * (i + 1);
        target.push(y(v));
        bars[i].classList.toggle('is-paid', v >= build);
      }
      var m = Math.min(r.months, n);
      target.push(y(build), gap + (m - 1) * (bw + gap) + bw / 2, y(r.monthly * m));
      flag.classList.toggle('is-off', r.months > n);
      var from = state || readChart();
      window.cancelAnimationFrame(chartFrame);
      if (!motion) { state = target; paint(target); return; }
      var t0 = null;
      chartFrame = window.requestAnimationFrame(function step(ts) {
        if (t0 === null) t0 = ts;
        var k = Math.min(1, (ts - t0) / 380);
        var e = 1 - Math.pow(1 - k, 3);
        state = from.map(function (a, j) { return a + (target[j] - a) * e; });
        paint(state);
        if (k < 1) chartFrame = window.requestAnimationFrame(step);
      });
    }

    function fill(input) {
      var a = Number(input.min), b = Number(input.max);
      input.style.setProperty('--fill', ((Number(input.value) - a) / (b - a) * 100).toFixed(1) + '%');
    }

    function update() {
      var spend = Calc.spendAt(Number(spendIn.value), min, max);
      var customers = Number(custIn.value);
      var r = Calc.earnings({ spend: spend, customers: customers, build: build, care: care });
      fill(spendIn);
      fill(custIn);
      text('spend', Calc.rand(spend));
      spendIn.setAttribute('aria-valuetext', Calc.rand(spend));
      text('customers', String(customers));
      if (!r) return;
      roll('monthly', r.monthly);
      roll('yearly', r.yearly);
      text('payback', plural(r.payback, 'customer', 'customers'));
      text('months', plural(r.months, 'month', 'months'));
      if (r.care !== null) {
        text('care', plural(r.care, 'customer', 'customers'));
        text('careVerb', r.care === 1 ? 'covers' : 'cover');
      }
      drawChart(r);
      // Screen readers hear the sums once the slider stops moving.
      clearTimeout(srTimer);
      srTimer = setTimeout(function () { sr.textContent = sums.textContent.replace(/\s+/g, ' ').trim(); }, 700);
    }

    box.addEventListener('input', update);
    update();
  }

  /* ---------- "which way to pay suits me?" ---------- */
  var fit = document.querySelector('[data-fit]');
  if (fit) initFit(fit);

  function initFit(box) {
    var buttons = box.querySelectorAll('[data-option]');
    var result = box.querySelector('[data-fit-result]');
    var minis = document.querySelector('[data-minis]');
    var cards = minis ? minis.querySelectorAll('[data-mini]') : [];
    box.hidden = false;
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-option]');
      if (!b) return;
      // Pressing the chosen answer again clears it.
      var off = b.getAttribute('aria-pressed') === 'true';
      var option = b.getAttribute('data-option');
      for (var i = 0; i < buttons.length; i++) buttons[i].setAttribute('aria-pressed', String(!off && buttons[i] === b));
      result.textContent = off ? '' : b.getAttribute('data-text');
      if (minis) minis.classList.toggle('has-match', !off);
      for (var j = 0; j < cards.length; j++) cards[j].classList.toggle('is-match', !off && cards[j].getAttribute('data-mini') === option);
    });
  }

  /* ---------- "How it works": each step lights up as you reach it, left to right ---------- */
  var stepLists = motion ? document.querySelectorAll('[data-steps]') : [];
  for (var sl = 0; sl < stepLists.length; sl++) initSteps(stepLists[sl]);

  function initSteps(list) {
    var items = list.querySelectorAll('.step');
    var listTop = 0;
    list.classList.add('is-live');
    loops.push({
      read: function () { listTop = list.getBoundingClientRect().top; },
      write: function (vh) {
        // Steps side by side light up one after another; steps stacked light up as each arrives.
        var col = 0;
        for (var i = 0; i < items.length; i++) {
          col = i > 0 && items[i].offsetTop === items[i - 1].offsetTop ? col + 1 : 0;
          var on = listTop + items[i].offsetTop < vh * (0.86 - 0.11 * col);
          if (on !== items[i].classList.contains('is-lit')) items[i].classList.toggle('is-lit', on);
        }
      }
    });
  }

  /* ---------- without and with a website: the cards flip over ---------- */
  var flip = document.querySelector('[data-flip]');
  if (flip) initFlip(flip);

  function initFlip(box) {
    var top = box.querySelector('[data-flip-switch]');
    var buttons = top.querySelectorAll('[data-side]');
    top.hidden = false;
    box.classList.add('is-live');
    function set(withSite) {
      box.classList.toggle('is-b', withSite);
      for (var i = 0; i < buttons.length; i++) buttons[i].setAttribute('aria-pressed', String((buttons[i].getAttribute('data-side') === 'b') === withSite));
    }
    top.addEventListener('click', function (e) {
      var b = e.target.closest('[data-side]');
      if (b) set(b.getAttribute('data-side') === 'b');
    });
    // Tapping a card flips them all, too.
    box.querySelector('.flip-rows').addEventListener('click', function () { set(!box.classList.contains('is-b')); });
  }

  /* ---------- things below the fold rise into view as you scroll ---------- */
  if (motion && 'IntersectionObserver' in window) initReveal();

  function initReveal() {
    var selector = '.chapter-head, .tour-list > li, .help, .niche-card, .can-build > li, .idea, .mini, .flip, .fit, ' +
      '.includes > li, .point-cards > li, .plan, .example, .pt-col, .about-inner, .faq-list, .big-callout, .punch, ' +
      '.earn, .calc, .open-demo, .points-card, .start-step, .founding, .price-group-head, .times-table, ' +
      '.ex-website-text, .ex-shot, .ex-tool-device, .ex-tool-text, .ex-flow-step, .ex-flow-line';
    var els = document.querySelectorAll(selector);
    var vh = window.innerHeight;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        io.unobserve(el);
        el.classList.add('rv-in');
        // Then hand the element back to its own styles (hover effects and so on).
        setTimeout(function () {
          el.classList.remove('rv', 'rv-in');
          el.style.removeProperty('--rd');
        }, 1100 + (parseFloat(el.style.getPropertyValue('--rd')) || 0));
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    var parent = null;
    var k = 0;
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.closest('[data-door], [data-journey], [hidden]')) continue;
      if (el.getBoundingClientRect().top < vh) continue;
      k = el.parentNode === parent ? k + 1 : 0;
      parent = el.parentNode;
      el.classList.add('rv');
      if (k) el.style.setProperty('--rd', Math.min(k, 5) * 70 + 'ms');
      io.observe(el);
    }
  }

  /* ---------- cards that tilt towards the pointer (mouse and trackpad only) ---------- */
  if (motion && window.matchMedia('(hover: hover) and (pointer: fine)').matches) initTilt();

  function initTilt() {
    var cards = document.querySelectorAll('.tilt');
    var box = null;
    function enter(e) { box = e.currentTarget.getBoundingClientRect(); }
    function move(e) {
      var el = e.currentTarget;
      if (!box) box = el.getBoundingClientRect();
      var x = (e.clientX - box.left) / box.width;
      var y = (e.clientY - box.top) / box.height;
      el.classList.add('is-tilting');
      el.style.setProperty('--ry', ((x - 0.5) * 7).toFixed(2) + 'deg');
      el.style.setProperty('--rx', ((0.5 - y) * 7).toFixed(2) + 'deg');
      el.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
      el.style.setProperty('--my', (y * 100).toFixed(1) + '%');
    }
    function leave(e) { box = null; e.currentTarget.classList.remove('is-tilting'); }
    for (var i = 0; i < cards.length; i++) {
      cards[i].addEventListener('pointerenter', enter);
      cards[i].addEventListener('pointermove', move);
      cards[i].addEventListener('pointerleave', leave);
    }
  }

  resized();
})();
