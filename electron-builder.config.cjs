const edition = process.env.APP_EDITION === 'standard' ? 'standard' : 'lite';

const editionConfig = {
  lite: {
    appId: 'com.shuzhi.gitinsight-ai.lite',
    productName: '码迹 AI 轻量版',
    artifactLabel: '轻量版',
  },
  standard: {
    appId: 'com.shuzhi.gitinsight-ai',
    productName: '码迹 AI 标准版',
    artifactLabel: '标准版',
  },
}[edition];

const artifactBase = `码迹AI-${editionConfig.artifactLabel}-\${version}-\${os}-\${arch}`;
const windowsArtifactBase = artifactBase.replace('${os}', 'Windows');

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
    artifactName: `${windowsArtifactBase}.\${ext}`,
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: 'always',
    createStartMenuShortcut: true,
  },
  portable: {
    artifactName: `${windowsArtifactBase}-便携版.\${ext}`,
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
