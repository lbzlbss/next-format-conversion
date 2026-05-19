import { loadWikiIndex } from "../../_lib/wiki/load-index.js";

export async function GET() {
  const index = await loadWikiIndex();
  const articles = (index.articles || []).map(
    ({ slug, title, category, tags, toolKey, updatedAt, description }) => ({
      slug,
      title,
      category,
      tags,
      toolKey,
      updatedAt,
      description,
    }),
  );

  return Response.json(
    { categories: index.categories || [], articles, builtAt: index.builtAt },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
