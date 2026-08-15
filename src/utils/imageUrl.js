export function optimizeImageUrl(url, width = 300) {
  if (!url) return null;
  const value = String(url);

  if (value.includes('image.tmdb.org')) {
    return value.replace(/\/t\/p\/(?:w\d+|original)\//, `/t/p/w${width}/`);
  }

  if (value.includes('upload.wikimedia.org')) {
    return value.replace(/\/\d+px-([^/]+)$/, `/${width}px-$1`);
  }

  return value;
}
