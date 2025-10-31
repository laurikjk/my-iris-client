import type {IdbDb} from "./db.ts"

export async function ensureSchema(db: IdbDb): Promise<void> {
  // Dexie schema with final versioned stores (flattened for first release)
  db.version(1).stores({
    coco_cashu_mints: "&mintUrl, name, updatedAt",
    coco_cashu_keysets: "&[mintUrl+id], mintUrl, id, updatedAt",
    coco_cashu_counters: "&[mintUrl+keysetId]",
    coco_cashu_proofs:
      "&[mintUrl+secret], [mintUrl+state], [mintUrl+id+state], state, mintUrl, id",
    coco_cashu_mint_quotes: "&[mintUrl+quote], state, mintUrl",
    coco_cashu_melt_quotes: "&[mintUrl+quote], state, mintUrl",
    coco_cashu_history: "++id, mintUrl, type, createdAt, [mintUrl+quoteId+type]",
  })

  // Version 2: Add unit field to keysets
  db.version(2)
    .stores({
      coco_cashu_keysets: "&[mintUrl+id], mintUrl, id, unit, updatedAt",
    })
    .upgrade(async (tx) => {
      // Set default unit to "sat" for existing keysets
      await tx
        .table("coco_cashu_keysets")
        .toCollection()
        .modify((keyset: any) => {
          if (!keyset.unit) {
            keyset.unit = "sat"
          }
        })
    })
}
