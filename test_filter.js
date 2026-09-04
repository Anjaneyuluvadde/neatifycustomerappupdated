const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'YOUR_FALLBACK';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_FALLBACK';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: servicesData } = await supabase
      .from("services")
      .select(
        "id, title, service_type, duration, price, original_price, discount_percent, discount_label, tax_percent, image, image2, sort_order, description, gallery_images, work_not_included"
      );
      
  const currentService = servicesData.find(s => s.title === 'Super Neatify 1 Bathroom');
  
  if (!currentService || !servicesData.length) {
      console.log('Missing data');
      return;
  }
  
  const similarServices = servicesData.filter(s => 
      s.id !== currentService.id && 
      s.service_type === currentService.service_type
    ).slice(0, 10);
    
  console.log("Found:", similarServices.length);
  similarServices.forEach(s => console.log(s.title));
}
check();
