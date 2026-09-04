
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://haertefebbonxqiwtote.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhZXJ0ZWZlYmJvbnhxaXd0b3RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MDI3MTksImV4cCI6MjA4NjI3ODcxOX0.fq-YY1yXfKPlmB3xyp_cTQLSNg-pcIMBW9XwgIAFjb8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
    console.log('Fetching services...');
    const { data, error } = await supabase.from("services").select("*");
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Services count:', data.length);
        if (data.length > 0) {
            console.log('First service keys:', Object.keys(data[0]));
            console.log('First service type:', data[0].service_type);
        } else {
            console.log('No services found.');
        }
    }
}

test();
