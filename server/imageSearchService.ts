export interface ImageSearchResult {
  images: string[];
  source: "search" | "ai_suggested" | "none";
  needsReview: boolean;
  searchQuery: string;
}

const COMMODITY_KEYWORDS = [
  "mulch", "topsoil", "soil", "sand", "gravel", "stone dust", "dirt",
  "compost", "bark", "wood chips", "straw", "salt", "ice melt",
  "river rock", "pea gravel", "limestone dust", "mason sand", "fill",
  "screenings", "loam", "clay", "sod",
];

function isCommodityMaterial(name: string): boolean {
  const lower = name.toLowerCase();
  return COMMODITY_KEYWORDS.some((kw) => lower.includes(kw));
}

export async function searchProductImages(
  materialName: string,
  category?: string
): Promise<ImageSearchResult> {
  const isCommodity = isCommodityMaterial(materialName);
  const searchQuery = category
    ? `${materialName} ${category} product photo`
    : `${materialName} landscaping product photo`;

  try {
    const images = await duckDuckGoImageSearch(searchQuery);
    if (images.length >= 2) {
      return { images: images.slice(0, 5), source: "search", needsReview: false, searchQuery };
    }
    if (images.length === 1) {
      return { images, source: "search", needsReview: true, searchQuery };
    }
  } catch (err) {
    console.warn("[image-search] DuckDuckGo failed:", (err as Error).message);
  }

  return {
    images: [],
    source: isCommodity ? "ai_suggested" : "none",
    needsReview: true,
    searchQuery,
  };
}

async function duckDuckGoImageSearch(query: string): Promise<string[]> {
  const encoded = encodeURIComponent(query);
  const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

  const htmlRes = await fetch(`https://duckduckgo.com/?q=${encoded}&iax=images&ia=images`, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(8000),
  });
  const html = await htmlRes.text();

  const vqdMatch = html.match(/vqd=([\d-]+)/);
  if (!vqdMatch) throw new Error("vqd token not found");
  const vqd = vqdMatch[1];

  const imgRes = await fetch(
    `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encoded}&vqd=${vqd}&f=,,,&p=1`,
    {
      headers: {
        "User-Agent": UA,
        Accept: "application/json, text/javascript, */*; q=0.01",
        Referer: "https://duckduckgo.com/",
      },
      signal: AbortSignal.timeout(8000),
    }
  );

  const data = (await imgRes.json()) as any;
  if (!Array.isArray(data?.results)) return [];

  return data.results
    .filter(
      (r: any) =>
        typeof r.image === "string" &&
        r.image.startsWith("http") &&
        !r.image.includes("placeholder") &&
        !r.image.includes("no-image")
    )
    .map((r: any) => r.image as string)
    .slice(0, 6);
}
