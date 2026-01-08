import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.soundmaps.app',
  appName: 'SoundMaps',
  webDir: 'dist',
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '110719598768-724clecd5u9e25o30ase5thouc1t5ptg.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
