import { configureWebAuth } from '@insula/web-auth';

configureWebAuth({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000',
});
