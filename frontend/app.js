// Lightweight JS implementation mirroring the C++ billing system.
// This frontend is standalone and stores everything in-memory.
// Provides JSON export/import to integrate with the C++ side if needed.

(function () {
    // --- Billing classes (mirror C++ logic) ---
    class BillingStrategy {
        calculateCharge(usage) { return 0; }
        getStrategyName() { return "base"; }
    }

    class FlatRateBilling extends BillingStrategy {
        constructor(rate) { super(); this.rate = rate; }
        calculateCharge(usage) { return usage * this.rate; }
        getStrategyName() { return "Flat Rate"; }
    }

    class TieredBilling extends BillingStrategy {
        calculateCharge(usage) {
            let charge = 0;
            if (usage <= 100) charge = usage * 0.10;
            else if (usage <= 500) charge = (100 * 0.10) + ((usage - 100) * 0.08);
            else charge = (100 * 0.10) + (400 * 0.08) + ((usage - 500) * 0.05);
            return charge;
        }
        getStrategyName() { return "Tiered Pricing"; }
    }

    class Discount {
        apply(charge) { return charge; }
        getDescription() { return ""; }
    }

    class PercentageDiscount extends Discount {
        constructor(pct, reason) { super(); this.pct = pct; this.reason = reason; }
        apply(charge) { return charge * (1 - this.pct / 100.0); }
        getDescription() { return this.reason; }
    }

    class Transaction {
        constructor(usage, desc) { this.usage = usage; this.desc = desc; }
    }

    class Customer {
        constructor(id, name, email, billingStrategy) {
            this.id = id; this.name = name; this.email = email;
            this.billingStrategy = billingStrategy;
            this.transactions = []; this.discounts = [];
        }
        addTransaction(usage, desc) { this.transactions.push(new Transaction(usage, desc)); }
        addDiscount(d) { this.discounts.push(d); }
        getTotalUsage() { return this.transactions.reduce((s, t) => s + t.usage, 0); }
        calculateBill() {
            const totalUsage = this.getTotalUsage();
            let charge = this.billingStrategy.calculateCharge(totalUsage);
            for (const d of this.discounts) charge = d.apply(charge);
            return charge;
        }
    }

    class BillingSystem {
        constructor() { this.customers = []; this.nextId = 1001; }
        addCustomer(name, email, strategy) {
            const id = this.nextId++;
            const c = new Customer(id, name, email, strategy);
            this.customers.push(c);
            return c;
        }
        findCustomer(id) { return this.customers.find(x => x.id === id) || null; }
        listCustomers() { return this.customers.slice(); }
        exportJSON() {
            // Convert customers to plain objects
            return JSON.stringify(this.customers.map(c => ({
                id: c.id,
                name: c.name,
                email: c.email,
                strategy: c.billingStrategy.getStrategyName(),
                rate: (c.billingStrategy instanceof FlatRateBilling) ? c.billingStrategy.rate : null,
                transactions: c.transactions.map(t => ({ usage: t.usage, desc: t.desc })),
                discounts: c.discounts.map(d => ({ type: (d instanceof PercentageDiscount ? "pct" : "unknown"), pct: d.pct, desc: d.reason }))
            })), null, 2);
        }
        importJSON(text) {
            try {
                const arr = JSON.parse(text);
                for (const o of arr) {
                    let strat = new TieredBilling();
                    if (o.strategy === "Flat Rate") strat = new FlatRateBilling(parseFloat(o.rate) || 0.15);
                    const c = this.addCustomer(o.name, o.email, strat);
                    if (Array.isArray(o.transactions)) for (const t of o.transactions) c.addTransaction(parseFloat(t.usage) || 0, t.desc || "");
                    if (Array.isArray(o.discounts)) for (const d of o.discounts) {
                        if (d.type === "pct") c.addDiscount(new PercentageDiscount(parseFloat(d.pct) || 0, d.desc || ""));
                    }
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
    const customersList = document.getElementById('customersList');
    const btnAddCustomer = document.getElementById('btnAddCustomer');
    const custName = document.getElementById('custName');
    const custEmail = document.getElementById('custEmail');
    const custPlan = document.getElementById('custPlan');
    const custRate = document.getElementById('custRate');
    const rateRow = document.getElementById('rateRow');

    const selectedDetails = document.getElementById('selectedDetails');
    const noSelection = document.getElementById('noSelection');
    const custInfo = document.getElementById('custInfo');
    const btnAddTx = document.getElementById('btnAddTx');
    const txUsage = document.getElementById('txUsage');
    const txDesc = document.getElementById('txDesc');
    const btnAddDisc = document.getElementById('btnAddDisc');
    const discPct = document.getElementById('discPct');
    const discDesc = document.getElementById('discDesc');
    const invoiceBox = document.getElementById('invoiceBox');
    const btnCalc = document.getElementById('btnCalc');
    const btnPrint = document.getElementById('btnPrint');
    const btnListAll = document.getElementById('btnListAll');
    const btnExport = document.getElementById('btnExport');
    const btnImport = document.getElementById('btnImport');
    const fileImport = document.getElementById('fileImport');
    const btnRunLoad = document.getElementById('btnRunLoad');
    const loadCust = document.getElementById('loadCust');
    const loadTx = document.getElementById('loadTx');
    const loadResult = document.getElementById('loadResult');

    let selectedCustomerId = null;

    function renderCustomers() {
        customersList.innerHTML = "";
        const arr = system.listCustomers();
        if (arr.length === 0) {
            customersList.textContent = "(no customers)";
            return;
        }
        for (const c of arr) {
            const div = document.createElement('div');
            div.className = 'customerItem';
            div.innerHTML = `<div>
                <strong>${c.name}</strong><br><small>ID: ${c.id} • ${c.email}</small>
                </div>`;
            const btns = document.createElement('div');
            const sel = document.createElement('button'); sel.textContent = 'Select';
            sel.onclick = () => { selectCustomer(c.id); };
            const inv = document.createElement('button'); inv.textContent = 'Invoice';
            inv.onclick = () => { selectCustomer(c.id); renderInvoice(c); };
            btns.appendChild(sel); btns.appendChild(inv);
            div.appendChild(btns);
            customersList.appendChild(div);
        }
    }

    function selectCustomer(id) {
        selectedCustomerId = id;
        const c = system.findCustomer(id);
        if (!c) return;
        noSelection.style.display = 'none';
        selectedDetails.style.display = 'block';
        custInfo.innerHTML = `<strong>${c.name}</strong> (ID: ${c.id})<br>${c.email}<br>Plan: ${c.billingStrategy.getStrategyName()}`;
        renderInvoice(c);
    }

    function renderInvoice(c) {
        if (!c) return;
        let out = "";
        out += `Customer: ${c.name} (ID ${c.id})\n`;
        out += `Plan: ${c.billingStrategy.getStrategyName()}\n\n`;
        out += `Transactions:\n`;
        for (const t of c.transactions) out += ` - ${t.desc || '(no desc)'} : ${t.usage} units\n`;
        out += `\nTotal usage: ${c.getTotalUsage()} units\n`;
        if (c.discounts.length) {
            out += `\nDiscounts:\n`;
            for (const d of c.discounts) out += ` - ${d.getDescription ? d.getDescription() : '(discount)'}\n`;
        }
        out += `\nTOTAL: $${c.calculateBill().toFixed(2)}\n`;
        invoiceBox.textContent = out;
    }

    // events
    custPlan.addEventListener('change', () => {
        rateRow.style.display = (custPlan.value === 'flat') ? 'block' : 'none';
    });

    btnAddCustomer.addEventListener('click', () => {
        const name = custName.value.trim();
        const email = custEmail.value.trim();
        if (!name || !email) { alert('Enter name and email'); return; }
        let strat = new TieredBilling();
        if (custPlan.value === 'flat') strat = new FlatRateBilling(parseFloat(custRate.value) || 0.15);
        const c = system.addCustomer(name, email, strat);
        custName.value = ''; custEmail.value = '';
        renderCustomers();
        selectCustomer(c.id);
    });

    btnAddTx.addEventListener('click', () => {
        if (!selectedCustomerId) { alert('Select a customer first'); return; }
        const usage = parseFloat(txUsage.value);
        if (isNaN(usage)) { alert('Enter usage'); return; }
        const desc = txDesc.value || '';
        const c = system.findCustomer(selectedCustomerId);
        c.addTransaction(usage, desc);
        txUsage.value = ''; txDesc.value = '';
        renderInvoice(c);
        renderCustomers();
    });

    btnAddDisc.addEventListener('click', () => {
        if (!selectedCustomerId) { alert('Select a customer first'); return; }
        const pct = parseFloat(discPct.value);
        if (isNaN(pct)) { alert('Enter discount %'); return; }
        const reason = discDesc.value || 'Discount';
        const c = system.findCustomer(selectedCustomerId);
        c.addDiscount(new PercentageDiscount(pct, reason));
        discDesc.value = '';
        renderInvoice(c);
    });

    btnCalc.addEventListener('click', () => {
        const c = system.findCustomer(selectedCustomerId);
        if (!c) { alert('Select customer'); return; }
        renderInvoice(c);
    });

    btnPrint.addEventListener('click', () => {
        window.print();
    });

    btnListAll.addEventListener('click', renderCustomers);

    btnExport.addEventListener('click', () => {
        const text = system.exportJSON();
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'billing_export.json'; a.click();
        URL.revokeObjectURL(url);
    });

    btnImport.addEventListener('click', () => fileImport.click());
    fileImport.addEventListener('change', (ev) => {
        const f = ev.target.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
            const ok = system.importJSON(reader.result);
            if (!ok) alert('Import failed: invalid JSON');
            else { renderCustomers(); alert('Imported successfully'); }
        };
        reader.readAsText(f);
    });

    // load test
    btnRunLoad.addEventListener('click', () => {
        const nc = parseInt(loadCust.value) || 0;
        const ntx = parseInt(loadTx.value) || 0;
        if (nc <= 0) { alert('Enter customers count'); return; }
        loadResult.textContent = 'Running...';
        // simple random generator
        function rnd(min, max) { return Math.random() * (max - min) + min; }
        const start = performance.now();
        for (let i = 0; i < nc; ++i) {
            const c = system.addCustomer('LT ' + (i + 1), `lt${i+1}@local`, (i % 2 === 0) ? new FlatRateBilling(rnd(0.05, 0.5)) : new TieredBilling());
            for (let t = 0; t < ntx; ++t) {
                c.addTransaction(rnd(10, 1000), 'tx' + (t+1));
            }
            if (i % 2 === 0) c.addDiscount(new PercentageDiscount(5, 'LT5%'));
        }
        // invoice calculations
        let totalCharge = 0;
        for (const c of system.listCustomers()) totalCharge += c.calculateBill();
        const end = performance.now();
        loadResult.textContent = `Added ${nc} customers (${ntx} tx each).\nTotalCharge: $${totalCharge.toFixed(2)}\nTime: ${(end - start).toFixed(2)} ms`;
        renderCustomers();
    });

    // initial UI
    renderCustomers();
})();