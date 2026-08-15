export function moveDifferentItemFirst(items, currentItem, isSameItem) {
  if (!Array.isArray(items) || items.length < 2 || !currentItem) return items;

  const differentIndex = items.findIndex((item) => !isSameItem(item, currentItem));
  if (differentIndex <= 0) return items;

  return [
    ...items.slice(differentIndex),
    ...items.slice(0, differentIndex),
  ];
}

export function moveFreshItemFirst(items, currentItem, recentKeys, isSameItem, getItemKey) {
  if (!Array.isArray(items) || items.length < 2 || !currentItem) return items;

  const recent = new Set(recentKeys || []);
  const freshIndex = items.findIndex((item) => (
    !isSameItem(item, currentItem) && !recent.has(getItemKey(item))
  ));
  if (freshIndex > 0) {
    return [...items.slice(freshIndex), ...items.slice(0, freshIndex)];
  }

  return moveDifferentItemFirst(items, currentItem, isSameItem);
}
