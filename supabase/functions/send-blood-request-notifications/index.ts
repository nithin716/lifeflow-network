import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BloodRequest {
  id: string;
  blood_group: string;
  district: string;
  state: string;
  requester_name: string;
  location_description?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { requestId } = await req.json();
    
    if (!requestId) {
      throw new Error('Request ID is required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Processing notifications for request: ${requestId}`);

    // Get the blood request details
    const { data: request, error: requestError } = await supabase
      .from('requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (requestError || !request) {
      throw new Error(`Failed to fetch request: ${requestError?.message}`);
    }

    console.log(`Blood request details:`, request);

    // Get eligible users (same logic as the requests tab)
    // Users who can see the request: same district, same blood group, not the requester
    const { data: eligibleUsers, error: usersError } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .eq('district', request.district)
      .eq('blood_group', request.blood_group)
      .neq('user_id', request.requester_id);

    if (usersError) {
      throw new Error(`Failed to fetch eligible users: ${usersError.message}`);
    }

    console.log(`Found ${eligibleUsers?.length || 0} eligible users`);

    if (!eligibleUsers || eligibleUsers.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No eligible users found for notifications' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get device tokens for eligible users
    const userIds = eligibleUsers.map(user => user.user_id);
    const { data: userTokens, error: tokensError } = await supabase
      .from('user_tokens')
      .select('token, user_id')
      .in('user_id', userIds)
      .eq('platform', 'android');

    if (tokensError) {
      throw new Error(`Failed to fetch user tokens: ${tokensError.message}`);
    }

    console.log(`Found ${userTokens?.length || 0} device tokens`);

    if (!userTokens || userTokens.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No device tokens found for eligible users' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Firebase service account
    const serviceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON');
    if (!serviceAccountJson) {
      throw new Error('Firebase service account not configured');
    }

    const serviceAccount = JSON.parse(serviceAccountJson);

    // Get Firebase access token
    const accessToken = await getFirebaseAccessToken(serviceAccount);

    // Send notifications to each device
    const notificationResults = [];
    const notificationPayload = {
      title: "🩸 New Blood Request",
      body: `${request.blood_group} blood needed in ${request.district}. Help save a life!`
    };

    for (const userToken of userTokens) {
      try {
        const result = await sendFirebaseNotification(
          accessToken,
          userToken.token,
          notificationPayload,
          {
            requestId: request.id,
            action: "VIEW_REQUEST"
          }
        );
        
        notificationResults.push({
          userId: userToken.user_id,
          token: userToken.token,
          success: true,
          result
        });

        console.log(`Notification sent successfully to user ${userToken.user_id}`);
      } catch (error) {
        console.error(`Failed to send notification to user ${userToken.user_id}:`, error);
        notificationResults.push({
          userId: userToken.user_id,
          token: userToken.token,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const successCount = notificationResults.filter(r => r.success).length;
    console.log(`Sent ${successCount}/${notificationResults.length} notifications successfully`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sent ${successCount} notifications`,
        results: notificationResults
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-blood-request-notifications:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function getFirebaseAccessToken(serviceAccount: any): Promise<string> {
  // Create JWT for Firebase
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };

  // Create JWT header and payload
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const headerB64 = btoa(JSON.stringify(header));
  const payloadB64 = btoa(JSON.stringify(payload));
  
  // Import private key
  const keyData = serviceAccount.private_key.replace(/\\n/g, '\n');
  const key = await crypto.subtle.importKey(
    'pkcs8',
    new TextEncoder().encode(keyData),
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    false,
    ['sign']
  );

  // Sign the JWT
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  const jwt = `${headerB64}.${payloadB64}.${signatureB64}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  if (!tokenResponse.ok) {
    throw new Error(`Failed to get access token: ${tokenResponse.statusText}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

async function sendFirebaseNotification(
  accessToken: string, 
  deviceToken: string, 
  notification: { title: string; body: string }, 
  data: Record<string, string>
) {
  const projectId = 'blood-donation-604b0';
  
  const payload = {
    message: {
      token: deviceToken,
      notification: {
        title: notification.title,
        body: notification.body
      },
      data: data,
      android: {
        notification: {
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
          channel_id: 'blood_requests',
          priority: 'high'
        }
      }
    }
  };

  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Firebase notification failed: ${response.status} - ${errorData}`);
  }

  return await response.json();
}