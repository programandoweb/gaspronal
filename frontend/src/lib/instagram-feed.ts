export type InstagramFeedPost = {
  id: string;
  caption: string;
  mediaType: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  imageUrl: string | null;
  permalink: string;
  timestamp: string;
};

type GraphMedia = {
  id?: unknown;
  caption?: unknown;
  media_type?: unknown;
  media_product_type?: unknown;
  media_url?: unknown;
  thumbnail_url?: unknown;
  permalink?: unknown;
  timestamp?: unknown;
  children?: { data?: GraphMedia[] };
};

const INSTAGRAM_PROFILE = "https://www.instagram.com/gaspronal/";
const GRAPH_VERSION = "v25.0";

function safeHttps(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function instagramPermalink(value: unknown): string {
  const url = safeHttps(value);
  if (!url) return INSTAGRAM_PROFILE;
  const host = new URL(url).hostname;
  return host === "instagram.com" || host === "www.instagram.com" ? url : INSTAGRAM_PROFILE;
}

function coverOf(media: GraphMedia): string | null {
  if (media.media_type === "VIDEO") return safeHttps(media.thumbnail_url);
  if (media.media_type === "IMAGE") return safeHttps(media.media_url);
  if (media.media_type !== "CAROUSEL_ALBUM") return null;
  const children = Array.isArray(media.children?.data) ? media.children.data : [];
  for (const child of children) {
    const cover = coverOf(child);
    if (cover) return cover;
  }
  return safeHttps(media.media_url);
}

/**
 * Meta Instagram Graph API: las seis últimas publicaciones, no Stories.
 * Las credenciales se conservan exclusivamente en el servidor.
 */
export async function getInstagramFeed(): Promise<InstagramFeedPost[]> {
  const userId = process.env.INSTAGRAM_IG_USER_ID?.trim();
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
  const host = process.env.INSTAGRAM_GRAPH_HOST === "graph.instagram.com"
    ? "graph.instagram.com"
    : "graph.facebook.com";
  if (!userId || !/^\d+$/.test(userId) || !accessToken) return [];

  const url = new URL("https://" + host + "/" + GRAPH_VERSION + "/" + userId + "/media");
  url.searchParams.set(
    "fields",
    "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,children{media_type,media_url,thumbnail_url}"
  );
  url.searchParams.set("limit", "24");

  try {
    const response = await fetch(url.toString(), {
      headers: { Authorization: "Bearer " + accessToken, Accept: "application/json" },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return [];
    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || !("data" in result)) return [];
    const data = (result as { data?: unknown }).data;
    if (!Array.isArray(data)) return [];

    return (data as GraphMedia[])
      .flatMap((item): InstagramFeedPost[] => {
        const mediaType = item.media_type;
        if (
          typeof item.id !== "string" ||
          (mediaType !== "IMAGE" && mediaType !== "VIDEO" && mediaType !== "CAROUSEL_ALBUM") ||
          item.media_product_type === "STORY" ||
          typeof item.timestamp !== "string" ||
          !Number.isFinite(Date.parse(item.timestamp))
        ) return [];

        return [{
          id: item.id,
          caption: typeof item.caption === "string" ? item.caption.trim() : "",
          mediaType,
          imageUrl: coverOf(item),
          permalink: instagramPermalink(item.permalink),
          timestamp: item.timestamp,
        }];
      })
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
      .slice(0, 6);
  } catch {
    // Si Meta falla o el token caduca, la página pública sigue funcionando.
    return [];
  }
}
