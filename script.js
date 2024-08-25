import { WebGLUtility } from "/lib/webgl.js";
import { Mat4 } from "/lib/math.js";
import { WebGLGeometry } from "/lib/geometry.js";
import { WebGLOrbitCamera } from "/lib/camera.js";
import { Pane } from "/lib/tweakpane-4.0.3.min.js";

window.addEventListener(
    "DOMContentLoaded",
    async () => {
        const app = new App();
        app.init();
        app.setupPane();
        await app.load();
        app.setupGeometry();
        app.start();
    },
    false
);

/**
 * アプリケーション管理クラス
 */
class App {
    canvas
    gl
    program
    attributeLocation
    attributeStride
    uniformLocation
    planeGeometry
    planeVBO
    planeIBO
    startTime
    camera
    isRendering

    texture0
    texture1
    currentIndex
    isAnimating

    // A. stripe transition
    count = 30.0
    smoothness = 0.8
    animationStartTime = 0;
    animationDuration = 1.8;


    constructor() {
        // Setup for image transition
        this.isAnimating = false;
        this.currentIndex = 0;
        this.nextIndex = 1;
        this.progress = 0;

        // this.resize = this.resize.bind(this);
        this.clickObject = this.clickObject.bind(this);
        this.render = this.render.bind(this);

        this.isInitialized = false;
    }


