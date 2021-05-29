exports.onCreateWebpackConfig = ({
  stage,
  rules,
  loaders,
  plugins,
  actions,
}) => {
  if (stage === "build-html") {
    actions.setWebpackConfig({
      target: "node",
      node: {
        __dirname: false,
      },
      module: {
        rules: [
          {
            test: /\.node$/,
            loader: "node-loader",
          },
        ],
      },    
    })
  }
};