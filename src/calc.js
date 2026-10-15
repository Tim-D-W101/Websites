/* Calculator maths and rand formatting.
   Shared by build.js (for the example figures in the HTML) and site.js (live). */
(function (root) {
  'use strict';

  // Round "how many" results up, ignoring floating-point dust (3.0000000004 is 3).
  function ceilCount(x) {
    return Math.ceil(x - 1e-9);
  }

  // Guesthouses: commission paid, and direct nights needed to pay back the build
  // and to cover a monthly plan's fee.
  function commission(o) {
    var rate = Number(o.rate), nights = Number(o.nights), percent = Number(o.percent);
    var build = Number(o.build), care = Number(o.care);
    if (!(rate > 0) || !(percent > 0) || !(nights >= 0) || !(build > 0)) return null;
    var perNight = rate * percent / 100;
    var paid = rate * nights * percent / 100;
    return {
      paid: paid,
      perYear: paid * 12,
      perNight: perNight,
      payback: ceilCount(build / perNight),
      care: care > 0 ? ceilCount(care / perNight) : null
    };
  }

  // Salons and restaurants: bookings or customers needed to pay back the build,
  // and to cover a monthly plan's fee.
  function payback(o) {
    var price = Number(o.price), build = Number(o.build), care = Number(o.care);
    if (!(price > 0) || !(build > 0)) return null;
    return {
      payback: ceilCount(build / price),
      care: care > 0 ? ceilCount(care / price) : null
    };
  }

  // Home page: takings from new customers, how many customers (and months) pay for the
  // build, and how many a month cover a monthly plan's fee.
  function earnings(o) {
    var spend = Number(o.spend), customers = Number(o.customers);
    var build = Number(o.build), care = Number(o.care);
    if (!(spend > 0) || !(customers > 0) || !(build > 0)) return null;
    var monthly = spend * customers;
    var payback = ceilCount(build / spend);
    return {
      monthly: monthly,
      yearly: monthly * 12,
      payback: payback,
      months: ceilCount(payback / customers),
      care: care > 0 ? ceilCount(care / spend) : null
    };
  }

  // The spend slider runs from 0 to 100 on a curve, so R80 is as easy to pick as R3 000.
  // 0 is min, 100 is max, and amounts are rounded to R5, R10 or R50.
  function spendAt(pos, min, max) {
    var v = min * Math.pow(max / min, pos / 100);
    var step = v < 100 ? 5 : v < 1000 ? 10 : 50;
    return Math.min(max, Math.max(min, Math.round(v / step) * step));
  }
  function spendPos(value, min, max) {
    return Math.max(0, Math.min(100, Math.round(100 * Math.log(value / min) / Math.log(max / min))));
  }

  // "About" amounts: nearest R10 from R100 up, nearest rand below that.
  function about(n) {
    return n >= 100 ? Math.round(n / 10) * 10 : Math.round(n);
  }

  // 1500 -> "R1 500" (no-break space so the amount never wraps).
  function rand(n) {
    var s = String(Math.round(Number(n) || 0));
    return 'R' + s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  var api = {
    commission: commission, payback: payback, earnings: earnings, spendAt: spendAt, spendPos: spendPos,
    about: about, rand: rand, ceilCount: ceilCount
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FDSCalc = api;
})(this);
