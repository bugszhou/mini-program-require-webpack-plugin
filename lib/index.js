const webpack = require("webpack");
const { ConcatSource } = require("webpack-sources");

class MiniProgramRequireWebpackPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap(
      "MiniProgramRequireWebpackPlugin",
      (compilation) => {
        const hooks =
          webpack.JavascriptModulesPlugin.getCompilationHooks(compilation);
        hooks.render.tap(
          "MiniProgramRequireWebpackPlugin",
          (originSource, renderContext) => {
            const source = new ConcatSource();
            const { chunk, chunkGraph } = renderContext;

            const currentOutputName = compilation
              .getPath(
                webpack.JavascriptModulesPlugin.getChunkFilenameTemplate(
                  chunk,
                  compilation.outputOptions,
                ),
                {
                  chunk,
                  contentHashType: "javascript",
                },
              )
              .split("/");

            const entries = Array.from(
              chunkGraph.getChunkEntryModulesWithChunkGroupIterable(chunk),
            );

            if (entries.length === 0) {
              return originSource;
            }

            const runtimeChunk = entries[0][1].getRuntimeChunk();

            const runtimeOutputName = compilation
              .getPath(
                webpack.JavascriptModulesPlugin.getChunkFilenameTemplate(
                  runtimeChunk,
                  compilation.outputOptions,
                ),
                {
                  chunk: runtimeChunk,
                  contentHashType: "javascript",
                },
              )
              .split("/");

            // 删除文件文件，只获取文件所在目录
            currentOutputName.pop();

            // 删除runtime chunk
            while (
              currentOutputName.length > 0 &&
              runtimeOutputName.length > 0 &&
              currentOutputName[0] === runtimeOutputName[0]
            ) {
              currentOutputName.shift();
              runtimeOutputName.shift();
            }

            // 生成最终的路径
            // runtime的路径、commons的路径
            const runtimePath =
              (currentOutputName.length > 0
                ? "../".repeat(currentOutputName.length)
                : "./") + runtimeOutputName.join("/");

            const commonsChunkPaths = getCommonsChunkPaths(chunk, entries).map(
              (item) => {
                return (
                  (currentOutputName.length > 0
                    ? "../".repeat(currentOutputName.length)
                    : "./") + item
                );
              },
            );

            const requireChunkPaths = [runtimePath, ...commonsChunkPaths];

            requireChunkPaths.forEach((pathUrl) => {
              source.add(`require("${pathUrl}");\n`);
            });

            if (Array.isArray(originSource._children)) {
              originSource._children.forEach((item) => {
                source.add(item);
              });
            }

            return source;
          },
        );
      },
    );
  }
}

function getCommonsChunkPaths(chunk, entries) {
  let chunks = new Set();
  const commons = [];
  for (const [, entryPoint] of entries) {
    const runtimeChunk = entryPoint.getRuntimeChunk();
    chunks = getDepAllChunks(entryPoint, [chunk, runtimeChunk]);
  }

  chunks.forEach((item) => {
    if (!commons.includes(item.id)) {
      commons.push(item.id);
    }
  });

  return commons;
}

/**
 * 获取入口文件依赖的chunk
 */
function getDepAllChunks(entryPoint, exclude) {
  let excludeArr = exclude;

  if (!Array.isArray(exclude)) {
    excludeArr = [exclude];
  }

  const queue = new Set([entryPoint]);
  const chunks = new Set();

  for (const entry of queue) {
    for (const chunk of entry.chunks) {
      if (excludeArr.some((excludedChunk) => chunk === excludedChunk)) {
        continue;
      }
      chunks.add(chunk);
    }

    for (const parent of entry.parentsIterable) {
      if (parent instanceof webpack.Entrypoint) {
        queue.add(parent);
      }
    }
  }
  return chunks;
}

module.exports = MiniProgramRequireWebpackPlugin;
