/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Leaflet needs transpilation
  transpilePackages: ['leaflet', 'react-leaflet'],
}

module.exports = nextConfig