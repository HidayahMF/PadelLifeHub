// One-time (or repeatable) script that creates/updates the LifeHub scheduler
// cron job on cron-job.org via their REST API, pointing at the deployed
// backend's POST /api/cron/tick endpoint.
//
// Requirements (from backend/.env — git-ignored):
//   CRONJOB_API_TOKEN   API key from cron-job.org Console → Settings → API
//   CRON_SECRET         the same secret the backend expects in x-cron-secret
//
// Optional:
//   CRON_URL            target URL (default https://lifehub-api.vercel.app/api/cron/tick)
//   CRONJOB_JOB_ID      if set, updates that job instead of searching by title
//
// Usage:
//   node scripts/setup-cron-job.cjs

require('dotenv').config();

const API = 'https://api.cron-job.org';

const token = process.env.CRONJOB_API_TOKEN;
const cronSecret = process.env.CRON_SECRET;
const url =
  process.env.CRON_URL || 'https://lifehub-api.vercel.app/api/cron/tick';

if (!token || !cronSecret) {
  console.error(
    '[setup-cron-job] missing CRONJOB_API_TOKEN and/or CRON_SECRET in backend/.env'
  );
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
};

const JOB = {
  title: 'LifeHub scheduler tick',
  url,
  enabled: true,
  saveResponses: true,
  schedule: {
    timezone: 'Asia/Jakarta',
    expiresAt: 0,
    hours: [-1],
    mdays: [-1],
    minutes: [-1],
    months: [-1],
    wdays: [-1],
  },
  requestMethod: 1, // POST
  extendedData: {
    headers: {
      'x-cron-secret': cronSecret,
      'Content-Type': 'application/json',
    },
    body: '{}',
  },
};

async function request(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`[setup-cron-job] ${method} ${path} -> ${res.status}:`, JSON.stringify(data));
    process.exit(1);
  }
  return data;
}

(async () => {
  let jobId = process.env.CRONJOB_JOB_ID;

  if (!jobId) {
    const { jobs = [] } = await request('GET', '/jobs');
    const existing = jobs.find((j) => j.title === JOB.title);
    jobId = existing?.jobId;
    if (jobId) {
      console.log(`[setup-cron-job] updating existing job #${jobId}`);
      await request('PATCH', `/jobs/${jobId}`, { job: JOB });
    } else {
      console.log('[setup-cron-job] creating a new job');
      const created = await request('PUT', '/jobs', { job: JOB });
      jobId = created.jobId;
    }
  } else {
    console.log(`[setup-cron-job] updating job #${jobId}`);
    await request('PATCH', `/jobs/${jobId}`, { job: JOB });
  }

  console.log(`[setup-cron-job] done — job #${jobId} hits ${url} every minute`);
  console.log('[setup-cron-job] remember to set the same CRON_SECRET in the Vercel backend env');
})().catch((err) => {
  console.error('[setup-cron-job] unexpected error:', err.message);
  process.exit(1);
});
