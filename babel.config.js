// Babel config: the React Native preset, path aliases and `.env` inlining.
const moduleResolver = [
  'module-resolver',
  {
    root: ['./src'],
    extensions: [
      '.android.ts',
      '.ts',
      '.android.tsx',
      '.tsx',
      '.jsx',
      '.js',
      '.json',
    ],
    alias: {
      '@': './src',
      '@components': './src/components',
      '@screens': './src/screens',
      '@navigation': './src/navigation',
      '@store': './src/store',
      '@hooks': './src/hooks',
      '@utils': './src/utils',
      '@constants': './src/constants',
      '@types': './src/types',
      '@api': './src/api',
      '@services': './src/services',
      '@assets': './src/assets',
    },
  },
];

const dotenv = [
  'module:react-native-dotenv',
  {
    envName: 'APP_ENV',
    moduleName: '@env',
    path: '.env',
    safe: false,
    allowUndefined: true,
  },
];

module.exports = api => {
  // Under Jest, `@env` resolves to `__mocks__/@env.js` (see jest.config.js).
  // The dotenv plugin would inline the developer's own `.env` instead, so
  // tests would pass or fail depending on a file that is not committed.
  const isTest = api.env('test');

  return {
    presets: ['module:@react-native/babel-preset'],
    plugins: isTest ? [moduleResolver] : [moduleResolver, dotenv],
  };
};
