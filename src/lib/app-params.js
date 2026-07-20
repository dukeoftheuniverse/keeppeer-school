// Standalone app params — no Base44 app id or shared token.
export const appParams = {
  appId: 'standalone',
  token: '',
  fromUrl: typeof window !== 'undefined' ? window.location.href : '',
  functionsVersion: 'v1',
  appBaseUrl: '',
};