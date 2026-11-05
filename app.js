const detections = [
  { position: 0.42, type: "U", name: "Uniform", severity: "Low", confidence: 96, time: "14:02:18" },
  { position: 1.08, type: "P", name: "Pitting", severity: "Medium", confidence: 94, time: "14:06:42" },
  { position: 1.76, type: "G", name: "Galvanic", severity: "High", confidence: 93, time: "14:11:07" },
  { position: 2.31, type: "U", name: "Uniform", severity: "Low", confidence: 97, time: "14:15:33" },
  { position: 3.04, type: "P", name: "Pitting", severity: "Medium", confidence: 91, time: "14:20:51" },
  { position: 3.86, type: "G", name: "Galvanic", severity: "High", confidence: 94, time: "14:25:16" },
  { position: 4.72, type: "U", name: "Uniform", severity: "Low", confidence: 95, time: "14:29:40" },
  { position: 5.41, type: "P", name: "Pitting", severity: "Medium", confidence: 93, time: "14:32:08" }
];

const scanReadings = [
  { point: 1, position: 0.00, time: "14:02:18", electrochemical: -412, temperature: 18.4, ph: 7.1 },
  { point: 2, position: 0.86, time: "14:06:42", electrochemical: -418, temperature: 18.5, ph: 7.2 },
  { point: 3, position: 1.71, time: "14:11:07", electrochemical: -506, temperature: 18.6, ph: 7.2 },
  { point: 4, position: 2.57, time: "14:15:33", electrochemical: -425, temperature: 18.6, ph: 7.3 },
  { point: 5, position: 3.43, time: "14:20:51", electrochemical: -489, temperature: 18.7, ph: 7.2 },
  { point: 6, position: 4.29, time: "14:25:16", electrochemical: -512, temperature: 18.8, ph: 7.1 },
  { point: 7, position: 5.14, time: "14:29:40", electrochemical: -431, temperature: 18.7, ph: 7.2 },
  { point: 8, position: 6.00, time: "14:32:08", electrochemical: -496, temperature: 18.6, ph: 7.2 }
];

const typeClass = { U: "type-u", P: "type-p", G: "type-g" };
const severityClass = { Low: "severity-low", Medium: "severity-medium", High: "severity-high" };
const severityColor = { Low: 0x45be7a, Medium: 0xebba40, High: 0xe75b52 };
const activeScenes = new Map();

function showApp() {
  document.getElementById("loginScreen").classList.add("is-hidden");
  document.getElementById("appShell").classList.remove("is-hidden");
  setProfileName(sessionStorage.getItem("current-demo-username") || "ECE 4");
}

function initializeLogin() {
  const form = document.getElementById("loginForm");
  const error = document.getElementById("loginError");
  if (sessionStorage.getItem("current-demo-session") === "active") showApp();

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    sessionStorage.setItem("current-demo-username", document.getElementById("loginUsername").value.trim());
    sessionStorage.setItem("current-demo-session", "active");
    error.textContent = "";
    showApp();
  });

  document.getElementById("logoutButton").addEventListener("click", () => {
    sessionStorage.removeItem("current-demo-session");
    sessionStorage.removeItem("current-demo-username");
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

function setProfileName(name) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  document.getElementById("profileDisplayName").textContent = name;
  document.getElementById("profileAvatar").textContent = initials;
  document.getElementById("topProfileButton").textContent = initials;
}

function initializeProfile() {
  const dropdown = document.getElementById("profileDropdown");
  const menuButton = document.getElementById("profileMenuButton");
  const dialog = document.getElementById("profileDialog");
  const form = document.getElementById("profileForm");
  const nameInput = document.getElementById("profileNameInput");
  const error = document.getElementById("profileError");
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
    error.textContent = "";
    nameInput.value = document.getElementById("profileDisplayName").textContent;
    dialog.showModal();
    nameInput.focus();
  });
  document.getElementById("cancelProfileEdit").addEventListener("click", () => dialog.close());
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (!name) {
      error.textContent = "Please enter a name.";
      nameInput.focus();
      return;
    }
    try {
      sessionStorage.setItem("current-demo-username", name);
      document.getElementById("loginUsername").value = name;
      setProfileName(name);
      dialog.close();
    } catch (storageError) {
      error.textContent = "Could not update your name for this session.";
      console.error("Profile name could not be updated.", storageError);
    }
  });
}

function initializeNavigation() {
  const labels = {
    "scan-data": "Scan data",
    pipeline: "Pipeline map",
    history: "Detection log",
    "robot-status": "Robot status",
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

  const pipeMaterial = new THREE.MeshStandardMaterial({ color: 0x84938b, metalness: 0.82, roughness: 0.31 });
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.77, 0.77, 7.7, 72, 1, false), pipeMaterial);
  pipe.rotation.z = Math.PI / 2;
  assembly.add(pipe);

  const innerRimMaterial = new THREE.MeshStandardMaterial({ color: 0xa5b0aa, metalness: 0.88, roughness: 0.24 });
  const ringMaterial = new THREE.MeshStandardMaterial({ color: 0x596960, metalness: 0.83, roughness: 0.29 });
  [-3.88, 3.88].forEach((x) => {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.77, 0.075, 12, 72), innerRimMaterial);
    rim.position.x = x;
    rim.rotation.y = Math.PI / 2;
    assembly.add(rim);
  });
  [-2.57, 0, 2.57].forEach((x) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.772, 0.025, 8, 72), ringMaterial);
    ring.position.x = x;
    ring.rotation.y = Math.PI / 2;
    assembly.add(ring);
  });

  const seam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 7.66, 6),
    new THREE.MeshStandardMaterial({ color: 0xc3cec6, metalness: 0.7, roughness: 0.35 })
  );
  seam.rotation.z = Math.PI / 2;
  seam.position.z = 0.765;
  assembly.add(seam);

  detections.forEach((event) => {
    const x = (event.position / 6) * 7.1 - 3.55;
    const angle = 0.52 + (event.position % 1) * 0.55;
    assembly.add(createSurfaceMarker(event.type, severityColor[event.severity], x, angle));
  });

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