    /**
     * テクスチャラッピングを設定
     * @param {number} wrapping - 設定する値
     */
    setTextureWrapping(wrapping) {
        const gl = this.gl;

        /**
         * 横方向と縦方向にそれぞれ設定できる
         * REPEAT 繰り返し
         * MIRRORED＿REPEAT 反転繰り返し
         * （初期値）CLAMP_TO＿EDGE 切り捨て = 1.5でも１として扱われる
         */
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapping);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapping);
    }


    /**
     * Init
     */
    init() {
        // 1. Get canvas element & create webgl context
        this.canvas = document.getElementById("bg-canvas");
        this.gl = WebGLUtility.createWebGLContext(this.canvas);

        // 2. Resize event
        this.resizeCanvas();

        // 3. Add events
        window.addEventListener("resize", this.debouncedResize.bind(this), false);

        // 4. Set depth test true as default
        this.gl.enable(this.gl.DEPTH_TEST);

        // 5. Add click event
        this.clickObject(this.canvas)
    }


    /**
     * Click event
     */
    clickObject(target) {
        target.addEventListener("click", (e) => {
            if (this.isAnimating) return;
            this.isAnimating = true;
            this.nextIndex = (this.currentIndex + 1) % 2;
            this.animationStartTime = performance.now() / 1000;
            this.progress = 0;
        });
    }


    /**
     * Debug GUI
     */
    setupPane() {
        const gl = this.gl;
        const pane = new Pane();
        const parameter = {
            smoothness: this.smoothness,
            count: this.count,
            animationDuration: this.animationDuration,
            wrapping: gl.CLAMP_TO_EDGE,
        };

        // smoothness
        pane.addBinding(parameter, "smoothness", { min: 0, max: 1, step: 0.01 }).on("change", (v) => {
            this.smoothness = v.value;
        });

        // count
        pane.addBinding(parameter, "count", { min: 1, max: 50, step: 1 }).on("change", (v) => {
            this.count = v.value;
        });

        // animationDuration
        pane.addBinding(parameter, "animationDuration", { min: 0.1, max: 10, step: 0.1 }).on("change", (v) => {
            this.animationDuration = v.value;
        });

        // texture wrapping
        pane.addBinding(parameter, 'wrapping', {
            options: {
                CLAMP_TO_EDGE: gl.CLAMP_TO_EDGE,     // クランプ（切り捨て）
                REPEAT: gl.REPEAT,                   // 繰り返し
                MIRRORED_REPEAT: gl.MIRRORED_REPEAT, // 反転繰り返し
            },
        })
            .on('change', (v) => {
                this.setTextureWrapping(v.value);
            });
    }


    /**
     * Resize
     */
    resizeCanvas() {
        const gl = this.gl;

        /*
        ブラウザがcanvasでCSSピクセルを表示しているサイズを参照して、
        デバイスピクセルに合った描画バッファサイズを計算する
        */
        const displayWidth = Math.floor(this.canvas.clientWidth * window.devicePixelRatio);
        const displayHeight = Math.floor(this.canvas.clientHeight * window.devicePixelRatio);

        // キャンバスサイズが異なる場合のみリサイズ
        if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
            this.canvas.width = displayWidth;
            this.canvas.height = displayHeight;
        }

        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    debouncedResize() {
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            this.resizeCanvas();
            this.updateUniforms();
        }, 100);
    }

    updateUniforms() {
        const gl = this.gl;
        const totalTextures = 2;

        if (this.program && this.uniformLocation) {
            gl.useProgram(this.program);

            // Update resolution value(canvas size)
            gl.uniform2f(this.uniformLocation.resolution, this.canvas.width, this.canvas.height);

            // Update all textures' size
            for (let i = 0; i < totalTextures; i++) {
                const texResolution = this[`texture${i}Resolution`];
                gl.uniform2f(this.uniformLocation.texResolution, texResolution.width, texResolution.height);
                // console.log("texture0 is " + this.texture0Resolution.width, this.texture0Resolution.height);
                // console.log("texture1 is " + this.texture1Resolution.width, this.texture1Resolution.height);
            }
        }
    }


    /**
     * Load assets
     * @return {Promise}
     */
    async load() {
        return new Promise(async (resolve, reject) => {
            const gl = this.gl;

            if (gl == null) {
                const error = new Error("not initialized");
                reject(error);
            } else {
                // 1. Load shader files
                const VSSource = await WebGLUtility.loadFile("/main.vert");
                const FSSource = await WebGLUtility.loadFile("/main.frag");

                // 2. Create shader objects from shader files
                const vertexShader = WebGLUtility.createShaderObject(gl, VSSource, gl.VERTEX_SHADER);
                const fragmentShader = WebGLUtility.createShaderObject(gl, FSSource, gl.FRAGMENT_SHADER);

                this.program = WebGLUtility.createProgramObject(gl, vertexShader, fragmentShader);

                // 3. Load images
                const textures = [
                    { path: "/assets/sample.jpg", name: "texture0", unit: 0 }, // for debug
                    { path: "/assets/img1.jpg", name: "texture1", unit: 1 },
                    // { path: "/assets/img2.jpg", name: "texture1", unit: 1 },
                ];

                for (const { path, name, unit } of textures) {
                    const image = await WebGLUtility.loadImage(path);
                    this[name] = WebGLUtility.createTexture(gl, image, unit);

                    this[`${name}Resolution`] = { width: image.width, height: image.height };
                }

                resolve();
            }

            this.setupLocation();
            this.updateUniforms();
            this.isInitialized = true;
        });
    }


    /**
     * Setup for Geometry
     */
    setupGeometry() {
        // 1. Create a plane geometry
        const size = 2.0; // クリップ空間で -1 から 1 の範囲をカバー
        const color = [1.0, 1.0, 1.0, 1.0];
        this.planeGeometry = WebGLGeometry.plane(size, size, color);

        // 2. Create VBO
        this.planeVBO = [
            WebGLUtility.createVBO(this.gl, this.planeGeometry.position),
            WebGLUtility.createVBO(this.gl, this.planeGeometry.normal),
            WebGLUtility.createVBO(this.gl, this.planeGeometry.color),
            WebGLUtility.createVBO(this.gl, this.planeGeometry.texCoord),
        ];

        // 3, Create IBO
        this.planeIBO = WebGLUtility.createIBO(this.gl, this.planeGeometry.index);
    }


    /**
     * Set up for location(connection VBO and attributes in shader)
     */
    setupLocation() {
        const gl = this.gl;

        // 1. Get attribute location
        this.attributeLocation = [
            gl.getAttribLocation(this.program, "position"),
            gl.getAttribLocation(this.program, "normal"),
            gl.getAttribLocation(this.program, "color"),
            gl.getAttribLocation(this.program, "texCoord"),
        ];

        // 2. Length of each attributes
        this.attributeStride = [3, 3, 4, 2];

        // 3. Get uniform location
        this.uniformLocation = {
            resolution: gl.getUniformLocation(this.program, "resolution"), // v2 canvas size
            texResolution: gl.getUniformLocation(this.program, "texResolution"), // v2 texture size
            mvpMatrix: gl.getUniformLocation(this.program, "mvpMatrix"),
            normalMatrix: gl.getUniformLocation(this.program, "normalMatrix"),
            texture1: gl.getUniformLocation(this.program, "texture1"),
            texture2: gl.getUniformLocation(this.program, "texture2"),
            progress: gl.getUniformLocation(this.program, "progress"),
            count: gl.getUniformLocation(this.program, "count"),
            smoothness: gl.getUniformLocation(this.program, "smoothness"),
        };
    }


    /**
     * Set up for rendering
     */
    setupRendering() {
        const gl = this.gl;

        // 1. Setup for viewport
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);

        // 2. Setup for clear color & depth
        gl.clearColor(0.3, 0.3, 0.3, 1.0);
        gl.clearDepth(1.0);

        // 3. Clear color & depth test
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }


    /**
     * Start to render
     */
    start() {
        const gl = this.gl;

        // 1. Bind textures
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.texture1);

        // 2. Get time stamp from starting
        this.startTime = Date.now();

        // 3. Flag for rendering
        this.isRendering = true;

        // 4. Start rendering
        this.render();
    }


    /**
     * Stop to render
     */
    stop() {
        this.isRendering = false;
    }


    /**
     * Render
     */
    render() {
        const gl = this.gl;

        // if isRendering is true, call raf
        if (this.isRendering === true) {
            requestAnimationFrame(this.render);
        }

        // 2. Setup for rendering
        this.setupRendering();

        // 単位行列を使用
        const p = Mat4.identity();

        // ビュー行列も単位行列を使用（カメラの変換なし）
        // 単位行列を使用することで、頂点座標をそのまま使用
        const v = Mat4.identity();
        const mvp = Mat4.multiply(p, v);

        // モデル座標変換行列の、逆転置行列を生成する
        const normalMatrix = Mat4.identity(); // 2D表示では法線も使用しないから、単位行列で十分

        /**
         * Animation
        */
        const currentTime = performance.now() / 1000;
        const elapsedTime = currentTime - this.animationStartTime;
        if (this.isAnimating) {
            this.progress = Math.min(elapsedTime / this.animationDuration, 1.0);
        }

        gl.useProgram(this.program);

        // Specify values of uniforms & send them to shader
        gl.uniformMatrix4fv(this.uniformLocation.mvpMatrix, false, mvp);
        gl.uniformMatrix4fv(this.uniformLocation.normalMatrix, false, normalMatrix);
        gl.uniform2i(this.uniformLocation.resolution, this.canvas.width, this.canvas.height)
        const currentTextureResolution = this[`texture${this.currentIndex}Resolution`];
        gl.uniform2i(this.uniformLocation.texResolution, currentTextureResolution.width, currentTextureResolution.height);
        gl.uniform1f(this.uniformLocation.progress, this.progress);
        gl.uniform1i(this.uniformLocation.texture1, this.currentIndex);
        gl.uniform1i(this.uniformLocation.texture2, this.nextIndex);

        gl.uniform1f(this.uniformLocation.count, this.count); // A. stripe transition
        gl.uniform1f(this.uniformLocation.smoothness, this.smoothness); // A. stripe transition

        // Render VBO & IBO
        WebGLUtility.enableBuffer(
            gl,
            this.planeVBO,
            this.attributeLocation,
            this.attributeStride,
            this.planeIBO
        );
        gl.drawElements(
            gl.TRIANGLES,
            this.planeGeometry.index.length,
            gl.UNSIGNED_SHORT,
            0
        );

        if (this.isAnimating && this.progress >= 1.0) {
            this.isAnimating = false;
            this.currentIndex = this.nextIndex;
            this.progress = 0;
        }
    }
}
