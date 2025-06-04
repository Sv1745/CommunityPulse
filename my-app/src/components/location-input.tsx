"use client";

import { useEffect, useState } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import Script from "next/script";

interface LocationInputProps {
  onLocationSelect: (location: {
    address: string;
    latitude: number;
    longitude: number;
  }) => void;
  defaultValue?: string;
}

declare global {
  interface Window {
    google: any;
    initAutocomplete: () => void;
  }
}

export function LocationInput({
  onLocationSelect,
  defaultValue = "",
}: LocationInputProps) {
  const [loaded, setLoaded] = useState(false);
  const [inputValue, setInputValue] = useState(defaultValue);

  useEffect(() => {
    if (typeof window !== "undefined" && !window.google) {
      window.initAutocomplete = () => {
        const input = document.getElementById(
          "location-input"
        ) as HTMLInputElement;
        const autocomplete = new window.google.maps.places.Autocomplete(input, {
          types: ["geocode"],
        });

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          if (place.geometry) {
            onLocationSelect({
              address: place.formatted_address,
              latitude: place.geometry.location.lat(),
              longitude: place.geometry.location.lng(),
            });
            setInputValue(place.formatted_address);
          }
        });

        setLoaded(true);
      };
    }
  }, [onLocationSelect]);

  return (
    <div className="space-y-2">
      <Label htmlFor="location-input">Location</Label>
      <Input
        id="location-input"
        placeholder="Start typing to search for a location..."
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
      />
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&callback=initAutocomplete`}
        strategy="lazyOnload"
      />
    </div>
  );
}
