import "server-only";
import { backendFetch } from "@/lib/backend";

export type InstagramFeedPost = {
  id: string;
  caption: string;
  mediaType: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  imageUrl: string | null;
  permalink: string;
  timestamp: string;
};

/** Solo recibe medios publicados; Laravel mantiene y cifra las credenciales Meta. */
export async function getInstagramFeed(): Promise<InstagramFeedPost[]> {
  try {
    const response = await backendFetch("/public/instagram/feed", {
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) return [];

    const payload = (await response.json()) as { data?: InstagramFeedPost[] };
    if (!Array.isArray(payload.data)) return [];

    return payload.data.slice(0, 6);
  } catch {
    return [];
  }
}
