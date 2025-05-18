"use client";

import { EventCardsGrid } from "@/components/cards";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { useState, useEffect } from "react";
import {
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
  useAuth,
} from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { PlusCircle, Calendar, Users, MapPin } from "lucide-react";
import Link from "next/link";
import axios from "axios";

// API base URL
const API_URL = "http://localhost:8000";

export default function EventsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState<string | null>(null);
  const { getToken, isLoaded, isSignedIn } = useAuth();

  // Fetch events from the backend
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);

        // Build query parameters
        const params = new URLSearchParams();
        if (category) params.append("category", category);
        params.append("upcoming", "true");
        params.append("approved_only", "true");

        // Make the API request
        const response = await axios.get(
          `${API_URL}/events?${params.toString()}`
        );

        // Format the events data to match the expected format
        interface EventData {
          id: number;
          title: string;
          start_date: string;
          end_date: string;
          location: string;
          description: string;
          category: string;
          registrations?: any[];
          image_path: string;
          is_approved: boolean;
        }

        interface FormattedEvent {
          id: number;
          title: string;
          date: string;
          location: string;
          startTime: string;
          endTime: string;
          description: string;
          category: string;
          attendees: number;
          image_path: string;
          is_approved: boolean;
        }

        const formattedEvents: FormattedEvent[] = response.data.map(
          (event: EventData) => ({
            id: event.id,
            title: event.title,
            date: new Date(event.start_date).toISOString().split("T")[0],
            location: event.location,
            startTime: new Date(event.start_date).toTimeString().slice(0, 5),
            endTime: new Date(event.end_date).toTimeString().slice(0, 5),
            description: event.description,
            category: event.category,
            attendees: event.registrations?.length || 0,
            image_path: event.image_path,
            is_approved: event.is_approved,
          })
        );

        setEvents(formattedEvents);
        setError(null);
      } catch (err) {
        console.error("Error fetching events:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [category]);

  // Search events from backend
  useEffect(() => {
    const searchEvents = async () => {
      if (!searchTerm || searchTerm.length < 2) {
        // If search term is empty or too short, fetch all events
        const params = new URLSearchParams();
        if (category) params.append("category", category);
        params.append("upcoming", "true");
        params.append("approved_only", "true");

        try {
          const response = await axios.get(
            `${API_URL}/events?${params.toString()}`
          );

          interface EventData {
            id: number;
            title: string;
            start_date: string;
            end_date: string;
            location: string;
            description: string;
            category: string;
            registrations?: any[];
            image_path: string;
            is_approved: boolean;
          }

          interface FormattedEvent {
            id: number;
            title: string;
            date: string;
            location: string;
            startTime: string;
            endTime: string;
            description: string;
            category: string;
            attendees: number;
            image_path: string;
            is_approved: boolean;
          }

          const formattedEvents: FormattedEvent[] = response.data.map(
            (event: EventData) => ({
              id: event.id,
              title: event.title,
              date: new Date(event.start_date).toISOString().split("T")[0],
              location: event.location,
              startTime: new Date(event.start_date).toTimeString().slice(0, 5),
              endTime: new Date(event.end_date).toTimeString().slice(0, 5),
              description: event.description,
              category: event.category,
              attendees: event.registrations?.length || 0,
              image_path: event.image_path,
              is_approved: event.is_approved,
            })
          );

          setEvents(formattedEvents);
        } catch (err) {
          console.error("Error fetching events:", err);
        }
        return;
      }

      try {
        const response = await axios.get(
          `${API_URL}/search?query=${encodeURIComponent(searchTerm)}`
        );

        interface SearchEventData {
          id: number;
          title: string;
          start_date: string;
          end_date: string;
          location: string;
          description: string;
          category: string;
          registrations?: any[];
          image_path: string;
          is_approved: boolean;
        }

        interface FormattedSearchEvent {
          id: number;
          title: string;
          date: string;
          location: string;
          startTime: string;
          endTime: string;
          description: string;
          category: string;
          attendees: number;
          image_path: string;
          is_approved: boolean;
        }

        const formattedEvents: FormattedSearchEvent[] = response.data.map(
          (event: SearchEventData) => ({
            id: event.id,
            title: event.title,
            date: new Date(event.start_date).toISOString().split("T")[0],
            location: event.location,
            startTime: new Date(event.start_date).toTimeString().slice(0, 5),
            endTime: new Date(event.end_date).toTimeString().slice(0, 5),
            description: event.description,
            category: event.category,
            attendees: event.registrations?.length || 0,
            image_path: event.image_path,
            is_approved: event.is_approved,
          })
        );

        setEvents(formattedEvents);
      } catch (err) {
        console.error("Error searching events:", err);
      }
    };

    // Debounce search to avoid too many requests
    const timeoutId = setTimeout(() => {
      searchEvents();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, category]);

  // Setup axios interceptor to add auth token to requests
  useEffect(() => {
    const setupAuthInterceptor = async () => {
      if (isLoaded && isSignedIn) {
        const token = await getToken();

        // Add auth token to all requests
        axios.interceptors.request.use(
          async (config) => {
            if (token) {
              config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
          },
          (error) => Promise.reject(error)
        );
      }
    };

    setupAuthInterceptor();
  }, [isLoaded, isSignedIn, getToken]);

  // Filter events by category
  interface CategorySelectHandler {
    (selectedCategory: string): void;
  }

  const handleCategorySelect: CategorySelectHandler = (selectedCategory) => {
    setCategory(selectedCategory);
  };

  interface MarkInterestHandler {
    (eventId: number): Promise<void>;
  }

  interface Event {
    id: number;
    title: string;
    date: string;
    location: string;
    startTime: string;
    endTime: string;
    description: string;
    category: string;
    attendees: number;
    image_path: string;
    is_approved: boolean;
    userInterested?: boolean;
  }

  const markInterest: MarkInterestHandler = async (eventId) => {
    if (!isSignedIn) {
      alert("Please sign in to mark interest in this event");
      return;
    }

    try {
      const token = await getToken();

      const response = await fetch(`${API_URL}/events/${eventId}/interest`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to mark interest");
      }

      const data = await response.json();

      // Toggle the interest status and update the events list
      setEvents(
        events.map((event) => {
          if (event.id === eventId) {
            const isCurrentlyInterested = event.userInterested || false;
            return {
              ...event,
              userInterested: !isCurrentlyInterested,
              attendees: isCurrentlyInterested
                ? event.attendees - 1
                : event.attendees + 1,
            };
          }
          return event;
        })
      );
    } catch (err) {
      console.error("Error marking interest:", err);
    }
  };
  // Filter events based on search term (client-side filtering as backup)
  const filteredEvents =
    searchTerm.length > 0
      ? events.filter(
          (event) =>
            event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            event.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
            event.category.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : events;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container mx-auto flex justify-between items-center py-4 px-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Community Pulse</h1>
          </div>

          <Menubar className="hidden md:flex">
            <MenubarMenu>
              <MenubarTrigger>Events</MenubarTrigger>
              <MenubarContent>
                <MenubarItem
                  onClick={() => handleCategorySelect("Garage Sale")}
                >
                  <Link href="?category=Garage%20Sale" className="flex w-full">
                    Garage Sales
                  </Link>
                </MenubarItem>
                <MenubarItem
                  onClick={() => handleCategorySelect("Sports Match")}
                >
                  <Link href="?category=Sports%20Match" className="flex w-full">
                    Sports Matches
                  </Link>
                </MenubarItem>
                <MenubarItem
                  onClick={() => handleCategorySelect("Community Class")}
                >
                  <Link
                    href="?category=Community%20Class"
                    className="flex w-full"
                  >
                    Community Classes
                  </Link>
                </MenubarItem>
                <MenubarItem onClick={() => handleCategorySelect("Volunteer")}>
                  <Link href="?category=Volunteer" className="flex w-full">
                    Volunteer Opportunities
                  </Link>
                </MenubarItem>
                <MenubarItem onClick={() => handleCategorySelect("Exhibition")}>
                  <Link href="?category=Exhibition" className="flex w-full">
                    Exhibitions
                  </Link>
                </MenubarItem>
                <MenubarItem onClick={() => handleCategorySelect("Festival")}>
                  <Link href="?category=Festival" className="flex w-full">
                    Small Festivals
                  </Link>
                </MenubarItem>
              </MenubarContent>
            </MenubarMenu>
            <MenubarMenu>
              <MenubarTrigger>My Events</MenubarTrigger>
              <MenubarContent>
                <SignedIn>
                  <MenubarItem>
                    <Link href="/my-events/attending" className="flex w-full">
                      Events I'm Attending
                    </Link>
                  </MenubarItem>
                  <MenubarItem>
                    <Link href="/my-events/organizing" className="flex w-full">
                      Events I'm Organizing
                    </Link>
                  </MenubarItem>
                </SignedIn>
                <SignedOut>
                  <MenubarItem>
                    <SignInButton>Sign in to view your events</SignInButton>
                  </MenubarItem>
                </SignedOut>
              </MenubarContent>
            </MenubarMenu>
            <MenubarMenu>
              <MenubarTrigger>Admin</MenubarTrigger>
              <MenubarContent>
                <SignedIn>
                  <MenubarItem>
                    <Link href="/admind" className="flex w-full">
                      Dashboard
                    </Link>
                  </MenubarItem>
                  <MenubarItem>
                    <Link href="/admind" className="flex w-full">
                      Organizer Panel
                    </Link>
                  </MenubarItem>
                </SignedIn>
                <SignedOut>
                  <MenubarItem>
                    <SignInButton>Sign in as admin to view</SignInButton>
                  </MenubarItem>
                </SignedOut>
              </MenubarContent>
            </MenubarMenu>
          </Menubar>

          <div className="flex items-center gap-4">
            <SignedIn>
              <Link href="/addevent">
                <Button className="hidden md:flex items-center gap-2">
                  <PlusCircle size={16} />
                  Create Event
                </Button>
              </Link>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
            <SignedOut>
              <SignInButton>
                <Button>Sign In</Button>
              </SignInButton>
            </SignedOut>
          </div>
        </div>
      </header>

      <main className="container mx-auto flex-grow px-4 py-8">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <input
            type="text"
            placeholder="Search events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-grow p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => setCategory(null)}
            >
              <Calendar size={16} />
              All Categories
            </Button>

            <Button variant="outline" className="flex items-center gap-2">
              <Users size={16} />
              Upcoming
            </Button>
          </div>
        </div>

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">
            {category ? `${category} Events` : "Upcoming Events"}
          </h1>
          <SignedIn>
            <Link href="/addevent">
              <Button className="md:hidden flex items-center gap-2">
                <PlusCircle size={16} />
                Create Event
              </Button>
            </Link>
          </SignedIn>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <p className="text-lg">Loading events...</p>
          </div>
        ) : error ? (
          <div className="flex justify-center items-center h-64">
            <p className="text-lg text-red-500">{error}</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="flex justify-center items-center h-64">
            <p className="text-lg">
              No events found. Try a different search or category.
            </p>
          </div>
        ) : (
          <EventCardsGrid events={filteredEvents} onInterest={markInterest} />
        )}
      </main>
    </div>
  );
}
