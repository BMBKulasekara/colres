"use client";

import { useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { type ReactNode, useState } from "react";

/**
 * Convex client bound to the Clerk session.
 *
 * `ConvexProviderWithClerk` forwards the Clerk JWT on every request, which is
 * what lets Convex functions call `ctx.auth.getUserIdentity()` instead of
 * trusting a `clerkId` passed in as an argument. Must be rendered inside a
 * `<ClerkProvider>`.
 */
export function ConvexClientProvider({
  children,
  convexUrl,
}: {
  children: ReactNode;
  convexUrl?: string;
}) {
  const url = convexUrl ?? process.env.NEXT_PUBLIC_CONVEX_URL;

  const [convex] = useState(() => {
    if (!url) {
      // Throw in the browser, where a missing URL is always a misconfiguration.
      // During SSR/build, fall back so the render does not crash outright.
      if (typeof window !== "undefined") {
        throw new Error(
          "NEXT_PUBLIC_CONVEX_URL environment variable is missing. " +
            "Please check your .env.local file in the application directory."
        );
      }
      return new ConvexReactClient("https://unknown-convex-url.convex.cloud");
    }
    return new ConvexReactClient(url);
  });

  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
