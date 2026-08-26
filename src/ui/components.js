let uidCounter = 0;

export function el(tag, opts = {}) {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.text != null) node.textContent = String(opts.text);
  if (opts.attrs) {
    for (const [key, value] of Object.entries(opts.attrs)) {
      if (value == null || value === false) continue;
      node.setAttribute(key, value === true ? "" : String(value));
    }
  }
  if (opts.children) {
    for (const child of opts.children) node.append(child);
  }
  if (opts.onClick) node.addEventListener("click", opts.onClick);
  return node;
}

export function button(label, opts = {}) {
  const cls = ["btn", `btn--${opts.variant || "primary"}`];
  if (opts.size) cls.push(`btn--${opts.size}`);
  if (opts.className) cls.push(opts.className);
  const node = el("button", {
    className: cls.join(" "),
    text: label,
    onClick: opts.onClick,
    attrs: { type: opts.type || "button", ...(opts.attrs || {}) },
  });
  return node;
}

export function progressBar(current, total, label) {
  const track = el("div", {
    className: "progress",
    attrs: {
      role: "progressbar",
      "aria-valuemin": "0",
      "aria-valuemax": String(Math.max(total, 1)),
      "aria-valuenow": String(current),
      "aria-label": label || `進捗 ${current} / ${total}`,
    },
  });
  const fill = el("div", { className: "progress__fill" });
  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0;
  fill.style.width = `${pct}%`;
  track.append(fill);
  return track;
}

export function showToast(message) {
  let region = document.getElementById("toast-region");
  if (!region) {
    region = el("div", {
      attrs: { id: "toast-region", "aria-live": "polite" },
      className: "toast-region",
    });
    document.body.append(region);
  }
  const toastEl = el("div", { className: "toast", text: message });
  region.append(toastEl);
  const schedule =
    typeof requestAnimationFrame === "function"
      ? (fn) => requestAnimationFrame(fn)
      : (fn) => setTimeout(fn, 0);
  schedule(() => toastEl.classList.add("toast--show"));
  setTimeout(() => {
    toastEl.classList.remove("toast--show");
    setTimeout(() => toastEl.remove(), 300);
  }, 2200);
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fall through to legacy path
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.append(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function buildChoiceWidget(question) {
  uidCounter += 1;
  const name = `qz-choice-${uidCounter}`;
  const fieldset = el("fieldset", { className: "choices" });
  fieldset.append(el("legend", { className: "sr-only", text: question.question }));

  const inputs = [];
  const listeners = [];
  let selected = -1;

  question.options.forEach((optionText, i) => {
    uidCounter += 1;
    const id = `${name}-${i}`;
    const input = el("input", {
      className: "choice__radio",
      attrs: { type: "radio", name, id, value: String(i) },
    });
    inputs.push(input);
    fieldset.append(
      el("label", {
        className: "choice",
        attrs: { for: id },
        children: [
          input,
          el("span", { className: "choice__text", text: optionText }),
        ],
      }),
    );
  });

  fieldset.addEventListener("change", (ev) => {
    const target = ev.target;
    if (target instanceof HTMLInputElement && target.type === "radio") {
      selected = Number(target.value);
      listeners.forEach((fn) => fn());
    }
  });

  return {
    root: fieldset,
    ready: () => selected >= 0,
    onChange(cb) {
      listeners.push(cb);
    },
    getPayload: () => ({ selectedIndex: selected }),
    lock() {
      inputs.forEach((input) => {
        input.disabled = true;
      });
    },
  };
}

export function buildInputWidget() {
  uidCounter += 1;
  const id = `qz-input-${uidCounter}`;
  const wrap = el("div", { className: "input-widget" });
  wrap.append(el("label", { className: "sr-only", text: "回答を入力", attrs: { for: id } }));
  const input = el("input", {
    className: "text-input",
    attrs: {
      type: "text",
      id,
      autocomplete: "off",
      spellcheck: "false",
      placeholder: "回答を入力",
      enterkeyhint: "done",
    },
  });

  const listeners = [];
  const enterListeners = [];
  input.addEventListener("input", () => listeners.forEach((fn) => fn()));
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      enterListeners.forEach((fn) => fn());
    }
  });
  wrap.append(input);

  return {
    root: wrap,
    input,
    ready: () => input.value.trim().length > 0,
    onChange(cb) {
      listeners.push(cb);
    },
    onEnter(cb) {
      enterListeners.push(cb);
    },
    getPayload: () => ({ text: input.value }),
    lock() {
      input.disabled = true;
    },
    focus() {
      input.focus();
    },
  };
}

export function buildOrderWidget(question) {
  let items = question.items.slice();
  let locked = false;
  const list = el("ol", { className: "order-list", attrs: { "aria-label": "並べ替え" } });

  function move(i, delta) {
    const j = i + delta;
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    render();
  }

  function render() {
    list.replaceChildren();
    items.forEach((item, i) => {
      const up = button("上へ", {
        variant: "ghost",
        size: "small",
        onClick: () => move(i, -1),
        attrs: { "aria-label": `${item} を上へ移動` },
      });
      const down = button("下へ", {
        variant: "ghost",
        size: "small",
        onClick: () => move(i, 1),
        attrs: { "aria-label": `${item} を下へ移動` },
      });
      if (i === 0) up.disabled = true;
      if (i === items.length - 1) down.disabled = true;
      if (locked) {
        up.disabled = true;
        down.disabled = true;
      }
      list.append(
        el("li", {
          className: "order-row",
          children: [
            el("span", { className: "order-num", text: String(i + 1), attrs: { "aria-hidden": "true" } }),
            el("span", { className: "order-item-text", text: item }),
            el("span", { className: "order-controls", children: [up, down] }),
          ],
        }),
      );
    });
  }

  render();

  return {
    root: list,
    ready: () => !locked,
    onChange() {},
    onEnter() {},
    getPayload: () => ({ order: items.slice() }),
    lock() {
      locked = true;
      render();
    },
  };
}
