// import axios from 'axios'

export function enableAllExtensions(gl: WebGL2RenderingContext): void {
    const extensions = gl.getSupportedExtensions()
    extensions?.forEach((ext: string) => {
        gl.getExtension(ext)
        console.log('Enabled extensions: ', ext)
    })
}

export function createVBO(gl: WebGL2RenderingContext, data: Float32Array | number[]): WebGLBuffer | null {
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    if (Array.isArray(data)) gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW)
    else gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    return buffer
}

export function createIBO(gl: WebGL2RenderingContext, data: Uint16Array | number[]): WebGLBuffer | null {
    const indexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
    if (Array.isArray(data)) gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data), gl.STATIC_DRAW)
    else gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW)
    return indexBuffer
}

export async function createShader(gl: WebGL2RenderingContext, url: string): Promise<WebGLProgram | null> {
    let shaderCode = ''
    // await axios.get(url).then(response => shaderCode += response.data)
    await fetch(url).then((response) => response.text().then((text) => (shaderCode += text)))
    const vertexShaderStage = compileShader(gl, shaderCode, gl.VERTEX_SHADER)
    const fragmentShaderStage = compileShader(gl, shaderCode, gl.FRAGMENT_SHADER)
    if (!vertexShaderStage || !fragmentShaderStage) return null
    const shader = gl.createProgram()
    gl.attachShader(shader, vertexShaderStage)
    gl.attachShader(shader, fragmentShaderStage)
    gl.linkProgram(shader)
    if (!gl.getProgramParameter(shader, gl.LINK_STATUS)) {
        console.error('An error occurred linking shader stages: ' + gl.getProgramInfoLog(shader))
        return null
    }
    return shader
    function compileShader(gl: WebGL2RenderingContext, source: string, type: number): WebGLShader | null {
        const versionDefinition = '#version 300 es\n'
        const module = gl.createShader(type)
        if (!module) return null
        if (type === gl.VERTEX_SHADER) source = versionDefinition + '#define VERTEX_SHADER\n' + source
        else if (type === gl.FRAGMENT_SHADER) source = versionDefinition + '#define FRAGMENT_SHADER\n' + source
        gl.shaderSource(module, source)
        gl.compileShader(module)
        if (!gl.getShaderParameter(module, gl.COMPILE_STATUS)) {
            console.error('An error occurred compiling the shader module: ' + gl.getShaderInfoLog(module))
            gl.deleteShader(module)
            return null
        }
        return module
    }
}

export function createShaderFromCode(gl: WebGL2RenderingContext, code: string): WebGLProgram | null {
    let shaderCode = code
    const vertexShaderStage = compileShader(gl, shaderCode, gl.VERTEX_SHADER)
    const fragmentShaderStage = compileShader(gl, shaderCode, gl.FRAGMENT_SHADER)
    if (!vertexShaderStage || !fragmentShaderStage) return null
    const shader = gl.createProgram()
    gl.attachShader(shader, vertexShaderStage)
    gl.attachShader(shader, fragmentShaderStage)
    gl.linkProgram(shader)
    if (!gl.getProgramParameter(shader, gl.LINK_STATUS)) {
        console.error('An error occurred linking shader stages: ' + gl.getProgramInfoLog(shader))
        return null
    }
    return shader
    function compileShader(gl: WebGL2RenderingContext, source: string, type: number): WebGLShader | null {
        const versionDefinition = '#version 300 es\n'
        const module = gl.createShader(type)
        if (!module) return null
        if (type === gl.VERTEX_SHADER) source = versionDefinition + '#define VERTEX_SHADER\n' + source
        else if (type === gl.FRAGMENT_SHADER) source = versionDefinition + '#define FRAGMENT_SHADER\n' + source
        gl.shaderSource(module, source)
        gl.compileShader(module)
        if (!gl.getShaderParameter(module, gl.COMPILE_STATUS)) {
            console.error('An error occurred compiling the shader module: ' + gl.getShaderInfoLog(module))
            gl.deleteShader(module)
            return null
        }
        return module
    }
}

export function createFrameBuffer(
    gl: WebGL2RenderingContext,
    textures?: WebGLTexture[],
    depthTexture?: WebGLTexture,
    renderBuffer?: WebGLRenderbuffer,
): WebGLFramebuffer | null {
    const frameBuffer = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer)
    textures?.forEach((texture, index) => {
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + index, gl.TEXTURE_2D, texture, 0)
    })
    if (depthTexture) {
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTexture, 0)
    }
    if (renderBuffer) {
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, renderBuffer)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        console.error('Framebuffer is not complete')
    }
    return frameBuffer
}

export function createTexture2D(
    gl: WebGL2RenderingContext,
    width: number,
    height: number,
    internalFormat: number,
    format: number,
    type: number,
    resource?: TexImageSource,
    filter: number = gl.NEAREST,
    generateMips: boolean = false,
    repeat: boolean = false,
): WebGLTexture | null {
    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    if (repeat) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
    } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, generateMips ? gl.LINEAR_MIPMAP_LINEAR : filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
    resource && gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, resource)
    gl.bindTexture(gl.TEXTURE_2D, null)
    return texture
}

