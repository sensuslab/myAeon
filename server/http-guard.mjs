// This application uses JSON routes and direct assets, not Server Actions or
// runtime image optimization. Keep unused framework surfaces off the network.
export function rejectUnusedFrameworkEndpoint(req, res) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { pathname = ''; }
  if (!/^\/_next\/image(?:\/|$)/.test(pathname) && !req.headers['next-action']) return false;
  res.writeHead(404, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
  res.end('Not found');
  return true;
}
