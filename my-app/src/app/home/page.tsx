import { EventCardsGrid } from "@/components/cards";

export default function EventsPage() {
  // This would come from your API call
  const events = [
    {
      id: "1",
      title: "Community Yoga Class",
      date: "2025-05-25",
      location: "Central Park, Main Lawn",
      startTime: "09:00",
      endTime: "10:30",
      description:
        "Join us for a free community yoga session suitable for all levels. Bring your own mat!",
      category: "Community Class",
      attendees: 12,
    },
    {
      id: "1",
      title: "Community Yoga Class",
      date: "2025-05-25",
      location: "Central Park, Main Lawn",
      startTime: "09:00",
      endTime: "10:30",
      description:
        "Join us for a free community yoga session suitable for all levels. Bring your own mat!",
      category: "Community Class",
      attendees: 12,
    },
    // More events...
  ];

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Upcoming Events</h1>
      <EventCardsGrid events={events} />
    </div>
  );
}
