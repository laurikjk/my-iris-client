interface MarketListingFieldsProps {
  title: string
  price: {
    amount: string
    currency: string
    frequency?: string
  }
  onTitleChange: (title: string) => void
  onPriceChange: (price: {amount: string; currency: string; frequency?: string}) => void
  disabled: boolean
}

export function MarketListingFields({
  title,
  price,
  onTitleChange,
  onPriceChange,
  disabled,
}: MarketListingFieldsProps) {
  return (
    <div className="space-y-2 mb-3">
      <input
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Listing title"
        className="input input-sm input-bordered w-full"
        disabled={disabled}
      />
      <div className="flex gap-2">
        <input
          type="text"
          value={price.amount}
          onChange={(e) => onPriceChange({...price, amount: e.target.value})}
          placeholder="Price"
          className="input input-sm input-bordered flex-1"
          disabled={disabled}
        />
        <select
          value={price.currency}
          onChange={(e) => onPriceChange({...price, currency: e.target.value})}
          className="select select-sm select-bordered w-24"
          disabled={disabled}
        >
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
          <option value="BTC">BTC</option>
          <option value="SATS">SATS</option>
        </select>
        <input
          type="text"
          value={price.frequency || ""}
          onChange={(e) => onPriceChange({...price, frequency: e.target.value})}
          placeholder="per..."
          className="input input-sm input-bordered w-24"
          disabled={disabled}
        />
      </div>
    </div>
  )
}
