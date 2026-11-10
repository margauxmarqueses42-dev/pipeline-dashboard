const detections = [
  { position: 0.14, angle: 0.7, type: "U", name: "Uniform", severity: "Low", confidence: 96, time: "14:02:18" },
  { position: 0.37, angle: 0.9, type: "P", name: "Pitting", severity: "Medium", confidence: 94, time: "14:06:42" },
  { position: 0.60, angle: 0.55, type: "G", name: "Galvanic", severity: "High", confidence: 93, time: "14:11:07" },
  { position: 0.78, angle: 1.05, type: "U", name: "Uniform", severity: "Low", confidence: 97, time: "14:15:33" },
  { position: 1.03, angle: 0.62, type: "P", name: "Pitting", severity: "Medium", confidence: 91, time: "14:20:51" },
  { position: 1.31, angle: 0.98, type: "G", name: "Galvanic", severity: "High", confidence: 94, time: "14:25:16" },
  { position: 1.60, angle: 0.78, type: "U", name: "Uniform", severity: "Low", confidence: 95, time: "14:29:40" },
  { position: 1.83, angle: 1.12, type: "P", name: "Pitting", severity: "Medium", confidence: 93, time: "14:32:08" }
];

const PIPELINE_LENGTH_METERS = 2.032;
const PIPE_INNER_DIAMETER_METERS = 0.2032;
const PIPE_WALL_THICKNESS_METERS = 0.00635;
const PIPE_RENDER_SCALE = 3.8;
let scanReadings = [
  { point: 1, position: 0.000, time: "14:02:18", electrochemical: -412, temperature: 18.4, ph: 7.1, image_file: "images/cp001.jpg" },
  { point: 2, position: 0.290, time: "14:06:42", electrochemical: -418, temperature: 18.5, ph: 7.2, image_file: "images/cp002.jpg" },
  { point: 3, position: 0.581, time: "14:11:07", electrochemical: -506, temperature: 18.6, ph: 7.2, image_file: "images/cp003.jpg" },
  { point: 4, position: 0.869, time: "14:15:33", electrochemical: -425, temperature: 18.6, ph: 7.3, image_file: "images/cp004.jpg" },
  { point: 5, position: 1.163, time: "14:20:51", electrochemical: -489, temperature: 18.7, ph: 7.2, image_file: "images/cp005.jpg" },
  { point: 6, position: 1.454, time: "14:25:16", electrochemical: -512, temperature: 18.8, ph: 7.1, image_file: "images/cp006.jpg" },
  { point: 7, position: 1.743, time: "14:29:40", electrochemical: -431, temperature: 18.7, ph: 7.2, image_file: "images/cp007.jpg" },
  { point: 8, position: 2.032, time: "14:32:08", electrochemical: -496, temperature: 18.6, ph: 7.2, image_file: "images/cp008.jpg" }
];
const scanImageUrls = new Map();

const typeClass = { U: "type-u", P: "type-p", G: "type-g" };
const severityClass = { Low: "severity-low", Medium: "severity-medium", High: "severity-high" };
const activeScenes = new Map();

function showApp() {
  document.getElementById("loginScreen").classList.add("is-hidden");
  document.getElementById("appShell").classList.remove("is-hidden");
  setProfileName(
    sessionStorage.getItem("current-demo-display-name") ||
    sessionStorage.getItem("current-demo-username") ||
    "Pipe-bot"
  );
}

function getProfileStorageKey(field) {
  const username = (sessionStorage.getItem("current-demo-username") || "guest").toLowerCase();
  return `current-demo-profile-${field}:${encodeURIComponent(username)}`;
}

function getDemoAccounts() {
  const savedAccounts = localStorage.getItem("current-demo-accounts");
  if (!savedAccounts) return [];
  const accounts = JSON.parse(savedAccounts);
  if (!Array.isArray(accounts) || accounts.some((account) =>
    !account || typeof account.username !== "string" ||
    typeof account.salt !== "string" || typeof account.passwordHash !== "string"
  )) {
    throw new Error("Saved account data is invalid.");
  }
  return accounts;
}

function saveDemoAccount(account) {
  const accounts = getDemoAccounts();
  if (accounts.some((savedAccount) => savedAccount.username.toLowerCase() === account.username.toLowerCase())) {
    throw new Error("An account already exists for that username.");
  }
  const updatedAccounts = JSON.stringify([...accounts, account]);
  localStorage.setItem("current-demo-accounts", updatedAccounts);
  if (localStorage.getItem("current-demo-accounts") !== updatedAccounts) {
    throw new Error("The new account could not be verified in browser storage.");
  }
}

