import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import { Droplets, Plus, Clock, MapPin, Phone, User, Heart, Copy, X, MessageCircle } from "lucide-react";
import { RequestBloodDialog } from "./RequestBloodDialog";
import { DonorContactRequestDialog } from "./DonorContactRequestDialog";

interface Profile {
  id: string;
  full_name: string;
  district: string;
  blood_group: string;
}

interface BloodRequest {
  id: string;
  requester_name: string;
  requester_phone: string | null; // Can be null if contact not approved
  blood_group: string;
  district: string;
  location_description?: string;
  message?: string;
  created_at: string;
  expires_at: string;
  status: string;
  requester_id: string;
}


interface DashboardProps {
  user: any;
}

export const Dashboard = ({ user }: DashboardProps) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [myRequests, setMyRequests] = useState<BloodRequest[]>([]);
  const [contactRequestCounts, setContactRequestCounts] = useState<{[key: string]: number}>({});
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [contactRequestDialog, setContactRequestDialog] = useState<{
    open: boolean;
    requestId: string;
    requesterId: string;
    requesterName: string;
  }>({ open: false, requestId: '', requesterId: '', requesterName: '' });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchRequests();
      fetchMyRequests();
      
      // Set up real-time subscriptions
      const requestsChannel = supabase
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
            fetchMyRequests();
          }
        )
        .subscribe();

      const contactRequestsChannel = supabase
        .channel('contact-requests-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'contact_requests',
          },
          () => {
            fetchRequests();
            fetchContactRequestCounts();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(requestsChannel);
        supabase.removeChannel(contactRequestsChannel);
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
      // Use the secure RPC function that hides phone numbers unless approved
      const { data, error } = await supabase.rpc('get_safe_requests');

      if (error) throw error;
      
      // Filter out user's own requests
      const filteredRequests = (data || []).filter((req: BloodRequest) => req.requester_id !== user.id);
      setRequests(filteredRequests);
      await fetchContactRequestCounts();
    } catch (error: any) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyRequests = async () => {
    try {
      // Use the secure RPC function for consistency
      const { data, error } = await supabase.rpc('get_safe_requests');

      if (error) throw error;
      
      // Filter to only user's own requests
      const myReqs = (data || []).filter((req: BloodRequest) => req.requester_id === user.id);
      setMyRequests(myReqs);
      await fetchMyRequestContactCounts();
    } catch (error: any) {
      console.error('Error fetching my requests:', error);
    }
  };

  const fetchContactRequestCounts = async () => {
    try {
      const { data, error } = await supabase
        .from('contact_requests')
        .select('request_id, status')
        .eq('donor_id', user.id);

      if (error) throw error;
      
      const counts: {[key: string]: number} = {};
      data?.forEach(cr => {
        counts[cr.request_id] = (counts[cr.request_id] || 0) + 1;
      });
      
      setContactRequestCounts(counts);
    } catch (error: any) {
      console.error('Error fetching contact request counts:', error);
    }
  };

  const fetchMyRequestContactCounts = async () => {
    try {
      const myRequestIds = myRequests.map(req => req.id);
      if (myRequestIds.length === 0) return;

      const { data, error } = await supabase
        .from('contact_requests')
        .select('request_id, status')
        .in('request_id', myRequestIds);

      if (error) throw error;
      
      const counts: {[key: string]: number} = {};
      data?.forEach(cr => {
        counts[cr.request_id] = (counts[cr.request_id] || 0) + 1;
      });
      
      setContactRequestCounts(counts);
    } catch (error: any) {
      console.error('Error fetching my request contact counts:', error);
    }
  };

  const handleRequestContact = (requestId: string, requesterId: string, requesterName: string) => {
    setContactRequestDialog({
      open: true,
      requestId,
      requesterId,
      requesterName
    });
  };

  const handleCancelRequest = async (requestId: string) => {
    try {
      // Delete the request - claims will be deleted automatically due to CASCADE
      const { error } = await supabase
        .from('requests')
        .delete()
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: "Request Deleted",
        description: "Your blood request has been permanently deleted.",
      });
      
      fetchMyRequests();
      fetchRequests(); // Also refresh the main requests to remove from others' view
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error", 
        description: "Failed to cancel request.",
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Phone number copied to clipboard.",
    });
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
        <div className="text-muted-foreground mt-2">
          Blood Group: <Badge variant="secondary" className="bg-medical-red text-white ml-1">
            {profile.blood_group}
          </Badge> • District: {profile.district}
        </div>
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

      {/* Navigation Tabs */}
      <Tabs defaultValue="requests" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="requests" className="flex items-center gap-2">
            <Heart className="h-4 w-4" />
            Requests ({requests.length})
          </TabsTrigger>
          <TabsTrigger value="my-requests" className="flex items-center gap-2">
            <Droplets className="h-4 w-4" />
            My Requests ({myRequests.filter(req => req.status === 'open').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-4">
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
              {requests.map((request) => {
                return (
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
                        <div className="text-right">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <Clock className="h-4 w-4" />
                            {formatTimeRemaining(request.expires_at)}
                          </div>
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

                      {request.requester_phone ? (
                        <div className="space-y-3">
                          <div className="bg-success/10 border border-success/20 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-success">Contact Approved</p>
                                <p className="text-sm text-muted-foreground">Phone: {request.requester_phone}</p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyToClipboard(request.requester_phone!)}
                                className="flex items-center gap-2"
                              >
                                <Copy className="h-4 w-4" />
                                Copy
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <Button
                          onClick={() => handleRequestContact(request.id, request.requester_id, request.requester_name)}
                          className="w-full bg-gradient-primary hover:opacity-90"
                        >
                          <MessageCircle className="h-4 w-4 mr-2" />
                          Request Contact to Help
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="my-requests" className="space-y-4">
          <h3 className="text-xl font-semibold text-foreground">My Blood Requests</h3>
          
          {myRequests.filter(req => req.status === 'open').length === 0 ? (
            <Card className="border-0 shadow-soft">
              <CardContent className="text-center py-12">
                <Droplets className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg text-muted-foreground">No active requests</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Click "Request Blood" to create a new request
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {myRequests.filter(req => req.status === 'open').map((request) => {
                const contactCount = contactRequestCounts[request.id] || 0;
                
                return (
                  <Card key={request.id} className="border-0 shadow-soft">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-gradient-primary p-2 rounded-lg">
                            <Droplets className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-foreground">
                              Your Request
                            </h4>
                            <Badge variant="secondary" className="bg-medical-red text-white">
                              {request.blood_group}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <Clock className="h-4 w-4" />
                            {formatTimeRemaining(request.expires_at)}
                          </div>
                          {contactCount > 0 && (
                            <Badge variant="secondary" className="bg-success text-white">
                              {contactCount} Contact Request{contactCount !== 1 ? 's' : ''}
                            </Badge>
                          )}
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
                        onClick={() => handleCancelRequest(request.id)}
                        variant="destructive"
                        className="w-full"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel My Request
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <RequestBloodDialog
        isOpen={isRequestDialogOpen}
        onClose={() => setIsRequestDialogOpen(false)}
        user={user}
        onSuccess={() => {
          fetchMyRequests();
          fetchRequests();
        }}
      />

      <DonorContactRequestDialog
        open={contactRequestDialog.open}
        onOpenChange={(open) => setContactRequestDialog({ ...contactRequestDialog, open })}
        requestId={contactRequestDialog.requestId}
        requesterId={contactRequestDialog.requesterId}
        requesterName={contactRequestDialog.requesterName}
      />
    </div>
  );
};