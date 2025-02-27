export const formatAmount = (n: number) => {
  if (n < 1000) return n + " "
  if (n < 1000000) return (n / 1000).toFixed(2).replace(".00", "") + "K "
  return (n / 1000000).toFixed(2).replace(".00", "") + "M "
}