async function hashDemoPassword(password, salt) {
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error("Secure password hashing is unavailable in this browser context.");
  }
  const key = await window.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const hash = await window.crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 310000, hash: "SHA-256" },
    key,
    256
  );
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function createPasswordSalt() {
  if (!window.crypto || !window.crypto.getRandomValues) {
    throw new Error("Secure random values are unavailable in this browser.");
  }
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  return {
    bytes: salt,
    encoded: Array.from(salt, (byte) => byte.toString(16).padStart(2, "0")).join("")
  };
}

function showAuthError(element, message, error) {
  element.textContent = message;
  if (error) console.error(message, error);
}

function initializeLogin() {
  const form = document.getElementById("loginForm");
  const error = document.getElementById("loginError");
  const loginButton = form.querySelector('button[type="submit"]');
  const signupDialog = document.getElementById("signupDialog");
  const signupForm = document.getElementById("signupForm");
  const signupError = document.getElementById("signupError");
  const signupButton = document.getElementById("signupSubmitButton");
  if (sessionStorage.getItem("current-demo-session") === "active") showApp();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    error.textContent = "";
    loginButton.disabled = true;
    try {
      const username = document.getElementById("loginUsername").value.trim();
      const account = getDemoAccounts().find((savedAccount) =>
        savedAccount.username.toLowerCase() === username.toLowerCase()
      );
      if (!account) {
        error.textContent = "No account found for that username. Create an account first.";
        return;
      }
      const salt = Uint8Array.from(account.salt.match(/.{2}/g), (byte) => parseInt(byte, 16));
      const passwordHash = await hashDemoPassword(document.getElementById("loginPassword").value, salt);
      if (passwordHash !== account.passwordHash) {
        error.textContent = "The username or password is incorrect.";
        return;
      }
      sessionStorage.setItem("current-demo-username", account.username);
      const savedName = localStorage.getItem(getProfileStorageKey("name"));
      if (savedName) sessionStorage.setItem("current-demo-display-name", savedName);
      else sessionStorage.removeItem("current-demo-display-name");
      sessionStorage.setItem("current-demo-session", "active");
      showApp();
    } catch (loginError) {
      showAuthError(error, "Could not log in. Please check browser storage and try again.", loginError);
    } finally {
      loginButton.disabled = false;
    }
  });

  document.getElementById("openSignupButton").addEventListener("click", () => {
    signupError.textContent = "";
    signupForm.reset();
    signupDialog.showModal();
    document.getElementById("signupUsername").focus();
  });
  document.getElementById("cancelSignupButton").addEventListener("click", () => signupDialog.close());

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!signupForm.reportValidity()) return;
    signupError.textContent = "";
    const username = document.getElementById("signupUsername").value.trim();
    const password = document.getElementById("signupPassword").value;
    if (password !== document.getElementById("signupPasswordConfirm").value) {
      signupError.textContent = "The passwords do not match.";
      document.getElementById("signupPasswordConfirm").focus();
      return;
    }

    signupButton.disabled = true;
    try {
      const accounts = getDemoAccounts();
      if (accounts.some((account) => account.username.toLowerCase() === username.toLowerCase())) {
        signupError.textContent = "That username is already taken.";
        return;
      }
      const salt = createPasswordSalt();
      const passwordHash = await hashDemoPassword(password, salt.bytes);
      const account = { username, salt: salt.encoded, passwordHash };
      saveDemoAccount(account);
      sessionStorage.setItem("current-demo-username", username);
      const savedName = localStorage.getItem(getProfileStorageKey("name"));
      if (savedName) sessionStorage.setItem("current-demo-display-name", savedName);
      else sessionStorage.removeItem("current-demo-display-name");
      sessionStorage.setItem("current-demo-session", "active");
      signupDialog.close();
      showApp();
    } catch (signupFailure) {
      showAuthError(
        signupError,
        "Could not create your account. Check browser storage and make sure this page is in a secure browser context.",
        signupFailure
      );
    } finally {
      signupButton.disabled = false;
    }
  });

  document.getElementById("logoutButton").addEventListener("click", () => {
    sessionStorage.removeItem("current-demo-session");
    sessionStorage.removeItem("current-demo-username");
    sessionStorage.removeItem("current-demo-display-name");
    closeProfileMenu();
    document.getElementById("appShell").classList.add("is-hidden");
    document.getElementById("loginScreen").classList.remove("is-hidden");
    document.getElementById("loginUsername").value = "";
    document.getElementById("loginPassword").value = "";
  });
}

function closeProfileMenu() {
  const dropdown = document.getElementById("profileDropdown");
  dropdown.hidden = true;
  dropdown.classList.remove("is-top-menu");
  document.getElementById("profileMenuButton").setAttribute("aria-expanded", "false");
}

