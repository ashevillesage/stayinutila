const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('../netlify/functions/ical-proxy'), 'utf8');

async function blockedDates(events, now = '2026-11-14T02:00:00Z') {
  const context = {
    exports: {}, process: { env: {} },
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : [now])); }
    },
    fetch: async () => ({ text: async () => events.map(([start, end, summary]) =>
      `BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:${start}\r\nDTEND;VALUE=DATE:${end}\r\nSUMMARY:${summary}\r\nEND:VEVENT`
    ).join('\r\n') }),
  };
  vm.runInNewContext(source, context);
  const result = await context.exports.handler({ queryStringParameters: { suite: 'seahorse' } });
  assert.equal(result.statusCode, 200);
  return JSON.parse(result.body).blockedDates;
}

test('allows same-day arrival using Utila time even after midnight UTC', async () => {
  assert.deepEqual(await blockedDates([
    ['20261113', '20261114', 'Airbnb (Not available)'],
  ]), []);
});

test('preserves actual reservations overlapping the same-day rule', async () => {
  assert.deepEqual(await blockedDates([
    ['20261113', '20261114', 'Airbnb (Not available)'],
    ['20261113', '20261115', 'Reserved'],
  ]), ['2026-11-13', '2026-11-14']);
});

test('preserves future availability blocks and longer blocks', async () => {
  assert.deepEqual(await blockedDates([
    ['20261114', '20261115', 'Airbnb (Not available)'],
    ['20261112', '20261114', 'Airbnb (Not available)'],
  ]), ['2026-11-12', '2026-11-13', '2026-11-14']);
});

test('preserves other same-day events', async () => {
  for (const summary of ['Reserved', 'Maintenance', '']) {
    assert.deepEqual(await blockedDates([
      ['20261113', '20261114', summary],
    ]), ['2026-11-13']);
  }
});

test('handles the year boundary', async () => {
  assert.deepEqual(await blockedDates([
    ['20261231', '20270101', 'Airbnb (Not available)'],
  ], '2027-01-01T02:00:00Z'), []);
});
