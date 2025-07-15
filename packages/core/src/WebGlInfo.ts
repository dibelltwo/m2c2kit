// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class WebGlInfo {
  /**
   * Returns graphics driver vendor and renderer information.
   *
   * @remarks Information is from parameters UNMASKED_VENDOR_WEBGL and
   * UNMASKED_RENDERER_WEBGL when asking for WEBGL_debug_renderer_info
   * from the WebGLRenderingContext.
   *
   * @returns string
   */
  public static getRendererString(): string {
    const rendererInfoCanvas = document.createElement("canvas");
    rendererInfoCanvas.id = "webgl-renderer-info-canvas";
    rendererInfoCanvas.height = 0;
    rendererInfoCanvas.width = 0;
    rendererInfoCanvas.hidden = true;
    document.body.appendChild(rendererInfoCanvas);
    const gl = rendererInfoCanvas.getContext("webgl");
    let rendererString = "no webgl context";
    if (!gl) {
      return rendererString;
    }
    const debugRendererInfo = gl.getExtension("WEBGL_debug_renderer_info");
    if (debugRendererInfo != null) {
      rendererString =
        String(gl.getParameter(debugRendererInfo.UNMASKED_VENDOR_WEBGL)) +
        ", " +
        String(gl.getParameter(debugRendererInfo.UNMASKED_RENDERER_WEBGL));
    } else {
      rendererString = "no debug renderer info";
    }
    rendererInfoCanvas.remove();
    return rendererString;
  }

  /**
   * Removes the temporary canvas that was created to get WebGL information.
   */
  public static dispose(): void {
    const rendererInfoCanvas = document.getElementById(
      "webgl-renderer-info-canvas",
    );
    if (rendererInfoCanvas) {
      rendererInfoCanvas.remove();
    }
  }

  public static interceptWebGlCalls(htmlCanvas: HTMLCanvasElement) {
    const canvasProto = Object.getPrototypeOf(htmlCanvas);

    if (canvasProto.m2c2ModifiedGetContext) {
      canvasProto.m2c2ModifiedGetContext = true;
      const getContextOriginal = canvasProto.getContext;
      canvasProto.getContext = function (...args: unknown[]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((window as any).logWebGl) {
          console.log(
            `🔼 getContext(${args.map((a) => String(a)).join(", ")})`,
          );
        }
        const context = getContextOriginal.apply(this, [...args]);
        const contextProto = Object.getPrototypeOf(context);

        // if (context.__proto__.createProgram) {
        //   if (!context.__proto__.m2c2ModifiedCreateProgram) {
        //     context.__proto__.m2c2ModifiedCreateProgram = true;
        //     // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //     // @ts-ignore
        //     const createProgramOriginal = context.__proto__.createProgram;
        //     // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //     // @ts-ignore
        //     context.__proto__.createProgram = function (...args) {
        //       console.log("🔼 createProgram()");
        //       return createProgramOriginal.apply(this, [...args]);
        //     };
        //   }
        // }

        // if (context.__proto__.shaderSource) {
        //   if (!context.__proto__.m2c2ModifiedShaderSource) {
        //     context.__proto__.m2c2ModifiedShaderSource = true;
        //     // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //     // @ts-ignore
        //     const shaderSourceOriginal = context.__proto__.shaderSource
        //     // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //     // @ts-ignore
        //     context.__proto__.shaderSource= function (...args) {
        //       console.log(`🔼 shaderSource(): ${args[1]}`);
        //       return shaderSourceOriginal.apply(this, [...args]);
        //     };
        //   }
        // }

        if (contextProto.compileShader) {
          if (!contextProto.m2c2ModifiedCompileShader) {
            contextProto.m2c2ModifiedCompileShader = true;
            const compileShaderOriginal = contextProto.compileShader;
            contextProto.compileShader = function (...args: unknown[]) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              if ((window as any).logWebGl) {
                const shader = args[0];
                const source = context.getShaderSource(shader);
                console.log(`🔼 compileShader():`);
                console.log(source);
              }
              return compileShaderOriginal.apply(this, [...args]);
            };
          }
        }

        return context;
      };
    }
  }
}