function getNameInitials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "ECE";
}

function renderAvatar(element, name, imageData) {
  element.replaceChildren();
  if (imageData) {
    const image = document.createElement("img");
    image.src = imageData;
    image.alt = "";
    element.appendChild(image);
  } else {
    element.textContent = getNameInitials(name);
  }
}

function setProfileName(name) {
  document.getElementById("profileDisplayName").textContent = name;
  document.getElementById("profileAvatar").setAttribute("aria-label", `${name}'s profile picture`);
  document.getElementById("topProfileButton").setAttribute("aria-label", `Open ${name}'s profile menu`);
  let imageData = "";
  try {
    imageData = localStorage.getItem(getProfileStorageKey("image")) || "";
  } catch (storageError) {
    console.error("Profile picture could not be loaded from browser storage.", storageError);
  }
  renderAvatar(document.getElementById("profileAvatar"), name, imageData);
  renderAvatar(document.getElementById("topProfileAvatar"), name, imageData);
  document.getElementById("topProfileAvatar").setAttribute("aria-hidden", "true");
}

function resizeProfileImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The selected picture could not be read."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("The selected file is not a supported image."));
      image.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 256 / Math.max(image.naturalWidth, image.naturalHeight));
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("This browser could not process the selected picture."));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.84));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function initializeProfile() {
  const dropdown = document.getElementById("profileDropdown");
  const menuButton = document.getElementById("profileMenuButton");
  const imageDialog = document.getElementById("profileImageDialog");
  const imageForm = document.getElementById("profileImageForm");
  const imageInput = document.getElementById("profileImageInput");
  const imagePreview = document.getElementById("profileImagePreview");
  const imageError = document.getElementById("profileImageError");
  const nameDialog = document.getElementById("profileNameDialog");
  const nameForm = document.getElementById("profileNameForm");
  const nameInput = document.getElementById("profileNameInput");
  const nameError = document.getElementById("profileNameError");
  let pendingProfileImage = "";
  let removeProfileImage = false;
  function toggleMenu() {
    dropdown.hidden = !dropdown.hidden;
    menuButton.setAttribute("aria-expanded", String(!dropdown.hidden));
  }

  menuButton.addEventListener("click", () => {
    dropdown.classList.remove("is-top-menu");
    toggleMenu();
  });
  document.getElementById("topProfileButton").addEventListener("click", () => {
    if (dropdown.hidden) {
      dropdown.classList.add("is-top-menu");
      toggleMenu();
    }
    else closeProfileMenu();
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".profile-container") && event.target.id !== "topProfileButton") closeProfileMenu();
  });

  document.getElementById("editProfileButton").addEventListener("click", () => {
    closeProfileMenu();
    imageError.textContent = "";
    imageInput.value = "";
    removeProfileImage = false;
    try {
      pendingProfileImage = localStorage.getItem(getProfileStorageKey("image")) || "";
    } catch (storageError) {
      pendingProfileImage = "";
      showAuthError(imageError, "Could not read the saved profile picture.", storageError);
    }
    renderAvatar(imagePreview, document.getElementById("profileDisplayName").textContent, pendingProfileImage);
    imageDialog.showModal();
  });
  imageInput.addEventListener("change", async () => {
    const file = imageInput.files[0];
    if (!file) return;
    imageError.textContent = "";
    if (!file.type.startsWith("image/")) {
      imageError.textContent = "Choose an image file.";
      imageInput.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      imageError.textContent = "Choose an image smaller than 10 MB.";
      imageInput.value = "";
      return;
    }
    try {
      pendingProfileImage = await resizeProfileImage(file);
      removeProfileImage = false;
      renderAvatar(imagePreview, document.getElementById("profileDisplayName").textContent, pendingProfileImage);
    } catch (imageFailure) {
      showAuthError(imageError, "Could not use that profile picture.", imageFailure);
    }
  });
  document.getElementById("resetProfileImage").addEventListener("click", () => {
    pendingProfileImage = "";
    removeProfileImage = true;
    imageInput.value = "";
    imageError.textContent = "";
    renderAvatar(imagePreview, document.getElementById("profileDisplayName").textContent, "");
  });
  document.getElementById("cancelProfileImage").addEventListener("click", () => imageDialog.close());
  imageForm.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      if (removeProfileImage) localStorage.removeItem(getProfileStorageKey("image"));
      else if (pendingProfileImage) localStorage.setItem(getProfileStorageKey("image"), pendingProfileImage);
      setProfileName(document.getElementById("profileDisplayName").textContent);
      imageDialog.close();
    } catch (storageError) {
      showAuthError(imageError, "Could not save your profile picture in this browser.", storageError);
    }
  });

  document.getElementById("editNameButton").addEventListener("click", () => {
    closeProfileMenu();
    nameError.textContent = "";
    nameInput.value = document.getElementById("profileDisplayName").textContent;
    nameDialog.showModal();
    nameInput.focus();
  });
  document.getElementById("cancelProfileName").addEventListener("click", () => nameDialog.close());
  nameForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (!name) {
      nameError.textContent = "Please enter a name.";
      nameInput.focus();
      return;
    }
    try {
      localStorage.setItem(getProfileStorageKey("name"), name);
      sessionStorage.setItem("current-demo-display-name", name);
      setProfileName(name);
      nameDialog.close();
    } catch (storageError) {
      showAuthError(nameError, "Could not update your name for this session.", storageError);
    }
  });
}

