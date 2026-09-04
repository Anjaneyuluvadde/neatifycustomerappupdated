import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const email = `testuser_${Date.now()}@test.com`;
  const { data: authData } = await supabase.auth.signUp({
    email,
    password: 'TestPassword123!'
  });
  
  const user = authData.user;
  
  const { data: profileData, error: profileError } = await supabase.from('profile').upsert({
    id: user.id,
    full_name: 'Test User',
    email: email,
    phone: '918309358568' // 12 digits
  }).select();
  
  console.log("Upsert with 12 digits:", profileError ? profileError.message : "Success");
}
run();
