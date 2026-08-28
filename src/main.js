import "./styles/main.css";

import QzJS from "./qzjs.js";
import { SAMPLE_QUIZ } from "./sample.js";
import { formatErrors } from "./core/validator.js";
import { el, showToast } from "./ui/components.js";
import { getThreeJSMode } from "./ui/threejs-mode.js";

const $ = (sel) => document.querySelector(sel);

const intro = $("#intro");
const stage = $("#stage");
const quizRoot = $("#quiz-root");
const form = $("#quiz-form");
const sourceEl = $("#source");
const sampleBtn = $("#sample-btn");
const clearBtn = $("#clear-btn");
const errBox = $("#syntax-errors");
const themeBtn = $("#theme-toggle");

const SOURCE_KEY = "qzjs:lastSource";
const THEME_KEY = "qzjs:theme";
const THREEJS_MODE_KEY = "qzjs:threejs-mode";

const storage = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignore storage failures
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore storage failures
    }
  },
};

function showErrorList(errors) {
  errBox.replaceChildren(
    el("strong", {
      className: "syntax-errors__title",
      text: "構文エラーがあります。次の箇所を修正してください。",
    }),
    el("pre", { className: "error-list", text: formatErrors(errors) }),
  );
  errBox.hidden = false;
  errBox.focus();
}

function showIntro() {
  stage.hidden = true;
  intro.hidden = false;
  window.scrollTo({ top: 0 });
}

function startQuiz() {
  errBox.hidden = true;
  const app = new QzJS({
    source: sourceEl.value,
    target: quizRoot,
    onExit: showIntro,
  });
  const res = app.start();
  if (!res.ok) {
    showErrorList(res.errors);
    return;
  }
  storage.set(SOURCE_KEY, sourceEl.value);
  intro.hidden = true;
  stage.hidden = false;
  window.scrollTo({ top: 0 });
}

form.addEventListener("submit", (ev) => {
  ev.preventDefault();
  startQuiz();
});

sourceEl.addEventListener("keydown", (ev) => {
  if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") {
    ev.preventDefault();
    startQuiz();
  }
});

sourceEl.addEventListener("input", () => {
  storage.set(SOURCE_KEY, sourceEl.value);
});

sampleBtn.addEventListener("click", () => {
  sourceEl.value = SAMPLE_QUIZ;
  storage.set(SOURCE_KEY, sourceEl.value);
  errBox.hidden = true;
  sourceEl.focus();
  showToast("サンプルを読み込みました");
});

clearBtn.addEventListener("click", () => {
  sourceEl.value = "";
  storage.remove(SOURCE_KEY);
  errBox.hidden = true;
  sourceEl.focus();
});

function updateThemeButton() {
  const dark = document.documentElement.dataset.theme === "dark";
  themeBtn.textContent = dark ? "ライトモードにする" : "ダークモードにする";
}

themeBtn.addEventListener("click", () => {
  const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  storage.set(THEME_KEY, next);
  updateThemeButton();
});

// Three.js Mode Toggle Button
const threeJSMode = getThreeJSMode();

function createThreeJSToggleButton() {
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'threejs-mode-toggle';
  toggleBtn.type = 'button';
  toggleBtn.className = 'btn btn--ghost btn--small threejs-toggle-btn';
  toggleBtn.setAttribute('aria-label', '3D UI モードを切り替え');
  
  const icon = document.createElement('span');
  icon.className = 'threejs-icon';
  icon.textContent = '✨';
  
  const label = document.createElement('span');
  label.className = 'threejs-label';
  label.textContent = threeJSMode.enabled ? '3D UI ON' : '3D UI OFF';
  
  toggleBtn.append(icon, label);
  
  toggleBtn.addEventListener('click', () => {
    const isEnabled = threeJSMode.toggle();
    label.textContent = isEnabled ? '3D UI ON' : '3D UI OFF';
    showToast(isEnabled ? '3D UI モードを ON にしました' : '3D UI モードを OFF にしました');
  });
  
  return toggleBtn;
}

const savedSource = storage.get(SOURCE_KEY);
if (savedSource) sourceEl.value = savedSource;
updateThemeButton();

// Add Three.js toggle button to header
const headerInner = $('.site-header__inner');
const threeJSToggleBtn = createThreeJSToggleButton();
headerInner.appendChild(threeJSToggleBtn);
