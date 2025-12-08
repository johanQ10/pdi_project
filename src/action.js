document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('resize', updateSidebar);

    let imageSrc; // Imagen por defecto
    let img;
    let context;
    let bitsPerPixel = 0;

    let genericInitShader = `
        @group(0) @binding(0) var mySampler: sampler;
        @group(0) @binding(1) var myTexture: texture_2d<f32>;

        struct VertexOutput {
            @builtin(position) position: vec4<f32>,
            @location(0) uv: vec2<f32>
        };
        `;
    let genericVertexShader = `@vertex
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

    let colorScaleShader;

    const erosionShader = genericInitShader + genericVertexShader + 
        `
        @fragment
        fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
            let texSize = vec2<f32>(textureDimensions(myTexture, 0));
            let pixel = input.uv * texSize;
            var minVal = 1.0;
            for(var dy: i32 = -1; dy <= 1; dy++) {
                for(var dx: i32 = -1; dx <= 1; dx++) {
                    let coord = (pixel + vec2<f32>(f32(dx), f32(dy))) / texSize;
                    let color = textureSample(myTexture, mySampler, coord);
                    // Para escala de grises, usa solo un canal (ejemplo: .r)
                    minVal = min(minVal, color.r);
                }
            }
            return vec4<f32>(minVal, minVal, minVal, 1.0);
        }
        `;

    const dilatationShader = genericInitShader + genericVertexShader + 
        `
        @fragment
        fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
            let texSize = vec2<f32>(textureDimensions(myTexture, 0));
            let pixel = input.uv * texSize;
            var maxVal = 0.0;
            for(var dy: i32 = -1; dy <= 1; dy++) {
                for(var dx: i32 = -1; dx <= 1; dx++) {
                    let coord = (pixel + vec2<f32>(f32(dx), f32(dy))) / texSize;
                    let color = textureSample(myTexture, mySampler, coord);
                    // Para escala de grises, usa solo un canal (ejemplo: .r)
                    maxVal = max(maxVal, color.r);
                }
            }
            return vec4<f32>(maxVal, maxVal, maxVal, 1.0);
        }
        `;

    const grayScaleShader = genericInitShader + genericVertexShader +
        `
        @fragment
        fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
            let color = textureSample(myTexture, mySampler, input.uv);
            let promColor = dot(color.rgb, vec3<f32>(0.21, 0.72, 0.07));
            // let promColor = (color.r + color.g + color.b) / 3.0;
            return vec4<f32>(promColor, promColor, promColor, 1.0);
        }
        `;

    const negativeShader =  genericInitShader + genericVertexShader + 
        `
        @fragment
        fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
            let color = textureSample(myTexture, mySampler, input.uv);
            let r = 1.0 - color.r;
            let g = 1.0 - color.g;
            let b = 1.0 - color.b;
            return vec4<f32>(r, g, b, 1.0);
        }
        `;

    const generalShader =  genericInitShader + genericVertexShader + 
        `
        @fragment
        fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
            return textureSample(myTexture, mySampler, input.uv);
        }
        `;

    function updateSidebar() {
        // Menú lateral responsive
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

    async function initWebGPU(imageSrc, shaderCode) {
        const canvas = document.getElementById('gpu-canvas');
        // Verifica soporte de WebGPU
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
            await img.decode();

            // Crea un bitmap de la imagen
            const imageBitmap = await createImageBitmap(img);

            // Ajusta el tamaño del canvas al de la imagen
            canvas.width = imageBitmap.width;
            canvas.height = imageBitmap.height;

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

            // Renderiza la imagen
            function frame() {
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
                img.src = imageSrc;
            }

            frame();
        } catch (e) {
            alert('Error: ' + e.message);
            console.error(e);
        }
    }

    function colorToRGB(r, g, b) {
        return genericInitShader + genericVertexShader + 
        `
        @fragment
        fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
            let color = textureSample(myTexture, mySampler, input.uv);
            let promColor = (color.r + color.g + color.b) / 3.0;

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

    function getImageInfo() {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        const ctx = canvas.getContext('2d');

        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
        const data = imageData.data;

        const colors = new Set();

        for (let i = 0; i < data.length; i += 4) {
            let str = `${data[i]},${data[i + 1]},${data[i + 2]},${data[i + 3]}`;
            colors.add(str);
        }

        alert(`
            IMAGEN
            Dimensiones: ${img.naturalWidth} x ${img.naturalHeight} px
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

    updateSidebar();

    const imageInput = document.getElementById('image-load');

    if (imageInput) {
        imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];

            if (file) {
                getBitsPerPixel(file);

                document.getElementById('gpu-canvas').style.display = 'flex';

                img = new Image();
                imageSrc = URL.createObjectURL(file);
                img.src = imageSrc;

                initWebGPU(imageSrc, generalShader);
                imageInput.value = '';
            }
        });

        const info = document.getElementById('menu-info');
        const erosion = document.getElementById('menu-erosion');
        const dilatacion = document.getElementById('menu-dilatation');
        const grayScale = document.getElementById('menu-grayscale');
        const colorScale = document.getElementById('menu-colorscale');
        const negative = document.getElementById('menu-negative');

        info.addEventListener('click', function(event) { getImageInfo(); });
        erosion.addEventListener('click', function(event) { initWebGPU(imageSrc, erosionShader); });
        dilatacion.addEventListener('click', function(event) { initWebGPU(imageSrc, dilatationShader); });
        grayScale.addEventListener('click', function(event) { initWebGPU(imageSrc, grayScaleShader); });
        colorScale.addEventListener('click', function(event) { initWebGPU(imageSrc, colorScaleShader); });
        negative.addEventListener('click', function(event) { initWebGPU(imageSrc, negativeShader); });

        const colorPicker = document.getElementById('color-picker');

        colorScaleShader = colorToRGB(1.0, 0.0, 0.0);

        colorPicker.addEventListener('input', (event) => {
            const colorValue = event.target.value;
            const r = parseInt(colorValue.substring(1, 3), 16) / 255.0;
            const g = parseInt(colorValue.substring(3, 5), 16) / 255.0;
            const b = parseInt(colorValue.substring(5, 7), 16) / 255.0;

            colorScaleShader = colorToRGB(r, g, b);
        });
    }
});