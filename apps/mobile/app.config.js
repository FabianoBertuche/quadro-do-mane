const fs = require('fs');
const path = require('path');

module.exports = () => {
  // google-services.json (Android): usa o EAS file secret em cloud build
  // (GOOGLE_SERVICES_JSON é injetado pelo EAS como caminho para o arquivo),
  // ou o arquivo local em dev/prebuild local.
  const googleServices =
    process.env.GOOGLE_SERVICES_JSON && fs.existsSync(process.env.GOOGLE_SERVICES_JSON)
      ? process.env.GOOGLE_SERVICES_JSON
      : './google-services.json';

  return {
    expo: {
      name: 'Quadro do Manê',
      slug: 'quadro-do-mane',
      version: '1.0.0',
      orientation: 'portrait',
      icon: './assets/images/icon.png',
      scheme: 'quadrodomane',
      userInterfaceStyle: 'dark',
      ios: {
        icon: './assets/expo.icon',
      },
      android: {
        package: 'com.quadrodomane.app',
        googleServicesFile: googleServices,
        adaptiveIcon: {
          backgroundColor: '#0F172A',
          foregroundImage: './assets/images/android-icon-foreground.png',
          backgroundImage: './assets/images/android-icon-background.png',
          monochromeImage: './assets/images/android-icon-monochrome.png',
        },
        predictiveBackGestureEnabled: false,
      },
      web: {
        output: 'static',
        favicon: './assets/images/favicon.png',
      },
      plugins: [
        'expo-router',
        [
          'expo-splash-screen',
          {
            backgroundColor: '#0F172A',
            image: './assets/images/splash-icon.png',
            imageWidth: 76,
          },
        ],
        'expo-secure-store',
        'expo-font',
        'expo-notifications',
        './plugins/withGradleRetry',
      ],
      experiments: {
        typedRoutes: false,
        reactCompiler: true,
      },
      extra: {
        router: {},
        eas: {
          projectId: '5c27f9c8-ada8-4061-acf8-c1032f08ea06',
        },
      },
      owner: 'phalgus',
    },
  };
};
