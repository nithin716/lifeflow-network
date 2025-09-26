-- Allow users to delete their own requests
CREATE POLICY "Users can delete their own requests"
ON public.requests
FOR DELETE
USING (auth.uid() = requester_id);

-- Allow requesters to delete any claims on their own requests
CREATE POLICY "Requesters can delete claims for their requests"
ON public.claims
FOR DELETE
USING (
  request_id IN (
    SELECT id FROM public.requests WHERE requester_id = auth.uid()
  )
);

-- Add foreign key with cascade delete to automatically remove claims when request is deleted
ALTER TABLE public.claims
ADD CONSTRAINT claims_request_fk
FOREIGN KEY (request_id)
REFERENCES public.requests(id)
ON DELETE CASCADE;