/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",  // needed for web-push crypto and Next.js hydration
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https://res.cloudinary.com https://*.airtableusercontent.com",
              "connect-src 'self' https://api.airtable.com https://content.airtable.com https://api.cloudinary.com",
              "font-src 'self'",
              "frame-src 'none'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}
module.exports = nextConfig