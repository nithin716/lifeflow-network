import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { contactRequestSchema, type ContactRequestData } from '@/lib/validations';

interface DonorContactRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  requesterId: string;
  requesterName: string;
}

export const DonorContactRequestDialog = ({
  open,
  onOpenChange,
  requestId,
  requesterId,
  requesterName
}: DonorContactRequestDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<ContactRequestData>({
    resolver: zodResolver(contactRequestSchema),
    defaultValues: {
      message: ''
    }
  });

  const onSubmit = async (data: ContactRequestData) => {
    try {
      setIsSubmitting(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to send contact requests.",
          variant: "destructive"
        });
        return;
      }

      // Create contact request where current user is the donor wanting to help
      const { error } = await supabase
        .from('contact_requests')
        .insert({
          request_id: requestId,
          donor_id: user.id,
          requester_id: requesterId,
          message: data.message
        });

      if (error) throw error;

      toast({
        title: "Contact request sent",
        description: `Your request has been sent to ${requesterName}. You'll be notified when they approve.`
      });

      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error('Error sending contact request:', error);
      toast({
        title: "Error",
        description: "Failed to send contact request. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Contact to Help</DialogTitle>
          <DialogDescription>
            Send a message to {requesterName} letting them know you'd like to help with their blood request.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Hi, I saw your blood request and I'm available to help. Please share your contact details so we can coordinate."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Sending..." : "Send Request"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
