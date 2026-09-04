import fetch from 'node-fetch';

async function test() {
  console.log("Testing auth.theneatifyteam.in...");
  
  const url = "https://auth.theneatifyteam.in.supabase.co/functions/v1/msg91-verify-otp";
  
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ phone: "919999999999", otp: "1234" })
  });
  
  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Response:", text);
}

test();
