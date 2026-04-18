export const dynamic = "force-static";

export default function ApiDocsPage() {
  // Swagger UI is loaded from CDN — no extra dep, no bundle weight.
  return (
    <main className="min-h-svh bg-white">
      <div id="swagger-ui" />
      <link
        rel="stylesheet"
        href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css"
      />
      <script
        dangerouslySetInnerHTML={{
          __html: `
            window.addEventListener('load', () => {
              const s = document.createElement('script');
              s.src = 'https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js';
              s.onload = () => {
                window.ui = SwaggerUIBundle({
                  url: '/api/docs',
                  dom_id: '#swagger-ui',
                  deepLinking: true,
                  persistAuthorization: true,
                });
              };
              document.body.appendChild(s);
            });
          `,
        }}
      />
    </main>
  );
}