function initializeNavigation() {
  const labels = {
    "scan-data": "Scan data",
    pipeline: "Pipeline Visualization Map",
    history: "Detection log",
    reports: "Reports",
    classification: "ML classification"
  };

  function navigate(view) {
    document.querySelectorAll(".view-panel").forEach((panel) => panel.classList.toggle("active", panel.id === `view-${view}`));
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
    document.getElementById("breadcrumbCurrent").textContent = labels[view];
    if (view === "pipeline") initializeScene("pipeline3dLarge");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  document.querySelectorAll(".nav-item").forEach((item) => item.addEventListener("click", () => navigate(item.dataset.view)));
  document.querySelectorAll("[data-go]").forEach((item) => item.addEventListener("click", () => navigate(item.dataset.go)));
}

function initializeScene(containerId) {
  const container = document.getElementById(containerId);
  if (!container || activeScenes.has(containerId) || !window.THREE) {
    if (container && !window.THREE) showSceneFallback(container);
    return;
  }

  const THREE = window.THREE;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (error) {
    showSceneFallback(container);
    return;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 100);
  camera.position.set(0.7, 3.25, 8.8);
  camera.lookAt(0, 0, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputEncoding = THREE.sRGBEncoding;
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xb9d3c4, 1.55));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.3);
  keyLight.position.set(-2, 5, 6);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0x8be4b4, 1.5);
  rimLight.position.set(2, -2, -4);
  scene.add(rimLight);

  const assembly = new THREE.Group();
  scene.add(assembly);

  const modelLength = PIPELINE_LENGTH_METERS * PIPE_RENDER_SCALE;
  const innerRadius = PIPE_INNER_DIAMETER_METERS / 2 * PIPE_RENDER_SCALE;
  const outerRadius = innerRadius + PIPE_WALL_THICKNESS_METERS * PIPE_RENDER_SCALE;
  const outerGeometry = new THREE.CylinderGeometry(outerRadius, outerRadius, modelLength, 96, 220, true);
  const pipeMaterial = new THREE.MeshStandardMaterial({ color: 0x545454, metalness: 0.25, roughness: 0.55 });
  const pipe = new THREE.Mesh(outerGeometry, pipeMaterial);
  pipe.rotation.z = Math.PI / 2;
  assembly.add(pipe);

  const innerGeometry = new THREE.CylinderGeometry(innerRadius, innerRadius, modelLength, 96, 220, true);
  const innerMaterial = new THREE.MeshStandardMaterial({
    color: 0x545454,
    metalness: 0.25,
    roughness: 0.55,
    side: THREE.BackSide
  });
  const innerWall = new THREE.Mesh(innerGeometry, innerMaterial);
  innerWall.rotation.z = Math.PI / 2;
  assembly.add(innerWall);
  addSeverityPatches(THREE, assembly, detections, outerRadius, innerRadius, modelLength);

  const innerRimMaterial = new THREE.MeshStandardMaterial({ color: 0xa5b0aa, metalness: 0.88, roughness: 0.24, side: THREE.DoubleSide });
  [-modelLength / 2, modelLength / 2].forEach((x) => {
    const rim = new THREE.Mesh(new THREE.RingGeometry(innerRadius, outerRadius, 72), innerRimMaterial);
    rim.position.x = x;
    rim.rotation.y = Math.PI / 2;
    assembly.add(rim);
  });
  const seam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, modelLength * 0.995, 6),
    new THREE.MeshStandardMaterial({ color: 0xc3cec6, metalness: 0.7, roughness: 0.35 })
  );
  seam.rotation.z = Math.PI / 2;
  seam.position.z = outerRadius * 0.99;
  assembly.add(seam);

  const grid = new THREE.GridHelper(11, 22, 0x496052, 0x33433a);
  grid.position.y = -1.28;
  grid.material.transparent = true;
  grid.material.opacity = 0.25;
  scene.add(grid);

  const state = { renderer, scene, camera, assembly, drag: false, lastX: 0, lastY: 0, zoom: 1 };
  activeScenes.set(containerId, state);

  function resize() {
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  renderer.domElement.addEventListener("pointerdown", (event) => {
    state.drag = true;
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    renderer.domElement.setPointerCapture(event.pointerId);
  });
  renderer.domElement.addEventListener("pointermove", (event) => {
    if (!state.drag) return;
    assembly.rotation.y += (event.clientX - state.lastX) * 0.008;
    assembly.rotation.z += (event.clientY - state.lastY) * 0.005;
    state.lastX = event.clientX;
    state.lastY = event.clientY;
  });
  renderer.domElement.addEventListener("pointerup", () => { state.drag = false; });
  renderer.domElement.addEventListener("pointercancel", () => { state.drag = false; });
  renderer.domElement.addEventListener("wheel", (event) => {
    event.preventDefault();
    state.zoom = Math.max(0.72, Math.min(1.45, state.zoom - Math.sign(event.deltaY) * 0.07));
    camera.position.set(0.7 * state.zoom, 3.25 * state.zoom, 8.8 * state.zoom);
    camera.lookAt(0, 0, 0);
  }, { passive: false });

  function render() {
    if (container.isConnected) renderer.render(scene, camera);
    requestAnimationFrame(render);
  }
  render();
  const fallback = container.parentElement.querySelector(".pipeline-loading");
  if (fallback) fallback.style.display = "none";
  wireSceneControls(containerId, state);
}

