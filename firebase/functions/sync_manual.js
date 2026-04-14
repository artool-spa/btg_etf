/**
 * Script de sync manual GA4 → Firestore
 * Uso: node sync_manual.js 2026-03-23 2026-04-12
 */
process.env.GA4_PROPERTY_ID = '257369661';

const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');

if (!getApps().length) initializeApp({ projectId: 'btg---etf' });
const db = getFirestore();

const startOverride = process.argv[2] || null;
const endOverride   = process.argv[3] || null;

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function fmt(d) { return d.toISOString().split('T')[0]; }

function fmtDisplay(iso) {
  const [, m, d] = iso.split('-');
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${parseInt(d)} ${months[parseInt(m)-1]}`;
}

function fmtDuration(seconds) {
  const s = Math.round(parseFloat(seconds || 0));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function intVal(metricValue) { return parseInt(metricValue?.value || 0); }

function getWeekNumber(isoDate) {
  const d = new Date(isoDate);
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
}

function buildDateInfo(startDate, endDate) {
  return { startDate, endDate,
    weekLabel: `${fmtDisplay(startDate)} – ${fmtDisplay(endDate)}`,
    weekNumber: getWeekNumber(startDate) };
}

function getLastWeekInfo() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysToLastMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const lastMon = new Date(today);
  lastMon.setDate(today.getDate() - daysToLastMon - 7);
  const lastSun = new Date(lastMon);
  lastSun.setDate(lastMon.getDate() + 6);
  return buildDateInfo(fmt(lastMon), fmt(lastSun));
}

// ─────────────────────────────────────────────
// RECALCULATE CUMULATIVE TOTALS
// ─────────────────────────────────────────────
const CAMPAIGN_START_DATE = '2026-03-23';

async function recalcAggregates() {
  const snap = await db
    .collection('campaigns').doc('etf-generico')
    .collection('weeks')
    .where('start_date', '>=', CAMPAIGN_START_DATE)
    .orderBy('start_date', 'asc')
    .get();

  let users_acum = 0, sessions_acum = 0, week_count = 0, totalDurSec = 0;

  snap.forEach(doc => {
    const w = doc.data();
    users_acum    += w.total_users    || 0;
    sessions_acum += w.total_sessions || 0;
    week_count++;
    if (w.total_avg_duration && w.total_sessions) {
      const [mm, ss] = w.total_avg_duration.split(':').map(Number);
      totalDurSec += ((mm * 60) + ss) * w.total_sessions;
    }
  });

  const avg_duration_acum = sessions_acum > 0
    ? fmtDuration(String(totalDurSec / sessions_acum)) : '00:00';

  await db.collection('campaigns').doc('etf-generico').set({
    users_acum, sessions_acum, avg_duration_acum, week_count,
    last_updated: FieldValue.serverTimestamp(),
  }, { merge: true });

  console.log('📊 Aggregates updated:', { users_acum, sessions_acum, avg_duration_acum, week_count });
}

// ─────────────────────────────────────────────
// MAIN SYNC
// ─────────────────────────────────────────────
async function runSync(startOverride, endOverride) {
  const { startDate, endDate, weekLabel, weekNumber } =
    startOverride && endOverride
      ? buildDateInfo(startOverride, endOverride)
      : getLastWeekInfo();

  console.log(`📅 Pulling GA4 data: ${startDate} → ${endDate}`);

  const propertyId = process.env.GA4_PROPERTY_ID;
  const client     = new BetaAnalyticsDataClient();
  const property   = `properties/${propertyId}`;
  const dateRanges = [{ startDate, endDate }];

  const CAMPAIGN_GOOGLE_ADS = '[BTG] (BTG Corp) - Search Tráfico Fondo ETF Genérico';
  const LANDING_PATH        = '/que-hacemos/asset-management/etf';

  // 1. Adquisición por campaña
  const [acqResp] = await client.runReport({
    property, dateRanges,
    dimensions: [{ name: 'sessionCampaignName' }, { name: 'sessionSourceMedium' }],
    metrics: [{ name: 'totalUsers' }, { name: 'sessions' }, { name: 'averageSessionDuration' }],
    dimensionFilter: {
      andGroup: {
        expressions: [
          { orGroup: { expressions: [
            { filter: { fieldName: 'sessionCampaignName', stringFilter: { matchType: 'CONTAINS', value: 'btg_etf' } } },
            { filter: { fieldName: 'sessionCampaignName', stringFilter: { matchType: 'EXACT', value: CAMPAIGN_GOOGLE_ADS } } },
          ]}},
          { filter: { fieldName: 'landingPage', stringFilter: { matchType: 'CONTAINS', value: LANDING_PATH } } },
        ],
      },
    },
  });

  const campaignMap = {};
  for (const row of (acqResp.rows || [])) {
    const campaignName = row.dimensionValues[0].value;
    const sourceMedium = row.dimensionValues[1].value;
    const users        = intVal(row.metricValues[0]);
    const sessions     = intVal(row.metricValues[1]);
    const avgDurSec    = parseFloat(row.metricValues[2]?.value || 0);
    if (!campaignMap[campaignName]) {
      campaignMap[campaignName] = { name: campaignName, users: 0, sessions: 0, total_dur_sec: 0, sources: [] };
    }
    campaignMap[campaignName].users         += users;
    campaignMap[campaignName].sessions      += sessions;
    campaignMap[campaignName].total_dur_sec += avgDurSec * sessions;
    campaignMap[campaignName].sources.push({ source_medium: sourceMedium, users, sessions, avg_duration: fmtDuration(String(avgDurSec)) });
  }

  const campaignsArr = Object.values(campaignMap).map(c => ({
    name: c.name, users: c.users, sessions: c.sessions,
    avg_duration: c.sessions > 0 ? fmtDuration(String(c.total_dur_sec / c.sessions)) : '00:00',
    sources: c.sources,
  }));

  const total_users    = campaignsArr.reduce((s, c) => s + c.users, 0);
  const total_sessions = campaignsArr.reduce((s, c) => s + c.sessions, 0);
  const totalDurSec    = Object.values(campaignMap).reduce((s, c) => s + c.total_dur_sec, 0);
  const total_avg_duration = total_sessions > 0 ? fmtDuration(String(totalDurSec / total_sessions)) : '00:00';

  // 2. Orgánico y directo
  const [otherResp] = await client.runReport({
    property, dateRanges,
    dimensions: [{ name: 'sessionSourceMedium' }],
    metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'averageSessionDuration' }],
    dimensionFilter: {
      andGroup: {
        expressions: [
          { orGroup: { expressions: [
            { filter: { fieldName: 'sessionSourceMedium', stringFilter: { matchType: 'CONTAINS', value: 'organic' } } },
            { filter: { fieldName: 'sessionSourceMedium', stringFilter: { matchType: 'EXACT', value: '(direct) / (none)' } } },
          ]}},
          { filter: { fieldName: 'landingPage', stringFilter: { matchType: 'CONTAINS', value: LANDING_PATH } } },
        ],
      },
    },
  });

  const sources_other = (otherResp.rows || []).map(row => ({
    source_medium: row.dimensionValues[0].value,
    sessions:      intVal(row.metricValues[0]),
    users:         intVal(row.metricValues[1]),
    avg_duration:  fmtDuration(row.metricValues[2]?.value),
  }));

  // 3. Eventos botón
  const [eventsResp] = await client.runReport({
    property, dateRanges,
    dimensions: [{ name: 'eventName' }],
    metrics: [{ name: 'totalUsers' }, { name: 'eventCount' }, { name: 'averageSessionDuration' }],
    dimensionFilter: {
      andGroup: {
        expressions: [
          { orGroup: { expressions: [
            { filter: { fieldName: 'sessionCampaignName', stringFilter: { matchType: 'CONTAINS', value: 'btg_etf' } } },
            { filter: { fieldName: 'sessionCampaignName', stringFilter: { matchType: 'EXACT', value: CAMPAIGN_GOOGLE_ADS } } },
          ]}},
          { filter: { fieldName: 'landingPage', stringFilter: { matchType: 'CONTAINS', value: LANDING_PATH } } },
        ],
      },
    },
  });

  const btnRow = eventsResp.rows?.find(r => {
    const ev = r.dimensionValues[0].value.toLowerCase();
    return ev.includes('fondo') || ev.includes('ver_fondo') || ev.includes('button') || ev.includes('cta');
  });
  const bm = btnRow?.metricValues;

  // Build + write document
  const weekId = `${startDate}_${endDate}`;
  const doc = {
    week_id: weekId, week_number: weekNumber, week_label: weekLabel,
    period: `${fmtDisplay(startDate)} – ${fmtDisplay(endDate)}`,
    start_date: startDate, end_date: endDate,
    updated_at: FieldValue.serverTimestamp(),
    total_users, total_sessions, total_avg_duration,
    campaigns: campaignsArr, sources_other,
    button_users: intVal(bm?.[0]), button_events: intVal(bm?.[1]),
    button_duration: fmtDuration(bm?.[2]?.value),
  };

  await db.collection('campaigns').doc('etf-generico')
    .collection('weeks').doc(weekId)
    .set(doc, { merge: true });

  await recalcAggregates();

  console.log('✅ Sync completo:', {
    weekId, total_sessions, total_users, total_avg_duration,
    campaigns: campaignsArr.map(c => ({ name: c.name, sessions: c.sessions })),
  });
  return doc;
}

runSync(startOverride, endOverride).then(() => process.exit(0)).catch(e => { console.error('❌', e); process.exit(1); });
