export async function onRequest(context) {
  // zawsze serwuj /auth/index.html dla wszystkiego pod /auth/*
  const url = new URL('/auth/index.html', context.request.url);
  return context.env.ASSETS.fetch(new Request(url, context.request));
}
