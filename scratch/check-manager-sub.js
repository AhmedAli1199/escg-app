// scratch/check-manager-sub.js
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.substring(1, value.length - 1);
      else if (value.startsWith("'") && value.endsWith("'")) value = value.substring(1, value.length - 1);
      process.env[key] = value.trim();
    }
  });
}

async function check() {
  const baseId = process.env.AIRTABLE_BASE_ID;
  const token = process.env.AIRTABLE_TOKEN;
  
  const res = await fetch(`https://api.airtable.com/v0/${baseId}/tblp2THjEA7Zy5pXq`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  const sub = data.records.find(r => r.fields.Site === '__push_subscription_manager__');
  
  if (sub) {
    console.log('Manager subscription description:', sub.fields.Description);
  } else {
    console.log('No manager subscription found.');
  }
}

check();