export function createFboPoolforMipmapTexture(
    gl: WebGL2RenderingContext,
    tex: WebGLTexture,
    width: number,
    height: number,
): WebGLFramebuffer[] {
    const levels = calculateMipmapLevels(width, height)
    const fbs: WebGLFramebuffer[] = []
    for (let level = 0; level < levels; ++level) {
        const fb = gl.createFramebuffer()
        fbs.push(fb)
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, level)
    }
    return fbs
}

export function calculateMipmapLevels(width: number, height: number): number {
    let levels = 1
    while (width > 1 || height > 1) {
        width = Math.max(1, width >> 1)
        height = Math.max(1, height >> 1)
        levels++
    }
    return levels
}

export function createProgramFromSource(
    gl: WebGL2RenderingContext,
    vertexShaderCode: string,
    fragmentShaderCode: string,
): WebGLProgram | null {
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)
    if (!vertexShader) return null
    gl.shaderSource(vertexShader, vertexShaderCode)
    gl.compileShader(vertexShader)
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.error('VERTEX_SHADER ERROR:', gl.getShaderInfoLog(vertexShader))
        return null
    }
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
    if (!fragmentShader) return null
    gl.shaderSource(fragmentShader, fragmentShaderCode)
    gl.compileShader(fragmentShader)
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.error('FRAGMENT_SHADER ERROR:', gl.getShaderInfoLog(fragmentShader))
        return null
    }
    const program = gl.createProgram()
    if (!program) return null
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('PROGRAM ERROR:', gl.getProgramInfoLog(program))
        return null
    }
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
    return program
}

export function fillTexture2DByArray(
    gl: WebGL2RenderingContext,
    texture: WebGLTexture,
    width: number,
    height: number,
    internalFormat: number,
    format: number,
    type: number,
    array: ArrayBufferView,
): void {
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, array)
    gl.bindTexture(gl.TEXTURE_2D, null)
}

export function createRenderBuffer(gl: WebGL2RenderingContext, width?: number, height?: number): WebGLRenderbuffer | null {
    const bufferWidth = width || gl.canvas.width * window.devicePixelRatio
    const bufferHeight = height || gl.canvas.height * window.devicePixelRatio
    const renderBuffer = gl.createRenderbuffer()
    gl.bindRenderbuffer(gl.RENDERBUFFER, renderBuffer)
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL, bufferWidth, bufferHeight)
    gl.stencilFunc(gl.ALWAYS, 1, 0xff)
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE)
    gl.bindRenderbuffer(gl.RENDERBUFFER, null)
    return renderBuffer
}

export function getWebGLErrorMessage(gl: WebGL2RenderingContext, error: number): string {
    switch (error) {
        case gl.NO_ERROR:
            return 'NO_ERROR'
        case gl.INVALID_ENUM:
            return 'INVALID_ENUM'
        case gl.INVALID_VALUE:
            return 'INVALID_VALUE'
        case gl.INVALID_OPERATION:
            return 'INVALID_OPERATION'
        case gl.OUT_OF_MEMORY:
            return 'OUT_OF_MEMORY'
        case gl.CONTEXT_LOST_WEBGL:
            return 'CONTEXT_LOST_WEBGL'
        default:
            return 'UNKNOWN_ERROR'
    }
}

export async function loadImage(url: string): Promise<ImageBitmap> {
    try {
        const response = await fetch(url)
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }
        const blob = await response.blob()
        const imageBitmap = await createImageBitmap(blob, {
            imageOrientation: 'flipY',
            premultiplyAlpha: 'none',
            colorSpaceConversion: 'default',
        })
        return imageBitmap
    } catch (error) {
        console.error(`Error loading image (url: ${url})`, error)
        throw error
    }
}

export function getMaxMipLevel(width: number, height: number): number {
    return Math.floor(Math.log2(Math.max(width, height)))
}

export async function loadF32Image(url: string): Promise<{ width: number; height: number; buffer: Float32Array }> {
    // const response = await axios.get(url, { responseType: "blob" })
    const response = await fetch(url).then((res) => res.blob())
    const bitmap = await createImageBitmap(response, {
        imageOrientation: 'flipY',
        premultiplyAlpha: 'none',
        colorSpaceConversion: 'default',
    })
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const gl = canvas.getContext('webgl2') as WebGL2RenderingContext
    const pixelData = new Uint8Array(bitmap.width * bitmap.height * 4)
    const oTexture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, oTexture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, bitmap.width, bitmap.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, bitmap)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    const FBO = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, FBO)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, oTexture, 0)
    gl.readPixels(0, 0, bitmap.width, bitmap.height, gl.RGBA, gl.UNSIGNED_BYTE, pixelData)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.deleteFramebuffer(FBO)
    gl.deleteTexture(oTexture)
    gl.finish()
    return {
        width: bitmap.width,
        height: bitmap.height,
        buffer: new Float32Array(pixelData.buffer),
    }
}
