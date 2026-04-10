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

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'application/json,text/plain,*/*'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${url}`);
  }

  return response.json();
}

function buildEventList(scoreboard) {
  if (!scoreboard) return [];

  if (Array.isArray(scoreboard.events)) {
    return scoreboard.events;
  }

  if (scoreboard.event) {
    return [scoreboard.event];
  }

  return [];
}

function pickMastersEvent(events) {
  if (!Array.isArray(events) || !events.length) return null;

  const normalise = (value) =>
    String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

  const mastersByName = events.find((event) => {
    const name = normalise(
      event?.name ||
      event?.shortName ||
      event?.displayName ||
      event?.season?.type?.name
    );

    return (
      name.includes('masters tournament') ||
      name === 'masters' ||
      name.includes('the masters')
    );
  });

  if (mastersByName) return mastersByName;

  const mastersById = events.find((event) => String(event?.id) === '401811941');
  if (mastersById) return mastersById;

  return events[0] || null;
}

function extractCompetitors(event) {
  const competitors =
    event?.competitions?.[0]?.competitors ||
    event?.competitors ||
    [];

  return Array.isArray(competitors) ? competitors : [];
}

function mapFromCompetitors(competitors) {
  const scores = {};
  const metadata = {};

  for (const competitor of competitors) {
    const athlete = competitor?.athlete || competitor?.player || {};
    const rawName =
      athlete?.displayName ||
      athlete?.shortName ||
      competitor?.displayName ||
      competitor?.name ||
      '';

    const cleanName = normalisePlayerName(rawName);
    if (!cleanName) continue;

    const numericScore = parseScore(competitor);

    if (numericScore === null) continue;

    scores[cleanName] = numericScore;
    metadata[cleanName] = {
      rawName,
      position:
        competitor?.curatedRank?.current ||
        competitor?.order ||
        competitor?.rank ||
        '',
      toPar:
        competitor?.score?.displayValue ??
        competitor?.score ??
        '',
      thru:
        competitor?.linescores?.length
          ? competitor.linescores.length
          : competitor?.status?.type?.shortDetail || '',
      today:
        competitor?.statistics?.find?.((s) =>
          String(s?.name || '').toLowerCase().includes('today')
        )?.displayValue || ''
    };

    const altNames = buildAltNames(rawName);
    for (const altName of altNames) {
      if (!(altName in scores)) {
        scores[altName] = numericScore;
        metadata[altName] = metadata[cleanName];
      }
    }
  }

  return { scores, metadata };
}

function parseScore(competitor) {
  const candidates = [
    competitor?.score?.value,
    competitor?.scoreValue,
    competitor?.toPar,
    competitor?.statistics?.find?.((s) =>
      String(s?.name || '').toLowerCase().includes('to par')
    )?.value
  ];

  for (const candidate of candidates) {
    if (candidate === 0) return 0;
    if (candidate === '0') return 0;
    if (candidate === 'E' || candidate === 'EVEN') return 0;

    const num = Number(candidate);
    if (Number.isFinite(num)) return num;
  }

  const display =
    competitor?.score?.displayValue ??
    competitor?.score ??
    competitor?.displayScore ??
    '';

  if (typeof display === 'string') {
    const trimmed = display.trim().toUpperCase();
    if (trimmed === 'E') return 0;

    const match = trimmed.match(/^([+-]?\d+)$/);
    if (match) {
      return Number(match[1]);
    }
  }

  return null;
}

function normalisePlayerName(name) {
  return String(name || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function buildAltNames(rawName) {
  const clean = String(rawName || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  const parts = clean.split(' ');
  if (parts.length < 2) return [];

  const first = parts[0];
  const last = parts[parts.length - 1];
  const middle = parts.slice(1, -1).join(' ');

  const variants = new Set();

  variants.add(normalisePlayerName(clean));
  variants.add(normalisePlayerName(`${first} ${last}`));
  variants.add(normalisePlayerName(`${first[0]}. ${last}`));
  variants.add(normalisePlayerName(`${first[0]} ${last}`));

  if (middle) {
    variants.add(normalisePlayerName(`${first} ${middle} ${last}`));
  }

  return [...variants].filter(Boolean);
}    .replace(/å/g, 'a')
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

    const competitors = extractCompetitors(event);

    if (!competitors.length) {
      throw new Error('No player data returned from the ESPN scoreboard feed.');
    }

    const { scores, metadata } = mapFromCompetitors(competitors);

    res.setHeader('Cache-Control', 's-maxage=45, stale-while-revalidate=120');
    res.status(200).json({
      ok: true,
      source: 'ESPN PGA scoreboard feed',
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
