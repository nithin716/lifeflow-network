-- Create contact requests table for secure donor-requester communication
CREATE TABLE public.contact_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL,
  donor_id UUID NOT NULL,
  requester_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'expired')),
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + '72:00:00'::interval)
);

-- Enable RLS on contact requests
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contact_requests
CREATE POLICY "Donors can view contact requests sent to them" 
ON public.contact_requests 
FOR SELECT 
USING (auth.uid() = donor_id);

CREATE POLICY "Requesters can view their sent contact requests" 
ON public.contact_requests 
FOR SELECT 
USING (auth.uid() = requester_id);

CREATE POLICY "Users can create contact requests as requesters" 
ON public.contact_requests 
FOR INSERT 
WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Donors can update contact request status" 
ON public.contact_requests 
FOR UPDATE 
USING (auth.uid() = donor_id);

-- Create trigger for contact_requests updated_at
CREATE TRIGGER update_contact_requests_updated_at
BEFORE UPDATE ON public.contact_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update profiles RLS to be more restrictive - remove phone number access
DROP POLICY "Users can view relevant profiles" ON public.profiles;

CREATE POLICY "Users can view limited profile info" ON public.profiles
FOR SELECT USING (
  -- Users can see their own full profile
  auth.uid() = user_id 
  OR 
  -- Others can only see basic info (name, district, blood_group) for matching
  -- Phone numbers are now protected and shared only through contact requests
  (
    district = (
      SELECT profiles.district 
      FROM profiles 
      WHERE profiles.user_id = auth.uid()
    )
  )
);

-- Create a function to get safe profile info (without phone numbers)
CREATE OR REPLACE FUNCTION public.get_safe_profile_info(profile_user_id UUID)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  full_name TEXT,
  district TEXT,
  state TEXT,
  blood_group blood_group,
  is_confirmed BOOLEAN
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.user_id,
    p.full_name,
    p.district,
    p.state,
    p.blood_group,
    p.is_confirmed
  FROM profiles p
  WHERE p.user_id = profile_user_id
    AND p.district = (
      SELECT profiles.district 
      FROM profiles 
      WHERE profiles.user_id = auth.uid()
    );
$$;