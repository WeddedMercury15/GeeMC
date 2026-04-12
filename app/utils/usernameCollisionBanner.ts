/** Client-only sessionStorage keys for the Gee username collision strip (no DB). */
export const SS_USERNAME_HINT = 'geemc_username_collision_hint'
export const SS_USERNAME_DISMISSED = 'geemc_username_collision_dismissed'

/** New OAuth redirect with `?suggest_username=1` — must override a prior dismiss in the same tab. */
export function oauthCollisionHintReceived() {
  if (!import.meta.client) return
  sessionStorage.removeItem(SS_USERNAME_DISMISSED)
  sessionStorage.setItem(SS_USERNAME_HINT, '1')
}

/** Logout or full reset: clear so a future login can show the strip again. */
export function clearUsernameCollisionStorage() {
  if (!import.meta.client) return
  sessionStorage.removeItem(SS_USERNAME_HINT)
  sessionStorage.removeItem(SS_USERNAME_DISMISSED)
}
