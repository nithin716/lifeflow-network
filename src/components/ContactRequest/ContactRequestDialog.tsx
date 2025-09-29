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

interface ContactRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  donorId: string;
  donorName: string;
}

export const ContactRequestDialog = ({
  open,
  onOpenChange,
  requestId,
  donorId,
  donorName
}: ContactRequestDialogProps) => {
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

      const { error } = await supabase
        .from('contact_requests')
        .insert({
          request_id: requestId,
          donor_id: donorId,
          requester_id: user.id,
          message: data.message
        });

      if (error) throw error;

      toast({
        title: "Contact request sent",
        description: `Your request has been sent to ${donorName}. They will be notified and can choose to share their contact information.`
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
          <DialogTitle>Request Contact Information</DialogTitle>
          <DialogDescription>
            Send a message to {donorName} requesting to share contact information for this blood request.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Hi, I saw your profile and would like to request your contact information for this blood donation request. Please let me know if you're available to help."
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