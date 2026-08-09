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
     * تسجيل الدخول عبر Google
     */
    async loginWithGoogle() {
        const hint = document.getElementById('loginHint');
        if (this.firebaseReady) {
            try {
                const provider = new firebase.auth.GoogleAuthProvider();
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
                hint.textContent = `فشل تسجيل الدخول: ${e.message}`;
                return false;
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
