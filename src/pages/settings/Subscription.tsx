import {useSubscriptionStatus} from "@/shared/hooks/useSubscriptionStatus"
import {SubscriberBadge} from "@/shared/components/user/SubscriberBadge"
import {getSubscriptionIcon} from "@/shared/utils/subscriptionIcons"
import {useLocalState} from "irisdb-hooks/src/useLocalState"
import {RiCheckboxCircleFill} from "@remixicon/react"
import {useState} from "react"

function Subscription() {
  const [pubkey] = useLocalState("user/publicKey", "")
  const {isSubscriber, isLoading} = useSubscriptionStatus(pubkey)
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly")

  return (
    <div className="flex flex-col gap-4 p-4">
      {!isLoading && pubkey && isSubscriber && (
        <div className="flex flex-col justify-center items-center gap-2 w-full">
          <SubscriberBadge pubkey={pubkey} />
          <div>Thank you for supporting Iris!</div>
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Loading subscription status...</span>
          </div>
        </div>
      )}

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
            <div className="flex justify-between items-start">
              <h3 className="card-title text-xl">Patron</h3>
              {getSubscriptionIcon("patron", "text-warning text-2xl")}
            </div>
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
                <span>Patron badge on profile</span>
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
                href={`https://iris.to/subscribe/patron?billing=${billingPeriod}`}
                className="btn btn-primary"
              >
                Subscribe
              </a>
            </div>
          </div>
        </div>

        <div className="card bg-base-200 shadow-xl border-2 border-warning">
          <div className="card-body flex flex-col h-full">
            <div className="flex justify-between items-start">
              <h3 className="card-title text-xl">Champion</h3>
              {getSubscriptionIcon("champion", "text-warning text-2xl")}
            </div>
            <div className="text-3xl font-bold my-2">
              {billingPeriod === "yearly" ? "$200" : "$20"}
              <span className="text-sm font-normal">
                /{billingPeriod === "yearly" ? "year" : "month"}
              </span>
            </div>
            <ul className="space-y-2 my-4">
              <li className="flex items-center gap-2">
                <RiCheckboxCircleFill className="h-5 w-5 text-success flex-shrink-0" />
                <span>All Patron benefits</span>
              </li>
              <li className="flex items-center gap-2">
                <RiCheckboxCircleFill className="h-5 w-5 text-success flex-shrink-0" />
                <span>Champion badge on profile</span>
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
                href={`https://iris.to/subscribe/champion?billing=${billingPeriod}`}
                className="btn btn-warning"
              >
                Subscribe
              </a>
            </div>
          </div>
        </div>

        <div className="card bg-base-200 shadow-xl border-2 border-error">
          <div className="card-body flex flex-col h-full">
            <div className="flex justify-between items-start">
              <h3 className="card-title text-xl">Vanguard</h3>
              {getSubscriptionIcon("vanguard", "text-error text-2xl")}
            </div>
            <div className="text-3xl font-bold my-2">
              {billingPeriod === "yearly" ? "$1000" : "$100"}
              <span className="text-sm font-normal">
                /{billingPeriod === "yearly" ? "year" : "month"}
              </span>
            </div>
            <ul className="space-y-2 my-4">
              <li className="flex items-center gap-2">
                <RiCheckboxCircleFill className="h-5 w-5 text-success flex-shrink-0" />
                <span>All Champion benefits</span>
              </li>
              <li className="flex items-center gap-2">
                <RiCheckboxCircleFill className="h-5 w-5 text-success flex-shrink-0" />
                <span>Vanguard badge on profile</span>
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
                href={`https://iris.to/subscribe/vanguard?billing=${billingPeriod}`}
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
