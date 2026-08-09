/* ============================================================
   db.js — طبقة قاعدة البيانات (DB Layer)
   حالياً: تخزين محلي (localStorage) ببنية جاهزة لربط Firebase لاحقاً.
   لتوصيل Firebase: استبدل دوال DBAdapter بدوال Firestore.
   ============================================================ */

const DB = {
    // مفتاح التخزين المحلي
    STORAGE_KEY: 'debt_inventory_app_v1',

    // بيانات مؤقتة في الذاكرة
    data: null,

// إعدادات التطبيق
    settings: {
        currency: 'دينار',
        storeName: 'متجري',
        lowStockThreshold: 5,
        phone: '',
        warrantyText: 'المنتج مضمون ومستبدل خلال 3 أيام من تاريخ الشراء ما لم يظهر أي عيب تصنيع.'
    },

    /**
     * تهيئة قاعدة البيانات وقراءة البيانات المحفوظة
     */
    init() {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
            try {
                this.data = JSON.parse(saved);
            } catch (e) {
                this.data = this.defaultData();
            }
        } else {
            this.data = this.defaultData();
        }
        // دمج الإعدادات الافتراضية
        this.data.settings = { ...this.settings, ...this.data.settings };
        this.save();
        return this.data;
    },

    /**
     * بنية البيانات الافتراضية
     */
    defaultData() {
        return {
            settings: { ...this.settings },
            clients: [],      // قائمة العملاء
            products: [],     // قائمة المنتجات
            transactions: [], // كل العمليات (كشف الحساب)
            invoices: []      // الفواتير
        };
    },

    /**
     * حفظ البيانات
     * (عند ربط Firebase لاحقاً: يُستبدل بالحفظ السحابي)
     */
    save() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
        // استدعاء خطاف المزامنة إن وُجد
        if (typeof SyncHook === 'function') {
            SyncHook(this.data);
        }
    },

    /**
     * reset — إعادة تعيين كل البيانات
     */
    reset() {
        this.data = this.defaultData();
        this.save();
    },

    /* =================== عمليات العملاء =================== */

    /**
     * إضافة أو دمج عميل تلقائياً
     * عند وجود عميل بنفس الاسم، يتم الدمج تلقائياً
     */
    addClient(name, phone = '') {
        name = name.trim();
        if (!name) return null;

        // البحث عن عميل بنفس الاسم (دمج تلقائي)
        const existing = this.data.clients.find(c => c.name.toLowerCase() === name.toLowerCase());
        if (existing) {
            if (phone && !existing.phone) existing.phone = phone;
            this.save();
            return { client: existing, merged: true };
        }

        const client = {
            id: Utils.uid(),
            name,
            phone,
            totalDebt: 0,       // إجمالي الدين الحالي
            totalPaid: 0,       // إجمالي المسدد
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        this.data.clients.push(client);
        this.save();
        return { client, merged: false };
    },

    /**
     * جلب عميل بالمعرّف
     */
    getClient(id) {
        return this.data.clients.find(c => c.id === id) || null;
    },

    /**
     * تحديث بيانات عميل
     */
    updateClient(id, updates) {
        const client = this.getClient(id);
        if (!client) return null;
        Object.assign(client, updates, { updatedAt: Date.now() });
        // إعادة حساب الإجمالي لتحديث الدخل
        this.recalcClient(id);
        this.save();
        return client;
    },

    /**
     * حذف عميل
     */
    deleteClient(id) {
        this.data.clients = this.data.clients.filter(c => c.id !== id);
        this.data.transactions = this.data.transactions.filter(t => t.clientId !== id);
        this.data.invoices = this.data.invoices.filter(i => i.clientId !== id);
        this.save();
    },

    /**
     * إعادة حساب إجماليات العميل بناءً على العمليات
     */
    recalcClient(id) {
        const client = this.getClient(id);
        if (!client) return;
        const txs = this.data.transactions.filter(t => t.clientId === id && !t.reverted);
        let totalDebt = 0, totalPaid = 0;
        txs.forEach(t => {
            if (t.type === 'add') totalDebt += t.amount;
            else if (t.type === 'pay') totalPaid += t.amount;
            else if (t.type === 'edit') {
                // تعديل: نطبق الفرق
                totalDebt += t.amount;
            }
        });
        client.totalDebt = totalDebt - totalPaid;
        client.totalPaid = totalPaid;
        client.updatedAt = Date.now();
    },

    /* =================== عمليات المنتجات =================== */

    /**
     * إضافة منتج جديد
     */
    addProduct(product) {
        const p = {
            id: Utils.uid(),
            name: product.name.trim(),
            barcode: (product.barcode || '').trim(),
            price: Number(product.price) || 0,
            cost: Number(product.cost) || 0,
            quantity: Number(product.quantity) || 0,
            minQuantity: Number(product.minQuantity) || 0,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        this.data.products.push(p);
        this.save();
        return p;
    },

    /**
     * البحث عن منتج بالباركود
     */
    findProductByBarcode(barcode) {
        return this.data.products.find(p => p.barcode === barcode) || null;
    },

    /**
     * جلب منتج بالمعرّف
     */
    getProduct(id) {
        return this.data.products.find(p => p.id === id) || null;
    },

    /**
     * تحديث منتج
     */
    updateProduct(id, updates) {
        const p = this.getProduct(id);
        if (!p) return null;
        Object.assign(p, updates, { updatedAt: Date.now() });
        this.save();
        return p;
    },

    /**
     * حذف منتج
     */
    deleteProduct(id) {
        this.data.products = this.data.products.filter(p => p.id !== id);
        this.save();
    },

    /**
     * خصم الكمية من المخزون عند البيع/الدين
     */
    deductStock(productId, qty) {
        const p = this.getProduct(productId);
        if (!p) return { ok: false, msg: 'المنتج غير موجود' };
        if (p.quantity < qty) return { ok: false, msg: `الكمية غير كافية، المتوفر: ${p.quantity}` };
        p.quantity -= qty;
        p.updatedAt = Date.now();
        this.save();
        return { ok: true, product: p };
    },

    /**
     * إعادة الكمية للمخزون (عند التراجع)
     */
    restoreStock(productId, qty) {
        const p = this.getProduct(productId);
        if (!p) return;
        p.quantity += qty;
        p.updatedAt = Date.now();
        this.save();
    },

    /**
     * المنتجات المنخفضة (تحت الحد الأدنى)
     */
    lowStockProducts() {
        const threshold = this.data.settings.lowStockThreshold;
        return this.data.products.filter(p => p.quantity <= (p.minQuantity || threshold));
    },

    /* =================== عمليات المعاملات =================== */

    /**
     * إضافة معاملة (إضافة دين / تسديد / تعديل)
     * type: 'add' | 'pay' | 'edit' | 'payment'
     */
    addTransaction({ clientId, type, amount, note = '', products = [], invoiceId = null }) {
        const tx = {
            id: Utils.uid(),
            clientId,
            type,
            amount: Number(amount) || 0,
            note,
            products: products || [],
            invoiceId,
            date: Date.now()
        };
        this.data.transactions.push(tx);
        this.recalcClient(clientId);
        this.save();
        return tx;
    },

    /**
     * كشف حساب عميل
     */
    getClientTransactions(clientId) {
        return this.data.transactions
            .filter(t => t.clientId === clientId)
            .sort((a, b) => b.date - a.date);
    },

    /**
     * إجمالي الديون المستحقة (كل العملاء)
     */
    totalDebts() {
        return this.data.clients.reduce((sum, c) => sum + c.totalDebt, 0);
    },

    /**
     * إجمالي المبالغ المسددة
     */
    totalPaid() {
        return this.data.clients.reduce((sum, c) => sum + c.totalPaid, 0);
    },

    /* =================== الفواتير =================== */

    /**
     * إنشاء فاتورة
     */
    createInvoice({ clientId, items, total, type = 'debt', paid = 0 }) {
        const inv = {
            id: Utils.uid(),
            number: this.nextInvoiceNumber(),
            clientId,
            items,
            total,
            paid,
            type,
            date: Date.now()
        };
        this.data.invoices.push(inv);
        this.save();
        return inv;
    },

    nextInvoiceNumber() {
        return this.data.invoices.length + 1;
    },

    getInvoice(id) {
        return this.data.invoices.find(i => i.id === id) || null;
    },

    /* =================== النسخ الاحتياطي =================== */

    /**
     * تصدير البيانات إلى JSON
     */
    exportData() {
        return JSON.stringify(this.data, null, 2);
    },

    /**
     * استيراد بيانات من JSON
     */
    importData(json) {
        try {
            const parsed = JSON.parse(json);
            if (!parsed.clients || !parsed.products) throw new Error('صيغة غير صحيحة');
            this.data = parsed;
            this.save();
            return { ok: true };
        } catch (e) {
            return { ok: false, msg: e.message };
        }
    }
};

/* خطاف المزامنة السحابية (يُفعَّل عند ربط Firebase) */
let SyncHook = null;
function setSyncHook(fn) { SyncHook = fn; }
