let uidCounter = 0;

export function el(tag, opts = {}) {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.text != null) node.textContent = String(opts.text);
  if (opts.html != null) node.innerHTML = opts.html;
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

// ---- 新タイプ ----

export function buildMatchWidget(question) {
  const leftItems = question.pairs.map(([l]) => l);
  const rightItems = question.pairs.map(([, r]) => r);
  // 右側をシャッフル
  const shuffledRight = [...rightItems].sort(() => Math.random() - 0.5);
  // 固定順でもテストしやすいよう、素直な順も保持（実際はシャッフル）
  const selections = new Map(); // left -> right
  let locked = false;
  const listeners = [];
  const wrap = el("div", { className: "match-widget" });

  leftItems.forEach((left) => {
    uidCounter += 1;
    const selId = `qz-match-${uidCounter}`;
    const row = el("div", { className: "match-row" });
    const leftEl = el("span", { className: "match-left", text: left });
    const select = el("select", {
      className: "match-select",
      attrs: { id: selId, "aria-label": `${left} に対応するものを選択` },
    });
    select.append(el("option", { text: "選択してください", attrs: { value: "" } }));
    shuffledRight.forEach((r) => {
      select.append(el("option", { text: r, attrs: { value: r } }));
    });
    select.addEventListener("change", () => {
      if (select.value === "") selections.delete(left);
      else selections.set(left, select.value);
      listeners.forEach((fn) => fn());
    });
    row.append(leftEl, select);
    wrap.append(row);
  });

  return {
    root: wrap,
    ready: () => !locked && selections.size === leftItems.length && [...selections.values()].every((v) => v !== ""),
    onChange(cb) { listeners.push(cb); },
    onEnter() {},
    getPayload: () => ({ pairs: [...selections.entries()] }),
    lock() {
      locked = true;
      wrap.querySelectorAll("select").forEach((s) => (s.disabled = true));
    },
  };
}

export function buildGroupWidget(question) {
  // groups: [{name, items:[]}]
  const allItems = question.groups.flatMap((g) => g.items);
  const shuffled = [...allItems].sort(() => Math.random() - 0.5);
  // userGroups: Map<groupName, items[]>
  const groupNames = question.groups.map((g) => g.name);
  const assignments = new Map(); // item -> groupName
  shuffled.forEach((item) => assignments.set(item, groupNames[0]));
  let locked = false;
  const listeners = [];
  const wrap = el("div", { className: "group-widget" });
  const columns = new Map();

  function render() {
    wrap.replaceChildren();
    groupNames.forEach((gName) => {
      const col = el("div", { className: "group-column" });
      col.append(el("h4", { className: "group-column__title", text: gName }));
      const list = el("ul", { className: "group-list", attrs: { "aria-label": gName } });
      const itemsInGroup = [...assignments.entries()].filter(([, g]) => g === gName).map(([item]) => item);
      if (itemsInGroup.length === 0) {
        list.append(el("li", { className: "group-empty", text: "（なし）" }));
      } else {
        itemsInGroup.forEach((item) => {
          const li = el("li", { className: "group-item" });
          li.append(el("span", { className: "group-item__text", text: item }));
          const sel = el("select", {
            className: "group-select",
            attrs: { "aria-label": `${item} のグループを選択` },
          });
          groupNames.forEach((gn) => {
            const opt = el("option", { text: gn, attrs: { value: gn } });
            if (gn === assignments.get(item)) opt.selected = true;
            sel.append(opt);
          });
          if (locked) sel.disabled = true;
          sel.addEventListener("change", () => {
            assignments.set(item, sel.value);
            render();
            listeners.forEach((fn) => fn());
          });
          li.append(sel);
          list.append(li);
        });
      }
      col.append(list);
      wrap.append(col);
      columns.set(gName, col);
    });
  }
  render();

  return {
    root: wrap,
    ready: () => !locked,
    onChange(cb) { listeners.push(cb); },
    onEnter() {},
    getPayload: () => ({
      groups: groupNames.map((name) => ({
        name,
        items: [...assignments.entries()].filter(([, g]) => g === name).map(([item]) => item),
      })),
    }),
    lock() { locked = true; render(); },
  };
}