function addSeverityPatches(THREE, assembly, events, outerRadius, innerRadius, modelLength) {
  const severityColors = { Low: 0x00bf63, Medium: 0xffde59, High: 0xff3131 };
  const lengthRadius = modelLength * 0.025;
  const angleRadius = 0.2;
  const segments = 48;

  events.forEach((event) => {
    const color = severityColors[event.severity];
    if (color === undefined) return;

    [outerRadius + 0.004, innerRadius - 0.004].forEach((radius) => {
      const eventLength = (event.position / PIPELINE_LENGTH_METERS - 0.5) * modelLength;
      const positions = [radius * Math.cos(event.angle), eventLength, radius * Math.sin(event.angle)];
      const indices = [];

      for (let segment = 0; segment < segments; segment += 1) {
        const angle = (segment / segments) * Math.PI * 2;
        const surfaceAngle = event.angle + Math.cos(angle) * angleRadius;
        const longitudinalPosition =
          (event.position / PIPELINE_LENGTH_METERS - 0.5) * modelLength +
          Math.sin(angle) * lengthRadius;
        positions.push(
          radius * Math.cos(surfaceAngle),
          longitudinalPosition,
          radius * Math.sin(surfaceAngle)
        );
        indices.push(0, segment + 1, (segment + 1) % segments + 1);
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();

      const patch = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
      );
      patch.rotation.z = Math.PI / 2;
      assembly.add(patch);
    });

    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not draw a label for the 3D pipeline.");
    context.font = "bold 88px Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineJoin = "round";
    context.lineWidth = 12;
    context.strokeStyle = "#252525";
    context.fillStyle = "#ffffff";
    context.strokeText(event.type, 64, 66);
    context.fillText(event.type, 64, 66);

    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    const label = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false
    }));
    label.position.set(
      (outerRadius + 0.015) * Math.cos(event.angle),
      eventLength,
      (outerRadius + 0.015) * Math.sin(event.angle)
    );
    label.scale.set(0.17, 0.17, 1);
    assembly.add(label);
  });
}

function showSceneFallback(container) {
  const fallback = container.parentElement.querySelector(".pipeline-loading");
  if (fallback) {
    fallback.textContent = "3D preview unavailable — enable WebGL and load Three.js to view this model.";
    fallback.style.display = "grid";
  }
  container.setAttribute("aria-label", "3D pipeline preview unavailable");
}

function wireSceneControls(containerId, state) {
  const bindings = [
    ["resetView", "pipeline3d"],
    ["resetViewLarge", "pipeline3dLarge"]
  ];
  bindings.forEach(([buttonId, sceneId]) => {
    const button = document.getElementById(buttonId);
    if (!button || button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      const target = activeScenes.get(sceneId);
      if (!target) return;
      target.assembly.rotation.set(0, 0, 0);
      target.zoom = 1;
      target.camera.position.set(0.7, 3.25, 8.8);
      target.camera.lookAt(0, 0, 0);
    });
  });
  if (containerId === "pipeline3d") {
    document.getElementById("zoomIn").addEventListener("click", () => adjustZoom(state, -1));
    document.getElementById("zoomOut").addEventListener("click", () => adjustZoom(state, 1));
  }
}

