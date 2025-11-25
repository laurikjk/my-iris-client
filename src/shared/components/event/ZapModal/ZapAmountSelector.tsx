interface ZapAmountSelectorProps {
  amounts: Record<string, string>
  zapAmount: string
  onAmountChange: (amount: string) => void
}

export function ZapAmountSelector({
  amounts,
  zapAmount,
  onAmountChange,
}: ZapAmountSelectorProps) {
  return (
    <div className="grid grid-cols-4 gap-2 w-full">
      {Object.entries(amounts).map(([amount, emoji]) => (
        <button
          key={amount}
          type="button"
          onClick={() => onAmountChange(amount)}
          className={`btn ${zapAmount === amount ? "btn-primary" : "btn-neutral"} w-full`}
        >
          {emoji} {parseInt(amount) >= 1000 ? `${parseInt(amount) / 1000}K` : amount}
        </button>
      ))}
    </div>
  )
}
