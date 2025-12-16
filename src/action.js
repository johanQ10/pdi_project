
let imageSrc;
let imageOriginal;
let imageProcessed;
let imageTemporal;
let context;
let bitsPerPixel = 0;
let brightnessLevel = 0;
let contrastLevel = 1;
let colorValue = "#ff0000";
let rotate = false;

let vertexShader = `
    @group(0) @binding(0) var mySampler: sampler;
    @group(0) @binding(1) var myTexture: texture_2d<f32>;

    struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) uv: vec2<f32>
    };

    @vertex
    fn vs_main(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
        var pos = array<vec2<f32>, 6>(
            vec2<f32>(-1.0, -1.0),
            vec2<f32>( 1.0, -1.0),
            vec2<f32>(-1.0,  1.0),
            vec2<f32>(-1.0,  1.0),
            vec2<f32>( 1.0, -1.0),
            vec2<f32>( 1.0,  1.0)
        );
        var uv = array<vec2<f32>, 6>(
            vec2<f32>(0.0, 1.0),
            vec2<f32>(1.0, 1.0),
            vec2<f32>(0.0, 0.0),
            vec2<f32>(0.0, 0.0),
            vec2<f32>(1.0, 1.0),
            vec2<f32>(1.0, 0.0)
        );
        var output: VertexOutput;
        output.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
        output.uv = uv[vertexIndex];
        return output;
    }
    `;

// --- Shaders --- //
function generalShader(imgWidth, imgHeight, canvasSize) {
    // Calcula los márgenes en UV
    const offsetX = (canvasSize - imgWidth) / 2 / canvasSize;
    const offsetY = (canvasSize - imgHeight) / 2 / canvasSize;
    const scaleX = imgWidth / canvasSize;
    const scaleY = imgHeight / canvasSize;

    return vertexShader + `
    @fragment
    fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
        return textureSample(myTexture, mySampler, input.uv);
        // let uv = input.uv;
        // let imgUV = vec2<f32>((uv.x - ${offsetX}) / ${scaleX}, (uv.y - ${offsetY}) / ${scaleY});
        // let inImage = all(imgUV >= vec2<f32>(0.0, 0.0)) && all(imgUV <= vec2<f32>(1.0, 1.0));
        // let color = textureSample(myTexture, mySampler, clamp(imgUV, vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 1.0)));
        // let mask = f32(inImage);
        // return vec4<f32>(color.rgb * mask, color.a * mask) + vec4<f32>(0.0, 0.0, 0.0, 1.0) * (1.0 - mask);
    }
    `;
}

function erosionShader() {
    return vertexShader + 
    `
    @fragment
    fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
        let texSize = vec2<f32>(textureDimensions(myTexture, 0));
        let pixel = input.uv * texSize;
        var minVal = 1.0;
        for(var y: i32 = -1; y <= 1; y++) {
            for(var x: i32 = -1; x <= 1; x++) {
                let coord = (pixel + vec2<f32>(f32(x), f32(y))) / texSize;
                let color = textureSample(myTexture, mySampler, coord);
                let prom = (color.r + color.g + color.b) / 3.0;
                minVal = min(minVal, prom);
            }
        }
        return vec4<f32>(minVal, minVal, minVal, 1.0);
    }
    `;
}

function dilatationShader() {
    return vertexShader + 
    `
    @fragment
    fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
        let texSize = vec2<f32>(textureDimensions(myTexture, 0));
        let pixel = input.uv * texSize;
        var maxVal = 0.0;
        for(var y: i32 = -1; y <= 1; y++) {
            for(var x: i32 = -1; x <= 1; x++) {
                let coord = (pixel + vec2<f32>(f32(x), f32(y))) / texSize;
                let color = textureSample(myTexture, mySampler, coord);
                let prom = (color.r + color.g + color.b) / 3.0;
                maxVal = max(maxVal, prom);
            }
        }
        return vec4<f32>(maxVal, maxVal, maxVal, 1.0);
    }
    `;
}

function grayScaleShader() {
    return vertexShader + 
    `
    @fragment
    fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
        let color = textureSample(myTexture, mySampler, input.uv);
        let promColor = 0.21 * color.r + 0.72 * color.g + 0.07 * color.b;
        // let promColor = (color.r + color.g + color.b) / 3.0;
        return vec4<f32>(promColor, promColor, promColor, color.a);
    }
    `;
}

function negativeShader() {
    return vertexShader + 
    `
    @fragment
    fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
        let color = textureSample(myTexture, mySampler, input.uv);
        let r = 1.0 - color.r;
        let g = 1.0 - color.g;
        let b = 1.0 - color.b;
        return vec4<f32>(r, g, b, color.a);
    }
    `;
}

function colorScaleShader(color) {
    const r = parseInt(color.substring(1, 3), 16) / 255.0;
    const g = parseInt(color.substring(3, 5), 16) / 255.0;
    const b = parseInt(color.substring(5, 7), 16) / 255.0;

    return vertexShader + 
    `
    @fragment
    fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
        let color = textureSample(myTexture, mySampler, input.uv);
        let promColor = 0.21 * color.r + 0.72 * color.g + 0.07 * color.b;

        var r = ${r} * 1.0;
        var g = ${g} * 1.0;
        var b = ${b} * 1.0;

        if (promColor < 0.5) {
            r = r * promColor / 0.5;
            g = g * promColor / 0.5;
            b = b * promColor / 0.5;
        } else {
            r = r + (1.0 - r) * (promColor - 0.5) / 0.5;
            g = g + (1.0 - g) * (promColor - 0.5) / 0.5;
            b = b + (1.0 - b) * (promColor - 0.5) / 0.5;
        }

        r = clamp(r, 0.0, 1.0);
        g = clamp(g, 0.0, 1.0);
        b = clamp(b, 0.0, 1.0);

        return vec4<f32>(r, g, b, 1.0);
    }
    `;
}

function brightnessShader(brightnessLevel) {
    return vertexShader + 
    `
    @fragment
    fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
        let color = textureSample(myTexture, mySampler, input.uv);
        var r = color.r + ${brightnessLevel};
        var g = color.g + ${brightnessLevel};
        var b = color.b + ${brightnessLevel};

        r = clamp(r, 0.0, 1.0);
        g = clamp(g, 0.0, 1.0);
        b = clamp(b, 0.0, 1.0);

        return vec4<f32>(r, g, b, color.a);
    }
    `;
}

