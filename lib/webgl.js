
/**
 * WebGL の API を目的別にまとめたユーティリティクラス
 */
export class WebGLUtility {
  /**
   * ファイルをプレーンテキストとして読み込む
   * @param {string} path - 読み込むファイルのパス
   * @return {Promise}
   */
  static loadFile(path) {
    return new Promise(async (resolve) => {
      // fetch を使ってファイルにアクセスする
      const response = await fetch(path);
      const text = await response.text();
      // テキストを引数に Promise を解決する
      resolve(text);
    });
  }

  /**
   * ファイルを画像として読み込む
   * @param {string} path - 読み込むファイルのパス
   * @return {Promise}
   */
  static loadImage(path) {
    return new Promise((resolve) => {
      // Image オブジェクトの生成
      const img = new Image();
      // ロード完了を検出したいので、先にイベントを設定する
      img.addEventListener('load', () => {
        // 画像を引数に Promise を解決する
        resolve(img);
      }, false);
      // 読み込む画像のパスを設定する
      img.src = path;
    });
  }

  /**
   * canvas を受け取り WebGL コンテキストを初期化する
   * @param {HTMLCanvasElement} canvas - WebGL コンテキストを取得する canvas 要素
   * @return {WebGLRenderingContext}
   */
  static createWebGLContext(canvas) {
    // canvas から WebGL コンテキスト取得を試みる
    const gl = canvas.getContext('webgl');
    if (gl == null) {
      // WebGL コンテキストが取得できない場合はエラー
      throw new Error('webgl not supported');
    } else {
      return gl;
    }
  }

