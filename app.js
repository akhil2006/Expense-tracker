/* =====================================================
   AI-Assisted Expense Tracker
   React (functional components + hooks) + localStorage + Chart.js
   Built in layers:
     1. Data model     2. UI shell      3. State
     4. Persistence    5. Analytics
   ===================================================== */
(function () {
  "use strict";

  const { useState, useEffect, useRef, useMemo } = React;
  const html = htm.bind(React.createElement);

  /* ---------------------------------------------------
     LAYER 1 · DATA MODEL
     expense  = { id, amount, category (category id), date (YYYY-MM-DD), note }
     category = { id, name, color }
     --------------------------------------------------- */
  const SEED_CATEGORIES = [
    { id: "cat-food", name: "Food", color: "#c9dcfb" },
    { id: "cat-transport", name: "Transport", color: "#8fb1f0" },
    { id: "cat-bills", name: "Bills", color: "#3a56b0" },
    { id: "cat-shopping", name: "Shopping", color: "#2b4290" },
    { id: "cat-entertainment", name: "Entertainment", color: "#5b7fd1" },
    { id: "cat-other", name: "Other", color: "#1f2763" }
  ];

  const pad = (n) => String(n).padStart(2, "0");
  const isoDate = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const todayISO = () => isoDate(new Date());
  const monthKey = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1);
  const shiftMonth = (key, n) => {
    const [y, m] = key.split("-").map(Number);
    return monthKey(new Date(y, m - 1 + n, 1));
  };
  const monthShort = (key) => {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
  };
  const monthLong = (key) => {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  };
  const fmtDate = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };
  const fmtMoney = (n) => {
    const whole = Math.abs(n - Math.round(n)) < 0.005;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: 2
    }).format(n);
  };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  /* readable text colour for any tag background */
  function readableOn(hex) {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.62 ? "#1f2763" : "#ffffff";
  }

  /* ---------------------------------------------------
     LAYER 4 · PERSISTENCE  (useLocalStorage hook)
     JSON in localStorage, loaded on mount, writes debounced
     --------------------------------------------------- */
  function useLocalStorage(key, initial) {
    const [value, setValue] = useState(() => {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) return initial;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : initial;
      } catch (e) {
        return initial;
      }
    });

    const latest = useRef(value);
    latest.current = value;

    const save = () => {
      try {
        localStorage.setItem(key, JSON.stringify(latest.current));
      } catch (e) {
        /* storage full or blocked: ignore */
      }
    };

    // debounced write (300 ms after the last change)
    useEffect(() => {
      const t = setTimeout(save, 300);
      return () => clearTimeout(t);
    }, [value]);

    // flush immediately if the page is closed or hidden
    useEffect(() => {
      window.addEventListener("beforeunload", save);
      window.addEventListener("pagehide", save);
      return () => {
        window.removeEventListener("beforeunload", save);
        window.removeEventListener("pagehide", save);
      };
    }, []);

    return [value, setValue];
  }

  /* ---------------------------------------------------
     CSV EXPORT
     --------------------------------------------------- */
  function csvCell(v) {
    let s = String(v == null ? "" : v);
    if (/^[=+\-@]/.test(s)) s = "'" + s; // prevent spreadsheet formula injection
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function exportCSV(expenses, categories) {
    const name = (id) => {
      const c = categories.find((x) => x.id === id);
      return c ? c.name : "Unknown";
    };
    const rows = [...expenses].sort((a, b) => a.date.localeCompare(b.date));
    const lines = ["Date,Category,Amount (INR),Note"].concat(
      rows.map((e) => [csvCell(e.date), csvCell(name(e.category)), e.amount, csvCell(e.note)].join(","))
    );
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "expenses-" + todayISO() + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ---------------------------------------------------
     SAMPLE DATA (for demos and screenshots)
     --------------------------------------------------- */
  function buildSample(categories) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const today = now.getDate();
    const rows = [
      [0, 1, "cat-bills", 1800, "Electricity and internet"],
      [0, 2, "cat-food", 450, "Groceries"],
      [0, 3, "cat-transport", 120, "Metro card recharge"],
      [1, 2, "cat-bills", 1750, "Electricity and internet"],
      [1, 9, "cat-food", 620, "Dinner with friends"],
      [1, 14, "cat-transport", 300, "Cab rides"],
      [1, 20, "cat-shopping", 1500, "Headphones"],
      [2, 4, "cat-bills", 1700, "Electricity and internet"],
      [2, 11, "cat-food", 540, "Groceries"],
      [2, 18, "cat-entertainment", 400, "Movie night"],
      [3, 5, "cat-bills", 1650, "Electricity and internet"],
      [3, 12, "cat-food", 380, "Canteen"],
      [3, 22, "cat-shopping", 900, "T-shirts"],
      [4, 6, "cat-bills", 1700, "Electricity and internet"],
      [4, 15, "cat-transport", 250, "Bus pass"],
      [5, 8, "cat-food", 700, "Groceries"],
      [5, 17, "cat-entertainment", 350, "Cricket match tickets"]
    ];
    const ids = categories.map((c) => c.id);
    return rows
      .filter((r) => ids.includes(r[2]))
      .map(([off, day, cat, amt, note]) => {
        const d = off === 0 ? Math.min(day, today) : day;
        return { id: uid(), amount: amt, category: cat, date: isoDate(new Date(y, m - off, d)), note };
      });
  }

  /* ---------------------------------------------------
     LAYER 2 · UI SHELL (small reusable components)
     --------------------------------------------------- */
  function Modal({ title, onClose, children }) {
    useEffect(() => {
      const onKey = (e) => {
        if (e.key === "Escape") onClose();
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }, []);
    return html`
      <div className="overlay" onMouseDown=${(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="modal" role="dialog" aria-modal="true" aria-label=${title}>
          <button className="x" onClick=${onClose} aria-label="Close">×</button>
          <h2>${title}</h2>
          ${children}
        </div>
      </div>
    `;
  }

  function CategoryTag({ category }) {
    const c = category || { name: "Unknown", color: "#9aa3c7" };
    return html`<span className="tag" style=${{ background: c.color, color: readableOn(c.color) }}>${c.name}</span>`;
  }

  function EmptyState({ onAdd, onSample }) {
    return html`
      <div className="empty">
        <div className="empty-icon">🧾</div>
        <h3>No expenses yet</h3>
        <p>Add your first expense to start tracking where your money goes.</p>
        <div className="row center">
          <button className="btn" onClick=${onAdd}>+ Add Expense</button>
          <button className="btn btn-ghost" onClick=${onSample}>Load sample data</button>
        </div>
      </div>
    `;
  }

  /* ---------------------------------------------------
     EXPENSE ENTRY FORM  (with validation)
     amount > 0 · category required · note <= 120 chars · date defaults to today
     --------------------------------------------------- */
  function ExpenseForm({ categories, onSave, onClose }) {
    const [amount, setAmount] = useState("");
    const [category, setCategory] = useState("");
    const [date, setDate] = useState(todayISO());
    const [note, setNote] = useState("");
    const [errors, setErrors] = useState({});

    function submit(e) {
      e.preventDefault();
      const err = {};
      const amt = parseFloat(amount);
      if (!(amt > 0)) err.amount = "Enter an amount greater than 0";
      if (!category) err.category = "Please choose a category";
      if (!date) err.date = "Pick a date";
      if (note.length > 120) err.note = "Note must be 120 characters or fewer";
      setErrors(err);
      if (Object.keys(err).length) return;
      onSave({
        id: uid(),
        amount: Math.round(amt * 100) / 100,
        category,
        date,
        note: note.trim()
      });
      onClose();
    }

    return html`
      <${Modal} title="Add Expense" onClose=${onClose}>
        <form onSubmit=${submit} noValidate>
          <label>Amount (₹)
            <input type="number" inputMode="decimal" min="0" step="0.01" placeholder="e.g. 450"
              value=${amount} onInput=${(e) => setAmount(e.target.value)} autoFocus />
            ${errors.amount && html`<span className="err">${errors.amount}</span>`}
          </label>

          <label>Category
            <select value=${category} onChange=${(e) => setCategory(e.target.value)}>
              <option value="">Select a category</option>
              ${categories.map((c) => html`<option key=${c.id} value=${c.id}>${c.name}</option>`)}
            </select>
            ${errors.category && html`<span className="err">${errors.category}</span>`}
          </label>

          <label>Date
            <input type="date" value=${date} onChange=${(e) => setDate(e.target.value)} />
            ${errors.date && html`<span className="err">${errors.date}</span>`}
          </label>

          <label>Note (optional)
            <textarea rows="2" placeholder="What was this for?" value=${note}
              onInput=${(e) => setNote(e.target.value)}></textarea>
            <span className=${"count" + (note.length > 120 ? " over" : "")}>${note.length}/120</span>
            ${errors.note && html`<span className="err">${errors.note}</span>`}
          </label>

          <div className="row end">
            <button type="button" className="btn btn-ghost" onClick=${onClose}>Cancel</button>
            <button type="submit" className="btn">Save expense</button>
          </div>
        </form>
      <//>
    `;
  }

  /* ---------------------------------------------------
     EXPENSE LIST  (sorted by date, newest first)
     --------------------------------------------------- */
  function ExpenseList({ expenses, categories, onDelete, onAdd, onSample, onExport }) {
    const sorted = useMemo(() => [...expenses].sort((a, b) => b.date.localeCompare(a.date)), [expenses]);
    const total = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);
    const byId = (id) => categories.find((c) => c.id === id);

    if (expenses.length === 0) return html`<${EmptyState} onAdd=${onAdd} onSample=${onSample} />`;

    function confirmDelete(e) {
      if (window.confirm("Delete this expense?\n" + fmtMoney(e.amount) + " · " + fmtDate(e.date))) onDelete(e.id);
    }

    return html`
      <section className="card">
        <div className="toolbar">
          <div>
            <strong>${expenses.length}</strong> expense${expenses.length === 1 ? "" : "s"} ·
            Total <strong>${fmtMoney(total)}</strong>
          </div>
          <button className="btn btn-ghost btn-sm" onClick=${onExport}>⬇ Export CSV</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Date</th><th>Category</th><th>Note</th><th className="num">Amount</th><th></th></tr>
            </thead>
            <tbody>
              ${sorted.map((e) => html`
                <tr key=${e.id}>
                  <td className="nowrap">${fmtDate(e.date)}</td>
                  <td><${CategoryTag} category=${byId(e.category)} /></td>
                  <td className="note">${e.note || "—"}</td>
                  <td className="num">${fmtMoney(e.amount)}</td>
                  <td className="num">
                    <button className="icon-btn danger" onClick=${() => confirmDelete(e)}
                      aria-label="Delete expense" title="Delete">🗑</button>
                  </td>
                </tr>
              `)}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  /* ---------------------------------------------------
     CATEGORY MANAGEMENT  (add / edit / delete)
     --------------------------------------------------- */
  function CategoryForm({ initial, categories, onSave, onClose }) {
    const editing = !!initial.id;
    const [name, setName] = useState(initial.name || "");
    const [color, setColor] = useState(initial.color || "#5b7fd1");
    const [error, setError] = useState("");

    function submit(e) {
      e.preventDefault();
      const n = name.trim();
      if (!n) return setError("Category name is required");
      if (n.length > 24) return setError("Keep the name under 24 characters");
      const clash = categories.some((c) => c.id !== initial.id && c.name.toLowerCase() === n.toLowerCase());
      if (clash) return setError("A category with this name already exists");
      onSave({ id: initial.id || "cat-" + uid(), name: n, color });
      onClose();
    }

    return html`
      <${Modal} title=${editing ? "Edit Category" : "Add Category"} onClose=${onClose}>
        <form onSubmit=${submit} noValidate>
          <label>Name
            <input type="text" value=${name} placeholder="e.g. Health"
              onInput=${(e) => setName(e.target.value)} autoFocus />
          </label>
          <label>Colour
            <input type="color" className="color-input" value=${color}
              onInput=${(e) => setColor(e.target.value)} />
          </label>
          <div className="preview">Preview: <${CategoryTag} category=${{ name: name.trim() || "Category", color }} /></div>
          ${error && html`<span className="err">${error}</span>`}
          <div className="row end">
            <button type="button" className="btn btn-ghost" onClick=${onClose}>Cancel</button>
            <button type="submit" className="btn">${editing ? "Save changes" : "Add category"}</button>
          </div>
        </form>
      <//>
    `;
  }

  function ReassignModal({ category, count, others, onConfirm, onClose }) {
    const [target, setTarget] = useState(others[0].id);
    return html`
      <${Modal} title="Delete category" onClose=${onClose}>
        <p className="muted-text">
          <strong>${category.name}</strong> is used by <strong>${count}</strong>
          expense${count === 1 ? "" : "s"}. Choose a category to move them to before deleting.
        </p>
        <label>Reassign to
          <select value=${target} onChange=${(e) => setTarget(e.target.value)}>
            ${others.map((c) => html`<option key=${c.id} value=${c.id}>${c.name}</option>`)}
          </select>
        </label>
        <div className="row end">
          <button className="btn btn-ghost" onClick=${onClose}>Cancel</button>
          <button className="btn btn-danger" onClick=${() => onConfirm(target)}>Reassign and delete</button>
        </div>
      <//>
    `;
  }

  function CategoryManager({ categories, expenses, onUpsert, onRemove }) {
    const [editing, setEditing] = useState(null); // null | {} (new) | category
    const [deleting, setDeleting] = useState(null);

    const counts = useMemo(() => {
      const m = {};
      expenses.forEach((e) => { m[e.category] = (m[e.category] || 0) + 1; });
      return m;
    }, [expenses]);

    function askDelete(c) {
      if (categories.length <= 1) {
        window.alert("You need at least one category.");
        return;
      }
      if (!counts[c.id]) {
        if (window.confirm('Delete category "' + c.name + '"?')) onRemove(c.id, null);
      } else {
        setDeleting(c);
      }
    }

    return html`
      <section className="card">
        <div className="toolbar">
          <div><strong>${categories.length}</strong> categories</div>
          <button className="btn btn-sm" onClick=${() => setEditing({})}>+ Add category</button>
        </div>
        <ul className="cat-list">
          ${categories.map((c) => html`
            <li key=${c.id}>
              <${CategoryTag} category=${c} />
              <span className="muted-text">${counts[c.id] || 0} expense${(counts[c.id] || 0) === 1 ? "" : "s"}</span>
              <span className="spacer"></span>
              <button className="icon-btn" onClick=${() => setEditing(c)} aria-label=${"Edit " + c.name} title="Edit">✏️</button>
              <button className="icon-btn danger" onClick=${() => askDelete(c)} aria-label=${"Delete " + c.name} title="Delete">🗑</button>
            </li>
          `)}
        </ul>
      </section>

      ${editing && html`<${CategoryForm} initial=${editing} categories=${categories}
        onSave=${onUpsert} onClose=${() => setEditing(null)} />`}

      ${deleting && html`<${ReassignModal} category=${deleting} count=${counts[deleting.id] || 0}
        others=${categories.filter((c) => c.id !== deleting.id)}
        onConfirm=${(target) => { onRemove(deleting.id, target); setDeleting(null); }}
        onClose=${() => setDeleting(null)} />`}
    `;
  }

  /* ---------------------------------------------------
     LAYER 5 · ANALYTICS  (summary, donut, trend, CSV)
     --------------------------------------------------- */
  function ChartCanvas({ type, data, options }) {
    const ref = useRef(null);
    useEffect(() => {
      const chart = new Chart(ref.current, { type, data, options });
      return () => chart.destroy();
    }, [type, JSON.stringify(data)]);
    return html`<div className="chart-box"><canvas ref=${ref}></canvas></div>`;
  }

  function Analytics({ expenses, categories, onExport }) {
    const [month, setMonth] = useState(monthKey(new Date()));

    const monthTotals = useMemo(() => {
      const t = {};
      expenses.forEach((e) => {
        const k = e.date.slice(0, 7);
        t[k] = (t[k] || 0) + e.amount;
      });
      return t;
    }, [expenses]);

    const thisTotal = monthTotals[month] || 0;
    const prevTotal = monthTotals[shiftMonth(month, -1)] || 0;
    const change = prevTotal > 0 ? ((thisTotal - prevTotal) / prevTotal) * 100 : null;

    const breakdown = useMemo(() => {
      return categories
        .map((c) => ({
          c,
          sum: expenses.filter((e) => e.category === c.id && e.date.slice(0, 7) === month)
            .reduce((s, e) => s + e.amount, 0)
        }))
        .filter((x) => x.sum > 0);
    }, [expenses, categories, month]);

    const trendKeys = [-5, -4, -3, -2, -1, 0].map((n) => shiftMonth(month, n));

    const donutData = {
      labels: breakdown.map((x) => x.c.name),
      datasets: [{
        data: breakdown.map((x) => x.sum),
        backgroundColor: breakdown.map((x) => x.c.color),
        borderColor: "#ffffff",
        borderWidth: 2
      }]
    };
    const donutOptions = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "58%",
      plugins: {
        legend: { position: "bottom" },
        tooltip: { callbacks: { label: (ctx) => " " + ctx.label + ": " + fmtMoney(ctx.parsed) } }
      }
    };

    const trendData = {
      labels: trendKeys.map(monthShort),
      datasets: [{
        label: "Total spend",
        data: trendKeys.map((k) => monthTotals[k] || 0),
        backgroundColor: trendKeys.map((k) => (k === month ? "#1f2763" : "#8fb1f0")),
        borderRadius: 8
      }]
    };
    const trendOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => " " + fmtMoney(ctx.parsed.y) } }
      },
      scales: {
        y: { beginAtZero: true, ticks: { callback: (v) => "₹" + v } },
        x: { grid: { display: false } }
      }
    };

    return html`
      <div className="stack">
        <section className="card">
          <div className="toolbar">
            <label className="inline">Month
              <input type="month" value=${month}
                onChange=${(e) => setMonth(e.target.value || monthKey(new Date()))} />
            </label>
            <button className="btn btn-ghost btn-sm" onClick=${onExport}>⬇ Export CSV</button>
          </div>
          <div className="summary">
            <div className="summary-label">Total spend · ${monthLong(month)}</div>
            <div className="summary-value">${fmtMoney(thisTotal)}</div>
            <div className="summary-change">
              ${change === null
                ? html`<span className="muted-text">${prevTotal === 0 && thisTotal === 0 ? "No expenses recorded" : "No data for the previous month to compare"}</span>`
                : html`<span className=${change > 0 ? "up" : change < 0 ? "down" : "flat"}>
                    ${change > 0 ? "▲" : change < 0 ? "▼" : "•"} ${Math.abs(change).toFixed(1)}%
                  </span> <span className="muted-text">vs ${monthLong(shiftMonth(month, -1))} (${fmtMoney(prevTotal)})</span>`}
            </div>
          </div>
        </section>

        <div className="grid2">
          <section className="card">
            <h3>Spend by category</h3>
            ${breakdown.length === 0
              ? html`<p className="muted-text pad">No expenses in this month.</p>`
              : html`<${ChartCanvas} type="doughnut" data=${donutData} options=${donutOptions} />`}
          </section>
          <section className="card">
            <h3>Last 6 months</h3>
            <${ChartCanvas} type="bar" data=${trendData} options=${trendOptions} />
          </section>
        </div>
      </div>
    `;
  }

  /* ---------------------------------------------------
     LAYER 3 · STATE  (App: useState + persisted hooks)
     --------------------------------------------------- */
  function App() {
    const [expenses, setExpenses] = useLocalStorage("et.expenses", []);
    const [categories, setCategories] = useLocalStorage("et.categories", SEED_CATEGORIES);
    const [tab, setTab] = useState("expenses");
    const [showForm, setShowForm] = useState(false);

    const addExpense = (e) => setExpenses((prev) => [e, ...prev]);
    const deleteExpense = (id) => setExpenses((prev) => prev.filter((x) => x.id !== id));

    const upsertCategory = (cat) =>
      setCategories((prev) =>
        prev.some((c) => c.id === cat.id) ? prev.map((c) => (c.id === cat.id ? cat : c)) : [...prev, cat]
      );
    const removeCategory = (id, reassignTo) => {
      if (reassignTo) {
        setExpenses((prev) => prev.map((e) => (e.category === id ? { ...e, category: reassignTo } : e)));
      }
      setCategories((prev) => prev.filter((c) => c.id !== id));
    };

    const loadSample = () => setExpenses((prev) => buildSample(categories).concat(prev));
    const doExport = () => exportCSV(expenses, categories);

    const tabs = [
      ["expenses", "Expenses"],
      ["analytics", "Analytics"],
      ["categories", "Categories"]
    ];

    return html`
      <div className="app">
        <header className="topbar">
          <div className="brand">💸 Expense Tracker</div>
          <button className="btn" onClick=${() => setShowForm(true)}>+ Add Expense</button>
        </header>

        <nav className="tabs" aria-label="Sections">
          ${tabs.map(([id, label]) => html`
            <button key=${id} className=${"tab" + (tab === id ? " active" : "")} onClick=${() => setTab(id)}>${label}</button>
          `)}
        </nav>

        <main className="content">
          ${tab === "expenses" && html`<${ExpenseList} expenses=${expenses} categories=${categories}
            onDelete=${deleteExpense} onAdd=${() => setShowForm(true)} onSample=${loadSample} onExport=${doExport} />`}
          ${tab === "analytics" && html`<${Analytics} expenses=${expenses} categories=${categories} onExport=${doExport} />`}
          ${tab === "categories" && html`<${CategoryManager} categories=${categories} expenses=${expenses}
            onUpsert=${upsertCategory} onRemove=${removeCategory} />`}
        </main>

        <footer className="foot">Your data is stored only in this browser (localStorage).</footer>

        ${showForm && html`<${ExpenseForm} categories=${categories} onSave=${addExpense} onClose=${() => setShowForm(false)} />`}
      </div>
    `;
  }

  ReactDOM.createRoot(document.getElementById("root")).render(html`<${App} />`);
})();
