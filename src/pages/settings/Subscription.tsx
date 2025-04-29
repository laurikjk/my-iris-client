import {useSubscriptionStatus} from "@/shared/hooks/useSubscriptionStatus"
import {SubscriberBadge} from "@/shared/components/user/SubscriberBadge"
import {RiCheckboxCircleFill} from "@remixicon/react"
import {useEffect, useState} from "react"

function Subscription() {
  const [pubkey, setPubkey] = useState<string | undefined>(undefined)
  const {isSubscriber, isLoading} = useSubscriptionStatus(pubkey)
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly")

  useEffect(() => {
    // Get the user's pubkey from local storage
    const getPubkey = async () => {
      const storedPubkey = localStorage.getItem("user/publicKey")
      if (storedPubkey) {
        setPubkey(storedPubkey)
      }
    }
    getPubkey()
  }, [])

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        {!isLoading && pubkey && isSubscriber && <SubscriberBadge pubkey={pubkey} />}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          {isLoading && (
            <span className="text-sm text-gray-500">Loading subscription status...</span>
          )}
        </div>
      </div>

      <div className="divider">Subscription Plans</div>

      <div className="flex justify-center mb-4">
        <div className="join">
          <input
            className="join-item btn btn-sm"
            type="radio"
            name="billing"
            aria-label="Monthly"
            checked={billingPeriod === "monthly"}
            onChange={() => setBillingPeriod("monthly")}
          />
          <input
            className="join-item btn btn-sm"
            type="radio"
            name="billing"
            aria-label="Yearly (Save 16.67%)"
            checked={billingPeriod === "yearly"}
            onChange={() => setBillingPeriod("yearly")}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body flex flex-col h-full">
            <h3 className="card-title text-xl">Supporter</h3>
            <div className="text-3xl font-bold my-2">
              {billingPeriod === "yearly" ? "$50" : "$5"}
              <span className="text-sm font-normal">
                /{billingPeriod === "yearly" ? "year" : "month"}
              </span>
            </div>
            <ul className="space-y-2 my-4">
              <li className="flex items-center gap-2">
                <RiCheckboxCircleFill className="h-5 w-5 text-success flex-shrink-0" />
                <span>Support Iris development</span>
              </li>
              <li className="flex items-center gap-2">
                <RiCheckboxCircleFill className="h-5 w-5 text-success flex-shrink-0" />
                <span>Supporter badge on profile</span>
              </li>
              <li className="flex items-center gap-2">
                <RiCheckboxCircleFill className="h-5 w-5 text-success flex-shrink-0" />
                <span>Yearly subscriber badge</span>
              </li>
              <li className="flex items-center gap-2">
                <RiCheckboxCircleFill className="h-5 w-5 text-success flex-shrink-0" />
                <span>6-7 character username</span>
              </li>
            </ul>
            <div className="card-actions justify-end mt-auto pt-4">
              <a
                href={`https://iris.to/subscribe/supporter?billing=${billingPeriod}`}
                className="btn btn-primary"
              >
                Subscribe
              </a>
            </div>
          </div>
        </div>

        <div className="card bg-base-200 shadow-xl border-2 border-warning">
          <div className="card-body flex flex-col h-full">
            <h3 className="card-title text-xl">Premium</h3>
            <div className="text-3xl font-bold my-2">
              {billingPeriod === "yearly" ? "$200" : "$20"}
              <span className="text-sm font-normal">
                /{billingPeriod === "yearly" ? "year" : "month"}
              </span>
            </div>
            <ul className="space-y-2 my-4">
              <li className="flex items-center gap-2">
                <RiCheckboxCircleFill className="h-5 w-5 text-success flex-shrink-0" />
                <span>All Supporter benefits</span>
              </li>
              <li className="flex items-center gap-2">
                <RiCheckboxCircleFill className="h-5 w-5 text-success flex-shrink-0" />
                <span>Premium badge on profile</span>
              </li>
              <li className="flex items-center gap-2">
                <RiCheckboxCircleFill className="h-5 w-5 text-success flex-shrink-0" />
                <span>Priority support</span>
              </li>
              <li className="flex items-center gap-2">
                <RiCheckboxCircleFill className="h-5 w-5 text-success flex-shrink-0" />
                <span>5-6 character username</span>
              </li>
              <li className="flex items-center gap-2">
                <RiCheckboxCircleFill className="h-5 w-5 text-success flex-shrink-0" />
                <span>More features upcoming</span>
              </li>
            </ul>
            <div className="card-actions justify-end mt-auto pt-4">
              <a
                href={`https://iris.to/subscribe/premium?billing=${billingPeriod}`}
                className="btn btn-warning"
              >
                Subscribe
              </a>
            </div>
          </div>
        </div>

        <div className="card bg-base-200 shadow-xl border-2 border-error">
          <div className="card-body flex flex-col h-full">
            <h3 className="card-title text-xl">Ultra</h3>
            <div className="text-3xl font-bold my-2">
              {billingPeriod === "yearly" ? "$1000" : "$100"}
              <span className="text-sm font-normal">
                /{billingPeriod === "yearly" ? "year" : "month"}
              </span>
            </div>
            <ul className="space-y-2 my-4">
              <li className="flex items-center gap-2">
                <RiCheckboxCircleFill className="h-5 w-5 text-success flex-shrink-0" />
                <span>All Premium benefits</span>
              </li>
              <li className="flex items-center gap-2">
                <RiCheckboxCircleFill className="h-5 w-5 text-success flex-shrink-0" />
                <span>Ultra badge on profile</span>
              </li>
              <li className="flex items-center gap-2">
                <RiCheckboxCircleFill className="h-5 w-5 text-success flex-shrink-0" />
                <span>VIP support</span>
              </li>
              <li className="flex items-center gap-2">
                <RiCheckboxCircleFill className="h-5 w-5 text-success flex-shrink-0" />
                <span>Honorary mention on About page</span>
              </li>
              <li className="flex items-center gap-2">
                <RiCheckboxCircleFill className="h-5 w-5 text-success flex-shrink-0" />
                <span>3-4 character username</span>
              </li>
              <li className="flex items-center gap-2">
                <RiCheckboxCircleFill className="h-5 w-5 text-success flex-shrink-0" />
                <span>More features upcoming</span>
              </li>
            </ul>
            <div className="card-actions justify-end mt-auto pt-4">
              <a
                href={`https://iris.to/subscribe/ultra?billing=${billingPeriod}`}
                className="btn btn-error"
              >
                Subscribe
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Subscription
