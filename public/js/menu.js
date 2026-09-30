const caminho = location.pathname;

document.querySelectorAll('.menu a').forEach((link) => {
    const href = link.getAttribute('href');

    if (caminho === href || (href === '/' && caminho === '/agendar')) {
        link.classList.add('active');
    }
});
