import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Testing profile upsert...");
  
  // 1. Authenticate with a fake or real user? I can't easily do OTP here.
  // Let's just try to insert a row using anon key for a random UUID.
  // If it fails with RLS, we'll see the exact error.
  
  const fakeId = '00000000-0000-0000-0000-000000000000';
  
  const { data, error } = await supabase.from('profile').insert({
    id: fakeId,
    full_name: 'Test',
    email: 'test@example.com',
    phone: '9999999999'
  });
  
  if (error) {
    console.error("Insert Error:", error);
  } else {
    console.log("Insert Success:", data);
  }
}

run();
