// Modal logic for custom kernel
document.addEventListener('DOMContentLoaded', function() {
    const menuCustom = document.getElementById('menu-custom');
    const modal = document.getElementById('custom-kernel-modal');
    const closeBtn = document.getElementById('close-custom-modal');
    const form = document.getElementById('custom-kernel-form');
    const inputsContainer = document.querySelector('.custom-kernel-inputs');
    const customInputX = document.getElementById('custom-input-x');
    const customInputY = document.getElementById('custom-input-y');

    if (menuCustom && modal && closeBtn && form && inputsContainer) {
        // Move all custom-input-X from DOM to modal
        const inputIds = Array.from({length: 49}, (_, i) => `custom-input-${i + 1}`);

        inputIds.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                inputsContainer.appendChild(input);
                alert('Input ' + id + ' moved to modal.');
            } else {
                const newInput = document.createElement('input');
                newInput.type = 'number';
                newInput.id = id;
                newInput.className = 'input-style filters-kernel';
                newInput.value = '0';
                newInput.step = '1';
                inputsContainer.appendChild(newInput);

                if ((parseInt(id.split('-')[2]) % 7) === 0) {
                    const endline = document.createElement('br');
                    inputsContainer.appendChild(endline);
                }
            }
        });

        menuCustom.addEventListener('click', function(e) {
            e.preventDefault();
            modal.style.display = 'block';
        });
        closeBtn.addEventListener('click', function() {
            modal.style.display = 'none';
        });
        window.addEventListener('click', function(event) {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            modal.style.display = 'none';
            // Aquí puedes llamar a kernelCustom() si es necesario
            if (typeof window.kernelCustom === 'function') {
                window.kernelCustom();
            }
        });

        customInputX.addEventListener('change', function() {
            const x = parseInt(customInputX.value);
            const y = parseInt(customInputY.value);
            adjustKernelInputs(x, y);
        });
        customInputY.addEventListener('change', function() {
            const x = parseInt(customInputX.value);
            const y = parseInt(customInputY.value);
            adjustKernelInputs(x, y);
        });

        const x = parseInt(customInputX.value);
        const y = parseInt(customInputY.value);
        adjustKernelInputs(x, y);
    }

    function adjustKernelInputs(x, y) {
        let indexX = 0, indexY = 0;

        for (let i = 0; i < 7; i++) {
            for (let j = 0; j < 7; j++) {
                const input = document.getElementById(`custom-input-${i * 7 + j + 1}`);

                if (indexX < x && indexY < y) {
                    input.style.display = 'inline-block';
                } else {
                    input.style.display = 'none';
                }

                indexX++;
            }
            indexY++;
            indexX = 0;
        }
    }
});
// animation.js
// Controla la expansión/colapso animada de los submenús laterales
document.addEventListener('DOMContentLoaded', function() {
    const groupTitles = document.querySelectorAll('.menu-group-title');
    groupTitles.forEach(title => {
        const content = title.nextElementSibling;
        // Inicialmente colapsar todos
        content.style.maxHeight = '0px';
        content.style.overflowY = 'auto';
        content.style.display = 'none';
        content.classList.remove('expanded');
        title.setAttribute('aria-expanded', 'false');
        title.addEventListener('click', function() {
            // Cerrar todos los demás
            document.querySelectorAll('.menu-group-content.expanded').forEach(openContent => {
                if (openContent !== content) {
                    collapseGroup(openContent.previousElementSibling, openContent);
                }
            });
            if (content.classList.contains('expanded')) {
                collapseGroup(title, content);
            } else {
                expandGroup(title, content);
            }
        });
    });
});

// Modal guardar imagen
document.addEventListener('DOMContentLoaded', function() {
    var saveBtn = document.getElementById('btn-save-image');
    var modal = document.getElementById('save-image-modal');
    var closeModal = document.getElementById('close-save-modal');
    if (saveBtn && modal && closeModal) {
        saveBtn.addEventListener('click', function() {
            modal.style.display = 'block';
        });
        closeModal.addEventListener('click', function() {
            modal.style.display = 'none';
        });
        // Cerrar modal al hacer click fuera del contenido
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
});

// Línea horizontal desplazable en el canvas
function imageLoadedCallback() {
    var gpuCanvas = document.getElementById('gpu-canvas');
    var hLine = document.getElementById('horizontal-line');

    if (gpuCanvas && hLine) {
        // Mostrar la línea solo si el canvas está visible
        function showLineIfCanvasVisible() {
            if (gpuCanvas.style.display !== 'none') {
                hLine.style.display = 'block';
                // Centrar la línea al inicio
                var rect = gpuCanvas.getBoundingClientRect();
                var y = Math.floor(rect.height / 2);
                setLineY(0);
            } else {
                hLine.style.display = 'none';
            }
        }
        // Llamar al mostrar el canvas
        gpuCanvas.addEventListener('transitionend', showLineIfCanvasVisible);
        // O llamar manualmente si el canvas se muestra por JS
        showLineIfCanvasVisible();

        // Función para posicionar la línea y el label
        function setLineY(y) {
            var rect = gpuCanvas.getBoundingClientRect();
            var mainContent = document.querySelector('.main-content');
            var mainRect = mainContent ? mainContent.getBoundingClientRect() : rect;
            // Limitar el rango vertical solo al área visible de la imagen
            y = Math.max(0, Math.min(y, rect.height - 1));

            hLine.style.top = y + 'px';
            // Ajustar el ancho de la línea al ancho de main-content
            hLine.style.width = (mainRect.width - 10) + 'px';

            profileCurveLine(y);
        }

        // Drag & drop para la línea
        let dragging = false;
        hLine.addEventListener('mousedown', function(e) {
            dragging = true;
            e.preventDefault();
        });
        document.addEventListener('mousemove', function(e) {
            if (dragging) {
                var rect = gpuCanvas.getBoundingClientRect();
                var y = e.clientY - rect.top;
                setLineY(y);
            }
        });
        document.addEventListener('mouseup', function() {
            dragging = false;
        });
        // Si el canvas cambia de tamaño, actualizar la línea
        window.addEventListener('resize', function() {
            if (hLine.style.display === 'block') {
                var rect = gpuCanvas.getBoundingClientRect();
                var y = parseInt(hLine.style.top) || Math.floor(rect.height / 2);
                setLineY(0);
            }
        });
    }
}

function toggleMenuGroup(btn) {
    const content = btn.nextElementSibling;
    content.classList.toggle('expanded');
}

function expandGroup(title, content) {
    content.classList.add('expanded');
    content.style.display = 'block';
    // Forzar reflow para que la transición funcione
    void content.offsetWidth;
    content.style.transition = 'max-height 0.35s cubic-bezier(0.4,0,0.2,1)';
    content.style.maxHeight = '90%';//content.scrollHeight + 'px';
    title.setAttribute('aria-expanded', 'true');
}

function collapseGroup(title, content) {
    content.classList.remove('expanded');
    content.style.transition = 'max-height 0.35s cubic-bezier(0.4,0,0.2,1)';
    content.style.maxHeight = '0px';
    title.setAttribute('aria-expanded', 'false');
    setTimeout(() => {
        if (!content.classList.contains('expanded')) {
            content.style.display = 'none';
        }
    }, 350);
}
