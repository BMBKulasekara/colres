export function buildUserProfilePayload(user) {
  const primaryEmail =
    (user.emailAddresses ?? []).find((email) => email.id === user.primaryEmailAddressId) ??
    user.emailAddresses?.[0];

  const computedName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();

  return {
    clerkId: user.id,
    name: user.fullName ?? (computedName || 'Anonymous'),
    email: primaryEmail?.emailAddress ?? user.primaryEmailAddress?.emailAddress ?? '',
    imageUrl: user.imageUrl ?? '',
    createdAt: Date.now(),
  };
}
