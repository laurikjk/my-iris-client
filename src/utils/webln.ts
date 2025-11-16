import type {WebLNProvider} from "@/types/global"
import {createDebugLogger} from "@/utils/createDebugLogger"
import {DEBUG_NAMESPACES} from "@/utils/constants"

const {log, error} = createDebugLogger(DEBUG_NAMESPACES.UTILS)

export interface WebLNWalletBalance {
  amount: number
}

export class SimpleWebLNWallet {
  private provider: WebLNProvider | null = null
  private _balance?: WebLNWalletBalance

  async connect(): Promise<boolean> {
    try {
      if (!window.webln) {
        log("WebLN not available")
        return false
      }

      const webln = window.webln

      // Check if already enabled
      const isEnabled = await webln.isEnabled()
      if (isEnabled) {
        this.provider = webln
        return true
      }

      // Try to enable if method exists
      if (webln.enable) {
        await webln.enable()
      }
      this.provider = webln
      return true
    } catch (err) {
      error("Failed to connect WebLN:", err)
      return false
    }
  }

  async sendPayment(invoice: string): Promise<{preimage?: string}> {
    if (!this.provider) {
      throw new Error("WebLN provider not connected")
    }
    const result = await this.provider.sendPayment(invoice)
    return result || {}
  }

  async makeInvoice(amount: number, description?: string): Promise<{invoice: string}> {
    if (!this.provider || !this.provider.makeInvoice) {
      throw new Error("WebLN provider not connected or makeInvoice not supported")
    }

    const args = description
      ? {amount: amount.toString(), defaultMemo: description}
      : {amount: amount.toString()}

    const result = await this.provider.makeInvoice(args)
    return {invoice: result.paymentRequest}
  }

  async getBalance(): Promise<number | null> {
    if (!this.provider) {
      return null
    }

    try {
      if (this.provider.getBalance) {
        const result = await this.provider.getBalance()
        this._balance = {amount: result.balance || 0}
        return this._balance.amount
      }
      return null
    } catch (err) {
      error("Failed to get WebLN balance:", err)
      return null
    }
  }

  async updateBalance(): Promise<void> {
    await this.getBalance()
  }

  get balance(): WebLNWalletBalance | undefined {
    return this._balance
  }

  get isConnected(): boolean {
    return !!this.provider
  }
}
