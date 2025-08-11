// Touch scroll component for vertical drag scrolling on an entity
AFRAME.registerComponent('touch-scroll', {
  schema: {
    minY: { type: 'number', default: -1 },
    maxY: { type: 'number', default: 1 },
  },
  init: function () {
    this.startY = 0;
    this.currentY = 0;
    this.dragging = false;

    this.onTouchStart = (e) => {
      this.dragging = true;
      this.startY = e.touches ? e.touches[0].clientY : e.clientY;
      this.el.sceneEl.canvas.style.touchAction = 'none'; // prevent default scrolling
    };
    this.onTouchMove = (e) => {
      if (!this.dragging) return;
      const y = e.touches ? e.touches[0].clientY : e.clientY;
      const delta = (y - this.startY) / 300; // scale drag to world units, tweak 300 as needed
      let newY = this.currentY + delta;
      newY = Math.min(Math.max(newY, this.data.minY), this.data.maxY);
      this.el.object3D.position.y = newY;
    };
    this.onTouchEnd = (e) => {
      if (!this.dragging) return;
      const y = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
      const delta = (y - this.startY) / 300;
      this.currentY = this.currentY + delta;
      this.currentY = Math.min(Math.max(this.currentY, this.data.minY), this.data.maxY);
      this.dragging = false;
      this.el.sceneEl.canvas.style.touchAction = 'auto';
    };

    this.el.addEventListener('touchstart', this.onTouchStart);
    this.el.addEventListener('touchmove', this.onTouchMove);
    this.el.addEventListener('touchend', this.onTouchEnd);
    // Also support mouse for desktop testing
    this.el.addEventListener('mousedown', this.onTouchStart);
    this.el.addEventListener('mousemove', this.onTouchMove);
    this.el.addEventListener('mouseup', this.onTouchEnd);
  },
  remove: function () {
    this.el.removeEventListener('touchstart', this.onTouchStart);
    this.el.removeEventListener('touchmove', this.onTouchMove);
    this.el.removeEventListener('touchend', this.onTouchEnd);
    this.el.removeEventListener('mousedown', this.onTouchStart);
    this.el.removeEventListener('mousemove', this.onTouchMove);
    this.el.removeEventListener('mouseup', this.onTouchEnd);
  }
});

AFRAME.registerComponent('depth-occluder', {
  init: function () {
    const mesh = this.el.getObject3D('mesh');
    if (mesh) {
      mesh.material.colorWrite = false;
      mesh.material.depthWrite = true;
    }
    this.el.addEventListener('model-loaded', () => {
      const m = this.el.getObject3D('mesh');
      if (m) {
        m.material.colorWrite = false;
        m.material.depthWrite = true;
      }
    });
  }
});

