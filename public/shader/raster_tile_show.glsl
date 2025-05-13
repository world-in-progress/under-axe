#ifdef VERTEX_SHADER

precision highp float;

uniform mat4 tMVP;
uniform vec2 u_topLeft;
uniform float u_scale;

out vec2 texcoords;

vec4[] vertices = vec4[4](vec4(0.0, 8192.0, 0.0, 0.0), vec4(8192.0, 8192.0, 1.0, 0.0), vec4(0.0, 0.0, 0.0, 1.0), vec4(8192.0, 0.0, 1.0, 1.0));

void main() {

    vec4 attributes = vertices[gl_VertexID];

    texcoords = (attributes.xy / 8192.0 * u_scale + u_topLeft);
    // texcoords = attributes.zw;
    gl_Position = tMVP * vec4(attributes.xy, 0.0, 1.0);

}

#endif

#ifdef FRAGMENT_SHADER

precision highp int;
precision highp float;
precision highp usampler2D;

in vec2 texcoords;

uniform sampler2D tileTexture;

out vec4 fragColor;

bool almostEqual(float a, float b) {
    return abs(a - b) < 0.0001 ? true : false;
}

void main() {

    vec4 color = texture(tileTexture, texcoords);

    fragColor = vec4(color);
}

#endif