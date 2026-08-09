/* ============================================================
   auth.js — إدارة تسجيل الدخول (Google OAuth + وضع تجريبي)
   بنية جاهزة لربط Firebase حقيقياً لاحقاً.
   ============================================================ */

const Auth = {
    // حالة المستخدم الحالية
    user: null,
    // وضع تجريبي (بدون Firebase)
    demoMode: false,
    // ما إذا كان Firebase مهيئاً
    firebaseReady: false,

// مفاتيح Firebase (مشروع deon-8d7fa)
    firebaseConfig: {
        apiKey: "AIzaSyDNZqM3UOmpp6f9Y5Icf9MdB-4TkbSL5m8",
        authDomain: "deon-8d7fa.firebaseapp.com",
        projectId: "deon-8d7fa",
        storageBucket: "deon-8d7fa.firebasestorage.app",
        messagingSenderId: "615012447479",
        appId: "1:615012447479:web:b9d791fed6f9e9a29d0ff2",
        measurementId: "G-G836C4PQGV"
    },

/**
     * تهيئة المصادقة
     */
    init() {
        // محاولة تهيئة Firebase إذا كانت المكتبات محمّلة
        if (typeof firebase !== 'undefined' && this.firebaseConfig.apiKey !== 'YOUR_API_KEY') {
            try {
                firebase.initializeApp(this.firebaseConfig);
                this.firebaseReady = true;
                // معالجة نتيجة تسجيل الدخول عبر Redirect (عند العودة من جوجل)
                this.handleRedirectResult();
            } catch (e) {
                this.firebaseReady = false;
            }
        }

        // استعادة الجلسة السابقة
        const savedUser = localStorage.getItem('auth_user');
        const demo = localStorage.getItem('auth_demo');
        if (savedUser) {
            try {
                this.user = JSON.parse(savedUser);
                return true;
            } catch (e) {
                this.user = null;
            }
        }
        if (demo === 'true') {
            this.demoMode = true;
            this.user = { name: 'الضيف', email: 'guest@demo.com' };
            return true;
        }
        return false;
    },

    /**
     * معالجة نتيجة تسجيل الدخول بطريقة Redirect (الأكثر موثوقية على GitHub Pages)
     */
    async handleRedirectResult() {
        if (!this.firebaseReady) return;
        try {
            const result = await firebase.auth().getRedirectResult();
            if (result && result.user) {
                const u = result.user;
                this.user = {
                    name: u.displayName,
                    email: u.email,
                    photo: u.photoURL,
                    uid: u.uid
                };
                localStorage.setItem('auth_user', JSON.stringify(this.user));
                localStorage.removeItem('auth_demo');
                this.demoMode = false;
                // إعادة تحميل الواجهة
                if (typeof App !== 'undefined' && App.showApp) App.showApp();
            }
        } catch (e) {
            // تجاهل أخطاء redirect بدون نتيجة
            console.warn('Redirect result:', e.code || e.message);
        }
    },

    /**
     * تسجيل الدخول عبر Google
     * الاستراتيجية: تجربة Popup أولاً، فإن فشلت نستخدم Redirect،
     * وإن تعذر كلاهما نعود للوضع التجريبي.
     */
    async loginWithGoogle() {
        const hint = document.getElementById('loginHint');
        if (this.firebaseReady) {
            const provider = new firebase.auth.GoogleAuthProvider();

            // 1) تجربة النافذة المنبثقة أولاً
            try {
                const result = await firebase.auth().signInWithPopup(provider);
                const u = result.user;
                this.user = {
                    name: u.displayName,
                    email: u.email,
                    photo: u.photoURL,
                    uid: u.uid
                };
                localStorage.setItem('auth_user', JSON.stringify(this.user));
                localStorage.removeItem('auth_demo');
                this.demoMode = false;
                return true;
            } catch (e) {
                // 2) طريقة Popup فشلت (غالباً popup-blocked) — نستخدم Redirect
                // وهي الطريقة الموصى بها على GitHub Pages / المواقع المستضافة
                try {
                    hint.textContent = 'جاري تحويلك لتسجيل الدخول بجوجل...';
                    await firebase.auth().signInWithRedirect(provider);
                    // بعد العودة ستُعالج النتيجة في handleRedirectResult
                    return false; // لا نكمل هنا — سيتم إعادة التوجيه
                } catch (e2) {
                    // 3) Redirect أيضاً فشل — ننتقل للوضع التجريبي
                    const demoMode = await this.loginAsDemo();
                    hint.textContent = 'تعذّر تسجيل الدخول بجوجل هنا. تأكد من إضافة نطاق GitHub Pages في Firebase (Authentication → Settings → Authorized domains). تم الدخول بالوضع التجريبي.';
                    return demoMode;
                }
            }
        } else {
            // Firebase غير مهيأ — ننتقل تلقائياً للوضع التجريبي
            hint.textContent = 'لم يتم ربط Firebase بعد — سيتم الدخول بالوضع التجريبي';
            return this.loginAsDemo();
        }
    },

    /**
     * الدخول كضيف (تجريبي)
     */
    loginAsDemo() {
        this.demoMode = true;
        this.user = { name: 'الضيف', email: 'guest@demo.com' };
        localStorage.setItem('auth_demo', 'true');
        localStorage.removeItem('auth_user');
        return true;
    },

    /**
     * تسجيل الخروج
     */
    async logout() {
        if (this.firebaseReady && !this.demoMode) {
            try {
                await firebase.auth().signOut();
            } catch (e) { /* تجاهل */ }
        }
        this.user = null;
        this.demoMode = false;
        localStorage.removeItem('auth_user');
        localStorage.removeItem('auth_demo');
    },

    /**
     * هل المستخدم مسجل الدخول؟
     */
    isAuthenticated() {
        return !!this.user;
    }
};