function adjustZoom(state, direction) {
  state.zoom = Math.max(0.72, Math.min(1.45, state.zoom + direction * 0.08));
  state.camera.position.set(0.7 * state.zoom, 3.25 * state.zoom, 8.8 * state.zoom);
  state.camera.lookAt(0, 0, 0);
}

function renderDetectionRows(filter = "") {
  const body = document.getElementById("detectionRows");
  const query = filter.trim().toLowerCase();
  const rows = detections.filter((event) =>
    `${event.position} ${event.type} ${event.name} ${event.severity} ${event.time}`.toLowerCase().includes(query)
  );
  body.innerHTML = rows.map((event) => `
    <tr>
      <td class="position-cell">${event.position.toFixed(2)} m</td>
      <td><span class="type-cell"><i class="type-indicator ${typeClass[event.type]}">${event.type}</i>${event.name}</span></td>
      <td><span class="severity-cell ${severityClass[event.severity]}"><i></i>${event.severity}</span></td>
      <td class="confidence-cell">${event.confidence}%</td>
      <td class="time-cell">${event.time}</td>
    </tr>`).join("");
  document.querySelector("#view-history .table-title .table-total").textContent = `${rows.length} event${rows.length === 1 ? "" : "s"}`;
  document.querySelector("#view-history .table-foot span:first-child").innerHTML = `Showing <strong>${rows.length}</strong> sample event${rows.length === 1 ? "" : "s"}`;
}