export function buildClozeWidget(question) {
  const slots = question.clozeAnswers ?? [];
  const wrap = el("div", { className: "cloze-widget" });
  // question を {..} で分割してテキストとinputを交互に
  const parts = [];
  let lastIdx = 0;
  const re = /\{[^}]+\}/g;
  let m;
  const inputs = [];
  // エスケープ対応の簡易分割: \{ は除外
  const rawQ = question.question;
  let idx = 0;
  let slotIdx = 0;
  // 手動パースで表示
  let displayIdx = 0;
  let buf = "";
  let i = 0;
  while (i < rawQ.length) {
    if (rawQ[i] === "\\" && i + 1 < rawQ.length && (rawQ[i + 1] === "{" || rawQ[i + 1] === "}" || rawQ[i + 1] === "|")) {
      buf += rawQ[i + 1];
      i += 2;
      continue;
    }
    if (rawQ[i] === "{") {
      // flush buf
      if (buf) {
        wrap.append(el("span", { className: "cloze-text", text: buf }));
        buf = "";
      }
      // find closing }
      let j = i + 1;
      let inner = "";
      while (j < rawQ.length && !(rawQ[j] === "}" && rawQ[j - 1] !== "\\")) {
        inner += rawQ[j];
        j++;
      }
      if (j < rawQ.length) {
        uidCounter += 1;
        const id = `qz-cloze-${uidCounter}-${slotIdx}`;
        const input = el("input", {
          className: "text-input cloze-input",
          attrs: {
            type: "text",
            id,
            autocomplete: "off",
            spellcheck: "false",
            placeholder: `空欄${slotIdx + 1}`,
            "aria-label": `空欄${slotIdx + 1}`,
          },
        });
        inputs.push(input);
        wrap.append(input);
        slotIdx++;
        i = j + 1;
        continue;
      }
    }
    buf += rawQ[i];
    i++;
  }
  if (buf) wrap.append(el("span", { className: "cloze-text", text: buf }));

  const listeners = [];
  const enterListeners = [];
  inputs.forEach((input, idx) => {
    input.addEventListener("input", () => listeners.forEach((fn) => fn()));
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        if (idx < inputs.length - 1) inputs[idx + 1].focus();
        else enterListeners.forEach((fn) => fn());
      }
    });
  });

  return {
    root: wrap,
    ready: () => inputs.every((inp) => inp.value.trim().length > 0),
    onChange(cb) { listeners.push(cb); },
    onEnter(cb) { enterListeners.push(cb); },
    getPayload: () => ({ texts: inputs.map((inp) => inp.value) }),
    lock() { inputs.forEach((inp) => (inp.disabled = true)); },
    focus() { inputs[0]?.focus(); },
  };
}

export function buildNumericWidget(question) {
  uidCounter += 1;
  const id = `qz-numeric-${uidCounter}`;
  const wrap = el("div", { className: "numeric-widget" });
  wrap.append(el("label", { className: "sr-only", text: "数値を入力", attrs: { for: id } }));
  const hint = question.unit ? `単位: ${question.unit}${question.requireUnit ? "（必須）" : "（省略可）"}` : "";
  if (hint) wrap.append(el("p", { className: "numeric-hint", text: hint }));
  const input = el("input", {
    className: "text-input",
    attrs: {
      type: "text",
      id,
      autocomplete: "off",
      spellcheck: "false",
      placeholder: question.unit ? `数値を入力${question.requireUnit ? `（${question.unit}）` : ""}` : "数値を入力",
      inputmode: "decimal",
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
    ready: () => input.value.trim().length > 0,
    onChange(cb) { listeners.push(cb); },
    onEnter(cb) { enterListeners.push(cb); },
    getPayload: () => ({ text: input.value }),
    lock() { input.disabled = true; },
    focus() { input.focus(); },
  };
}

export function buildHotspotWidget(question) {
  const wrap = el("div", { className: "hotspot-widget" });
  const imgWrap = el("div", { className: "hotspot-image-wrap" });
  const img = el("img", {
    className: "hotspot-image",
    attrs: { src: question.image, alt: question.question, loading: "lazy" },
  });
  imgWrap.append(img);
  // エリアボタンを画像上に重ねる（%座標）
  const areas = question.areas ?? [];
  let selected = "";
  let locked = false;
  const listeners = [];
  const buttons = [];

  areas.forEach((area) => {
    const [x1, y1, x2, y2] = area.coords;
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);
    const btn = el("button", {
      className: "hotspot-area",
      text: area.name,
      attrs: {
        type: "button",
        "aria-label": area.name,
        "data-area": area.name,
      },
    });
    btn.style.left = `${left}%`;
    btn.style.top = `${top}%`;
    btn.style.width = `${w}%`;
    btn.style.height = `${h}%`;
    btn.addEventListener("click", () => {
      if (locked) return;
      selected = area.name;
      buttons.forEach((b) => b.classList.remove("hotspot-area--selected"));
      btn.classList.add("hotspot-area--selected");
      listeners.forEach((fn) => fn());
    });
    buttons.push(btn);
    imgWrap.append(btn);
  });

  // フォールバック: 画像が読めない場合でも選択できるリスト
  const list = el("div", { className: "hotspot-list", attrs: { role: "group", "aria-label": "エリアを選択" } });
  areas.forEach((area) => {
    const b = button(area.name, {
      variant: "ghost",
      size: "small",
      onClick: () => {
        if (locked) return;
        selected = area.name;
        buttons.forEach((btn) => btn.classList.toggle("hotspot-area--selected", btn.dataset.area === selected));
        // リスト側の選択状態も同期
        list.querySelectorAll("button").forEach((lb) => lb.classList.toggle("btn--primary", lb.textContent === selected));
        listeners.forEach((fn) => fn());
      },
      attrs: { "data-area": area.name },
    });
    list.append(b);
  });

  wrap.append(imgWrap, list);
  // 画像エラー時のフォールバック表示
  img.addEventListener("error", () => {
    img.style.display = "none";
    imgWrap.append(el("p", { className: "hotspot-error", text: "画像を読み込めませんでした。下のボタンから選択してください。" }));
  });

  return {
    root: wrap,
    ready: () => selected !== "",
    onChange(cb) { listeners.push(cb); },
    onEnter() {},
    getPayload: () => ({ area: selected }),
    lock() {
      locked = true;
      buttons.forEach((b) => (b.disabled = true));
      list.querySelectorAll("button").forEach((b) => (b.disabled = true));
    },
  };
}
