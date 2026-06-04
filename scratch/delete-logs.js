// scratch/delete-logs.js
const fs = require('fs');
const path = require('path');

// 1. Parse .env.local
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.substring(1, value.length - 1);
      }
      process.env[key] = value.trim();
    }
  });
}

const BASE_URL = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}`;
const headers = {
  Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
  'Content-Type': 'application/json',
};

async function airtableFetch(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Airtable error ${res.status}: ${err}`);
  }
  return res.json();
}

async function run() {
  try {
    const todayStr = new Date().toLocaleDateString('en-GB', { timeZone: 'Australia/Sydney' });
    console.log('Today (Sydney):', todayStr);

    // Fetch all logs for today
    const formula = `{Date} = "${todayStr}"`;
    const encodedFormula = encodeURIComponent(formula);
    const data = await airtableFetch(`/tbleCJR1s6P0m1uOE?filterByFormula=${encodedFormula}`);
    const records = data.records || [];
    
    // Filter for 179 Elizabeth
    const targets = records.filter(r => {
      const site = r.fields['Site (from Assignment)']?.[0] || '';
      return site === '179 Elizabeth';
    });

    console.log(`Found ${targets.length} shift logs for today on target site.`);

    for (const record of targets) {
      const siteName = record.fields['Site (from Assignment)']?.[0] || 'Unknown';
      const state = record.fields['Cleaner State'] || 'Unknown';
      const time = record.fields['Sign In Time'] || 'Unknown';
      console.log(`Deleting shift log ID: ${record.id} (${siteName} | State: ${state} | Time: ${time})`);
      
      await airtableFetch(`/tbleCJR1s6P0m1uOE/${record.id}`, {
        method: 'DELETE'
      });
      console.log(`Successfully deleted ${record.id}`);
    }

    console.log('\nAll targeted 179 Elizabeth shift logs have been deleted successfully!');
  } catch (error) {
    console.error('Error running delete script:', error);
  }
}

run();
