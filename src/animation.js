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
