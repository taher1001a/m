/* ============================================================
   app.js — منطق التطبيق الرئيسي
   إدارة: لوحة التحكم، الديون، المخزون، الفواتير، النسخ الاحتياطي
   ============================================================ */

const App = {
    currentPage: 'dashboard',
    currentTab: 'debts',
    searchQuery: '',
    selectedClientId: null,
    invoiceItems: [],

    /**
     * تهيئة التطبيق
     */
    init() {
        // إخفاء شاشة التحميل
        document.getElementById('loadingScreen').classList.add('hidden');

        // تهيئة قاعدة البيانات
        DB.init();

        // تهيئة المصادقة
        const authed = Auth.init();

if (authed) {
            // تفعيل المزامنة السحابية إذا كان تسجيل دخول حقيقياً
            if (!Auth.demoMode && Auth.firebaseReady) {
                Firestore.init();
                Firestore.enable(Auth.user);
            }
            this.showApp();
        } else {
            this.showLogin();
        }

// تطبيق موقع القائمة المحفوظ
        this.applyNavPosition();

        // ربط الأحداث
        this.bindEvents();
    },

    bindEvents() {
// تسجيل الدخول
        document.getElementById('googleLoginBtn').addEventListener('click', async () => {
            const ok = await Auth.loginWithGoogle();
            if (ok) {
                // تفعيل المزامنة السحابية بعد تسجيل الدخول الحقيقي
                if (!Auth.demoMode && Auth.firebaseReady) {
                    Firestore.init();
                    Firestore.enable(Auth.user);
                }
                this.showApp();
            }
        });
        document.getElementById('demoLoginBtn').addEventListener('click', () => {
            Auth.loginAsDemo();
            this.showApp();
        });

        // شريط جانبي
        document.getElementById('menuBtn').addEventListener('click', () => this.toggleSidebar(true));
        document.getElementById('sidebarOverlay').addEventListener('click', () => this.toggleSidebar(false));
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                this.navigate(item.dataset.page);
                this.toggleSidebar(false);
            });
        });

// تسجيل الخروج
        document.getElementById('logoutBtn').addEventListener('click', async () => {
            await Auth.logout();
            if (typeof Firestore !== 'undefined' && Firestore.disable) {
                Firestore.disable();
            }
            this.showLogin();
        });

        // زر إغلاق النافذة المنبثقة
        document.getElementById('modalOverlay').addEventListener('click', (e) => {
            if (e.target.id === 'modalOverlay') Utils.closeModal();
        });

        // FAB
        document.getElementById('fabBtn').addEventListener('click', () => {
            if (this.currentPage === 'debts') this.showAddDebtModal();
            else if (this.currentPage === 'inventory') this.showAddProductModal();
            else if (this.currentPage === 'invoices') this.showAddInvoiceModal();
            else this.showQuickActions();
        });

