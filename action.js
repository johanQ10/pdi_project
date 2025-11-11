document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('resize', updateSidebar);

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

    async function initWebGPU(imageSrc) {
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
        const context = canvas.getContext('webgpu');
        const format = navigator.gpu.getPreferredCanvasFormat();

        context.configure({
            device,
            format,
            alphaMode: 'opaque'
        });

        try {
            // Carga la imagen
            const img = new Image();
            img.src = imageSrc;
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

            // Shaders WGSL
            const shaderCode = `
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

            @fragment
            fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
                return textureSample(myTexture, mySampler, input.uv);
            }
            `;

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
            }

            frame();
        } catch (e) {
            alert('Error: ' + e.message);
            console.error(e);
        }
    }

    updateSidebar();

    let imageSrc; // Imagen por defecto

    const imageInput = document.getElementById('image-upload');

    if (imageInput) {
        imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];

            if (file) {
                imageSrc = URL.createObjectURL(file);
                initWebGPU(imageSrc); // Recarga la imagen en el canvas
            }
        });

        // Callbacks para las opciones del menú
        const menuLinks = document.querySelectorAll('.sidebar nav a');
        menuLinks.forEach((link, idx) => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                switch (idx) {
                    case 0:
                        // code
                        break;
                    case 1:
                        // code
                        break;
                    case 2:
                        // code
                        break;
                    default:
                        alert('Opción de menú');
                }
            });
        });
    }
});