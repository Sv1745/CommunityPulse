"use client";

import { useState, useEffect } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, X, User, Calendar, MapPin, Tag } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ADMIN_EMAIL = "rohithvishwanath1789@gmail.com";

export default function AdminDashboard() {
  const [pendingEvents, setPendingEvents] = useState<any[]>([]);
  const [approvedEvents, setApprovedEvents] = useState<any[]>([]);
  const [pendingOrganizers, setPendingOrganizers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("pending-events");

  // Check if user is admin
  useEffect(() => {
    const checkAdminAccess = async () => {
      if (isLoaded && isSignedIn && user) {
        // Check if the user is the designated admin
        if (user.primaryEmailAddress?.emailAddress !== ADMIN_EMAIL) {
          toast.error("Access Denied", {
            description:
              "You don't have permission to access the admin dashboard.",
          });
          router.push("/");
        }
      } else if (isLoaded && !isSignedIn) {
        router.push("/");
      }
    };

    checkAdminAccess();
  }, [isLoaded, isSignedIn, user, router]);

  // Fetch pending events
  useEffect(() => {
    const fetchPendingEvents = async () => {
      if (!isLoaded || !isSignedIn) return;

      try {
        setLoading(true);
        const token = await getToken();

        const response = await axios.get(`${API_URL}/admin/events/pending`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const formattedEvents = response.data.map((event: any) => ({
          id: event.id,
          title: event.title,
          date: new Date(event.start_date).toLocaleDateString(),
          startTime: new Date(event.start_date).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          endTime: new Date(event.end_date).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          location: event.location,
          description: event.description,
          category: event.category,
          organizer_id: event.organizer_id,
          image_path: event.image_path,
          created_at: new Date(event.created_at).toLocaleDateString(),
        }));

        setPendingEvents(formattedEvents);

        // Also fetch approved events
        const approvedResponse = await axios.get(
          `${API_URL}/events?approved_only=true`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const formattedApprovedEvents = approvedResponse.data.map(
          (event: any) => ({
            id: event.id,
            title: event.title,
            date: new Date(event.start_date).toLocaleDateString(),
            startTime: new Date(event.start_date).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            endTime: new Date(event.end_date).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            location: event.location,
            description: event.description,
            category: event.category,
            organizer_id: event.organizer_id,
            image_path: event.image_path,
            created_at: new Date(event.created_at).toLocaleDateString(),
          })
        );

        setApprovedEvents(formattedApprovedEvents);

        // Fetch users who aren't verified organizers
        const usersResponse = await axios.get(`${API_URL}/admin/users`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const pendingOrganizersList = usersResponse.data.filter(
          (user: any) => !user.is_verified_organizer && !user.is_admin
        );

        setPendingOrganizers(pendingOrganizersList);
      } catch (err: any) {
        console.error("Error fetching admin data:", err);
        setError(err.message || "Failed to load admin data");
      } finally {
        setLoading(false);
      }
    };

    fetchPendingEvents();
  }, [isLoaded, isSignedIn, getToken]);

  // Approve event
  const approveEvent = async (eventId: number) => {
    try {
      setLoading(true);
      const token = await getToken();

      await axios.put(
        `${API_URL}/admin/events/${eventId}/approve`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Update local state
      const approvedEvent = pendingEvents.find((event) => event.id === eventId);
      if (approvedEvent) {
        setPendingEvents(pendingEvents.filter((event) => event.id !== eventId));
        setApprovedEvents([...approvedEvents, approvedEvent]);
      }

      toast.success("Event Approved", {
        description: "The event has been approved successfully.",
      });
    } catch (err: any) {
      console.error("Error approving event:", err);
      toast.error("Error", {
        description: "Failed to approve event. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Reject event
  const rejectEvent = async (eventId: number) => {
    try {
      setLoading(true);
      const token = await getToken();

      await axios.put(
        `${API_URL}/admin/events/${eventId}/reject`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Update local state
      setPendingEvents(pendingEvents.filter((event) => event.id !== eventId));

      toast.info("Event Rejected", {
        description: "The event has been rejected and removed.",
      });
    } catch (err: any) {
      console.error("Error rejecting event:", err);
      toast.error("Error", {
        description: "Failed to reject event. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Verify organizer
  const verifyOrganizer = async (userId: number) => {
    try {
      setLoading(true);
      const token = await getToken();

      await axios.put(
        `${API_URL}/admin/users/${userId}/verify-organizer`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Update local state
      setPendingOrganizers(
        pendingOrganizers.filter((user) => user.id !== userId)
      );

      toast.success("Organizer Verified", {
        description: "The user has been verified as an organizer.",
      });
    } catch (err: any) {
      console.error("Error verifying organizer:", err);
      toast.error("Error", {
        description: "Failed to verify organizer. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded || (isLoaded && !isSignedIn)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Skeleton className="h-12 w-64 mb-4" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>
      </div>
    );
  }

  if (user?.primaryEmailAddress?.emailAddress !== ADMIN_EMAIL) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">
            You don't have permission to access this page.
          </p>
          <Button onClick={() => router.push("/")}>Return to Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Button
              variant="ghost"
              onClick={() => router.push("/")}
              className="flex items-center text-blue-600 hover:text-blue-800 transition-colors mb-2"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Events
            </Button>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-gray-600">
              Manage events, organizers, and users
            </p>
          </div>
          <div className="text-right">
            <p className="font-medium">Logged in as:</p>
            <p className="text-blue-600">{ADMIN_EMAIL}</p>
          </div>
        </div>

        <Tabs
          defaultValue="pending-events"
          value={activeTab}
          onValueChange={setActiveTab}
        >
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger
              value="pending-events"
              className="text-sm md:text-base"
            >
              Pending Events{" "}
              {pendingEvents.length > 0 && `(${pendingEvents.length})`}
            </TabsTrigger>
            <TabsTrigger
              value="approved-events"
              className="text-sm md:text-base"
            >
              Approved Events
            </TabsTrigger>
            <TabsTrigger
              value="pending-organizers"
              className="text-sm md:text-base"
            >
              Pending Organizers{" "}
              {pendingOrganizers.length > 0 && `(${pendingOrganizers.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending-events">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4">
                Events Pending Approval
              </h2>

              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="border rounded-lg p-4">
                      <Skeleton className="h-6 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2 mb-2" />
                      <Skeleton className="h-4 w-full mb-2" />
                      <div className="flex justify-end gap-2 mt-4">
                        <Skeleton className="h-9 w-20" />
                        <Skeleton className="h-9 w-20" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : pendingEvents.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <p className="text-gray-500">No pending events to approve</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {pendingEvents.map((event) => (
                    <Card key={event.id} className="overflow-hidden">
                      {event.image_path && (
                        <div className="h-48 overflow-hidden">
                          <img
                            src={`${API_URL}/${event.image_path}`}
                            alt={event.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "https://via.placeholder.com/400x200?text=Event+Image";
                            }}
                          />
                        </div>
                      )}
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle>{event.title}</CardTitle>
                            <CardDescription>
                              <Badge className="mt-1">{event.category}</Badge>
                            </CardDescription>
                          </div>
                          <div className="text-right text-sm text-gray-500">
                            Submitted: {event.created_at}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-start gap-2">
                          <Calendar className="h-4 w-4 text-gray-500 mt-0.5" />
                          <span>
                            {event.date} • {event.startTime} - {event.endTime}
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-gray-500 mt-0.5" />
                          <span>{event.location}</span>
                        </div>
                        <p className="text-gray-700 line-clamp-3">
                          {event.description}
                        </p>
                      </CardContent>
                      <CardFooter className="flex justify-between">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => rejectEvent(event.id)}
                          disabled={loading}
                        >
                          <X className="h-4 w-4 mr-1" /> Reject
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => approveEvent(event.id)}
                          disabled={loading}
                        >
                          <Check className="h-4 w-4 mr-1" /> Approve
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="approved-events">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4">Approved Events</h2>

              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="border rounded-lg p-4">
                      <Skeleton className="h-6 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2 mb-2" />
                      <Skeleton className="h-4 w-full mb-2" />
                    </div>
                  ))}
                </div>
              ) : approvedEvents.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <p className="text-gray-500">No approved events yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {approvedEvents.map((event) => (
                    <Card key={event.id} className="overflow-hidden">
                      {event.image_path && (
                        <div className="h-32 overflow-hidden">
                          <img
                            src={`${API_URL}/${event.image_path}`}
                            alt={event.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "https://via.placeholder.com/400x200?text=Event+Image";
                            }}
                          />
                        </div>
                      )}
                      <CardHeader className="py-3">
                        <CardTitle className="text-base">
                          {event.title}
                        </CardTitle>
                        <CardDescription>
                          <Badge variant="outline" className="mt-1">
                            {event.category}
                          </Badge>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="py-2 space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3 text-gray-500" />
                          <span>{event.date}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3 w-3 text-gray-500" />
                          <span>{event.location}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="pending-organizers">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4">
                Pending Organizer Verifications
              </h2>

              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="border rounded-lg p-4">
                      <Skeleton className="h-6 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2 mb-2" />
                      <div className="flex justify-end gap-2 mt-4">
                        <Skeleton className="h-9 w-28" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : pendingOrganizers.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <p className="text-gray-500">
                    No pending organizer verifications
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingOrganizers.map((user) => (
                    <Card key={user.id}>
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className="bg-blue-100 p-2 rounded-full">
                            <User className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">
                              {user.username}
                            </CardTitle>
                            <CardDescription>{user.email}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-gray-600">
                          User ID: {user.id}
                        </p>
                        <p className="text-sm text-gray-600">
                          Joined:{" "}
                          {new Date(user.created_at).toLocaleDateString()}
                        </p>
                      </CardContent>
                      <CardFooter className="flex justify-end">
                        <Button
                          onClick={() => verifyOrganizer(user.id)}
                          disabled={loading}
                        >
                          <Check className="h-4 w-4 mr-1" /> Verify as Organizer
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