// زر المزامنة
        document.getElementById('syncStatusBtn').addEventListener('click', () => {
            if (Firestore.isEnabled()) {
                Firestore.manualSync();
            } else {
                Utils.toast(Auth.firebaseReady ? '☁️ متصل بالسحابة — سجّل الدخول لتفعيل المزامنة' : '☁️ وضع محلي — Firebase غير مرتبط بعد', '');
            }
        });

        // زر الحساب
        document.getElementById('userAvatarBtn').addEventListener('click', () => {
            this.showAccountModal();
        });
    },

    /* =================== التنقل =================== */

    showLogin() {
        document.getElementById('appView').classList.add('hidden');
        document.getElementById('loginView').classList.remove('hidden');
    },

    showApp() {
        document.getElementById('loginView').classList.add('hidden');
        document.getElementById('appView').classList.remove('hidden');
        this.navigate('dashboard');
    },

    navigate(page) {
        this.currentPage = page;
        document.querySelectorAll('.nav-item').forEach(i => {
            i.classList.toggle('active', i.dataset.page === page);
        });
        const titles = {
            dashboard: 'لوحة التحكم',
            debts: 'إدارة الديون',
            inventory: 'المخزون',
            invoices: 'الفواتير',
            backup: 'النسخ الاحتياطي',
            settings: 'الإعدادات'
        };
        document.getElementById('pageTitle').textContent = titles[page] || '';
        this.renderPage(page);
    },

    toggleSidebar(open) {
        document.getElementById('sidebar').classList.toggle('open', open);
        document.getElementById('sidebarOverlay').classList.toggle('hidden', !open);
    },

    /* =================== عرض الصفحات =================== */

    renderPage(page) {
        const main = document.getElementById('mainContent');
        switch (page) {
            case 'dashboard':
                main.innerHTML = this.dashboardHTML();
                this.bindDashboard();
                break;
            case 'debts':
                main.innerHTML = this.debtsHTML();
                this.bindDebts();
                break;
            case 'inventory':
                main.innerHTML = this.inventoryHTML();
                this.bindInventory();
                break;
            case 'invoices':
                main.innerHTML = this.invoicesHTML();
                this.bindInvoices();
                break;
            case 'backup':
                main.innerHTML = this.backupHTML();
                this.bindBackup();
                break;
            case 'settings':
                main.innerHTML = this.settingsHTML();
                this.bindSettings();
                break;
        }
    },

    /* =================== لوحة التحكم =================== */

    dashboardHTML() {
        const data = DB.data;
        const totalDebt = DB.totalDebts();
        const totalPaid = DB.totalPaid();
        const lowStock = DB.lowStockProducts();
        const topClients = [...data.clients].sort((a, b) => b.totalDebt - a.totalDebt).slice(0, 5);

        return `
            <div class="stats-grid">
                <div class="stat-card red">
                    <div class="stat-label">إجمالي الديون المستحقة</div>
                    <div class="stat-value">${Utils.formatMoney(totalDebt, data.settings.currency)}</div>
                </div>
                <div class="stat-card green">
                    <div class="stat-label">إجمالي المسدد</div>
                    <div class="stat-value">${Utils.formatMoney(totalPaid, data.settings.currency)}</div>
                </div>
                <div class="stat-card blue">
                    <div class="stat-label">عدد العملاء</div>
                    <div class="stat-value">${data.clients.length}</div>
                </div>
                <div class="stat-card orange">
                    <div class="stat-label">عدد المنتجات</div>
                    <div class="stat-value">${data.products.length}</div>
                </div>
            </div>

            ${lowStock.length ? `
                <div class="alert alert-warning">
                    ⚠️ <strong>تنبيه:</strong> ${lowStock.length} منتج وصل للحد الأدنى. <a href="#" onclick="App.navigate('inventory')">عرض المخزون</a>
                </div>
            ` : ''}

            <div class="card">
                <div class="card-header">
                    <span class="card-title">🏆 العملاء الأكثر ديناً</span>
                    <button class="btn btn-primary btn-sm" onclick="App.navigate('debts')">عرض الكل</button>
                </div>
                ${topClients.length ? `
                    <div class="table-wrap">
                        <table>
                            <thead><tr><th>العميل</th><th>الدين</th><th>المسدد</th></tr></thead>
                            <tbody>
                                ${topClients.map(c => `
                                    <tr>
                                        <td>${c.name}</td>
                                        <td class="stat-value" style="color:#dc2626;font-size:14px">${Utils.formatMoney(c.totalDebt, data.settings.currency)}</td>
                                        <td style="color:#16a34a">${Utils.formatMoney(c.totalPaid, data.settings.currency)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `<div class="empty-state"><div class="icon">📭</div><p>لا يوجد عملاء بعد. اضغط + لإضافة أول دين</p></div>`}
            </div>

            <div class="card">
                <div class="card-header">
                    <span class="card-title">📦 المخزون المنخفض</span>
                    <button class="btn btn-primary btn-sm" onclick="App.navigate('inventory')">إدارة المخزون</button>
                </div>
                ${lowStock.length ? `
                    <div class="table-wrap">
                        <table>
                            <thead><tr><th>المنتج</th><th>الكمية</th></tr></thead>
                            <tbody>
                                ${lowStock.map(p => `
                                    <tr>
                                        <td>${p.name}</td>
                                        <td><span class="badge badge-red">${p.quantity} متبقي</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `<div class="empty-state"><div class="icon">✅</div><p>المخزون بحالة جيدة</p></div>`}
            </div>
        `;
    },

    bindDashboard() {
        // لا أحداث خاصة
    },

    /* =================== إدارة الديون =================== */

    debtsHTML() {
        const data = DB.data;
        const clients = data.clients.filter(c =>
            !this.searchQuery || c.name.includes(this.searchQuery) || (c.phone || '').includes(this.searchQuery)
        );

        return `
            <div class="search-bar">
                <span class="search-icon">🔍</span>
                <input type="text" id="debtSearch" placeholder="ابحث عن عميل..." value="${this.searchQuery}" oninput="App.searchDebts(this.value)">
            </div>
            <div class="card">
                <div class="card-header">
                    <span class="card-title">العملاء (${clients.length})</span>
                    <button class="btn btn-success btn-sm" onclick="App.showAddDebtModal()">+ دين جديد</button>
                </div>
                ${clients.length ? `
                    <div class="table-wrap">
                        <table>
                            <thead><tr><th>العميل</th><th>الدين</th><th>المسدد</th><th>إجراءات</th></tr></thead>
                            <tbody>
                                ${clients.map(c => `
                                    <tr>
                                        <td><strong>${c.name}</strong><br><small style="color:#6b7280">${c.phone || ''}</small></td>
                                        <td style="color:#dc2626;font-weight:600">${Utils.formatMoney(c.totalDebt, data.settings.currency)}</td>
                                        <td style="color:#16a34a">${Utils.formatMoney(c.totalPaid, data.settings.currency)}</td>
                                        <td>
                                            <div class="actions">
                                                <button class="action-btn view" onclick="App.showClientModal('${c.id}')">كشف</button>
                                                <button class="action-btn edit" onclick="App.showAddDebtModal('${c.id}')">دين</button>
                                                <button class="action-btn share" onclick="App.shareClient('${c.id}')">واتساب</button>
                                            </div>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `<div class="empty-state"><div class="icon">🤝</div><p>لا يوجد عملاء. اضغط + لإضافة أول عميل</p></div>`}
            </div>
        `;
    },

    bindDebts() { },

    searchDebts(q) {
        this.searchQuery = q;
        this.renderPage('debts');
    },

    /* ===== نافذة إضافة دين ===== */

    showAddDebtModal(clientId = null) {
        const data = DB.data;
        const existing = clientId ? DB.getClient(clientId) : null;

        Utils.openModal(`
            <div class="modal-header">
                <span class="modal-title">${existing ? `إضافة دين — ${existing.name}` : 'عميل / دين جديد'}</span>
                <button class="modal-close" onclick="Utils.closeModal()">✕</button>
            </div>
            <div class="form-group">
                <label>اسم العميل</label>
                <input type="text" id="debtClientName" value="${existing ? existing.name : ''}" placeholder="أدخل اسم العميل" ${existing ? 'readonly' : ''}>
            </div>
            <div class="form-group">
                <label>رقم الهاتف (للواتساب)</label>
                <input type="text" id="debtClientPhone" value="${existing ? existing.phone : ''}" placeholder="مثال: 09xxxxxxxx" ${existing ? '' : ''}>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>المبلغ</label>
                    <input type="number" id="debtAmount" placeholder="0" min="0" step="0.01">
                </div>
                <div class="form-group">
                    <label>نوع العملية</label>
                    <select id="debtType">
                        <option value="add">إضافة دين</option>
                        <option value="pay">تسديد</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>ملاحظة</label>
                <input type="text" id="debtNote" placeholder="ملاحظة اختيارية">
            </div>
            <div class="form-group">
                <label>منتجات (اختياري — تُخصم من المخزون)</label>
                <div id="debtProductsList"></div>
                <button class="btn btn-primary btn-sm" style="margin-top:8px" onclick="App.addDebtProductRow()">+ إضافة منتج</button>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" onclick="App.saveDebt()">حفظ</button>
                <button class="btn btn-danger" onclick="Utils.closeModal()">إلغاء</button>
            </div>
        `);

        if (existing) this.addDebtProductRow();
    },

    addDebtProductRow() {
        const list = document.getElementById('debtProductsList');
        if (!list) return;
        const products = DB.data.products;
        const options = `<option value="">— اختر منتج —</option>` + products.map(p => `
            <option value="${p.id}" data-qty="${p.quantity}">${p.name} (متوفر: ${p.quantity})</option>
        `).join('');
        const row = document.createElement('div');
        row.className = 'form-row';
        row.style.marginBottom = '8px';
        row.innerHTML = `
            <select class="debt-product-sel" style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:8px">${options}</select>
            <input type="number" class="debt-product-qty" placeholder="الكمية" min="1" style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:8px">
            <button class="action-btn delete" onclick="this.parentElement.remove()">✕</button>
        `;
        list.appendChild(row);
    },

    saveDebt() {
        const name = document.getElementById('debtClientName').value.trim();
        const phone = document.getElementById('debtClientPhone').value.trim();
        const amount = parseFloat(document.getElementById('debtAmount').value) || 0;
        const type = document.getElementById('debtType').value;
        const note = document.getElementById('debtNote').value.trim();

        if (!name) return Utils.toast('أدخل اسم العميل', 'error');
        if (amount <= 0) return Utils.toast('أدخل مبلغاً صحيحاً', 'error');

        // إضافة/دمج العميل تلقائياً
        const { client, merged } = DB.addClient(name, phone);

        // معالجة المنتجات إن وجدت
        const productRows = document.querySelectorAll('.debt-product-sel');
        const items = [];
        let productsNote = '';
        productRows.forEach((sel, i) => {
            const pid = sel.value;
            const qtyEl = document.querySelectorAll('.debt-product-qty')[i];
            const qty = parseInt(qtyEl?.value) || 0;
            if (pid && qty > 0) {
                const p = DB.getProduct(pid);
                // خصم من المخزون (فقط عند إضافة دين)
                if (type === 'add') {
                    const res = DB.deductStock(pid, qty);
                    if (!res.ok) return Utils.toast(res.msg, 'error');
                    items.push({ id: p.id, name: p.name, qty, price: p.price });
                }
            }
        });

        // إضافة المعاملة
        DB.addTransaction({ clientId: client.id, type, amount, note, products: items });

        // إنشاء فاتورة
        const invoice = DB.createInvoice({
            clientId: client.id,
            items,
            total: amount,
            paid: type === 'pay' ? amount : 0,
            type
        });

        Utils.toast(merged ? 'تم الدمج مع حساب العميل الحالي ✅' : 'تم حفظ العملية ✅', 'success');
        Utils.closeModal();

        // عرض فاتورة العملية مع خيار المشاركة
        this.showInvoiceResult(invoice);
    },

    showInvoiceResult(invoice) {
        const client = DB.getClient(invoice.clientId);
        const currency = DB.data.settings.currency;
        const remaining = invoice.total - invoice.paid;

        Utils.openModal(`
            <div class="modal-header">
                <span class="modal-title">✅ تم الحفظ — فاتورة رقم ${invoice.number}</span>
                <button class="modal-close" onclick="Utils.closeModal()">✕</button>
            </div>
            <div class="invoice" style="width:100%;max-width:none">
                <div class="inv-header">
                    <h3>${DB.data.settings.storeName}</h3>
                    <div>فاتورة رقم ${invoice.number}</div>
                    <div>التاريخ: ${Utils.formatDate(invoice.date)}</div>
                    <div>العميل: ${client.name}</div>
                </div>
                ${invoice.items?.length ? invoice.items.map(item => `
                    <div class="inv-row"><span>${item.name} × ${item.qty}</span><span>${Utils.formatMoney(item.price * item.qty, currency)}</span></div>
                `).join('') : ''}
                <div class="inv-total">
                    <div class="inv-row"><span>الإجمالي</span><span>${Utils.formatMoney(invoice.total, currency)}</span></div>
                    ${invoice.paid > 0 ? `<div class="inv-row"><span>المسدد</span><span>${Utils.formatMoney(invoice.paid, currency)}</span></div>` : ''}
                    ${remaining > 0 ? `<div class="inv-row" style="color:#dc2626"><span>المتبقي على العميل</span><span>${Utils.formatMoney(remaining, currency)}</span></div>` : ''}
                </div>
                <div class="inv-footer">شكراً لتعاملكم معنا 🌟</div>
            </div>
            <div class="modal-footer" style="flex-wrap:wrap">
                <button class="btn btn-success btn-sm" onclick="App.shareInvoice('${invoice.id}')">📲 واتساب</button>
                <button class="btn btn-primary btn-sm" onclick="Utils.printInvoice(DB.getInvoice('${invoice.id}'))">🖨️ طباعة</button>
                <button class="btn btn-warning btn-sm" onclick="Utils.downloadPDF(DB.getInvoice('${invoice.id}'), 'invoice-${invoice.number}.pdf')">📄 PDF</button>
                <button class="btn btn-danger btn-sm" onclick="Utils.closeModal()">إغلاق</button>
            </div>
        `);
    },

    /* ===== كشف حساب العميل ===== */

    showClientModal(clientId) {
        const client = DB.getClient(clientId);
        if (!client) return;
        const txs = DB.getClientTransactions(clientId);
        const currency = DB.data.settings.currency;

        Utils.openModal(`
            <div class="modal-header">
                <span class="modal-title">كشف حساب — ${client.name}</span>
                <button class="modal-close" onclick="Utils.closeModal()">✕</button>
            </div>
            <div class="stats-grid" style="grid-template-columns:1fr 1fr">
                <div class="stat-card red"><div class="stat-label">الدين المتبقي</div><div class="stat-value" style="font-size:18px">${Utils.formatMoney(client.totalDebt, currency)}</div></div>
                <div class="stat-card green"><div class="stat-label">المسدد</div><div class="stat-value" style="font-size:18px">${Utils.formatMoney(client.totalPaid, currency)}</div></div>
            </div>
            <div class="card" style="box-shadow:none;padding:0;margin-top:12px">
                <div class="card-header">
                    <span class="card-title">سجل العمليات (${txs.length})</span>
                    <div style="display:flex;gap:6px">
                        <button class="btn btn-success btn-sm" onclick="App.showPaymentModal('${client.id}')" style="width:auto">تسديد</button>
                        <button class="btn btn-primary btn-sm" onclick="App.showAddDebtModal('${client.id}')" style="width:auto">+ دين</button>
                    </div>
                </div>
                ${txs.length ? `
                    <div class="table-wrap">
                        <table>
                            <thead><tr><th>التاريخ</th><th>النوع</th><th>المبلغ</th><th>ملاحظة</th></tr></thead>
                            <tbody>
                                ${txs.map(t => `
                                    <tr>
                                        <td><small>${Utils.formatDate(t.date)}</small></td>
                                        <td>
                                            <span class="badge ${t.type === 'add' ? 'badge-red' : t.type === 'pay' ? 'badge-green' : 'badge-orange'}">
                                                ${t.type === 'add' ? 'دين' : t.type === 'pay' ? 'تسديد' : 'تعديل'}
                                            </span>
                                        </td>
                                        <td style="font-weight:600;${t.type === 'add' ? 'color:#dc2626' : t.type === 'pay' ? 'color:#16a34a' : 'color:#b45309'}">
                                            ${t.type === 'add' ? '+' : t.type === 'pay' ? '-' : ''}${Utils.formatMoney(t.amount, currency)}
                                        </td>
                                        <td><small>${t.note || (t.products?.length ? t.products.map(p => `${p.name}×${p.qty}`).join(', ') : '')}</small></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `<div class="empty-state"><div class="icon">📭</div><p>لا توجد عمليات</p></div>`}
            </div>
            <div class="modal-footer">
                <button class="btn btn-success btn-sm" onclick="App.shareClient('${client.id}')">📲 مشاركة الواتساب</button>
                <button class="btn btn-primary btn-sm" onclick="App.printClientStatement('${client.id}')">🖨️ طباعة</button>
            </div>
        `);
    },

    showPaymentModal(clientId) {
        const client = DB.getClient(clientId);
        if (!client) return;
        const currency = DB.data.settings.currency;

        Utils.openModal(`
            <div class="modal-header">
                <span class="modal-title">تسديد — ${client.name}</span>
                <button class="modal-close" onclick="Utils.closeModal()">✕</button>
            </div>
            <div class="alert alert-info">الدين المتبقي: <strong>${Utils.formatMoney(client.totalDebt, currency)}</strong></div>
            <div class="form-row">
                <div class="form-group">
                    <label>المبلغ المسدد</label>
                    <input type="number" id="payAmount" placeholder="0" min="0" step="0.01" max="${client.totalDebt}">
                </div>
                <div class="form-group">
                    <label>نوع التسديد</label>
                    <select id="payType">
                        <option value="partial">جزئي</option>
                        <option value="full">كامل</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>ملاحظة</label>
                <input type="text" id="payNote" placeholder="ملاحظة اختيارية">
            </div>
            <div class="modal-footer">
                <button class="btn btn-success" onclick="App.savePayment('${client.id}')">تأكيد التسديد</button>
                <button class="btn btn-danger" onclick="Utils.closeModal()">إلغاء</button>
            </div>
        `);
    },

    savePayment(clientId) {
        let amount = parseFloat(document.getElementById('payAmount').value) || 0;
        const type = document.getElementById('payType').value;
        const note = document.getElementById('payNote').value.trim();
        const client = DB.getClient(clientId);
        if (!client) return;

        if (type === 'full') amount = client.totalDebt;
        if (amount <= 0) return Utils.toast('أدخل مبلغاً صحيحاً', 'error');

        DB.addTransaction({ clientId, type: 'pay', amount, note });

        // إنشاء فاتورة تسديد
        const invoice = DB.createInvoice({ clientId, items: [], total: amount, paid: amount, type: 'pay' });

        Utils.toast('تم تسجيل التسديد ✅', 'success');
        Utils.closeModal();
        this.showInvoiceResult(invoice);
    },

    shareClient(clientId) {
        const client = DB.getClient(clientId);
        if (!client) return;
        const txs = DB.getClientTransactions(clientId);
        const text = Utils.generateWhatsAppText(client, txs);
        Utils.shareWhatsApp(client.phone, text);
    },

    printClientStatement(clientId) {
        const client = DB.getClient(clientId);
        if (!client) return;
        const txs = DB.getClientTransactions(clientId);
        const currency = DB.data.settings.currency;

        const printArea = document.getElementById('printArea');
        printArea.innerHTML = `
            <div class="invoice">
                <div class="inv-header">
                    <h3>${DB.data.settings.storeName}</h3>
                    <div>كشف حساب — ${client.name}</div>
                    <div>التاريخ: ${Utils.formatDate(Date.now())}</div>
                </div>
                ${txs.map(t => `
                    <div class="inv-row">
                        <span>${Utils.formatDate(t.date)} — ${t.type === 'add' ? 'دين' : t.type === 'pay' ? 'تسديد' : 'تعديل'}</span>
                        <span>${Utils.formatMoney(t.amount, currency)}</span>
                    </div>
                `).join('')}
                <div class="inv-total">
                    <div class="inv-row"><span>المتبقي</span><span>${Utils.formatMoney(client.totalDebt, currency)}</span></div>
                    <div class="inv-row"><span>المسدد</span><span>${Utils.formatMoney(client.totalPaid, currency)}</span></div>
                </div>
                <div class="inv-footer">شكراً لتعاملكم معنا 🌟</div>
            </div>
        `;
        window.print();
        printArea.innerHTML = '';
    },

    shareInvoice(invoiceId) {
        const invoice = DB.getInvoice(invoiceId);
        if (!invoice) return;
        const client = DB.getClient(invoice.clientId);
        const text = Utils.generateInvoiceText(invoice);
        Utils.shareWhatsApp(client?.phone, text);
    },

    /* =================== المخزون =================== */

    inventoryHTML() {
        const data = DB.data;
        const products = data.products.filter(p =>
            !this.searchQuery || p.name.includes(this.searchQuery) || (p.barcode || '').includes(this.searchQuery)
        );

        return `
            <div class="search-bar">
                <span class="search-icon">🔍</span>
                <input type="text" id="productSearch" placeholder="ابحث بالاسم أو الباركود..." value="${this.searchQuery}" oninput="App.searchProducts(this.value)">
            </div>
            <div class="card">
                <div class="card-header">
                    <span class="card-title">المنتجات (${products.length})</span>
                    <button class="btn btn-success btn-sm" onclick="App.showAddProductModal()">+ منتج جديد</button>
                </div>
                ${products.length ? `
                    <div class="table-wrap">
                        <table>
                            <thead><tr><th>المنتج</th><th>الباركود</th><th>السعر</th><th>الكمية</th><th>الحالة</th><th>إجراءات</th></tr></thead>
                            <tbody>
                                ${products.map(p => {
                                    const isLow = p.quantity <= (p.minQuantity || data.settings.lowStockThreshold);
                                    return `
                                        <tr>
                                            <td><strong>${p.name}</strong></td>
                                            <td><small style="color:#6b7280">${p.barcode || '—'}</small></td>
                                            <td>${Utils.formatMoney(p.price, data.settings.currency)}</td>
                                            <td>${p.quantity}</td>
                                            <td>${isLow ? '<span class="badge badge-red">منخفض</span>' : '<span class="badge badge-green">متوفر</span>'}</td>
                                            <td>
                                                <div class="actions">
                                                    <button class="action-btn edit" onclick="App.showEditProductModal('${p.id}')">تعديل</button>
                                                    <button class="action-btn delete" onclick="App.deleteProduct('${p.id}')">حذف</button>
                                                </div>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `<div class="empty-state"><div class="icon">📦</div><p>لا يوجد منتجات. اضغط + لإضافة منتج</p></div>`}
            </div>
        `;
    },

    bindInventory() { },

    searchProducts(q) {
        this.searchQuery = q;
        this.renderPage('inventory');
    },

    showAddProductModal() {
        Utils.openModal(`
            <div class="modal-header">
                <span class="modal-title">إضافة منتج جديد</span>
                <button class="modal-close" onclick="Utils.closeModal()">✕</button>
            </div>
            <div class="form-group">
                <label>اسم المنتج</label>
                <input type="text" id="prodName" placeholder="اسم المنتج">
            </div>
            <div class="form-group">
                <label>الباركود <button class="btn btn-primary btn-sm" style="width:auto;display:inline-flex;margin-right:8px" onclick="App.scanBarcode()">📷 مسح</button></label>
                <input type="text" id="prodBarcode" placeholder="أدخل الباركود أو امسحه بالكاميرا">
            </div>
            <div class="form-row-3">
                <div class="form-group">
                    <label>سعر البيع</label>
                    <input type="number" id="prodPrice" placeholder="0" min="0" step="0.01">
                </div>
                <div class="form-group">
                    <label>سعر الشراء</label>
                    <input type="number" id="prodCost" placeholder="0" min="0" step="0.01">
                </div>
                <div class="form-group">
                    <label>الكمية</label>
                    <input type="number" id="prodQty" placeholder="0" min="0">
                </div>
            </div>
            <div class="form-group">
                <label>حد التنبيه الأدنى</label>
                <input type="number" id="prodMin" placeholder="5" min="0">
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" onclick="App.saveProduct()">حفظ المنتج</button>
                <button class="btn btn-danger" onclick="Utils.closeModal()">إلغاء</button>
            </div>
        `);
    },

    showEditProductModal(productId) {
        const p = DB.getProduct(productId);
        if (!p) return;
        Utils.openModal(`
            <div class="modal-header">
                <span class="modal-title">تعديل المنتج — ${p.name}</span>
                <button class="modal-close" onclick="Utils.closeModal()">✕</button>
            </div>
            <div class="form-group">
                <label>اسم المنتج</label>
                <input type="text" id="prodName" value="${p.name}">
            </div>
            <div class="form-group">
                <label>الباركود <button class="btn btn-primary btn-sm" style="width:auto;display:inline-flex;margin-right:8px" onclick="App.scanBarcode()">📷 مسح</button></label>
                <input type="text" id="prodBarcode" value="${p.barcode || ''}">
            </div>
            <div class="form-row-3">
                <div class="form-group">
                    <label>سعر البيع</label>
                    <input type="number" id="prodPrice" value="${p.price}" min="0" step="0.01">
                </div>
                <div class="form-group">
                    <label>سعر الشراء</label>
                    <input type="number" id="prodCost" value="${p.cost}" min="0" step="0.01">
                </div>
                <div class="form-group">
                    <label>الكمية</label>
                    <input type="number" id="prodQty" value="${p.quantity}" min="0">
                </div>
            </div>
            <div class="form-group">
                <label>حد التنبيه الأدنى</label>
                <input type="number" id="prodMin" value="${p.minQuantity}" min="0">
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" onclick="App.updateProduct('${p.id}')">حفظ التعديلات</button>
                <button class="btn btn-danger" onclick="Utils.closeModal()">إلغاء</button>
            </div>
        `);
    },

    saveProduct() {
        const name = document.getElementById('prodName').value.trim();
        const barcode = document.getElementById('prodBarcode').value.trim();
        const price = parseFloat(document.getElementById('prodPrice').value) || 0;
        const cost = parseFloat(document.getElementById('prodCost').value) || 0;
        const qty = parseInt(document.getElementById('prodQty').value) || 0;
        const min = parseInt(document.getElementById('prodMin').value) || 0;

        if (!name) return Utils.toast('أدخل اسم المنتج', 'error');

        // تحقق من وجود منتج بنفس الباركود
        if (barcode) {
            const existing = DB.findProductByBarcode(barcode);
            if (existing) {
                // إضافة الكمية للمنتج الحالي
                DB.updateProduct(existing.id, { quantity: existing.quantity + qty, price });
                Utils.toast(`تمت إضافة ${qty} إلى ${existing.name} الموجود ✅`, 'success');
                Utils.closeModal();
                this.renderPage('inventory');
                return;
            }
        }

        DB.addProduct({ name, barcode, price, cost, quantity: qty, minQuantity: min });
        Utils.toast('تمت إضافة المنتج ✅', 'success');
        Utils.closeModal();
        this.renderPage('inventory');
    },

    updateProduct(productId) {
        const name = document.getElementById('prodName').value.trim();
        const barcode = document.getElementById('prodBarcode').value.trim();
        const price = parseFloat(document.getElementById('prodPrice').value) || 0;
        const cost = parseFloat(document.getElementById('prodCost').value) || 0;
        const qty = parseInt(document.getElementById('prodQty').value) || 0;
        const min = parseInt(document.getElementById('prodMin').value) || 0;
        if (!name) return Utils.toast('أدخل اسم المنتج', 'error');
        DB.updateProduct(productId, { name, barcode, price, cost, quantity: qty, minQuantity: min });
        Utils.toast('تم حفظ التعديلات ✅', 'success');
        Utils.closeModal();
        this.renderPage('inventory');
    },

    deleteProduct(productId) {
        if (!confirm('هل تريد حذف هذا المنتج؟')) return;
        DB.deleteProduct(productId);
        Utils.toast('تم حذف المنتج', 'success');
        this.renderPage('inventory');
    },

scanBarcode() {
        // استخدام مكتبة html5-qrcode — تعمل على معظم المتصفحات
        if (typeof Html5QrcodeScanner === 'undefined') {
            Utils.toast('مكتبة الماسح لم تُحمّل — تحقق من الإنترنت أو أدخل الباركود يدوياً', 'error');
            return;
        }

        // التأكد من أن الصفحة تعمل عبر HTTPS أو localhost (للكاميرا)
        const isSecure = window.location.protocol === 'https:' ||
                         window.location.hostname === 'localhost' ||
                         window.location.hostname === '127.0.0.1';
        if (!isSecure) {
            Utils.toast('⚠️ الكاميرا تحتاج HTTPS أو localhost. شغّل عبر خادم محلي.', 'error');
        }

        // إغلاق أي نافذة منبثقة مفتوحة أولاً
        if (this.barcodeScanner) { this.stopBarcodeCamera(); }
        Utils.closeModal();

        const self = this;
        Utils.openModal(`
            <div class="modal-header">
                <span class="modal-title">📷 مسح الباركود</span>
                <button class="modal-close" onclick="App.stopBarcodeCamera();Utils.closeModal()">✕</button>
            </div>
            <div id="barcodeReader" style="width:100%;min-height:280px"></div>
            <p style="font-size:12px;color:#64748b;text-align:center;margin-top:8px">
                وجّه الكاميرا نحو الباركود، أو ارفع صورة باركود من جهازك في حال تعذّر فتح الكاميرا.
            </p>
            <div style="text-align:center;margin-top:10px">
                <button class="btn btn-danger" onclick="App.stopBarcodeCamera();Utils.closeModal()">إغلاق</button>
            </div>
        `);

        // استخدم Html5QrcodeScanner الكامل — يعرض واجهة باختيار الكاميرا + رفع صورة
        this.barcodeScanner = new Html5QrcodeScanner(
            'barcodeReader',
            { fps: 10, qrbox: { width: 220, height: 220 }, rememberLastUsedCamera: true, showTorchButtonIfSupported: true },
            false // verbose
        );

        this.barcodeScanner.render(
            decodedText => {
                // نجاح المسح — ضع النتيجة في حقل الباركود
                const barcodeInput = document.getElementById('prodBarcode');
                const scanned = String(decodedText).trim();
                if (barcodeInput) {
                    barcodeInput.value = scanned;
                    Utils.toast('تم مسح الباركود: ' + scanned, 'success');
                } else {
                    Utils.toast('تم المسح: ' + scanned, 'success');
                }
                self.stopBarcodeCamera();
                Utils.closeModal();
            },
            error => {
                // أخطاء المعالجة المتكررة — تجاهل (لا نعرض رسائل مزعجة)
            }
        );
    },

    stopBarcodeCamera() {
        if (this.barcodeScanner) {
            try {
                if (typeof this.barcodeScanner.stop === 'function') {
                    this.barcodeScanner.stop().catch(() => {});
                }
                if (typeof this.barcodeScanner.clear === 'function') {
                    this.barcodeScanner.clear();
                }
            } catch (e) {}
            this.barcodeScanner = null;
        }
    },

    /* =================== الفواتير =================== */

    invoicesHTML() {
        const data = DB.data;
        const invoices = [...data.invoices].sort((a, b) => b.date - a.date);

        return `
            <div class="card">
                <div class="card-header">
                    <span class="card-title">سجل الفواتير (${invoices.length})</span>
                    <button class="btn btn-success btn-sm" onclick="App.showAddInvoiceModal()">+ فاتورة</button>
                </div>
                ${invoices.length ? `
                    <div class="table-wrap">
                        <table>
                            <thead><tr><th>رقم</th><th>العميل</th><th>النوع</th><th>الإجمالي</th><th>التاريخ</th><th>إجراءات</th></tr></thead>
                            <tbody>
                                ${invoices.map(inv => {
                                    const client = DB.getClient(inv.clientId);
                                    return `
                                        <tr>
                                            <td>#${inv.number}</td>
                                            <td>${client?.name || '—'}</td>
                                            <td><span class="badge ${inv.type === 'pay' ? 'badge-green' : 'badge-red'}">${inv.type === 'pay' ? 'تسديد' : 'دين'}</span></td>
                                            <td style="font-weight:600">${Utils.formatMoney(inv.total, data.settings.currency)}</td>
                                            <td><small>${Utils.formatDate(inv.date)}</small></td>
                                            <td>
                                                <div class="actions">
                                                    <button class="action-btn print" onclick="Utils.printInvoice(DB.getInvoice('${inv.id}'))">طباعة</button>
                                                    <button class="action-btn view" onclick="Utils.downloadPDF(DB.getInvoice('${inv.id}'), 'invoice-${inv.number}.pdf')">PDF</button>
                                                    <button class="action-btn share" onclick="App.shareInvoice('${inv.id}')">واتساب</button>
                                                </div>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `<div class="empty-state"><div class="icon">🧾</div><p>لا توجد فواتير بعد</p></div>`}
            </div>
        `;
    },

    bindInvoices() { },

    showAddInvoiceModal() {
        Utils.openModal(`
            <div class="modal-header">
                <span class="modal-title">إنشاء فاتورة</span>
                <button class="modal-close" onclick="Utils.closeModal()">✕</button>
            </div>
            <div class="form-group">
                <label>العميل</label>
                <select id="invoiceClient">
                    <option value="">— اختر العميل —</option>
                    ${DB.data.clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>المنتجات</label>
                <div id="invoiceItemsList"></div>
                <button class="btn btn-primary btn-sm" style="margin-top:8px" onclick="App.addInvoiceItemRow()">+ إضافة منتج</button>
            </div>
            <div class="form-group">
                <label>المبلغ الإجمالي</label>
                <input type="number" id="invoiceTotal" placeholder="0" min="0" step="0.01">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>المسدد</label>
                    <input type="number" id="invoicePaid" placeholder="0" min="0" step="0.01">
                </div>
                <div class="form-group">
                    <label>النوع</label>
                    <select id="invoiceType">
                        <option value="debt">دين</option>
                        <option value="sell">بيع نقدي</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" onclick="App.saveInvoiceManual()">حفظ الفاتورة</button>
                <button class="btn btn-danger" onclick="Utils.closeModal()">إلغاء</button>
            </div>
        `);
    },

    addInvoiceItemRow() {
        const list = document.getElementById('invoiceItemsList');
        if (!list) return;
        const products = DB.data.products;
        const options = `<option value="">— اختر منتج —</option>` + products.map(p => `
            <option value="${p.id}" data-price="${p.price}" data-name="${p.name}">${p.name} (${p.price} — متوفر ${p.quantity})</option>
        `).join('');
        const row = document.createElement('div');
        row.className = 'form-row';
        row.style.marginBottom = '8px';
        row.innerHTML = `
            <select class="inv-prod-sel" style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:8px" onchange="App.updateInvoiceItem(this)">${options}</select>
            <input type="number" class="inv-prod-qty" placeholder="الكمية" min="1" value="1" style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:8px" onchange="App.updateInvoiceTotal()">
            <button class="action-btn delete" onclick="this.parentElement.remove();App.updateInvoiceTotal()">✕</button>
        `;
        list.appendChild(row);
    },

    updateInvoiceItem(sel) {
        const qty = sel.parentElement.querySelector('.inv-prod-qty');
        const opt = sel.options[sel.selectedIndex];
        if (opt.dataset.price && qty) {
            qty.dataset.price = opt.dataset.price;
        }
        this.updateInvoiceTotal();
    },

    updateInvoiceTotal() {
        const rows = document.querySelectorAll('#invoiceItemsList .form-row');
        let total = 0;
        rows.forEach(row => {
            const sel = row.querySelector('.inv-prod-sel');
            const qty = row.querySelector('.inv-prod-qty');
            if (sel.value) {
                const price = parseFloat(sel.options[sel.selectedIndex].dataset.price) || 0;
                total += price * (parseInt(qty?.value) || 0);
            }
        });
        const totalInput = document.getElementById('invoiceTotal');
        if (totalInput) totalInput.value = total || '';
    },

    saveInvoiceManual() {
        const clientId = document.getElementById('invoiceClient').value;
        const type = document.getElementById('invoiceType').value;
        let total = parseFloat(document.getElementById('invoiceTotal').value) || 0;
        const paid = parseFloat(document.getElementById('invoicePaid').value) || 0;

        if (!clientId) return Utils.toast('اختر العميل', 'error');
        if (total <= 0) return Utils.toast('أدخل مبلغاً صحيحاً', 'error');

        // جمع المنتجات وخفض المخزون
        const items = [];
        const rows = document.querySelectorAll('#invoiceItemsList .form-row');
        rows.forEach(row => {
            const sel = row.querySelector('.inv-prod-sel');
            const qtyVal = row.querySelector('.inv-prod-qty');
            if (sel.value) {
                const p = DB.getProduct(sel.value);
                const qty = parseInt(qtyVal?.value) || 0;
                if (qty > 0) {
                    DB.deductStock(p.id, qty);
                    items.push({ id: p.id, name: p.name, qty, price: p.price });
                }
            }
        });

        // إنشاء الفاتورة
        const invoice = DB.createInvoice({ clientId, items, total, paid, type });

        // إنشاء معاملة الدين (المتبقي)
        const remaining = total - paid;
        if (remaining > 0) {
            DB.addTransaction({ clientId, type: 'add', amount: remaining, note: `فاتورة #${invoice.number}`, products: items });
        }
        if (paid > 0) {
            DB.addTransaction({ clientId, type: 'pay', amount: paid, note: `تسديد فاتورة #${invoice.number}` });
        }

        Utils.toast('تم إنشاء الفاتورة ✅', 'success');
        Utils.closeModal();
        this.renderPage('invoices');
        this.showInvoiceResult(invoice);
    },

    showQuickActions() {
        Utils.openModal(`
            <div class="modal-header">
                <span class="modal-title">إضافة سريعة</span>
                <button class="modal-close" onclick="Utils.closeModal()">✕</button>
            </div>
            <div style="display:flex;flex-direction:column;gap:10px">
                <button class="btn btn-primary" onclick="Utils.closeModal();App.showAddDebtModal()">💰 إضافة دين</button>
                <button class="btn btn-success" onclick="Utils.closeModal();App.showAddProductModal()">📦 إضافة منتج</button>
                <button class="btn btn-warning" onclick="Utils.closeModal();App.showAddInvoiceModal()">🧾 إنشاء فاتورة</button>
            </div>
        `);
    },

    /* =================== النسخ الاحتياطي =================== */

    backupHTML() {
        const data = DB.data;
        return `
            <div class="card">
                <div class="card-header">
                    <span class="card-title">☁️ النسخ الاحتياطي</span>
                </div>
                <div class="alert alert-info">
                    <strong>حالة المزامنة:</strong> ${Auth.firebaseReady
                        ? 'متصل بالسحابة (Firebase) — النسخ الاحتياطي تلقائي'
                        : 'وضع محلي — البيانات محفوظة في المتصفح فقط. اربط Firebase لنسخ احتياطي سحابي تلقائي.'}
                </div>
                <div class="stats-grid" style="grid-template-columns:repeat(3,1fr)">
                    <div class="stat-card"><div class="stat-label">العملاء</div><div class="stat-value">${data.clients.length}</div></div>
                    <div class="stat-card"><div class="stat-label">المنتجات</div><div class="stat-value">${data.products.length}</div></div>
                    <div class="stat-card"><div class="stat-label">العمليات</div><div class="stat-value">${data.transactions.length}</div></div>
                </div>
                <div style="display:flex;flex-direction:column;gap:10px;margin-top:16px">
                    <button class="btn btn-primary" onclick="App.backupDownload()">⬇️ تنزيل نسخة احتياطية (JSON)</button>
                    <label class="btn btn-success" style="cursor:pointer">
                        ⬆️ استيراد نسخة احتياطية
                        <input type="file" id="backupFileInput" accept=".json" style="display:none" onchange="App.backupImport(this.files[0])">
                    </label>
                    <button class="btn btn-danger" onclick="App.resetData()">🗑️ إعادة تعيين كل البيانات</button>
                </div>
            </div>
            <div class="card">
                <div class="card-header">
                    <span class="card-title">🔗 ربط Firebase (اختياري للإصدار الكامل)</span>
                </div>
                <p style="font-size:14px;color:#6b7280;margin-bottom:12px">
                    لتفعيل النسخ الاحتياطي السحابي التلقائي وتسجيل الدخول الحقيقي بجوجل، عدّل ملف <code>js/auth.js</code> وأدخل مفاتيح مشروع Firebase الخاص بك.
                </p>
                <div class="form-group">
                    <label>معرّف المشروع (Project ID)</label>
                    <input type="text" id="fbProjectId" placeholder="your-firebase-project" value="${Auth.firebaseConfig.projectId === 'YOUR_PROJECT_ID' ? '' : Auth.firebaseConfig.projectId}">
                </div>
                <button class="btn btn-primary" onclick="App.connectFirebase()">حفظ الإعدادات والاتصال</button>
            </div>
        `;
    },

    bindBackup() { },

    backupDownload() {
        const data = DB.exportData();
        const filename = `backup-${new Date().toISOString().split('T')[0]}.json`;
        Utils.downloadFile(filename, data);
        Utils.toast('تم تنزيل النسخة الاحتياطية ✅', 'success');
    },

    async backupImport(file) {
        if (!file) return;
        const content = await Utils.readFile(file);
        const res = DB.importData(content);
        if (res.ok) {
            Utils.toast('تم استيراد البيانات ✅', 'success');
            this.renderPage('backup');
        } else {
            Utils.toast('فشل الاستيراد: ' + res.msg, 'error');
        }
    },

    resetData() {
        if (!confirm('⚠️ سيتم حذف جميع البيانات نهائياً. هل أنت متأكد؟')) return;
        DB.reset();
        Utils.toast('تمت إعادة تعيين البيانات', 'success');
        this.renderPage('backup');
    },

    connectFirebase() {
        const projectId = document.getElementById('fbProjectId').value.trim();
        if (!projectId) return Utils.toast('أدخل معرّف المشروع', 'error');
        // ملاحظة: في النسخة الكاملة يُطلب إدخال كامل الإعدادات هنا
        Utils.toast('يرجى إدخال إعدادات Firebase الكاملة في ملف js/auth.js', '');
    },

/* =================== الإعدادات =================== */

    settingsHTML() {
        const s = DB.data.settings;
        const navPos = s.navPosition || 'right';
        return `
            <div class="card">
                <div class="card-header">
                    <span class="card-title">⚙️ إعدادات المتجر</span>
                </div>
                <div class="form-group">
                    <label>اسم المتجر</label>
                    <input type="text" id="setStoreName" value="${s.storeName}">
                </div>
                <div class="form-group">
                    <label>العملة</label>
                    <input type="text" id="setCurrency" value="${s.currency}">
                </div>
                <div class="form-group">
                    <label>رقم الهاتف (للواتساب)</label>
                    <input type="text" id="setPhone" value="${s.phone || ''}" placeholder="09xxxxxxxx">
                </div>
                <div class="form-group">
                    <label>حد التنبيه الأدنى للمخزون</label>
                    <input type="number" id="setLowStock" value="${s.lowStockThreshold}" min="0">
                </div>
                <div class="form-group">
                    <label>نص الضمان (يظهر في الفاتورة)</label>
                    <textarea id="setWarranty" rows="3">${s.warrantyText || ''}</textarea>
                </div>
                <button class="btn btn-primary" onclick="App.saveSettings()">حفظ الإعدادات</button>
            </div>
            <div class="card">
                <div class="card-header">
                    <span class="card-title">📱 موقع القائمة (الثلاث خطوط)</span>
                </div>
                <p style="font-size:13px;color:#64748b;margin-bottom:12px">اختر مكان ظهور زر القائمة وأسلوب فتحها</p>
                <div class="form-group">
                    <label>موقع القائمة الجانبية</label>
                    <select id="setNavPosition" onchange="App.previewNavPosition(this.value)">
                        <option value="right" ${navPos === 'right' ? 'selected' : ''}>على اليمين</option>
                        <option value="left" ${navPos === 'left' ? 'selected' : ''}>على اليسار</option>
                        <option value="bottom" ${navPos === 'bottom' ? 'selected' : ''}>أسفل (ورقة منبثقة)</option>
                        <option value="hidden" ${navPos === 'hidden' ? 'selected' : ''}>مخفية (إظهار الأزرار في الأعلى)</option>
                    </select>
                </div>
                <button class="btn btn-primary" onclick="App.saveNavPosition()">حفظ موقع القائمة</button>
            </div>
            <div class="card">
                <div class="card-header">
                    <span class="card-title">👤 الحساب</span>
                </div>
                <p style="font-size:14px;color:#6b7280">
                    تسجيل الدخول: <strong>${Auth.user?.name || 'ضيف'}</strong> (${Auth.user?.email || 'وضع تجريبي'})
                </p>
            </div>
`;
    },

    bindSettings() { },

    /* ===== موقع القائمة (الثلاث خطوط) ===== */

    applyNavPosition(position) {
        document.body.classList.remove('nav-left', 'nav-bottom');
        const pos = position || DB.data.settings.navPosition || 'right';
        if (pos === 'left') document.body.classList.add('nav-left');
        else if (pos === 'bottom') document.body.classList.add('nav-bottom');
        // hidden: يبقى على اليمين لكن بدون زر القائمة
        const menuBtn = document.getElementById('menuBtn');
        if (pos === 'hidden') {
            if (menuBtn) menuBtn.style.display = 'none';
        } else {
            if (menuBtn) menuBtn.style.display = '';
        }
    },

    previewNavPosition(value) {
        this.applyNavPosition(value);
    },

    saveNavPosition() {
        const value = document.getElementById('setNavPosition').value;
        DB.data.settings.navPosition = value;
        DB.save();
        this.applyNavPosition(value);
        Utils.toast('تم حفظ موقع القائمة ✅', 'success');
        this.renderPage('settings');
    },

saveSettings() {
        const storeName = document.getElementById('setStoreName').value.trim();
        const currency = document.getElementById('setCurrency').value.trim();
        const phone = document.getElementById('setPhone').value.trim();
        const lowStock = parseInt(document.getElementById('setLowStock').value) || 5;
        const warrantyText = document.getElementById('setWarranty').value.trim();

        DB.data.settings = { ...DB.data.settings, storeName, currency, phone, lowStockThreshold: lowStock, warrantyText };
        DB.save();
        Utils.toast('تم حفظ الإعدادات ✅', 'success');
        this.renderPage('settings');
    },

    showAccountModal() {
        const u = Auth.user;
        Utils.openModal(`
            <div class="modal-header">
                <span class="modal-title">👤 الحساب</span>
                <button class="modal-close" onclick="Utils.closeModal()">✕</button>
            </div>
            <div style="text-align:center;padding:20px">
                <div style="font-size:48px;margin-bottom:10px">${u?.photo ? `<img src="${u.photo}" style="width:64px;height:64px;border-radius:50%">` : '👤'}</div>
                <h3>${u?.name || 'الضيف'}</h3>
                <p style="color:#6b7280;font-size:14px">${u?.email || 'وضع تجريبي'}</p>
                <p style="color:#6b7280;font-size:12px;margin-top:8px">${Auth.firebaseReady ? '☁️ متصل بالسحابة' : '🔒 وضع محلي'}</p>
            </div>
            <div class="modal-footer">
                <button class="btn btn-danger" onclick="Utils.closeModal();document.getElementById('logoutBtn').click()">تسجيل الخروج</button>
                <button class="btn btn-primary" onclick="Utils.closeModal()">إغلاق</button>
            </div>
        `);
    }
};

// تهيئة التطبيق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => App.init());
