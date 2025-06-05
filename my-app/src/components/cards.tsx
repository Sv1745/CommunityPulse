import * as React from "react";
import { Calendar, MapPin, Clock, Users, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { motion } from "framer-motion";

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
  image_path?: string;
  userInterested?: boolean;
}

interface EventCardProps {
  event: Event;
  className?: string;
  onInterest?: (eventId: number) => void;
  showInterestButton?: boolean;
}

function EventCard({
  event,
  className,
  onInterest,
  showInterestButton = true,
  ...props
}: EventCardProps) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  
  const formatDate = (dateString: string): string => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: "short",
      month: "short",
      day: "numeric",
    };
    return new Date(dateString).toLocaleDateString("en-US", options);
  };

  const formatTime = (timeString: string): string => {
    const options: Intl.DateTimeFormatOptions = {
      hour: "2-digit",
      minute: "2-digit",
    };
    return new Date(`1970-01-01T${timeString}`).toLocaleTimeString(
      "en-US",
      options
    );
  };

  const handleInterestClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onInterest) {
      onInterest(event.id);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -5 }}
    >
      <Link href={`/events/${event.id}`}>
        <div
          className={cn(
            "bg-card text-card-foreground rounded-xl border shadow-sm hover:shadow-lg transition-all duration-300",
            "transform hover:scale-[1.02]",
            className
          )}
          {...props}
        >
          <div className="relative h-48 rounded-t-xl overflow-hidden">
            {event.image_path ? (
              <img
                src={`${API_URL}/${event.image_path}`}
                alt={event.title}
                className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                onError={(e) => {
                  e.currentTarget.src = "https://via.placeholder.com/400x200?text=Event";
                }}
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary/80 to-primary/40" />
            )}
            <div className="absolute top-4 right-4">
              <span className="glass px-3 py-1.5 rounded-full text-sm font-medium text-white">
                {event.category}
              </span>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <h3 className="text-xl font-semibold line-clamp-2 mb-2">
                {event.title}
              </h3>
              <div className="flex items-center text-muted-foreground text-sm gap-2">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(event.date)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center text-muted-foreground text-sm gap-2">
                <MapPin className="h-4 w-4" />
                <span className="line-clamp-1">{event.location}</span>
              </div>
              <div className="flex items-center text-muted-foreground text-sm gap-2">
                <Clock className="h-4 w-4" />
                <span>
                  {formatTime(event.startTime)} - {formatTime(event.endTime)}
                </span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground line-clamp-2">
              {event.description}
            </p>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center text-sm gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span>{event.attendees || 0} attending</span>
              </div>
              {showInterestButton && (
                <button
                  onClick={handleInterestClick}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                    "button-hover",
                    event.userInterested
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-primary text-primary-foreground"
                  )}
                >
                  {event.userInterested ? "Not Interested" : "I'm Interested"}
                </button>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function EventCardsGrid({
  events,
  onInterest,
  showInterestButton = true,
}: {
  events: Event[];
  onInterest?: (eventId: number) => void;
  showInterestButton?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {events.map((event, index) => (
        <motion.div
          key={event.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.1 }}
        >
          <EventCard
            event={event}
            onInterest={onInterest}
            showInterestButton={showInterestButton}
          />
        </motion.div>
      ))}
    </div>
  );
}

export { EventCard, EventCardsGrid };