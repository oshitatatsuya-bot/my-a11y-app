/** Prevents an attacker-supplied `next` parameter from redirecting off-site. */
export function safeRedirectPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/scan"
  }

  return value
}
