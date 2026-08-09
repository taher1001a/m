/* ============================================================
   firestore.js — ربط قاعدة البيانات السحابية (Firebase Firestore)
   مسؤول عن النسخ الاحتياطي التلقائي والمزامنة مع السحابة.
   يعمل فقط بعد تسجيل الدخول عبر Google.
   ============================================================ */

const Firestore = {
    // هل الاتصال بالسحابة جاهز؟
    enabled: false,
    // معرف المستخدم (email أو uid)
    userKey: null,
    // مؤقت المزامنة التلقائية
    syncTimer: null,
    // حالة المزامنة
    syncing: false,
    // آخر مزامنة
    lastSync: null,

    // مجموعة Firestore لكل مستخدم
    collectionPrefix: 'user_data',

    /**
     * تهيئة المزامنة السحابية
     */
    init() {
        if (typeof firebase === 'undefined' || typeof firebase.firestore === 'undefined') {
            console.warn('Firebase Firestore غير متاح');
            return;
        }
        // تسجيل خطاف الحفظ في db.js
        setSyncHook(data => this.pushToCloud(data));
    },

    /**
     * تفعيل المزامنة بعد تسجيل الدخول
     */
    enable(user) {
        this.userKey = (user && user.email) ? user.email.replace(/[^a-zA-Z0-9]/g, '_') : null;
        if (!this.userKey) return;
        this.enabled = true;
        // بدء المزامنة التلقائية كل 30 ثانية
        if (this.syncTimer) clearInterval(this.syncTimer);
        this.syncTimer = setInterval(() => this.sync(), 30000);
        // مزامنة فورية عند التفعيل
        this.sync();
    },

    /**
     * تعطيل المزامنة عند تسجيل الخروج
     */
    disable() {
        this.enabled = false;
        this.userKey = null;
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }
    },

    /**
     * دفع البيانات إلى السحابة (نسخ احتياطي)
     */
    async pushToCloud(data) {
        if (!this.enabled || !this.userKey || !data) return;
        if (this.syncing) return;
        this.syncing = true;
        try {
            const db = firebase.firestore();
            const docRef = db.collection(this.collectionPrefix).doc(this.userKey);
            // إضافة الطابع الزمني
            const payload = {
                data: JSON.stringify(data),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            await docRef.set(payload, { merge: true });
            this.lastSync = Date.now();
            this.updateSyncStatus('synced');
        } catch (e) {
            console.warn('فشل المزامنة السحابية:', e);
            this.updateSyncStatus('error');
        } finally {
            this.syncing = false;
        }
    },

    /**
     * سحب البيانات من السحابة (استعادة)
     */
    async pullFromCloud() {
        if (!this.enabled || !this.userKey) return null;
        try {
            const db = firebase.firestore();
            const docRef = db.collection(this.collectionPrefix).doc(this.userKey);
            const doc = await docRef.get();
            if (doc.exists) {
                const cloudData = doc.data();
                if (cloudData.data) {
                    return JSON.parse(cloudData.data);
                }
            }
            return null;
        } catch (e) {
            console.warn('فشل سحب البيانات من السحابة:', e);
            return null;
        }
    },

    /**
     * مزامنة كاملة: دفع البيانات المحلية، أو استعادة إن كانت السحابة أحدث
     */
    async sync() {
        if (!this.enabled || !this.userKey) return;
        const cloudData = await this.pullFromCloud();
        if (!cloudData) {
            // لا بيانات في السحابة — ادفع المحلية
            this.pushToCloud(DB.data);
            return;
        }

        // مقارنة الطوابع الزمنية للمزامنة
        const localUpdated = DB.data.updatedAt || 0;
        const cloudUpdated = cloudData.updatedAt || 0;

        if (cloudUpdated > localUpdated) {
            // السحابة أحدث — استرجعها
            DB.data = cloudData;
            DB.save();
            this.updateSyncStatus('restored');
            Utils.toast('تم استعادة البيانات من السحابة', 'success');
            // إعادة رسم الواجهة
            if (typeof App !== 'undefined' && App.render) App.renderCurrent();
        } else {
            // المحلية أحدث — ادفع
            this.pushToCloud(DB.data);
        }
    },

    /**
     * تحديث حالة المزامنة في الواجهة
     */
    updateSyncStatus(status) {
        const btn = document.getElementById('syncStatusBtn');
        if (!btn) return;
        let icon = '☁️';
        if (status === 'synced') icon = '☁️✅';
        else if (status === 'error') icon = '☁️⚠️';
        else if (status === 'restored') icon = '☁️⬇️';
        btn.textContent = icon;
        btn.title = status === 'synced' ? 'تمت المزامنة' : status === 'error' ? 'خطأ في المزامنة' : 'المزامنة جارية';
    },

    /**
     * مزامنة يدوية (زر)
     */
    async manualSync() {
        if (!this.enabled) {
            Utils.toast('سجّل الدخول بحساب Google أولاً', 'error');
            return;
        }
        this.updateSyncStatus('syncing');
        await this.sync();
        Utils.toast('تمت المزامنة بنجاح', 'success');
    },

    /**
     * هل المزامنة مفعّلة؟
     */
    isEnabled() {
        return this.enabled;
    }
};
