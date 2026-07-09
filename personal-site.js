const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const header = document.querySelector(".site-header");
const menuToggle = document.querySelector(".menu-toggle");
const navLinks = document.querySelectorAll(".site-nav a");
const particleCanvas = document.querySelector("#particleCanvas");

function canAnimate() {
  return !prefersReducedMotion && typeof window.anime === "function";
}

function revealStaticContent() {
  document.querySelectorAll(
    ".reveal-line, .hero-title, .hero-visual, .section-heading, .about-copy, .about-tags, .focus-card, .platform-card, .mini-card, .feature-project, .feature-project-soon"
  ).forEach((target) => {
    target.style.opacity = 1;
  });
}

function updateHeaderState() {
  header.classList.toggle("is-scrolled", window.scrollY > 12);
}

function setupNavigation() {
  menuToggle.addEventListener("click", () => {
    const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!isOpen));
    document.body.classList.toggle("menu-open", !isOpen);
  });

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      menuToggle.setAttribute("aria-expanded", "false");
      document.body.classList.remove("menu-open");
    });
  });
}

function setupMagneticLinks() {
  if (!canAnimate() || window.matchMedia("(pointer: coarse)").matches) {
    return;
  }

  document.querySelectorAll(".magnetic-link").forEach((link) => {
    link.addEventListener("mousemove", (event) => {
      const rect = link.getBoundingClientRect();
      const x = event.clientX - rect.left - rect.width / 2;
      const y = event.clientY - rect.top - rect.height / 2;

      anime({
        targets: link,
        translateX: x * 0.16,
        translateY: y * 0.16,
        duration: 260,
        easing: "easeOutQuad"
      });
    });

    link.addEventListener("mouseleave", () => {
      anime({
        targets: link,
        translateX: 0,
        translateY: 0,
        duration: 420,
        easing: "easeOutElastic(1, .6)"
      });
    });
  });
}

function animateHero() {
  if (!canAnimate()) {
    revealStaticContent();
    return;
  }

  anime.timeline({ easing: "easeOutExpo" })
    .add({
      targets: ".hero-title",
      translateY: [46, 0],
      opacity: [0, 1],
      duration: 900
    })
    .add({
      targets: ".hero-section .reveal-line:not(.hero-title)",
      translateY: [20, 0],
      opacity: [0, 1],
      delay: anime.stagger(80),
      duration: 700
    }, "-=560")
    .add({
      targets: ".hero-visual",
      translateY: [34, 0],
      rotate: [-0.8, 0],
      opacity: [0, 1],
      duration: 820
    }, "-=520");

  anime({
    targets: ".portrait-blob",
    translateY: [-8, 8],
    rotate: (element, index) => index % 2 === 0 ? [4, -4] : [-4, 4],
    delay: anime.stagger(200),
    duration: 3400,
    direction: "alternate",
    easing: "easeInOutSine",
    loop: true
  });

  anime({
    targets: ".floating-tag",
    translateY: [-5, 5],
    duration: 3200,
    direction: "alternate",
    easing: "easeInOutSine",
    loop: true
  });
}

function setupRevealAnimations() {
  const revealTargets = document.querySelectorAll(
    ".section-heading, .about-copy, .about-tags, .focus-card, .platform-card, .mini-card, .feature-project, .feature-project-soon"
  );

  if (!canAnimate() || !("IntersectionObserver" in window)) {
    revealTargets.forEach((target) => {
      target.style.opacity = 1;
    });
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }

      anime({
        targets: entry.target,
        translateY: [28, 0],
        scale: [0.985, 1],
        opacity: [0, 1],
        duration: 720,
        easing: "easeOutExpo"
      });

      observer.unobserve(entry.target);
    });
  }, { threshold: 0.16 });

  revealTargets.forEach((target) => observer.observe(target));
}

function setupParticleCanvas() {
  if (!particleCanvas || prefersReducedMotion) {
    return;
  }

  const context = particleCanvas.getContext("2d");
  const particles = [];
  let particleTotal = 30;
  let width = 0;
  let height = 0;
  let animationFrame = 0;

  function resizeCanvas() {
    const ratio = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;
    particleTotal = width < 640 ? 16 : 30;
    particleCanvas.width = width * ratio;
    particleCanvas.height = height * ratio;
    particleCanvas.style.width = `${width}px`;
    particleCanvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function createParticles() {
    particles.length = 0;

    for (let index = 0; index < particleTotal; index += 1) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 2.2 + 1,
        speedX: (Math.random() - 0.5) * 0.09,
        speedY: (Math.random() - 0.5) * 0.09,
        alpha: Math.random() * 0.28 + 0.08
      });
    }
  }

  function drawFrame() {
    context.clearRect(0, 0, width, height);

    particles.forEach((particle) => {
      particle.x += particle.speedX;
      particle.y += particle.speedY;

      if (particle.x < 0 || particle.x > width) {
        particle.speedX *= -1;
      }

      if (particle.y < 0 || particle.y > height) {
        particle.speedY *= -1;
      }

      context.beginPath();
      context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      context.fillStyle = `rgba(255, 236, 144, ${particle.alpha})`;
      context.fill();
    });

    animationFrame = requestAnimationFrame(drawFrame);
  }

  resizeCanvas();
  createParticles();
  drawFrame();

  window.addEventListener("resize", () => {
    cancelAnimationFrame(animationFrame);
    resizeCanvas();
    createParticles();
    drawFrame();
  });
}

function initPersonalSite() {
  if (canAnimate()) {
    document.body.classList.add("animations-ready");
  }

  updateHeaderState();
  setupNavigation();
  setupMagneticLinks();
  animateHero();
  setupRevealAnimations();
  setupParticleCanvas();
}

window.addEventListener("scroll", updateHeaderState, { passive: true });

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", initPersonalSite);
} else {
  initPersonalSite();
}