AFRAME.registerComponent('billboard', {
  tick: function () {
    const cam = this.el.sceneEl.camera;
    if (cam && this.el.object3D) {
      this.el.object3D.lookAt(cam.position);
    }
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const scene = document.querySelector("a-scene");
  const target = scene.querySelector("[mindar-image-target]");

  const items = [
    { food: "#food1", star: "#star1", starStart: "-0.3 0.2 -0.05", starEnd: "-0.63 0.2 -0.05", side: "left" },
    { food: "#food2", star: "#star2", starStart: "-0.3 -0.03 -0.05", starEnd: "-0.63 -0.03 -0.05", side: "left" },
    { food: "#food3", star: "#star3", starStart: "0.3 -0.4 -0.05", starEnd: "0.63 -0.4 -0.05", side: "right" },
    { food: "#food4", star: "#star4", starStart: "0.3 -0.63 -0.05", starEnd: "0.63 -0.63 -0.05", side: "right" }
  ];

  let timeouts = [];
  let rafIds = [];

  function safeTimeout(fn, delay) {
    const id = setTimeout(fn, delay);
    timeouts.push(id);
    return id;
  }
  function clearAllTimeouts() {
    timeouts.forEach(id => clearTimeout(id));
    timeouts = [];
  }

  function safeRaf(fn) {
    const id = requestAnimationFrame(fn);
    rafIds.push(id);
    return id;
  }
  function clearAllRafs() {
    rafIds.forEach(id => cancelAnimationFrame(id));
    rafIds = [];
  }

  function clearAllAnimations() {
    clearAllTimeouts();
    clearAllRafs();
  }

  function setModelOpacity(el, opacity) {
    const mesh = el.getObject3D('mesh');
    if (mesh) {
      mesh.traverse(node => {
        if (node.isMesh && node.material) {
          node.material.transparent = true;
          node.material.opacity = opacity;
        }
      });
    }
  }

  function resetAll() {
    clearAllAnimations();
    closeReviewPanel();
    items.forEach(({ food, star, starStart }) => {
      const foodEl = target.querySelector(food);
      const starEl = target.querySelector(star);

      foodEl.setAttribute("visible", false);
      foodEl.setAttribute("rotation", "0 0 0");
      setModelOpacity(foodEl, 0);
      foodEl.removeAttribute("animation__rotate");

      starEl.setAttribute("position", starStart);
    });
  }

  function whenLoaded(el) {
    return new Promise(res => {
      if (el.hasLoaded) res();
      else el.addEventListener("model-loaded", res, { once: true });
      el.addEventListener("loaded", res, { once: true });
    });
  }

  function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  function showFoodAndStars(foodEl, starEl, starStart, starEnd) {
    const FADE_DURATION = 2000;
    return Promise.all([whenLoaded(foodEl), whenLoaded(starEl)]).then(() => {
      setModelOpacity(foodEl, 0);
      foodEl.setAttribute("visible", true);
      starEl.setAttribute("position", starStart);

      foodEl.setAttribute("animation__rotate", {
        property: "rotation",
        to: "0 360 0",
        dur: 2000,
        easing: "linear",
        loop: true
      });

      let startTime = null;
      function animateStep(timestamp) {
        if (startTime === null) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / FADE_DURATION, 1);
        const eased = easeInOutQuad(progress);

        setModelOpacity(foodEl, eased);

        const startPos = starStart.split(" ").map(Number);
        const endPos = starEnd.split(" ").map(Number);
        const currentPos = startPos.map((startVal, i) =>
          startVal + (endPos[i] - startVal) * eased
        );
        starEl.setAttribute("position", currentPos.join(" "));

        if (progress < 1) safeRaf(animateStep);
      }
      safeRaf(animateStep);
    });
  }

  function playSequence() {
    resetAll();
    items.forEach(({ food, star, starStart, starEnd }, index) => {
      safeTimeout(() => {
        const foodEl = target.querySelector(food);
        const starEl = target.querySelector(star);
        showFoodAndStars(foodEl, starEl, starStart, starEnd);
      }, index * 3000);
    });
  }

  target.addEventListener("targetFound", playSequence);
  target.addEventListener("targetLost", resetAll);

  // --- Review panel system ---
  let activePanel = null;
  function openReviewPanel(side, foodId) {
    closeReviewPanel();

    const panel = document.createElement("a-entity");
    panel.setAttribute("billboard", "");
    panel.setAttribute("position", side === "left" ? "-1 0 0" : "1 0 0");
    panel.setAttribute("geometry", "primitive: plane; width: 0.8; height: 1.2");
    panel.setAttribute("material", "color: white; opacity: 0.95");

    // Scroll container for reviews with touch-scroll
    const scrollContainer = document.createElement("a-entity");
    scrollContainer.setAttribute("position", "0 0 0.01");
    scrollContainer.setAttribute("touch-scroll", "minY: -0.6; maxY: 0.2");
    panel.appendChild(scrollContainer);

    // Mock reviews array (replace with your actual data if needed)
    const reviews = [
      { profile: "./images/profile1.jpg", comment: "Loved it!", stars: 5 },
      { profile: "./images/profile2.jpg", comment: "Pretty good", stars: 4 },
      { profile: "./images/profile3.jpg", comment: "Not bad", stars: 3 },
      { profile: "./images/profile4.jpg", comment: "Could be better", stars: 2 },
      { profile: "./images/profile5.jpg", comment: "Not my taste", stars: 1 },
    ];

    reviews.forEach((r, i) => {
      const yOffset = 0.5 - i * 0.35;
      const card = document.createElement("a-plane");
      card.setAttribute("position", `0 ${yOffset} 0`);
      card.setAttribute("width", "0.75");
      card.setAttribute("height", "0.3");
      card.setAttribute("color", "#f9f9f9");
      card.setAttribute("radius", "0.05");

      const profilePic = document.createElement("a-image");
      profilePic.setAttribute("src", r.profile);
      profilePic.setAttribute("position", "-0.3 0 0.01");
      profilePic.setAttribute("width", "0.2");
      profilePic.setAttribute("height", "0.2");
      card.appendChild(profilePic);

      const starsText = "★".repeat(r.stars) + "☆".repeat(5 - r.stars);
      const comment = document.createElement("a-text");
      comment.setAttribute("value", `${starsText}\n${r.comment}`);
      comment.setAttribute("position", "-0.05 0 0.01");
      comment.setAttribute("width", "0.5");
      comment.setAttribute("color", "#222");
      card.appendChild(comment);

      scrollContainer.appendChild(card);
    });

    // Close button
    const closeBtn = document.createElement("a-plane");
    closeBtn.setAttribute("position", "0.35 0.55 0.02");
    closeBtn.setAttribute("width", "0.15");
    closeBtn.setAttribute("height", "0.15");
    closeBtn.setAttribute("color", "#cc4444");
    closeBtn.setAttribute("radius", "0.1");
    closeBtn.setAttribute("class", "clickable");
    panel.appendChild(closeBtn);

    const closeText = document.createElement("a-text");
    closeText.setAttribute("value", "X");
    closeText.setAttribute("align", "center");
    closeText.setAttribute("color", "#fff");
    closeText.setAttribute("width", "0.1");
    closeText.setAttribute("position", "0 0 0.03");
    closeBtn.appendChild(closeText);

    closeBtn.addEventListener("click", () => {
      closeReviewPanel();
    });

    target.appendChild(panel);
    activePanel = panel;
  }

  function closeReviewPanel() {
    if (activePanel && activePanel.parentNode) {
      activePanel.parentNode.removeChild(activePanel);
      activePanel = null;
    }
  }

  // Attach click listeners to stars
  items.forEach(({ star, side, food }) => {
    const starEl = target.querySelector(star);
    starEl.classList.add("clickable");
    starEl.addEventListener("click", () => openReviewPanel(side, food));
  });
});
