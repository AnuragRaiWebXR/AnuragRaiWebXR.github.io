AFRAME.registerComponent('occluder', {
  init: function () {
    const mesh = this.el.getObject3D('mesh');
    if (mesh) {
      mesh.traverse(node => {
        if (node.isMesh) {
          node.material.colorWrite = false;
          node.material.depthWrite = true;
        }
      });
    } else {
      this.el.addEventListener('model-loaded', () => this.init());
    }
  }
});

// Rounded rectangle helper
function createRoundedRect(width, height, radius) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return new THREE.ShapeGeometry(shape);
}

// Orientation helpers
function getOrientation() {
  return (window.innerWidth > window.innerHeight) ? 'landscape' : 'portrait';
}
function adjustForOrientation(x, y) {
  if (getOrientation() === 'landscape') {
    // Adjust offsets for landscape
    return { x: x * 1.2, y: y * 0.6 }; 
  }
  return { x, y };
}

document.addEventListener("DOMContentLoaded", () => {
  const scene = document.querySelector("a-scene");
  const target = scene.querySelector("[mindar-image-target]");
  if (!target) { console.warn('MindAR target not found!'); return; }

  const reviewData = {
    food1: [
      { avatar: "./images/profile1.png", name: "Spongebob", stars: 5, comment: "The best Krabby Patty I’ve ever made!" },
      { avatar: "./images/profile2.png", name: "Patrick", stars: 4, comment: "Tastes like happiness… and maybe jellyfish jelly." },
      { avatar: "./images/profile3.png", name: "Squidward", stars: 2, comment: "Too cheerful for my taste." }
    ],
    food2: [
      { avatar: "./images/profile3.png", name: "Squidward", stars: 3, comment: "I guess it’s edible." },
      { avatar: "./images/profile1.png", name: "Spongebob", stars: 5, comment: "Bubble Bass could never complain about this one." }
    ],
    food3: [
      { avatar: "./images/profile2.png", name: "Patrick", stars: 5, comment: "I ate it in one bite… was I supposed to chew?" },
      { avatar: "./images/profile1.png", name: "Spongebob", stars: 4, comment: "Could use more sea salt, but still great!" }
    ],
    food4: [
      { avatar: "./images/profile3.png", name: "Squidward", stars: 1, comment: "Why am I here?" },
      { avatar: "./images/profile2.png", name: "Patrick", stars: 5, comment: "Best chum I’ve ever had!" }
    ]
  };

  const items = [
    { food: "#food1", star: "#star1", starStart: [-0.3, 0.2, -0.05], starEnd: [-0.63, 0.2, -0.05] },
    { food: "#food2", star: "#star2", starStart: [-0.3, -0.03, -0.05], starEnd: [-0.63, -0.03, -0.05] },
    { food: "#food3", star: "#star3", starStart: [0.3, -0.4, -0.05], starEnd: [0.63, -0.4, -0.05] },
    { food: "#food4", star: "#star4", starStart: [0.3, -0.63, -0.05], starEnd: [0.63, -0.63, -0.05] }
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
      const adj = adjustForOrientation(starStart[0], starStart[1]);
      const f = target.querySelector(food);
      const s = target.querySelector(star);
      if (f) { f.setAttribute("visible", false); setModelOpacity(f, 0); f.removeAttribute("animation__rotate"); }
      if (s) s.setAttribute("position", `${adj.x} ${adj.y} ${starStart[2]}`);
    });
  };

  const whenLoaded = el => new Promise(res => el.hasLoaded ? res() : el.addEventListener("loaded", res, { once: true }));
  const easeInOutQuad = t => t < 0.5 ? 2*t*t : -1 + (4-2*t)*t;

  const showFoodAndStars = (foodEl, starEl, start, end) => {
    const DURATION = 2000;
    const adjStart = adjustForOrientation(start[0], start[1]);
    const adjEnd = adjustForOrientation(end[0], end[1]);

    return Promise.all([whenLoaded(foodEl), whenLoaded(starEl)]).then(() => {
      setModelOpacity(foodEl, 0); 
      foodEl.setAttribute("visible", true);
      starEl.setAttribute("position", `${adjStart.x} ${adjStart.y} ${start[2]}`);
      foodEl.setAttribute("animation__rotate", { property: "rotation", to: "0 360 0", dur: 2000, easing: "linear", loop: true });

      let startTime = null;
      const animate = t => {
        if (startTime === null) startTime = t;
        const p = Math.min((t - startTime) / DURATION, 1), e = easeInOutQuad(p);
        setModelOpacity(foodEl, e);
        const cPos = [
          adjStart.x + (adjEnd.x - adjStart.x) * e,
          adjStart.y + (adjEnd.y - adjStart.y) * e,
          start[2] + (end[2] - start[2]) * e
        ];
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

  function openReviewPanel(side, modelName) {
    closeReviewPanel();
    modelName = modelName.replace("#", ""); 
    const reviews = reviewData[modelName] || [];
    if (!reviews.length) return;

    const panel = document.createElement("a-entity");
    panel.setAttribute("id", "review-panel");

    let startX, endX;
    if (side === "left") { startX = 0; endX = -1.2; } 
    else { startX = 0; endX = 1.2; }

    panel.setAttribute("position", `${startX} 0 -0.15`);
    panel.setAttribute("look-at", "[camera]");
    panel.setAttribute("material", "color: white; opacity: 0");

    const scroll = document.createElement("a-entity");
    scroll.setAttribute("position", "0 0 0.01");
    panel.appendChild(scroll);

    reviews.forEach((r, i) => {
      const y = 0.5 - i * 0.35;
      const adj = adjustForOrientation(0, y);

      const card = document.createElement("a-entity");
      const cardGeo = createRoundedRect(0.75, 0.3, 0.04);
      const cardMat = new THREE.MeshBasicMaterial({ color: 0xf9f9f9, transparent: true, opacity: 0.7 });
      const cardMesh = new THREE.Mesh(cardGeo, cardMat);
      card.object3D.add(cardMesh);
      card.setAttribute("position", `0 ${adj.y} 0`);

      const pic = document.createElement("a-image");
      pic.setAttribute("src", r.avatar);
      pic.setAttribute("position", "-0.23 0 0.01");
      pic.setAttribute("width", "0.2");
      pic.setAttribute("height", "0.2");
      card.appendChild(pic);

      const nameText = document.createElement("a-troika-text");
      nameText.setAttribute("value", r.name);
      nameText.setAttribute("font-size", 0.06);
      nameText.setAttribute("color", "#222");
      nameText.setAttribute("anchor", "left");
      nameText.setAttribute("max-width", 0.45);
      nameText.setAttribute("position", "-0.1 0.075 0.02");
      card.appendChild(nameText);

      const starsText = "★".repeat(r.stars) + "☆".repeat(5 - r.stars);
      const starsRating = document.createElement("a-troika-text");
      starsRating.setAttribute("value", starsText);
      starsRating.setAttribute("font-size", 0.04);
      starsRating.setAttribute("color", "#222");
      starsRating.setAttribute("anchor", "left");
      starsRating.setAttribute("max-width", 0.45);
      starsRating.setAttribute("position", "-0.1 0 0.02");
      card.appendChild(starsRating);

      const commentTxt = document.createElement("a-troika-text");
      commentTxt.setAttribute("value", r.comment);
      commentTxt.setAttribute("font-size", 0.035);
      commentTxt.setAttribute("color", "#222");
      commentTxt.setAttribute("anchor", "left");
      commentTxt.setAttribute("max-width", 0.45);
      commentTxt.setAttribute("position", "-0.1 -0.065 0.02");
      card.appendChild(commentTxt);

      scroll.appendChild(card);
    });

    target.appendChild(panel);
    activePanel = panel;

    panel.setAttribute("animation__slidein", {
      property: "position",
      to: `${endX} 0 -0.15`,
      dur: 1500,
      easing: "easeOutQuad"
    });
  }

  function closeReviewPanel() {
    if (activePanel && activePanel.parentNode) {
      activePanel.parentNode.removeChild(activePanel);
      activePanel = null;
    }
  }

  function manualTouchHandler(event) {
    const rect = scene.canvas.getBoundingClientRect();
    const touch = event.touches ? event.touches[0] : event;
    const mouse = new THREE.Vector2(
      ((touch.clientX - rect.left) / rect.width) * 2 - 1,
      -((touch.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, scene.camera);

    const clickableMeshes = [];
    items.forEach(({ food }) => {
      const el = target.querySelector(food);
      if (el) {
        const mesh = el.getObject3D('mesh');
        if (mesh) clickableMeshes.push(mesh);
      }
    });

    const intersects = raycaster.intersectObjects(clickableMeshes, true);
    if (intersects.length > 0) {
      const clickedEl = intersects[0].object.el;
      const item = items.find(i => i.food === `#${clickedEl.id}`);
      if (item) {
        const isLeft = touch.clientX < window.innerWidth / 2;
        const side = isLeft ? "left" : "right";
        openReviewPanel(side, item.food);
      }
    }
  }

  scene.addEventListener("touchstart", manualTouchHandler);
  scene.addEventListener("mousedown", manualTouchHandler);

  target.addEventListener("targetFound", playSequence);
  target.addEventListener("targetLost", resetAll);

  window.addEventListener("resize", resetAll); // re-calc when rotating
});