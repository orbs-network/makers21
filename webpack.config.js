const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: {
      main: './src/index.js',
      aframe: './src/aframe-version/index.js'
    },

    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].[contenthash].js',
      clean: true,
    },

    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: [
            /node_modules/,
            path.resolve(__dirname, 'src/assets'),  // Exclude entire assets directory from JS processing
          ],
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env']
            }
          }
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        },
        {
          test: /\.(png|jpg|jpeg|gif|svg)$/,
          type: 'asset/resource',
          generator: {
            filename: 'images/[name].[contenthash][ext]'
          }
        },
        {
          test: /\.(obj|mtl|mp3|wav|json)$/,
          type: 'asset/resource',
          generator: {
            filename: 'assets/[path][name].[contenthash][ext]'
          }
        },
        {
          test: /\.(woff|woff2|eot|ttf|otf)$/,
          type: 'asset/resource',
          generator: {
            filename: 'fonts/[name].[contenthash][ext]'
          }
        }
      ]
    },

    plugins: [
      new HtmlWebpackPlugin({
        template: './src/index.html',
        filename: 'index.html',
        chunks: ['main'],
        title: 'Makers 2021 - Three.js Version'
      }),
      new HtmlWebpackPlugin({
        template: './src/aframe-version/index.html',
        filename: 'aframe.html',
        chunks: ['aframe'],
        title: 'Makers 2021 - A-Frame Version'
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: 'src/assets',
            to: 'assets',
            noErrorOnMissing: true,
            globOptions: {
              ignore: ['**/*.js']  // Don't copy .js files from assets, let webpack handle them separately if needed
            }
          }
        ]
      })
    ],

    optimization: {
      minimize: isProduction,
      minimizer: [
        '...',  // Use default minimizers
      ]
    },

    devServer: {
      static: path.join(__dirname, 'dist'),
      port: 3000,
      hot: true,
      open: true,
      historyApiFallback: true
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@assets': path.resolve(__dirname, 'src/assets'),
        '@components': path.resolve(__dirname, 'src/components'),
        '@utils': path.resolve(__dirname, 'src/utils')
      }
    },

    devtool: isProduction ? 'source-map' : 'eval-source-map'
  };
};