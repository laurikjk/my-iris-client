import {matchFilter, VerifiedEvent, UnsignedEvent, Filter} from "nostr-tools"
import {NDKEvent, NDKPrivateKeySigner} from "@nostr-dev-kit/ndk"

type Subscriber = {
  id: string
  filter: Filter
  onEvent: (e: VerifiedEvent) => void
  delivered: Set<string> // track event IDs already sent to this subscriber
}

/**
 * MockRelay provides an isolated, in-memory relay for testing.
 * It supports event storage, subscription management, and proper event delivery.
 */
export class MockRelay {
  private events: VerifiedEvent[] = []
  private subscribers: Map<string, Subscriber> = new Map()
  private subscriptionCounter = 0

  /**
   * Get all stored events
   */
  getEvents(): VerifiedEvent[] {
    return [...this.events]
  }

  /**
   * Get all active subscriptions
   */
  getSubscriptions(): Map<string, Subscriber> {
    return new Map(this.subscribers)
  }

  /**
   * Publish an event to the relay
   * Signs the event and delivers it to all matching subscribers
   */
  async publish(
    event: UnsignedEvent,
    signerSecretKey?: Uint8Array
  ): Promise<VerifiedEvent> {
    let verifiedEvent: VerifiedEvent

    if (event.sig && event.id) {
      // Already signed
      verifiedEvent = event as VerifiedEvent
    } else {
      // Sign the event using NDK
      const ndkEvent = new NDKEvent()
      ndkEvent.kind = event.kind
      ndkEvent.content = event.content
      ndkEvent.tags = event.tags || []
      ndkEvent.created_at = event.created_at
      ndkEvent.pubkey = event.pubkey

      if (signerSecretKey) {
        const signer = new NDKPrivateKeySigner(signerSecretKey)
        await ndkEvent.sign(signer)
      }

      verifiedEvent = {
        ...event,
        id: ndkEvent.id!,
        sig: ndkEvent.sig!,
        tags: ndkEvent.tags || [],
      } as VerifiedEvent
    }

    // Store the event
    this.events.push(verifiedEvent)

    // Deliver to all matching subscribers
    for (const sub of this.subscribers.values()) {
      this.deliverToSubscriber(sub, verifiedEvent)
    }

    return verifiedEvent
  }

  /**
   * Subscribe to events matching a filter
   * Returns an unsubscribe function
   */
  subscribe(filter: Filter, onEvent: (event: VerifiedEvent) => void): () => void {
    this.subscriptionCounter++
    const subId = `sub-${this.subscriptionCounter}`

    const subscriber: Subscriber = {
      id: subId,
      filter,
      onEvent,
      delivered: new Set(),
    }

    this.subscribers.set(subId, subscriber)

    // Deliver all existing matching events
    for (const event of this.events) {
      this.deliverToSubscriber(subscriber, event)
    }

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(subId)
    }
  }

  /**
   * Deliver an event to a subscriber if it matches and hasn't been delivered yet
   */
  private deliverToSubscriber(subscriber: Subscriber, event: VerifiedEvent): void {
    if (!subscriber.delivered.has(event.id) && matchFilter(subscriber.filter, event)) {
      subscriber.delivered.add(event.id)
      subscriber.onEvent(event)
    }
  }

  /**
   * Clear all events and subscriptions (useful for test cleanup)
   */
  reset(): void {
    this.events = []
    this.subscribers.clear()
    this.subscriptionCounter = 0
  }
}

// Convenience functions for backward compatibility
const globalRelay = new MockRelay()

export function publish(event: UnsignedEvent): Promise<VerifiedEvent> {
  return globalRelay.publish(event)
}

export function makeSubscribe() {
  return (filter: Filter, onEvent: (e: VerifiedEvent) => void) => {
    return globalRelay.subscribe(filter, onEvent)
  }
}
