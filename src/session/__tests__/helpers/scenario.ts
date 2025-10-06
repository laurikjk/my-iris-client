import {MockRelay} from "./mockRelay"
import {createMockSessionManager} from "./mockSessionManager"
import SessionManager from "../../SessionManager"
import {Rumor} from "nostr-double-ratchet"

export type ActorId = "alice" | "bob"

export interface ScenarioContext {
  relay: MockRelay
  actors: Record<ActorId, ActorState>
}

interface ActorState {
  deviceId: string
  manager: SessionManager
  secretKey: Uint8Array
  publicKey: string
  storage: any
  events: Rumor[]
  unsub?: () => void
}

type ScenarioStep =
  | {type: "send"; from: ActorId; to: ActorId; message: string}
  | {type: "expect"; actor: ActorId; message: string}
  | {type: "expectAll"; actor: ActorId; messages: string[]}
  | {type: "close"; actor: ActorId}
  | {type: "restart"; actor: ActorId}
  | {type: "noop"}

type ScenarioDefinition = {
  steps: ScenarioStep[]
}

export async function runScenario(def: ScenarioDefinition): Promise<ScenarioContext> {
  const relay = new MockRelay()
  const context: ScenarioContext = {
    relay,
    actors: {
      alice: await bootstrapActor("alice-device-1", relay),
      bob: await bootstrapActor("bob-device-1", relay),
    },
  }

  for (const step of def.steps) {
    switch (step.type) {
      case "send":
        await sendMessage(context, step.from, step.to, step.message)
        break
      case "expect":
        await expectMessage(context, step.actor, step.message)
        break
      case "expectAll":
        await expectAllMessages(context, step.actor, step.messages)
        break
      case "close":
        closeActor(context, step.actor)
        break
      case "restart":
        await restartActor(context, step.actor)
        break
      case "noop":
        await Promise.resolve()
        break
      default:
        const exhaustive: never = step
        throw new Error(`Unhandled step ${JSON.stringify(exhaustive)}`)
    }
  }

  return context
}

async function bootstrapActor(
  deviceId: string,
  relay: MockRelay,
  existingSecretKey?: Uint8Array,
  existingStorage?: any
): Promise<ActorState> {
  const {
    manager,
    secretKey,
    publicKey,
    mockStorage,
  } = await createMockSessionManager(deviceId, relay, existingSecretKey, existingStorage)

  const events: Rumor[] = []
  const unsub = manager.onEvent((event) => {
    events.push(event)
  })

  return {
    deviceId,
    manager,
    secretKey,
    publicKey,
    storage: mockStorage,
    events,
    unsub,
  }
}

async function sendMessage(
  context: ScenarioContext,
  from: ActorId,
  to: ActorId,
  message: string
) {
  const sender = context.actors[from]
  const recipient = context.actors[to]
  await sender.manager.sendMessage(recipient.publicKey, message)
}

async function expectMessage(context: ScenarioContext, actor: ActorId, message: string) {
  const state = context.actors[actor]
  const existing = state.events.find((event) => event.content === message)
  if (existing) return
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Timed out waiting for message '${message}' on ${actor}`)),
      5000
    )
    const check = () => {
      if (state.events.some((event) => event.content === message)) {
        clearTimeout(timeout)
        resolve()
      } else {
        setTimeout(check, 10)
      }
    }
    check()
  })
}

async function expectAllMessages(
  context: ScenarioContext,
  actor: ActorId,
  messages: string[]
) {
  console.log(`\n\n\nExpecting all messages on ${actor}:`, messages)
  for (const msg of messages) {
    await expectMessage(context, actor, msg)
  }
}

function closeActor(context: ScenarioContext, actor: ActorId) {
  const state = context.actors[actor]
  state.unsub?.()
  state.manager.close()
}

async function restartActor(context: ScenarioContext, actor: ActorId) {
  const state = context.actors[actor]
  const {deviceId, manager, secretKey, storage, events, unsub} = state
  unsub?.()
  manager.close()
  const {
    manager: newManager,
  } = await createMockSessionManager(deviceId, context.relay, secretKey, storage)

  const newEvents = events.slice()
  const newUnsub = newManager.onEvent((event) => {
    newEvents.push(event)
  })

  context.actors[actor] = {
    ...state,
    manager: newManager,
    events: newEvents,
    unsub: newUnsub,
  }
}
