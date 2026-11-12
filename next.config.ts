import type { NextConfig } from 'next';
const config: NextConfig = {output:'export',allowedDevOrigins:['127.0.0.1'],distDir:process.env.NODE_ENV==='development'?'.next-dev':'.next',trailingSlash:true,images:{unoptimized:true}};
export default config;
