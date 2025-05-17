// Hashes of public keys flagged as CSAM by CloudFlare
// They are hidden by default on iris.to domain
// CloudFlare hosting policies require this
// even if content related to the public key is not hosted on CloudFlare
// even though it's not efficient, does not address the underlying issue
// and is not required by law.
// Optics is what matters.
// see https://iris.to/note1pu5kvxwfzytxsw6vkqd4eu6e0xr8znaur6sl38r4swl3klgsn6dqzlpnsl
export const CLOUDFLARE_CSAM_FLAGGED = [
  "011b3e4c20524582293fb9070701013e2570a3a27b6cac32a3edb9e3400b6c00",
]
