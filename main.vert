precision mediump float;

attribute vec3 position;
attribute vec3 normal;
attribute vec4 color;
attribute vec2 texCoord;

uniform mat4 mvpMatrix;
uniform vec2 resolution;
uniform vec2 texResolution;

varying vec2 vTexCoord;

void main() {
    // テクスチャ座標をフラグメントシェーダに送る
    vTexCoord = texCoord;
    
    gl_Position = vec4(position, 1.0);
}