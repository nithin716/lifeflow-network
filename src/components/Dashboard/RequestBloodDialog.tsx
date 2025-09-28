import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Droplets } from "lucide-react";

interface RequestBloodDialogProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onSuccess?: () => void;
}

interface BloodRequestForm {
  bloodGroup: string;
  requesterName: string;
  requesterPhone: string;
  district: string;
  state: string;
  locationDescription: string;
  message: string;
}

export const RequestBloodDialog = ({ isOpen, onClose, user, onSuccess }: RequestBloodDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<BloodRequestForm>();

  const bloodGroups = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

  const onSubmit = async (data: BloodRequestForm) => {
    setIsLoading(true);
    try {
      const { data: newRequest, error } = await supabase
        .from('requests')
        .insert({
          requester_id: user.id,
          blood_group: data.bloodGroup as any,
          requester_name: data.requesterName,
          requester_phone: data.requesterPhone,
          district: data.district,
          state: data.state,
          location_description: data.locationDescription,
          message: data.message,
        })
        .select()
        .single();

      if (error) throw error;

      // Send notifications to eligible users
      try {
        const { error: notificationError } = await supabase.functions.invoke('send-blood-request-notifications', {
          body: { requestId: newRequest.id }
        });

        if (notificationError) {
          console.error('Failed to send notifications:', notificationError);
          // Don't throw error here as the request was created successfully
        }
      } catch (notificationError) {
        console.error('Notification service error:', notificationError);
        // Continue with success flow even if notifications fail
      }

      toast({
        title: "Blood Request Submitted!",
        description: "Your request has been posted and donors will be notified. The request will be active for 24 hours.",
      });

      reset();
      onClose();
      onSuccess?.();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to submit blood request",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="bg-gradient-primary p-2 rounded-lg">
              <Droplets className="h-5 w-5 text-white" />
            </div>
            Request Blood
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bloodGroup">Required Blood Group</Label>
            <Select onValueChange={(value) => setValue("bloodGroup", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select blood group needed" />
              </SelectTrigger>
              <SelectContent>
                {bloodGroups.map((group) => (
                  <SelectItem key={group} value={group}>
                    {group}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.bloodGroup && (
              <p className="text-sm text-destructive">Blood group is required</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="requesterName">Requester Name</Label>
              <Input
                id="requesterName"
                placeholder="Patient name"
                {...register("requesterName", { required: "Requester name is required" })}
              />
              {errors.requesterName && (
                <p className="text-sm text-destructive">{errors.requesterName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="requesterPhone">Contact Phone</Label>
              <Input
                id="requesterPhone"
                placeholder="+1234567890"
                {...register("requesterPhone", { required: "Phone number is required" })}
              />
              {errors.requesterPhone && (
                <p className="text-sm text-destructive">{errors.requesterPhone.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="district">District</Label>
              <Input
                id="district"
                placeholder="District"
                {...register("district", { required: "District is required" })}
              />
              {errors.district && (
                <p className="text-sm text-destructive">{errors.district.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                placeholder="State"
                {...register("state", { required: "State is required" })}
              />
              {errors.state && (
                <p className="text-sm text-destructive">{errors.state.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="locationDescription">Hospital/Location Description</Label>
            <Input
              id="locationDescription"
              placeholder="Hospital name, address or landmarks"
              {...register("locationDescription")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Additional Message (Optional)</Label>
            <Textarea
              id="message"
              placeholder="Any additional information for donors..."
              className="min-h-[80px]"
              {...register("message")}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-gradient-primary hover:opacity-90"
            >
              {isLoading ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};