import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/verify-otp`;
  console.log("Fetching", url);
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({ phone: '919999999999', otp: '1234' })
  });
  
  console.log("Status:", res.status);
  console.log("Body:", await res.text());
}

run();
