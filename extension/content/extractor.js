// Content script: extracts page data for Travel Together extension.
//
// Spec: docs/extension/spec.md (Section 3)
//
// @implements REQ-EXT-002

/**
 * extract reads images, title, URL, and text content from the current page
 * and sends the result to the background service worker.
 *
 * @implements REQ-EXT-002, SCN-EXT-002-01
 */
function extract() {
  // 1. Images
  const images = [];

  // og:image first
  const ogImage = document.querySelector('meta[property="og:image"]')?.content;
  if (ogImage) {
    images.push({ url: ogImage, source: 'og:image', area: Infinity });
  }

  // All images on page, sorted by pixel area
  const allImages = Array.from(document.querySelectorAll('img'))
    .filter(img => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      return w >= 200 && h >= 200;  // minimum threshold
    })
    .map(img => ({
      url: img.src,
      source: 'page',
      area: (img.naturalWidth || img.width) * (img.naturalHeight || img.height)
    }))
    .sort((a, b) => b.area - a.area);

  // Deduplicate by URL, take top 4 page images
  const seen = new Set(images.map(i => i.url));
  for (const img of allImages) {
    if (!seen.has(img.url) && images.length < 5) {
      seen.add(img.url);
      images.push(img);
    }
  }

  // 2. Title + URL
  const title = document.querySelector('meta[property="og:title"]')?.content
    || document.title;
  const url = document.querySelector('link[rel="canonical"]')?.href
    || window.location.href;

  // 3. Text content
  const ogDesc = document.querySelector('meta[property="og:description"]')?.content || '';
  const bodyText = document.body.innerText
    .replace(/\s+/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 500)
    .join(' ');
  const textContent = (ogDesc.slice(0, 500) + '\n\n' + bodyText).trim();

  chrome.runtime.sendMessage({
    action: 'extractionResult',
    data: {
      images,      // Array of { url, source, area }
      title,       // string
      pageUrl: url, // string
      domain: new URL(url).hostname.replace('www.', ''),
      textContent  // string (og:description + body text, max ~500 words)
    }
  });
}

extract();
