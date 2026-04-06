// netlify/functions/ical-proxy.js
// Fetches Airbnb iCal feeds server-side to avoid CORS issues
// Deploy this with your Netlify site - it runs as a serverless function

const ICAL_URLS = {
  seahorse:   process.env.ICAL_SEAHORSE   || 'https://www.airbnb.com/calendar/ical/973295284122220837.ics?t=cd2602fd4d5b42949b86f93d9f20e40a',
  ray:        process.env.ICAL_RAY        || 'https://www.airbnb.com/calendar/ical/973358201891362246.ics?t=5175f0c23810401599a8fa1da5e636de',
  turtle:     process.env.ICAL_TURTLE     || 'https://www.airbnb.com/calendar/ical/1039403653068408710.ics?t=5ac5ab6c3df1452686be60bdd3d9094d',
  angelfish:  process.env.ICAL_ANGELFISH  || 'https://www.airbnb.com/calendar/ical/973431015063456786.ics?t=6e88bcc6fa3d41f98a9b493272314ba8',
  whaleshark: process.env.ICAL_WHALESHARK || 'https://www.airbnb.com/calendar/ical/1003798548751344235.ics?t=636cb1747eda44168dd55b5e69cf3f8c',
};

exports.handler = async (event) => {
  const suite = event.queryStringParameters?.suite;
  if (!suite || !ICAL_URLS[suite]) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid or missing suite parameter' }),
    };
  }

  const url = ICAL_URLS[suite];
  if (!url) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ blockedDates: [] }),
    };
  }

  try {
    const res = await fetch(url);
    const text = await res.text();
    const blockedDates = parseICal(text);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ blockedDates }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch calendar', detail: err.message }),
    };
  }
};

function parseICal(text) {
  const blocked = new Set();
  const events = text.split('BEGIN:VEVENT');
  for (let i = 1; i < events.length; i++) {
    const block = events[i];
    const dtstart = block.match(/DTSTART(?:;VALUE=DATE)?:(\d{8})/)?.[1];
    const dtend   = block.match(/DTEND(?:;VALUE=DATE)?:(\d{8})/)?.[1];
    if (dtstart && dtend) {
      let cur = parseDate(dtstart);
      const end = parseDate(dtend);
      while (cur < end) {
        blocked.add(formatDate(cur));
        cur.setDate(cur.getDate() + 1);
      }
    }
  }
  return Array.from(blocked).sort();
}

function parseDate(str) {
  return new Date(
    parseInt(str.slice(0,4)),
    parseInt(str.slice(4,6)) - 1,
    parseInt(str.slice(6,8))
  );
}

function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
