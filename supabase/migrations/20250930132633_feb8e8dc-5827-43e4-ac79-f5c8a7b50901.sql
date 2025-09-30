-- Create a security definer function to get requests without exposing phone numbers
-- This function returns all request fields EXCEPT requester_phone for requests the user doesn't own
CREATE OR REPLACE FUNCTION public.get_safe_requests()
RETURNS TABLE (
  id uuid,
  blood_group blood_group,
  requester_id uuid,
  requester_name text,
  requester_phone text,
  district text,
  state text,
  location_description text,
  message text,
  status request_status,
  expires_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    r.id,
    r.blood_group,
    r.requester_id,
    r.requester_name,
    -- Only return phone number if the user owns the request OR has an approved contact request
    CASE 
      WHEN r.requester_id = auth.uid() THEN r.requester_phone
      WHEN EXISTS (
        SELECT 1 FROM contact_requests cr 
        WHERE cr.request_id = r.id 
        AND cr.donor_id = auth.uid() 
        AND cr.status = 'approved'
      ) THEN r.requester_phone
      ELSE NULL
    END as requester_phone,
    r.district,
    r.state,
    r.location_description,
    r.message,
    r.status,
    r.expires_at,
    r.created_at,
    r.updated_at
  FROM requests r
  WHERE r.status = 'open'
    AND r.expires_at > now()
    AND (
      -- Show requests in user's district with matching blood group
      (r.district = (SELECT profiles.district FROM profiles WHERE profiles.user_id = auth.uid())
       AND r.blood_group = (SELECT profiles.blood_group FROM profiles WHERE profiles.user_id = auth.uid())
       AND r.requester_id <> auth.uid())
      -- Always show user's own requests
      OR r.requester_id = auth.uid()
    )
  ORDER BY r.created_at DESC;
$$;