  /**
   * ソースコードからシェーダオブジェクトを生成する
   * @param {WebGLRenderingContext} gl - WebGL コンテキスト
   * @param {string} source - シェーダのソースコード
   * @param {number} type - gl.VERTEX_SHADER or gl.FRAGMENT_SHADER
   * @return {WebGLShader}
   */
  static createShaderObject(gl, source, type) {
    // 空のシェーダオブジェクトを生成する
    const shader = gl.createShader(type);
    // シェーダオブジェクトにソースコードを割り当てる
    gl.shaderSource(shader, source);
    // シェーダをコンパイルする
    gl.compileShader(shader);
    // コンパイル後のステータスを確認し問題なければシェーダオブジェクトを返す
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      return shader;
    } else {
      throw new Error(gl.getShaderInfoLog(shader));
    }
  }

  /**
   * シェーダオブジェクトからプログラムオブジェクトを生成する
   * @param {WebGLRenderingContext} gl - WebGL コンテキスト
   * @param {WebGLShader} vs - 頂点シェーダのシェーダオブジェクト
   * @param {WebGLShader} fs - フラグメントシェーダのシェーダオブジェクト
   * @return {WebGLProgram}
   */
  static createProgramObject(gl, vs, fs) {
    // 空のプログラムオブジェクトを生成する
    const program = gl.createProgram();
    // ２つのシェーダをアタッチ（関連付け）する
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    // シェーダオブジェクトをリンクする
    gl.linkProgram(program);
    // リンクが完了するとシェーダオブジェクトは不要になるので削除する
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    // リンク後のステータスを確認し問題なければプログラムオブジェクトを返す
    if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.useProgram(program);
      return program;
    } else {
      throw new Error(gl.getProgramInfoLog(program));
    }
  }

  /**
   * JavaScript の配列から VBO（Vertex Buffer Object）を生成する
   * @param {WebGLRenderingContext} gl - WebGL コンテキスト
   * @param {Array.<number>} vertexArray - 頂点属性情報の配列
   * @return {WebGLBuffer}
   */
  static createVBO(gl, vertexArray) {
    // 空のバッファオブジェクトを生成する
    const vbo = gl.createBuffer();
    // バッファを gl.ARRAY_BUFFER としてバインドする
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    // バインドしたバッファに Float32Array オブジェクトに変換した配列を設定する
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexArray), gl.STATIC_DRAW);
    // 安全のために最後にバインドを解除してからバッファオブジェクトを返す
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return vbo;
  }

  /**
   * JavaScript の配列から IBO（Index Buffer Object）を生成する
   * @param {WebGLRenderingContext} gl - WebGL コンテキスト
   * @param {Array.<number>} indexArray - 頂点インデックスの結び順の配列
   * @return {WebGLBuffer}
   */
  static createIBO(gl, indexArray) {
    // 空のバッファオブジェクトを生成する
    const ibo = gl.createBuffer();
    // バッファを gl.ELEMENT_ARRAY_BUFFER としてバインドする
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    // バインドしたバッファに Int16Array オブジェクトに変換した配列を設定する
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Int16Array(indexArray), gl.STATIC_DRAW);
    // 安全のために最後にバインドを解除してからバッファオブジェクトを返す
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    return ibo;
  }

  /**
   * VBO と IBO をバインドして有効化する
   * @param {WebGLRenderingContext} gl - WebGL コンテキスト
   * @param {Array.<WebGLBuffer>} vbo - 頂点属性を格納した頂点バッファの配列
   * @param {Array.<number>} attLocation - 頂点属性ロケーションの配列
   * @param {Array.<number>} attStride - 頂点属性のストライドの配列
   * @param {WebGLBuffer} [ibo] - インデックスバッファ
   */
  static enableBuffer(gl, vbo, attLocation, attStride, ibo) {
    for (let i = 0; i < vbo.length; ++i) {
      // 有効化したいバッファをまずバインドする
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo[i]);
      // 頂点属性ロケーションの有効化を行う
      gl.enableVertexAttribArray(attLocation[i]);
      // 対象のロケーションのストライドやデータ型を設定する
      gl.vertexAttribPointer(attLocation[i], attStride[i], gl.FLOAT, false, 0, 0);
    }
    if (ibo != null) {
      // IBO が与えられている場合はバインドする
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    }
  }

  /**
   * テクスチャ用のリソースからテクスチャを生成する
   * @param {WebGLRenderingContext} gl - WebGL コンテキスト
   * @param {any} resource - 画像や HTMLCanvasElement などのテクスチャ用リソース
   * @return {WebGLTexture}
   */
  static createTexture(gl, resource) {
    // テクスチャオブジェクトを生成
    const texture = gl.createTexture();

    // アクティブなテクスチャユニット番号を指定する（０番ユニットがアクティブ）
    //　規定値の０番目のユニットだけを使うようにした方がいい。
    //　同じポリゴンに2枚のテクスチャを貼りたい場合は、０と１番目のユニットを使う必要がある
    gl.activeTexture(gl.TEXTURE0);

    // テクスチャをアクティブなユニットにバインドする
    // TEXTURE_CUBEなども入る
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // バインドしたテクスチャにデータを割り当てる
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, resource);

    // ミップマップを自動生成する
    gl.generateMipmap(gl.TEXTURE_2D);

    // テクスチャパラメータを設定する
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // 安全の為にテクスチャのバインドを解除してから返す
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
  }

  /**
   * キューブマップテクスチャを生成する
   * @param {WebGLRenderingContext} gl - WebGL コンテキスト
   * @param {Array.<any>} resource - 画像や HTMLCanvasElement などのテクスチャ用リソース
   * @param {Array.<number>} target - 画像にそれぞれ対応させるターゲット定数の配列
   * @return {WebGLTexture}
   */
  static createCubeTexture(gl, resource, target) {
    // テクスチャオブジェクトを生成
    const texture = gl.createTexture();
    // アクティブなテクスチャユニット番号を指定する
    gl.activeTexture(gl.TEXTURE0);
    // テクスチャをアクティブなユニットにキューブテクスチャとしてバインドする
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
    // ターゲットを指定してテクスチャに割り当てる
    target.forEach((t, index) => {
      gl.texImage2D(t, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, resource[index]);
    });
    // ミップマップを自動生成する
    gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    // テクスチャパラメータを設定する
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // 安全の為にテクスチャのバインドを解除してから返す
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
    return texture;
  }

  /**
   * ファイルを読み込み、キューブマップテクスチャを生成する
   * @param {WebGLRenderingContext} gl - WebGL コンテキスト
   * @param {Array.<string>} source - 読み込む画像のパスの配列
   * @param {Array.<number>} target - 画像にそれぞれ対応させるターゲット定数の配列
   * @return {Promise} テクスチャを引数に解決する Promise
   */
  static createCubeTextureFromFile(gl, source, target) {
    return new Promise(async (resolve) => {
      // 画像を個々に読み込む Promise を生成し配列に入れておく
      const promises = source.map((src) => {
        // 画像の読み込みが完了したら解決する Promise
        return new Promise((loadedResolve) => {
          // 空の画像オブジェクト
          const img = new Image();
          // ロード完了時の処理を先に登録
          img.addEventListener('load', () => {
            // ロード完了と同時に画像を渡して Promise を解決する
            loadedResolve(img);
          }, false);
          // パスを設定
          img.src = src;
        });
      });
      // 配列に入れたすべての Promise を一気に実行する
      const images = await Promise.all(promises)
      // キューブマップテクスチャを生成する
      const cubeTexture = WebGLUtility.createCubeTexture(gl, images, target);
      // Promise を解決する際、生成したテクスチャを渡す
      resolve(cubeTexture);
    });
  }

  /**
   * フレームバッファを生成する
   * @param {WebGLRenderingContext} gl - WebGL コンテキスト
   * @param {number} width - フレームバッファの幅
   * @param {number} height - フレームバッファの高さ
   * @return {object}
   * @property {WebGLFramebuffer} framebuffer - フレームバッファオブジェクト
   * @property {WebGLRenderbuffer} depthRenderBuffer - 深度バッファ用のレンダーバッファ
   * @property {WebGLTexture} texture - カラーバッファ用のテクスチャオブジェクト
   */
  static createFramebuffer(gl, width, height) {
    const framebuffer = gl.createFramebuffer();  // フレームバッファ
    const depthRenderBuffer = gl.createRenderbuffer(); // レンダーバッファ
    const texture = gl.createTexture();      // テクスチャ
    // フレームバッファをバインド
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    // レンダーバッファをバインド
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthRenderBuffer);
    // レンダーバッファを深度バッファとして設定する
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
    // フレームバッファにレンダーバッファを関連付けする
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRenderBuffer);
    // テクスチャをユニット０にバインド
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // テクスチャにサイズなどを設定する（ただし中身は null）
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    // テクスチャパラメータを設定
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // フレームバッファにテクスチャを関連付けする
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    // すべてのオブジェクトは念の為バインドを解除しておく
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // 各オブジェクトを、JavaScript のオブジェクトに格納して返す
    return {
      framebuffer: framebuffer,
      depthRenderbuffer: depthRenderBuffer,
      texture: texture
    };
  }

  /**
   * フレームバッファ関連リソースをリサイズする
   * @param {WebGLRenderingContext} gl - WebGL コンテキスト
   * @param {number} width - フレームバッファの幅
   * @param {number} height - フレームバッファの高さ
   * @param {WebGLRenderbuffer} renderbuffer - レンダーバッファ
   * @param {WebGLTexture} texture - テクスチャ
   */
  static resizeFramebuffer(gl, width, height, renderbuffer, texture) {
    if (renderbuffer != null) {
      // レンダーバッファをバインド
      gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
      // レンダーバッファを深度バッファとして設定のうえリサイズする
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
    }
    // テクスチャをユニット０にバインド
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // テクスチャにサイズを設定する
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  }

  /**
   * フレームバッファ関連リソースを削除する
   * @param {WebGLRenderingContext} gl - WebGL コンテキスト
   * @param {WebGLFramebuffer} framebuffer - フレームバッファ
   * @param {WebGLRenderbuffer} renderbuffer - レンダーバッファ
   * @param {WebGLTexture} texture - テクスチャ
   */
  static deleteFramebuffer(gl, framebuffer, renderbuffer, texture) {
    gl.deleteFramebuffer(framebuffer);
    framebuffer = null;
    if (renderbuffer != null) {
      gl.deleteRenderbuffer(renderbuffer);
      renderbuffer = null;
    }
    gl.deleteTexture(texture);
    texture = null;
  }
}