function contrastShader(contrastLevel) {
    return vertexShader + 
    `
    @fragment
    fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
        let color = textureSample(myTexture, mySampler, input.uv);
        var r = (color.r - 0.5) * ${contrastLevel} + 0.5;
        var g = (color.g - 0.5) * ${contrastLevel} + 0.5;
        var b = (color.b - 0.5) * ${contrastLevel} + 0.5;

        r = clamp(r, 0.0, 1.0);
        g = clamp(g, 0.0, 1.0);
        b = clamp(b, 0.0, 1.0);

        return vec4<f32>(r, g, b, color.a);
    }
    `;
}

function zoomProxShader(zoomLevel) {
    return vertexShader + 
    `
    @fragment
    fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
        let center = vec2<f32>(0.5, 0.5);
        let uvZoom = (input.uv - center) / ${zoomLevel} + center;
        let texSize = vec2<f32>(textureDimensions(myTexture, 0));
        let uvNearest = floor(uvZoom * texSize) / texSize;

        return textureSample(myTexture, mySampler, uvNearest);
    }
    `;
}

function zoomBilinealShader(zoomLevel) {
    return vertexShader + 
    `
    @fragment
    fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
        let center = vec2<f32>(0.5, 0.5);
        let uvZoom = (input.uv - center) / ${zoomLevel} + center;
        let uvClamped = clamp(uvZoom, vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 1.0));

        return textureSample(myTexture, mySampler, uvClamped);
    }
    `;
}

function gammaShader(gammaValue) {
    return vertexShader + 
    `
    @fragment
    fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
        let color = textureSample(myTexture, mySampler, input.uv);
        var r = pow(color.r, 1.0 / ${gammaValue});
        var g = pow(color.g, 1.0 / ${gammaValue});
        var b = pow(color.b, 1.0 / ${gammaValue});

        r = clamp(r, 0.0, 1.0);
        g = clamp(g, 0.0, 1.0);
        b = clamp(b, 0.0, 1.0);

        return vec4<f32>(r, g, b, color.a);
    }
    `;
}

function umbralSimpleShader(umbral) {
    return vertexShader + 
    `
    @fragment
    fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
        let color = textureSample(myTexture, mySampler, input.uv);
        var promColor = 0.21 * color.r + 0.72 * color.g + 0.07 * color.b;

        if (promColor < ${umbral}) {
            promColor = 0.0;
        } else {
            promColor = 1.0;
        }

        return vec4<f32>(promColor, promColor, promColor, color.a);
    }
    `;
}

function umbralMultipleShader(umbrales) {
    let conditions = `
    @fragment
    fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
        let color = textureSample(myTexture, mySampler, input.uv);
        var promColor = 0.21 * color.r + 0.72 * color.g + 0.07 * color.b;`;

    umbrales.sort((a, b) => a - b);

    let prev = 0.0;
    let binary = 0.0;

    for (let i = 0; i < umbrales.length; i++) {
        const umbral = umbrales[i];
        conditions += `
        if (promColor >= ${prev} && promColor < ${umbral}) {
            promColor = ${binary};
        }
        `;
        prev = umbral;
        binary = 1.0 - binary;
    }

    conditions += `
        if (promColor >= ${prev} && promColor < ${1.0}) {
            promColor = ${binary};
        }
        `;

    conditions += `
        return vec4<f32>(promColor, promColor, promColor, color.a);
    }
    `;

    return vertexShader + conditions;
}

function flipHorizontalShader() {
    return vertexShader + 
    `
    @fragment
    fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
        let uvFlipped = vec2<f32>(1.0 - input.uv.x, input.uv.y);
        let color = textureSample(myTexture, mySampler, uvFlipped);
        return color;
    }
    `;
}

function flipVerticalShader() {
    return vertexShader + 
    `
    @fragment
    fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
        let uvFlipped = vec2<f32>(input.uv.x, 1.0 - input.uv.y);
        let color = textureSample(myTexture, mySampler, uvFlipped);
        return color;
    }
    `;
}

function rotateShader(value) {
    if (value / 90 % 2 != 0)
        rotate = true;
    else rotate = false;

    let diff = value / 90;

    if (diff < 0)
        diff = -diff;

    while (diff > 3) {
        diff -= 4;
    }

    return vertexShader + 
    `
    @fragment
    fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
        var uvRotate = vec2<f32>(input.uv.x, input.uv.y);

        if (${value} > 0) {
            if (${diff} == 1.0) {
                uvRotate = vec2<f32>(input.uv.y, 1.0 - input.uv.x);
            } 
            else if (${diff} == 2.0) {
                uvRotate = vec2<f32>(1.0 -input.uv.x, 1.0 - input.uv.y);
            }
            else if (${diff} == 3.0) {
                uvRotate = vec2<f32>(1.0 - input.uv.y, input.uv.x);
            }
        } else {
            if (${diff} == 1.0) {
                uvRotate = vec2<f32>(1.0 - input.uv.y, input.uv.x);
            } 
            else if (${diff} == 2.0) {
                uvRotate = vec2<f32>(1.0 -input.uv.x, 1.0 - input.uv.y);
            }
            else if (${diff} == 3.0) {
                uvRotate = vec2<f32>(input.uv.y, 1.0 - input.uv.x);
            }
        }

        let color = textureSample(myTexture, mySampler, uvRotate);
        return color;
    }
    `;
}

