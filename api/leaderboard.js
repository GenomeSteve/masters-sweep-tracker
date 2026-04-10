function normaliseName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&amp;/gi, '&')
    .replace(/[^a-zA-Z0-9& ]+/g, ' ')
    .replace(/\bjj\b/gi, 'j j')
    .replace(/\bmin woo\b/gi, 'minwoo')
    .replace(/\bmacintyre\b/gi, 'macintyre')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function aliasesFor(name) {
  const base = String(name || '').trim();
  const out = new Set([base, normaliseName(base)]);

  const manual = {
    'Ludvig Åberg': ['Ludvig Aberg'],
    'Nicolai Højgaard': ['Nicolai Hojgaard'],
    'Sami Välimäki': ['Sami Valimaki'],
    'Sergio García': ['Sergio Garcia'],
    'Min Woo Lee': ['Minwoo Lee'],
    'J.J. Spaun': ['JJ Spaun', 'J J Spaun'],
    'Bryson DeChambeau': ['Bryson Dechambeau'],
    'Tom McKibbin': ['Tom Mckibbin']
  };

  (manual[base] || []).forEach((v) => {
    out.add(v);
    out.add(normaliseName(v));
  });

  const cleaned = base
    .replace(/Å/g, 'A')
    .replace(/å/g, 'a')
    .replace(/ø/g, 'o')
    .replace(/Ø/g, 'O')
    .replace(/ö/g, 'o')
    .replace(/Ö/g, 'O')
    .replace(/ä/g, 'a')
    .replace(/Ä/g, 'A');
  out.add(cleaned);
  out.add(normaliseName(cleaned));

  return Array.from(out).filter(Boolean);
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 Masters Sweep Tracker',
      accept: 'application/json,text/plain,*/*'
    },
    cache: 'no-store'
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}`);
  }
  return await res.json();
}

function buildEventList(scoreboardJson) {
  return Array.isArray(scoreboardJson?.events) ? scoreboardJson.events : [];
}

function pickMastersEvent(events) {
  const exact = events.find((e) => /masters tournament/i.test(e?.name || ''));
  if (exact) return exact;
  const fuzzy = events.find((e) => /masters/i.test(e?.name || '') || /augusta/i.test(e?.shortName || ''));
  return fuzzy || null;
}

function extractCompetitors(eventJson) {
  const comps = eventJson?.competitions?.[0]?.competitors;
  return Array.isArray(comps) ? comps : [];
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

  for (const comp of competitors) {
    const athlete = comp?.athlete || {};
    const displayName = athlete.displayName || comp?.displayName || '';
    const score = parseScoreValue(comp?.score);
    const today = comp?.linescores?.[0]?.value ?? comp?.statistics?.find?.((s) => /today/i.test(s?.name || ''))?.displayValue ?? null;
    const thru = comp?.status?.type?.shortDetail || comp?.status?.type?.detail || '';

    if (!displayName || score === null) continue;

    for (const alias of aliasesFor(displayName)) {
      scores[normaliseName(alias)] = score;
      metadata[normaliseName(alias)] = {
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
    const scoreboard = await fetchJson('https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard');
    const events = buildEventList(scoreboard);
    const event = pickMastersEvent(events);

    if (!event?.id) {
      throw new Error('Could not find Masters Tournament in ESPN scoreboard feed.');
    }

    const eventDetails = await fetchJson(`https://site.api.espn.com/apis/site/v2/sports/golf/pga/summary?event=${encodeURIComponent(event.id)}`);
    const competitors = extractCompetitors(eventDetails);

    if (!competitors.length) {
      throw new Error('No player data returned for the Masters summary feed.');
    }

    const { scores, metadata } = mapFromCompetitors(competitors);

    res.setHeader('Cache-Control', 's-maxage=45, stale-while-revalidate=120');
    res.status(200).json({
      ok: true,
      source: 'ESPN PGA summary feed',
      eventId: event.id,
      eventName: event.name,
      eventStatus: event?.status?.type?.detail || event?.status?.type?.shortDetail || '',
      updatedAt: new Date().toISOString(),
      playerScores: scores,
      playerMeta: metadata,
      playerCount: Object.keys(metadata).length
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error?.message || 'Unknown live fetch failure.'
    });
  }
}
