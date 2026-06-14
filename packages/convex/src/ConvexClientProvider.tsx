"use client";

import { ReactNode, useState } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";

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
      // Return a dummy client or throw error in browser, but handle SSR gracefully.
      // If we throw here, Server Side Rendering might crash if env var is missing during build.
      // But standard dev setups will have the env var. Let's write a warning or throw a clear error.
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

  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
