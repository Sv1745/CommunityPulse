"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, MapPin, Clock, Users, Tag } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EventMap } from "@/components/EventMap";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Event {
  id: number;
  title: string;
  description: string;
  location: string;
  category: string;
  start_date: string;
  end_date: string;
  registration_start: string;
  registration_end: string;
  image_path: string | null;
  organizer_id: number;
  is_approved: boolean;
  attendees_count: number;
  is_registered: boolean;
}

interface RegistrationStatus {
  status: "none" | "interested" | "registered";
  registration: {
    id: number;
    attendees: string[];
    number_of_attendees: number;
    registered_at: string;
  } | null;
}

export default function EventDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { getToken, isSignedIn } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRegistrationDialog, setShowRegistrationDialog] = useState(false);
  const [registrationStatus, setRegistrationStatus] =
    useState<RegistrationStatus | null>(null);
  const [attendees, setAttendees] = useState<string[]>([""]);
  const [numberOfAttendees, setNumberOfAttendees] = useState(1);
  const [showUnregisterConfirm, setShowUnregisterConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const fetchEventDetails = async () => {
      try {
        const token = await getToken();
        const response = await fetch(`${API_URL}/events/${params.id}/details`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch event details");
        }

        const data = await response.json();
        console.log("Event details:", {
          registration_start: new Date(
            data.registration_start
          ).toLocaleString(),
          registration_end: new Date(data.registration_end).toLocaleString(),
          current_time: new Date().toLocaleString(),
        });
        setEvent(data);

        // Fetch user details to check if they're an admin
        const userResponse = await fetch(`${API_URL}/users/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (userResponse.ok) {
          const userData = await userResponse.json();
          setIsAdmin(userData.is_admin);
          setIsOrganizer(data.organizer_id === userData.id);
        }

        // Fetch registration status
        const statusResponse = await fetch(
          `${API_URL}/events/${params.id}/registration-status`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          setRegistrationStatus(statusData);
          if (statusData.registration) {
            setAttendees(statusData.registration.attendees);
            setNumberOfAttendees(statusData.registration.number_of_attendees);
          }
        }
      } catch (error) {
        console.error("Error fetching event details:", error);
        toast.error("Failed to load event details");
      } finally {
        setLoading(false);
      }
    };

    if (params.id && isSignedIn) {
      fetchEventDetails();
    }
  }, [params.id, getToken, isSignedIn]);

  const handleInterest = async () => {
    if (!isSignedIn) {
      toast.error("Please sign in to register for this event");
      return;
    }

    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/events/${params.id}/interest`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to mark interest");
      }

      const data = await response.json();
      setShowRegistrationDialog(true);

      // Refresh registration status
      const statusResponse = await fetch(
        `${API_URL}/events/${params.id}/registration-status`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        setRegistrationStatus(statusData);
      }

      toast.success("Interest marked successfully!");
    } catch (error) {
      console.error("Error marking interest:", error);
      toast.error("Failed to mark interest");
    }
  };

  const handleConfirmRegistration = async () => {
    if (!isSignedIn) {
      toast.error("Please sign in to register for this event");
      return;
    }

    // Filter out empty attendee names
    const filteredAttendees = attendees.filter((name) => name.trim() !== "");

    // Validate attendees
    if (filteredAttendees.length === 0) {
      toast.error("Please add at least one attendee");
      return;
    }

    if (filteredAttendees.length > 10) {
      toast.error("Maximum 10 attendees allowed per registration");
      return;
    }

    try {
      const token = await getToken();
      const response = await fetch(
        `${API_URL}/events/${params.id}/confirm-registration`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            attendees: filteredAttendees,
            number_of_attendees: filteredAttendees.length,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to confirm registration");
      }

      setShowRegistrationDialog(false);

      // Refresh registration status
      const statusResponse = await fetch(
        `${API_URL}/events/${params.id}/registration-status`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        setRegistrationStatus(statusData);
      }

      toast.success("Successfully registered for event!");
    } catch (error) {
      console.error("Error confirming registration:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to confirm registration"
      );
    }
  };

  const handleUnregister = async () => {
    try {
      const token = await getToken();
      const response = await fetch(
        `${API_URL}/events/${params.id}/cancel-registration`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to cancel registration");
      }

      // Refresh registration status
      const statusResponse = await fetch(
        `${API_URL}/events/${params.id}/registration-status`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        setRegistrationStatus(statusData);
      }

      setShowUnregisterConfirm(false);
      toast.success("Successfully unregistered from event");
    } catch (error) {
      console.error("Error unregistering:", error);
      toast.error("Failed to unregister from event");
    }
  };

  const handleDeleteEvent = async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/events/${params.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete event");
      }

      toast.success("Event deleted successfully");
      router.push("/");
    } catch (error) {
      console.error("Error deleting event:", error);
      toast.error("Failed to delete event");
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!event) {
    return <div>Event not found</div>;
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleAttendeesChange = (index: number, value: string) => {
    const newAttendees = [...attendees];
    newAttendees[index] = value;
    setAttendees(newAttendees);
  };

  const addAttendee = () => {
    if (attendees.length >= 10) {
      toast.error("Maximum 10 attendees allowed per registration");
      return;
    }
    setAttendees([...attendees, ""]);
    setNumberOfAttendees(numberOfAttendees + 1);
  };

  const removeAttendee = (index: number) => {
    if (attendees.length <= 1) {
      toast.error("At least one attendee is required");
      return;
    }
    const newAttendees = attendees.filter((_, i) => i !== index);
    setAttendees(newAttendees);
    setNumberOfAttendees(numberOfAttendees - 1);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Button variant="ghost" className="mb-4" onClick={() => router.back()}>
        ← Back
      </Button>

      <Card className="max-w-4xl mx-auto">
        {event.image_path && (
          <div className="w-full h-64 overflow-hidden">
            <img
              src={`${API_URL}/${event.image_path}`}
              alt={event.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-3xl font-bold">
                {event.title}
              </CardTitle>
              <div className="mt-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary/10 text-primary">
                  <Tag className="w-4 h-4 mr-1" />
                  {event.category}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold">
                {event.attendees_count}
                <span className="text-base font-normal text-muted-foreground ml-2">
                  attendees
                </span>
              </div>
              {(isOrganizer || isAdmin) && (
                <div className="mt-4 space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/events/${params.id}/edit`)}
                  >
                    Edit Event
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    Delete Event
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">Date</div>
                  <div>{formatDate(event.start_date)}</div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">Time</div>
                  <div>
                    {formatTime(event.start_date)} -{" "}
                    {formatTime(event.end_date)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="w-5 h-5" />
                <span>{event.location}</span>
              </div>
              <EventMap location={event.location} className="mt-4" />
            </div>

            <div className="space-y-4">
              <div>
                <div className="font-medium">Registration Period</div>
                <div>
                  {formatDate(event.registration_start)} -{" "}
                  {formatDate(event.registration_end)}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2">About this event</h3>
            <p className="text-muted-foreground whitespace-pre-wrap">
              {event.description}
            </p>
          </div>

          <div className="mt-8">
            {registrationStatus?.status === "registered" ? (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <h3 className="text-lg font-semibold mb-2">
                    Your Registration Details
                  </h3>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Number of Attendees:{" "}
                      {registrationStatus.registration?.number_of_attendees}
                    </p>
                    <div>
                      <p className="text-sm font-medium mb-1">
                        Registered Attendees:
                      </p>
                      <ul className="list-disc list-inside text-sm text-muted-foreground">
                        {registrationStatus.registration?.attendees.map(
                          (name, index) => (
                            <li key={index}>{name}</li>
                          )
                        )}
                      </ul>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Registered on:{" "}
                      {new Date(
                        registrationStatus.registration?.registered_at || ""
                      ).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => setShowUnregisterConfirm(true)}
                  variant="destructive"
                  className="w-full md:w-auto"
                >
                  Unregister from Event
                </Button>
              </div>
            ) : registrationStatus?.status === "interested" ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  You have shown interest in this event. Please complete your
                  registration by providing attendee details.
                </p>
                <Button
                  onClick={() => setShowRegistrationDialog(true)}
                  className="w-full md:w-auto"
                >
                  Complete Registration
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleInterest}
                className="w-full md:w-auto"
                size="lg"
              >
                I'm Interested
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={showRegistrationDialog}
        onOpenChange={setShowRegistrationDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Registration</DialogTitle>
            <DialogDescription>
              Please provide the names of all attendees. You can add up to 10
              attendees.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {attendees.map((attendee, index) => (
              <div key={index} className="flex gap-2 items-center">
                <div className="flex-1">
                  <Label htmlFor={`attendee-${index}`}>
                    Attendee {index + 1} Name
                  </Label>
                  <Input
                    id={`attendee-${index}`}
                    value={attendee}
                    onChange={(e) =>
                      handleAttendeesChange(index, e.target.value)
                    }
                    placeholder="Enter attendee name"
                    required
                  />
                </div>
                {index > 0 && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="mt-6"
                    onClick={() => removeAttendee(index)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
            {attendees.length < 10 && (
              <Button type="button" variant="outline" onClick={addAttendee}>
                Add Another Attendee
              </Button>
            )}
          </div>
          <div className="flex justify-end gap-4">
            <Button
              variant="outline"
              onClick={() => setShowRegistrationDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmRegistration}>
              Confirm Registration
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showUnregisterConfirm}
        onOpenChange={setShowUnregisterConfirm}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Unregistration</DialogTitle>
            <DialogDescription>
              Are you sure you want to unregister from this event? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-4 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowUnregisterConfirm(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleUnregister}>
              Unregister
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this event? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-4 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteEvent}>
              Delete Event
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