// Filter Shaders
function filterShader(kernel, kw, kh) {
    return vertexShader +
        `
        @fragment
        fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
            let texSize = vec2<f32>(textureDimensions(myTexture, 0));
            let pixel = input.uv * texSize; // coordenada de pixel a modificar
            var result = vec3<f32>(0.0, 0.0, 0.0);

            let kernel = array<array<f32, ${kw}>, ${kh}>(
                ${kernel}
            );

            let kHalfX = ${Math.floor(kw / 2)};
            let kHalfY = ${Math.floor(kh / 2)};

            for (var y: i32 = 0; y < ${kh}; y = y + 1) {
                for (var x: i32 = 0; x < ${kw}; x = x + 1) {
                    let offset = vec2<f32>(f32(x - kHalfX), f32(y - kHalfY)); // ancla
                    let coord = (pixel + offset) / texSize; // coordenada de pixel vecino
                    let color = textureSample(myTexture, mySampler, clamp(coord, vec2<f32>(0.0), vec2<f32>(1.0))); // color del pixel vecino
                    let k = kernel[y][x]; // valor del kernel, mosca con indices negativos

                    result = result + vec3<f32>(color.r * k, color.g * k, color.b * k);
                }
            }
            result = clamp(result, vec3<f32>(0.0), vec3<f32>(1.0));
            return vec4<f32>(result, 1.0);   
        }
        `;
}

function borderShader(mKernelX, mKernelY, kw, kh) {
    let kernelX = '';
    let kernelY = '';

    for (let i = 0; i < kh; i++) {
        kernelX += 'array<f32, ' + kw + '>(';
        for (let j = 0; j < kw; j++) {
            kernelX += mKernelX[i][j];
            if (j < kw - 1)
                kernelX += ', ';
        }
        kernelX += '),\n';
    }

    for (let i = 0; i < kh; i++) {
        kernelY += 'array<f32, ' + kw + '>(';
        for (let j = 0; j < kw; j++) {
            kernelY += mKernelY[i][j];
            if (j < kw - 1)
                kernelY += ', ';
        }
        kernelY += '),\n';
    }

    return vertexShader +
        `
        @fragment
        fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
            let texSize = vec2<f32>(textureDimensions(myTexture, 0));
            let pixel = input.uv * texSize; // coordenada de pixel a modificar
            var resultX = vec3<f32>(0.0, 0.0, 0.0);
            var resultY = vec3<f32>(0.0, 0.0, 0.0);

            let kernelX = array<array<f32, ${kw}>, ${kh}>(
                ${kernelX}
            );
            let kernelY = array<array<f32, ${kw}>, ${kh}>(
                ${kernelY}
            );

            let kHalfX = ${Math.floor(kw / 2)};
            let kHalfY = ${Math.floor(kh / 2)};

            for (var y: i32 = 0; y < ${kh}; y = y + 1) {
                for (var x: i32 = 0; x < ${kw}; x = x + 1) {
                    let offset = vec2<f32>(f32(x - kHalfX), f32(y - kHalfY));
                    let coord = (pixel + offset) / texSize;
                    let color = textureSample(myTexture, mySampler, clamp(coord, vec2<f32>(0.0), vec2<f32>(1.0)));
                    let k = kernelX[y][x];

                    resultX = resultX + vec3<f32>(color.r * k, color.g * k, color.b * k);
                }
            }
            for (var y: i32 = 0; y < ${kh}; y = y + 1) {
                for (var x: i32 = 0; x < ${kw}; x = x + 1) {
                    let offset = vec2<f32>(f32(x - kHalfX), f32(y - kHalfY));
                    let coord = (pixel + offset) / texSize;
                    let color = textureSample(myTexture, mySampler, clamp(coord, vec2<f32>(0.0), vec2<f32>(1.0)));
                    let k = kernelY[y][x];

                    resultY = resultY + vec3<f32>(color.r * k, color.g * k, color.b * k);
                }
            }

            var result = sqrt(resultX * resultX + resultY * resultY);
            result = clamp(result, vec3<f32>(0.0), vec3<f32>(1.0));
            return vec4<f32>(result, 1.0);   
        }
        `;
}

function averageShader(kw, kh) {
    let kernel = '';
    let count = kw * kh;

    for (let i = 0; i < kh; i++) {
        kernel += '    array<f32, ' + kw + '>(';
        for (let j = 0; j < kw; j++) {
            kernel += '1.0 / ' + count.toString();

            if (j < kw - 1)
                kernel += ', ';
        }
        kernel += '),\n';
    }

    return filterShader(kernel, kw, kh);
}

function medianShader(kw, kh) {
    let kernel = '';

    for (let i = 0; i < kh; i++) {
        kernel += '    array<f32, ' + kw + '>(';
        for (let j = 0; j < kw; j++) {
            kernel += '1.0';

            if (j < kw - 1)
                kernel += ', ';
        }
        kernel += '),\n';
    }

    return vertexShader +
        `
        @fragment
        fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
            let texSize = vec2<f32>(textureDimensions(myTexture, 0));
            let pixel = input.uv * texSize; // coordenada de pixel a modificar
            var result = vec3<f32>(0.0, 0.0, 0.0);

            let kernel = array<array<f32, ${kw}>, ${kh}>(
                ${kernel}
            );
            var values = array<vec3<f32>, ${kw * kh}>();
            var index = 0;

            let kHalfX = ${Math.floor(kw / 2)};
            let kHalfY = ${Math.floor(kh / 2)};

            for (var y: i32 = 0; y < ${kh}; y = y + 1) {
                for (var x: i32 = 0; x < ${kw}; x = x + 1) {
                    let offset = vec2<f32>(f32(x - kHalfX), f32(y - kHalfY));
                    let coord = (pixel + offset) / texSize;
                    let color = textureSample(myTexture, mySampler, clamp(coord, vec2<f32>(0.0), vec2<f32>(1.0)));
                    let k = kernel[y][x];

                    values[index] = vec3<f32>(color.r * k, color.g * k, color.b * k);
                    index = index + 1;
                }
            }

            for (var i: i32 = 0; i < ${kw * kh} - 1; i = i + 1) {
                for (var j: i32 = 0; j < ${kw * kh} - 1 - i; j = j + 1) {
                    let valueJ = (values[j].r + values[j].g + values[j].b) / 3.0;
                    let valueJ1 = (values[j + 1].r + values[j + 1].g + values[j + 1].b) / 3.0;

                    if (valueJ > valueJ1) {
                        let tmp = values[j];
                        values[j] = values[j + 1];
                        values[j + 1] = tmp;
                    }
                }
            }
            
            result = values[index / 2];
            result = clamp(result, vec3<f32>(0.0), vec3<f32>(1.0));
            return vec4<f32>(result, 1.0);   
        }
        `;
}

