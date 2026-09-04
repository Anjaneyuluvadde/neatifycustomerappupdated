import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Testing msg91-send-otp...");
  const { data: data1, error: error1 } = await supabase.functions.invoke('msg91-send-otp', {
    body: { phone: '919999999999' }
  });
  console.log("msg91-send-otp Response status:", error1 ? error1.context?.status : '200');

  console.log("Testing send-otp...");
  const { data: data2, error: error2 } = await supabase.functions.invoke('send-otp', {
    body: { phone: '919999999999' }
  });
  console.log("send-otp Response status:", error2 ? error2.context?.status : '200');
}

run();
