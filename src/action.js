let isCvInit = false;
// Variables para panning
let panX = 0;
let panY = 0;
let isPanning = false;
let startPan = { x: 0, y: 0 };
let lastPan = { x: 0, y: 0 };

let imageSrc;
let imageOriginal;
let imageProcessed;
let imageTemporal;
let bitsPerPixel = 0;
let brightnessLevel = 0;
let contrastLevel = 1;
let gammaLevel = 1;
let zoomLevel = 1;
let typeZoom = 'prox';
let colorValue = "#ff0000";
let rotate = false;
let kernelCustomMorfology = [];
let xCustomMorfology = 0;
let yCustomMorfology = 0;
let isCustomMorfology = false;

const TypeCv = {
  EROSION: 0,
  DILATE: 1,
  OPENING: 2,
  CLOSING: 3,
  OTSU: 4,
  MEAN: 5,
  MEDIAN: 6,
  ISODATA: 7,
  KMEANS: 8,
  EQUALIZATION: 9,
  ROTATE: 10,
  BITREDUCTION: 11,
  POPULARITY: 12,
  KMEANSCOLOR: 13,
};

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

function dilateShader() {
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

// Temporal Shaders
function brightnessShader(brightness) {
    return vertexShader + 
    `
    @fragment
    fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
        let color = textureSample(myTexture, mySampler, input.uv);
        var r = color.r + ${brightness};
        var g = color.g + ${brightness};
        var b = color.b + ${brightness};

        r = clamp(r, 0.0, 1.0);
        g = clamp(g, 0.0, 1.0);
        b = clamp(b, 0.0, 1.0);

        return vec4<f32>(r, g, b, color.a);
    }
    `;
}

function contrastShader(contrast) {
    return vertexShader + 
    `
    @fragment
    fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
        let color = textureSample(myTexture, mySampler, input.uv);
        var r = (color.r - 0.5) * ${contrast} + 0.5;
        var g = (color.g - 0.5) * ${contrast} + 0.5;
        var b = (color.b - 0.5) * ${contrast} + 0.5;

        r = clamp(r, 0.0, 1.0);
        g = clamp(g, 0.0, 1.0);
        b = clamp(b, 0.0, 1.0);

        return vec4<f32>(r, g, b, color.a);
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

function zoomProxShader(zoom) {
    return vertexShader + 
    `
    @fragment
    fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
        let center = vec2<f32>(0.5, 0.5);
        let uvZoom = (input.uv - center) / ${zoom} + center;
        let texSize = vec2<f32>(textureDimensions(myTexture, 0));
        let uvNearest = floor(uvZoom * texSize) / texSize;

        return textureSample(myTexture, mySampler, uvNearest);
    }
    `;
}

function zoomBilinealShader(zoom) {
    return vertexShader + 
    `
    @fragment
    fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
        let center = vec2<f32>(0.5, 0.5);
        let uvZoom = (input.uv - center) / ${zoom} + center;
        let uvClamped = clamp(uvZoom, vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 1.0));

        return textureSample(myTexture, mySampler, uvClamped);
    }
    `;
}

function temporalShader() {
    let zoomShader = '';

    if (typeZoom === 'prox') {
        zoomShader = `
        let texSize = vec2<f32>(textureDimensions(myTexture, 0));
        let uvResult = floor(uvZoom * texSize) / texSize;`;
    } else {
        zoomShader = `let uvResult = clamp(uvZoom, vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 1.0));`;
    }

    if (zoomLevel === 1)
        zoomShader = `let uvResult = input.uv;`;

    return vertexShader +
    `
    @fragment
    fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
        let center = vec2<f32>(0.5, 0.5);
        let uvZoom = (input.uv - center) / ${zoomLevel} + center;
        ${zoomShader}

        let color = textureSample(myTexture, mySampler, uvResult);

        var r = color.r + ${brightnessLevel};
        var g = color.g + ${brightnessLevel};
        var b = color.b + ${brightnessLevel};

        r = (r - 0.5) * ${contrastLevel} + 0.5;
        g = (g - 0.5) * ${contrastLevel} + 0.5;
        b = (b - 0.5) * ${contrastLevel} + 0.5;

        r = pow(r, 1.0 / ${gammaLevel});
        g = pow(g, 1.0 / ${gammaLevel});
        b = pow(b, 1.0 / ${gammaLevel});

        r = clamp(r, 0.0, 1.0);
        g = clamp(g, 0.0, 1.0);
        b = clamp(b, 0.0, 1.0);

        return vec4<f32>(r, g, b, color.a);
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