function gaussianShader(kw, kh) {
    let kernel = '';
    let x = 1;
    let y = 1;
    let parX = 0;
    let parY = 0;
    let sum = 0;
    let midX = Math.floor(kw / 2);
    let midY = Math.floor(kh / 2);

    const matrix = [];

    if (kw % 2 == 0) parX = 1;
    if (kh % 2 == 0) parY = 1;

    for (let i = 0; i < kh; i++) {
        const file = [];

        for (let j = 0; j < kw; j++) {
            file.push(x);
            sum += x;

            if (parX) {
                if (j < midX - 1)
                    x++;
                else if (j > midX - 1)
                    x--;
            } else {
                if (j < midX)
                    x++;
                else x--;
            }
        }

        if (parY) {
            if (i < midY - 1)
                y++;
            else if (i > midY - 1)
                y--;
        } else {
            if (i < midY)
                y++;
            else y--;
        }

        x = y;

        matrix.push(file);
    }

    for (let i = 0; i < kh; i++) {
        kernel += 'array<f32, ' + kw + '>(';
        for (let j = 0; j < kw; j++) {
            kernel += (matrix[i][j] / sum).toFixed(6);
            if (j < kw - 1)
                kernel += ', ';
        }
        kernel += '),\n';
    }

    return filterShader(kernel, kw, kh);
}

function prewittShader(kw, kh) {
    const prewittX = [];
    const prewittY = [];

    let parX = 0;
    let parY = 0;

    if (kw % 2 == 0) parX = 1;
    if (kh % 2 == 0) parY = 1;

    for (let i = 0; i < kh; i++) {
        const fileX = [];
        const fileY = [];

        for (let j = 0; j < kw; j++) {
            if (parX) {
                if (j < Math.floor(kw / 2))
                    fileX.push(-1);
                else if (j >= Math.floor(kw / 2))
                    fileX.push(1);
            } else {
                if (j < Math.floor(kw / 2))
                    fileX.push(-1);
                else if (j > Math.floor(kw / 2))
                    fileX.push(1);
                else fileX.push(0);
            }

            if (parY) {
                if (i < Math.floor(kh / 2))
                    fileY.push(-1);
                else if (i >= Math.floor(kh / 2))
                    fileY.push(1);
            } else {
                if (i < Math.floor(kh / 2))
                    fileY.push(-1);
                else if (i > Math.floor(kh / 2))
                    fileY.push(1);
                else fileY.push(0);
            }
        }
        prewittX.push(fileX);
        prewittY.push(fileY);
    }

    return borderShader(prewittX, prewittY, kw, kh);
}

function sobelShader(kw, kh) {
    const sobelX = [];
    const sobelY = [];

    let parX_X = 0;
    let parY_X = 0;
    let parX_Y = 0;
    let parY_Y = 0;

    if (kw % 2 == 0) parX_X = 1;
    if (kh % 2 == 0) parY_X = 1;
    if (kw % 2 == 0) parX_Y = 1;
    if (kh % 2 == 0) parY_Y = 1;

    let x_X = 1;
    let y_X = 1;

    let x_Y = 1;
    let y_Y = 1;

    const midX = Math.floor(kw / 2);

    for (let i = 0; i < kh; i++) {
        const fileX = [];
        const fileY = [];

        for (let j = 0; j < kw; j++) {
            if (parX_X) {
                if (j < midX) {
                    fileX.push(-x_X);

                    if (j < midX - 1)
                        x_X++;
                } else if (j >= midX) {
                    fileX.push(x_X);
                    x_X--;
                }
            } else {
                if (j < midX) {
                    fileX.push(-x_X);
                    x_X++;
                } else if (j > midX) {
                    fileX.push(x_X);
                    x_X--;
                } else {
                    fileX.push(0);
                    x_X--;
                }
            }

            if (parX_Y) {
                let value = x_Y;

                if (i == midX && !parY_Y)
                    fileY.push(0);
                else {
                    if (i < midX)
                        value = -value;

                    if (j < midX) {
                        fileY.push(value);

                        if (j < midX - 1)
                            x_Y++;
                    } else if (j >= midX) {
                        fileY.push(value);
                        x_Y--;
                    }
                }
            } else {
                let value = x_Y;

                if (i == midX && !parY_Y)
                    fileY.push(0);
                else {
                    if (i < midX)
                        value = -value;

                    if (j < midX) {
                        fileY.push(value);
                        x_Y++;
                    } else {
                        fileY.push(value);
                        x_Y--;
                    }
                }
            }
        }

        if (parY_X) {
            if (i < midX - 1)
                y_X++;
            else if (i > midX - 1)
                y_X--;
        } else {
            if (i < midX)
                y_X++;
            else y_X--;
        }

        if (parY_Y) {
            if (i < midX - 1)
                y_Y++;
            else if (i > midX - 1)
                y_Y--;
        } else {
            if (i < midX)
                y_Y++;
            else y_Y--;
        }

        sobelX.push(fileX);
        sobelY.push(fileY);

        x_X = y_X;
        x_Y = y_Y;
    }

    return borderShader(sobelX, sobelY, kw, kh);
}

function robertsShader(kw, kh) {
    const robertsX = [];
    const robertsY = [];

    for (let i = 0; i < kh; i++) {
        const fileX = [];
        const fileY = [];
        for (let j = 0; j < kw; j++) {
            fileX.push(0);
            fileY.push(0);
        }
        robertsX.push(fileX);
        robertsY.push(fileY);
    }

    robertsX[0][0] = 1;
    robertsX[kh - 1][kw - 1] = -1;

    robertsY[0][kw - 1] = 1;
    robertsY[kh - 1][0] = -1;

    return borderShader(robertsX, robertsY, kw, kh);
}

