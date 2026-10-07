// Accept only the original, in-sale Taobao listing imported with this product.
export function taobaoProductUrl(product) {
  const id = product?.external_id;
  if (product?.active !== true || product.source?.source_status !== '在售' ||
      typeof id !== 'string' || !id || /[^0-9]/.test(id)) return '';
  const expected = `https://item.taobao.com/item.htm?id=${id}`;
  return product.source.external_url === expected ? expected : '';
}

export function appendTaobaoPurchase(product, beforeElement) {
  const url = taobaoProductUrl(product);
  if (!url || !beforeElement) return;
  const link = document.createElement('a');
  link.id = 'taobao-buy';
  link.className = 'btn';
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.referrerPolicy = 'no-referrer';
  link.textContent = '前往淘宝购买 ↗';
  link.setAttribute('aria-describedby', 'taobao-purchase-note');
  const note = document.createElement('p');
  note.id = 'taobao-purchase-note';
  note.className = 'small muted';
  note.textContent = '将在淘宝选择规格并下单；价格、规格、库存、支付和售后以淘宝为准。淘宝订单不会自动同步到梨花季。';
  beforeElement.before(link);
  beforeElement.parentElement.after(note);
}