function borderShader(mKernelX, mKernelY, kw, kh, direction) {
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

    const conditions =
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
            `; 

        let finalPart;
        
        if (direction === 'h') {
            finalPart = `      
                var result = resultX;
                result = clamp(result, vec3<f32>(0.0), vec3<f32>(1.0));
                return vec4<f32>(result, 1.0);   
            }
            `;
        } else if (direction === 'v') {
            finalPart = `      
                var result = resultY;
                result = clamp(result, vec3<f32>(0.0), vec3<f32>(1.0));
                return vec4<f32>(result, 1.0);   
            }
            `;
        } else {
            finalPart = `      
                var result = resultX + resultY;
                result = clamp(result, vec3<f32>(0.0), vec3<f32>(1.0));
                return vec4<f32>(result, 1.0);   
            }
            `;
        }


        return vertexShader + conditions + finalPart;
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
        kernel += 'array<f32, ' + kw + '>(';
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
        const row = [];

        for (let j = 0; j < kw; j++) {
            row.push(x);
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

        matrix.push(row);
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

function prewittShader(kw, kh, direction) {
    const prewittX = [];
    const prewittY = [];

    let parX = 0;
    let parY = 0;

    if (kw % 2 == 0) parX = 1;
    if (kh % 2 == 0) parY = 1;

    for (let i = 0; i < kh; i++) {
        const rowX = [];
        const rowY = [];

        for (let j = 0; j < kw; j++) {
            if (parX) {
                if (j < Math.floor(kw / 2))
                    rowX.push(-1);
                else if (j >= Math.floor(kw / 2))
                    rowX.push(1);
            } else {
                if (j < Math.floor(kw / 2))
                    rowX.push(-1);
                else if (j > Math.floor(kw / 2))
                    rowX.push(1);
                else rowX.push(0);
            }

            if (parY) {
                if (i < Math.floor(kh / 2))
                    rowY.push(-1);
                else if (i >= Math.floor(kh / 2))
                    rowY.push(1);
            } else {
                if (i < Math.floor(kh / 2))
                    rowY.push(-1);
                else if (i > Math.floor(kh / 2))
                    rowY.push(1);
                else rowY.push(0);
            }
        }
        prewittX.push(rowX);
        prewittY.push(rowY);
    }

    return borderShader(prewittX, prewittY, kw, kh, direction);
}

function sobelShader(kw, kh, direction) {
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
        const rowX = [];
        const rowY = [];

        for (let j = 0; j < kw; j++) {
            if (parX_X) {
                if (j < midX) {
                    rowX.push(-x_X);

                    if (j < midX - 1)
                        x_X++;
                } else if (j >= midX) {
                    rowX.push(x_X);
                    x_X--;
                }
            } else {
                if (j < midX) {
                    rowX.push(-x_X);
                    x_X++;
                } else if (j > midX) {
                    rowX.push(x_X);
                    x_X--;
                } else {
                    rowX.push(0);
                    x_X--;
                }
            }

            if (parX_Y) {
                let value = x_Y;

                if (i == midX && !parY_Y)
                    rowY.push(0);
                else {
                    if (i < midX)
                        value = -value;

                    if (j < midX) {
                        rowY.push(value);

                        if (j < midX - 1)
                            x_Y++;
                    } else if (j >= midX) {
                        rowY.push(value);
                        x_Y--;
                    }
                }
            } else {
                let value = x_Y;

                if (i == midX && !parY_Y)
                    rowY.push(0);
                else {
                    if (i < midX)
                        value = -value;

                    if (j < midX) {
                        rowY.push(value);
                        x_Y++;
                    } else {
                        rowY.push(value);
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

        sobelX.push(rowX);
        sobelY.push(rowY);

        x_X = y_X;
        x_Y = y_Y;
    }

    return borderShader(sobelX, sobelY, kw, kh, direction);
}

function robertsShader(kw, kh, direction) {
    const robertsX = [];
    const robertsY = [];

    for (let i = 0; i < kh; i++) {
        const rowX = [];
        const rowY = [];
        for (let j = 0; j < kw; j++) {
            rowX.push(0);
            rowY.push(0);
        }
        robertsX.push(rowX);
        robertsY.push(rowY);
    }

    robertsX[0][0] = 1;
    robertsX[kh - 1][kw - 1] = -1;

    robertsY[0][kw - 1] = 1;
    robertsY[kh - 1][0] = -1;

    return borderShader(robertsX, robertsY, kw, kh, direction);
}

function gradientShader(kw, kh, type) {
    const prewittX = [];
    const prewittY = [];

    let parX = 0;
    let parY = 0;

    if (kw % 2 == 0) parX = 1;
    if (kh % 2 == 0) parY = 1;

    for (let i = 0; i < kh; i++) {
        const rowX = [];
        const rowY = [];

        for (let j = 0; j < kw; j++) {
            if (parX) {
                if (j < Math.floor(kw / 2))
                    rowX.push(-1);
                else if (j >= Math.floor(kw / 2))
                    rowX.push(1);
            } else {
                if (j < Math.floor(kw / 2))
                    rowX.push(-1);
                else if (j > Math.floor(kw / 2))
                    rowX.push(1);
                else rowX.push(0);
            }

            if (parY) {
                if (i < Math.floor(kh / 2))
                    rowY.push(-1);
                else if (i >= Math.floor(kh / 2))
                    rowY.push(1);
            } else {
                if (i < Math.floor(kh / 2))
                    rowY.push(-1);
                else if (i > Math.floor(kh / 2))
                    rowY.push(1);
                else rowY.push(0);
            }
        }
        prewittX.push(rowX);
        prewittY.push(rowY);
    }

    let kernelX = '';
    let kernelY = '';

    for (let i = 0; i < kh; i++) {
        kernelX += 'array<f32, ' + kw + '>(';
        for (let j = 0; j < kw; j++) {
            kernelX += prewittX[i][j];
            if (j < kw - 1)
                kernelX += ', ';
        }
        kernelX += '),\n';
    }

    for (let i = 0; i < kh; i++) {
        kernelY += 'array<f32, ' + kw + '>(';
        for (let j = 0; j < kw; j++) {
            kernelY += prewittY[i][j];
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
                    let prom = 0.21 * color.r + 0.72 * color.g + 0.07 * color.b;
                    let k = kernelX[y][x];

                    resultX = resultX + vec3<f32>(color.r * k, color.g * k, color.b * k);
                }
            }
            for (var y: i32 = 0; y < ${kh}; y = y + 1) {
                for (var x: i32 = 0; x < ${kw}; x = x + 1) {
                    let offset = vec2<f32>(f32(x - kHalfX), f32(y - kHalfY));
                    let coord = (pixel + offset) / texSize;
                    let color = textureSample(myTexture, mySampler, clamp(coord, vec2<f32>(0.0), vec2<f32>(1.0)));
                    let prom = 0.21 * color.r + 0.72 * color.g + 0.07 * color.b;
                    let k = kernelY[y][x];

                    resultY = resultY + vec3<f32>(color.r * k, color.g * k, color.b * k);
                }
            }
        ` + (type === 'm' ? `      
            var result = sqrt(resultX * resultX + resultY * resultY);
            result = clamp(result, vec3<f32>(0.0), vec3<f32>(1.0));` 
            : `
            var result = atan2(resultY, resultX);
            result = clamp(result, vec3<f32>(0.0), vec3<f32>(1.0));`) +
        `
            return vec4<f32>(result, 1.0);
        }
        `;
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