function sharpenShader(kw, kh) {
    let matrix = [];
    const size = kw;

    if (size === 3) {
        matrix = [
            [ 0, -1,  0],
            [-1,  5, -1],
            [ 0, -1,  0]
        ];
    }
    if (size === 5) {
        matrix = [
            [ 0,  0, -1,  0,  0],
            [ 0, -1, -2, -1,  0],
            [-1, -2, 17, -2, -1],
            [ 0, -1, -2, -1,  0],
            [ 0,  0, -1,  0,  0]
        ];
    }
    if (size === 7) {
        matrix = [
            [ 0,  0,  0, -1,  0,  0,  0],
            [ 0,  0, -1, -2, -1,  0,  0],
            [ 0, -1, -2, -3, -2, -1,  0],
            [-1, -2, -3, 41, -3, -2, -1],
            [ 0, -1, -2, -3, -2, -1,  0],
            [ 0,  0, -1, -2, -1,  0,  0],
            [ 0,  0,  0, -1,  0,  0,  0]
        ];
    }

    let kernel = '';

    for (let i = 0; i < kh; i++) {
        kernel += 'array<f32, ' + kw + '>(';
        for (let j = 0; j < kw; j++) {
            kernel += matrix[i][j];
            if (j < kw - 1)
                kernel += ', ';
        }
        kernel += '),\n';
    }

    return filterShader(kernel, kw, kh);
}
// --- End Shaders --- //

// --- Calculates Functions --- //
function profileCurveLine() {
    let image = imageTemporal;
    const canvas = document.createElement('canvas');

    canvas.width = image.naturalWidth;
    canvas.height = 256;

    const ctx = canvas.getContext('2d');

    ctx.drawImage(image, 0, 0);

    const width = canvas.width;
    const height = canvas.height;

    const imageData = ctx.getImageData(0, height / 2, width, 1).data;
    const profile = [];

    for (let x = 0; x < imageData.length; x += 4) {
        const intensidad = Math.round(0.299 * imageData[x] + 0.587 * imageData[x + 1] + 0.114 * imageData[x + 2]);
        profile.push(intensidad);
    }

    // Dibuja la curva en otro canvas (por ejemplo, id="perfil-canvas")
    const profileCanvas = document.getElementById('profile-curve-canvas');
    const profileCtx = profileCanvas.getContext('2d');

    profileCanvas.width = width;
    profileCanvas.height = height;

    profileCtx.clearRect(0, 0, profileCanvas.width, profileCanvas.height);
    profileCtx.beginPath();
    profileCtx.moveTo(0, profileCanvas.height - profile[0]);

    for (let x = 1; x < profile.length; x++) {
        profileCtx.lineTo(x, profileCanvas.height - profile[x]);
    }

    profileCtx.strokeStyle = 'blue';
    profileCtx.lineWidth = 5;
    profileCtx.stroke();
}

function goToTonalCurve() {
    const curva = tonalCurveCalculate(imageOriginal, imageTemporal);
    toneCurveDraw(x => curva[x]);
}

function tonalCurveCalculate(imgOriginal, imgTemporal) {
    const canvasO = document.createElement('canvas');
    const canvasT = document.createElement('canvas');

    canvasO.width = imgOriginal.naturalWidth;
    canvasO.height = imgOriginal.naturalHeight;
    canvasT.width = imgTemporal.naturalWidth;
    canvasT.height = imgTemporal.naturalHeight;

    const ctxO = canvasO.getContext('2d');
    const ctxT = canvasT.getContext('2d');

    ctxO.drawImage(imgOriginal, 0, 0);
    ctxT.drawImage(imgTemporal, 0, 0);

    const dataO = ctxO.getImageData(0, 0, canvasO.width, canvasO.height).data;
    const dataT = ctxT.getImageData(0, 0, canvasT.width, canvasT.height).data;

    const sum = new Array(256).fill(0);
    const count = new Array(256).fill(0);

    for (let i = 0; i < dataO.length; i += 4) {
        const grayO = Math.round(0.299 * dataO[i] + 0.587 * dataO[i + 1] + 0.114 * dataO[i + 2]);
        const grayT = Math.round(0.299 * dataT[i] + 0.587 * dataT[i + 1] + 0.114 * dataT[i + 2]);

        sum[grayO] += grayT;
        count[grayO]++;
    }

    // Calcula el promedio de salida para cada valor de entrada
    const tonalCurve = new Array(256).fill(0);

    for (let i = 0; i < 256; i++)
        tonalCurve[i] = count[i] > 0 ? sum[i] / count[i] : 0;

    return tonalCurve;
}

function toneCurveDraw(mappingFunction) {
    const canvas = document.getElementById('tonal-curve-canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);

    ctx.beginPath();
    ctx.moveTo(0, 256 - mappingFunction(0));

    for (let x = 0; x < 256; x++) {
        const y = mappingFunction(x);
        ctx.lineTo(x, 256 - y);
    }

    ctx.strokeStyle = 'blue';
    ctx.lineWidth = 2;
    ctx.stroke();
}

function goToHistogram() {
    histogramDraw(histogramCalculate(imageTemporal, 'rgb'), document.getElementById('histogram-rgb-canvas'), 'purple');
    histogramDraw(histogramCalculate(imageTemporal, 'r'), document.getElementById('histogram-r-canvas'), 'red');
    histogramDraw(histogramCalculate(imageTemporal, 'g'), document.getElementById('histogram-g-canvas'), 'green');
    histogramDraw(histogramCalculate(imageTemporal, 'b'), document.getElementById('histogram-b-canvas'), 'blue');
}

function histogramCalculate(image, type) {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const histograma = new Array(256).fill(0);

    for (let i = 0; i < data.length; i += 4) {
        let value;
        if (type === 'rgb') value = Math.round(0.21 * data[i] + 0.72 * data[i + 1] + 0.07 * data[i + 2]);
        if (type === 'r') value = data[i];
        if (type === 'g') value = data[i + 1];
        if (type === 'b') value = data[i + 2];

        histograma[value]++;
    }

    return histograma;
}

function histogramDraw(histogram, canvas, color) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);

    const max = Math.max(...histogram);

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;

    for (let i = 0; i < 256; i++) {
        const barHeight = histogram[i] * 256 / max;

        ctx.beginPath();
        ctx.moveTo(i, 256);
        ctx.lineTo(i, 256 - barHeight);
        ctx.stroke();
    }
}
// --- End Calculates Functions --- //

