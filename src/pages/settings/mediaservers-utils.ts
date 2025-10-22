export const MEDIASERVERS = {
  iris: {
    url: "https://blossom.iris.to",
    protocol: "blossom" as const,
  },
  nostr_build: {
    url: "https://blossom.nostr.build",
    protocol: "blossom" as const,
  },
  nostr_check: {
    url: "https://cdn.nostrcheck.me",
    protocol: "nip96" as const,
  },
}

export function getDefaultServers(isSubscriber: boolean) {
  return isSubscriber
    ? [MEDIASERVERS.iris, MEDIASERVERS.nostr_build, MEDIASERVERS.nostr_check]
    : [MEDIASERVERS.nostr_build, MEDIASERVERS.nostr_check]
}

export function stripHttps(url: string) {
  return url.replace(/^https?:\/\//, "")
}
