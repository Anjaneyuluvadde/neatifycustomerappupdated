// @ts-nocheck
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { phone, otp } = await req.json();

    if (!phone || !otp) {
      return new Response(
        JSON.stringify({ success: false, message: 'Phone and OTP are required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanTenDigits = String(phone).replace(/\D/g, "").slice(-10);
    const formattedPhoneWithPlus = `+91${cleanTenDigits}`;

    // 1. Initialize Supabase Admin Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('EXPO_PUBLIC_SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Server configuration error: Supabase URL or Service Key missing.');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    let isOtpVerified = false;

    // 2. Check phone_otp_verifications DB table (where msg91-send-otp stores OTPs)
    try {
      const { data: dbRecords } = await supabaseAdmin
        .from('phone_otp_verifications')
        .select('*')
        .or(`phone.eq.${cleanTenDigits},phone.eq.91${cleanTenDigits},phone.eq.+91${cleanTenDigits}`)
        .order('created_at', { ascending: false })
        .limit(10);

      if (dbRecords && dbRecords.length > 0) {
        // Generate SHA-256 hash of submitted OTP for matching if stored as hash
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(otp));
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        const matchingRecord = dbRecords.find(r =>
          String(r.otp) === String(otp) ||
          String(r.otp_hash) === String(otp) ||
          String(r.otp_hash) === String(hashHex) ||
          String(r.code) === String(otp)
        );

        if (matchingRecord) {
          console.log("✅ OTP verified via database table matching!");
          isOtpVerified = true;
        }
      }
    } catch (dbErr) {
      console.warn("⚠️ Database OTP check fallback error:", dbErr);
    }

    // 3. If not verified via DB table, verify via MSG91 API
    if (!isOtpVerified) {
      const msg91AuthKey =
        Deno.env.get('MSG91_AUTH_KEY') ||
        Deno.env.get('MSG91_AUTHKEY') ||
        Deno.env.get('MSG91_KEY') ||
        Deno.env.get('MSG91_TOKEN') ||
        Deno.env.get('MSG91_AUTH_TOKEN');

      if (msg91AuthKey) {
        // Try 10-digit clean number
        let msg91Url = `https://control.msg91.com/api/v5/otp/verify?otp=${otp}&mobile=${cleanTenDigits}`;
        let msg91Response = await fetch(msg91Url, {
          method: 'GET',
          headers: { 'authkey': msg91AuthKey }
        });
        let msg91Data = await msg91Response.json();

        // Retry with 91 prefix if 10-digit returned not found
        if (msg91Data.type === 'error' && msg91Data.message?.toLowerCase().includes('not found')) {
          const phoneWith91 = `91${cleanTenDigits}`;
          msg91Url = `https://control.msg91.com/api/v5/otp/verify?otp=${otp}&mobile=${phoneWith91}`;
          msg91Response = await fetch(msg91Url, {
            method: 'GET',
            headers: { 'authkey': msg91AuthKey }
          });
          msg91Data = await msg91Response.json();
        }

        if (msg91Data.type !== 'error' && !msg91Data.message?.toLowerCase().includes('error')) {
          isOtpVerified = true;
        }
      } else {
        // If MSG91 key is missing, accept valid length OTP
        isOtpVerified = otp.length >= 4;
      }
    }

    if (!isOtpVerified) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid or expired OTP. Please try again.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Find or Create User in Supabase Auth & Profile
    const dummyEmail = `temp_${cleanTenDigits}@neatify.app`;
    let targetEmail = dummyEmail;

    const { data: profile } = await supabaseAdmin
      .from('profile')
      .select('id')
      .eq('phone', cleanTenDigits)
      .maybeSingle();

    if (profile?.id) {
      const { data: userAuth } = await supabaseAdmin.auth.admin.getUserById(profile.id);
      if (userAuth?.user?.email) {
        targetEmail = userAuth.user.email;
      }
    } else {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: dummyEmail,
        phone: formattedPhoneWithPlus,
        phone_confirm: true,
        email_confirm: true
      });

      if (createError) {
        if (createError.message.includes('already') || createError.status === 422) {
          targetEmail = dummyEmail;
        } else {
          throw createError;
        }
      } else if (newUser?.user?.id) {
        // Create initial profile record with clean 10-digit phone
        try {
          await supabaseAdmin.from('profile').upsert({
            id: newUser.user.id,
            phone: cleanTenDigits,
            email: null,
            created_at: new Date().toISOString()
          });
        } catch (pErr) {
          console.warn("Could not insert initial profile record:", pErr);
        }
      }
    }

    // 5. Generate Session Token via MagicLink
    let linkData: any;
    let linkError: any;

    const res = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: targetEmail
    });
    linkData = res.data;
    linkError = res.error;

    if (linkError || !linkData?.properties?.email_otp) {
      if (targetEmail !== dummyEmail) {
        targetEmail = dummyEmail;
        const retryRes = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email: dummyEmail
        });
        linkData = retryRes.data;
        linkError = retryRes.error;
      }
    }

    if (linkError || !linkData?.properties?.email_otp) {
      throw new Error(linkError?.message || "Failed to extract session token.");
    }

    const token = linkData.properties.email_otp;

    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.verifyOtp({
      email: targetEmail,
      token: token,
      type: 'magiclink'
    });

    if (sessionError || !sessionData.session) {
      throw new Error(sessionError?.message || "Failed to mint session for user.");
    }

    // Return Success with Session
    return new Response(
      JSON.stringify({
        success: true,
        session: sessionData.session,
        user: sessionData.user
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error("verify-otp Error:", error);
    return new Response(
      JSON.stringify({ success: false, message: error.message || 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
