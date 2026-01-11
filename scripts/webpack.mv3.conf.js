const fs = require('fs').promises;
const path = require('path');
const webpack = require('webpack');
const { buildManifest } = require('./manifest-helper');
const { addWrapperWithGlobals, getCodeMirrorThemes } = require('./webpack-util');
const ProtectWebpackBootstrapPlugin = require('./webpack-protect-bootstrap-plugin');
const { getVersion } = require('./version-helper');
const { configLoader } = require('./config-helper');
const { getBaseConfig, getPageConfig, isProd } = require('./webpack-base');
const HtmlWebpackPlugin = require('html-webpack-plugin');

process.env.MV3 = 'true';

// Avoiding collisions with globals of a content-mode userscript
const INIT_FUNC_NAME = '**VMInitInjection**';
const VAULT_ID = 'VAULT_ID';
const PAGE_MODE_HANDSHAKE = 'PAGE_MODE_HANDSHAKE';
const VM_VER = getVersion();

global.localStorage = {}; // workaround for node 25 and HtmlWebpackPlugin's `...global`

configLoader
  // Default values
  .add({
    DEBUG: false,
  })
  // Load from `./.env`
  .envFile()
  // Load from `process.env`
  .env()
  // Override values
  .add({
    VM_VER,
  });

const pickEnvs = (items) => {
  return Object.assign({}, ...items.map(key => ({
    [`process.env.${key}`]: JSON.stringify(configLoader.get(key)),
  })));
};

const defsObj = {
  ...pickEnvs([
    'DEBUG',
    'VM_VER',
    'SYNC_GOOGLE_DESKTOP_ID',
    'SYNC_GOOGLE_DESKTOP_SECRET',
    'SYNC_ONEDRIVE_CLIENT_ID',
    'SYNC_DROPBOX_CLIENT_ID',
  ]),
  'process.env.INIT_FUNC_NAME': JSON.stringify(INIT_FUNC_NAME),
  'process.env.CODEMIRROR_THEMES': JSON.stringify(getCodeMirrorThemes()),
  'process.env.DEV': JSON.stringify(!isProd),
  'process.env.TEST': JSON.stringify(process.env.BABEL_ENV === 'test'),
};
// avoid running webpack bootstrap in a potentially hacked environment
// after documentElement was replaced which triggered reinjection of content scripts
const skipReinjectionHeader = `{
  const INIT_FUNC_NAME = '${INIT_FUNC_NAME}';
  if (window[INIT_FUNC_NAME] !== 1)`;

class ManifestMV3Plugin {
  constructor({ minify } = {}) {
    this.minify = minify;
  }

  apply(compiler) {
    compiler.hooks.afterEmit.tapPromise(this.constructor.name, async compilation => {
      const dist = compilation.outputOptions.path;
      const manifestPath = `${dist}/manifest.json`;
      const manifest = await buildManifest();
      await fs.writeFile(manifestPath,
        JSON.stringify(manifest, null, this.minify ? 0 : 2),
        { encoding: 'utf8' });
    });
  }
}

const buildConfig = (page, entry, init) => {
  const config = entry ? getBaseConfig() : getPageConfig();
  config.plugins.push(new webpack.DefinePlugin({
    ...defsObj,
    // Conditional compilation to remove unsafe and unused stuff from `injected`
    'process.env.IS_INJECTED': JSON.stringify(/injected/.test(page) && page),
  }));
  if (typeof entry === 'string') {
    config.entry = { [page]: entry };
  }
  if (!entry) init = page;
  if (init) init(config);
  return config;
};

module.exports = [
  buildConfig((config) => {
    config.output.path = path.resolve('dist/mv3');
    // Replace background entry with service_worker
    delete config.entry['background/index'];
    config.entry['service_worker'] = './src/background';

    // Remove HtmlWebpackPlugin for background
    config.plugins = config.plugins.filter(p =>
      !(p instanceof HtmlWebpackPlugin && p.userOptions && p.userOptions.filename === 'background/index.html')
    );

    addWrapperWithGlobals('common', config, defsObj, getGlobals => ({
      header: () => `{ ${getGlobals()}`,
      footer: '}',
      test: /^(?!injected|public).*\.js$/,
    }));
    config.plugins.push(new ManifestMV3Plugin({
      minify: false, // keeping readable
    }));
    (config.ignoreWarnings ??= []).push({
      // suppressing a false warning (the HTML spec allows it) as we don't need SSR
      message: /<tr> cannot be child of <table>/,
    });
  }),

  buildConfig('injected', './src/injected', (config) => {
    config.output.path = path.resolve('dist/mv3');
    config.plugins.push(new ProtectWebpackBootstrapPlugin());
    addWrapperWithGlobals('injected/content', config, defsObj, getGlobals => ({
      header: () => `${skipReinjectionHeader} { ${getGlobals()}`,
      footer: '}}',
    }));
  }),

  buildConfig('injected-web', './src/injected/web', (config) => {
    config.output.path = path.resolve('dist/mv3');
    config.output.libraryTarget = 'commonjs2';
    config.plugins.push(new ProtectWebpackBootstrapPlugin());
    addWrapperWithGlobals('injected/web', config, defsObj, getGlobals => ({
      header: () => `${skipReinjectionHeader}
        window[INIT_FUNC_NAME] = function (IS_FIREFOX,${PAGE_MODE_HANDSHAKE},${VAULT_ID}) {
          const module = { __proto__: null };
          ${getGlobals()}`,
      footer: `
          const { exports } = module;
          return exports.__esModule ? exports.default : exports;
        }};0;`,
    }));
  }),
];