// --- Image Functions --- //
function exportPPM(imageData, width, height) {
    let header = `P3\n${width} ${height}\n255\n`;
    let body = '';

    for (let i = 0; i < imageData.length; i += 4) {
        body += `${imageData[i]} ${imageData[i + 1]} ${imageData[i + 2]} `;

        if (((i / 4 + 1) % width) === 0) 
            body += '\n';
    }

    return header + body;
}
function exportPGM(imageData, width, height) {
    let header = `P2\n${width} ${height}\n255\n`;
    let body = '';

    for (let i = 0; i < imageData.length; i += 4) {
        body += imageData[i] + ' ';

        if (((i / 4 + 1) % width) === 0) 
            body += '\n';
    }

    return header + body;
}
function exportPBM(imageData, width, height) {
    let header = `P1\n${width} ${height}\n`;
    let body = '';

    for (let i = 0; i < imageData.length; i += 4) {
        body += (imageData[i] >= 127 ? 0 : 1) + ' ';

        if (((i / 4 + 1) % width) === 0)
            body += '\n';
    }

    return header + body;
}

function detectImageType(imageData) {
    let isGray = true;
    let isBinary = true;

    for (let i = 0; i < imageData.length; i += 4) {
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];

        if (!(r === g && g === b)) isGray = false;
        if (!(r === 0 || r === 255) || !(g === 0 || g === 255) || !(b === 0 || b === 255) || r !== g || g !== b) isBinary = false;
        if (!isGray && !isBinary) break;
    }

    if (isBinary) {
        alert('b');
        return 'b';
    }
    if (isGray) {
        alert('g');
        return 'g';
    }

    alert('c');
    return 'c';
}

function saveNetpbm() {
    const image = imageTemporal;
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    const canvas = document.createElement('canvas');

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    const imageData = ctx.getImageData(0, 0, width, height).data;
    const type = detectImageType(imageData);
    let content = '', ext = '';

    if (type === 'b') {
        content = exportPBM(imageData, width, height);
        ext = 'pbm';
    } else if (type === 'g') {
        content = exportPGM(imageData, width, height);
        ext = 'pgm';
    } else {
        content = exportPPM(imageData, width, height);
        ext = 'ppm';
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `imageNetpbm.${ext}`;
    link.click();
}

function savePng() {
    const image = imageTemporal;
    const width = image.naturalWidth;
    const height = image.naturalHeight;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    const imageData = ctx.getImageData(0, 0, width, height).data;
    const type = detectImageType(imageData);

    if (type === 'b' || type === 'g') {
        for (let i = 0; i < imageData.length; i += 4) {
            let v;

            if (type === 'b') {
                v = (imageData[i] > 127) ? 255 : 0;
            } else {
                v = Math.round(0.299 * imageData[i] + 0.587 * imageData[i + 1] + 0.114 * imageData[i + 2]);
            }

            imageData[i] = imageData[i+1] = imageData[i+2] = v;
        }
        const newImageData = new ImageData(imageData, width, height);
        ctx.putImageData(newImageData, 0, 0);
    }

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = 'imagePng.png';
    link.click();
}

function saveBmp() {
    const image = imageTemporal;
    const width = image.naturalWidth;
    const height = image.naturalHeight;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    const imageData = ctx.getImageData(0, 0, width, height).data;
    const type = detectImageType(imageData);

    if (type === 'b' || type === 'g') {
        for (let i = 0; i < imageData.length; i += 4) {
            let v;

            if (type === 'b') {
                v = (imageData[i] > 127) ? 255 : 0;
            } else {
                v = Math.round(0.299 * imageData[i] + 0.587 * imageData[i + 1] + 0.114 * imageData[i + 2]);
            }

            imageData[i] = imageData[i + 1] = imageData[i + 2] = v;
        }
        const newImageData = new ImageData(imageData, width, height);
        ctx.putImageData(newImageData, 0, 0);
    }

    if (typeof CanvasToBMP !== 'undefined') {
        // const bmpData = CanvasToBMP.toBMP(canvas);
        // const blob = new Blob([bmpData], { type: 'image/bmp' });
        CanvasToBMP.toBlob(canvas, function(blob) {
            const link = document.createElement('a');

            link.href = URL.createObjectURL(blob);
            link.download = 'imageBmp.bmp';
            link.click();
        });
    } else {
        alert('Para exportar BMP, incluye canvas-to-bmp.js en tu proyecto.');
    }
}
// --- End Image Functions --- //

// --- Utility Functions --- //
function updateSidebar() {
    // Menu responsive
    const sidebar = document.getElementById('sidebar');
    const hamburger = document.getElementById('hamburger-btn');

    hamburger.addEventListener('click', () => {
        sidebar.classList.toggle('show');
        sidebar.classList.toggle('hide');
    });

    if (window.innerWidth <= 700) {
        sidebar.classList.add('hide');
    } else {
        sidebar.classList.remove('hide');
        sidebar.classList.remove('show');
    }
}

function render(device, context, pipeline, bindGroup, canvas, override) {
    const commandEncoder = device.createCommandEncoder();
    const textureView = context.getCurrentTexture().createView();
    const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
            view: textureView,
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: 'clear',
            storeOp: 'store',
        }],
    });

    renderPass.setPipeline(pipeline);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.draw(6, 1, 0, 0);
    renderPass.end();

    device.queue.submit([commandEncoder.finish()]);

    imageSrc = canvas.toDataURL('image/png');

    if (override) {
        resetValues();
        imageProcessed.src = imageSrc;
    }

    imageTemporal.src = imageSrc;

    imageTemporal.onload = function() {
        profileCurveLine();
        goToTonalCurve();
        goToHistogram();
    }

    if (imageTemporal.complete) {
        profileCurveLine();
        goToTonalCurve();
        goToHistogram();
    }
}

function getImageInfo() {
    const canvas = document.createElement('canvas');
    canvas.width = imageProcessed.naturalWidth;
    canvas.height = imageProcessed.naturalHeight;

    const ctx = canvas.getContext('2d');

    ctx.drawImage(imageProcessed, 0, 0);

    const imageData = ctx.getImageData(0, 0, imageProcessed.naturalWidth, imageProcessed.naturalHeight);
    const data = imageData.data;

    const colors = new Set();

    for (let i = 0; i < data.length; i += 4) {
        let str = `${data[i]},${data[i + 1]},${data[i + 2]},${data[i + 3]}`;
        colors.add(str);
    }

    alert(`
        IMAGEN
        Dimensiones: ${imageProcessed.naturalWidth} x ${imageProcessed.naturalHeight} px
        Bit por píxel: ${bitsPerPixel} bits,
        Colores únicos: ${colors.size}
    `);
}

