/**
 * Anonymous usage events (SPEC 2.14). Nothing personal is ever sent: only which hole,
 * how many strokes and how many stars.
 *
 * This module does not load any analytics script itself. It forwards to whichever
 * privacy-friendly provider's script is on the page (Plausible or Umami both work out
 * of the box) and does nothing when there is none, e.g. in development.
 */
export type AnalyticsProps = Record<string, string | number | boolean>;

interface Providers {
  plausible?: (event: string, options?: { props?: AnalyticsProps }) => void;
  umami?: { track(event: string, props?: AnalyticsProps): void };
}

export function track(event: string, props: AnalyticsProps = {}): void {
  try {
    const providers = window as unknown as Providers;
    if (providers.plausible) providers.plausible(event, { props });
    else if (providers.umami) providers.umami.track(event, props);
    else if (import.meta.env.DEV) console.debug('[analytics]', event, props);
  } catch {
    // Analytics must never break the game.
  }
}
