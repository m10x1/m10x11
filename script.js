
document.addEventListener('DOMContentLoaded', () => {
  const items = document.querySelectorAll(
    '.card, .service, .section h2'
  );

  if (!('IntersectionObserver' in window)) {
    return;
  }

  items.forEach(item => {
    item.classList.add('reveal');
  });

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );

  items.forEach(item => observer.observe(item));
});
