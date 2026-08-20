import { createFileRoute } from "@tanstack/react-router";
import { buildFeed } from "@/lib/rss/buildFeed";

const SITE = "https://crawlers.fr";

export const Route = createFileRoute("/rss.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { xml, count } = await buildFeed(`${SITE}/rss.xml`);
        return new Response(xml, {
          status: 200,
          headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
            "Cache-Control": "public, max-age=900, s-maxage=3600",
            "X-Rss-Count": String(count),
          },
        });
      },
    },
  },
});
