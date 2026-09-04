import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Testing verify-otp...");
  const { data: data1, error: error1 } = await supabase.functions.invoke('verify-otp', {
    body: { phone: '919999999999', otp: '1234' }
  });
  console.log("verify-otp Error:", error1);

  console.log("Testing msg91-verify-otp...");
  const { data: data2, error: error2 } = await supabase.functions.invoke('msg91-verify-otp', {
    body: { phone: '919999999999', otp: '1234' }
  });
  console.log("msg91-verify-otp Error:", error2);
}

run();
