// @ts-nocheck
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, fullName, email, phone, referralCode, referredById } = await req.json();

    if (!userId || !fullName) {
      return new Response(
        JSON.stringify({ success: false, message: 'User ID and Full Name are required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('EXPO_PUBLIC_SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Server configuration error: Supabase URL or Service Key missing.');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const cleanPhone = String(phone || "").replace(/\D/g, "").slice(-10);
    const trimmedName = String(fullName).trim();
    const cleanEmail = email && typeof email === 'string' && email.trim() && !email.includes('@neatify.app') ? email.trim() : null;

    // 1. Update Supabase Auth user via Admin API (Updates auth.users table directly)
    const authUpdatePayload: any = {
      user_metadata: {
        full_name: trimmedName,
        phone_number: cleanPhone ? `+91${cleanPhone}` : undefined
      }
    };

    if (cleanEmail) {
      authUpdatePayload.email = cleanEmail;
      authUpdatePayload.email_confirm = true;
    }

    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.updateUserById(userId, authUpdatePayload);
    if (authErr) {
      console.warn("⚠️ Auth update warning:", authErr);
    }

    // 2. Save/Update Profile table in database
    const profilePayload: any = {
      id: userId,
      full_name: trimmedName,
      email: cleanEmail,
      updated_at: new Date().toISOString()
    };
    if (cleanPhone) profilePayload.phone = cleanPhone;
    if (referralCode) profilePayload.referral_code = referralCode;
    if (referredById) profilePayload.referred_by_id = referredById;

    const { error: profileErr } = await supabaseAdmin
      .from('profile')
      .upsert(profilePayload);

    if (profileErr) {
      throw profileErr;
    }

    // 3. Initialize Wallet if not existing
    try {
      await supabaseAdmin.from('wallet').upsert({
        user_id: userId,
        balance: 0
      });
    } catch (_) {}

    return new Response(
      JSON.stringify({
        success: true,
        user: authUser?.user,
        message: 'Profile updated successfully.'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error("save-profile Error:", error);
    return new Response(
      JSON.stringify({ success: false, message: error.message || 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
