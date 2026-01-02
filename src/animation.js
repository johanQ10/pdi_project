// Modal logic for custom kernel
document.addEventListener('DOMContentLoaded', function() {
    const menuCustom = document.getElementById('menu-custom');
    const modal = document.getElementById('custom-kernel-modal');
    const closeBtn = document.getElementById('close-custom-modal');
    const form = document.getElementById('custom-kernel-form');
    const inputsContainer = document.querySelector('.custom-kernel-inputs');

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
