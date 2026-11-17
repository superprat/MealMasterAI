// Also applied to static files on Vercel (script/build-vercel.mjs)
export const CONTENT_SECURITY_POLICY: Record<string, string[]> & { formAction: string[] } = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
  imgSrc: ["'self'", "data:", "https:"],
  connectSrc: ["'self'"],
  // Recipe how-to videos (cookie-free YouTube embed)
  frameSrc: ["https://www.youtube-nocookie.com"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
};
