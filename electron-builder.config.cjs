const artifactBase = `MajiAI-\${version}-\${os}-\${arch}`;
const windowsArtifactBase = artifactBase.replace('${os}', 'Windows');

module.exports = {
  appId: 'com.shuzhi.gitinsight-ai',
  productName: '码迹AI',
  directories: {
    output: 'release/${version}',
  },
  files: ['out/**/*', 'build/**', 'package.json', 'node_modules/sql.js/**/*'],
  asar: true,
  asarUnpack: ['node_modules/sql.js/dist/*.wasm'],
  npmRebuild: false,
  compression: 'maximum',
  artifactName: `${artifactBase}.\${ext}`,
  publish: {
    provider: 'github',
    owner: 'Darkerhao',
    repo: 'gitInsight-ai',
    // Keep the existing Standard installer update channel after unifying the product.
    channel: 'standard',
    releaseType: 'release',
  },
  win: {
    artifactName: `${windowsArtifactBase}.\${ext}`,
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
    include: 'build/installer.nsh',
    artifactName: `${windowsArtifactBase}.\${ext}`,
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: 'always',
    createStartMenuShortcut: true,
  },
  portable: {
    artifactName: `${windowsArtifactBase}-Portable.\${ext}`,
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
