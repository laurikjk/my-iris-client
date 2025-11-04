import type NDK from "./ndk"
import type {NDKEvent} from "./ndk/events"
import type {NDKFilter, NDKSubscription, NDKSubscriptionOptions} from "./ndk/subscription"

/**
 * Interface for alternative transport plugins (WebRTC, Bluetooth, etc)
 * Allows extending NDK with P2P and other non-relay transports
 */
export interface NDKTransportPlugin {
  /**
   * Unique name for this transport
   */
  readonly name: string

  /**
   * Initialize the plugin with NDK instance
   * Called once when plugin is registered
   */
  initialize(ndk: NDK): void | Promise<void>

  /**
   * Called when an event is published to relays
   * Transport can optionally forward the event through its channel
   * @param event - The event being published
   * @param relaySet - The relay set being published to (if any)
   */
  onPublish?(event: NDKEvent, relaySet?: Set<string>): void | Promise<void>

  /**
   * Called when a subscription is created
   * Transport can send REQ to peers and inject matching events
   * @param subscription - The subscription being created
   * @param filters - The filters for this subscription
   * @param opts - Subscription options
   * @returns false to prevent relay subscription, true/undefined to allow
   */
  onSubscribe?(
    subscription: NDKSubscription,
    filters: NDKFilter[],
    opts?: NDKSubscriptionOptions
  ): boolean | void

  /**
   * Called when a subscription is stopped
   * @param subId - The subscription ID being closed
   */
  onUnsubscribe?(subId: string): void

  /**
   * Cleanup resources when transport is removed or NDK is destroyed
   */
  destroy?(): void | Promise<void>
}

/**
 * Manages transport plugins for NDK
 */
export class NDKTransportManager {
  private plugins = new Map<string, NDKTransportPlugin>()
  private ndk: NDK
  private initialized = false

  constructor(ndk: NDK) {
    this.ndk = ndk
  }

  /**
   * Register a transport plugin
   */
  async register(plugin: NDKTransportPlugin): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Transport plugin "${plugin.name}" already registered`)
    }

    // Initialize plugin
    if (this.initialized) {
      await plugin.initialize(this.ndk)
    }

    this.plugins.set(plugin.name, plugin)
    console.log(`[NDK Transport] Registered plugin: ${plugin.name}`)
  }

  /**
   * Unregister a transport plugin
   */
  async unregister(name: string): Promise<void> {
    const plugin = this.plugins.get(name)
    if (!plugin) return

    if (plugin.destroy) {
      await plugin.destroy()
    }

    this.plugins.delete(name)
    console.log(`[NDK Transport] Unregistered plugin: ${name}`)
  }

  /**
   * Initialize all registered plugins
   * Called once by NDK during connect()
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    for (const plugin of this.plugins.values()) {
      await plugin.initialize(this.ndk)
    }

    this.initialized = true
  }

  /**
   * Notify plugins of event publish
   */
  async notifyPublish(event: NDKEvent, relaySet?: Set<string>): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.onPublish) {
        try {
          await plugin.onPublish(event, relaySet)
        } catch (error) {
          console.error(`[NDK Transport] Error in ${plugin.name}.onPublish:`, error)
        }
      }
    }
  }

  /**
   * Notify plugins of subscription creation
   */
  notifySubscribe(
    subscription: NDKSubscription,
    filters: NDKFilter[],
    opts?: NDKSubscriptionOptions
  ): void {
    for (const plugin of this.plugins.values()) {
      if (plugin.onSubscribe) {
        try {
          plugin.onSubscribe(subscription, filters, opts)
        } catch (error) {
          console.error(`[NDK Transport] Error in ${plugin.name}.onSubscribe:`, error)
        }
      }
    }
  }

  /**
   * Notify plugins of subscription closure
   */
  notifyUnsubscribe(subId: string): void {
    for (const plugin of this.plugins.values()) {
      if (plugin.onUnsubscribe) {
        try {
          plugin.onUnsubscribe(subId)
        } catch (error) {
          console.error(`[NDK Transport] Error in ${plugin.name}.onUnsubscribe:`, error)
        }
      }
    }
  }

  /**
   * Cleanup all plugins
   */
  async destroy(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.destroy) {
        try {
          await plugin.destroy()
        } catch (error) {
          console.error(`[NDK Transport] Error destroying ${plugin.name}:`, error)
        }
      }
    }
    this.plugins.clear()
    this.initialized = false
  }

  /**
   * Get plugin by name
   */
  get(name: string): NDKTransportPlugin | undefined {
    return this.plugins.get(name)
  }

  /**
   * Check if plugin is registered
   */
  has(name: string): boolean {
    return this.plugins.has(name)
  }

  /**
   * Get all registered plugin names
   */
  getPluginNames(): string[] {
    return Array.from(this.plugins.keys())
  }
}
