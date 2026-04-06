// netlify/functions/record-booking.js
// Called after payment to store blocked dates in Netlify Blobs
// Also sends you a WhatsApp notification via CallMeBot (free)

const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  try {
    const { suite, checkIn, checkOut, guestName, guestEmail, totalPaid, paymentMethod } = JSON.parse(event.body);

    if (!suite || !checkIn || !checkOut) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    // Store booking in Netlify Blobs
    const store = getStore('bookings');
    const bookingId = `${suite}-${checkIn}-${Date.now()}`;
    const booking = { suite, checkIn, checkOut, guestName, guestEmail, totalPaid, paymentMethod, bookedAt: new Date().toISOString() };
    await store.setJSON(bookingId, booking);

    // Also store blocked dates per suite for fast lookup
    const calStore = getStore('blocked-dates');
    const existing = await calStore.get(suite, { type: 'json' }) || [];
    const dates = generateDateRange(checkIn, checkOut);
    const updated = [...new Set([...existing, ...dates])].sort();
    await calStore.setJSON(suite, updated);

    // Optional: WhatsApp notification via CallMeBot
    // Sign up free at callmebot.com, then set CALLMEBOT_PHONE and CALLMEBOT_APIKEY in Netlify env vars
    if (process.env.CALLMEBOT_PHONE && process.env.CALLMEBOT_APIKEY) {
      const msg = `New booking! ${suite} | ${checkIn} to ${checkOut} | ${guestName || 'Guest'} | ${paymentMethod} | $${totalPaid}`;
      await fetch(`https://api.callmebot.com/whatsapp.php?phone=${process.env.CALLMEBOT_PHONE}&text=${encodeURIComponent(msg)}&apikey=${process.env.CALLMEBOT_APIKEY}`).catch(() => {});
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, bookingId }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

function generateDateRange(start, end) {
  const dates = [];
  let cur = new Date(start);
  const endDate = new Date(end);
  while (cur < endDate) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}
