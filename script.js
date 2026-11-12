
document.addEventListener('DOMContentLoaded', () => {
  // Smooth navigation
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', event => {
      const target = document.querySelector(
        link.getAttribute('href')
      );

      if (target) {
        event.preventDefault();
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // Safe demonstration request form
  const form = document.getElementById('demoRequestForm');
  const status = document.getElementById('requestStatus');

  if (form && status) {
    form.addEventListener('submit', event => {
      event.preventDefault();

      const email = form.querySelector(
        'input[type="email"]'
      );

      if (!email || !email.validity.valid) {
        status.textContent = 'يرجى إدخال بريد إلكتروني صحيح.';
        return;
      }

      status.textContent =
        'تم تسجيل الطلب التجريبي بنجاح. لم يتم إرسال أي رمز تحقق.';

      form.reset();
    });
  }

  // FAQ: Allow one expanded answer at a time
  document.querySelectorAll('.faq-list details')
    .forEach(item => {
      item.addEventListener('toggle', () => {
        if (!item.open) return;

        document.querySelectorAll('.faq-list details')
          .forEach(other => {
            if (other !== item) other.open = false;
          });
      });
    });
});
