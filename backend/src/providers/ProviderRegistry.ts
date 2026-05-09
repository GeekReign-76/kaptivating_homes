import { ListingProvider } from './ListingProvider';
import { SCListingProvider } from './SCListingProvider';
// Future imports:
// import { GAListingProvider } from './GAListingProvider';
// import { FLListingProvider } from './FLListingProvider';

/**
 * ProviderRegistry
 *
 * Maps the `provider_class` string stored in the `markets` DB table
 * to the concrete ListingProvider implementation.
 *
 * The sync scheduler reads active markets from the DB, looks up the
 * provider by class name, and passes it to the sync job.
 *
 * Adding a new state:
 *   1. Create a new provider class (copy SCListingProvider, update creds + URLs)
 *   2. Add it to PROVIDER_MAP below (one line)
 *   3. INSERT a row into the markets table
 *   4. Toggle is_active = true in the dashboard
 *   Done — no other changes needed.
 */

type ProviderConstructor = new () => ListingProvider;

const PROVIDER_MAP: Record<string, ProviderConstructor> = {
  SCListingProvider,
  // GAListingProvider,   ← uncomment when adding GA
  // FLListingProvider,   ← uncomment when adding FL
};

export class ProviderRegistry {
  /**
   * Returns an instantiated provider for the given class name.
   * Throws if the class name is not registered.
   */
  static getProvider(providerClass: string): ListingProvider {
    const Constructor = PROVIDER_MAP[providerClass];

    if (!Constructor) {
      throw new Error(
        `Unknown provider class: "${providerClass}". ` +
        `Registered providers: ${Object.keys(PROVIDER_MAP).join(', ')}`
      );
    }

    return new Constructor();
  }

  /**
   * Returns all registered provider class names.
   * Used for validation when toggling a market active.
   */
  static getRegisteredClasses(): string[] {
    return Object.keys(PROVIDER_MAP);
  }
}
