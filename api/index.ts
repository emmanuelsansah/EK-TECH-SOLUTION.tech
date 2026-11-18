import app from '../server.ts';

function resolveApiUrl(req: any): string {
  const rawUrl = String(req.url || '/');
  const queryIdx = rawUrl.indexOf('?');
  const rawPath = queryIdx >= 0 ? rawUrl.slice(0, queryIdx) : rawUrl;
  const rawQuery = queryIdx >= 0 ? rawUrl.slice(queryIdx + 1) : '';
  const searchParams = new URLSearchParams(rawQuery);

  const rewrittenApiPath = searchParams.get('__api_path');
  if (rewrittenApiPath) {
    searchParams.delete('__api_path');
    const cleanPath = rewrittenApiPath.startsWith('/api')
      ? rewrittenApiPath
      : '/api' + (rewrittenApiPath.startsWith('/') ? rewrittenApiPath : '/' + rewrittenApiPath);
    const qs = searchParams.toString();
    return qs ? `${cleanPath}?${qs}` : cleanPath;
  }

  const originalUrl = typeof req.originalUrl === 'string' ? req.originalUrl : '';
  if (originalUrl.startsWith('/api/') && !originalUrl.startsWith('/api/[...')) {
    return originalUrl;
  }

  const isPlaceholderPath =
    rawPath === '/api' ||
    rawPath === '/api/index' ||
    rawPath.startsWith('/api/[...');

  if (!isPlaceholderPath && rawPath.startsWith('/api/')) {
    return rawUrl;
  }

  return rawPath.startsWith('/api') ? rawUrl : `/api${rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`}`;
}

export default function handler(req: any, res: any) {
  req.url = resolveApiUrl(req);
  return app(req, res);
}