function getBitsPerPixel(file) {
    const fileReader = new FileReader();

    fileReader.onload = function(ev) {
        const bytes = new Uint8Array(ev.target.result);

        if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) { // GIF
            bitsPerPixel = (bytes[10] & 0b00000111) + 1;
        } 
        else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) { // PNG
            const bitsPerChannel = bytes[24];
            const colorType = bytes[25];
            let channels = 0;

            switch (colorType) {
                case 0: channels = 1; break; // Grayscale
                case 2: channels = 3; break; // RGB: color
                case 3: channels = 1; break; // Indexed: color, palette
                case 4: channels = 2; break; // Grayscale + Alpha
                case 6: channels = 4; break; // RGBA: color + Alpha
                default: channels = 0;
            }
            bitsPerPixel = bitsPerChannel * channels;
        }
        else if (bytes[0] === 0xFF && bytes[1] === 0xD8) { // JPEG/JPG
            for (let i = 2; i < bytes.length - 1; i++) {
                if (bytes[i] === 0xFF && bytes[i + 1] === 0xC0) {
                    const bitsPerChannel = bytes[i + 4];
                    const channels = bytes[i + 9];
                    bitsPerPixel = bitsPerChannel * channels;
                    break;
                }
            }
        }
        else if (bytes[0] === 0x42 && bytes[1] === 0x4D) { // BMP
            bitsPerPixel = bytes[28];
        }
        else {
            alert('Formato no soportado para la información de bits por píxel');
        }
    };

    fileReader.readAsArrayBuffer(file.slice(0, 5000));
}

function resetValues() {
    brightnessLevel = 0;
    contrastLevel = 1;
    zoomLevel = 1;

    document.getElementById('brightness-input').value = 0;
    document.getElementById('contrast-input').value = 1;
}

function isValidKernel(x, y) {
    if (x < 1 || y < 1 || x > 7 || y > 7 || (x == 1 && y == 1)) {
        alert('Tiene que ser minimo 2x1 o 1x2 y maximo 7x7');
        return false;
    }
    return true;
}

function isValidKernelSharpen(x, y) {
    if (x != y || x < 3 || y < 3 || x > 7 || y > 7 || x % 2 == 0 || y % 2 == 0) {
        alert('Tiene que ser minimo 3x3 y maximo 7x7, tiene que ser cuadrada y dimensiones impar');
        return false;
    }
    return true;
}
// --- End Utility Functions --- //

// Main function
async function initWebGPU(shaderCode, override = false) {
    let image;

    // if (override)
        image = imageProcessed;
    // else image = imageTemporal;

    const canvas = document.getElementById('gpu-canvas');

    if (!navigator.gpu) {
        alert('WebGPU no es soportado en este navegador.');
        throw new Error('WebGPU no soportado');
    }

    // Inicializa el adaptador y el dispositivo
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();

    // Configura el contexto del canvas
    context = canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();

    context.configure({device, format, alphaMode: 'opaque'});

    try {
        // Carga la imagen
        await image.decode();

        // Crea un bitmap de la imagen
        const imageBitmap = await createImageBitmap(image);

        // Ajusta el tamaño del canvas al de la imagen
        let max = imageBitmap.width;

        if (max < imageBitmap.height) 
            max = imageBitmap.height;

        if (rotate) {
            canvas.width = imageBitmap.height;
            canvas.height = imageBitmap.width;
            rotate = false;
        } else {
            canvas.width = imageBitmap.width;
            canvas.height = imageBitmap.height;
        }
        // canvas.width = imageBitmap.width;
        // canvas.height = imageBitmap.height;

        // Crea una textura a partir del bitmap
        const texture = device.createTexture({
            size: [imageBitmap.width, imageBitmap.height, 1],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
        });

        // Copia el bitmap a la textura
        device.queue.copyExternalImageToTexture(
            { source: imageBitmap },
            { texture: texture },
            [imageBitmap.width, imageBitmap.height]
        );

        // Crea el shader module
        const shaderModule = device.createShaderModule({ code: shaderCode });

        // Crea el sampler
        const sampler = device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
        });

        // Crea el bind group layout y pipeline
        const bindGroupLayout = device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
                { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
            ],
        });

        const pipeline = device.createRenderPipeline({
            layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
            vertex: {
                module: shaderModule,
                entryPoint: 'vs_main',
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs_main',
                targets: [{ format }],
            },
            primitive: { topology: 'triangle-list' },
        });

        // Crea el bind group
        const bindGroup = device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: sampler },
                { binding: 1, resource: texture.createView() },
            ],
        });

        render(device, context, pipeline, bindGroup, canvas, override);
    } catch (e) {
        alert('Error: ' + e.message);
        console.error(e);
    }
}

