function setupRiverSteps() {
  const steps = document.querySelectorAll(".river-step");

  if (!steps.length) return;

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("show");
        }
      });
    },
    {
      threshold: 0.22
    }
  );

  steps.forEach(step => observer.observe(step));
}

document.addEventListener("DOMContentLoaded", setupRiverSteps);
