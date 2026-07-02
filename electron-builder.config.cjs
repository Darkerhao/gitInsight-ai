const edition = process.env.APP_EDITION === 'standard' ? 'standard' : 'lite';

const editionConfig = {
  lite: {
    appId: 'com.shuzhi.gitinsight-ai.lite',
    productName: 'GitInsight AI Lite',
    artifactLabel: 'Lite',
  },
  standard: {
    appId: 'com.shuzhi.gitinsight-ai',
    productName: 'GitInsight AI Standard',
    artifactLabel: 'Standard',
  },
}[edition];

const artifactBase = `GitInsight-AI-${editionConfig.artifactLabel}-\${version}-\${os}-\${arch}`;

module.exports = {
  appId: editionConfig.appId,
  productName: editionConfig.productName,
  directories: {
    output: `release/\${version}/${edition}`,
  },
  files: ['out/**/*', 'build/**', 'package.json', 'node_modules/sql.js/**/*'],
  asar: true,
  asarUnpack: ['node_modules/sql.js/dist/*.wasm'],
  npmRebuild: false,
  compression: 'maximum',
  artifactName: `${artifactBase}.\${ext}`,
  extraMetadata: {
    appEdition: edition,
    appEditionLabel: editionConfig.artifactLabel,
  },
  publish: {
    provider: 'github',
    releaseType: 'release',
  },
  win: {
    icon: 'build/icons/win/icon.ico',
    target: [
      { target: 'nsis', arch: ['x64'] },
      { target: 'portable', arch: ['x64'] },
      { target: 'zip', arch: ['x64'] },
    ],
    signtoolOptions: {
      signingHashAlgorithms: ['sha256'],
    },
  },
  nsis: {
    artifactName: `${artifactBase}-setup.\${ext}`,
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: 'always',
    createStartMenuShortcut: true,
  },
  portable: {
    artifactName: `${artifactBase}-portable.\${ext}`,
  },
  mac: {
    icon: 'build/icons/mac/icon.icns',
    target: [
      { target: 'dmg', arch: ['x64', 'arm64'] },
      { target: 'zip', arch: ['x64', 'arm64'] },
    ],
    category: 'public.app-category.developer-tools',
    identity: null,
    hardenedRuntime: false,
    gatekeeperAssess: false,
  },
  linux: {
    icon: 'build/icon_4.png',
    target: [
      { target: 'AppImage', arch: ['x64'] },
      { target: 'deb', arch: ['x64'] },
      { target: 'rpm', arch: ['x64'] },
      { target: 'tar.gz', arch: ['x64'] },
    ],
    category: 'Development',
  },
};
