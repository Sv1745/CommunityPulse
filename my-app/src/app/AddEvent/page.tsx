"use client";

import React, { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, Image as ImageIcon, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";

// Define the form schema using Zod
const eventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  location: z.string().min(1, "Location is required"),
  category: z.enum(
    [
      "Garage Sale",
      "Sports Match",
      "Community Class",
      "Volunteer",
      "Exhibition",
      "Festival",
    ],
    { required_error: "Category is required" }
  ),
  start_date: z
    .string()
    .min(1, "Start date is required")
    .refine((val) => !isNaN(Date.parse(val)), "Invalid start date"),
  end_date: z
    .string()
    .min(1, "End date is required")
    .refine((val) => !isNaN(Date.parse(val)), "Invalid end date"),
  registration_start: z
    .string()
    .min(1, "Registration start date is required")
    .refine(
      (val) => !isNaN(Date.parse(val)),
      "Invalid registration start date"
    ),
  registration_end: z
    .string()
    .min(1, "Registration end date is required")
    .refine((val) => !isNaN(Date.parse(val)), "Invalid registration end date"),
  image: z
    .any()
    .optional()
    .refine(
      (file) => !file || (file instanceof File && file.size <= 5 * 1024 * 1024),
      "Image must be less than 5MB"
    ),
});

type EventFormValues = z.infer<typeof eventSchema>;

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600">
              Something went wrong
            </h1>
            <p className="mt-2 text-gray-600">
              Please refresh the page or try again later.
            </p>
            <Button className="mt-4" onClick={() => window.location.reload()}>
              Refresh
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AddEventPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { getToken, isSignedIn } = useAuth();
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Initialize form
  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: "",
      description: "",
      location: "",
      category: "Community Class",
      start_date: "",
      end_date: "",
      registration_start: "",
      registration_end: "",
      image: undefined,
    },
  });

  // Handle image change
  const handleImageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        form.setValue("image", file);
        const reader = new FileReader();
        reader.onloadend = () => setImagePreview(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        form.setValue("image", undefined);
        setImagePreview(null);
      }
    },
    [form]
  );

  // Handle form submission
  const onSubmit = async (values: EventFormValues) => {
    if (!isSignedIn) {
      setError("You must be signed in to create an event");
      toast.error("Please sign in to continue");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token)
        throw new Error("Authentication failed. Please sign in again.");

      const formData = new FormData();
      Object.entries(values).forEach(([key, value]) => {
        if (key === "image" && value instanceof File) {
          formData.append(key, value);
        } else if (value) {
          formData.append(key, value.toString());
        }
      });

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/events`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to create event");
      }

      const data = await response.json();
      const successmsg = data.is_approved
        ? "Your event has been created and is now live."
        : "Your event has been submitted for approval.";
      toast.success(successmsg);

      form.reset();
      setImagePreview(null);
      router.push("/events");
    } catch (err: any) {
      console.error("Error creating event:", err);
      setError(err.message || "An error occurred while creating the event");
      toast.error(err.message || "Failed to create event. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Render nothing if not signed in
  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800">Please Sign In</h1>
          <p className="mt-2 text-gray-600">
            You need to be signed in to create an event.
          </p>
          <Button className="mt-4" onClick={() => router.push("/sign-in")}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-3xl"
        >
          <div className="flex items-center mb-6">
            <Button
              variant="ghost"
              onClick={() => router.push("/events")}
              className="flex items-center text-teal-600 hover:text-teal-800"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Events
            </Button>
          </div>

          <Card className="bg-white border border-gray-200 rounded-xl shadow-xl">
            <CardHeader className="border-b border-gray-100 pb-6">
              <h1 className="text-3xl font-bold text-gray-800">
                Create a New Event
              </h1>
            </CardHeader>
            <CardContent className="pt-6">
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-6"
                  encType="multipart/form-data"
                >
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Event Title</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <input
                              {...field}
                              type="text"
                              placeholder="Enter event title"
                              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
                            />
                            <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <textarea
                            {...field}
                            placeholder="Describe your event..."
                            className="w-full px-4 py-2 border rounded-lg min-h-[120px] focus:ring-2 focus:ring-teal-500 resize-none"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location</FormLabel>
                          <FormControl>
                            <input
                              {...field}
                              type="text"
                              placeholder="Enter event location"
                              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <FormControl>
                            <select
                              {...field}
                              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
                            >
                              {eventSchema.shape.category.options.map(
                                (option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                )
                              )}
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="start_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Date & Time</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <input
                                {...field}
                                type="datetime-local"
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
                              />
                              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="end_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Date & Time</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <input
                                {...field}
                                type="datetime-local"
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
                              />
                              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="registration_start"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Registration Start</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <input
                                {...field}
                                type="datetime-local"
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
                              />
                              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="registration_end"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Registration End</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <input
                                {...field}
                                type="datetime-local"
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
                              />
                              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="image"
                    render={({ field: { value, onChange, ...fieldProps } }) => (
                      <FormItem>
                        <FormLabel>Event Image (Optional)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageChange}
                              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
                              {...fieldProps}
                            />
                            <ImageIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {imagePreview && (
                    <div className="mt-2 relative">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="h-48 w-full object-cover rounded-lg border"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setImagePreview(null);
                          form.setValue("image", undefined);
                        }}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </div>
                  )}

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-800 text-sm">
                    <p>
                      <strong>Note:</strong> Events require approval before they
                      become visible to other users, unless you are a verified
                      organizer.
                    </p>
                  </div>

                  {error && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-red-500 text-sm text-center"
                    >
                      {error}
                    </motion.p>
                  )}

                  <Button
                    type="submit"
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white py-3 rounded-lg"
                    disabled={loading}
                  >
                    {loading ? "Creating Event..." : "Create Event"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </ErrorBoundary>
  );
}
