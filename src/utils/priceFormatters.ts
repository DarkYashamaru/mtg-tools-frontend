const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

export function formatUsdPrice(price: number) {
  return `${usdFormatter.format(price)} USD`
}

export function formatCopPrice(price: number) {
  return `${copFormatter.format(price)} COP`
}
