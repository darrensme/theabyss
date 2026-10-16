import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// the live address. Change this if the domain ever changes:
// it feeds the sitemap, robots.txt and the link-preview tags in index.html
const SITE_URL = 'https://theabyssme.com';

// writes /sitemap.xml and /robots.txt (and serves them in dev),
// and fills %SITE_URL% in index.html
function seo() {
  const files = () => ({
    'sitemap.xml': `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>
  </url>
</urlset>
`,
    'robots.txt': `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`
  });
  return {
    name: 'abyss-seo',
    transformIndexHtml: html => html.replaceAll('%SITE_URL%', SITE_URL),
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const body = files()[req.url?.slice(1)];
        if (!body) return next();
        res.setHeader('Content-Type', req.url.endsWith('.xml') ? 'application/xml' : 'text/plain');
        res.end(body);
      });
    },
    generateBundle() {
      for (const [fileName, source] of Object.entries(files())) this.emitFile({ type: 'asset', fileName, source });
    }
  };
}

export default defineConfig({
  plugins: [react(), seo()],
  // host: true → also reachable from your phone on the same Wi-Fi
  server: { host: true },
  // three.js alone is ~600 kB; that's expected for a WebGL site
  build: { chunkSizeWarningLimit: 1200 }
});
