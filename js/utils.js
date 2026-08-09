/* ============================================================
   utils.js — دوال مساعدة عامة
   ============================================================ */

const Utils = {
    /**
     * توليد معرّف فريد
     */
    uid() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    },

    /**
     * تنسيق التاريخ
     */
    formatDate(ts) {
        if (!ts) return '';
        const d = new Date(ts);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    },

    /**
     * تنسيق المبلغ
     */
    formatMoney(amount, currency = '') {
        const num = Number(amount) || 0;
        return num.toLocaleString('ar-EG') + (currency ? ' ' + currency : '');
    },

    /**
     * تنسيق المبلغ بالأرقام العربية أو الإنجليزية
     */
    formatNumber(n) {
        return (Number(n) || 0).toLocaleString('en-US');
    },

    /**
     * إنشاء رابط واتساب بمحتوى منسّق
     */
    whatsappLink(phone, text) {
        let number = (phone || '').replace(/[^0-9]/g, '');
        if (number && !number.startsWith('00')) {
            // إضافة كود الدولة تلقائياً (افتراضي 963 لسوريا، عدّله حسب الحاجة)
            // number = '963' + number;
        }
        const base = number ? `https://wa.me/${number}` : 'https://wa.me/';
        return `${base}?text=${encodeURIComponent(text)}`;
    },

    /**
     * فتح نافذة مشاركة واتساب
     */
    shareWhatsApp(phone, text) {
        const link = this.whatsappLink(phone, text);
        window.open(link, '_blank');
    },

    /**
     * تنزيل ملف
     */
    downloadFile(filename, content, mime = 'application/json') {
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    /**
     * قراءة ملف
     */
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    },

    /**
     * إظهار إشعار (Toast)
     */
    toast(message, type = '') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = 'toast show ' + type;
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            toast.className = 'toast';
        }, 3000);
    },

    /**
     * فتح نافذة منبثقة (Modal)
     */
    openModal(html) {
        document.getElementById('modalContent').innerHTML = html;
        document.getElementById('modalOverlay').classList.remove('hidden');
    },

    closeModal() {
        document.getElementById('modalOverlay').classList.add('hidden');
        // إيقاف كاميرا الباركود إن كانت مفتوحة
        if (typeof App !== 'undefined' && App.stopBarcodeCamera) {
            App.stopBarcodeCamera();
        }
    },

    /**
     * توليد كشف حساب نصي للواتساب
     */
    generateWhatsAppText(client, transactions) {
        const currency = DB.data.settings.currency;
        let text = `🧾 *كشف حساب* — ${DB.data.settings.storeName}\n`;
        text += `━━━━━━━━━━━\n`;
        text += `👤 العميل: ${client.name}\n`;
        text += `📅 التاريخ: ${Utils.formatDate(Date.now())}\n`;
        text += `━━━━━━━━━━━\n`;
        transactions.slice(0, 10).forEach(t => {
            const date = Utils.formatDate(t.date);
            if (t.type === 'add') {
                text += `➕ ${date}\n   دين: ${Utils.formatMoney(t.amount, currency)}\n`;
            } else if (t.type === 'pay') {
                text += `✅ ${date}\n   تسديد: ${Utils.formatMoney(t.amount, currency)}\n`;
            } else if (t.type === 'edit') {
                text += `✏️ ${date}\n   تعديل: ${t.amount > 0 ? '+' : ''}${Utils.formatMoney(t.amount, currency)}\n`;
            }
            if (t.note) text += `   📝 ${t.note}\n`;
        });
        text += `━━━━━━━━━━━\n`;
        text += `💰 المتبقي: ${Utils.formatMoney(client.totalDebt, currency)}\n`;
        text += `✅ المسدد: ${Utils.formatMoney(client.totalPaid, currency)}\n`;
        text += `━━━━━━━━━━━\n`;
        text += `شكراً لتعاملكم معنا 🌟`;
        return text;
    },

    /**
     * توليد نص فاتورة
     */
    generateInvoiceText(invoice) {
        const currency = DB.data.settings.currency;
        const client = DB.getClient(invoice.clientId);
        let text = `🧾 *فاتورة رقم ${invoice.number}*\n`;
        text += `━━━━━━━━━━━\n`;
        text += `🏪 ${DB.data.settings.storeName}\n`;
        text += `📅 ${Utils.formatDate(invoice.date)}\n`;
        if (client) text += `👤 ${client.name}\n`;
        text += `━━━━━━━━━━━\n`;
        if (invoice.items && invoice.items.length) {
            invoice.items.forEach(item => {
                text += `• ${item.name} x${item.qty} = ${Utils.formatMoney(item.price * item.qty, currency)}\n`;
            });
            text += `━━━━━━━━━━━\n`;
        }
        text += `💰 الإجمالي: ${Utils.formatMoney(invoice.total, currency)}\n`;
        if (invoice.paid > 0) text += `✅ المسدد: ${Utils.formatMoney(invoice.paid, currency)}\n`;
        if (invoice.total - invoice.paid > 0) text += `⚠️ المتبقي: ${Utils.formatMoney(invoice.total - invoice.paid, currency)}\n`;
        text += `━━━━━━━━━━━\n`;
        text += `شكراً لتعاملكم معنا 🌟`;
        return text;
    },

