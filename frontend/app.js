// Lightweight JS implementation mirroring the C++ billing system.
// This frontend is standalone and stores everything in-memory.
// Provides JSON export/import to integrate with the C++ side if needed.

(function () {
  // --- Billing classes (mirror C++ logic) ---
  class BillingStrategy {
    calculateCharge(usage) {
      return 0;
    }
    getStrategyName() {
      return "base";
    }
  }

  // persistence helpers
  const STORAGE_KEY = "billing_data_v1";
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, system.exportJSON());
    } catch (e) {
      console.error("saveState error", e);
    }
  }
  function loadState() {
    try {
      const t = localStorage.getItem(STORAGE_KEY);
      if (!t) return false;
      const ok = system.importJSON(t);
      return ok;
    } catch (e) {
      console.error("loadState error", e);
      return false;
    }
  }

  class FlatRateBilling extends BillingStrategy {
    constructor(rate) {
      super();
      this.rate = rate;
    }
    calculateCharge(usage) {
      return usage * this.rate;
    }
    getStrategyName() {
      return "Flat Rate";
    }
  }

  class TieredBilling extends BillingStrategy {
    calculateCharge(usage) {
      let charge = 0;
      if (usage <= 100) charge = usage * 0.1;
      else if (usage <= 500) charge = 100 * 0.1 + (usage - 100) * 0.08;
      else charge = 100 * 0.1 + 400 * 0.08 + (usage - 500) * 0.05;
      return charge;
    }
    getStrategyName() {
      return "Tiered Pricing";
    }
  }

  class Discount {
    apply(charge) {
      return charge;
    }
    getDescription() {
      return "";
    }
  }

  class PercentageDiscount extends Discount {
    constructor(pct, reason) {
      super();
      this.pct = pct;
      this.reason = reason;
    }
    apply(charge) {
      return charge * (1 - this.pct / 100.0);
    }
    getDescription() {
      return this.reason;
    }
  }

  class Transaction {
    constructor(usage, desc) {
      this.usage = usage;
      this.desc = desc;
    }
  }

  class Customer {
    constructor(id, name, email, billingStrategy) {
      this.id = id;
      this.name = name;
      this.email = email;
      this.billingStrategy = billingStrategy;
      this.transactions = [];
      this.discounts = [];
    }
    addTransaction(usage, desc) {
      this.transactions.push(new Transaction(usage, desc));
    }
    addDiscount(d) {
      this.discounts.push(d);
    }
    getTotalUsage() {
      return this.transactions.reduce((s, t) => s + t.usage, 0);
    }
    calculateBill() {
      const totalUsage = this.getTotalUsage();
      let charge = this.billingStrategy.calculateCharge(totalUsage);
      for (const d of this.discounts) charge = d.apply(charge);
      return charge;
    }
  }

  class BillingSystem {
    constructor() {
      this.customers = [];
      this.nextId = 1001;
    }
    deleteCustomer(id) {
      const ix = this.customers.findIndex((x) => x.id === id);
      if (ix >= 0) {
        this.customers.splice(ix, 1);
        return true;
      }
      return false;
    }
    addCustomer(name, email, strategy) {
      const id = this.nextId++;
      const c = new Customer(id, name, email, strategy);
      this.customers.push(c);
      return c;
    }
    findCustomer(id) {
      return this.customers.find((x) => x.id === id) || null;
    }
    listCustomers() {
      return this.customers.slice();
    }
    exportJSON() {
      // Convert customers to plain objects with metadata
      return JSON.stringify(
        {
          nextId: this.nextId,
          customers: this.customers.map((c) => ({
            id: c.id,
            name: c.name,
            email: c.email,
            strategy: c.billingStrategy.getStrategyName(),
            rate:
              c.billingStrategy instanceof FlatRateBilling
                ? c.billingStrategy.rate
                : null,
            transactions: c.transactions.map((t) => ({
              usage: t.usage,
              desc: t.desc,
            })),
            discounts: c.discounts.map((d) => ({
              type: d instanceof PercentageDiscount ? "pct" : "unknown",
              pct: d.pct,
              desc: d.reason,
            })),
          })),
        },
        null,
        2
      );
    }
    importJSON(text) {
      try {
        const parsed = JSON.parse(text);
        // support old-format (array) and new-format ({nextId, customers})
        const arr = Array.isArray(parsed) ? parsed : parsed.customers || [];
        if (parsed && parsed.nextId) this.nextId = parsed.nextId;
        // Clear current customers before importing
        this.customers = [];
        for (const o of arr) {
          let strat = new TieredBilling();
          if (o.strategy === "Flat Rate")
            strat = new FlatRateBilling(parseFloat(o.rate) || 0.15);
          const cid = o.id || this.nextId++;
          const c = new Customer(cid, o.name, o.email, strat);
          if (Array.isArray(o.transactions))
            for (const t of o.transactions)
              c.addTransaction(parseFloat(t.usage) || 0, t.desc || "");
          if (Array.isArray(o.discounts))
            for (const d of o.discounts) {
              if (d.type === "pct")
                c.addDiscount(
                  new PercentageDiscount(parseFloat(d.pct) || 0, d.desc || "")
                );
            }
          this.customers.push(c);
        }
        return true;
      } catch (e) {
        console.error(e);
        return false;
      }
    }
  }

  // --- App wiring ---
  const system = new BillingSystem();

  // DOM refs
  const customersList = document.getElementById("customersList");
  const btnAddCustomer = document.getElementById("btnAddCustomer");
  const custName = document.getElementById("custName");
  const custEmail = document.getElementById("custEmail");
  const custPlan = document.getElementById("custPlan");
  const custRate = document.getElementById("custRate");
  const rateRow = document.getElementById("rateRow");

  const selectedDetails = document.getElementById("selectedDetails");
  const noSelection = document.getElementById("noSelection");
  const custInfo = document.getElementById("custInfo");
  const btnAddTx = document.getElementById("btnAddTx");
  const txUsage = document.getElementById("txUsage");
  const txDesc = document.getElementById("txDesc");
  const btnAddDisc = document.getElementById("btnAddDisc");
  const discPct = document.getElementById("discPct");
  const discDesc = document.getElementById("discDesc");
  const invoiceBox = document.getElementById("invoiceBox");
  const btnCalc = document.getElementById("btnCalc");
  const btnPrint = document.getElementById("btnPrint");
  const btnListAll = document.getElementById("btnListAll");
  const btnExport = document.getElementById("btnExport");
  const btnImport = document.getElementById("btnImport");
  const fileImport = document.getElementById("fileImport");
  const custSearch = document.getElementById("custSearch");
  const custCount = document.getElementById("custCount");
  const btnRunLoad = document.getElementById("btnRunLoad");
  const loadCust = document.getElementById("loadCust");
  const loadTx = document.getElementById("loadTx");
  const loadResult = document.getElementById("loadResult");

  let selectedCustomerId = null;

  function renderCustomers() {
    // customersList is a <table>
    const arr = system.listCustomers();
    // apply search filter
    const q =
      custSearch && custSearch.value
        ? custSearch.value.trim().toLowerCase()
        : "";
    const filtered = arr.filter((c) => {
      if (!q) return true;
      return (
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        String(c.id).includes(q)
      );
    });
    if (custCount) custCount.textContent = `(${filtered.length}/${arr.length})`;

    // build table: header + body
    customersList.innerHTML = "";
    const thead = document.createElement("thead");
    thead.innerHTML =
      '<tr><th class="col-id">ID</th><th>Name</th><th>Email</th><th>Plan</th><th class="col-actions">Actions</th></tr>';
    customersList.appendChild(thead);

    const tbody = document.createElement("tbody");
    if (filtered.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 5;
      td.textContent = "(no customers)";
      td.style.padding = "10px";
      tr.appendChild(td);
      tbody.appendChild(tr);
    } else {
      for (const c of filtered) {
        const tr = document.createElement("tr");
        tr.onclick = () => {
          selectCustomer(c.id);
        };
        const tdId = document.createElement("td");
        tdId.className = "col-id";
        tdId.textContent = c.id;
        const tdName = document.createElement("td");
        tdName.innerHTML = `<strong>${c.name}</strong>`;
        const tdEmail = document.createElement("td");
        tdEmail.textContent = c.email;
        const tdPlan = document.createElement("td");
        tdPlan.textContent = c.billingStrategy.getStrategyName();
        const tdActions = document.createElement("td");
        tdActions.className = "col-actions";

        // compact icon buttons
        const inv = document.createElement("button");
        inv.className = "icon-btn icon-invoice";
        inv.title = "Invoice";
        inv.innerText = "🧾";
        inv.onclick = (e) => {
          e.stopPropagation();
          selectCustomer(c.id);
          renderInvoice(c);
        };
        const del = document.createElement("button");
        del.className = "icon-btn icon-delete";
        del.title = "Delete";
        del.innerText = "🗑️";
        del.onclick = (e) => {
          e.stopPropagation();
          if (
            !confirm(
              'Delete customer "' +
                c.name +
                '" (ID ' +
                c.id +
                ")? This cannot be undone."
            )
          )
            return;
          const ok = system.deleteCustomer(c.id);
          if (ok) {
            saveState();
            if (selectedCustomerId === c.id) {
              selectedCustomerId = null;
              selectedDetails.style.display = "none";
              noSelection.style.display = "block";
            }
            renderCustomers();
          }
        };

        tdActions.appendChild(inv);
        tdActions.appendChild(del);

        tr.appendChild(tdId);
        tr.appendChild(tdName);
        tr.appendChild(tdEmail);
        tr.appendChild(tdPlan);
        tr.appendChild(tdActions);
        tbody.appendChild(tr);
      }
    }
    customersList.appendChild(tbody);
  }

  function selectCustomer(id) {
    selectedCustomerId = id;
    const c = system.findCustomer(id);
    if (!c) return;
    noSelection.style.display = "none";
    selectedDetails.style.display = "block";
    // collapse Add Customer panel to reduce visual clutter
    const addDet = document.getElementById("detailsAddCustomer");
    if (addDet && addDet.open) addDet.open = false;
    custInfo.innerHTML = `<strong>${c.name}</strong> (ID: ${c.id})<br>${
      c.email
    }<br>Plan: ${c.billingStrategy.getStrategyName()}`;
    renderInvoice(c);
  }

  function renderInvoice(c) {
    if (!c) return;
    // Render invoice with emphasized labels for clarity
    let out = "";
    out += `<div><strong>Customer:</strong> ${c.name} (ID ${c.id})</div>`;
    out += `<div><strong>Plan:</strong> ${c.billingStrategy.getStrategyName()}</div>`;
    out += `<div style="margin-top:8px"><strong>Transactions:</strong></div>`;
    out += `<ul style=\"margin:6px 0 6px 18px;padding:0\">`;
    for (const t of c.transactions)
      out += `<li>${t.desc || "(no desc)"} — ${t.usage} units</li>`;
    out += `</ul>`;
    out += `<div><strong>Total usage:</strong> ${c.getTotalUsage()} units</div>`;
    if (c.discounts.length) {
      out += `<div style=\"margin-top:6px\"><strong>Discounts:</strong></div>`;
      out += `<ul style=\"margin:6px 0 6px 18px;padding:0\">`;
      for (const d of c.discounts)
        out += `<li>${
          d.getDescription ? d.getDescription() : "(discount)"
        }</li>`;
      out += `</ul>`;
    }
    out += `<div style=\"margin-top:8px\"><strong>TOTAL:</strong> $${c
      .calculateBill()
      .toFixed(2)}</div>`;
    invoiceBox.innerHTML = out;
  }

  // events
  custPlan.addEventListener("change", () => {
    rateRow.style.display = custPlan.value === "flat" ? "block" : "none";
  });

  btnAddCustomer.addEventListener("click", () => {
    const name = custName.value.trim();
    const email = custEmail.value.trim();
    if (!name || !email) {
      alert("Enter name and email");
      return;
    }
    let strat = new TieredBilling();
    if (custPlan.value === "flat")
      strat = new FlatRateBilling(parseFloat(custRate.value) || 0.15);
    const c = system.addCustomer(name, email, strat);
    custName.value = "";
    custEmail.value = "";
    renderCustomers();
    selectCustomer(c.id);
    saveState();
  });

  btnAddTx.addEventListener("click", () => {
    if (!selectedCustomerId) {
      alert("Select a customer first");
      return;
    }
    const usage = parseFloat(txUsage.value);
    if (isNaN(usage)) {
      alert("Enter usage");
      return;
    }
    const desc = txDesc.value || "";
    const c = system.findCustomer(selectedCustomerId);
    c.addTransaction(usage, desc);
    txUsage.value = "";
    txDesc.value = "";
    renderInvoice(c);
    renderCustomers();
    saveState();
  });

  btnAddDisc.addEventListener("click", () => {
    if (!selectedCustomerId) {
      alert("Select a customer first");
      return;
    }
    const pct = parseFloat(discPct.value);
    if (isNaN(pct)) {
      alert("Enter discount %");
      return;
    }
    const reason = discDesc.value || "Discount";
    const c = system.findCustomer(selectedCustomerId);
    c.addDiscount(new PercentageDiscount(pct, reason));
    discDesc.value = "";
    renderInvoice(c);
    saveState();
  });

  btnCalc.addEventListener("click", () => {
    const c = system.findCustomer(selectedCustomerId);
    if (!c) {
      alert("Select customer");
      return;
    }
    renderInvoice(c);
  });

  btnPrint.addEventListener("click", () => {
    window.print();
  });

  if (btnListAll) {
    btnListAll.addEventListener("click", renderCustomers);
  }
  if (custSearch) {
    custSearch.addEventListener("input", () => renderCustomers());
  }

  btnExport.addEventListener("click", () => {
    const text = system.exportJSON();
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "billing_export.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  btnImport.addEventListener("click", () => fileImport.click());
  fileImport.addEventListener("change", (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ok = system.importJSON(reader.result);
      if (!ok) alert("Import failed: invalid JSON");
      else {
        renderCustomers();
        saveState();
        alert("Imported successfully");
      }
    };
    reader.readAsText(f);
  });

  // load test
  btnRunLoad.addEventListener("click", () => {
    const nc = parseInt(loadCust.value) || 0;
    const ntx = parseInt(loadTx.value) || 0;
    if (nc <= 0) {
      alert("Enter customers count");
      return;
    }
    loadResult.textContent = "Running...";
    btnRunLoad.disabled = true;
    // simple random generator
    function rnd(min, max) {
      return Math.random() * (max - min) + min;
    }
    const start = performance.now();
    for (let i = 0; i < nc; ++i) {
      const c = system.addCustomer(
        "LT " + (i + 1),
        `lt${i + 1}@local`,
        i % 2 === 0 ? new FlatRateBilling(rnd(0.05, 0.5)) : new TieredBilling()
      );
      for (let t = 0; t < ntx; ++t) {
        c.addTransaction(rnd(10, 1000), "tx" + (t + 1));
      }
      if (i % 2 === 0) c.addDiscount(new PercentageDiscount(5, "LT5%"));
    }
    // invoice calculations
    let totalCharge = 0;
    for (const c of system.listCustomers()) totalCharge += c.calculateBill();
    const end = performance.now();
    loadResult.textContent = `Added ${nc} customers (${ntx} tx each).\nTotalCharge: $${totalCharge.toFixed(
      2
    )}\nTime: ${(end - start).toFixed(2)} ms`;
    renderCustomers();
    saveState();
    btnRunLoad.disabled = false;
  });

  // try load persisted
  if (!loadState()) {
    // no saved state
  }
  renderCustomers();
})();
