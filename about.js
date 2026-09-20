document.getElementById("year").textContent = new Date().getFullYear();

const revealItems = document.querySelectorAll(".reveal");

const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            entry.target.classList.add("visible");
        }
    });
}, { threshold: 0.12 });

revealItems.forEach((item) => observer.observe(item));

const cube = document.querySelector(".cube");

document.addEventListener("mousemove", (event) => {
    if (!cube) return;

    const x = (event.clientX / window.innerWidth - 0.5) * 12;
    const y = (event.clientY / window.innerHeight - 0.5) * 12;

    cube.style.filter =
        `drop-shadow(${x}px ${y}px 25px rgba(0,191,255,.2))`;
});
