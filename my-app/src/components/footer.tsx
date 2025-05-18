"use client";

import React from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Github, Twitter, Facebook } from "lucide-react";
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";

export default function Footer() {
  const { isSignedIn } = useUser();

  return (
    <footer className="bg-gray-900 text-gray-200 py-12 px-4 sm:px-6 lg:px-8 border-t border-gray-800">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-teal-400">
              Community Pulse
            </h3>
            <p className="text-sm text-gray-400">
              Connecting communities through vibrant events. Join us to create,
              discover, and share unforgettable experiences.
            </p>
          </div>
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-gray-200">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/"
                  className="hover:text-teal-400 transition-colors duration-200"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  href="/events"
                  className="hover:text-teal-400 transition-colors duration-200"
                >
                  Events
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="hover:text-teal-400 transition-colors duration-200"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="hover:text-teal-400 transition-colors duration-200"
                >
                  Contact
                </Link>
              </li>
              {isSignedIn ? (
                <li>
                  <Link
                    href={
                      isSignedIn &&
                      (useUser().user?.publicMetadata?.role === "organizer"
                        ? "/organizer-dashboard"
                        : "/user-dashboard")
                    }
                    className="hover:text-teal-400 transition-colors duration-200"
                  >
                    Dashboard
                  </Link>
                </li>
              ) : (
                <li>
                  return <SignInButton />
                </li>
              )}
            </ul>
          </div>
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-gray-200">
              Connect With Us
            </h4>
            <div className="flex space-x-4">
              <motion.a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.2 }}
                className="text-gray-400 hover:text-teal-400 transition-colors duration-200"
              >
                <Github className="w-6 h-6" />
                <span className="sr-only">GitHub</span>
              </motion.a>
              <motion.a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.2 }}
                className="text-gray-400 hover:text-teal-400 transition-colors duration-200"
              >
                <Twitter className="w-6 h-6" />
                <span className="sr-only">Twitter</span>
              </motion.a>
              <motion.a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.2 }}
                className="text-gray-400 hover:text-teal-400 transition-colors duration-200"
              >
                <Facebook className="w-6 h-6" />
                <span className="sr-only">Facebook</span>
              </motion.a>
            </div>
            <motion.div whileHover={{ scale: 1.05 }}>
              <Button
                asChild
                variant="outline"
                className="bg-transparent border-teal-400 text-teal-400 hover:bg-teal-400 hover:text-gray-900 transition-colors duration-300"
              >
                <Link href="/addevent">Create an Event</Link>
              </Button>
            </motion.div>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center text-sm text-gray-400">
          <p>
            © {new Date().getFullYear()} Community Pulse. All rights reserved.
          </p>
          <div className="mt-4 md:mt-0 space-x-4">
            <Link
              href="/privacy"
              className="hover:text-teal-400 transition-colors duration-200"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="hover:text-teal-400 transition-colors duration-200"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export { Footer };
