-- Add foreign key constraints to contact_requests table
ALTER TABLE public.contact_requests 
ADD CONSTRAINT contact_requests_request_id_fkey 
FOREIGN KEY (request_id) REFERENCES public.requests(id) ON DELETE CASCADE;

ALTER TABLE public.contact_requests 
ADD CONSTRAINT contact_requests_donor_id_fkey 
FOREIGN KEY (donor_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.contact_requests 
ADD CONSTRAINT contact_requests_requester_id_fkey 
FOREIGN KEY (requester_id) REFERENCES auth.users(id) ON DELETE CASCADE;