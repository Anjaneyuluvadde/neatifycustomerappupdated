const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'YOUR_FALLBACK';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_FALLBACK';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('services').select('id, title, service_type, main_category_id');
  if (error) {
    console.error(error);
  } else {
    console.log(data);
  }
}
check();
