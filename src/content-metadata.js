function getMetaContent(selector) {
  /** @type {HTMLMetaElement|null} */
  const node = document.querySelector(selector);
  return node?.content?.trim() || null;
}

function getMetaByName(name) {
  return getMetaContent(`meta[name="${name}"]`);
}

function getMetaByProperty(property) {
  return getMetaContent(`meta[property="${property}"]`);
}

function getAllMetaByProperty(property) {
  return Array.from(document.querySelectorAll(`meta[property="${property}"]`))
    .map((node) => /** @type {HTMLMetaElement} */ (node)?.content?.trim())
    .filter(Boolean);
}

function parseJsonLdPublishedDate() {
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));

  for (const script of scripts) {
    try {
      const raw = script.textContent?.trim();
      if (!raw) {
        continue;
      }

      const parsed = JSON.parse(raw);
      const stack = Array.isArray(parsed) ? [...parsed] : [parsed];

      while (stack.length > 0) {
        const item = stack.pop();
        if (!item || typeof item !== "object") {
          continue;
        }

        if (item.datePublished) {
          return String(item.datePublished);
        }

        if (item.uploadDate) {
          return String(item.uploadDate);
        }

        if (Array.isArray(item["@graph"])) {
          stack.push(...item["@graph"]);
        }
      }
    } catch (_error) {
      continue;
    }
  }

  return null;
}

function getPublishedAt() {
  const candidates = [
    getMetaContent('meta[property="article:published_time"]'),
    getMetaContent('meta[name="article:published_time"]'),
    getMetaContent('meta[name="pubdate"]'),
    getMetaContent('meta[name="publish-date"]'),
    getMetaContent('meta[itemprop="datePublished"]'),
    parseJsonLdPublishedDate(),
    document.querySelector("time[datetime]")?.getAttribute("datetime") || null
  ];

  for (const value of candidates) {
    if (!value) {
      continue;
    }

    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return null;
}

function deriveTitleFromUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const fileParam = parsed.searchParams.get("file");
    const candidate = fileParam ? decodeURIComponent(fileParam) : rawUrl;
    const inner = new URL(candidate, rawUrl);
    const segment = inner.pathname.split("/").filter(Boolean).pop();
    return segment || inner.hostname || null;
  } catch (_error) {
    return null;
  }
}

export function getPageMetadata() {
  /** @type {HTMLLinkElement|null} */
  const canonicalNode = document.querySelector('link[rel="canonical"]');
  /** @type {HTMLLinkElement|null} */
  const ampNode = document.querySelector('link[rel="amphtml"]');
  /** @type {HTMLLinkElement|null} */
  const iconNode = document.querySelector('link[rel="icon"]');
  /** @type {HTMLLinkElement|null} */
  const shortcutIconNode = document.querySelector('link[rel="shortcut icon"]');

  const canonicalUrl = canonicalNode?.href || null;
  const ampUrl = ampNode?.href || null;
  const favicon = iconNode?.href || shortcutIconNode?.href || null;

  const description =
    getMetaByName("description") ||
    getMetaByProperty("og:description") ||
    getMetaByName("twitter:description");

  const author = getMetaByName("author") || getMetaByProperty("article:author");
  const keywordsRaw = getMetaByName("keywords");
  const ogTitle = getMetaByProperty("og:title");
  const siteName = getMetaByProperty("og:site_name");
  const twitterTitle = getMetaByName("twitter:title");
  const articlePublishedTime = getMetaByProperty("article:published_time");
  const articleModifiedTime = getMetaByProperty("article:modified_time");
  const articleSection = getMetaByProperty("article:section");
  const articleTags = getAllMetaByProperty("article:tag");
  const contentLanguage = getMetaContent('meta[http-equiv="content-language"]');
  const resolvedTitle =
    (document.title && document.title.trim()) ||
    ogTitle ||
    twitterTitle ||
    deriveTitleFromUrl(window.location.href) ||
    "Untitled";

  const keywords = keywordsRaw
    ? keywordsRaw
        .split(/[,;]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    : null;

  return {
    url: window.location.href,
    title: resolvedTitle,
    site: window.location.hostname || null,
    language: document.documentElement.lang || null,
    publishedAt: getPublishedAt(),
    metadata: {
      canonicalUrl,
      ampUrl,
      favicon,
      description,
      author,
      keywords,
      siteName,
      articlePublishedTime,
      articleModifiedTime,
      articleSection,
      articleTags: articleTags.length ? articleTags : null,
      contentLanguage,
      documentContentType: document.contentType || null
    }
  };
}
