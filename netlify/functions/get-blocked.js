// netlify/functions/get-blocked.js
// Returns dates blocked by direct bookings (stored in Netlify Blobs)

const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const suite = event.queryStringParameters?.suite;
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  if (!suite) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing suite' }) };

  try {
    const store = getStore('blocked-dates');
    const dates = await store.get(suite, { type: 'json' }) || [];
    return { statusCode: 200, headers, body: JSON.stringify({ blockedDates: dates }) };
  } catch {
    return { statusCode: 200, headers, body: JSON.stringify({ blockedDates: [] }) };
  }
};
