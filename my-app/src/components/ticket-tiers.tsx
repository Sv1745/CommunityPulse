"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";

interface TicketTier {
  name: string;
  price: number;
  description?: string;
}

interface TicketTiersProps {
  tiers: TicketTier[];
  onSelectTier: (tier: TicketTier) => void;
}

export function TicketTiers({ tiers, onSelectTier }: TicketTiersProps) {
  const [selectedTier, setSelectedTier] = useState<string>("");

  const handleTierSelect = (value: string) => {
    setSelectedTier(value);
    const tier = tiers.find((t) => t.name === value);
    if (tier) {
      onSelectTier(tier);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Select Ticket Tier</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedTier} onValueChange={handleTierSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a ticket tier" />
            </SelectTrigger>
            <SelectContent>
              {tiers.map((tier) => (
                <SelectItem key={tier.name} value={tier.name}>
                  <div className="flex justify-between items-center gap-4">
                    <span>{tier.name}</span>
                    <span className="text-muted-foreground">
                      ₹{tier.price.toFixed(2)}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedTier && (
            <div className="mt-4">
              <h4 className="font-medium mb-2">Selected Tier Details</h4>
              {tiers
                .filter((tier) => tier.name === selectedTier)
                .map((tier) => (
                  <div key={tier.name} className="space-y-2">
                    <p className="text-lg font-semibold">
                      ₹{tier.price.toFixed(2)}
                    </p>
                    {tier.description && (
                      <p className="text-sm text-muted-foreground">
                        {tier.description}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