function renderScanReadings() {
  const body = document.getElementById("scanReadingRows");
  body.replaceChildren();
  scanReadings.forEach((reading) => {
    const row = document.createElement("tr");
    const values = [
      { className: "position-cell", text: `P${String(reading.point).padStart(2, "0")}` },
      { className: "position-cell", text: `${reading.position.toFixed(3)} m` },
      { className: "time-cell", text: reading.time || "—" },
      { className: "measurement-cell", text: `${reading.electrochemical} mV` },
      { className: "measurement-cell", text: String(reading.ph) },
      { className: "measurement-cell", text: `${Number(reading.temperature).toFixed(1)} °C` }
    ];
    values.forEach(({ className, text }) => {
      const cell = document.createElement("td");
      cell.className = className;
      cell.textContent = text;
      row.appendChild(cell);
    });

    const imageCell = document.createElement("td");
    imageCell.className = "scan-photo-cell";
    const imagePath = reading.image_file || "";
    const imageName = imagePath.split(/[\\/]/).pop().toLowerCase();
    const imageUrl = scanImageUrls.get(imagePath.toLowerCase()) || scanImageUrls.get(imageName);
    if (imageUrl) {
      const image = document.createElement("img");
      image.className = "scan-photo";
      image.src = imageUrl;
      image.alt = `Camera image for checkpoint ${reading.point}`;
      image.title = imagePath;
      imageCell.appendChild(image);
    } else {
      const missingImage = document.createElement("span");
      missingImage.className = "scan-photo-missing";
      missingImage.textContent = imagePath || "No image";
      imageCell.appendChild(missingImage);
    }
    row.appendChild(imageCell);
    body.appendChild(row);
  });
  document.getElementById("scanPointCount").textContent = `${scanReadings.length} INSPECTION POINT${scanReadings.length === 1 ? "" : "S"}`;
  document.getElementById("scanReadingCount").textContent = `Showing ${scanReadings.length} ${scanReadings.length === 1 ? "reading" : "readings"}`;
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (inQuotes && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (character === "," && !inQuotes) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (inQuotes) throw new Error("The CSV contains an unclosed quoted field.");
  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function parseScanCsv(text) {
  const rows = parseCsvRows(text);
  if (rows.length < 2) throw new Error("The CSV must include a header row and at least one checkpoint.");
  const normalizeHeader = (header) => header.replace(/^\uFEFF/, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const headers = rows[0].map(normalizeHeader);
  const findColumn = (aliases) => headers.findIndex((header) => aliases.includes(header));
  const columns = {
    point: findColumn(["point", "checkpoint", "checkpointid", "checkpointnumber", "checkpointname"]),
    position: findColumn(["position", "positionm", "positionmeters", "distance", "distancem", "distancefromstart"]),
    time: findColumn(["time", "timestamp", "recordedat", "recordedtime", "datetime"]),
    electrochemical: findColumn(["electrochemical", "electrochemicalmv", "electrochemicalreading", "electrochemicalsensor", "electrochemicalsensormv", "potential", "potentialmv"]),
    ph: findColumn(["ph", "phreading", "phsensor", "phsensorvalue"]),
    temperature: findColumn(["temperature", "temperaturec", "temperaturesensor", "temperaturesensorc", "temp", "tempc"]),
    image: findColumn(["imagefile", "image", "photo", "photofile", "checkpointimage"])
  };
  if (columns.electrochemical < 0 || columns.ph < 0 || columns.temperature < 0) {
    throw new Error("CSV headers must include electrochemical, pH, and temperature readings.");
  }

  return rows.slice(1).map((cells, rowIndex) => {
    const read = (column) => column < 0 ? "" : (cells[column] || "").trim();
    const readNumber = (column, fieldName) => {
      const value = read(column);
      if (!value) return null;
      const number = Number(value);
      if (!Number.isFinite(number)) throw new Error(`Checkpoint row ${rowIndex + 2} has an invalid ${fieldName} value.`);
      return number;
    };
    const checkpointText = read(columns.point);
    const checkpointNumber = checkpointText.match(/\d+/);
    const position = readNumber(columns.position, "position");
    const electrochemical = readNumber(columns.electrochemical, "electrochemical reading");
    const ph = readNumber(columns.ph, "pH");
    const temperature = readNumber(columns.temperature, "temperature");
    if (electrochemical === null || ph === null || temperature === null) {
      throw new Error(`Checkpoint row ${rowIndex + 2} is missing a required sensor reading.`);
    }
    return {
      point: checkpointNumber ? Number(checkpointNumber[0]) : rowIndex + 1,
      position: position === null
        ? (rows.length > 2 ? rowIndex * PIPELINE_LENGTH_METERS / (rows.length - 2) : 0)
        : position,
      time: read(columns.time),
      electrochemical,
      ph,
      temperature,
      image_file: read(columns.image)
    };
  });
}

function initializeScanImport() {
  const input = document.getElementById("scanCsvInput");
  const status = document.getElementById("scanImportStatus");
  input.addEventListener("change", async () => {
    const files = Array.from(input.files);
    const csvFile = files.find((file) => file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv");
    if (!csvFile) {
      status.textContent = "Select a CSV file. You can include its checkpoint image files in the same selection.";
      return;
    }

    const newImageUrls = new Map();
    try {
      const readings = parseScanCsv(await csvFile.text());
      const imageFiles = files.filter((file) => file !== csvFile && file.type.startsWith("image/"));
      imageFiles.forEach((file) => {
        const url = URL.createObjectURL(file);
        const path = (file.webkitRelativePath || file.name).replace(/\\/g, "/").toLowerCase();
        const basename = file.name.toLowerCase();
        newImageUrls.set(path, url);
        if (!newImageUrls.has(basename)) newImageUrls.set(basename, url);
      });

      new Set(scanImageUrls.values()).forEach((url) => URL.revokeObjectURL(url));
      scanImageUrls.clear();
      newImageUrls.forEach((url, path) => scanImageUrls.set(path, url));
      scanReadings = readings;
      renderScanReadings();
      const matchedPhotos = readings.filter((reading) => {
        const path = reading.image_file.toLowerCase();
        return scanImageUrls.has(path) || scanImageUrls.has(path.split(/[\\/]/).pop());
      }).length;
      status.textContent = `Loaded ${readings.length} checkpoint${readings.length === 1 ? "" : "s"} from ${csvFile.name}; ${matchedPhotos} photo${matchedPhotos === 1 ? "" : "s"} matched.`;
    } catch (importError) {
      new Set(newImageUrls.values()).forEach((url) => URL.revokeObjectURL(url));
      status.textContent = `Could not import CSV: ${importError.message}`;
      console.error("Scan CSV import failed.", importError);
    }
  });
}

function exportCsv() {
  const headers = ["Position (m)", "Type", "Corrosion type", "Severity", "Confidence (%)", "Detected at"];
  const lines = detections.map((event) => [event.position.toFixed(2), event.type, event.name, event.severity, event.confidence, event.time]);
  const csv = [headers, ...lines].map((row) => row.map((field) => `"${String(field).replaceAll('"', '""')}"`).join(",")).join("\r\n");
  downloadFile("pipeline-inspection-IN-2408.csv", csv, "text/csv;charset=utf-8");
}

function exportScanReadingsCsv() {
  const headers = ["checkpoint", "position_m", "timestamp", "electrochemical_sensor_mV", "ph_sensor", "temperature_sensor_C", "image_file"];
  const lines = scanReadings.map((reading) => [
    reading.point,
    reading.position.toFixed(3),
    reading.time,
    reading.electrochemical,
    reading.ph,
    reading.temperature,
    reading.image_file
  ]);
  const csv = [headers, ...lines]
    .map((row) => row.map((field) => `"${String(field ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\r\n");
  downloadFile("pipeline-scan-readings.csv", csv, "text/csv;charset=utf-8");
}

function downloadFile(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function initializeReports() {
  const dialog = document.getElementById("reportEditDialog");
  const form = document.getElementById("reportEditForm");
  const error = document.getElementById("reportEditError");
  const defaultReport = {
    title: "Pipeline Inspection",
    inspectionId: "#IN-2408",
    date: "October 26, 2026",
    rover: "Rover R-07",
    summary: "A 2.032 m sample inspection of an 8-inch inner diameter Schedule 20 pipe identified 8 corrosion events. Three uniform corrosion, three pitting, and two galvanic corrosion detections were classified, with an average model confidence of 94%."
  };
  let report = { ...defaultReport };
  try {
    const savedReport = localStorage.getItem("current-demo-report");
    if (savedReport) {
      const parsedReport = JSON.parse(savedReport);
      if (Object.keys(defaultReport).every((key) => typeof parsedReport[key] === "string")) {
        report = { ...defaultReport, ...parsedReport };
      } else {
        throw new Error("Saved report data is incomplete.");
      }
    }
  } catch (storageError) {
    error.textContent = "Could not load the saved report. The default report is shown.";
    console.error("Saved report could not be loaded.", storageError);
  }

  const renderReport = () => {
    document.getElementById("reportTitle").textContent = report.title;
    document.getElementById("reportInspectionId").textContent = report.inspectionId;
    document.getElementById("reportDate").textContent = report.date;
    document.getElementById("reportRover").textContent = report.rover;
    document.getElementById("reportSummary").textContent = report.summary;
  };
  const fillReportForm = () => {
    document.getElementById("reportTitleInput").value = report.title;
    document.getElementById("reportInspectionIdInput").value = report.inspectionId;
    document.getElementById("reportDateInput").value = report.date;
    document.getElementById("reportRoverInput").value = report.rover;
    document.getElementById("reportSummaryInput").value = report.summary;
  };
  document.getElementById("editReportButton").addEventListener("click", () => {
    error.textContent = "";
    fillReportForm();
    dialog.showModal();
  });
  document.getElementById("cancelReportEdit").addEventListener("click", () => dialog.close());
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const editedReport = {
      title: document.getElementById("reportTitleInput").value.trim(),
      inspectionId: document.getElementById("reportInspectionIdInput").value.trim(),
      date: document.getElementById("reportDateInput").value.trim(),
      rover: document.getElementById("reportRoverInput").value.trim(),
      summary: document.getElementById("reportSummaryInput").value.trim()
    };
    if (Object.values(editedReport).some((value) => !value)) {
      error.textContent = "Complete each report field before saving.";
      return;
    }
    try {
      localStorage.setItem("current-demo-report", JSON.stringify(editedReport));
      report = editedReport;
      renderReport();
      dialog.close();
    } catch (storageError) {
      error.textContent = "Could not save your report in this browser.";
      console.error("Report could not be saved.", storageError);
    }
  });
  renderReport();
  document.getElementById("printReport").addEventListener("click", () => window.print());
  document.getElementById("downloadReport").addEventListener("click", () => {
    const summary = [
      "PIPE-BOT — PIPELINE INSPECTION SUMMARY",
      `${report.title} | Inspection ${report.inspectionId}`,
      `${report.date} | ${report.rover}`,
      "",
      report.summary,
      "",
      "Pipe: 8 in inner diameter | Schedule 20 | 6.35 mm wall thickness",
      "Inspected: 2.032 m",
      "Corrosion detections: 8",
      "Uniform (U): 3 low severity",
      "Pitting (P): 3 medium severity",
      "Galvanic (G): 2 high severity",
      "Average classifier confidence: 94%",
      "",
      "POSITION (m),TYPE,SEVERITY,CONFIDENCE (%),DETECTED AT",
      ...detections.map((event) => `${event.position.toFixed(3)},${event.type},${event.severity},${event.confidence},${event.time}`)
    ].join("\r\n");
    downloadFile(`pipeline-inspection-${report.inspectionId.replace(/[^A-Za-z0-9-]/g, "")}.txt`, summary, "text/plain;charset=utf-8");
  });
}

function initializeApp() {
  initializeLogin();
  initializeProfile();
  initializeNavigation();
  renderScanReadings();
  initializeScanImport();
  renderDetectionRows();
  document.getElementById("logSearch").addEventListener("input", (event) => renderDetectionRows(event.target.value));
  document.getElementById("exportCsv").addEventListener("click", exportCsv);
  document.getElementById("exportReadingsCsv").addEventListener("click", exportScanReadingsCsv);
  initializeReports();
}

document.addEventListener("DOMContentLoaded", initializeApp);
