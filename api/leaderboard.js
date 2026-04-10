function normaliseName(name) {
  return String(name || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/å/g, 'a')
    .replace(/ø/g, 'o')
    .replace(/ö/g, 'o')
    .replace(/ä/g, 'a');
}

function aliasesFor(name) {
  const clean = String(name || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  const parts = clean.split(' ');
  if (parts.length < 2) return [clean];

  const first = parts[0];
  const last = parts[parts.length - 1];

  const out = new Set();
  out.add(clean);
  out.add(`${first} ${last}`);
  out.add(`${first[0]}. ${last}`);
  out.add(`${first[0]} ${last}`);

  return Array.from(out).map(normaliseName).filter(Boolean);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 Masters Sweep Tracker',
      'Accept': 'application/json,text/plain,*/*'
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${url}`);
  }

  return await response.json();
}

function buildEventList(scoreboard) {
  return Array.isArray(scoreboard?.events) ? scoreboard.events : [];
}

function pickMastersEvent(events) {
  const exact = events.find((event) =>
    /masters tournament/i.test(event?.name || '')
  );
  if (exact) return exact;

  const fuzzy = events.find((event) =>
    /masters/i.test(event?.name || '') ||
    /augusta/i.test(event?.shortName || '')
  );
  return fuzzy || null;
}

function extractCompetitors(event) {
  const competitors = event?.competitions?.[0]?.competitors;
  return Array.isArray(competitors) ? competitors : [];
}

function parseScoreValue(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;

  const str = String(raw).trim();
  if (!str || str === '--') return null;
  if (/^e$/i.test(str)) return 0;

  const num = Number(str.replace(/^\+/, ''));
  return Number.isFinite(num) ? num : null;
}

function mapFromCompetitors(competitors) {
  const scores = {};
  const metadata = {};

  for (const competitor of competitors) {
    const athlete = competitor?.athlete || {};
    const displayName =
      athlete?.displayName ||
      competitor?.displayName ||
      competitor?.name ||
      '';

    const score =
      parseScoreValue(competitor?.score?.value) ??
      parseScoreValue(competitor?.score) ??
      parseScoreValue(competitor?.toPar) ??
      parseScoreValue(competitor?.displayScore);

    const today =
      competitor?.linescores?.[0]?.value ??
      competitor?.statistics?.find?.((s) =>
        /today/i.test(s?.name || '')
      )?.displayValue ??
      null;

    const thru =
      competitor?.status?.type?.shortDetail ||
      competitor?.status?.type?.detail ||
      '';

    if (!displayName || score === null) continue;

    for (const alias of aliasesFor(displayName)) {
      scores[alias] = score;
      metadata[alias] = {
        displayName,
        score,
        today,
        thru
      };
    }
  }

  return { scores, metadata };
}

export default async function handler(req, res) {
  try {
    const scoreboard = await fetchJson(
      'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard'
    );

    const events = buildEventList(scoreboard);
    const event = pickMastersEvent(events);

    if (!event?.id) {
      throw new Error('Could not find Masters Tournament in ESPN scoreboard feed.');
    }

    const competitors = extractCompetitors(event);

    if (!competitors.length) {
      throw new Error('No player data returned from the ESPN scoreboard feed.');
    }

    const { scores, metadata } = mapFromCompetitors(competitors);

    res.setHeader('Cache-Control', 's-maxage=45, stale-while-revalidate=120');
    return res.status(200).json({
      ok: true,
      debug: 'scoreboard-only-clean',
      source: 'ESPN PGA scoreboard feed',
      eventId: event.id,
      eventName: event.name || 'Masters Tournament',
      eventStatus: event?.status?.type?.detail || event?.status?.type?.shortDetail || '',
      updatedAt: new Date().toISOString(),
      playerScores: scores,
      playerMeta: metadata,
      playerCount: Object.keys(metadata).length
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || 'Unknown live fetch failure.'
    });
  }
}