function createSurfaceMarker(letter, color, x, angle) {
  const THREE = window.THREE;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  context.beginPath();
  context.arc(64, 64, 57, 0, Math.PI * 2);
  context.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
  context.fill();
  context.lineWidth = 5;
  context.strokeStyle = "#f4f7f3";
  context.stroke();
  context.fillStyle = "#17231e";
  context.font = "700 62px Arial";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(letter, 64, 66);

  const texture = new window.THREE.CanvasTexture(canvas);
  texture.encoding = window.THREE.sRGBEncoding;
  texture.anisotropy = 4;

  const radius = 0.777;
  const halfLength = 0.19;
  const halfAngle = 0.19;
  const segments = 48;
  const vertices = [x, Math.sin(angle) * radius, Math.cos(angle) * radius];
  const uvs = [0.5, 0.5];
  const indices = [];

  for (let index = 0; index < segments; index += 1) {
    const pointAngle = (index / segments) * Math.PI * 2;
    const offsetX = Math.cos(pointAngle) * halfLength;
    const offsetAngle = Math.sin(pointAngle) * halfAngle;
    const surfaceAngle = angle + offsetAngle;
    vertices.push(
      x + offsetX,
      Math.sin(surfaceAngle) * radius,
      Math.cos(surfaceAngle) * radius
    );
    uvs.push(
      0.5 + 0.5 * Math.cos(pointAngle),
      0.5 - 0.5 * Math.sin(pointAngle)
    );
  }

  for (let index = 0; index < segments; index += 1) {
    indices.push(0, index + 1, ((index + 1) % segments) + 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    side: THREE.DoubleSide,
    metalness: 0.08,
    roughness: 0.82
  });
  const patch = new THREE.Mesh(geometry, material);
  patch.renderOrder = 2;
  return patch;
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
  body.innerHTML = scanReadings.map((reading) => `
    <tr>
      <td class="position-cell">P${String(reading.point).padStart(2, "0")}</td>
      <td class="position-cell">${reading.position.toFixed(2)} m</td>
      <td class="time-cell">${reading.time}</td>
      <td class="measurement-cell">${reading.electrochemical} <span>mV</span></td>
      <td class="measurement-cell">${reading.temperature.toFixed(1)} <span>°C</span></td>
      <td class="measurement-cell">${reading.ph.toFixed(1)}</td>
    </tr>`).join("");
}

function exportCsv() {
  const headers = ["Position (m)", "Type", "Corrosion type", "Severity", "Confidence (%)", "Detected at"];
  const lines = detections.map((event) => [event.position.toFixed(2), event.type, event.name, event.severity, event.confidence, event.time]);
  const csv = [headers, ...lines].map((row) => row.map((field) => `"${String(field).replaceAll('"', '""')}"`).join(",")).join("\r\n");
  downloadFile("pipeline-inspection-IN-2408.csv", csv, "text/csv;charset=utf-8");
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
  const openReports = () => document.querySelector('[data-view="reports"]').click();
  document.getElementById("generateReport").addEventListener("click", () => {
    openReports();
    document.getElementById("view-reports").scrollIntoView({ behavior: "smooth" });
  });
  document.getElementById("printReport").addEventListener("click", () => window.print());
  document.getElementById("downloadReport").addEventListener("click", () => {
    const summary = [
      "ECE 4 — PIPELINE INSPECTION SUMMARY",
      "Pipeline inspection | Inspection #IN-2408",
      "October 26, 2026 | Rover R-07 | 12 in ductile iron",
      "",
      "Illustrative demo report; verify against live field data.",
      "Inspected: 6.0 m",
      "Corrosion detections: 8",
      "Uniform (U): 3 low severity",
      "Pitting (P): 3 medium severity",
      "Galvanic (G): 2 high severity",
      "Average classifier confidence: 94%",
      "",
      "POSITION (m),TYPE,SEVERITY,CONFIDENCE (%),DETECTED AT",
      ...detections.map((event) => `${event.position.toFixed(2)},${event.type},${event.severity},${event.confidence},${event.time}`)
    ].join("\r\n");
    downloadFile("pipeline-inspection-IN-2408.txt", summary, "text/plain;charset=utf-8");
  });
}

function initializeApp() {
  initializeLogin();
  initializeProfile();
  initializeNavigation();
  renderScanReadings();
  renderDetectionRows();
  document.getElementById("logSearch").addEventListener("input", (event) => renderDetectionRows(event.target.value));
  document.getElementById("exportCsv").addEventListener("click", exportCsv);
  initializeReports();
}

document.addEventListener("DOMContentLoaded", initializeApp);
