const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

const blockList = [
  /admin-dashboard[\\/]\.next[\\/].*/,
  /admin-dashboard[\\/]node_modules[\\/].*/,
  /admin-dashboard[\\/]out[\\/].*/,
  /server[\\/]notification-worker[\\/]node_modules[\\/].*/,
  /server[\\/]notification-worker[\\/]lib[\\/].*/,
  /server[\\/]notification-worker[\\/]data[\\/].*/,
].map((pattern) => new RegExp(pattern.source));

config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
      ? [config.resolver.blockList]
      : []),
  ...blockList,
];

config.watchFolders = (config.watchFolders ?? []).filter(
  (folder) => !path.resolve(folder).includes(`${path.sep}admin-dashboard`)
);

module.exports = withNativeWind(config, { input: './global.css' });
