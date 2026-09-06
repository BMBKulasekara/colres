/**
 * Tells Convex which identity provider to trust.
 *
 * Set CLERK_JWT_ISSUER_DOMAIN on the Convex deployment (not in .env.local):
 *   npx convex env set CLERK_JWT_ISSUER_DOMAIN https://<your-app>.clerk.accounts.dev
 *
 * The `applicationID` must match the name of the JWT template created in the
 * Clerk dashboard (Configure -> JWT Templates -> new "Convex" template). Both
 * halves are required: without them `ctx.auth.getUserIdentity()` returns null
 * and every guarded function rejects.
 */
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};
