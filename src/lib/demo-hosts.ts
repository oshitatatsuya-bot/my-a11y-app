/** Hosts that never consume the monthly site quota (safe PLG demos). */
const DEMO_HOSTS = new Set([
  "example.com",
  "www.example.com",
  "example.org",
  "www.example.org",
  "example.net",
  "www.example.net",
])

export function isDemoHost(host: string) {
  return DEMO_HOSTS.has(host.trim().toLowerCase())
}

/** Hosts that count against plan.sites this period. */
export function countableHosts(hosts: string[]) {
  return hosts.filter((host) => !isDemoHost(host))
}
