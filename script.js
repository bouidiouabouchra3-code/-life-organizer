const names = {
  tasks: "المهام",
  expenses: "المصاريف",
  notes: "الملاحظات",
  habits: "العادات",
  study: "الدراسة",
  ideas: "الأفكار"
};

document.querySelectorAll(".feature").forEach((button) => {
  button.addEventListener("click", () => {
    const box = document.getElementById("placeholder");
    const name = names[button.dataset.target];
    box.classList.remove("hidden");
    box.innerHTML = `<strong>${name}</strong><p>هذا القسم سنفعّله في الباتشات القادمة. P01 يثبت الهيكل والتصميم والتنقل الأساسي.</p>`;
    box.scrollIntoView({ behavior: "smooth", block: "center" });
  });
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js"));
}
