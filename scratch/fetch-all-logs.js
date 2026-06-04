// scratch/fetch-all-logs.js
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

async function airtableFetch(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Airtable error ${res.status}: ${err}`);
  }
  return res.json();
}

async function run() {
  try {
    console.log('Fetching Shift Logs...');
    const data = await airtableFetch('/tbleCJR1s6P0m1uOE?pageSize=100');
    const records = data.records || [];
    
    console.log(`Fetched ${records.length} records.`);
    
    const formatted = records.map(r => ({
      id: r.id,
      date: r.fields.Date,
      cleanerState: r.fields['Cleaner State'],
      site: r.fields['Site (from Assignment)']?.[0],
      cleaner: r.fields['Name (from Cleaner)']?.[0],
      signInTime: r.fields['Sign In Time'],
    }));

    console.log(JSON.stringify(formatted, null, 2));

  } catch (error) {
    console.error('Error running fetch script:', error);
  }
}

run();
