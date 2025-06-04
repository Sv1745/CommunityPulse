"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "./ui/card";
import Script from "next/script";

interface MapItem {
  id: number;
  title: string;
  latitude: number;
  longitude: number;
  category: string;
  status_badge?: string;
  status?: string;
}

interface MapViewProps {
  items: MapItem[];
  type: "events" | "issues";
  onItemClick: (id: number) => void;
}

declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

export function MapView({ items, type, onItemClick }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [markers, setMarkers] = useState<any[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined" && !window.google) {
      window.initMap = () => {
        if (mapRef.current) {
          const mapInstance = new window.google.maps.Map(mapRef.current, {
            zoom: 13,
            center: {
              lat: items[0]?.latitude || 0,
              lng: items[0]?.longitude || 0,
            },
          });
          setMap(mapInstance);
        }
      };
    }
  }, [items]);

  useEffect(() => {
    if (map) {
      // Clear existing markers
      markers.forEach((marker) => marker.setMap(null));

      // Create new markers
      const newMarkers = items.map((item) => {
        const marker = new window.google.maps.Marker({
          position: { lat: item.latitude, lng: item.longitude },
          map,
          title: item.title,
          icon: {
            url: type === "events" ? "/event-marker.png" : "/issue-marker.png",
            scaledSize: new window.google.maps.Size(32, 32),
          },
        });

        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div class="p-2">
              <h3 class="font-semibold">${item.title}</h3>
              <p class="text-sm">${item.category}</p>
              ${
                item.status_badge
                  ? `<p class="text-sm">${item.status_badge}</p>`
                  : ""
              }
              ${
                item.status
                  ? `<p class="text-sm">Status: ${item.status}</p>`
                  : ""
              }
            </div>
          `,
        });

        marker.addListener("click", () => {
          infoWindow.open(map, marker);
          onItemClick(item.id);
        });

        return marker;
      });

      setMarkers(newMarkers);
    }
  }, [map, items, type, onItemClick]);

  return (
    <Card className="w-full h-[600px] relative">
      <div ref={mapRef} className="w-full h-full" />
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&callback=initMap`}
        strategy="lazyOnload"
      />
    </Card>
  );
}
