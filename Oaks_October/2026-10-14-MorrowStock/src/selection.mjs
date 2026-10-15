// A controlled native select and the submitted SKU must resolve identically.
export function resolveSku(orders, requested) {
  const options = [...new Set(orders.map(order => String(order.sku)))];
  return options.includes(requested) ? requested : (options[0] ?? '');
}