/**
     * بناء HTML فاتورة حديثة (اسم المتجر + اللوكو + التاريخ + النوع + الضمان)
     */
    buildInvoiceHTML(invoice) {
        const settings = DB.data.settings;
        const client = DB.getClient(invoice.clientId);
        const currency = settings.currency;
        const warranty = settings.warrantyText || 'المنتج مضمون ومستبدل خلال 3 أيام من تاريخ الشراء ما لم يظهر أي عيب تصنيع.';
        const phoneText = settings.phone ? `<div class="inv-meta-row"><span class="lbl">للتواصل</span><span class="val">${settings.phone}</span></div>` : '';
        const typeLabel = invoice.type === 'pay' ? 'إيصال تسديد' : invoice.type === 'sell' ? 'فاتورة بيع' : 'فاتورة دين';

        let itemsHTML = '';
        if (invoice.items && invoice.items.length) {
            itemsHTML = `
                <table class="inv-items">
                    <tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr>
                    ${invoice.items.map(item => `
                        <tr>
                            <td>${item.name}</td>
                            <td>${item.qty}</td>
                            <td>${Utils.formatMoney(item.price, currency)}</td>
                            <td>${Utils.formatMoney(item.price * item.qty, currency)}</td>
                        </tr>
                    `).join('')}
                </table>
            `;
        }

        const remaining = invoice.total - invoice.paid;

        return `
            <div class="invoice">
                <div class="inv-top">
                    <div class="inv-logo">🛒</div>
                    <div class="inv-store-name">${settings.storeName}</div>
                    <div class="inv-type">${typeLabel} — رقم ${invoice.number}</div>
                </div>
                <div class="inv-body">
                    <div class="inv-meta">
                        <div class="inv-meta-row"><span class="lbl">التاريخ</span><span class="val">${Utils.formatDate(invoice.date)}</span></div>
                        <div class="inv-meta-row"><span class="lbl">العميل</span><span class="val">${client ? client.name : 'نقدي'}</span></div>
                        ${client && client.phone ? `<div class="inv-meta-row"><span class="lbl">الهاتف</span><span class="val">${client.phone}</span></div>` : ''}
                        ${phoneText}
                    </div>
                    ${itemsHTML}
                    <div class="inv-total-line"><span>الإجمالي</span><span>${Utils.formatMoney(invoice.total, currency)}</span></div>
                    ${invoice.paid > 0 ? `<div class="inv-total-line"><span>المسدد</span><span>${Utils.formatMoney(invoice.paid, currency)}</span></div>` : ''}
                    ${remaining > 0 ? `<div class="inv-total-line remaining"><span>المتبقي</span><span>${Utils.formatMoney(remaining, currency)}</span></div>` : `<div class="inv-total-line grand"><span>المدفوع</span><span>${Utils.formatMoney(invoice.total, currency)}</span></div>`}
                    <div class="inv-warranty">🛡️ الضمان<br>${warranty}</div>
                </div>
                <div class="inv-footer">
                    <div class="thanks">شكراً لتعاملكم معنا 🌟</div>
                    <div>${settings.storeName} — ${phoneText ? '' : 'مع تحيات الإدارة'}</div>
                </div>
            </div>
        `;
    },

    /**
     * طباعة/تصدير PDF لكشف حساب أو فاتورة
     */
    printInvoice(invoice) {
        const printArea = document.getElementById('printArea');
        printArea.innerHTML = this.buildInvoiceHTML(invoice);
        // إتاحة وقت قصير لعرض المحتوى قبل الطباعة
        setTimeout(() => {
            window.print();
            setTimeout(() => {
                printArea.innerHTML = '';
            }, 300);
        }, 100);
    },

    /**
     * تنزيل PDF (عبر html2pdf)
     */
    downloadPDF(invoice, filename = 'invoice.pdf') {
        const printArea = document.getElementById('printArea');
        printArea.innerHTML = this.buildInvoiceHTML(invoice);

        const element = printArea.firstChild;
        const opt = {
            margin: [5, 5, 5, 5],
            filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a5', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save().then(() => {
            printArea.innerHTML = '';
        });
    }
};
