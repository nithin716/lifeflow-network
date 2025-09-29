import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Clock, CheckCircle, XCircle, MessageCircle } from 'lucide-react';

interface ContactRequest {
  id: string;
  request_id: string;
  donor_id: string;
  requester_id: string;
  status: 'pending' | 'approved' | 'declined' | 'expired';
  message: string;
  created_at: string;
  expires_at: string;
  requests?: {
    blood_group: string;
    district: string;
    requester_name: string;
    requester_phone: string;
  };
  profiles?: {
    full_name: string;
    phone: string;
  };
}

export const ContactRequestList = () => {
  const [requests, setRequests] = useState<ContactRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchContactRequests = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch contact requests where the current user is the donor
      const { data, error } = await supabase
        .from('contact_requests')
        .select(`
          *,
          requests!inner(blood_group, district, requester_name, requester_phone),
          profiles!contact_requests_requester_id_fkey(full_name, phone)
        `)
        .eq('donor_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error('Error fetching contact requests:', error);
      toast({
        title: "Error",
        description: "Failed to load contact requests.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateRequestStatus = async (requestId: string, status: 'approved' | 'declined') => {
    try {
      const { error } = await supabase
        .from('contact_requests')
        .update({ status })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: status === 'approved' ? "Request Approved" : "Request Declined",
        description: status === 'approved' 
          ? "Your contact information will be shared with the requester."
          : "The request has been declined."
      });

      fetchContactRequests();
    } catch (error) {
      console.error('Error updating request status:', error);
      toast({
        title: "Error",
        description: "Failed to update request status.",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    fetchContactRequests();
  }, []);

  if (loading) {
    return <div className="text-center py-4">Loading contact requests...</div>;
  }

  if (requests.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No contact requests yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Contact Requests</h2>
      {requests.map((request) => (
        <Card key={request.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                Blood Request from {request.profiles?.full_name || 'Unknown'}
              </CardTitle>
              <Badge 
                variant={
                  request.status === 'pending' ? 'secondary' :
                  request.status === 'approved' ? 'default' :
                  request.status === 'declined' ? 'destructive' : 'outline'
                }
              >
                {request.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Blood Type & Location:</p>
              <p>{request.requests?.blood_group} • {request.requests?.district}</p>
            </div>
            
            <div>
              <p className="text-sm text-muted-foreground mb-2">Message:</p>
              <p className="bg-muted p-3 rounded-md">{request.message}</p>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Received {new Date(request.created_at).toLocaleDateString()}</span>
            </div>

            {request.status === 'pending' && (
              <div className="flex gap-2 pt-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => updateRequestStatus(request.id, 'approved')}
                  className="flex items-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Approve & Share Contact
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateRequestStatus(request.id, 'declined')}
                  className="flex items-center gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  Decline
                </Button>
              </div>
            )}

            {request.status === 'approved' && (
              <div className="bg-green-50 p-3 rounded-md">
                <p className="text-sm text-green-800">
                  Your contact information has been shared. The requester can now reach you at:
                  <br />
                  <strong>{request.requests?.requester_phone}</strong>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};