function main() {
    updateSidebar();

    const imageInput = document.getElementById('image-load');

    if (imageInput) {
        imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];

            if (file) {
                getBitsPerPixel(file);

                document.getElementById('gpu-canvas').style.display = 'block';
                document.getElementById('container-profile-curve').style.display = 'block';

                imageProcessed = new Image();
                imageOriginal = new Image();
                imageTemporal = new Image();

                imageSrc = URL.createObjectURL(file);

                imageProcessed.src = imageSrc;
                imageOriginal.src = imageSrc;
                imageTemporal.src = imageSrc;

                imageOriginal.onload = function() {
                    let maxImg = imageOriginal.naturalWidth;

                    if (maxImg < imageOriginal.naturalHeight)
                        maxImg = imageOriginal.naturalHeight;

                    let profileCurveCanvas = document.getElementById('container-profile-curve');

                    profileCurveCanvas.width = imageOriginal.naturalWidth;
                    profileCurveCanvas.height = 256;

                    initWebGPU(generalShader(imageOriginal.naturalWidth, imageOriginal.naturalHeight, maxImg), true);
                    imageInput.value = '';
                }
            }
        });

        const info = document.getElementById('menu-info');
        const erosion = document.getElementById('menu-erosion');
        const dilatacion = document.getElementById('menu-dilatation');
        const grayScale = document.getElementById('menu-grayscale');
        const colorScale = document.getElementById('menu-colorscale');
        const colorPicker = document.getElementById('color-picker');
        const negative = document.getElementById('menu-negative');
        const brightnessInput = document.getElementById('brightness-input');
        const contrastInput = document.getElementById('contrast-input');
        const zoomProxInput = document.getElementById('zoom-prox-input');
        const zoomBilinealInput = document.getElementById('zoom-bilineal-input');
        const gammaInput = document.getElementById('gamma-input');
        const flipHorizontalBtn = document.getElementById('flip-horizontal-btn');
        const flipVerticalBtn = document.getElementById('flip-vertical-btn');
        const rotateBtn = document.getElementById('rotate-btn');
        const rotateLeftBtn = document.getElementById('rotate-left-btn');
        const rotateRightBtn = document.getElementById('rotate-right-btn');
        const umbralSimpleBtn = document.getElementById('umbral-simple-btn');
        const umbralMultipleBtn = document.getElementById('umbral-multiple-btn');

        info.addEventListener('click', (event) => { getImageInfo(); });
        erosion.addEventListener('click', (event) => { initWebGPU(erosionShader(), true); });
        dilatacion.addEventListener('click', (event) => { initWebGPU(dilatationShader(), true); });
        grayScale.addEventListener('click', (event) => { initWebGPU(grayScaleShader(), true); });
        colorScale.addEventListener('click', (event) => { initWebGPU(colorScaleShader(colorValue), true); });
        negative.addEventListener('click', (event) => { initWebGPU(negativeShader(), true); });
        flipHorizontalBtn.addEventListener('click', (event) => { initWebGPU(flipHorizontalShader(), true); });
        flipVerticalBtn.addEventListener('click', (event) => { initWebGPU(flipVerticalShader(), true); });
        umbralSimpleBtn.addEventListener('click', (event) => { initWebGPU(umbralSimpleShader(document.getElementById('umbral-simple-input').value), true); });

        umbralMultipleBtn.addEventListener('click', (event) => {
            const input = document.getElementById('umbral-multiple-input').value;
            const values = input.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v) && v >= 0.0 && v <= 1.0);

            initWebGPU(umbralMultipleShader(values), true); 
        });

        rotateBtn.addEventListener('click', (event) => {
            let input = document.getElementById('rotate-input');
            let value = parseInt(input.value);

            const mod = value % 90;

            if (mod >= 45)
                value += (90 - mod);
            else
                value -= mod;

            input.value = value;

            if (value !== 0)
                initWebGPU(rotateShader(value), true); 
        });
        rotateLeftBtn.addEventListener('click', (event) => { initWebGPU(rotateShader(-90), true); });
        rotateRightBtn.addEventListener('click', (event) => { initWebGPU(rotateShader(90), true); });

        colorPicker.addEventListener('input', (event) => { colorValue = event.target.value; });

        brightnessInput.addEventListener('input', (event) => {
            brightnessLevel = parseFloat(event.target.value);
            initWebGPU(brightnessShader(brightnessLevel));
        });

        contrastInput.addEventListener('input', (event) => {
            contrastLevel = parseFloat(event.target.value);
            initWebGPU(contrastShader(contrastLevel));
        });

        zoomProxInput.addEventListener('input', (event) => {
            let zoom = parseFloat(event.target.value);
            zoomBilinealInput.value = 1.0;
            initWebGPU(zoomProxShader(zoom));
        });

        zoomBilinealInput.addEventListener('input', (event) => {
            const zoom = parseFloat(event.target.value);
            zoomProxInput.value = 1.0;
            initWebGPU(zoomBilinealShader(zoom));
        });

        gammaInput.addEventListener('input', (event) => {
            const gammaValue = parseFloat(event.target.value);
            initWebGPU(gammaShader(gammaValue));
        });

        const average = document.getElementById('menu-average');
        const median = document.getElementById('menu-median');
        const gaussian = document.getElementById('menu-gaussian');
        const prewitt = document.getElementById('menu-prewitt');
        const sobel = document.getElementById('menu-sobel');
        const roberts = document.getElementById('menu-roberts');
        const sharpen = document.getElementById('menu-sharpen');

        average.addEventListener('click', (event) => {
            const x = parseInt(document.getElementById('average-input-x').value)
            const y = parseInt(document.getElementById('average-input-y').value)

            if (isValidKernel(x, y))
                initWebGPU(averageShader(x, y), true);
        });
        median.addEventListener('click', (event) => {
            const x = parseInt(document.getElementById('median-input-x').value)
            const y = parseInt(document.getElementById('median-input-y').value)

            if (isValidKernel(x, y))
                initWebGPU(medianShader(x, y), true);
        });
        gaussian.addEventListener('click', (event) => {
            const x = parseInt(document.getElementById('gaussian-input-x').value)
            const y = parseInt(document.getElementById('gaussian-input-y').value)

            if (isValidKernel(x, y))
                initWebGPU(gaussianShader(x, y), true);
        });
        prewitt.addEventListener('click', (event) => {
            const x = parseInt(document.getElementById('prewitt-input-x').value)
            const y = parseInt(document.getElementById('prewitt-input-y').value)

            if (isValidKernel(x, y))
                initWebGPU(prewittShader(x, y), true);
        });
        sobel.addEventListener('click', (event) => {
            const x = parseInt(document.getElementById('sobel-input-x').value)
            const y = parseInt(document.getElementById('sobel-input-y').value)

            if (isValidKernel(x, y))
                initWebGPU(sobelShader(x, y), true);
        });
        roberts.addEventListener('click', (event) => {
            const x = parseInt(document.getElementById('roberts-input-x').value)
            const y = parseInt(document.getElementById('roberts-input-y').value)

            if (isValidKernel(x, y))
                initWebGPU(robertsShader(x, y), true);
        });
        sharpen.addEventListener('click', (event) => { 
            const x = parseInt(document.getElementById('sharpen-input-x').value)
            const y = parseInt(document.getElementById('sharpen-input-y').value)

            if (isValidKernelSharpen(x, y))
                initWebGPU(sharpenShader(x, y), true); 
        });
    }
}
// --- End Init --- //

document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('resize', updateSidebar);
    main();
});