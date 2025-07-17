export const MEDIASERVERS = {
  iris: {
    url: "https://blossom.iris.to",
    protocol: "blossom" as const,
  },
  f7z: {
    url: "https://blossom.f7z.io",
    protocol: "blossom" as const,
  },
  nostr_build: {
    url: "https://nostr.build/api/v2/nip96/upload",
    protocol: "nip96" as const,
  },
  nostr_check: {
    url: "https://cdn.nostrcheck.me",
    protocol: "nip96" as const,
  },
}

export function getDefaultServers(isSubscriber: boolean) {
  return isSubscriber
    ? [
        MEDIASERVERS.iris,
        MEDIASERVERS.f7z,
        MEDIASERVERS.nostr_build,
        MEDIASERVERS.nostr_check,
      ]
    : [MEDIASERVERS.f7z, MEDIASERVERS.nostr_build, MEDIASERVERS.nostr_check]
}

export function stripHttps(url: string) {
  return url.replace(/^https?:\/\//, "")
}
