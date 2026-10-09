// Next's custom server can construct Request.url from the bind address. Compare
// the Origin against the actual incoming Host instead of that internal address.
export function sameRequestOrigin(req: Request) {
  try {
    const origin = new URL(req.headers.get('origin') || '');
    return ['http:', 'https:'].includes(origin.protocol) && origin.host === (req.headers.get('host') || new URL(req.url).host);
  } catch { return false; }
}
