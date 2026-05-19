import { searchWiki } from "../../_lib/wiki/search.js";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const limit = Math.min(
    10,
    Math.max(1, Number(searchParams.get("limit") ?? 3)),
  );
  const toolKey = searchParams.get("toolKey") || null;
  const useWiki = searchParams.get("useWiki") !== "false";

  const { chunks, intent } = await searchWiki(q, { limit, toolKey, useWiki });

  return Response.json(
    { chunks, intent },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    },
  );
}
