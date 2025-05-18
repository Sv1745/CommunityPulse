import * as React from "react";
import { Calendar, MapPin, Clock, Users, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

interface Event {
  id: number;
  title: string;
  category: string;
  date: string;
  location: string;
  startTime: string;
  endTime: string;
  description: string;
  attendees?: number;
}

function EventCard({
  event,
  className,
  ...props
}: {
  event: Event;
  className?: string;
}) {
  // Handle event date formatting
  interface FormatDateOptions extends Intl.DateTimeFormatOptions {}

  const formatDate = (dateString: string): string => {
    const options: FormatDateOptions = {
      weekday: "short",
      month: "short",
      day: "numeric",
    };
    return new Date(dateString).toLocaleDateString("en-US", options);
  };

  // Handle event time formatting
  interface FormatTimeOptions extends Intl.DateTimeFormatOptions {}

  const formatTime = (timeString: string): string => {
    const options: FormatTimeOptions = {
      hour: "2-digit",
      minute: "2-digit",
    };
    return new Date(`1970-01-01T${timeString}`).toLocaleTimeString(
      "en-US",
      options
    );
  };

  return (
    <div
      className={cn(
        "bg-card text-card-foreground flex flex-col rounded-xl border shadow-sm hover:shadow-md transition-shadow duration-200",
        className
      )}
      {...props}
    >
      {/* Event image or category banner */}
      <div className="relative h-40 rounded-t-xl overflow-hidden">
        <div
          className={`absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 opacity-80`}
        ></div>
        <div className="absolute top-4 right-4 bg-white/90 text-xs font-medium px-2 py-1 rounded-full">
          {event.category}
        </div>
      </div>

      <div className="flex flex-col gap-4 p-5">
        {/* Title and date */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold line-clamp-2">{event.title}</h3>
          <div className="flex items-center text-muted-foreground text-sm gap-1.5">
            <Calendar className="h-4 w-4" />
            <span>{formatDate(event.date)}</span>
          </div>
        </div>

        {/* Location and time */}
        <div className="space-y-2">
          <div className="flex items-center text-muted-foreground text-sm gap-1.5">
            <MapPin className="h-4 w-4" />
            <span className="line-clamp-1">{event.location}</span>
          </div>
          <div className="flex items-center text-muted-foreground text-sm gap-1.5">
            <Clock className="h-4 w-4" />
            <span>
              {formatTime(event.startTime)} - {formatTime(event.endTime)}
            </span>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground line-clamp-3">
          {event.description}
        </p>

        {/* Footer with attendance and action button */}
        <div className="flex items-center justify-between mt-2 pt-4 border-t">
          <div className="flex items-center text-sm gap-1.5">
            <Users className="h-4 w-4" />
            <span>{event.attendees || 0} attending</span>
          </div>
          <button className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium hover:bg-primary/90 transition-colors">
            I'm Interested
          </button>
        </div>
      </div>
    </div>
  );
}

// Event Cards Grid component
function EventCardsGrid({ events }: { events: Event[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
}

export { EventCard, EventCardsGrid };
