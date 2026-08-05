const embedProviders = [];

export function registerEmbedProvider(provider) {
  embedProviders.push(provider);
}

export function getEmbedProvider(url) {
  return embedProviders.find(p => p.test(url));
}