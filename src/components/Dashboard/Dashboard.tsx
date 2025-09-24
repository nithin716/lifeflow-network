import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Droplets, Plus, Clock, MapPin, Phone, User, Heart } from "lucide-react";
import { RequestBloodDialog } from "./RequestBloodDialog";

interface Profile {
  id: string;
  full_name: string;
  district: string;
  blood_group: string;
}

interface BloodRequest {
  id: string;
  requester_name: string;
  requester_phone: string;
  blood_group: string;
  district: string;
  location_description?: string;
  message?: string;
  created_at: string;
  expires_at: string;
  status: string;
}

interface DashboardProps {
  user: any;
}

export const Dashboard = ({ user }: DashboardProps) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [myRequests, setMyRequests] = useState<BloodRequest[]>([]);
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchRequests();
      fetchMyRequests();
      
      // Set up real-time subscription for requests
      const channel = supabase
        .channel('requests-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'requests',
          },
          () => {
            fetchRequests();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load profile",
      });
    }
  };

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('requests')
        .select('*')
        .eq('status', 'open')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error: any) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('requests')
        .select('*')
        .eq('requester_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMyRequests(data || []);
    } catch (error: any) {
      console.error('Error fetching my requests:', error);
    }
  };

  const handleClaimRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('claims')
        .insert({
          request_id: requestId,
          donor_id: user.id,
        });

      if (error) throw error;

      toast({
        title: "Request Claimed!",
        description: "You've successfully claimed this blood request. The requester will be notified.",
      });
      
      fetchRequests();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to claim request. You may have already claimed this request.",
      });
    }
  };

  const formatTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const hoursRemaining = Math.floor((expires.getTime() - now.getTime()) / (1000 * 60 * 60));
    
    if (hoursRemaining < 1) {
      const minutesRemaining = Math.floor((expires.getTime() - now.getTime()) / (1000 * 60));
      return `${minutesRemaining}m left`;
    }
    return `${hoursRemaining}h left`;
  };

  if (loading || !profile) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-2">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-foreground">
          Welcome, {profile.full_name}
        </h2>
        <p className="text-muted-foreground mt-2">
          Blood Group: <Badge variant="secondary" className="bg-medical-red text-white ml-1">
            {profile.blood_group}
          </Badge> • District: {profile.district}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex justify-center">
        <Button
          onClick={() => setIsRequestDialogOpen(true)}
          size="lg"
          className="bg-gradient-primary hover:opacity-90 text-lg px-8 py-6 rounded-xl shadow-medium"
        >
          <Plus className="h-6 w-6 mr-3" />
          Request Blood
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-0 shadow-soft bg-gradient-accent">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Heart className="h-5 w-5 text-medical-red" />
              Available Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{requests.length}</p>
            <p className="text-sm text-muted-foreground">Matching your area & blood group</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Droplets className="h-5 w-5 text-medical-red" />
              My Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{myRequests.length}</p>
            <p className="text-sm text-muted-foreground">Total requests made</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-medical-red" />
              Active Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-success">Active</p>
            <p className="text-sm text-muted-foreground">Ready to help</p>
          </CardContent>
        </Card>
      </div>

      {/* Blood Requests Feed */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-foreground">Blood Requests in Your Area</h3>
        
        {requests.length === 0 ? (
          <Card className="border-0 shadow-soft">
            <CardContent className="text-center py-12">
              <Droplets className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg text-muted-foreground">No blood requests available</p>
              <p className="text-sm text-muted-foreground mt-1">
                Check back later or help others by spreading the word
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {requests.map((request) => (
              <Card key={request.id} className="border-0 shadow-soft hover:shadow-medium transition-shadow">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-medical-red p-2 rounded-lg">
                        <Droplets className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-foreground">
                          {request.requester_name}
                        </h4>
                        <Badge variant="secondary" className="bg-medical-red text-white">
                          {request.blood_group}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {formatTimeRemaining(request.expires_at)}
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {request.district} • {request.location_description}
                    </div>
                    {request.message && (
                      <p className="text-sm text-foreground bg-soft-gray p-3 rounded-lg">
                        "{request.message}"
                      </p>
                    )}
                  </div>

                  <Button
                    onClick={() => handleClaimRequest(request.id)}
                    className="w-full bg-gradient-primary hover:opacity-90"
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Claim & Contact
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <RequestBloodDialog
        isOpen={isRequestDialogOpen}
        onClose={() => setIsRequestDialogOpen(false)}
        user={user}
        onSuccess={fetchMyRequests}
      />
    </div>
  );
};