import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Testing full signup and profile upsert...");
  
  // 1. Create a random user
  const email = `testuser_${Date.now()}@test.com`;
  const password = 'TestPassword123!';
  
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password
  });
  
  if (authError) {
    console.error("Auth Error:", authError);
    return;
  }
  
  const user = authData.user;
  console.log("Created user:", user.id);
  
  // 2. Try to upsert profile
  const { data: profileData, error: profileError } = await supabase.from('profile').upsert({
    id: user.id,
    full_name: 'Test User',
    email: email,
    phone: '9999999999'
  }).select();
  
  if (profileError) {
    console.error("Profile Upsert Error:", profileError);
  } else {
    console.log("Profile Upsert Success:", profileData);
  }
}

run();