function embossShader(kw, kh) {
    let matrix = [];

    for (let i = 0; i < kh; i++) {
        const row = [];
        for (let j = 0; j < kw; j++) {
            row.push(0);
        }
        matrix.push(row);
    }

    matrix[0][0] = -1;
    matrix[kh - 1][kw - 1] = 1;

    matrix[0][kw - 1] = 1;
    matrix[kh - 1][0] = -1;

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

    const conditions =
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
                    let offset = vec2<f32>(f32(x - kHalfX), f32(y - kHalfY));
                    let coord = (pixel + offset) / texSize;
                    let color = textureSample(myTexture, mySampler, clamp(coord, vec2<f32>(0.0), vec2<f32>(1.0)));
                    let k = kernel[y][x];

                    result = result + vec3<f32>(color.r * k, color.g * k, color.b * k);
                }
            }

            result = result + vec3<f32>(0.5, 0.5, 0.5);
            let prom = (result.r + result.g + result.b) / 3.0;

            result = vec3<f32>(prom, prom, prom);

            result = clamp(result, vec3<f32>(0.0), vec3<f32>(1.0));
            return vec4<f32>(result, 1.0);   
        }
        `;

    return vertexShader + conditions;
}
// --- End Shaders --- //

// --- Calculates Functions --- //
function profileCurveLine(top) {
    let image = imageTemporal;

    const canvas = document.getElementById('gpu-canvas-2d-panned');
    const ctx = canvas.getContext('2d');

    const width = canvas.width;
    const height = canvas.height;

    if (isNaN(top))
        top = 0;

    if (top < 0)
        top = 0;

    if (top >= image.naturalHeight)
        top = image.naturalHeight - 1;

    const imageData = ctx.getImageData(0, top, width, 1).data;
    const profile = [];

    for (let x = 0; x < imageData.length; x += 4) {
        const intensidad = Math.round(0.299 * imageData[x] + 0.587 * imageData[x + 1] + 0.114 * imageData[x + 2]);
        profile.push(intensidad);
    }

    const profileCanvas = document.getElementById('profile-curve-canvas');
    const profileCtx = profileCanvas.getContext('2d');

    profileCanvas.width = width;
    profileCanvas.height = 256;

    profileCtx.clearRect(0, 0, profileCanvas.width, profileCanvas.height);
    profileCtx.beginPath();
    profileCtx.moveTo(0, profileCanvas.height - profile[0]);

    for (let x = 1; x < profile.length; x++) {
        profileCtx.lineTo(x, profileCanvas.height - profile[x]);
    }

    profileCtx.strokeStyle = 'blue';
    profileCtx.lineWidth = 2;
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
    histogramDraw(histogramCalculate(imageTemporal, 'rgb'), document.getElementById('histogram-rgb-canvas'), '#FF47E2');
    histogramDraw(histogramCalculate(imageTemporal, 'r'), document.getElementById('histogram-r-canvas'), 'red');
    histogramDraw(histogramCalculate(imageTemporal, 'g'), document.getElementById('histogram-g-canvas'), 'green');
    histogramDraw(histogramCalculate(imageTemporal, 'b'), document.getElementById('histogram-b-canvas'), 'blue');
}

function histogramCalculate(image, type) {
    // const canvas = document.createElement('canvas');
    // canvas.width = image.naturalWidth;
    // canvas.height = image.naturalHeight;

    // const ctx = canvas.getContext('2d');
    // ctx.drawImage(image, 0, 0);

    const canvas = document.getElementById('gpu-canvas-2d-panned');
    const ctx = canvas.getContext('2d');

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
    ctx.lineWidth = 2;

    for (let i = 0; i < 256; i++) {
        const barHeight = histogram[i] * 256 / max;

        ctx.beginPath();
        ctx.moveTo(i, 256);
        ctx.lineTo(i, 256 - barHeight);
        ctx.stroke();
    }
}

function kernelCustom() {
    let customInputX = document.getElementById('custom-input-x').value;
    let customInputY = document.getElementById('custom-input-y').value;

    if (customInputX === '') customInputX = 3;
    if (customInputY === '') customInputY = 3;

    customInputX = parseInt(customInputX);
    customInputY = parseInt(customInputY);

    if (customInputX < 1) customInputX = 1;
    if (customInputX > 7) customInputX = 7;
    if (customInputY < 1) customInputY = 1;
    if (customInputY > 7) customInputY = 7;

    if (!isValidKernel(customInputX, customInputY))
        return;

    const matrix = [];

    for (let i = 0; i < 7; i++) {
        const row = [];

        for (let j = 0; j < 7; j++) {
            const input = document.getElementById(`custom-input-${i * 7 + j + 1}`);

            if (input.style.display !== 'none') {
                let value = input.value;
                if (value === '') value = 0;
                input.value = value;

                row.push(parseFloat(value));
            }
        }

        matrix.push(row);
    }

    let kernel = '';
    let kw = customInputX;
    let kh = customInputY;

    for (let i = 0; i < kh; i++) {
        kernel += 'array<f32, ' + kw + '>(';
        for (let j = 0; j < kw; j++) {
            kernel += matrix[i][j];
            if (j < kw - 1)
                kernel += ', ';
        }
        kernel += '),\n';
    }

    initWebGPU(filterShader(kernel, kw, kh), true);
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

    if (isBinary) return 'b';
    if (isGray) return 'g';

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

function saveRle() {
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

    let netpbmData = '';

    if (type === 'b') {
        netpbmData = exportPBM(imageData, width, height);
    } else if (type === 'g') {
        netpbmData = exportPGM(imageData, width, height);
    } else {
        netpbmData = exportPPM(imageData, width, height);
    }

    const rleText = rleCompressNetpbm(netpbmData);
    console.log(rleText);
    const blob = new Blob([rleText], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'imageRle.rle';
    link.click();
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

function handleNetpbmFileInput(file) {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();

        fileReader.onload = function(e) {
            const data = e.target.result;
            const netpbmData = parseNetpbm(data);
            
            const imageData = new ImageData(netpbmData.width, netpbmData.height);
            let index = 0;

            for (let i = 0; i < netpbmData.width * netpbmData.height; i++) {
                let r, g, b;

                if (netpbmData.type === 'P1') { // PBM (binary)
                    r = g = b = netpbmData.data[i] === 0 ? 255 : 0;
                    bitsPerPixel = 1;
                } else if (netpbmData.type === 'P2') { // PGM (gray)
                    r = g = b = Math.round(netpbmData.data[i] * 255 / netpbmData.maxVal);
                    bitsPerPixel = 8;
                } else if (netpbmData.type === 'P3') { // PPM (color)
                    r = Math.round(netpbmData.data[index++] * 255 / netpbmData.maxVal);
                    g = Math.round(netpbmData.data[index++] * 255 / netpbmData.maxVal);
                    b = Math.round(netpbmData.data[index++] * 255 / netpbmData.maxVal);
                    bitsPerPixel = 24;
                }
                if (netpbmData.type !== 'P3') 
                    index++;

                imageData.data[(i) * 4 + 0] = r;
                imageData.data[(i) * 4 + 1] = g;
                imageData.data[(i) * 4 + 2] = b;
                imageData.data[(i) * 4 + 3] = 255;
            }

            resolve(netpbmToImageData(imageData));
        };

        fileReader.readAsText(file);
    });
}

function handleRleFileInput(file) {
    console.log('RLE file input handler');
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();

        fileReader.onload = function(e) {
            const data = e.target.result;
            const rleData = rleDecompressNetpbm(data);
            const netpbmData = parseNetpbm(rleData);

            const imageData = new ImageData(netpbmData.width, netpbmData.height);
            let index = 0;

            for (let i = 0; i < netpbmData.width * netpbmData.height; i++) {
                let r, g, b;

                if (netpbmData.type === 'P1') { // PBM (binary)
                    r = g = b = netpbmData.data[i] === 0 ? 255 : 0;
                    bitsPerPixel = 1;
                } else if (netpbmData.type === 'P2') { // PGM (gray)
                    r = g = b = Math.round(netpbmData.data[i] * 255 / netpbmData.maxVal);
                    bitsPerPixel = 8;
                } else if (netpbmData.type === 'P3') { // PPM (color)
                    r = Math.round(netpbmData.data[index++] * 255 / netpbmData.maxVal);
                    g = Math.round(netpbmData.data[index++] * 255 / netpbmData.maxVal);
                    b = Math.round(netpbmData.data[index++] * 255 / netpbmData.maxVal);
                    bitsPerPixel = 24;
                }
                if (netpbmData.type !== 'P3') 
                    index++;

                imageData.data[(i) * 4 + 0] = r;
                imageData.data[(i) * 4 + 1] = g;
                imageData.data[(i) * 4 + 2] = b;
                imageData.data[(i) * 4 + 3] = 255;
            }

            resolve(netpbmToImageData(imageData));
        };

        fileReader.readAsText(file);
    });
}

function netpbmToImageData(imageData) {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL();
}

function parseNetpbm(file) {
    const lines = file
        .replace(/#.*$/gm, '')
        .trim()
        .split(/\s+/);

    const type = lines[0];
    let idx = 1;
    const width = parseInt(lines[idx++]);
    const height = parseInt(lines[idx++]);
    let maxVal = 1;

    if (type === 'P2' || type === 'P3')
        maxVal = parseInt(lines[idx++]);

    // El resto son los datos de píxeles
    const data = lines.slice(idx).map(Number);

    return { type, width, height, maxVal, data };
}

function rleCompressNetpbm(netpbmText) {
    const lines = netpbmText.split('\n');
    let header = [];
    let dataStart = 0;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '' || /^#/.test(lines[i])) continue;

        header.push(lines[i]);

        if (header.length === 3 || (header[0] === 'P1' && header.length === 2)) {
            dataStart = i + 1;
            break;
        }
    }

    const headerText = header.join('\n') + '\n';
    const dataText = lines.slice(dataStart).join(' ').replace(/\s+/g, ' ').trim();
    const dataArr = dataText.split(' ');

    let rle = [];
    let prev = dataArr[0];
    let count = 1;

    for (let i = 1; i < dataArr.length; i++) {
        if (dataArr[i] === prev) {
            count++;
        } else {
            rle.push(prev + ':' + count);
            prev = dataArr[i];
            count = 1;
        }
    }

    rle.push(prev + ':' + count);

    return headerText + rle.join(' ');
}

function rleDecompressNetpbm(rleText) {
    const lines = rleText.split('\n');
    let header = [];
    let dataStart = 0;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '' || /^#/.test(lines[i])) continue;

        header.push(lines[i]);

        if (header.length === 3 || (header[0] === 'P1' && header.length === 2)) {
            dataStart = i + 1;
            break;
        }
    }

    const headerText = header.join('\n') + '\n';
    const rleData = lines.slice(dataStart).join(' ').replace(/\s+/g, ' ').trim();
    const rleArr = rleData.split(' ');
    let dataArr = [];

    for (let i = 0; i < rleArr.length; i++) {
        const [val, count] = rleArr[i].split(':');

        for (let j = 0; j < parseInt(count); j++) {
            dataArr.push(val);
        }
    }

    return headerText + dataArr.join(' ');
}
// --- End Image Functions --- //

// --- Utility Functions --- //
function updateSidebar() {
    // Menu responsive
    const sidebar = document.getElementById('sidebar');
}

function temporalShaders() {
    let value = document.getElementById('zoom-input').value;

    if (value === '')
        value = '1.0';

    zoomLevel = parseFloat(value);
    typeZoom = document.querySelector('input[name="zoom-type"]:checked').value;

    initWebGPU(temporalShader());
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

    let canvas2d;

    if (override)
        canvas2d = document.getElementById('gpu-canvas-2d-aux');
    else canvas2d = document.getElementById('gpu-canvas-2d');

    const context2d = canvas2d.getContext('2d');

    canvas2d.width = canvas.width;
    canvas2d.height = canvas.height;

    context2d.drawImage(canvas, 0, 0);

    imageSrc = canvas2d.toDataURL('image/png');

    if (override)
        imageProcessed.src = imageSrc;

    imageTemporal.src = imageSrc;

    imageTemporal.onload = function() { renderFunctions(override);}

    if (imageTemporal.complete)
        renderFunctions(override);
}

function renderFunctions(override) {
    if (override)
        temporalShaders();
    else drawPannedImage();
}

function resetValues() {
    panX = 0;
    panY = 0;

    brightnessLevel = 0;
    contrastLevel = 1;
    zoomLevel = 1;

    document.getElementById('brightness-input').value = brightnessLevel;
    document.getElementById('contrast-input').value = contrastLevel;
    document.getElementById('zoom-input').value = zoomLevel;
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

function applyZoom() {
    let value = document.getElementById('zoom-input').value;

    if (value === '')
        value = '1.0';

    zoomLevel = parseFloat(value);
    typeZoom = document.querySelector('input[name="zoom-type"]:checked').value;

    if (typeZoom === 'prox')
        initWebGPU(zoomProxShader(zoomLevel));//false
    else initWebGPU(zoomBilinealShader(zoomLevel));//false
}

function drawPannedImage() {
    let maxImg = imageTemporal.naturalWidth;

    if (maxImg < imageTemporal.naturalHeight)
        maxImg = imageTemporal.naturalHeight;

    const canvas = document.getElementById('gpu-canvas-2d-panned');

    canvas.width = imageTemporal.naturalWidth;
    canvas.height = imageTemporal.naturalHeight;

    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (imageTemporal && imageTemporal.complete)
        ctx.drawImage(imageTemporal, panX, panY);

    let line = document.getElementById('horizontal-line');

    profileCurveLine(parseInt(line.style.top.substring(0, line.style.top.length - 2)));
    goToTonalCurve();
    goToHistogram();
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
    const context = canvas.getContext('webgpu');
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

async function loadDefaultImage(imageFile) {
    resetValues();

    const file = imageFile;

    if (file) {
        document.getElementById('gpu-canvas-2d-panned').style.display = 'block';
        document.getElementById('container-profile-curve').style.display = 'block';

        imageProcessed = new Image();
        imageOriginal = new Image();
        imageTemporal = new Image();

        const extension = file.name.split('.').pop().toLowerCase();

        if (extension === 'pbm' || extension === 'pgm' || extension === 'ppm') {
            imageSrc = await handleNetpbmFileInput(file);
            console.log(imageSrc);
        } else if (extension === 'rle') {
            imageSrc = await handleRleFileInput(file);
            console.log(imageSrc);
        } else {
            getBitsPerPixel(file);
            imageSrc = URL.createObjectURL(file);
            console.log(imageSrc);
        }

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
            imageLoadedCallback();

            // document.getElementById('btn-load-image').value = '';
        }
    }
}

async function main() {
    updateSidebar();

    const imageInput = document.getElementById('btn-load-image');

    if (imageInput) {
        imageInput.addEventListener('change', async (e) => { loadDefaultImage(e.target.files[0]); });
        document.getElementById('btn-reset-image').addEventListener('click', (event) => { loadDefaultImage(imageInput.files[0]); });
        document.getElementById('btn-pan-image').addEventListener('click', (event) => { 
            panX = 0;
            panY = 0;
            drawPannedImage(); 
        });

        document.getElementById('toggle-horizontal-line').addEventListener('change', (event) => { 
            if (event.target.checked) {
                document.getElementById('horizontal-line').style.display = 'block';
                document.getElementById('profile-curve-canvas').style.display = 'block';
            } else {
                document.getElementById('horizontal-line').style.display = 'none';
                document.getElementById('profile-curve-canvas').style.display = 'none'; 
            }
        });

        document.getElementById('menu-info').addEventListener('click', (event) => { getImageInfo(); });
        document.getElementById('menu-grayscale').addEventListener('click', (event) => { initWebGPU(grayScaleShader(), true); });
        document.getElementById('menu-colorscale').addEventListener('click', (event) => { initWebGPU(colorScaleShader(colorValue), true); });
        document.getElementById('menu-negative').addEventListener('click', (event) => { initWebGPU(negativeShader(), true); });
        document.getElementById('flip-horizontal-btn').addEventListener('click', (event) => { initWebGPU(flipHorizontalShader(), true); });
        document.getElementById('flip-vertical-btn').addEventListener('click', (event) => { initWebGPU(flipVerticalShader(), true); });
        document.getElementById('umbral-simple-btn').addEventListener('click', (event) => { initWebGPU(umbralSimpleShader(document.getElementById('umbral-simple-input').value), true); });

        document.getElementById('umbral-multiple-btn').addEventListener('click', (event) => {
            const input = document.getElementById('umbral-multiple-input').value;
            const values = input.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v) && v >= 0.0 && v <= 1.0);

            initWebGPU(umbralMultipleShader(values), true); 
        });
        document.getElementById('rotate-btn').addEventListener('click', (event) => {
            /*
            let input = document.getElementById('rotate-input');
            let value = parseInt(input.value);

            const mod = value % 90;

            if (mod >= 45)
                value += (90 - mod);
            else value -= mod;

            input.value = value;

            if (value !== 0)
            */
                initOpenCV(TypeCv.ROTATE, true);//rotateShader(value), true);
        });
        document.getElementById('rotate-left-btn').addEventListener('click', (event) => { initWebGPU(rotateShader(-90), true); });
        document.getElementById('rotate-right-btn').addEventListener('click', (event) => { initWebGPU(rotateShader(90), true); });

        document.getElementById('color-picker').addEventListener('input', (event) => { colorValue = event.target.value; });

        document.getElementById('brightness-input').addEventListener('input', (event) => {
            brightnessLevel = parseFloat(event.target.value);
            // initWebGPU(brightnessShader(brightnessLevel));//false
            temporalShaders();
        });
        document.getElementById('contrast-input').addEventListener('input', (event) => {
            contrastLevel = parseFloat(event.target.value);
            // initWebGPU(contrastShader(contrastLevel));//false
            temporalShaders();
        });
        document.getElementById('zoom-input').addEventListener('input', (event) => { temporalShaders(); });
        document.getElementById('zoom-prox').addEventListener('change', (event) => { temporalShaders(); });
        document.getElementById('zoom-bilineal').addEventListener('change', (event) => { temporalShaders(); });
        document.getElementById('gamma-input').addEventListener('input', (event) => {
            gammaLevel = parseFloat(event.target.value);
            // initWebGPU(gammaShader(gammaLevel));//false
            temporalShaders();
        });
        document.getElementById('menu-average').addEventListener('click', (event) => {
            const x = parseInt(document.getElementById('average-input-x').value)
            const y = parseInt(document.getElementById('average-input-y').value)

            if (isValidKernel(x, y))
                initWebGPU(averageShader(x, y), true);
        });
        document.getElementById('menu-median').addEventListener('click', (event) => {
            const x = parseInt(document.getElementById('median-input-x').value)
            const y = parseInt(document.getElementById('median-input-y').value)

            if (isValidKernel(x, y))
                initWebGPU(medianShader(x, y), true);
        });
        document.getElementById('menu-gaussian').addEventListener('click', (event) => {
            const x = parseInt(document.getElementById('gaussian-input-x').value)
            const y = parseInt(document.getElementById('gaussian-input-y').value)

            if (isValidKernel(x, y))
                initWebGPU(gaussianShader(x, y), true);
        });
        document.getElementById('menu-prewitt').addEventListener('click', (event) => {
            const x = parseInt(document.getElementById('prewitt-input-x').value)
            const y = parseInt(document.getElementById('prewitt-input-y').value)
            const dir = document.querySelector('input[name="prewitt-direction"]:checked').value;

            if (isValidKernel(x, y))
                initWebGPU(prewittShader(x, y, dir), true);
        });
        document.getElementById('menu-sobel').addEventListener('click', (event) => {
            const x = parseInt(document.getElementById('sobel-input-x').value)
            const y = parseInt(document.getElementById('sobel-input-y').value)
            const dir = document.querySelector('input[name="sobel-direction"]:checked').value;

            if (isValidKernel(x, y))
                initWebGPU(sobelShader(x, y, dir), true);
        });
        document.getElementById('menu-roberts').addEventListener('click', (event) => {
            const x = parseInt(document.getElementById('roberts-input-x').value)
            const y = parseInt(document.getElementById('roberts-input-y').value)
            const dir = document.querySelector('input[name="roberts-direction"]:checked').value;

            if (isValidKernel(x, y))
                initWebGPU(robertsShader(x, y, dir), true);
        });
        document.getElementById('menu-sharpen').addEventListener('click', (event) => { 
            const x = parseInt(document.getElementById('sharpen-input-x').value)
            const y = parseInt(document.getElementById('sharpen-input-y').value)

            if (isValidKernelSharpen(x, y))
                initWebGPU(sharpenShader(x, y), true); 
        });
        document.getElementById('menu-emboss').addEventListener('click', (event) => { 
            const x = parseInt(document.getElementById('emboss-input-x').value)
            const y = parseInt(document.getElementById('emboss-input-y').value)

            if (isValidKernel(x, y))
                initWebGPU(embossShader(x, y), true); 
        });
        document.getElementById('menu-gradient-m').addEventListener('click', (event) => {
            const x = parseInt(document.getElementById('gradient-m-input-x').value)
            const y = parseInt(document.getElementById('gradient-m-input-y').value)

            if (isValidKernel(x, y))
                initWebGPU(gradientShader(x, y, 'm'), true);
        });
        document.getElementById('menu-gradient-a').addEventListener('click', (event) => {
            const x = parseInt(document.getElementById('gradient-a-input-x').value)
            const y = parseInt(document.getElementById('gradient-a-input-y').value)

            if (isValidKernel(x, y))
                initWebGPU(gradientShader(x, y, 'a'), true);
        });

        // OpenCV
        document.getElementById('menu-erosion').addEventListener('click', (event) => { initOpenCV(TypeCv.EROSION, true); });
        document.getElementById('menu-dilate').addEventListener('click', (event) => { initOpenCV(TypeCv.DILATE, true); });
        document.getElementById('menu-opening').addEventListener('click', (event) => { initOpenCV(TypeCv.OPENING, true); });
        document.getElementById('menu-closing').addEventListener('click', (event) => { initOpenCV(TypeCv.CLOSING, true); });
        document.getElementById('menu-umbral-otsu').addEventListener('click', (event) => { initOpenCV(TypeCv.OTSU, true); });
        document.getElementById('menu-umbral-mean').addEventListener('click', (event) => { initOpenCV(TypeCv.MEAN, true); });
        document.getElementById('menu-umbral-median').addEventListener('click', (event) => { initOpenCV(TypeCv.MEDIAN, true); });
        document.getElementById('menu-umbral-isodata').addEventListener('click', (event) => { initOpenCV(TypeCv.ISODATA, true); });
        document.getElementById('menu-umbral-kmeans').addEventListener('click', (event) => { initOpenCV(TypeCv.KMEANS, true); });
        document.getElementById('menu-equalization').addEventListener('click', (event) => { initOpenCV(TypeCv.EQUALIZATION, true); });

        document.getElementById('cuantizacion-bits-btn').addEventListener('click', (event) => { initOpenCV(TypeCv.BITREDUCTION, true); });
        document.getElementById('cuantizacion-popularity-btn').addEventListener('click', (event) => { initOpenCV(TypeCv.POPULARITY, true); });
        document.getElementById('cuantizacion-kmeans-btn').addEventListener('click', (event) => { initOpenCV(TypeCv.KMEANSCOLOR, true); });
    }
}
// --- End Init --- //

document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('resize', updateSidebar);
    main();
});

cv['onRuntimeInitialized'] = function() {
    isCvInit = true;
};

function isCvLoaded() {
    if (!isCvInit)
        alert('Espera a que OpenCV.js termine de cargar.');

    return isCvInit;
}

async function initOpenCV(type, override = false) {
    if (isCvLoaded()) {
        const gpuCanvas2d = document.getElementById('gpu-canvas-2d');

        // Canvas auxiliar 2D
        const auxCanvas = document.createElement('canvas');
        auxCanvas.width = gpuCanvas2d.width;
        auxCanvas.height = gpuCanvas2d.height;
        const auxCtx = auxCanvas.getContext('2d');
        auxCtx.drawImage(gpuCanvas2d, 0, 0);

        switch (type) {
            case TypeCv.EROSION: erosionCv(cv, auxCanvas); break;
            case TypeCv.DILATE: dilateCv(cv, auxCanvas); break;
            case TypeCv.OPENING: openingCv(cv, auxCanvas); break;
            case TypeCv.CLOSING: closingCv(cv, auxCanvas); break;
            case TypeCv.OTSU: umbralOtsuCv(cv, auxCanvas); break;
            case TypeCv.MEAN: umbralMeanCv(cv, auxCanvas); break;
            case TypeCv.MEDIAN: umbralMedianCv(cv, auxCanvas); break;
            case TypeCv.ISODATA: umbralIsodataCv(cv, auxCanvas); break;
            case TypeCv.KMEANS: umbralKMeansCv(cv, auxCanvas); break;
            case TypeCv.EQUALIZATION: equalizationCv(cv, auxCanvas); break;
            case TypeCv.ROTATE: rotateCv(cv, auxCanvas); break;
            case TypeCv.BITREDUCTION: bitReductionCv(cv, auxCanvas); break;
            case TypeCv.POPULARITY: popularityCv(cv, auxCanvas); break;
            case TypeCv.KMEANSCOLOR: kMeansColorCv(cv, auxCanvas); break;
            default: break;
        }

        const gpuCtx = gpuCanvas2d.getContext('2d');
        gpuCtx.drawImage(auxCanvas, 0, 0);

        imageSrc = gpuCanvas2d.toDataURL('image/png');

        if (override)
            imageProcessed.src = imageSrc;

        imageTemporal.src = imageSrc;

        imageTemporal.onload = function() { renderFunctions(override); }

        if (imageTemporal.complete)
            renderFunctions(override);
    }
}

// --- OpenCv --- //

// Morfology
function erosionCv(cv, canvas) {
    let x = document.getElementById('erosion-input-x').value;
    let y = document.getElementById('erosion-input-y').value;

    let mat = cv.imread(canvas);
    let kernel;

    if (isCustomMorfology)
        kernel = cv.matFromArray(xCustomMorfology, yCustomMorfology, cv.CV_8U, kernelCustomMorfology.flat());
    else kernel = cv.Mat.ones(parseInt(x), parseInt(y), cv.CV_8U);

    isCustomMorfology = false;

    cv.erode(mat, mat, kernel);
    cv.imshow(canvas, mat);

    mat.delete();
    kernel.delete();
}

function dilateCv(cv, canvas) {
    let x = document.getElementById('dilate-input-x').value;
    let y = document.getElementById('dilate-input-y').value;

    let mat = cv.imread(canvas);
    let kernel;

    if (isCustomMorfology)
        kernel = cv.matFromArray(xCustomMorfology, yCustomMorfology, cv.CV_8U, kernelCustomMorfology.flat());
    else kernel = cv.Mat.ones(parseInt(x), parseInt(y), cv.CV_8U);

    isCustomMorfology = false;

    cv.dilate(mat, mat, kernel);
    cv.imshow(canvas, mat);

    mat.delete();
    kernel.delete();
}

function openingCv(cv, canvas) {
    let x = document.getElementById('opening-input-x').value;
    let y = document.getElementById('opening-input-y').value;

    let mat = cv.imread(canvas);
    let kernel;

    if (isCustomMorfology)
        kernel = cv.matFromArray(xCustomMorfology, yCustomMorfology, cv.CV_8U, kernelCustomMorfology.flat());
    else kernel = cv.Mat.ones(parseInt(x), parseInt(y), cv.CV_8U);

    isCustomMorfology = false;

    cv.erode(mat, mat, kernel);
    cv.dilate(mat, mat, kernel);
    cv.imshow(canvas, mat);

    mat.delete();
    kernel.delete();
}

function closingCv(cv, canvas) {
    let x = document.getElementById('closing-input-x').value;
    let y = document.getElementById('closing-input-y').value;

    let mat = cv.imread(canvas);
    let kernel;

    if (isCustomMorfology)
        kernel = cv.matFromArray(xCustomMorfology, yCustomMorfology, cv.CV_8U, kernelCustomMorfology.flat());
    else kernel = cv.Mat.ones(parseInt(x), parseInt(y), cv.CV_8U);

    isCustomMorfology = false;

    cv.dilate(mat, mat, kernel);
    cv.erode(mat, mat, kernel);
    cv.imshow(canvas, mat);

    mat.delete();
    kernel.delete();
}

async function customMorfology(type) {
    const modal = document.getElementById('custom-kernel-morfology-modal');

    modal.style.display = 'none';

    let customInputX = document.getElementById('custom-input-morfology-x').value;
    let customInputY = document.getElementById('custom-input-morfology-y').value;

    if (customInputX === '') customInputX = 3;
    if (customInputY === '') customInputY = 3;

    customInputX = parseInt(customInputX);
    customInputY = parseInt(customInputY);

    if (customInputX < 1) customInputX = 1;
    if (customInputX > 7) customInputX = 7;
    if (customInputY < 1) customInputY = 1;
    if (customInputY > 7) customInputY = 7;

    xCustomMorfology = customInputX;
    yCustomMorfology = customInputY;

    const matrix = [];

    for (let i = 0; i < xCustomMorfology; i++) {
        const row = [];

        for (let j = 0; j < yCustomMorfology; j++) {
            const input = document.getElementById(`custom-input-morfology-${i * 7 + j + 1}`);

            if (input.style.display !== 'none') {
                let value = input.value;
                if (value === '') value = 0;
                input.value = value;

                row.push(parseInt(value));
            }
        }

        matrix.push(row);
    }

    kernelCustomMorfology = matrix;
    isCustomMorfology = true;

    initOpenCV(type, true);
}
// End Morfology
// Umbral
function umbralOtsuCv(cv, canvas) {
    let src = cv.imread(canvas);

    if (src.channels() > 1)
        cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY, 0);

    cv.threshold(src, src, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);
    cv.imshow(canvas, src);

    src.delete();
}

function thresholdMean(src) {
    let sum = 0;

    for (let i = 0; i < src.rows; i++) {
        for (let j = 0; j < src.cols; j++) {
            sum += src.ucharPtr(i, j)[0];
        }
    }

    let total = src.rows * src.cols;
    return Math.round(sum / total);
}

function umbralMeanCv(cv, canvas) {
    let src = cv.imread(canvas);

    if (src.channels() > 1)
        cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY, 0);

    
    let threshold = thresholdMean(src);

    cv.threshold(src, src, threshold, 255, cv.THRESH_BINARY);
    cv.imshow(canvas, src);
    src.delete();
}

function umbralMedianCv(cv, canvas) {
    let src = cv.imread(canvas);

    if (src.channels() > 1)
        cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY, 0);

    let values = [];

    for (let i = 0; i < src.rows; i++) {
        for (let j = 0; j < src.cols; j++) {
            values.push(src.ucharPtr(i, j)[0]);
        }
    }

    values.sort((a, b) => a - b);

    let mid = Math.floor(values.length / 2);
    let threshold = values.length % 2 === 0 ? Math.round((values[mid - 1] + values[mid]) / 2) : values[mid];

    cv.threshold(src, src, threshold, 255, cv.THRESH_BINARY);
    cv.imshow(canvas, src);
    src.delete();
}

function umbralIsodataCv(cv, canvas) {
    let src = cv.imread(canvas);

    if (src.channels() > 1)
        cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY, 0);

    let values = [];

    for (let i = 0; i < src.rows; i++) {
        for (let j = 0; j < src.cols; j++) {
            values.push(src.ucharPtr(i, j)[0]);
        }
    }

    let t = thresholdMean(src);
    let prevT = -1;

    while (t !== prevT) {
        let group1 = values.filter(v => v <= t);
        let group2 = values.filter(v => v > t);
        let mean1 = group1.length ? group1.reduce((a, b) => a + b, 0) / group1.length : 0;
        let mean2 = group2.length ? group2.reduce((a, b) => a + b, 0) / group2.length : 0;

        prevT = t;

        t = Math.round((mean1 + mean2) / 2);
    }
    let threshold = t;

    cv.threshold(src, src, threshold, 255, cv.THRESH_BINARY);
    cv.imshow(canvas, src);
    src.delete();
}

function umbralKMeansCv(cv, canvas) {
    let src = cv.imread(canvas);

    if (src.channels() > 1)
        cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY, 0);

    // K-means con k=2 (fondo y objeto)
    let values = [];

    for (let i = 0; i < src.rows; i++) {
        for (let j = 0; j < src.cols; j++) {
            values.push(src.ucharPtr(i, j)[0]);
        }
    }

    let c1 = 0, c2 = 255;
    let changed = true;

    while (changed) {
        let group1 = [], group2 = [];

        for (let v of values) {
            if (Math.abs(v - c1) < Math.abs(v - c2))
                group1.push(v);
            else group2.push(v);
        }

        let newC1 = group1.length ? group1.reduce((a, b) => a + b, 0) / group1.length : c1;
        let newC2 = group2.length ? group2.reduce((a, b) => a + b, 0) / group2.length : c2;

        changed = (Math.round(newC1) !== Math.round(c1)) || (Math.round(newC2) !== Math.round(c2));

        c1 = newC1;
        c2 = newC2;
    }
    // El umbral es el punto medio entre los dos centroides
    let threshold = Math.round((c1 + c2) / 2);

    cv.threshold(src, src, threshold, 255, cv.THRESH_BINARY);
    cv.imshow(canvas, src);

    src.delete();
}
// End Umbral

function equalizationCv(cv, canvas) {
    let src = cv.imread(canvas);

    if (src.channels() === 1) {
        cv.equalizeHist(src, src);
        cv.imshow(canvas, src);
        src.delete();
        return;
    }

    let rgb = new cv.Mat();

    if (src.channels() === 4)
        cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB, 0);

    let ycrcb = new cv.Mat();
    cv.cvtColor(rgb, ycrcb, cv.COLOR_RGB2YCrCb, 0);

    let channels = new cv.MatVector();
    cv.split(ycrcb, channels);

    // Ecualizar solo el canal Y (luminancia)
    cv.equalizeHist(channels.get(0), channels.get(0));
    cv.merge(channels, ycrcb);
    cv.cvtColor(ycrcb, rgb, cv.COLOR_YCrCb2RGB, 0);
    cv.cvtColor(rgb, src, cv.COLOR_RGB2RGBA, 0);

    cv.imshow(canvas, src);

    rgb.delete();
    src.delete();
    ycrcb.delete();
    channels.delete();
}

function rotateCv(cv, canvas) {
    let input = document.getElementById('rotate-input');
    let value = parseInt(input.value);

    if (value === 0)
        return;

    value = -value

    let src = cv.imread(canvas);
    let center = new cv.Point(src.cols / 2, src.rows / 2);
    let rotateMat = cv.getRotationMatrix2D(center, value, 1.0);
    let size = new cv.Size(src.cols, src.rows);

    cv.warpAffine(src, src, rotateMat, size, cv.INTER_CUBIC, cv.BORDER_REPLICATE, new cv.Scalar());
    cv.imshow(canvas, src);

    src.delete();
    rotateMat.delete();
}

// Rotación en ángulo arbitrario sin recortar bordes
function rotarImagenSinRecorte(cv, canvas) {
    let input = document.getElementById('rotate-input');
    let angulo = parseInt(input.value);

    if (angulo === 0)
        return;

    angulo = -angulo

    let src = cv.imread(canvas);
    let rad = angulo * Math.PI / 180.0;
    let sin = Math.abs(Math.sin(rad));
    let cos = Math.abs(Math.cos(rad));
    let newWidth = Math.floor(src.rows * sin + src.cols * cos);
    let newHeight = Math.floor(src.rows * cos + src.cols * sin);
    let center = new cv.Point(src.cols / 2, src.rows / 2);
    let rotMat = cv.getRotationMatrix2D(center, angulo, 1.0);
    // Ajustar la traslación para centrar la imagen rotada
    rotMat.doublePtr(0,2)[0] += (newWidth - src.cols) / 2;
    rotMat.doublePtr(1,2)[0] += (newHeight - src.rows) / 2;

    let dsize = new cv.Size(newWidth, newHeight);
    let dst = new cv.Mat();

    cv.warpAffine(src, dst, rotMat, dsize, cv.INTER_CUBIC, cv.BORDER_CONSTANT, new cv.Scalar());
    cv.imshow(canvas, dst);

    src.delete();
    dst.delete();
    rotMat.delete();
}

// Color Quantization
function bitReductionCv(cv, canvas) {
    let bitsInput = document.getElementById('cuantizacion-bits-input').value;

    if (bitsInput === '')
        bitsInput = '8';
        
    let bits = parseInt(bitsInput);

    let src = cv.imread(canvas);
    let shift = 8 - bits;

    cv.cvtColor(src, src, cv.COLOR_RGBA2RGB, 0);

    for (let i = 0; i < src.rows; i++) {
        for (let j = 0; j < src.cols; j++) {
            let pixel = src.ucharPtr(i, j);
            pixel[0] = (pixel[0] >> shift) << shift;
            pixel[1] = (pixel[1] >> shift) << shift;
            pixel[2] = (pixel[2] >> shift) << shift;
        }
    }

    cv.imshow(canvas, src);

    src.delete();
}

function popularityCv(cv, canvas) {
    let popularityInput = document.getElementById('cuantizacion-popularity-input').value;

    if (popularityInput === '')
        popularityInput = '256';
        
    let popularity = parseInt(popularityInput);

    let src = cv.imread(canvas);

    cv.cvtColor(src, src, cv.COLOR_RGBA2RGB, 0);

    let colorMap = new Map();

    for (let i = 0; i < src.rows; i++) {
        for (let j = 0; j < src.cols; j++) {
            let pixel = src.ucharPtr(i, j);
            let key = `${pixel[0]},${pixel[1]},${pixel[2]}`;
            colorMap.set(key, (colorMap.get(key) || 0) + 1);
        }
    }

    let palette = Array.from(colorMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, popularity)
        .map(e => e[0].split(',').map(Number));

    for (let i = 0; i < src.rows; i++) {
        for (let j = 0; j < src.cols; j++) {
            let pixel = src.ucharPtr(i, j);
            let minDist = Infinity, idx = 0;

            for (let k = 0; k < palette.length; k++) {
                let dr = pixel[0] - palette[k][0];
                let dg = pixel[1] - palette[k][1];
                let db = pixel[2] - palette[k][2];
                let dist = dr * dr + dg * dg + db * db;

                if (dist < minDist) {
                    minDist = dist;
                    idx = k;
                }
            }

            pixel[0] = palette[idx][0];
            pixel[1] = palette[idx][1];
            pixel[2] = palette[idx][2];
        }
    }

    cv.imshow(canvas, src);

    src.delete();
}

function kMeansColorCv(cv, canvas, maxIter = 10) {
    let kmeansInput = document.getElementById('cuantizacion-kmeans-input').value;

    if (kmeansInput === '')
        kmeansInput = '8';
        
    let k = parseInt(kmeansInput);

    let src = cv.imread(canvas);
    cv.cvtColor(src, src, cv.COLOR_RGBA2RGB, 0);

    let rows = src.rows, cols = src.cols;

    let arr = [];

    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            let pixel = src.ucharPtr(i, j);
            arr.push(pixel[0], pixel[1], pixel[2]);
        }
    }

    let matrix = cv.matFromArray(rows * cols, 3, cv.CV_32F, arr);
    let labels = new cv.Mat();
    let centers = new cv.Mat();

    cv.kmeans(
        matrix, k, labels,
        new cv.TermCriteria(cv.TermCriteria_EPS + cv.TermCriteria_MAX_ITER, maxIter, 1.0),
        1, cv.KMEANS_RANDOM_CENTERS, centers
    );

    // Crear la imagen resultante
    let newImg = new cv.Mat(rows, cols, src.type());
    let idx = 0;

    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++, idx++) {
            let centerIdx = labels.intAt(idx, 0);
            let pixel = newImg.ucharPtr(i, j);
            pixel[0] = centers.floatAt(centerIdx, 0);
            pixel[1] = centers.floatAt(centerIdx, 1);
            pixel[2] = centers.floatAt(centerIdx, 2);
        }
    }

    cv.imshow(canvas, newImg);

    src.delete();
    matrix.delete();
    labels.delete();
    centers.delete();
    newImg.delete();
}
// End Color Quantization

// --- End OpenCv --- //