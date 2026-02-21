export function parseYouTubeVideoId(rawUrl) {
  if (!rawUrl) {
    return null;
  }
  try {
    const url = new URL(rawUrl);
    const hostname = (url.hostname || "").toLowerCase();

    if (hostname === "youtu.be") {
      return url.pathname.split("/").filter(Boolean)[0] || null;
    }

    if (!(hostname === "youtube.com" || hostname.endsWith(".youtube.com"))) {
      return null;
    }

    if (url.pathname === "/watch") {
      return url.searchParams.get("v");
    }

    if (url.pathname.startsWith("/shorts/")) {
      return url.pathname.split("/")[2] || null;
    }

    if (url.pathname.startsWith("/live/")) {
      return url.pathname.split("/")[2] || null;
    }

    if (url.pathname.startsWith("/embed/")) {
      return url.pathname.split("/")[2] || null;
    }

    return null;
  } catch (_error) {
    return null;
  }
}

export function isYouTubeVideoUrl(rawUrl) {
  return Boolean(parseYouTubeVideoId(rawUrl));
}
