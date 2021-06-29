const path = require('path');
const webpack = require('webpack');

const HtmlWebpackPlugin = require('html-webpack-plugin');
const artifact = require('./package.json');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const fileName = `${artifact.name}-${artifact.version.slice(0, 3)}`;
module.exports = (env, argv) => ({
    entry: {
        [fileName]: './src/game.js',
    },
    output: {
        filename: '[name].[hash].bundle.js',
        path: path.resolve(__dirname, 'dist'),
        publicPath: '/',
    },
    devServer: {
        historyApiFallback: true,
        contentBase: path.resolve(__dirname, '../dist'),
        open: true,
        compress: true,
        hot: true,
        port: 8080,
    },
    module: {
        rules: [

            {
                test: /\.js$/,
                exclude: /(node_modules)/,
                use: ['babel-loader', 'eslint-loader']
            },
            {
                test: /\.(?:ico|gif|png|jpg|jpeg|webp|svg|stl)$/i,
                loader: 'file-loader',
                options: {
                    name: '[path][name].[ext]',
                    context: 'src', // prevent display of src/ in filename
                },
            },
            {
                test: /\.(woff(2)?|eot|ttf|otf|)$/,
                loader: 'url-loader',
                options: {
                    limit: 8192,
                    name: '[path][name].[ext]',
                    context: 'src', // prevent display of src/ in filename
                },
            },
        ],
    },
    plugins: [
        ...(argv.mode === 'production' ? [new CleanWebpackPlugin({ verbose: true })] : []),
        new webpack.HotModuleReplacementPlugin(),
        new CopyWebpackPlugin({
            patterns: [{ from: path.resolve(__dirname, 'static'), to: 'static' }],
        }),
        new HtmlWebpackPlugin({
            title: 'Makers 2021 Capture the flag (with airplanes)',
            favicon: path.resolve(__dirname, 'public/favicon.png'),
            template: path.resolve(__dirname, 'src/template.html'), // template file
            filename: 'index.html' // output file
        })
    ],
    devtool: argv.mode === 'production' ? 'none' : 'eval-source-map',
    performance: {
        hints: false,
        maxEntrypointSize: 512000,
        maxAssetSize: 512000,
    },
});
