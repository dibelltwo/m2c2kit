import esbuild from "rollup-plugin-esbuild";
import nodeResolve from "@rollup/plugin-node-resolve";
import serve from "rollup-plugin-serve";

export default (commandLineArgs) => {
  const isServe = !!commandLineArgs.configServe;
  const port = commandLineArgs.configPort || 3010;
  const outputFolder = "dist";

  return {
    input: "./src/index.ts",
    output: {
      file: `./${outputFolder}/dashboard.js`,
      format: "es",
      inlineDynamicImports: true,
      sourcemap: isServe,
    },
    plugins: [
      nodeResolve(),
      esbuild(),
      isServe &&
        serve({
          verbose: true,
          contentBase: [`./${outputFolder}`, "./"],
          historyApiFallback: true,
          host: "localhost",
          port,
        }),
    ],
  };
};
