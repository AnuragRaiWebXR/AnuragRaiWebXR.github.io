AFRAME.registerComponent('depth-occluder', {
  init: function () {
    this.el.addEventListener('model-loaded', () => {
      const mesh = this.el.getObject3D('mesh');
      if (!mesh) return;
      mesh.traverse(node => {
        if (node.isMesh) {
          const mats = Array.isArray(node.material) ? node.material : [node.material];
          mats.forEach(m => { m.colorWrite = false; m.depthWrite = true; });
        }
      });
    });
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const scene = document.querySelector("a-scene");
  const target = scene.querySelector("[mindar-image-target]");
  if (!target) { console.warn('MindAR target not found!'); return; }

  const items = [
    { food: "#food1", star: "#star1", starStart: "-0.3 0.2 -0.05", starEnd: "-0.63 0.2 -0.05", side: "left" },
    { food: "#food2", star: "#star2", starStart: "-0.3 -0.03 -0.05", starEnd: "-0.63 -0.03 -0.05", side: "left" },
    { food: "#food3", star: "#star3", starStart: "0.3 -0.4 -0.05", starEnd: "0.63 -0.4 -0.05", side: "right" },
    { food: "#food4", star: "#star4", starStart: "0.3 -0.63 -0.05", starEnd: "0.63 -0.63 -0.05", side: "right" }
  ];

  let timeouts = [], rafIds = [], activePanel = null;
  const safeTimeout = (fn, d) => { const id = setTimeout(fn, d); timeouts.push(id); };
  const safeRaf = fn => { const id = requestAnimationFrame(fn); rafIds.push(id); };
  const clearAnims = () => { timeouts.forEach(clearTimeout); rafIds.forEach(cancelAnimationFrame); timeouts=[]; rafIds=[]; };

  const setModelOpacity = (el, opacity) => {
    const mesh = el.getObject3D('mesh');
    if (!mesh) return;
    mesh.traverse(n => {
      if (n.isMesh) {
        const mats = Array.isArray(n.material) ? n.material : [n.material];
        mats.forEach(m => { m.transparent = true; m.opacity = opacity; });
      }
    });
  };

  const resetAll = () => {
    clearAnims();
    closeReviewPanel();
    items.forEach(({ food, star, starStart }) => {
      const f = target.querySelector(food);
      const s = target.querySelector(star);
      if (f) { f.setAttribute("visible", false); setModelOpacity(f, 0); f.removeAttribute("animation__rotate"); }
      if (s) s.setAttribute("position", starStart);
    });
  };

  const whenLoaded = el => new Promise(res => el.hasLoaded ? res() : el.addEventListener("loaded", res, { once: true }));
  const easeInOutQuad = t => t < 0.5 ? 2*t*t : -1 + (4-2*t)*t;

  const showFoodAndStars = (foodEl, starEl, start, end) => {
    const DURATION = 2000;
    return Promise.all([whenLoaded(foodEl), whenLoaded(starEl)]).then(() => {
      setModelOpacity(foodEl, 0); foodEl.setAttribute("visible", true);
      starEl.setAttribute("position", start);
      foodEl.setAttribute("animation__rotate", { property: "rotation", to: "0 360 0", dur: 2000, easing: "linear", loop: true });

      let startTime = null;
      const animate = t => {
        if (startTime === null) startTime = t;
        const p = Math.min((t - startTime) / DURATION, 1), e = easeInOutQuad(p);
        setModelOpacity(foodEl, e);
        const sPos = start.split(" ").map(Number), ePos = end.split(" ").map(Number);
        const cPos = sPos.map((s, i) => s + (ePos[i] - s) * e);
        starEl.setAttribute("position", cPos.join(" "));
        if (p < 1) safeRaf(animate);
      };
      safeRaf(animate);
    });
  };

  const playSequence = () => {
    resetAll();
    items.forEach(({ food, star, starStart, starEnd }, i) => {
      safeTimeout(() => {
        const f = target.querySelector(food), s = target.querySelector(star);
        if (f && s) showFoodAndStars(f, s, starStart, starEnd);
      }, i * 3000);
    });
  };

  function openReviewPanel(side, foodId) {
    closeReviewPanel();
    const panel = document.createElement("a-entity");
    panel.setAttribute("position", side === "left" ? "-1 0 0" : "1 0 0");
    panel.setAttribute("geometry", "primitive: plane; width: 0.8; height: 1.2");
    panel.setAttribute("material", "color: white; opacity: 0.95");

    const scroll = document.createElement("a-entity");
    scroll.setAttribute("position", "0 0 0.01");
    panel.appendChild(scroll);

    const reviews = [
      { profile: "./images/profile1.png", comment: "Loved it!", stars: 5 },
      { profile: "./images/profile2.png", comment: "Pretty good", stars: 4 },
      { profile: "./images/profile3.png", comment: "Not bad", stars: 3 },
      { profile: "./images/profile4.png", comment: "Could be better", stars: 2 },
      { profile: "./images/profile5.png", comment: "Not my taste", stars: 1 },
    ];

    reviews.forEach((r, i) => {
      const y = 0.5 - i * 0.35;
      const card = document.createElement("a-plane");
      card.setAttribute("position", `0 ${y} 0`);
      card.setAttribute("width", "0.75");
      card.setAttribute("height", "0.3");
      card.setAttribute("color", "#f9f9f9");

      const pic = document.createElement("a-image");
      pic.setAttribute("src", r.profile);
      pic.setAttribute("position", "-0.3 0 0.01");
      pic.setAttribute("width", "0.2");
      pic.setAttribute("height", "0.2");
      card.appendChild(pic);

      const starsText = "★".repeat(r.stars) + "☆".repeat(5 - r.stars);
      const txt = document.createElement("a-text");
      txt.setAttribute("value", `${starsText}\n${r.comment}`);
      txt.setAttribute("position", "-0.05 0 0.01");
      txt.setAttribute("width", "0.5");
      txt.setAttribute("color", "#222");
      card.appendChild(txt);

      scroll.appendChild(card);
    });

    // === Scroll Logic with Momentum + Eased Bounce ===
    let startY = 0;
    let scrollY = 0;
    let isDragging = false;
    let velocity = 0;
    let lastY = 0;
    let lastTime = 0;

    const minY = -((reviews.length * 0.35) - 1.2); // lower bound
    const maxY = 0.5; // upper bound
    const friction = 0.95; // slow momentum
    const bounceStrength = 0.1; // springiness
    const bounceEase = 0.2; // easing speed

    const updateScroll = (y) => {
      scroll.setAttribute("position", `0 ${y} 0.01`);
    };

    const onStart = (y) => {
      isDragging = true;
      velocity = 0;
      startY = y - scrollY;
      lastY = y;
      lastTime = performance.now();
    };

    const onMove = (y) => {
      if (!isDragging) return;
      const now = performance.now();
      const delta = y - lastY;
      const dt = now - lastTime;
      velocity = delta / dt * 16; // normalize to ~60fps
      scrollY = y - startY;
      updateScroll(scrollY);
      lastY = y;
      lastTime = now;
    };

    const onEnd = () => {
      isDragging = false;
      requestAnimationFrame(momentum);
    };

    const momentum = () => {
      if (isDragging) return;

      // Apply velocity
      scrollY += velocity;
      velocity *= friction;

      // Bounce if out of bounds
      if (scrollY > maxY) {
        const overshoot = scrollY - maxY;
        velocity -= overshoot * bounceStrength;
        scrollY -= overshoot * bounceEase;
      } else if (scrollY < minY) {
        const overshoot = scrollY - minY;
        velocity -= overshoot * bounceStrength;
        scrollY -= overshoot * bounceEase;
      }

      updateScroll(scrollY);

      if (Math.abs(velocity) > 0.001 || scrollY > maxY + 0.01 || scrollY < minY - 0.01) {
        requestAnimationFrame(momentum);
      }
    };

    // Mouse events
    panel.addEventListener("mousedown", e => onStart(e.clientY));
    window.addEventListener("mousemove", e => onMove(e.clientY));
    window.addEventListener("mouseup", onEnd);

    // Touch events
    panel.addEventListener("touchstart", e => onStart(e.touches[0].clientY));
    panel.addEventListener("touchmove", e => onMove(e.touches[0].clientY));
    panel.addEventListener("touchend", onEnd);

    // =====================

    panel.setAttribute("class", "clickable");
    target.appendChild(panel);
    activePanel = panel;
  }


  function closeReviewPanel() {
    if (activePanel && activePanel.parentNode) {
      activePanel.parentNode.removeChild(activePanel);
      activePanel = null;
    }
  }

  // Manual click handler — works in MindAR AR mode
  function manualClickHandler(event) {
    const rect = scene.canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, scene.camera);

    const clickableEls = [];
    items.forEach(({ star }) => {
      const el = target.querySelector(star);
      if (el) {
        const mesh = el.getObject3D('mesh');
        if (mesh) clickableEls.push(mesh);
      }
    });

    const intersects = raycaster.intersectObjects(clickableEls, true);
    if (intersects.length > 0) {
      const clickedEl = intersects[0].object.el;
      const item = items.find(i => i.star === `#${clickedEl.id}`);
      if (item) {
        console.log("Clicked star:", clickedEl.id);
        openReviewPanel(item.side, item.food);
      }
    }
  }

  scene.addEventListener("mousedown", manualClickHandler);

  target.addEventListener("targetFound", playSequence);
  target.addEventListener("targetLost", resetAll);
});
