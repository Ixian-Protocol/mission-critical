import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ixianprotocol.missioncritical',
  appName: 'Mission Critical',
  webDir: 'build',
  // Cleartext + mixed content: intentional for LAN/homelab HTTP sync (e.g. http://192.168.x.x:3000).
  server: {
    androidScheme: 'http',
    cleartext: true,
  },
  android: {
    allowMixedContent: true
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#008080'
    }
  }
};

export default config;
