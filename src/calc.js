/* Calculator maths and rand formatting.
   Shared by build.js (for the example figures in the HTML) and site.js (live). */
(function (root) {
  'use strict';

  // Round "how many" results up, ignoring floating-point dust (3.0000000004 is 3).
  function ceilCount(x) {
    return Math.ceil(x - 1e-9);
  }

  // Guesthouses: commission paid, and direct bookings needed to cover the monthly fee.
  function commission(o) {
    var rate = Number(o.rate), nights = Number(o.nights), percent = Number(o.percent), monthly = Number(o.monthly);
    if (!(rate > 0) || !(percent > 0) || !(nights >= 0) || !(monthly > 0)) return null;
    var perBooking = rate * percent / 100;
    return {
      paid: rate * nights * percent / 100,
      perBooking: perBooking,
      needed: ceilCount(monthly / perBooking)
    };
  }

  // Salons and restaurants: extra bookings or customers needed to cover the monthly fee.
  function breakEven(o) {
    var price = Number(o.price), monthly = Number(o.monthly);
    if (!(price > 0) || !(monthly > 0)) return null;
    return { needed: ceilCount(monthly / price) };
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

  var api = { commission: commission, breakEven: breakEven, about: about, rand: rand, ceilCount: ceilCount };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FDSCalc = api;
})(this);
