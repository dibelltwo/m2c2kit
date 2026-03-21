import esbuild from "rollup-plugin-esbuild";
import nodeResolve from "@rollup/plugin-node-resolve";
import serve from "rollup-plugin-serve";
import { copyAssets } from "@m2c2kit/build-helpers";

export default (commandLineArgs) => {
  const isServe = !!commandLineArgs.configServe;
  const isProd = !!commandLineArgs.configProd;
  const port = commandLineArgs.configPort || 3000;
  const outputFolder = isProd ? "dist" : "build";

  return [
    {
      input: "./src/dev.ts",
      output: [
        {
          file: `./${outputFolder}/index.js`,
          format: "es",
          sourcemap: isServe,
        },
      ],
      plugins: [
        nodeResolve(),
        esbuild(),
        copyAssets({
          package: [
            "@m2c2kit/assessment-color-dots",
            "@m2c2kit/assessment-color-shapes",
            "@m2c2kit/assessment-grid-memory",
            "@m2c2kit/assessment-symbol-search",
            "@m2c2kit/db",
            "@m2c2kit/session",
            "@m2c2kit/survey",
          ],
          outputFolder,
        }),
        isServe &&
          serve({
            verbose: true,
            contentBase: [`./${outputFolder}`],
            historyApiFallback: true,
            host: "localhost",
            port,
          }),
      ],
    },
  ];
};
