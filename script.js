// ---- Nav scroll effect ----
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('nav--scrolled', window.scrollY > 40);
}, { passive: true });

// ---- Mobile menu toggle ----
const toggle = document.getElementById('navToggle');
const links = document.getElementById('navLinks');

toggle.addEventListener('click', () => {
  toggle.classList.toggle('active');
  links.classList.toggle('open');
});

// Close menu on link click
links.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    toggle.classList.remove('active');
    links.classList.remove('open');
  });
});

// ---- Scroll reveal ----
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll(
  '.section-tag, .section-title, .section-desc, .stat, .need, .feature, .capability, .team__member, .comparison__table-wrap, .contact__text, .contact__form, .features__credibility'
).forEach(el => {
  el.classList.add('fade-in');
  observer.observe(el);
});

// ---- Contact form ----
document.getElementById('contactForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  btn.textContent = 'Sending…';
  btn.disabled = true;

  fetch('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(new FormData(form)).toString()
  })
    .then(res => {
      if (res.ok) {
        btn.textContent = 'Message Sent!';
        btn.style.background = 'var(--accent)';
        form.reset();
      } else {
        console.error('Form error:', res.status, res.statusText);
        btn.textContent = 'Something went wrong (' + res.status + ')';
      }
    })
    .catch(err => {
      console.error('Form error:', err);
      btn.textContent = 'Something went wrong';
    })
    .finally(() => {
      setTimeout(() => {
        btn.textContent = 'Send Message';
        btn.style.background = '';
        btn.disabled = false;
      }, 3000);
    });
});
