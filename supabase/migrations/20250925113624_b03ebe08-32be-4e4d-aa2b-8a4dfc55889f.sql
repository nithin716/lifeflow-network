-- Add is_confirmed field to profiles table
ALTER TABLE public.profiles ADD COLUMN is_confirmed boolean DEFAULT false;

-- Update requests table to include status field if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests' AND column_name = 'status') THEN
        ALTER TABLE public.requests ADD COLUMN status request_status DEFAULT 'open';
    END IF;
END $$;

-- Ensure claims table has proper structure
DROP TABLE IF EXISTS public.claims;
CREATE TABLE public.claims (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
    donor_id UUID NOT NULL,
    claimed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on claims table
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

-- RLS policies for claims table
CREATE POLICY "Users can create claims for open requests" ON public.claims
    FOR INSERT WITH CHECK (auth.uid() = donor_id);

CREATE POLICY "Users can view claims for requests they can see" ON public.claims
    FOR SELECT USING (
        request_id IN (
            SELECT id FROM public.requests 
            WHERE (district = (SELECT district FROM public.profiles WHERE user_id = auth.uid()) 
                  AND blood_group = (SELECT blood_group FROM public.profiles WHERE user_id = auth.uid()))
               OR requester_id = auth.uid()
        )
    );

-- Update requests RLS policy to exclude user's own requests from general feed
DROP POLICY IF EXISTS "Users can view requests in their district with matching blood g" ON public.requests;
CREATE POLICY "Users can view requests in their district with matching blood group" ON public.requests
    FOR SELECT USING (
        status = 'open' AND expires_at > now() AND
        (
            (district = (SELECT district FROM public.profiles WHERE user_id = auth.uid()) 
             AND blood_group = (SELECT blood_group FROM public.profiles WHERE user_id = auth.uid())
             AND requester_id != auth.uid()) -- Exclude user's own requests from general feed
            OR requester_id = auth.uid() -- But allow users to see their own requests
        )
    );

-- Function to update user confirmation status
CREATE OR REPLACE FUNCTION public.confirm_user_email(user_email text)
RETURNS void AS $$
BEGIN
    UPDATE public.profiles 
    SET is_confirmed = true 
    WHERE user_id = (
        SELECT id FROM auth.users WHERE email = user_email
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;