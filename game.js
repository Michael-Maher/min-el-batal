// ============================================================
// MIN EL BATAL - St. Refka Church Youth Ministry Game
// Part 1: Config, State, Firebase, Music, Themes, Characters,
//         Armor, Levels, Categories, Questions
// ============================================================

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyDZXv7nmtJ5tqSLmvrxQ1F4WuoHmBxttuY",
    authDomain: "min-el-batal.firebaseapp.com",
    projectId: "min-el-batal",
    storageBucket: "min-el-batal.firebasestorage.app",
    messagingSenderId: "743794480493",
    appId: "1:743794480493:web:74c8ef6a444e29f7a4b664",
    measurementId: "G-EEMTQ17879"
};

let firebaseApp = null;
let firebaseDb = null;

// --- Game State ---
const GameState = {
    playerName: '',
    playerPhone: '',
    username: '',
    email: '',
    academicYear: '',
    character: 'david',
    currentLevel: 1,
    stars: 0,
    gems: 0,
    streak: 0,
    bestStreak: 0,
    totalCorrect: 0,
    totalAnswered: 0,
    levelsData: {},
    powerUps: {
        fiftyFifty: 2,
        skip: 1,
        doublePoints: 1,
        freeze: 1,
        hint: 2
    },
    theme: 'dark',
    armor: [],
    equippedArmor: {},
    gamesPlayed: 0,
    perfectLevels: 0,
    missionsCompleted: 0,
    dailyVerseLog: {},
    weeklyChallengeLog: {},
    paulJourneyStation: 1,
    paulJourneyData: {},
    lampData: {
        points: 0,
        streakDays: 0,
        lastActiveDate: '',
        dailyLog: {}
    },
    level2Data: {},
    profileAvatar: null,
    // Spiritual life
    bibleReadingLog: {},   // { '2026-03-26': { chapter: 3, summary: '...', done: true } }
    devotionLog: {},       // { '2026-03-26': { morning: true, night: true } }
    exerciseLog: {},       // { '2026-03-26': { daily: [...], weekly: '...' } }
    bibleChapter: 1,        // Current chapter in Mark (1-16)
    highlightedVerses: {},   // { 'mark_1': [0, 5, 12], ... }
    lessonSummaries: {},      // { 'faith_0': { text: '...', image: '...', date: '...' } }
    watchedVideos: {},        // { 'faith_lesson_0_video': true, ... }
    xp: 0,
    team: '',
    teamLogo: '',
    teamColor: '',
    redeemedRewards: [],
    dailyLoginDate: '',       // last daily login XP date 'YYYY-MM-DD'
    miniGameScores: {},       // { 'faith_0_mg_trueFalse': 15, ... }
    stationScores: {},        // { 'faith_0': { sermon: 10, summary: 10, games: 45, total: 65 } }
    teamLastAction: 0,        // timestamp of last team join/leave action
    dailySpinDate: '',
    dailyBonusSpin: false,
    blitzWeeklyScore: 0,
    blitzWeeklyKey: '',
    bossFoughtDate: '',
    todayVerseSpinDate: '',
    todayVerse: null,
    characterTiers: {},       // { 'david': 'silver', 'philomena': 'gold' }
    equippedFrame: '',        // 'cross', 'dove', 'church'
    ownedFrames: [],
    equippedTitle: '',        // 'bookKeeper', 'gameChamp', etc.
    ownedTitles: [],
    mapTheme: 'default',      // 'default', 'space', 'underwater', 'sky'
    loginStreak: 0,           // consecutive daily login days
    claimedStreakRewards: [], // ['streak7', 'streak14', 'streak30']
    questionHistory: {}       // { 'faith_1': ['q text...', ...] } — last 30 seen per lesson
};

// --- Firebase Initialization ---
function initFirebase() {
    try {
        if (typeof firebase !== 'undefined') {
            firebaseApp = firebase.initializeApp(firebaseConfig);
            firebaseDb = firebase.firestore();
            console.log('Firebase initialized successfully');
        } else {
            console.warn('Firebase SDK not loaded');
        }
    } catch (e) {
        console.error('Firebase init error:', e);
    }
}

// --- Auth UI Switching ---
function showLoginView() {
    document.getElementById('login-view').style.display = '';
    document.getElementById('register-view').style.display = 'none';
}
function showRegisterView() {
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('register-view').style.display = '';
}
function togglePasswordVisibility(fieldId, btn) {
    var field = document.getElementById(fieldId);
    if (!field) return;
    if (field.type === 'password') {
        field.type = 'text';
        btn.innerHTML = '<i class="fas fa-eye-slash"></i>';
    } else {
        field.type = 'password';
        btn.innerHTML = '<i class="fas fa-eye"></i>';
    }
}

// --- Password Hashing (SHA-256) ---
function hashPassword(password) {
    // Simple hash for non-critical auth (church education game)
    var hash = 0;
    for (var i = 0; i < password.length; i++) {
        var c = password.charCodeAt(i);
        hash = ((hash << 5) - hash) + c;
        hash |= 0; // Convert to 32bit integer
    }
    // Double-hash with salt for basic security
    var salted = 'minElBatal_' + password + '_' + hash;
    var hash2 = 0;
    for (var j = 0; j < salted.length; j++) {
        var c2 = salted.charCodeAt(j);
        hash2 = ((hash2 << 5) - hash2) + c2;
        hash2 |= 0;
    }
    return 'h_' + Math.abs(hash).toString(36) + '_' + Math.abs(hash2).toString(36);
}

// --- Login ---
function submitLogin() {
    var usernameOrEmail = document.getElementById('login-username').value.trim().toLowerCase();
    var password = document.getElementById('login-password').value;
    var rememberMe = document.getElementById('remember-me').checked;

    if (!usernameOrEmail) { showToast('اكتب اسم المستخدم أو الإيميل', 'error'); return; }
    if (!password) { showToast('اكتب كلمة السر', 'error'); return; }

    var btn = document.getElementById('btn-login');
    btn.disabled = true;
    btn.innerHTML = '<span><i class="fas fa-spinner fa-spin"></i> جاري الدخول...</span>';

    if (!firebaseDb) {
        showToast('مفيش اتصال بالسيرفر، حاول تاني', 'error');
        resetLoginBtn(btn);
        return;
    }

    var hashedPw = hashPassword(password);

    // Determine if input is email or username
    var fieldName = usernameOrEmail.indexOf('@') >= 0 ? 'email' : 'username';

    // Try login by username or email
    firebaseDb.collection('players').where(fieldName, '==', usernameOrEmail).get()
        .then(function(snapshot) {
            // Fallback: if not found and looks like a phone number, try phone-based lookup
            if (snapshot.empty && /^01\d{9}$/.test(usernameOrEmail)) {
                return firebaseDb.collection('players').doc(usernameOrEmail).get()
                    .then(function(doc) {
                        if (!doc.exists) return null;
                        return { docs: [doc], _phoneDoc: true };
                    });
            }
            return snapshot;
        })
        .then(function(snapshot) {
            if (!snapshot || (snapshot.docs ? snapshot.docs.length === 0 : !snapshot.exists)) {
                showToast('المعلومات دي مش مسجلة', 'error');
                resetLoginBtn(btn);
                return;
            }

            var doc = snapshot.docs ? snapshot.docs[0] : snapshot;
            var existingData = doc.data ? doc.data() : doc;

            // Old account with no password — show upgrade form directly
            if (!existingData.passwordHash) {
                resetLoginBtn(btn);
                var docId = doc.id || (snapshot._phoneDoc ? usernameOrEmail : doc.ref ? doc.ref.id : usernameOrEmail);
                showOldAccountUpgrade(existingData, docId);
                return;
            }

            // Check password
            if (existingData.passwordHash !== hashedPw) {
                showToast('كلمة السر غلط', 'error');
                resetLoginBtn(btn);
                return;
            }

            // Login success — load all data
            Object.keys(existingData).forEach(function(key) {
                if (key in GameState && key !== 'lastUpdated') {
                    GameState[key] = existingData[key];
                }
            });
            GameState.username = existingData.username || '';
            GameState.email = existingData.email || '';

            // Merge localStorage scores (in case cloud save didn't complete last session)
            var localBackup = {};
            try {
                var saved = localStorage.getItem('minElBatal_gameState');
                if (saved) localBackup = JSON.parse(saved);
            } catch(e) {}
            // Merge score objects keeping max values
            ['stationScores', 'miniGameScores'].forEach(function(scoreKey) {
                var cloudObj = GameState[scoreKey] || {};
                var localObj = localBackup[scoreKey] || {};
                var merged = {};
                var allKeys = Object.keys(cloudObj).concat(Object.keys(localObj));
                allKeys.forEach(function(k) {
                    if (scoreKey === 'stationScores') {
                        var c = cloudObj[k] || { sermon: 0, summary: 0, games: 0, total: 0 };
                        var l = localObj[k] || { sermon: 0, summary: 0, games: 0, total: 0 };
                        merged[k] = {
                            sermon: Math.max(c.sermon || 0, l.sermon || 0),
                            summary: Math.max(c.summary || 0, l.summary || 0),
                            games: Math.max(c.games || 0, l.games || 0),
                            total: 0
                        };
                        merged[k].total = Math.min(merged[k].sermon + merged[k].summary + merged[k].games, 80);
                    } else {
                        merged[k] = Math.max(cloudObj[k] || 0, localObj[k] || 0);
                    }
                });
                GameState[scoreKey] = merged;
            });
            // Merge numeric stats
            ['stars', 'gems', 'totalCorrect', 'totalAnswered', 'bestStreak', 'gamesPlayed', 'xp'].forEach(function(k) {
                GameState[k] = Math.max(GameState[k] || 0, localBackup[k] || 0);
            });
            // Merge object maps (watchedVideos, lessonSummaries)
            ['watchedVideos', 'lessonSummaries'].forEach(function(k) {
                var cloudMap = GameState[k] || {};
                var localMap = localBackup[k] || {};
                GameState[k] = Object.assign({}, localMap, cloudMap);
            });
            // Team: use local if local has a more recent team action (teamLastAction timestamp)
            var localTeamTime = localBackup.teamLastAction || 0;
            var cloudTeamTime = existingData.teamLastAction || 0;
            if (localTeamTime > cloudTeamTime) {
                GameState.team = localBackup.team || '';
                GameState.teamLogo = localBackup.teamLogo || '';
                GameState.teamColor = localBackup.teamColor || '';
            }

            console.log('Login merged scores:', JSON.stringify(GameState.stationScores));
            handleRememberMe(rememberMe, GameState.playerPhone);
            showToast('أهلاً بيك يا ' + GameState.playerName.split(' ')[0] + '!', 'success');
            showScreen('home-hub-screen');
            syncLeaderboard();
            requestNotificationsAfterLogin();
            checkPendingRoomJoin();
        })
        .catch(function(err) {
            console.error('Login error:', err);
            showToast('حصل مشكلة، حاول تاني', 'error');
            resetLoginBtn(btn);
        });
}

function resetLoginBtn(btn) {
    if (!btn) btn = document.getElementById('btn-login');
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>دخول <i class="fas fa-arrow-left"></i></span>';
    }
}

// --- Registration ---
function submitRegister() {
    var name = document.getElementById('player-name').value.trim();
    var username = document.getElementById('player-username').value.trim().toLowerCase();
    var email = document.getElementById('player-email').value.trim().toLowerCase();
    var phone = document.getElementById('player-phone').value.trim();
    var year = document.getElementById('player-year').value;
    var password = document.getElementById('player-password').value;
    var passwordConfirm = document.getElementById('player-password-confirm').value;

    // Validate inputs
    var nameParts = name.split(/\s+/).filter(function(p) { return p.length > 0; });
    if (nameParts.length < 3) { showToast('اكتب الاسم الثلاثي (٣ كلمات)', 'error'); return; }
    if (!username || username.length < 3) { showToast('اسم المستخدم لازم ٣ حروف على الأقل', 'error'); return; }
    if (!/^[a-z0-9_.-]+$/.test(username)) { showToast('اسم المستخدم بالإنجليزي بس (حروف، أرقام، _ أو .)', 'error'); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('اكتب إيميل صحيح', 'error'); return; }
    if (!phone || !/^01\d{9}$/.test(phone)) { showToast('اكتب رقم تليفون صحيح (01xxxxxxxxx)', 'error'); return; }
    if (!year) { showToast('اختار السنة الدراسية', 'error'); return; }
    if (!password || password.length < 6) { showToast('كلمة السر لازم ٦ حروف على الأقل', 'error'); return; }
    if (password !== passwordConfirm) { showToast('كلمة السر مش متطابقة', 'error'); return; }

    var btn = document.getElementById('btn-register');
    btn.disabled = true;
    btn.innerHTML = '<span><i class="fas fa-spinner fa-spin"></i> جاري التسجيل...</span>';

    if (!firebaseDb) {
        showToast('مفيش اتصال بالسيرفر، حاول تاني', 'error');
        resetRegisterBtn(btn);
        return;
    }

    var hashedPw = hashPassword(password);

    // Check uniqueness: username, email, phone
    Promise.all([
        firebaseDb.collection('players').where('username', '==', username).get(),
        firebaseDb.collection('players').where('email', '==', email).get(),
        firebaseDb.collection('players').where('playerPhone', '==', phone).get()
    ]).then(function(results) {
        if (!results[0].empty) {
            showToast('اسم المستخدم ده مستخدم قبل كده', 'error');
            resetRegisterBtn(btn);
            return;
        }
        if (!results[1].empty) {
            showToast('الإيميل ده مسجل قبل كده', 'error');
            resetRegisterBtn(btn);
            return;
        }
        if (!results[2].empty) {
            var existingPhoneDoc = results[2].docs[0];
            var existingPhoneData = existingPhoneDoc.data();
            // Legacy account (no password) — migrate it with the data from registration form
            if (!existingPhoneData.passwordHash) {
                migrateOldAccount(existingPhoneDoc.id, {
                    name: name, username: username, email: email,
                    phone: phone, year: year, hashedPw: hashedPw
                }, btn);
                return;
            }
            showToast('رقم التليفون ده مسجل قبل كده', 'error');
            resetRegisterBtn(btn);
            return;
        }

        // All unique — create new account
        GameState.playerName = name;
        GameState.playerPhone = phone;
        GameState.academicYear = year;
        GameState.username = username;
        GameState.email = email;

        // Save with password hash
        var saveData = {};
        Object.keys(GameState).forEach(function(key) {
            saveData[key] = GameState[key];
        });
        saveData.passwordHash = hashedPw;
        saveData.username = username;
        saveData.email = email;
        saveData.createdAt = new Date().toISOString();
        saveData.lastUpdated = new Date().toISOString();

        firebaseDb.collection('players').doc(phone).set(saveData)
            .then(function() {
                handleRememberMe(true, phone);
                showToast('تم التسجيل بنجاح! 🎉', 'success');
                showScreen('character-screen');
                requestNotificationsAfterLogin();
            })
            .catch(function(err) {
                console.error('Registration save error:', err);
                showToast('حصل مشكلة، حاول تاني', 'error');
                resetRegisterBtn(btn);
            });
    }).catch(function(err) {
        console.error('Registration check error:', err);
        showToast('حصل مشكلة، حاول تاني', 'error');
        resetRegisterBtn(btn);
    });
}

function resetRegisterBtn(btn) {
    if (!btn) btn = document.getElementById('btn-register');
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>سجّل حساب جديد <i class="fas fa-user-plus"></i></span>';
    }
}

// Migrate old account (phone-only, no password) to new system
function migrateOldAccount(docId, newData, btn) {
    var docRef = firebaseDb.collection('players').doc(docId);
    docRef.update({
        playerName: newData.name,
        username: newData.username,
        email: newData.email,
        academicYear: newData.year,
        passwordHash: newData.hashedPw,
        playerPhone: newData.phone,
        migratedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
    }).then(function() {
        // Load all old data into GameState
        return docRef.get();
    }).then(function(doc) {
        var data = doc.data();
        Object.keys(data).forEach(function(key) {
            if (key in GameState && key !== 'lastUpdated') GameState[key] = data[key];
        });
        GameState.playerPhone = newData.phone;
        GameState.username = newData.username;
        GameState.email = newData.email;
        handleRememberMe(true, newData.phone);
        showToast('تم تفعيل حسابك القديم! 🎉 أهلاً بيك تاني ' + GameState.playerName.split(' ')[0], 'success');
        showScreen('home-hub-screen');
        syncLeaderboard();
        requestNotificationsAfterLogin();
    }).catch(function(err) {
        console.error('Migration error:', err);
        showToast('حصل مشكلة، حاول تاني', 'error');
        resetRegisterBtn(btn);
    });
}

// Show upgrade form for old accounts (phone-only, no password)
function showOldAccountUpgrade(existingData, docId) {
    var oldName = existingData.playerName || '';
    var oldPhone = existingData.playerPhone || docId || '';

    // Replace login/register view with upgrade form
    var loginView = document.getElementById('login-view');
    var registerView = document.getElementById('register-view');
    if (loginView) loginView.style.display = 'none';
    if (registerView) registerView.style.display = 'none';

    // Create upgrade overlay
    var existing = document.getElementById('upgrade-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'upgrade-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;direction:rtl;font-family:Cairo,sans-serif;';

    overlay.innerHTML = '<div style="background:var(--bg-card,#1a2040);border-radius:24px;padding:28px 20px;max-width:400px;width:100%;text-align:center;border:1px solid rgba(255,255,255,0.1)">' +
        '<div style="font-size:48px;margin-bottom:8px">👋</div>' +
        '<h2 style="color:#fff;font-size:20px;margin:0 0 4px">أهلاً بيك تاني يا ' + (oldName.split(' ')[0] || 'بطل') + '!</h2>' +
        '<p style="color:rgba(255,255,255,0.5);font-size:13px;margin:0 0 16px">لقيناك حسابك القديم 🎉<br>كمّل البيانات دي وهتدخل فوراً</p>' +

        '<div style="text-align:right;margin-bottom:8px">' +
        '<label style="color:rgba(255,255,255,0.6);font-size:12px;display:block;margin-bottom:4px">اسم المستخدم (بالإنجليزي)</label>' +
        '<input type="text" id="upgrade-username" placeholder="مثال: michael_2025" style="width:100%;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#fff;font-family:Cairo;font-size:14px;direction:ltr;text-align:left" autocomplete="username">' +
        '</div>' +

        '<div style="text-align:right;margin-bottom:8px">' +
        '<label style="color:rgba(255,255,255,0.6);font-size:12px;display:block;margin-bottom:4px">الإيميل</label>' +
        '<input type="email" id="upgrade-email" placeholder="email@example.com" style="width:100%;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#fff;font-family:Cairo;font-size:14px;direction:ltr;text-align:left" autocomplete="email">' +
        '</div>' +

        '<div style="text-align:right;margin-bottom:8px">' +
        '<label style="color:rgba(255,255,255,0.6);font-size:12px;display:block;margin-bottom:4px">كلمة السر الجديدة (٦ حروف على الأقل)</label>' +
        '<input type="password" id="upgrade-password" placeholder="كلمة السر" style="width:100%;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#fff;font-family:Cairo;font-size:14px" autocomplete="new-password">' +
        '</div>' +

        '<div style="text-align:right;margin-bottom:16px">' +
        '<label style="color:rgba(255,255,255,0.6);font-size:12px;display:block;margin-bottom:4px">السنة الدراسية</label>' +
        '<select id="upgrade-year" style="width:100%;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#fff;font-family:Cairo;font-size:14px">' +
        '<option value="">اختار السنة</option>' +
        '<option value="prep1">أولى إعدادي</option>' +
        '<option value="prep2">تانية إعدادي</option>' +
        '<option value="prep3">تالتة إعدادي</option>' +
        '</select>' +
        '</div>' +

        '<button id="upgrade-btn" onclick="submitOldAccountUpgrade(\'' + docId.replace(/'/g, "\\'") + '\', \'' + oldPhone.replace(/'/g, "\\'") + '\')" style="width:100%;padding:14px;border-radius:14px;border:none;background:linear-gradient(135deg,#6C5CE7,#a29bfe);color:#fff;font-family:Cairo;font-size:16px;font-weight:800;cursor:pointer">' +
        '<i class="fas fa-rocket"></i> فعّل حسابك</button>' +

        '<button onclick="closeUpgradeOverlay()" style="background:none;border:none;color:rgba(255,255,255,0.4);font-family:Cairo;font-size:13px;cursor:pointer;margin-top:12px;display:block;width:100%">إلغاء</button>' +
        '</div>';

    document.body.appendChild(overlay);
}

function closeUpgradeOverlay() {
    var ov = document.getElementById('upgrade-overlay');
    if (ov) ov.remove();
    showLoginView();
}

function submitOldAccountUpgrade(docId, phone) {
    var username = document.getElementById('upgrade-username').value.trim().toLowerCase();
    var email = document.getElementById('upgrade-email').value.trim().toLowerCase();
    var password = document.getElementById('upgrade-password').value;
    var year = document.getElementById('upgrade-year').value;

    if (!username || username.length < 3) { showToast('اسم المستخدم لازم ٣ حروف على الأقل', 'error'); return; }
    if (!/^[a-z0-9_.-]+$/.test(username)) { showToast('اسم المستخدم بالإنجليزي بس', 'error'); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('اكتب إيميل صحيح', 'error'); return; }
    if (!password || password.length < 6) { showToast('كلمة السر لازم ٦ حروف على الأقل', 'error'); return; }
    if (!year) { showToast('اختار السنة الدراسية', 'error'); return; }

    var btn = document.getElementById('upgrade-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التفعيل...'; }

    var hashedPw = hashPassword(password);

    // Check uniqueness of username and email
    Promise.all([
        firebaseDb.collection('players').where('username', '==', username).get(),
        firebaseDb.collection('players').where('email', '==', email).get()
    ]).then(function(results) {
        if (!results[0].empty) {
            showToast('اسم المستخدم ده مستخدم قبل كده', 'error');
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-rocket"></i> فعّل حسابك'; }
            return;
        }
        if (!results[1].empty) {
            showToast('الإيميل ده مسجل قبل كده', 'error');
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-rocket"></i> فعّل حسابك'; }
            return;
        }

        // Migrate
        var docRef = firebaseDb.collection('players').doc(docId);
        docRef.update({
            username: username,
            email: email,
            academicYear: year,
            passwordHash: hashedPw,
            migratedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
        }).then(function() {
            return docRef.get();
        }).then(function(doc) {
            var data = doc.data();
            Object.keys(data).forEach(function(key) {
                if (key in GameState && key !== 'lastUpdated') GameState[key] = data[key];
            });
            GameState.username = username;
            GameState.email = email;
            GameState.playerPhone = phone;
            handleRememberMe(true, phone);
            closeUpgradeOverlay();
            showToast('تم تفعيل حسابك! 🎉 أهلاً بيك تاني يا ' + GameState.playerName.split(' ')[0], 'success');
            showScreen('home-hub-screen');
            syncLeaderboard();
            requestNotificationsAfterLogin();
        }).catch(function(err) {
            console.error('Upgrade error:', err);
            showToast('حصل مشكلة، حاول تاني', 'error');
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-rocket"></i> فعّل حسابك'; }
        });
    }).catch(function(err) {
        console.error('Upgrade check error:', err);
        showToast('حصل مشكلة، حاول تاني', 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-rocket"></i> فعّل حسابك'; }
    });
}

function handleRememberMe(rememberMe, phone) {
    if (rememberMe) {
        try { localStorage.setItem('minElBatal_remember', phone); } catch(e) {}
    } else {
        try { localStorage.removeItem('minElBatal_remember'); } catch(e) {}
    }
}

function saveToCloud() {
    if (!firebaseDb || !GameState.playerPhone) return Promise.resolve();
    const docRef = firebaseDb.collection('players').doc(GameState.playerPhone);
    const data = {
        playerName: GameState.playerName,
        playerPhone: GameState.playerPhone,
        username: GameState.username || '',
        email: GameState.email || '',
        academicYear: GameState.academicYear,
        character: GameState.character,
        currentLevel: GameState.currentLevel,
        stars: GameState.stars,
        gems: GameState.gems,
        streak: GameState.streak,
        bestStreak: GameState.bestStreak,
        totalCorrect: GameState.totalCorrect,
        totalAnswered: GameState.totalAnswered,
        levelsData: GameState.levelsData,
        powerUps: GameState.powerUps,
        theme: GameState.theme,
        armor: GameState.armor,
        equippedArmor: GameState.equippedArmor,
        gamesPlayed: GameState.gamesPlayed,
        perfectLevels: GameState.perfectLevels,
        missionsCompleted: GameState.missionsCompleted,
        dailyVerseLog: GameState.dailyVerseLog,
        weeklyChallengeLog: GameState.weeklyChallengeLog,
        paulJourneyStation: GameState.paulJourneyStation,
        paulJourneyData: GameState.paulJourneyData,
        lampData: GameState.lampData,
        level2Data: GameState.level2Data || {},
        profileAvatar: GameState.profileAvatar || null,
        bibleReadingLog: GameState.bibleReadingLog || {},
        devotionLog: GameState.devotionLog || {},
        exerciseLog: GameState.exerciseLog || {},
        bibleChapter: GameState.bibleChapter || 1,
        highlightedVerses: GameState.highlightedVerses || {},
        lessonSummaries: GameState.lessonSummaries || {},
        watchedVideos: GameState.watchedVideos || {},
        xp: GameState.xp || 0,
        team: GameState.team || '',
        teamLogo: GameState.teamLogo || '',
        teamColor: GameState.teamColor || '',
        redeemedRewards: GameState.redeemedRewards || [],
        dailyLoginDate: GameState.dailyLoginDate || '',
        miniGameScores: GameState.miniGameScores || {},
        stationScores: GameState.stationScores || {},
        teamLastAction: GameState.teamLastAction || 0,
        dailySpinDate: GameState.dailySpinDate || '',
        dailyBonusSpin: GameState.dailyBonusSpin || false,
        blitzWeeklyScore: GameState.blitzWeeklyScore || 0,
        blitzWeeklyKey: GameState.blitzWeeklyKey || '',
        bossFoughtDate: GameState.bossFoughtDate || '',
        todayVerseSpinDate: GameState.todayVerseSpinDate || '',
        todayVerse: GameState.todayVerse || null,
        characterTiers: GameState.characterTiers || {},
        equippedFrame: GameState.equippedFrame || '',
        ownedFrames: GameState.ownedFrames || [],
        equippedTitle: GameState.equippedTitle || '',
        ownedTitles: GameState.ownedTitles || [],
        mapTheme: GameState.mapTheme || 'default',
        loginStreak: GameState.loginStreak || 0,
        claimedStreakRewards: GameState.claimedStreakRewards || [],
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    };
    // Safety: trim old media if doc is approaching 1MB Firestore limit
    try {
        var docSize = new Blob([JSON.stringify(data)]).size;
        if (docSize > 900000) {
            console.warn('Doc approaching 1MB limit:', docSize, 'bytes. Trimming old media...');
            var vKeys = Object.keys(data.dailyVerseLog || {}).sort();
            for (var ti = 0; ti < vKeys.length && new Blob([JSON.stringify(data)]).size > 800000; ti++) {
                if (data.dailyVerseLog[vKeys[ti]] && data.dailyVerseLog[vKeys[ti]].mediaDataURLs) {
                    data.dailyVerseLog[vKeys[ti]].mediaDataURLs = [];
                }
            }
            var cKeys = Object.keys(data.weeklyChallengeLog || {}).sort();
            for (var ci = 0; ci < cKeys.length && new Blob([JSON.stringify(data)]).size > 800000; ci++) {
                if (data.weeklyChallengeLog[cKeys[ci]] && data.weeklyChallengeLog[cKeys[ci]].mediaDataURLs) {
                    data.weeklyChallengeLog[cKeys[ci]].mediaDataURLs = [];
                }
            }
        }
    } catch(e) { console.warn('Size check error:', e); }

    return docRef.set(data, { merge: true })
        .then(() => console.log('Game saved to cloud'))
        .catch(err => console.error('Cloud save error:', err));
}

function loadFromCloud(phone) {
    if (!firebaseDb || !phone) return Promise.resolve(null);
    const docRef = firebaseDb.collection('players').doc(phone);
    return docRef.get()
        .then(doc => {
            if (doc.exists) {
                const data = doc.data();
                // Load localStorage first to get any unsaved local data
                var localBackup = {};
                try {
                    var saved = localStorage.getItem('minElBatal_gameState');
                    if (saved) localBackup = JSON.parse(saved);
                } catch(e) {}

                Object.keys(data).forEach(key => {
                    if (key in GameState && key !== 'lastUpdated') {
                        // For score objects, merge keeping max values
                        if (key === 'stationScores' || key === 'miniGameScores') {
                            var cloudObj = data[key] || {};
                            var localObj = localBackup[key] || GameState[key] || {};
                            var merged = {};
                            // Merge all keys from both sources
                            var allKeys = Object.keys(cloudObj).concat(Object.keys(localObj));
                            allKeys.forEach(function(k) {
                                if (key === 'stationScores') {
                                    var c = cloudObj[k] || { sermon: 0, summary: 0, games: 0, total: 0 };
                                    var l = localObj[k] || { sermon: 0, summary: 0, games: 0, total: 0 };
                                    merged[k] = {
                                        sermon: Math.max(c.sermon || 0, l.sermon || 0),
                                        summary: Math.max(c.summary || 0, l.summary || 0),
                                        games: Math.max(c.games || 0, l.games || 0),
                                        total: 0
                                    };
                                    merged[k].total = Math.min(merged[k].sermon + merged[k].summary + merged[k].games, 80);
                                } else {
                                    merged[k] = Math.max(cloudObj[k] || 0, localObj[k] || 0);
                                }
                            });
                            GameState[key] = merged;
                        } else if (key === 'stars' || key === 'gems' || key === 'totalCorrect' || key === 'totalAnswered' || key === 'bestStreak' || key === 'gamesPlayed') {
                            // For numeric scores, take max of cloud and local
                            GameState[key] = Math.max(data[key] || 0, localBackup[key] || GameState[key] || 0);
                        } else if (key === 'lessonSummaries' || key === 'watchedVideos') {
                            // For object maps, merge (keep all entries from both)
                            var cloudMap = data[key] || {};
                            var localMap = localBackup[key] || GameState[key] || {};
                            GameState[key] = Object.assign({}, localMap, cloudMap);
                        } else {
                            GameState[key] = data[key];
                        }
                    }
                });
                console.log('Game loaded from cloud for', phone, 'stationScores:', JSON.stringify(GameState.stationScores));
                // Re-save merged data locally (don't trigger cloud save back)
                saveToLocalStorage(true);
                return data;
            } else {
                console.log('No cloud save found for', phone);
                return null;
            }
        })
        .catch(err => {
            console.error('Cloud load error:', err);
            return null;
        });
}

function syncLeaderboard() {
    if (!firebaseDb || !GameState.playerPhone) return Promise.resolve();
    const docRef = firebaseDb.collection('leaderboard').doc(GameState.playerPhone);
    const entry = {
        playerName: GameState.playerName,
        playerPhone: GameState.playerPhone,
        academicYear: GameState.academicYear,
        character: GameState.character,
        stars: GameState.stars,
        gems: GameState.gems,
        currentLevel: GameState.currentLevel,
        totalCorrect: GameState.totalCorrect,
        totalAnswered: GameState.totalAnswered,
        bestStreak: GameState.bestStreak,
        perfectLevels: GameState.perfectLevels,
        gamesPlayed: GameState.gamesPlayed,
        xp: GameState.xp || 0,
        team: GameState.team || '',
        stationScores: GameState.stationScores || {},
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    };
    return docRef.set(entry, { merge: true })
        .then(() => console.log('Leaderboard synced'))
        .catch(err => console.error('Leaderboard sync error:', err));
}

function loadLeaderboardFromCloud() {
    if (!firebaseDb) return Promise.resolve([]);
    return firebaseDb.collection('leaderboard')
        .orderBy('stars', 'desc')
        .limit(50)
        .get()
        .then(snapshot => {
            const players = [];
            snapshot.forEach(doc => {
                players.push(doc.data());
            });
            console.log('Leaderboard loaded:', players.length, 'players');
            return players;
        })
        .catch(err => {
            console.error('Leaderboard load error:', err);
            return [];
        });
}

// --- Music (disabled) ---

// --- Theme System ---
function setTheme(theme) {
    GameState.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    try { localStorage.setItem('minElBatal_theme', theme); } catch(e) {}
    document.querySelectorAll('.theme-card').forEach(function(card) {
        card.classList.remove('active');
        if (card.getAttribute('data-theme') === theme) card.classList.add('active');
    });
    saveGame();
}

// --- Character Definitions ---
const CHARACTERS = {
    david: {
        name: 'داود النبي',
        emoji: '🎵',
        color: '#E8A838',
        image: 'images/david-opt.jpg',
        role: 'المرنم الشجاع صاحب المقلاع',
        ability: 'ضربة المقلاع - قوة مضاعفة',
        unlocked: true,
        power: { id: 'sling', name: 'ضربة المقلاع 🪨', desc: 'نقاط مضاعفة للسؤال الجاي', costType: 'stars', cost: 15, icon: '🪨' }
    },
    philomena: {
        name: 'فيلومينا الأمينة',
        emoji: '⚓',
        color: '#F5A0B8',
        image: 'images/philomena-opt.jpg',
        role: 'القديسة الأمينة حتى الموت',
        ability: 'إيمان ثابت - حماية من الخطأ',
        unlocked: true,
        power: { id: 'shield', name: 'درع الإيمان 🛡️', desc: 'حماية من إجابة غلط واحدة', costType: 'stars', cost: 20, icon: '🛡️' }
    },
    paul: {
        name: 'بولس الرسول',
        emoji: '✉️',
        color: '#7B5EA7',
        image: 'images/paul-opt.jpg',
        role: 'رسول الأمم وكاتب الرسائل',
        ability: 'سيف الروح - كشف الإجابة',
        cost: 30,
        unlocked: false,
        power: { id: 'sword', name: 'سيف الروح ⚔️', desc: 'شيل إجابتين غلط', costType: 'gems', cost: 5, icon: '⚔️' }
    },
    george: {
        name: 'مارجرجس الروماني',
        emoji: '🐴',
        color: '#D4461A',
        image: 'images/george-opt.jpg',
        role: 'الشهيد الشجاع قاتل التنين',
        ability: 'رمح النصر - نقاط إضافية',
        cost: 50,
        unlocked: false,
        power: { id: 'spear', name: 'رمح النصر 🗡️', desc: '+5 نقاط إضافية فوري', costType: 'gems', cost: 8, icon: '🗡️' }
    },
    athanasius: {
        name: 'أثناسيوس الرسول',
        emoji: '📖',
        color: '#1B4F8A',
        image: 'images/athanasius.png',
        role: 'حامي الإيمان الأرثوذكسي',
        ability: 'نور الحق - يكشف الإجابة الصحيحة',
        cost: 100,
        unlocked: false,
        power: { id: 'reveal', name: 'نور الحق 📖', desc: 'يكشف الإجابة الصحيحة للسؤال الحالي', costType: 'gems', cost: 10, icon: '📖' }
    },
    esther: {
        name: 'استير الملكة',
        emoji: '👑',
        color: '#8B3A8C',
        image: 'images/ester-queen.png',
        role: 'رمز الحكمة والنعمة الإلهية',
        ability: 'نعمة الملكة - تمنح وقتاً إضافياً',
        cost: 120,
        unlocked: false,
        power: { id: 'grace', name: 'نعمة الملكة 👑', desc: '+15 ثانية إضافية في الوقت', costType: 'gems', cost: 9, icon: '👑' }
    },
    verina: {
        name: 'القديسة فيرينا',
        emoji: '💧',
        color: '#2E86AB',
        image: 'images/verina.png',
        role: 'قديسة الشفاء والرحمة',
        ability: 'نبع البركة - نجوم إضافية فورية',
        cost: 90,
        unlocked: false,
        power: { id: 'blessing', name: 'نبع البركة 💧', desc: '+30 نجمة هدية فورية', costType: 'gems', cost: 8, icon: '💧' }
    }
};

// --- Character Power System ---
var activePowers = { doublePoints: false, shield: false };

function useCharacterPower() {
    var ch = CHARACTERS[GameState.character];
    if (!ch || !ch.power) { showToast('اختار شخصية الأول!', 'error'); return; }
    var power = ch.power;

    // Check cost
    if (power.costType === 'stars') {
        if (GameState.stars < power.cost) {
            showToast('محتاج ' + power.cost + ' ⭐ لتشغيل ' + power.name, 'error');
            return;
        }
        GameState.stars -= power.cost;
    } else {
        if ((GameState.gems || 0) < power.cost) {
            showToast('محتاج ' + power.cost + ' 💎 لتشغيل ' + power.name, 'error');
            return;
        }
        GameState.gems -= power.cost;
    }

    // Activate power based on type
    if (power.id === 'sling') {
        activePowers.doublePoints = true;
        showAchievement('🪨', 'ضربة المقلاع!', 'النقاط مضاعفة للسؤال الجاي!');
    } else if (power.id === 'shield') {
        activePowers.shield = true;
        showAchievement('🛡️', 'درع الإيمان!', 'محمي من إجابة غلط واحدة!');
    } else if (power.id === 'sword') {
        // Eliminate 2 wrong options
        activateSwordOfSpirit();
        showAchievement('⚔️', 'سيف الروح!', 'تم شيل إجابتين غلط!');
    } else if (power.id === 'spear') {
        miniGameState.score = (miniGameState.score || 0) + 5;
        var scoreEl = document.getElementById('mg-score');
        if (scoreEl) scoreEl.textContent = miniGameState.score;
        showAchievement('🗡️', 'رمح النصر!', '+5 نقاط إضافية!');
    } else if (power.id === 'reveal') {
        activateRevealTruth();
        showAchievement('📖', 'نور الحق!', 'الإجابة الصحيحة اتكشفت!');
    } else if (power.id === 'grace') {
        activateQueenGrace();
        showAchievement('👑', 'نعمة الملكة!', '+15 ثانية إضافية!');
    } else if (power.id === 'blessing') {
        activateDivineBlessing();
        showAchievement('💧', 'نبع البركة!', '+30 نجمة هدية!');
    }

    saveToLocalStorage();
    updatePowerButton();
}

function activateSwordOfSpirit() {
    // Remove 2 wrong options from current question
    var options = document.querySelectorAll('.mg-fb-option, .option-btn, .mg-tf-btn');
    var removed = 0;
    options.forEach(function(btn) {
        if (removed >= 2) return;
        // Check if this is a wrong answer by checking its onclick
        var text = btn.textContent.trim();
        var isWrong = !btn.classList.contains('correct') && !btn.dataset.correct;
        if (isWrong && removed < 2) {
            btn.style.opacity = '0.2';
            btn.style.pointerEvents = 'none';
            btn.style.textDecoration = 'line-through';
            removed++;
        }
    });
}

function activateRevealTruth() {
    // Determine the correct answer for the current question
    var correctText = null;
    var isTF = false;
    var correctTF = null;

    if (miniGameState.type === 'trueFalse') {
        var q = miniGameState.data && miniGameState.data[miniGameState.index];
        if (q) { isTF = true; correctTF = q.answer; }
    } else if (miniGameState.type === 'fillBlank') {
        var q = miniGameState.data && miniGameState.data[miniGameState.index];
        if (q) correctText = q.blank;
    } else if (miniGameState.type === 'characters') {
        var q = miniGameState.data && miniGameState.data[miniGameState.index];
        if (q) correctText = q.name;
    } else if (miniGameState.type === 'mixedChallenge') {
        var round = miniGameState.data && miniGameState.data[miniGameState.index];
        if (round) {
            if (round.type === 'trueFalse') { isTF = true; correctTF = round.data.answer; }
            else if (round.type === 'fillBlank') correctText = round.data.blank;
            else if (round.type === 'mcq') correctText = round.data.options[round.data.correct];
        }
    }

    // Highlight true/false button
    if (isTF) {
        var selector = correctTF ? '.mg-tf-true' : '.mg-tf-false';
        var btn = document.querySelector(selector);
        if (btn) applyRevealGlow(btn);
        return;
    }

    // Highlight matching option button by text
    if (correctText) {
        document.querySelectorAll('.mg-fb-option').forEach(function(btn) {
            if (btn.textContent.trim() === correctText.trim()) {
                applyRevealGlow(btn);
            }
        });
    }
}

function applyRevealGlow(el) {
    var origStyle = el.getAttribute('style') || '';
    el.style.boxShadow = '0 0 0 4px #FFD700, 0 0 24px 8px rgba(255,215,0,0.7)';
    el.style.border = '2px solid #FFD700';
    el.style.transform = 'scale(1.08)';
    el.style.transition = 'all 0.3s ease';
    el.style.zIndex = '10';
    setTimeout(function() {
        el.setAttribute('style', origStyle);
    }, 2500);
}

function activateDivineBlessing() {
    GameState.stars = (GameState.stars || 0) + 30;
    var starsEl = document.getElementById('mg-stars') || document.getElementById('hub-stars');
    if (starsEl) {
        starsEl.style.color = '#7EC8E3';
        starsEl.style.transform = 'scale(1.3)';
        setTimeout(function() { starsEl.style.color = ''; starsEl.style.transform = ''; }, 1000);
    }
    saveToLocalStorage();
}

function activateQueenGrace() {
    // Add 15 seconds to the active quiz timer
    if (quizState.timeLeft !== undefined && quizState.timer) {
        quizState.timeLeft += 15;
        var timerEl = document.getElementById('timer-value');
        if (timerEl) {
            timerEl.textContent = quizState.timeLeft;
            timerEl.style.color = '#C39BD3';
            timerEl.style.transform = 'scale(1.3)';
            setTimeout(function() {
                timerEl.style.color = '';
                timerEl.style.transform = '';
            }, 1000);
        }
    }
}

function updatePowerButton() {
    var btn = document.getElementById('char-power-btn');
    if (!btn) return;
    var ch = CHARACTERS[GameState.character];
    if (!ch || !ch.power) return;
    var power = ch.power;
    var canAfford = power.costType === 'stars' ? GameState.stars >= power.cost : (GameState.gems || 0) >= power.cost;
    btn.disabled = !canAfford;
    btn.className = 'char-power-btn' + (canAfford ? '' : ' disabled');
    btn.innerHTML = '<span class="cpb-icon">' + power.icon + '</span><span class="cpb-name">' + power.name + '</span><span class="cpb-cost">' + power.cost + ' ' + (power.costType === 'stars' ? '⭐' : '💎') + '</span>';
}

function getCharPowerButtonHTML() {
    var ch = CHARACTERS[GameState.character];
    if (!ch || !ch.power) return '';
    var power = ch.power;
    var canAfford = power.costType === 'stars' ? GameState.stars >= power.cost : (GameState.gems || 0) >= power.cost;
    return '<button class="char-power-btn' + (canAfford ? '' : ' disabled') + '" id="char-power-btn" onclick="useCharacterPower()" title="' + power.desc + '">' +
        '<span class="cpb-icon">' + power.icon + '</span>' +
        '<span class="cpb-name">' + power.name + '</span>' +
        '<span class="cpb-cost">' + power.cost + ' ' + (power.costType === 'stars' ? '⭐' : '💎') + '</span>' +
        '</button>';
}

// Preload character images
var charImages = {};
function preloadCharImages() {
    Object.keys(CHARACTERS).forEach(function(key) {
        var img = new Image();
        img.src = CHARACTERS[key].image;
        charImages[key] = img;
    });
}

function drawCharacter(ctx, charKey, x, y, size) {
    const ch = CHARACTERS[charKey];
    if (!ch) return;
    var img = charImages[charKey];
    if (img && img.complete && img.naturalWidth > 0) {
        // Draw circular clipped image
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, x - size, y - size, size * 2, size * 2);
        ctx.restore();
        // Draw border
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.strokeStyle = ch.color;
        ctx.lineWidth = 3;
        ctx.stroke();
    } else {
        // Fallback: colored circle with emoji
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        var gradient = ctx.createRadialGradient(x, y, size * 0.2, x, y, size);
        gradient.addColorStop(0, ch.color);
        gradient.addColorStop(1, shadeColor(ch.color, -30));
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.font = size + 'px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ch.emoji, x, y);
        ctx.restore();
        // Retry when image loads
        if (img) {
            img.onload = function() {
                ctx.clearRect(x - size - 4, y - size - 4, size * 2 + 8, size * 2 + 8);
                drawCharacter(ctx, charKey, x, y, size);
            };
        }
    }
}

function shadeColor(color, percent) {
    let num = parseInt(color.replace('#', ''), 16);
    let r = (num >> 16) + percent;
    let g = ((num >> 8) & 0x00FF) + percent;
    let b = (num & 0x0000FF) + percent;
    r = Math.max(Math.min(255, r), 0);
    g = Math.max(Math.min(255, g), 0);
    b = Math.max(Math.min(255, b), 0);
    return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
}

// --- Armor Items ---
const ARMOR_ITEMS = {
    helmet: {
        name: 'خوذة الخلاص',
        icon: '⛑️',
        slot: 'head',
        desc: 'تحمي عقلك بكلمة الله',
        verse: 'خوذة الخلاص - أف 6:17',
        cost: 50,
        effect: { extraTime: 5 }
    },
    breastplate: {
        name: 'درع البر',
        icon: '🛡️',
        slot: 'chest',
        desc: 'يحمي قلبك من الخطية',
        verse: 'درع البر - أف 6:14',
        cost: 80,
        effect: { extraLife: 1 }
    },
    belt: {
        name: 'منطقة الحق',
        icon: '📿',
        slot: 'waist',
        desc: 'الحق يحررك',
        verse: 'منطقة الحق - أف 6:14',
        cost: 60,
        effect: { scoreMultiplier: 1.5 }
    },
    shoes: {
        name: 'حذاء الإنجيل',
        icon: '👟',
        slot: 'feet',
        desc: 'استعداد إنجيل السلام',
        verse: 'إنجيل السلام - أف 6:15',
        cost: 40,
        effect: { speedBoost: true }
    },
    shield: {
        name: 'ترس الإيمان',
        icon: '🔰',
        slot: 'hand',
        desc: 'يطفئ سهام الشرير',
        verse: 'ترس الإيمان - أف 6:16',
        cost: 100,
        effect: { errorShield: 1 }
    },
    sword: {
        name: 'سيف الروح',
        icon: '🗡️',
        slot: 'weapon',
        desc: 'كلمة الله الحية',
        verse: 'سيف الروح - أف 6:17',
        cost: 120,
        effect: { attackPower: 2 }
    }
};

// ============================================================
// CHARACTER EVOLUTION TIERS
// ============================================================
var CHARACTER_TIERS = {
    bronze: { name: 'برونزي', emoji: '🥉', color: '#CD7F32', starsNeeded: 0, glowColor: 'rgba(205,127,50,0.3)' },
    silver: { name: 'فضي', emoji: '🥈', color: '#C0C0C0', starsNeeded: 500, glowColor: 'rgba(192,192,192,0.5)' },
    gold:   { name: 'ذهبي', emoji: '🥇', color: '#FFD700', starsNeeded: 2000, glowColor: 'rgba(255,215,0,0.6)' }
};

var CHARACTER_GOLD_TITLES = {
    david: 'الملك المرنم 👑',
    philomena: 'الشهيدة المجيدة 👑',
    paul: 'رسول الأمم العظيم 👑',
    george: 'الفارس المقدام 👑',
    athanasius: 'بطريرك الإيمان الأعظم 👑',
    esther: 'ملكة الحكمة والنعمة 👑',
    verina: 'قديسة الشفاء والرحمة 👑'
};

function getCharacterTier(charKey) {
    return GameState.characterTiers[charKey] || 'bronze';
}

function upgradeCharacterTier(charKey) {
    var currentTier = getCharacterTier(charKey);
    var nextTier = currentTier === 'bronze' ? 'silver' : currentTier === 'silver' ? 'gold' : null;
    if (!nextTier) { showToast('الشخصية وصلت أعلى مستوى! 🥇'); return; }
    var cost = CHARACTER_TIERS[nextTier].starsNeeded;
    if (GameState.stars < cost) {
        showToast('محتاج ' + cost + ' ⭐ للترقية لـ ' + CHARACTER_TIERS[nextTier].name, 'warning');
        return;
    }
    GameState.stars -= cost;
    GameState.characterTiers[charKey] = nextTier;
    saveToLocalStorage();
    saveGame();

    var tierData = CHARACTER_TIERS[nextTier];
    showToast('🎉 تمت ترقية ' + CHARACTERS[charKey].name + ' لـ ' + tierData.name + '!', 'success');
    launchConfetti(3000);
    showAchievement(tierData.emoji, 'ترقية ' + tierData.name + '!', CHARACTERS[charKey].name + ' وصل مستوى ' + tierData.name);
    renderCharacters();
    renderHomeHub();
}

// ============================================================
// COSMETIC ITEMS: FRAMES, TITLES, MAP THEMES
// ============================================================
var PROFILE_FRAMES = {
    cross:  { name: 'إطار الصليب الذهبي',      icon: '✝️', desc: 'إطار مقدس بزخارف ذهبية لامعة',         cost: 15, accentColor: '#FFD700', frameClass: 'frame-cross',  borderStyle: '4px solid #FFD700', shadow: '0 0 0 3px #0a0a1e, 0 0 0 7px #FFD700, 0 0 28px rgba(255,215,0,0.8)' },
    dove:   { name: 'إطار الحمامة السماوية',   icon: '🕊️', desc: 'إطار ملهم من نعمة الروح القدس',        cost: 30, accentColor: '#7EC8E3', frameClass: 'frame-dove',   borderStyle: '4px solid #7EC8E3', shadow: '0 0 0 3px #0a0a1e, 0 0 0 7px #87CEEB, 0 0 28px rgba(135,206,235,0.8)' },
    church: { name: 'إطار الكنيسة المجيدة',    icon: '⛪',  desc: 'إطار مستوحى من الكنيسة الأرثوذكسية',  cost: 50, accentColor: '#C39BD3', frameClass: 'frame-church', borderStyle: '4px solid #C39BD3', shadow: '0 0 0 3px #0a0a1e, 0 0 0 7px #9B59B6, 0 0 28px rgba(155,89,182,0.8)' },
    flame:  { name: 'إطار اللهيب المقدس',      icon: '🔥', desc: 'جائزة المداومة 7 أيام - مكسوب بالاستمرار', cost: 0, accentColor: '#FF6B35', frameClass: 'frame-flame',  borderStyle: '4px solid #FF6B35', shadow: '0 0 0 3px #0a0a1e, 0 0 0 7px #FF6B35, 0 0 28px rgba(255,107,53,0.8)' }
};

var PLAYER_TITLES = {
    bookKeeper: { name: 'حافظ الكتاب 📖',    desc: 'اقرأ 10 أصحاحات',          icon: '📖', cost: 0,  earned: function() { return (GameState.bibleChapter || 1) >= 10; } },
    gameChamp:  { name: 'بطل الألعاب 🏆',    desc: 'أكمل 20 لعبة',             icon: '🏆', cost: 0,  earned: function() { return (GameState.gamesPlayed || 0) >= 20; } },
    faithful:   { name: 'خادم أمين 🙏',      desc: '7 أيام streak متواصل',     icon: '🙏', cost: 0,  earned: function() { return (GameState.bestStreak || 0) >= 7; } },
    warrior:    { name: 'محارب الإيمان ⚔️',  desc: 'هاجم البوس 5 مرات',        icon: '⚔️', cost: 25, earned: function() { return false; } },
    scholar:    { name: 'عالم اللاهوت 🎓',   desc: 'اشترِ بـ 25 جوهرة',        icon: '🎓', cost: 25, earned: function() { return false; } },
    star:       { name: 'نجم المنافسات ⭐',  desc: 'اشترِ بـ 40 جوهرة',        icon: '⭐', cost: 40, earned: function() { return false; } },
    steadfast:  { name: 'المثابر الأمين 🏆', desc: 'جائزة 30 يوم متواصل',       icon: '🏆', cost: 0,  earned: function() { return (GameState.claimedStreakRewards || []).indexOf('streak30') >= 0; } }
};

var STREAK_REWARDS = [
    { id: 'streak7',  name: 'إطار اللهيب المقدس',   icon: '🔥', streakNeeded: 7,  type: 'frame', rewardKey: 'flame',     rewardLabel: 'إطار اللهيب المقدس',   desc: 'حافظ على 7 أيام دخول متواصلة' },
    { id: 'streak14', name: 'زي المثابر الفضي',      icon: '⚡', streakNeeded: 14, type: 'skin',  rewardKey: 'silver_all', rewardLabel: 'رتبة فضية لكل الشخصيات', desc: 'حافظ على 14 يوماً متواصلاً' },
    { id: 'streak30', name: 'لقب المثابر الأمين',    icon: '🏆', streakNeeded: 30, type: 'title', rewardKey: 'steadfast',  rewardLabel: 'لقب المثابر الأمين',   desc: 'حافظ على 30 يوماً متواصلاً' }
];

var MAP_THEMES = {
    'default': { name: 'الإيمان الكلاسيكي', icon: '⛪', desc: 'الشكل الافتراضي', cost: 0, bgColor: '#0a0a1e', accent: '#6C5CE7' },
    space:     { name: 'الفضاء الإلهي', icon: '🚀', desc: 'خريطة فضائية بين النجوم', cost: 30, bgColor: '#0b0033', accent: '#00CEC9' },
    underwater:{ name: 'أعماق البحر', icon: '🐠', desc: 'عالم تحت الماء', cost: 30, bgColor: '#002b36', accent: '#00B894' },
    sky:       { name: 'فوق السحاب', icon: '☁️', desc: 'مغامرة في السماء', cost: 30, bgColor: '#1a237e', accent: '#74b9ff' }
};

// --- Mission Types ---
const MISSION_TYPES = {
    recordPsalm: { name: 'تسجيل مزمور', icon: 'fa-microphone', color: '#9C27B0', description: 'سجّل نفسك وأنت بتقول المزمور' },
    explainStory: { name: 'شرح قصة', icon: 'fa-book-open-reader', color: '#2196F3', description: 'اشرح قصة من الكتاب المقدس بأسلوبك' },
    goodDeed: { name: 'عمل خير', icon: 'fa-hand-holding-heart', color: '#4CAF50', description: 'زيارة مريض أو عمل خير وصوّره' },
    churchAttend: { name: 'حضور قداس', icon: 'fa-church', color: '#FF9800', description: 'احضر القداس وصوّر نفسك في الكنيسة' },
    prayerChallenge: { name: 'تحدي الصلاة', icon: 'fa-pray', color: '#E91E63', description: 'صلّي أجبية كاملة وسجّل اسم الساعة' },
    bibleReading: { name: 'قراءة كتاب مقدس', icon: 'fa-bible', color: '#795548', description: 'اقرأ إصحاح وسجّل ملخصه' }
};

// --- Mission Data ---
const MISSION_DATA = [
    { id: 1, type: 'recordPsalm', title: 'سجّل مزمور 23 (الرب راعيّ)', description: 'احفظ مزمور 23 وسجّل نفسك وأنت بتقوله. اكتب إيه اللي اتعلمته من المزمور.', reward: 15, starsReward: 3 },
    { id: 2, type: 'explainStory', title: 'اشرح قصة يونان النبي', description: 'اشرح قصة يونان النبي بأسلوبك الخاص. إيه الدرس اللي اتعلمته من القصة؟', reward: 20, starsReward: 3 },
    { id: 3, type: 'goodDeed', title: 'زُر مريض أو ساعد حد محتاج', description: 'زور مريض أو ساعد حد محتاج واكتب إيه اللي عملته وإزاي حسيت.', reward: 25, starsReward: 4 },
    { id: 4, type: 'churchAttend', title: 'احضر قداس الأحد', description: 'احضر القداس يوم الأحد واكتب إيه اللي استفدته من العظة.', reward: 15, starsReward: 3 },
    { id: 5, type: 'prayerChallenge', title: 'صلّي ساعة باكر', description: 'صلّي ساعة باكر من الأجبية واكتب إيه اللي حسيت بيه بعد الصلاة.', reward: 15, starsReward: 3 },
    { id: 6, type: 'bibleReading', title: 'اقرأ أفسس 6 واكتب ملخص', description: 'اقرأ إصحاح 6 من رسالة أفسس واكتب ملخص بسيط للي فهمته.', reward: 20, starsReward: 3 },
    { id: 7, type: 'recordPsalm', title: 'سجّل مزمور 51 (ارحمني يا الله)', description: 'احفظ مزمور 51 (مزمور التوبة) واكتب إيه اللي علمك إياه عن التوبة.', reward: 20, starsReward: 3 },
    { id: 8, type: 'explainStory', title: 'اشرح قصة داود وجليات', description: 'اشرح قصة داود وجليات وإيه الدرس اللي نتعلمه من شجاعة داود.', reward: 20, starsReward: 3 },
    { id: 9, type: 'goodDeed', title: 'ساعد في خدمة الكنيسة', description: 'شارك في خدمة الكنيسة (تنظيف/ترتيب/مساعدة) واكتب إيه اللي عملته.', reward: 25, starsReward: 4 },
    { id: 10, type: 'bibleReading', title: 'اقرأ إنجيل متى 5 (التطويبات)', description: 'اقرأ إنجيل متى إصحاح 5 (التطويبات) واكتب أكتر تطويبة أثرت فيك وليه.', reward: 20, starsReward: 3 }
];

// --- Daily Verses ---
const DAILY_VERSES = [
    { text: 'لأَنَّ اللهَ هكَذا أَحَبَّ العالَمَ حتّى بَذَلَ ابنَهُ الوحيدَ', ref: 'يوحنا 3:16' },
    { text: 'أَمّا أَنا فَقَد أَتَيتُ لتَكونَ لَهم حَياةٌ وليَكونَ لَهم أَفضَل', ref: 'يوحنا 10:10' },
    { text: 'تَعالَوا إلَيَّ يا جَميعَ المتعَبينَ والثقيلي الأَحمال وأَنا أُريحُكم', ref: 'متى 11:28' },
    { text: 'الرَبُّ راعيَّ فلا يُعوِزُني شَيءٌ', ref: 'مزمور 23:1' },
    { text: 'أَستَطيعُ كُلَّ شَيءٍ في المَسيح الذي يُقَوّيني', ref: 'فيلبي 4:13' },
    { text: 'لا تَخَفْ لأَنّي مَعَكَ، لا تَتَلَفَّتْ لأَنّي إلهُكَ', ref: 'إشعياء 41:10' },
    { text: 'أَحِبّوا بَعضُكم بَعضًا كَما أَحبَبتُكم', ref: 'يوحنا 15:12' },
    { text: 'أَنا هوَ الطَّريقُ والحَقُّ والحَياةُ', ref: 'يوحنا 14:6' },
    { text: 'فَإنَّ كُلَّ الأَشياء تَعمَلُ مَعًا للخَير للذينَ يُحِبّونَ اللهَ', ref: 'رومية 8:28' },
    { text: 'فَليُضِئْ نورُكم هكَذا قُدّامَ النّاسِ', ref: 'متى 5:16' },
    { text: 'اُطلُبوا أَوَّلًا مَلَكوتَ الله وبِرَّهُ', ref: 'متى 6:33' },
    { text: 'سَلِّموا أُمورَكم للرَبِّ فَهوَ يُعولُكم', ref: 'مزمور 55:22' },
    { text: 'كونوا لُطَفاءَ بَعضُكم نَحوَ بَعضٍ، شَفوقينَ، مُتَسامحينَ', ref: 'أفسس 4:32' },
    { text: 'المَحَبَّةُ تَصبِرُ وتَرفُقُ، المَحَبَّةُ لا تَحسُدُ', ref: '1 كورنثوس 13:4' },
    { text: 'إنْ اعتَرَفنا بخَطايانا فَهوَ أَمينٌ وعادِلٌ', ref: '1 يوحنا 1:9' },
    { text: 'الرَبُّ قَريبٌ لمُنكَسِري القَلبِ', ref: 'مزمور 34:18' },
    { text: 'افرَحوا في الرَبِّ كُلَّ حينٍ، وأَقولُ أَيضًا افرَحوا', ref: 'فيلبي 4:4' },
    { text: 'كُلُّ شَيءٍ جَميلٌ في وَقتِهِ', ref: 'جامعة 3:11' },
    { text: 'أَحِبَّ الرَبَّ إلهَكَ من كُلِّ قَلبِكَ', ref: 'متى 22:37' },
    { text: 'الرَبُّ نوري وخَلاصي، مِمَّنْ أَخافُ؟', ref: 'مزمور 27:1' },
    { text: 'السَّماواتُ تُحَدِّثُ بمَجدِ اللهِ', ref: 'مزمور 19:1' },
    { text: 'لا تَهتَمّوا للغَدِ، لأَنَّ الغَدَ يَهتَمُّ بما لنَفسِهِ', ref: 'متى 6:34' },
    { text: 'كُن أَمينًا إلى المَوت فَسأُعطيكَ إكليلَ الحَياةِ', ref: 'رؤيا 2:10' },
    { text: 'أَحِبَّ قَريبَكَ كَنَفسِكَ', ref: 'متى 22:39' },
    { text: 'وَها أَنا مَعَكم كُلَّ الأَيّامِ إلى انقِضاءِ الدَّهرِ', ref: 'متى 28:20' },
    { text: 'ليَكُنْ كَلامُكم كُلَّ حينٍ بنِعمَةٍ، مُمَلَّحًا بمِلحٍ', ref: 'كولوسي 4:6' },
    { text: 'ثِقَ في الرَبِّ من كُلِّ قَلبِكَ', ref: 'أمثال 3:5' },
    { text: 'اُصنَعوا الخَيرَ ولا تَمَلّوا', ref: 'غلاطية 6:9' },
    { text: 'يَا بَنيَّ، لا نُحِبَّ بالكَلامِ ولا باللِّسانِ، بَلْ بالعَمَلِ والحَقِّ', ref: '1 يوحنا 3:18' },
    { text: 'صَلّوا بلا انقِطاعٍ', ref: '1 تسالونيكي 5:17' },
    { text: 'أَقوياءُ في الرَبِّ وفي شِدَّةِ قوَّتِهِ', ref: 'أفسس 6:10' },
    { text: 'اُشكُروا في كُلِّ شَيءٍ', ref: '1 تسالونيكي 5:18' },
    { text: 'الرَبُّ إلهي، إليكَ أُبَكِّرُ، اللهَ روحي تَعطَشُ إليكَ', ref: 'مزمور 63:1' },
    { text: 'الأَبرارُ يُضيئونَ كالشَّمسِ في مَلَكوتِ أَبيهم', ref: 'متى 13:43' },
    { text: 'ها أَنا أَصنَعُ كُلَّ شَيءٍ جَديدًا', ref: 'رؤيا 21:5' },
    { text: 'عَظيمٌ هوَ سِرُّ التَّقوى', ref: '1 تيموثاوس 3:16' },
    { text: 'قَلبًا نَقيًّا اخلُقْ فيَّ يا اللهُ', ref: 'مزمور 51:10' },
    { text: 'إنْ كانَ اللهُ مَعَنا، فَمَنْ عَلَينا؟', ref: 'رومية 8:31' },
    { text: 'طُوبى للرُّحَماء لأَنَّهم يُرحَمونَ', ref: 'متى 5:7' },
    { text: 'الرَبُّ حِصني في يَومِ الضّيقِ', ref: 'ناحوم 1:7' },
    { text: 'طُوبى لصانعي السَّلام لأَنَّهم أَبناءَ الله يُدعَونَ', ref: 'متى 5:9' },
    { text: 'الأَرضُ للرَبِّ ومِلؤها', ref: 'مزمور 24:1' },
    { text: 'مُبارَكٌ الإنسانُ الذي يَتَّكِلُ عَلى الرَبِّ', ref: 'إرميا 17:7' },
    { text: 'خَيرٌ لي أَنْ أَقتَرِبَ إلى اللهِ', ref: 'مزمور 73:28' },
    { text: 'عَلِّمني يا رَبُّ طَريقَكَ', ref: 'مزمور 27:11' },
    { text: 'تَوكَّلْ عَلى الرَبِّ واصنَعِ الخَيرَ', ref: 'مزمور 37:3' },
    { text: 'افتَحْ عَينَيَّ فَأَرى عَجائِبَ من شَريعَتِكَ', ref: 'مزمور 119:18' },
    { text: 'لأَنَّ عِندَكَ ينبوعَ الحَياةِ، بنورِكَ نَرى نورًا', ref: 'مزمور 36:9' },
    { text: 'انتَظِرِ الرَبَّ، تَقَوَّ وليَتَشجَّعْ قَلبُكَ', ref: 'مزمور 27:14' },
    { text: 'بارِكي يا نَفسي الرَبَّ ولا تَنسَي كُلَّ حَسَناتِهِ', ref: 'مزمور 103:2' },
    { text: 'مَعَ الله كُلُّ شَيءٍ مُستَطاعٌ', ref: 'متى 19:26' },
    { text: 'يَا أَبنائي وأَحِبّائي، لنَكُنْ راسِخينَ غَيرَ مُتَزَعزِعينَ', ref: '1 كورنثوس 15:58' }
];

// --- Weekly Challenges ---
const WEEKLY_CHALLENGES = [
    { title: 'تحدي الصلاة', description: 'صلّي كُل يوم الصبح أول ما تصحى لمدة أسبوع', icon: 'fa-pray', reward: 5 },
    { title: 'تحدي القراءة', description: 'اقرأ إصحاح من الكتاب المقدس كُل يوم', icon: 'fa-bible', reward: 5 },
    { title: 'تحدي الحفظ', description: 'احفظ آية جديدة كُل يوم من أيام الأسبوع', icon: 'fa-brain', reward: 5 },
    { title: 'تحدي الخدمة', description: 'ساعد حد محتاج كُل يوم (زميل، جار، أهل)', icon: 'fa-hand-holding-heart', reward: 5 },
    { title: 'تحدي الشكر', description: 'اكتب 3 حاجات شاكر عليها ربنا كُل يوم', icon: 'fa-heart', reward: 5 },
    { title: 'تحدي الكنيسة', description: 'احضر كُل الاجتماعات والقداسات الأسبوع ده', icon: 'fa-church', reward: 5 },
    { title: 'تحدي التسبيح', description: 'اسمع ترنيمة روحية كُل يوم واحفظ كلماتها', icon: 'fa-music', reward: 5 },
    { title: 'تحدي الصوم', description: 'صوّم يوم الأربعاء والجمعة الأسبوع ده', icon: 'fa-utensils', reward: 5 },
    { title: 'تحدي المسامحة', description: 'سامح حد زعلك وصالحه الأسبوع ده', icon: 'fa-handshake', reward: 5 },
    { title: 'تحدي الاعتراف', description: 'اعترف عند أبونا الأسبوع ده', icon: 'fa-cross', reward: 5 },
    { title: 'تحدي التناول', description: 'اتناول في القداس الأسبوع ده', icon: 'fa-wine-glass', reward: 5 },
    { title: 'تحدي المحبة', description: 'قول كلمة حلوة لحد كُل يوم وفرّحه', icon: 'fa-smile', reward: 5 },
    { title: 'تحدي التواضع', description: 'اخدم حد في البيت بدون ما حد يطلب منك', icon: 'fa-hands-helping', reward: 5 },
    { title: 'تحدي الصمت', description: 'خصّص 10 دقايق كُل يوم للصمت والتأمل مع ربنا', icon: 'fa-moon', reward: 5 },
    { title: 'تحدي البركة', description: 'قول بركة الأكل قبل كُل وجبة الأسبوع ده', icon: 'fa-utensils', reward: 5 },
    { title: 'تحدي العائلة', description: 'صلّي مع أهلك كُل يوم قبل النوم', icon: 'fa-users', reward: 5 }
];

// --- Levels ---
const LEVELS = [
    { id: 1,  name: 'بداية الرحلة',     type: 'quiz',    questions: 5,  timePerQ: 20, starsNeeded: 0,  reward: 10 },
    { id: 2,  name: 'أرض الموعد',       type: 'quiz',    questions: 5,  timePerQ: 18, starsNeeded: 3,  reward: 15 },
    { id: 3,  name: 'المزامير',          type: 'psalm',     questions: 5,  timePerQ: 25, starsNeeded: 5,  reward: 20 },
    { id: 4,  name: 'تحدي الإيمان',      type: 'truefalse', questions: 8,  timePerQ: 12, starsNeeded: 8,  reward: 20 },
    { id: 5,  name: 'الوحش الأول',       type: 'quiz',      questions: 10, timePerQ: 15, starsNeeded: 12, reward: 30 },
    { id: 6,  name: 'الترتيب المقدس',    type: 'order',     questions: 5,  timePerQ: 30, starsNeeded: 15, reward: 25 },
    { id: 7,  name: 'الفرق المخفي',      type: 'spotdiff',  questions: 5,  timePerQ: 20, starsNeeded: 18, reward: 25 },
    { id: 8,  name: 'أكمل الآية',        type: 'missing',   questions: 6,  timePerQ: 20, starsNeeded: 22, reward: 25 },
    { id: 9,  name: 'مهمة: تسجيل مزمور',  type: 'mission', missionId: 1, starsNeeded: 24, reward: 15 },
    { id: 10, name: 'صل وتذكر',         type: 'memory',    questions: 6,  timePerQ: 30, starsNeeded: 27, reward: 30 },
    { id: 11, name: 'الوحش الثاني',      type: 'quiz',      questions: 12, timePerQ: 14, starsNeeded: 30, reward: 40 },
    { id: 12, name: 'صور مقدسة',        type: 'picguess',  questions: 5,  timePerQ: 20, starsNeeded: 34, reward: 30 },
    { id: 13, name: 'أوصل الخط',        type: 'connect',   questions: 6,  timePerQ: 25, starsNeeded: 37, reward: 30 },
    { id: 14, name: 'اللغز المقدس',      type: 'puzzle',    questions: 5,  timePerQ: 35, starsNeeded: 40, reward: 35 },
    { id: 15, name: 'صح أم خطأ ٢',      type: 'truefalse', questions: 10, timePerQ: 10, starsNeeded: 44, reward: 30 },
    { id: 16, name: 'الوحش الثالث',      type: 'quiz',      questions: 14, timePerQ: 13, starsNeeded: 47, reward: 50 },
    { id: 17, name: 'المتاهة',           type: 'maze',      questions: 3,  timePerQ: 45, starsNeeded: 52, reward: 40 },
    { id: 18, name: 'مهمة: شرح قصة',       type: 'mission', missionId: 2, starsNeeded: 55, reward: 20 },
    { id: 19, name: 'صور وألغاز',       type: 'imgpuzzle', questions: 5,  timePerQ: 30, starsNeeded: 58, reward: 35 },
    { id: 20, name: 'الذاكرة القوية',    type: 'memory',    questions: 8,  timePerQ: 25, starsNeeded: 62, reward: 35 },
    { id: 21, name: 'تحدي السرعة',      type: 'quiz',    questions: 10, timePerQ: 10, starsNeeded: 65, reward: 40 },
    { id: 22, name: 'الوحش الرابع',      type: 'quiz',      questions: 16, timePerQ: 12, starsNeeded: 70, reward: 60 },
    { id: 23, name: 'المزامير ٢',        type: 'psalm',     questions: 8,  timePerQ: 20, starsNeeded: 75, reward: 45 },
    { id: 24, name: 'مهمة: عمل خير',      type: 'mission', missionId: 3, starsNeeded: 78, reward: 25 },
    { id: 25, name: 'أوصل ٢',          type: 'connect',   questions: 8,  timePerQ: 22, starsNeeded: 82, reward: 45 },
    { id: 26, name: 'الترتيب النهائي',   type: 'order',     questions: 8,  timePerQ: 25, starsNeeded: 86, reward: 50 },
    { id: 27, name: 'التحدي الأخير',     type: 'quiz',    questions: 15, timePerQ: 12, starsNeeded: 90, reward: 60 },
    { id: 28, name: 'ملك الأبطال',       type: 'quiz',      questions: 20, timePerQ: 10, starsNeeded: 95, reward: 100 }
];

// --- Paul's First Journey Stations ---
const PAUL_JOURNEY_STATIONS = [
    {
        id: 1, name: 'أنطاكية',
        x: 88, y: 42,
        icon: 'fa-flag-checkered',
        desc: 'نقطة بداية رحلة بولس — الكنيسة أرسلته مع برنابا ليبشر الأمم',
        question: { q: 'من أرسل بولس وبرنابا في الرحلة التبشيرية الأولى؟', options: ['بطرس الرسول', 'كنيسة أنطاكية', 'الرومان', 'مجمع أورشليم'], correct: 1 },
        verse: 'فصاموا حينئذ وصلوا ووضعوا عليهما الأيادي ثم أطلقوهما — أعمال 13:3',
        reward: 3
    },
    {
        id: 2, name: 'سلوكية',
        x: 82, y: 58,
        icon: 'fa-ship',
        desc: 'ميناء سلوكية — منها أبحر بولس وبرنابا إلى جزيرة قبرص',
        question: { q: 'مين سافر مع بولس في رحلته التبشيرية الأولى؟', options: ['بطرس', 'برنابا ويوحنا مرقس', 'تيموثاوس', 'سيلا'], correct: 1 },
        verse: 'فهذان إذ أُرسلا من الروح القدس انحدرا إلى سلوكية — أعمال 13:4',
        reward: 3
    },
    {
        id: 3, name: 'سلاميس',
        x: 65, y: 62,
        icon: 'fa-book-open',
        desc: 'أول مدينة بشّر فيها بولس في قبرص — نادى بكلمة الله في مجامع اليهود',
        question: { q: 'أين بشّر بولس لأول مرة في قبرص؟', options: ['في الشوارع', 'في مجامع اليهود', 'في القصر الروماني', 'في السوق'], correct: 1 },
        verse: 'ولما صارا في سلاميس ناديا بكلمة الله في مجامع اليهود — أعمال 13:5',
        reward: 3
    },
    {
        id: 4, name: 'بافوس',
        x: 50, y: 68,
        icon: 'fa-wand-magic-sparkles',
        desc: 'بولس واجه الساحر عليم (بار يشوع) وأعمى عينيه بقوة الروح القدس',
        question: { q: 'إيه اللي حصل لعليم الساحر في بافوس؟', options: ['آمن بالمسيح', 'هرب من المدينة', 'أصابه العمى', 'اتسجن'], correct: 2 },
        verse: 'فالآن هوذا يد الرب عليك فتكون أعمى لا تبصر الشمس إلى حين — أعمال 13:11',
        reward: 4
    },
    {
        id: 5, name: 'برجة',
        x: 28, y: 38,
        icon: 'fa-person-walking-arrow-right',
        desc: 'في برجة يوحنا مرقس سابهم ورجع لأورشليم',
        question: { q: 'مين سابهم ورجع أورشليم لما وصلوا برجة؟', options: ['برنابا', 'تيموثاوس', 'يوحنا مرقس', 'سيلا'], correct: 2 },
        verse: 'وأما يوحنا فانفصل عنهما ورجع إلى أورشليم — أعمال 13:13',
        reward: 3
    },
    {
        id: 6, name: 'أنطاكية بيسيدية',
        x: 25, y: 25,
        icon: 'fa-bullhorn',
        desc: 'بولس ألقى عظة عظيمة في المجمع عن تاريخ الخلاص — ناس كتير آمنت',
        question: { q: 'إيه رد فعل اليهود لما الأمم آمنوا في أنطاكية بيسيدية؟', options: ['فرحوا', 'امتلأوا غيرة وحسد', 'ساعدوهم', 'سكتوا'], correct: 1 },
        verse: 'وكانت كلمة الرب تنتشر في جميع الكورة — أعمال 13:49',
        reward: 4
    },
    {
        id: 7, name: 'أيقونية',
        x: 42, y: 14,
        icon: 'fa-people-group',
        desc: 'في أيقونية آمن جمع كبير من اليهود واليونانيين لكن حاولوا يرجموهم',
        question: { q: 'إيه اللي اضطر بولس يعمله لما حاولوا يرجموه في أيقونية؟', options: ['استسلم لهم', 'هرب إلى لسترة ودربة', 'رجع أنطاكية', 'اتخبى في بيت'], correct: 1 },
        verse: 'فدخلا معاً إلى مجمع اليهود وتكلما حتى آمن جمع كثير — أعمال 14:1',
        reward: 4
    },
    {
        id: 8, name: 'لسترة',
        x: 55, y: 25,
        icon: 'fa-hand-sparkles',
        desc: 'بولس شفى رجل مقعد من بطن أمه — الناس فاكرينهم آلهة!',
        question: { q: 'الناس في لسترة فاكرين بولس وبرنابا مين؟', options: ['أنبياء عظام', 'ملوك أقوياء', 'الإلهين زفس وهرمس', 'ملائكة من السماء'], correct: 2 },
        verse: 'فنادوا برنابا زفس وبولس هرمس إذ كان هو المتقدم في الكلام — أعمال 14:12',
        reward: 5
    },
    {
        id: 9, name: 'دربة',
        x: 68, y: 22,
        icon: 'fa-trophy',
        desc: 'آخر محطة في الرحلة — بشّروا وتلمذوا كثيرين ثم رجعوا يشجعوا المؤمنين',
        question: { q: 'بعد ما بولس بشّر في دربة عمل إيه؟', options: ['كمّل لبلاد جديدة', 'رجع على نفس المدن يشجع المؤمنين', 'راح أورشليم مباشرة', 'استقر في دربة'], correct: 1 },
        verse: 'فبشرا في تلك المدينة وتلمذا كثيرين ثم رجعا إلى لسترة وأيقونية وأنطاكية — أعمال 14:21',
        reward: 5
    }
];

// --- Categories ---
const CATEGORIES = [
    { id: 'bible',   name: 'الكتاب المقدس', icon: '📖', color: '#FFD700' },
    { id: 'liturgy', name: 'الطقس الكنسي',   icon: '⛪', color: '#E63946' },
    { id: 'creed',   name: 'العقيدة',         icon: '✝️', color: '#4ECDC4' },
    { id: 'history', name: 'تاريخ الكنيسة',   icon: '📜', color: '#9B5DE5' },
    { id: 'service', name: 'الخدمة',          icon: '🕊️', color: '#FF6B35' }
];

// --- Questions Database ---
const QUESTIONS = {
    bible: [
        { q: 'من هو أول ملك على إسرائيل؟', options: ['شاول', 'داود', 'سليمان', 'رحبعام'], correct: 0 },
        { q: 'كم يوم صام الرب يسوع في البرية؟', options: ['30', '40', '50', '70'], correct: 1 },
        { q: 'من بنى الفلك؟', options: ['إبراهيم', 'موسى', 'نوح', 'داود'], correct: 2 },
        { q: 'ما هو أول سفر في الكتاب المقدس؟', options: ['التكوين', 'الخروج', 'المزامير', 'يوحنا'], correct: 0 },
        { q: 'من قتل جليات؟', options: ['شاول', 'يوناثان', 'داود', 'شمشون'], correct: 2 },
        { q: 'كم عدد تلاميذ المسيح؟', options: ['7', '10', '12', '14'], correct: 2 },
        { q: 'أين ولد الرب يسوع؟', options: ['الناصرة', 'أورشليم', 'بيت لحم', 'مصر'], correct: 2 },
        { q: 'من هو النبي الذي ابتلعه الحوت؟', options: ['إيليا', 'يونان', 'إرميا', 'حزقيال'], correct: 1 },
        { q: 'كم عدد أسفار الكتاب المقدس؟', options: ['66', '72', '73', '80'], correct: 2 },
        { q: 'من خان الرب يسوع؟', options: ['بطرس', 'يوحنا', 'يهوذا', 'توما'], correct: 2 },
        { q: 'ما هي أول معجزة للرب يسوع؟', options: ['تحويل الماء لخمر', 'شفاء الأعمى', 'إقامة لعازر', 'تكثير الخبز'], correct: 0 },
        { q: 'من هو تلميذ المسيح المحبوب؟', options: ['بطرس', 'يعقوب', 'يوحنا', 'أندراوس'], correct: 2 },
        { q: 'كم يوم مكث يونان في بطن الحوت؟', options: ['يوم', 'يومان', '3 أيام', '7 أيام'], correct: 2 },
        { q: 'من هو أبو الآباء؟', options: ['آدم', 'نوح', 'إبراهيم', 'يعقوب'], correct: 2 },
        { q: 'كم عدد أبناء يعقوب؟', options: ['10', '12', '14', '7'], correct: 1 },
        { q: 'من فتح البحر الأحمر؟', options: ['يشوع', 'موسى', 'إيليا', 'إليشع'], correct: 1 },
        { q: 'ما اسم أم صموئيل النبي؟', options: ['سارة', 'حنة', 'راعوث', 'أستير'], correct: 1 },
        { q: 'أين صعد الرب يسوع إلى السماء؟', options: ['جبل سيناء', 'جبل الزيتون', 'جبل تابور', 'الجلجثة'], correct: 1 },
        { q: 'كم عدد الوصايا العشر؟', options: ['7', '10', '12', '15'], correct: 1 },
        { q: 'من كتب سفر المزامير بأغلبيته؟', options: ['موسى', 'سليمان', 'داود', 'آساف'], correct: 2 }
    ],
    liturgy: [
        { q: 'كم عدد الأسرار الكنسية؟', options: ['5', '7', '9', '12'], correct: 1 },
        { q: 'ما هو أول سر من أسرار الكنيسة؟', options: ['المعمودية', 'الميرون', 'التناول', 'الاعتراف'], correct: 0 },
        { q: 'كم مرة نصلي المزامير في الأجبية يومياً؟', options: ['5', '7', '9', '12'], correct: 1 },
        { q: 'ما اسم الصلاة قبل النوم؟', options: ['باكر', 'الغروب', 'النوم', 'نصف الليل'], correct: 2 },
        { q: 'ما هو لون ملابس الكهنة في الأعياد؟', options: ['أسود', 'أبيض', 'أحمر', 'ذهبي'], correct: 1 },
        { q: 'كم يوم صوم الميلاد؟', options: ['40', '43', '55', '50'], correct: 1 },
        { q: 'ما اسم القداس الأكثر استخداماً؟', options: ['الباسيلي', 'الغريغوري', 'الكيرلسي', 'المرقسي'], correct: 0 },
        { q: 'متى يبدأ الصوم الكبير؟', options: ['بعد عيد الغطاس', 'قبل القيامة ب55 يوم', 'في شهر مارس', 'بعد عيد الصليب'], correct: 1 },
        { q: 'ما معنى كلمة "أوشية"؟', options: ['صلاة', 'طلبة', 'تسبحة', 'قراءة'], correct: 1 },
        { q: 'ما هو أطول صوم في الكنيسة القبطية؟', options: ['صوم الميلاد', 'الصوم الكبير', 'صوم الرسل', 'صوم العذراء'], correct: 1 },
        { q: 'كم عدد صلوات الأجبية؟', options: ['5', '7', '9', '12'], correct: 1 },
        { q: 'ما معنى كلمة "إفنوتي"؟', options: ['الرب', 'الله', 'القدوس', 'الملك'], correct: 1 },
        { q: 'في أي اتجاه يصلي الأقباط؟', options: ['الشمال', 'الجنوب', 'الشرق', 'الغرب'], correct: 2 }
    ],
    creed: [
        { q: 'كم عدد بنود قانون الإيمان؟', options: ['10', '12', '14', '7'], correct: 1 },
        { q: 'في أي مجمع تم وضع قانون الإيمان؟', options: ['أفسس', 'نيقية', 'خلقيدونية', 'القسطنطينية'], correct: 1 },
        { q: 'ما هي طبيعة المسيح حسب إيماننا؟', options: ['طبيعة واحدة', 'طبيعتان', 'ثلاث طبائع', 'لا طبيعة'], correct: 0 },
        { q: 'من هو مؤسس الكنيسة القبطية؟', options: ['بولس', 'بطرس', 'مرقس', 'يوحنا'], correct: 2 },
        { q: 'ما معنى كلمة "أرثوذكسي"؟', options: ['مسيحي', 'مستقيم الرأي', 'قبطي', 'شرقي'], correct: 1 },
        { q: 'كم عدد أقانيم الثالوث القدوس؟', options: ['1', '2', '3', '4'], correct: 2 },
        { q: 'ما هو مجمع نيقية سنة كام؟', options: ['300', '325', '350', '400'], correct: 1 },
        { q: 'من دافع عن الإيمان ضد أريوس؟', options: ['كيرلس', 'أثناسيوس', 'ديسقوروس', 'ساويرس'], correct: 1 },
        { q: 'ما معنى كلمة "هومو أوسيوس"؟', options: ['مشابه الجوهر', 'واحد الجوهر', 'مختلف الجوهر', 'بلا جوهر'], correct: 1 },
        { q: 'كم عدد المجامع المسكونية التي تعترف بها الكنيسة القبطية؟', options: ['3', '4', '7', '2'], correct: 0 }
    ],
    history: [
        { q: 'في أي سنة تأسست الكنيسة القبطية تقريباً؟', options: ['33 م', '55 م', '100 م', '200 م'], correct: 1 },
        { q: 'من هو بابا الإسكندرية الحالي؟', options: ['شنودة الثالث', 'كيرلس السادس', 'تواضروس الثاني', 'بطرس'], correct: 2 },
        { q: 'أين استشهد مارمرقس؟', options: ['روما', 'أورشليم', 'الإسكندرية', 'أنطاكية'], correct: 2 },
        { q: 'من هو أبو الرهبنة؟', options: ['الأنبا بولا', 'الأنبا أنطونيوس', 'الأنبا مقار', 'الأنبا شنودة'], correct: 1 },
        { q: 'أين يقع دير الأنبا أنطونيوس؟', options: ['الفيوم', 'وادي النطرون', 'البحر الأحمر', 'أسيوط'], correct: 2 },
        { q: 'من هو البابا الذي لقب بعمود الدين؟', options: ['أثناسيوس', 'كيرلس الأول', 'ديسقوروس', 'بطرس'], correct: 0 },
        { q: 'كم عدد باباوات الكنيسة القبطية حتى الآن تقريباً؟', options: ['100', '110', '118', '120'], correct: 2 },
        { q: 'ما هي مدرسة الإسكندرية اللاهوتية؟', options: ['مدرسة حديثة', 'أقدم مدرسة لاهوتية', 'مدرسة كاثوليكية', 'مدرسة بروتستانتية'], correct: 1 },
        { q: 'من هو أول شهيد في المسيحية؟', options: ['بطرس', 'بولس', 'استفانوس', 'يعقوب'], correct: 2 },
        { q: 'متى بدأ التقويم القبطي (تقويم الشهداء)؟', options: ['سنة 1', 'سنة 284 م', 'سنة 325 م', 'سنة 451 م'], correct: 1 }
    ],
    service: [
        { q: 'ما هو هدف مدارس الأحد؟', options: ['اللعب', 'التعليم الديني', 'الرياضة', 'الموسيقى'], correct: 1 },
        { q: 'من أسس مدارس الأحد في مصر؟', options: ['البابا شنودة', 'البابا كيرلس', 'حبيب جرجس', 'نظير جيد'], correct: 2 },
        { q: 'ما هي أهم صفة في الخادم؟', options: ['الذكاء', 'المحبة', 'القوة', 'الغنى'], correct: 1 },
        { q: 'ما هو دور الشماس في الكنيسة؟', options: ['التعليم فقط', 'خدمة المذبح والترتيل', 'الكهنوت', 'الرهبنة'], correct: 1 },
        { q: 'كم سنة خدم حبيب جرجس مدارس الأحد؟', options: ['20', '30', '40', '50'], correct: 2 },
        { q: 'ما هي أفضل وسيلة للخدمة؟', options: ['المال', 'القدوة الحسنة', 'الكلام فقط', 'الترفيه'], correct: 1 },
        { q: 'ما معنى كلمة "دياكون"؟', options: ['كاهن', 'خادم', 'أسقف', 'راهب'], correct: 1 },
        { q: 'ما هو أول شيء يجب أن يفعله الخادم؟', options: ['يقرأ', 'يصلي', 'يلعب', 'ينام'], correct: 1 },
        { q: 'لماذا نخدم في الكنيسة؟', options: ['للشهرة', 'لمحبة المسيح', 'للمال', 'للواجب فقط'], correct: 1 },
        { q: 'من قال "أنا هو الطريق والحق والحياة"؟', options: ['بولس', 'بطرس', 'الرب يسوع', 'موسى'], correct: 2 }
    ]
};

// ============ CONTINUED IN PART 2 ============

// ============ PART 2 BEGINS ============

// ============ TRUE/FALSE DATA ============
const TRUE_FALSE_DATA = [
    { statement: 'عدد أسفار الكتاب المقدس 66 سفراً', answer: false },
    { statement: 'أول معجزة للسيد المسيح كانت تحويل الماء إلى خمر', answer: true },
    { statement: 'عدد تلاميذ المسيح 14 تلميذاً', answer: false },
    { statement: 'الصوم الكبير مدته 55 يوماً', answer: true },
    { statement: 'القديس مرقس هو كاتب أول إنجيل', answer: false },
    { statement: 'سفر المزامير يحتوي على 150 مزموراً', answer: true },
    { statement: 'المعمودية تتم بالتغطيس ثلاث مرات', answer: true },
    { statement: 'عيد القيامة دائماً في شهر أبريل', answer: false },
    { statement: 'البابا كيرلس السادس هو البابا رقم 116', answer: true },
    { statement: 'الكنيسة القبطية أسسها القديس بطرس', answer: false },
    { statement: 'سر الميرون يتم بعد المعمودية مباشرة', answer: true },
    { statement: 'يونان النبي بقي في بطن الحوت 4 أيام', answer: false },
    { statement: 'عدد أسرار الكنيسة سبعة أسرار', answer: true },
    { statement: 'دانيال النبي طُرح في جب الأسود', answer: true },
    { statement: 'الأنبا أنطونيوس هو أبو الرهبان', answer: true },
    { statement: 'عدد الأناجيل في العهد الجديد 5 أناجيل', answer: false },
    { statement: 'القداس الباسيلي هو الأكثر استخداماً', answer: true },
    { statement: 'صوم الرسل مدته ثابتة كل سنة', answer: false },
    { statement: 'الروح القدس حل على التلاميذ يوم الخمسين', answer: true },
    { statement: 'سفر الرؤيا كتبه القديس يوحنا', answer: true },
    { statement: 'أريحا هي أول مدينة فتحها يشوع', answer: true },
    { statement: 'شمشون كان من سبط يهوذا', answer: false },
    { statement: 'يوسف النجار كان من بيت لحم أصلاً', answer: true },
    { statement: 'الكنيسة القبطية تتبع التقويم الغريغوري', answer: false }
];

// ============ MEMORY THEMES ============
const MEMORY_THEMES = [
    {
        name: 'رموز الكنيسة',
        pairs: [
            { a: '✝️', b: 'صليب' },
            { a: '🕊️', b: 'حمامة' },
            { a: '🐟', b: 'سمكة' },
            { a: '🕯️', b: 'شمعة' },
            { a: '📖', b: 'كتاب' },
            { a: '🔔', b: 'جرس' },
            { a: '⭐', b: 'نجمة' },
            { a: '❤️', b: 'قلب' }
        ]
    },
    {
        name: 'شخصيات كتابية',
        pairs: [
            { a: '🏔️', b: 'موسى' },
            { a: '👑', b: 'داود' },
            { a: '🚢', b: 'نوح' },
            { a: '🐋', b: 'يونان' },
            { a: '🌟', b: 'إبراهيم' },
            { a: '🔥', b: 'إيليا' },
            { a: '🌾', b: 'يوسف' },
            { a: '🦁', b: 'شمشون' }
        ]
    },
    {
        name: 'أعياد الكنيسة',
        pairs: [
            { a: '🎄', b: 'الميلاد' },
            { a: '🥚', b: 'القيامة' },
            { a: '💧', b: 'الغطاس' },
            { a: '🌿', b: 'الشعانين' },
            { a: '🔥', b: 'العنصرة' },
            { a: '✨', b: 'التجلي' },
            { a: '👼', b: 'البشارة' },
            { a: '☁️', b: 'العذراء' }
        ]
    }
];

// ============ PSALMS ============
const PSALMS = [
    {
        ref: 'مزمور 23',
        text: 'الرب راعيّ فلا يعوزني شيء. في مراعٍ خضر يربضني. إلى مياه الراحة يوردني. يرد نفسي. يهديني إلى سبل البر من أجل اسمه.',
        missingWords: ['راعيّ', 'يعوزني', 'خضر', 'الراحة', 'نفسي', 'البر']
    },
    {
        ref: 'مزمور 1',
        text: 'طوبى للرجل الذي لم يسلك في مشورة الأشرار وفي طريق الخطاة لم يقف وفي مجلس المستهزئين لم يجلس.',
        missingWords: ['طوبى', 'مشورة', 'الأشرار', 'الخطاة', 'المستهزئين', 'يجلس']
    },
    {
        ref: 'مزمور 51',
        text: 'ارحمني يا الله حسب رحمتك. حسب كثرة رأفتك امح معاصيّ. اغسلني كثيراً من إثمي ومن خطيتي طهرني.',
        missingWords: ['ارحمني', 'رحمتك', 'رأفتك', 'معاصيّ', 'إثمي', 'طهرني']
    },
    {
        ref: 'مزمور 150',
        text: 'هللويا. سبحوا الله في قدسه. سبحوه في فلك قوته. سبحوه على قواته. سبحوه ككثرة عظمته.',
        missingWords: ['هللويا', 'قدسه', 'قوته', 'قواته', 'عظمته', 'سبحوه']
    }
];

// ============ SPOT DIFF SCENES ============
const SPOT_DIFF_SCENES = [
    {
        name: 'الكنيسة',
        items: [
            { x: 120, y: 50, w: 60, h: 80, color: '#8B4513', shape: 'rect', label: 'كنيسة' },
            { x: 140, y: 20, w: 20, h: 30, color: '#FFD700', shape: 'rect', label: 'صليب' },
            { x: 40, y: 100, w: 25, h: 30, color: '#FFA500', shape: 'rect', label: 'شمعة' },
            { x: 220, y: 100, w: 25, h: 30, color: '#FFA500', shape: 'rect', label: 'شمعة' },
            { x: 130, y: 140, w: 40, h: 30, color: '#8B0000', shape: 'rect', label: 'كتاب' },
            { x: 140, y: 5, w: 20, h: 15, color: '#C0C0C0', shape: 'circle', label: 'جرس' }
        ],
        diffs: [
            { index: 2, property: 'missing' },
            { index: 5, property: 'missing' },
            { index: 0, property: 'color', altValue: '#4169E1' }
        ]
    },
    {
        name: 'عيد الميلاد',
        items: [
            { x: 130, y: 10, w: 35, h: 35, color: '#FFD700', shape: 'circle', label: 'نجمة' },
            { x: 130, y: 80, w: 40, h: 50, color: '#DEB887', shape: 'rect', label: 'مذود' },
            { x: 40, y: 130, w: 30, h: 25, color: '#F5F5DC', shape: 'circle', label: 'خروف' },
            { x: 220, y: 130, w: 30, h: 25, color: '#F5F5DC', shape: 'circle', label: 'خروف' },
            { x: 60, y: 30, w: 30, h: 35, color: '#FFFFFF', shape: 'circle', label: 'ملاك' },
            { x: 200, y: 30, w: 30, h: 35, color: '#FFFFFF', shape: 'circle', label: 'ملاك' }
        ],
        diffs: [
            { index: 0, property: 'missing' },
            { index: 4, property: 'missing' },
            { index: 2, property: 'color', altValue: '#808080' }
        ]
    }
];
// ============ MISSING ITEMS DATA ============
const MISSING_ITEMS_DATA = [
    {
        scene: 'أدوات الخدمة',
        items: ['📖', '🕯️', '🔔', '💧', '🍞'],
        question: 'إيه الحاجة الناقصة من أدوات الخدمة؟',
        correct: '✝️',
        choices: ['✝️', '⭐', '🌙', '💎']
    },
    {
        scene: 'شخصيات الكتاب المقدس',
        items: ['👑', '🏔️', '🐋', '🦁', '🌾'],
        question: 'مين الشخصية الناقصة؟',
        correct: '🚢',
        choices: ['🚢', '⛵', '🛶', '🚤']
    },
    {
        scene: 'أسرار الكنيسة',
        items: ['💧', '🍞', '📿', '💒', '✋'],
        question: 'إيه السر الناقص؟',
        correct: '📖',
        choices: ['📖', '🎵', '🕊️', '⭐']
    }
];
// ============ WORD PUZZLES ============
const WORD_PUZZLES = [
    { word: 'محبة', clue: 'أعظم الفضائل المسيحية', letters: ['م','ح','ب','ة','ك','ل','و','ن'] },
    { word: 'إيمان', clue: 'الثقة بما لا نراه', letters: ['إ','ي','م','ا','ن','ه','ب','ت'] },
    { word: 'صلاة', clue: 'حديث مع الله', letters: ['ص','ل','ا','ة','م','ع','و','ك'] },
    { word: 'رجاء', clue: 'الأمل في الحياة الأبدية', letters: ['ر','ج','ا','ء','ب','ت','م','ن'] },
    { word: 'تواضع', clue: 'فضيلة السيد المسيح الأولى', letters: ['ت','و','ا','ض','ع','ب','م','ك'] },
    { word: 'سلام', clue: 'ما تركه المسيح لتلاميذه', letters: ['س','ل','ا','م','ن','و','ك','ب'] },
    { word: 'فداء', clue: 'ما فعله المسيح على الصليب', letters: ['ف','د','ا','ء','م','ب','ت','ل'] },
    { word: 'نعمة', clue: 'عطية الله المجانية', letters: ['ن','ع','م','ة','ب','ك','ت','ل'] }
];

// ============ CONNECT PAIRS DATA ============
const CONNECT_PAIRS_DATA = [
    {
        title: 'شخصيات وأحداث',
        pairs: [
            { left: 'موسى', right: 'شق البحر' },
            { left: 'نوح', right: 'الفلك' },
            { left: 'داود', right: 'جليات' },
            { left: 'دانيال', right: 'جب الأسود' },
            { left: 'يونان', right: 'الحوت' },
            { left: 'إبراهيم', right: 'تقديم إسحق' }
        ]
    },
    {
        title: 'أسرار الكنيسة',
        pairs: [
            { left: 'المعمودية', right: 'الماء' },
            { left: 'الميرون', right: 'الزيت المقدس' },
            { left: 'التناول', right: 'الجسد والدم' },
            { left: 'الاعتراف', right: 'التوبة' },
            { left: 'الكهنوت', right: 'وضع اليد' },
            { left: 'الزيجة', right: 'الإكليل' }
        ]
    },
    {
        title: 'رموز ومعاني',
        pairs: [
            { left: 'الحمامة', right: 'الروح القدس' },
            { left: 'الصليب', right: 'الفداء' },
            { left: 'السمكة', right: 'المسيحية' },
            { left: 'الخبز', right: 'جسد المسيح' },
            { left: 'الماء', right: 'الحياة' },
            { left: 'النور', right: 'المسيح' }
        ]
    }
];

// ============ ORDER EVENTS DATA ============
const ORDER_EVENTS_DATA = [
    {
        title: 'أحداث حياة المسيح',
        events: ['الميلاد في بيت لحم', 'الهروب إلى مصر', 'المعمودية في الأردن', 'التجربة على الجبل', 'معجزة عرس قانا', 'الصلب والقيامة']
    },
    {
        title: 'أحداث العهد القديم',
        events: ['خلق آدم وحواء', 'طوفان نوح', 'دعوة إبراهيم', 'خروج بني إسرائيل من مصر', 'دخول أرض الموعد', 'بناء الهيكل']
    },
    {
        title: 'أسبوع الآلام',
        events: ['سبت لعازر', 'أحد الشعانين', 'أربعاء أيوب', 'خميس العهد', 'الجمعة العظيمة', 'سبت النور']
    },
    {
        title: 'القداس الإلهي',
        events: ['تقديم الحمل', 'صلاة الصلح', 'قراءة الإنجيل', 'صلاة الاعتراف', 'التقديس', 'التوزيع']
    }
];

// ============ PICTURE GUESS DATA ============
const PICTURE_GUESS_DATA = [
    { name: 'صليب', question: 'ما هذا الرمز؟', correct: 'صليب', choices: ['صليب', 'نجمة', 'هلال', 'مفتاح'], draw: 'drawCross' },
    { name: 'سمكة', question: 'ما هذا الرمز؟', correct: 'سمكة', choices: ['سمكة', 'قارب', 'طائر', 'ورقة'], draw: 'drawFish' },
    { name: 'كنيسة', question: 'ما هذا المبنى؟', correct: 'كنيسة', choices: ['كنيسة', 'مدرسة', 'بيت', 'قلعة'], draw: 'drawChurch' },
    { name: 'شمعة', question: 'ما هذا الشيء؟', correct: 'شمعة', choices: ['شمعة', 'مصباح', 'برج', 'عمود'], draw: 'drawCandle' },
    { name: 'حمامة', question: 'ما هذا الرمز؟', correct: 'حمامة', choices: ['حمامة', 'نسر', 'فراشة', 'سمكة'], draw: 'drawDove' },
    { name: 'كتاب', question: 'ما هذا الشيء؟', correct: 'كتاب مقدس', choices: ['كتاب مقدس', 'دفتر', 'لوح', 'رسالة'], draw: 'drawBible' }
];
// Picture draw functions
const PIC_DRAW_FNS = {
    drawCross: function(ctx, w, h, reveal) {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#8B4513';
        const cx = w/2, cy = h/2;
        if (reveal >= 0.25) { ctx.fillRect(cx - 8, cy - 50, 16, 100); }
        if (reveal >= 0.5) { ctx.fillRect(cx - 35, cy - 25, 70, 16); }
        if (reveal >= 0.75) {
            ctx.strokeStyle = '#DAA520';
            ctx.lineWidth = 2;
            ctx.strokeRect(cx - 10, cy - 52, 20, 104);
            ctx.strokeRect(cx - 37, cy - 27, 74, 20);
        }
        if (reveal >= 1) {
            ctx.fillStyle = '#FFD700';
            ctx.beginPath(); ctx.arc(cx, cy - 50, 6, 0, Math.PI * 2); ctx.fill();
        }
    },
    drawFish: function(ctx, w, h, reveal) {
        ctx.clearRect(0, 0, w, h);
        const cx = w/2, cy = h/2;
        ctx.strokeStyle = '#1E90FF';
        ctx.lineWidth = 3;
        if (reveal >= 0.25) {
            ctx.beginPath();
            ctx.ellipse(cx, cy, 50, 25, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
        if (reveal >= 0.5) {
            ctx.beginPath();
            ctx.moveTo(cx + 45, cy);
            ctx.lineTo(cx + 70, cy - 20);
            ctx.lineTo(cx + 70, cy + 20);
            ctx.closePath();
            ctx.stroke();
        }
        if (reveal >= 0.75) {
            ctx.fillStyle = '#1E90FF';
            ctx.beginPath(); ctx.arc(cx - 20, cy - 5, 4, 0, Math.PI * 2); ctx.fill();
        }
        if (reveal >= 1) {
            ctx.fillStyle = 'rgba(30,144,255,0.2)';
            ctx.beginPath();
            ctx.ellipse(cx, cy, 50, 25, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    },
    drawChurch: function(ctx, w, h, reveal) {
        ctx.clearRect(0, 0, w, h);
        const cx = w/2;
        ctx.fillStyle = '#D2691E';
        if (reveal >= 0.25) { ctx.fillRect(cx - 40, h/2 - 20, 80, 60); }
        if (reveal >= 0.5) {
            ctx.beginPath();
            ctx.moveTo(cx - 45, h/2 - 20);
            ctx.lineTo(cx, h/2 - 60);
            ctx.lineTo(cx + 45, h/2 - 20);
            ctx.closePath();
            ctx.fillStyle = '#A0522D'; ctx.fill();
        }
        if (reveal >= 0.75) {
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(cx + 1, h/2 - 80, 4, 20);
            ctx.fillRect(cx - 6, h/2 - 74, 18, 4);
        }
        if (reveal >= 1) {
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(cx - 8, h/2 + 10, 16, 30);
            ctx.fillStyle = '#87CEEB';
            ctx.beginPath(); ctx.arc(cx, h/2 - 5, 8, 0, Math.PI * 2); ctx.fill();
        }
    },
    drawCandle: function(ctx, w, h, reveal) {
        ctx.clearRect(0, 0, w, h);
        const cx = w/2, cy = h/2;
        if (reveal >= 0.25) {
            ctx.fillStyle = '#FFFDD0';
            ctx.fillRect(cx - 10, cy - 20, 20, 60);
        }
        if (reveal >= 0.5) {
            ctx.fillStyle = '#FF8C00';
            ctx.beginPath();
            ctx.ellipse(cx, cy - 30, 8, 14, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        if (reveal >= 0.75) {
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.ellipse(cx, cy - 32, 4, 8, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        if (reveal >= 1) {
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(cx - 14, cy + 40, 28, 6);
        }
    },
    drawDove: function(ctx, w, h, reveal) {
        ctx.clearRect(0, 0, w, h);
        const cx = w/2, cy = h/2;
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 2;
        if (reveal >= 0.25) {
            ctx.beginPath();
            ctx.ellipse(cx, cy, 25, 18, 0, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
        }
        if (reveal >= 0.5) {
            ctx.beginPath();
            ctx.ellipse(cx - 25, cy - 10, 12, 9, -0.3, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
        }
        if (reveal >= 0.75) {
            ctx.beginPath();
            ctx.moveTo(cx + 20, cy - 8);
            ctx.quadraticCurveTo(cx + 50, cy - 30, cx + 45, cy);
            ctx.quadraticCurveTo(cx + 40, cy + 5, cx + 20, cy + 5);
            ctx.fill(); ctx.stroke();
        }
        if (reveal >= 1) {
            ctx.fillStyle = '#333';
            ctx.beginPath(); ctx.arc(cx - 30, cy - 12, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#FFA500';
            ctx.beginPath();
            ctx.moveTo(cx - 37, cy - 8);
            ctx.lineTo(cx - 44, cy - 6);
            ctx.lineTo(cx - 37, cy - 4);
            ctx.closePath(); ctx.fill();
        }
    },
    drawBible: function(ctx, w, h, reveal) {
        ctx.clearRect(0, 0, w, h);
        const cx = w/2, cy = h/2;
        if (reveal >= 0.25) {
            ctx.fillStyle = '#8B0000';
            ctx.fillRect(cx - 35, cy - 25, 70, 50);
        }
        if (reveal >= 0.5) {
            ctx.fillStyle = '#A52A2A';
            ctx.fillRect(cx - 38, cy - 25, 6, 50);
        }
        if (reveal >= 0.75) {
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 2;
            ctx.strokeRect(cx - 28, cy - 18, 54, 36);
        }
        if (reveal >= 1) {
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy - 10);
            ctx.lineTo(cx, cy + 10);
            ctx.moveTo(cx - 8, cy);
            ctx.lineTo(cx + 8, cy);
            ctx.stroke();
        }
    }
};

// ============ MAZE DATA ============
const MAZE_DATA = [
    {
        keys: 2,
        grid: [
            [4,0,1,1,1,1,1],
            [1,0,0,0,1,0,1],
            [1,0,1,0,0,0,1],
            [1,0,1,1,1,0,1],
            [1,0,0,2,1,0,1],
            [1,1,1,0,0,2,1],
            [1,1,1,1,1,0,3]
        ]
    },
    {
        keys: 3,
        grid: [
            [4,0,1,1,1,1,1,1,1],
            [1,0,0,0,1,0,0,0,1],
            [1,0,1,0,1,0,1,0,1],
            [1,0,1,2,0,0,1,0,1],
            [1,0,1,1,1,0,1,0,1],
            [1,0,0,0,1,0,0,2,1],
            [1,1,1,0,1,1,1,0,1],
            [1,2,0,0,0,0,0,0,1],
            [1,1,1,1,1,1,1,0,3]
        ]
    },
    {
        keys: 3,
        grid: [
            [1,1,1,1,4,1,1,1,1,1,1],
            [1,0,0,0,0,0,1,0,0,0,1],
            [1,0,1,1,1,0,1,0,1,0,1],
            [1,0,1,2,0,0,0,0,1,0,1],
            [1,0,1,1,1,1,1,0,1,0,1],
            [1,0,0,0,0,0,0,0,1,0,1],
            [1,1,1,0,1,1,1,1,1,0,1],
            [1,0,0,0,0,2,1,0,0,0,1],
            [1,0,1,1,1,0,1,0,1,1,1],
            [1,0,0,0,1,0,0,0,2,0,1],
            [1,1,1,1,1,1,1,1,1,0,3]
        ]
    }
];
// ============ RANKS ============
const RANKS = [
    { min: 0, title: 'مبتدئ', emoji: '🌱' },
    { min: 10, title: 'تلميذ', emoji: '📖' },
    { min: 25, title: 'خادم', emoji: '🕯️' },
    { min: 50, title: 'محارب', emoji: '⚔️' },
    { min: 80, title: 'فارس', emoji: '🛡️' },
    { min: 120, title: 'بطل', emoji: '🏆' },
    { min: 170, title: 'قائد', emoji: '👑' },
    { min: 230, title: 'بطل الإيمان', emoji: '✝️' }
];

// ============ ACHIEVEMENTS ============
const ACHIEVEMENTS = [
    { id: 'first_win', name: 'أول انتصار', icon: '🎯', desc: 'أكمل أول مرحلة', check: () => GameState.totalCorrect >= 1 },
    { id: 'streak5', name: 'سلسلة 5', icon: '🔥', desc: 'حقق سلسلة صحيحة من 5', check: () => GameState.bestStreak >= 5 },
    { id: 'streak10', name: 'سلسلة 10', icon: '💥', desc: 'حقق سلسلة صحيحة من 10', check: () => GameState.bestStreak >= 10 },
    { id: 'stars50', name: 'جامع النجوم', icon: '⭐', desc: 'اجمع 50 نجمة', check: () => GameState.stars >= 50 },
    { id: 'stars100', name: 'نجم ساطع', icon: '🌟', desc: 'اجمع 100 نجمة', check: () => GameState.stars >= 100 },
    { id: 'perfect3', name: 'مثالي', icon: '💎', desc: 'أكمل 3 مراحل بنتيجة كاملة', check: () => GameState.perfectLevels >= 3 },
    { id: 'gems50', name: 'جامع الجواهر', icon: '💰', desc: 'اجمع 50 جوهرة', check: () => GameState.gems >= 50 },
    { id: 'all_chars', name: 'الفريق الكامل', icon: '👥', desc: 'افتح جميع الشخصيات', check: () => Object.values(CHARACTERS).every(c => c.unlocked) },
    { id: 'games10', name: 'مثابر', icon: '🎮', desc: 'العب 10 مرات', check: () => GameState.gamesPlayed >= 10 },
    { id: 'armor3', name: 'محارب الإيمان', icon: '🛡️', desc: 'اشترِ 3 قطع درع', check: () => GameState.armor.length >= 3 },
    { id: 'mission1', name: 'أول مهمة', icon: '📋', desc: 'أكمل أول مهمة', check: () => GameState.missionsCompleted >= 1 },
    { id: 'mission3', name: 'خادم نشيط', icon: '🙏', desc: 'أكمل 3 مهمات', check: () => GameState.missionsCompleted >= 3 }
];


// ============ PART 2B: GAME LOGIC ============

// --- Utilities ---
function showToast(msg, durOrType, type) {
    var dur = 2500;
    var toastType = '';
    if (typeof durOrType === 'string') {
        toastType = durOrType;
    } else if (typeof durOrType === 'number') {
        dur = durOrType;
        if (type) toastType = type;
    }
    // Errors stay longer and are more prominent
    if (toastType === 'error') dur = 4000;
    // Scroll to top so the toast is always visible
    if (toastType === 'error' || toastType === 'warning') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        var activeScreen = document.querySelector('.screen.active');
        if (activeScreen) activeScreen.scrollTop = 0;
    }
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show' + (toastType ? ' ' + toastType : '');
    setTimeout(function() { t.className = 'toast'; }, dur);
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
    var el = document.getElementById(id);
    if (el) {
        el.classList.add('active');
        // Scroll to top on every screen change
        el.scrollTop = 0;
        var inner = el.querySelector('.screen-inner');
        if (inner) inner.scrollTop = 0;
    }
    window.scrollTo(0, 0);
    var fabScreens = ['map-screen','category-screen','shop-screen','leaderboard-screen','settings-screen','lamp-screen','rewards-shop-screen'];
    var fab = document.getElementById('fab-container');
    if (fab) fab.style.display = fabScreens.indexOf(id) >= 0 ? 'flex' : 'none';
    // Hide lamp fixed element when leaving lamp screen
    var lampBottom = document.getElementById('lamp-fixed-bottom');
    if (lampBottom) lampBottom.style.display = (id === 'lamp-screen') ? 'block' : 'none';
    if (id === 'home-hub-screen') {
        renderHomeHub();
        updateSpiritualBadges();
        // Auto-open verse wheel on first visit today
        var todayKey = getTodayKey ? getTodayKey() : new Date().toISOString().split('T')[0];
        if (GameState.playerPhone && GameState.todayVerseSpinDate !== todayKey) {
            setTimeout(function() { openVerseWheel(); }, 800);
        }
    }
    if (id === 'map-screen') renderMap();
    if (id === 'paul-journey-screen') renderPaulMap();
    if (id === 'lamp-screen') renderLampScreen();
    if (id === 'character-screen') renderCharacters();
    if (id === 'shop-screen') renderShop();
    if (id === 'leaderboard-screen') renderLeaderboard();
    if (id === 'settings-screen') renderSettings();
    if (id === 'level2-subjects-screen') renderLevel2Subjects();
    if (id === 'level2-map-screen') renderLevel2Map();
    if (id === 'bible-reading-screen') renderBibleReading();
    if (id === 'devotion-screen') renderDevotion();
    if (id === 'exercises-screen') renderExercises();
    if (id === 'compete-screen') renderCompeteHub();
    if (id === 'rewards-shop-screen') { renderRewardsShop(); }
    if (id === 'teams-screen') { renderTeamsScreen(); }
}

function createParticles() {
    var c = document.getElementById('particles');
    if (!c) return;
    c.innerHTML = '';

    // Regular circle particles
    for (var i = 0; i < 20; i++) {
        var p = document.createElement('div');
        p.className = 'particle';
        p.style.left = Math.random()*100 + '%';
        p.style.animationDelay = Math.random()*15 + 's';
        p.style.animationDuration = (15+Math.random()*10) + 's';
        p.style.opacity = Math.random()*0.3+0.05;
        p.style.width = p.style.height = (3+Math.random()*6)+'px';
        c.appendChild(p);
    }

    // Themed shape particles (crosses, stars, books)
    var shapeClasses = ['particle-cross', 'particle-star', 'particle-book'];
    for (var s = 0; s < 8; s++) {
        var sp = document.createElement('div');
        sp.className = shapeClasses[s % shapeClasses.length];
        sp.style.left = Math.random() * 100 + '%';
        sp.style.animationDelay = Math.random() * 20 + 's';
        sp.style.animationDuration = (20 + Math.random() * 15) + 's';
        sp.style.fontSize = (14 + Math.random() * 12) + 'px';
        c.appendChild(sp);
    }
}

function getRank() {
    var rank = RANKS[0];
    for (var i = 0; i < RANKS.length; i++) {
        if (GameState.stars >= RANKS[i].min) rank = RANKS[i];
    }
    return rank;
}

function saveGame() { saveToCloud(); }

// --- Login (handled by submitRegister above) ---

// --- Character Select ---
var selectedCharKey = null;

function renderCharacters() {
    var grid = document.getElementById('characters-grid');
    grid.innerHTML = '';
    var keys = Object.keys(CHARACTERS);
    keys.forEach(function(key) {
        var ch = CHARACTERS[key];
        var tier = getCharacterTier(key);
        var tierData = CHARACTER_TIERS[tier];
        var nextTier = tier === 'bronze' ? 'silver' : tier === 'silver' ? 'gold' : null;
        var nextTierData = nextTier ? CHARACTER_TIERS[nextTier] : null;
        var isGold = tier === 'gold';

        var card = document.createElement('div');
        card.className = 'char-card' + (key === GameState.character ? ' selected' : '') + (ch.unlocked ? '' : ' locked') + ' char-tier-' + tier;

        var inner = '<div class="char-tier-badge" style="background:' + tierData.color + ';color:#1a1a2e">' + tierData.emoji + ' ' + tierData.name + '</div>';
        inner += '<div class="char-avatar-wrap' + (isGold ? ' char-avatar-gold' : '') + '" style="border-color:' + tierData.color + '">';
        inner += '<img class="char-img" src="'+ch.image+'" alt="'+ch.name+'" onerror="this.style.display=\'none\'">';
        inner += '</div>';
        inner += '<h3>' + ch.name + '</h3>';
        if (isGold && CHARACTER_GOLD_TITLES[key]) {
            inner += '<p class="char-gold-title">' + CHARACTER_GOLD_TITLES[key] + '</p>';
        }
        inner += '<p class="char-role">' + ch.role + '</p>';
        inner += '<p class="char-ability"><i class="fas fa-star"></i> ' + ch.ability + '</p>';
        if (ch.power) {
            inner += '<div class="char-power-info"><span class="char-power-icon">' + ch.power.icon + '</span> ' + ch.power.name + ' <span class="char-power-cost">(' + ch.power.cost + ' ' + (ch.power.costType === 'stars' ? '⭐' : '💎') + ')</span></div>';
        }

        if (!ch.unlocked) {
            inner += '<div class="char-lock"><i class="fas fa-lock"></i> ' + (ch.cost||0) + ' ⭐</div>';
        } else if (nextTierData) {
            inner += '<button class="btn btn-small char-upgrade-btn" style="background:linear-gradient(135deg,' + nextTierData.color + ',' + tierData.color + ');color:#1a1a2e" onclick="event.stopPropagation();upgradeCharacterTier(\'' + key + '\')">';
            inner += '<span>⬆️ ترقية لـ ' + nextTierData.name + ' (' + nextTierData.starsNeeded + ' ⭐)</span></button>';
        } else {
            inner += '<div class="char-max-tier">🥇 أعلى مستوى!</div>';
        }

        card.innerHTML = inner;
        (function(k, c, el) {
            el.onclick = function() {
                if (!CHARACTERS[k].unlocked) {
                    if (GameState.stars >= (CHARACTERS[k].cost||0)) {
                        CHARACTERS[k].unlocked = true;
                        GameState.stars -= (CHARACTERS[k].cost||0);
                        showToast('تم فتح ' + CHARACTERS[k].name);
                        launchConfetti(1500);
                        renderCharacters();
                    } else {
                        showToast('محتاج ' + (CHARACTERS[k].cost||0) + ' نجمة لفتح ' + CHARACTERS[k].name);
                    }
                    return;
                }
                selectedCharKey = k;
                document.querySelectorAll('.char-card').forEach(function(cc) { cc.classList.remove('selected'); });
                el.classList.add('selected');
                document.getElementById('btn-select-char').disabled = false;
                document.getElementById('btn-select-char').classList.remove('btn-locked');
            };
        })(key, ch, card);
        grid.appendChild(card);
    });
    if (GameState.character) selectedCharKey = GameState.character;
}

function confirmCharacter() {
    if (selectedCharKey) {
        GameState.character = selectedCharKey;
        saveGame();
        showScreen('home-hub-screen');
        checkPendingRoomJoin();
    }
}

// --- Map ---
function renderMap() {
    applyMapTheme();
    document.getElementById('map-player-name').textContent = GameState.playerName;
    var rank = getRank();
    document.getElementById('map-rank').textContent = rank.emoji + ' ' + rank.title;
    document.getElementById('map-stars').textContent = GameState.stars;
    document.getElementById('map-streak').textContent = GameState.streak;
    document.getElementById('map-gems').textContent = GameState.gems;
    var avatarImg = document.getElementById('avatar-img');
    var ch = CHARACTERS[GameState.character];
    if (avatarImg && ch) { avatarImg.src = ch.image; avatarImg.alt = ch.name; }

    // Daily Verse
    var verse = getDailyVerse();
    var dvText = document.getElementById('dv-text');
    var dvRef = document.getElementById('dv-ref');
    if (dvText && verse) { dvText.textContent = verse.text; }
    if (dvRef && verse) { dvRef.textContent = verse.ref; }
    var dvStatus = document.getElementById('dv-status');
    if (dvStatus) {
        if (isDailyVerseCompleted()) {
            dvStatus.innerHTML = '<span class="status-badge completed"><i class="fas fa-check-circle"></i> تم</span>';
        } else {
            dvStatus.innerHTML = '<span class="status-badge pending"><i class="fas fa-arrow-left"></i> اضغط</span>';
        }
    }

    // Weekly Challenge
    var challenge = getWeeklyChallenge();
    var wcTitle = document.getElementById('wc-title');
    var wcDesc = document.getElementById('wc-desc');
    var wcReward = document.getElementById('wc-reward');
    if (wcTitle && challenge) { wcTitle.textContent = challenge.title; }
    if (wcDesc && challenge) { wcDesc.textContent = challenge.description; }
    if (wcReward && challenge) { wcReward.textContent = '+' + challenge.reward + ' نجوم'; }
    var wcStatus = document.getElementById('wc-status');
    if (wcStatus) {
        if (isWeeklyChallengeCompleted()) {
            wcStatus.innerHTML = '<span class="status-badge completed"><i class="fas fa-check-circle"></i> تم</span>';
        } else {
            wcStatus.innerHTML = '<span class="status-badge pending"><i class="fas fa-arrow-left"></i> اضغط</span>';
        }
    }

    var path = document.getElementById('levels-path');
    path.innerHTML = '';
    var icons = {quiz:'fa-question-circle',psalm:'fa-scroll',spotdiff:'fa-magnifying-glass',memory:'fa-brain',truefalse:'fa-bolt',imgpuzzle:'fa-puzzle-piece',missing:'fa-question',puzzle:'fa-spell-check',connect:'fa-link',maze:'fa-route',picguess:'fa-image',order:'fa-sort-numeric-down',mission:'fa-clipboard-check'};
    var colors = {quiz:'#4CAF50',psalm:'#9C27B0',spotdiff:'#FF9800',memory:'#2196F3',truefalse:'#F44336',imgpuzzle:'#00BCD4',missing:'#E91E63',puzzle:'#FF5722',connect:'#3F51B5',maze:'#795548',picguess:'#607D8B',order:'#009688',mission:'#FF6B35'};
    LEVELS.forEach(function(lv, i) {
        var num = i + 1;
        var ld = GameState.levelsData[num] || {};
        var unlocked = num <= GameState.currentLevel;
        var completed = !!ld.completed;
        var starsE = ld.stars || 0;
        var node = document.createElement('div');
        var isMission = lv.type === 'mission';
        node.className = 'level-node' + (unlocked?' unlocked':'') + (completed?' completed':'') + (num===GameState.currentLevel && !completed?' current':'') + (isMission?' mission-node':'');
        var starStr = '';
        for (var s = 0; s < 3; s++) starStr += s < starsE ? '⭐' : '☆';
        var badgeHtml = '';
        if (isMission) badgeHtml = '<span class="level-badge badge-mission">📋 مهمة</span>';
        node.innerHTML = '<div class="level-circle" style="'+(unlocked?'border-color:'+(colors[lv.type]||'#4CAF50'):'')+'"><i class="fas '+(icons[lv.type]||'fa-question-circle')+'"></i><span class="level-num">'+num+'</span></div><p class="level-name">'+lv.name+'</p><div class="level-stars">'+starStr+'</div>' + (lv.starsNeeded>0 ? '<span class="level-req">'+lv.starsNeeded+'⭐ مطلوب</span>' : '') + badgeHtml;
        if (unlocked) { (function(n) { node.onclick = function() { startLevel(n); }; })(num); }
        path.appendChild(node);
        if (i < LEVELS.length - 1) {
            var conn = document.createElement('div');
            conn.className = 'level-connector' + (completed?' completed':'');
            path.appendChild(conn);
        }
    });
}

function startLevel(num) {
    var lv = LEVELS[num-1];
    if (!lv) return;
    if (GameState.stars < lv.starsNeeded) { showToast('محتاج ' + lv.starsNeeded + ' نجمة لفتح المرحلة دي'); return; }
    quizState.currentLevel = num;
    var t = lv.type;
    if (t==='quiz') { showScreen('category-screen'); document.getElementById('level-label').textContent = 'المرحلة '+num+': '+lv.name; renderCategories(lv); }
    else if (t==='psalm') startPsalm(num);
    else if (t==='spotdiff') startSpotDiff(num);
    else if (t==='memory') startMemory(num);
    else if (t==='truefalse') startTrueFalse(num);
    else if (t==='imgpuzzle') startImgPuzzle(num);
    else if (t==='missing') startMissing(num);
    else if (t==='puzzle') startWordPuzzle(num);
    else if (t==='connect') startConnect(num);
    else if (t==='maze') startMaze(num);
    else if (t==='picguess') startPicGuess(num);
    else if (t==='order') startOrder(num);
    else if (t==='mission') startMission(num);
    else { showScreen('category-screen'); renderCategories(lv); }
}

function renderCategories(level) {
    var grid = document.getElementById('categories-grid');
    grid.innerHTML = '';
    CATEGORIES.forEach(function(cat) {
        var card = document.createElement('div');
        card.className = 'category-card';
        card.innerHTML = '<span class="cat-icon">'+cat.icon+'</span><h3>'+cat.name+'</h3>';
        (function(c,l) { card.onclick = function() { startQuiz(c.id, l); }; })(cat, level);
        grid.appendChild(card);
    });
}

// --- Quiz Engine ---
var quizState = { questions:[], currentIndex:0, score:0, correctCount:0, timer:null, timeLeft:30, currentLevel:null, currentCategory:null, answered:false, doublePoints:false, frozen:false };

function startQuiz(catId, level) {
    var pool = QUESTIONS[catId] || [];
    if (pool.length === 0) { showToast('مفيش أسئلة في الفئة دي'); return; }
    var shuffled = pool.slice().sort(function() { return Math.random()-0.5; });
    var count = level ? (level.questions || 5) : 5;
    quizState.questions = shuffled.slice(0, count);
    quizState.currentIndex = 0;
    quizState.score = 0;
    quizState.correctCount = 0;
    quizState.answered = false;
    quizState.doublePoints = false;
    quizState.frozen = false;
    quizState.timeLeft = level ? (level.timePerQ || 30) : 30;
    quizState.currentCategory = catId;
    var catObj = CATEGORIES.find(function(c) { return c.id === catId; });
    document.getElementById('quiz-category-label').textContent = catObj ? catObj.icon + ' ' + catObj.name : '';
    showScreen('quiz-screen');
    renderPowerUps();
    showQuestion();
}

function showQuestion() {
    if (quizState.currentIndex >= quizState.questions.length) { showResults(); return; }
    quizState.answered = false;
    var q = quizState.questions[quizState.currentIndex];
    document.getElementById('question-text').textContent = q.q;
    document.getElementById('quiz-question-num').textContent = (quizState.currentIndex+1) + ' / ' + quizState.questions.length;
    var pct = ((quizState.currentIndex) / quizState.questions.length) * 100;
    document.getElementById('quiz-progress-fill').style.width = pct + '%';
    // Image
    var imgC = document.getElementById('question-image-container');
    if (q.image) { imgC.style.display = 'block'; document.getElementById('question-image').src = q.image; }
    else { imgC.style.display = 'none'; }
    // Options
    var grid = document.getElementById('answers-grid');
    grid.innerHTML = '';
    q.options.forEach(function(opt, idx) {
        var btn = document.createElement('button');
        btn.className = 'answer-btn';
        btn.textContent = opt;
        (function(i) { btn.onclick = function() { selectAnswer(i); }; })(idx);
        grid.appendChild(btn);
    });
    // Timer
    quizState.timeLeft = LEVELS[quizState.currentLevel-1] ? (LEVELS[quizState.currentLevel-1].timePerQ || 30) : 30;
    startTimer();
}

function startTimer() {
    if (quizState.timer) clearInterval(quizState.timer);
    document.getElementById('timer-value').textContent = quizState.timeLeft;
    quizState.timer = setInterval(function() {
        if (quizState.frozen) return;
        quizState.timeLeft--;
        document.getElementById('timer-value').textContent = quizState.timeLeft;
        if (quizState.timeLeft <= 0) {
            clearInterval(quizState.timer);
            if (!quizState.answered) {
                quizState.answered = true;
                GameState.streak = 0;
                // Highlight correct
                var btns = document.querySelectorAll('.answer-btn');
                var q = quizState.questions[quizState.currentIndex];
                btns.forEach(function(b, i) { if (i === q.correct) b.classList.add('correct'); });
                GameState.totalAnswered++;
                setTimeout(function() { quizState.currentIndex++; showQuestion(); }, 1500);
            }
        }
    }, 1000);
}

function selectAnswer(idx) {
    if (quizState.answered) return;
    quizState.answered = true;
    if (quizState.timer) clearInterval(quizState.timer);
    var q = quizState.questions[quizState.currentIndex];
    var btns = document.querySelectorAll('.answer-btn');
    GameState.totalAnswered++;
    if (idx === q.correct) {
        btns[idx].classList.add('correct');
        var pts = quizState.doublePoints ? 20 : 10;
        quizState.score += pts;
        quizState.correctCount++;
        GameState.streak++;
        if (GameState.streak > GameState.bestStreak) GameState.bestStreak = GameState.streak;
        GameState.totalCorrect++;
    } else {
        btns[idx].classList.add('wrong');
        btns[q.correct].classList.add('correct');
        GameState.streak = 0;
    }
    quizState.doublePoints = false;
    setTimeout(function() { quizState.currentIndex++; showQuestion(); }, 1200);
}

function renderPowerUps() {
    var pu = document.getElementById('power-ups');
    pu.innerHTML = '';
    var items = [
        {key:'fiftyFifty', icon:'fa-divide', label:'50/50', count: GameState.powerUps.fiftyFifty},
        {key:'skip', icon:'fa-forward', label:'تخطي', count: GameState.powerUps.skip},
        {key:'doublePoints', icon:'fa-star', label:'مضاعفة', count: GameState.powerUps.doublePoints},
        {key:'freeze', icon:'fa-snowflake', label:'تجميد', count: GameState.powerUps.freeze},
        {key:'hint', icon:'fa-lightbulb', label:'تلميح', count: GameState.powerUps.hint}
    ];
    items.forEach(function(item) {
        var btn = document.createElement('button');
        btn.className = 'power-up-btn' + (item.count <= 0 ? ' disabled' : '');
        btn.innerHTML = '<i class="fas '+item.icon+'"></i><span>'+item.label+'</span><span class="pu-count">'+item.count+'</span>';
        btn.disabled = item.count <= 0;
        (function(k) { btn.onclick = function() { usePowerUp(k); }; })(item.key);
        pu.appendChild(btn);
    });
}

function usePowerUp(type) {
    if (quizState.answered) return;
    if (GameState.powerUps[type] <= 0) return;
    GameState.powerUps[type]--;
    var q = quizState.questions[quizState.currentIndex];
    if (type === 'fiftyFifty') {
        var btns = document.querySelectorAll('.answer-btn');
        var wrong = [];
        q.options.forEach(function(o, i) { if (i !== q.correct) wrong.push(i); });
        wrong.sort(function() { return Math.random()-0.5; });
        for (var i = 0; i < 2 && i < wrong.length; i++) {
            btns[wrong[i]].style.visibility = 'hidden';
        }
    } else if (type === 'skip') {
        quizState.answered = true;
        clearInterval(quizState.timer);
        quizState.currentIndex++;
        showQuestion();
    } else if (type === 'doublePoints') {
        quizState.doublePoints = true;
        showToast('النقاط مضاعفة في السؤال ده!');
    } else if (type === 'freeze') {
        quizState.frozen = true;
        setTimeout(function() { quizState.frozen = false; }, 10000);
        showToast('الوقت متجمد 10 ثواني!');
    } else if (type === 'hint') {
        if (q.hint) showToast('💡 ' + q.hint, 4000);
        else showToast('مفيش تلميح للسؤال ده');
    }
    renderPowerUps();
}

// --- Results ---
function showResults() {
    clearInterval(quizState.timer);
    var total = quizState.questions.length;
    var pct = total > 0 ? Math.round((quizState.correctCount / total) * 100) : 0;
    var stars = pct >= 90 ? 3 : pct >= 60 ? 2 : pct >= 30 ? 1 : 0;
    var gemsEarned = stars * 5 + quizState.correctCount * 2;
    
    document.getElementById('result-icon').innerHTML = stars >= 3 ? '🏆' : stars >= 2 ? '⭐' : stars >= 1 ? '👍' : '😢';
    document.getElementById('result-title').textContent = stars >= 3 ? 'ممتاز يا بطل!' : stars >= 2 ? 'أحسنت!' : stars >= 1 ? 'محتاج تحاول أكتر' : 'حاول مرة تانية';
    document.getElementById('result-subtitle').textContent = quizState.correctCount + ' من ' + total + ' إجابة صحيحة (' + pct + '%)';
    
    document.getElementById('result-stats').innerHTML = '<div class="result-stat"><span class="stat-num">'+quizState.score+'</span><span>نقاط</span></div><div class="result-stat"><span class="stat-num">'+stars+'</span><span>نجوم</span></div><div class="result-stat"><span class="stat-num">'+gemsEarned+'</span><span>جواهر</span></div>';
    document.getElementById('result-rewards').innerHTML = '<p>⭐ +'+stars+' نجوم | 💎 +'+gemsEarned+' جواهر</p>';
    
    completeLevel(stars, gemsEarned);
    if (stars >= 2) confetti();
    showScreen('result-screen');
    GameState.gamesPlayed++;
    checkAchievements();
    saveGame();
}

function completeLevel(stars, gems) {
    var num = quizState.currentLevel;
    if (!GameState.levelsData[num]) GameState.levelsData[num] = {};
    var prev = GameState.levelsData[num].stars || 0;
    if (stars > prev) {
        GameState.stars += (stars - prev);
        GameState.levelsData[num].stars = stars;
    }
    GameState.gems += gems;
    GameState.levelsData[num].completed = true;
    if (stars === 3) GameState.perfectLevels++;
    if (num >= GameState.currentLevel && num < LEVELS.length) {
        GameState.currentLevel = num + 1;
    }
}

function retryLevel() {
    if (quizState.currentLevel) startLevel(quizState.currentLevel);
}

// --- Psalm ---
function startPsalm(num) {
    var psalm = PSALMS[num % PSALMS.length];
    if (!psalm) { showToast('مفيش مزمور'); return; }
    document.getElementById('psalm-ref').textContent = psalm.ref;
    var display = psalm.text;
    psalm.missingWords.forEach(function(w) {
        display = display.replace(w, '_'.repeat(w.length));
    });
    document.getElementById('psalm-display').textContent = display;
    document.getElementById('psalm-instruction').textContent = 'اكتب الكلمات الناقصة مفصولة بفاصلة';
    document.getElementById('psalm-input').value = '';
    document.getElementById('psalm-result').innerHTML = '';
    quizState.currentLevel = num;
    showScreen('psalm-screen');
}

function checkPsalm() {
    var num = quizState.currentLevel;
    var psalm = PSALMS[num % PSALMS.length];
    var input = document.getElementById('psalm-input').value.trim();
    var answers = input.split(/[,،]/g).map(function(s) { return s.trim(); });
    var correct = 0;
    psalm.missingWords.forEach(function(w, i) {
        if (answers[i] && answers[i] === w) correct++;
    });
    var pct = Math.round((correct / psalm.missingWords.length) * 100);
    var stars = pct >= 90 ? 3 : pct >= 60 ? 2 : pct >= 30 ? 1 : 0;
    var gems = stars * 5;
    document.getElementById('psalm-result').innerHTML = '<p>' + (pct >= 60 ? '🎉 أحسنت!' : '😢 حاول تاني') + '</p><p>' + correct + ' من ' + psalm.missingWords.length + ' كلمة صح</p><p>الإجابة: ' + psalm.missingWords.join('، ') + '</p>';
    completeLevel(stars, gems);
    GameState.gamesPlayed++;
    checkAchievements();
    saveGame();
}

// --- Spot Difference ---
var spotDiffState = { scene: null, found: [], diffs: [], timer: null };

function startSpotDiff(num) {
    var scene = SPOT_DIFF_SCENES[num % SPOT_DIFF_SCENES.length];
    spotDiffState.scene = scene;
    spotDiffState.found = [];
    spotDiffState.diffs = scene.diffs;
    quizState.currentLevel = num;
    document.getElementById('spotdiff-found').textContent = '0';
    document.getElementById('spotdiff-total').textContent = scene.diffs.length;
    document.getElementById('spotdiff-time').textContent = '60';
    document.getElementById('spotdiff-result').innerHTML = '';
    document.getElementById('spotdiff-hints').innerHTML = '';
    showScreen('spotdiff-screen');
    drawSpotDiffScene('spotdiff-canvas-left', scene, false);
    drawSpotDiffScene('spotdiff-canvas-right', scene, true);
    // Timer
    var timeLeft = 60;
    if (spotDiffState.timer) clearInterval(spotDiffState.timer);
    spotDiffState.timer = setInterval(function() {
        timeLeft--;
        document.getElementById('spotdiff-time').textContent = timeLeft;
        if (timeLeft <= 0) { clearInterval(spotDiffState.timer); endSpotDiff(); }
    }, 1000);
    // Click handler
    var canvasR = document.getElementById('spotdiff-canvas-right');
    canvasR.onclick = function(e) {
        var rect = canvasR.getBoundingClientRect();
        var x = (e.clientX - rect.left) * (canvasR.width / rect.width);
        var y = (e.clientY - rect.top) * (canvasR.height / rect.height);
        checkSpotDiffClick(x, y);
    };
}

function drawSpotDiffScene(canvasId, scene, withDiffs) {
    var cv = document.getElementById(canvasId);
    var ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, cv.width, cv.height);
    scene.items.forEach(function(item, idx) {
        var color = item.color;
        if (withDiffs) {
            var diff = scene.diffs.find(function(d) { return d.index === idx; });
            if (diff && diff.property === 'color') color = diff.altValue;
            if (diff && diff.property === 'missing') return;
        }
        ctx.fillStyle = color;
        if (item.shape === 'rect') { ctx.fillRect(item.x, item.y, item.w, item.h); }
        else if (item.shape === 'circle') { ctx.beginPath(); ctx.arc(item.x+item.w/2, item.y+item.h/2, item.w/2, 0, Math.PI*2); ctx.fill(); }
        else if (item.shape === 'triangle') {
            ctx.beginPath(); ctx.moveTo(item.x+item.w/2, item.y); ctx.lineTo(item.x, item.y+item.h); ctx.lineTo(item.x+item.w, item.y+item.h); ctx.closePath(); ctx.fill();
        }
        else { ctx.fillRect(item.x, item.y, item.w, item.h); }
        if (item.label) { ctx.fillStyle = '#fff'; ctx.font = '10px Cairo'; ctx.textAlign = 'center'; ctx.fillText(item.label, item.x+item.w/2, item.y+item.h+14); }
    });
}

function checkSpotDiffClick(x, y) {
    var scene = spotDiffState.scene;
    scene.diffs.forEach(function(diff, di) {
        if (spotDiffState.found.indexOf(di) >= 0) return;
        var item = scene.items[diff.index];
        if (x >= item.x-10 && x <= item.x+item.w+10 && y >= item.y-10 && y <= item.y+item.h+10) {
            spotDiffState.found.push(di);
            document.getElementById('spotdiff-found').textContent = spotDiffState.found.length;
            showToast('🎯 لقيت اختلاف!');
            // Draw circle on found
            var cv = document.getElementById('spotdiff-canvas-right');
            var ctx = cv.getContext('2d');
            ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(item.x+item.w/2, item.y+item.h/2, Math.max(item.w,item.h)/2+5, 0, Math.PI*2); ctx.stroke();
            if (spotDiffState.found.length >= scene.diffs.length) {
                clearInterval(spotDiffState.timer);
                endSpotDiff();
            }
        }
    });
}

function endSpotDiff() {
    var total = spotDiffState.diffs.length;
    var found = spotDiffState.found.length;
    var pct = Math.round((found/total)*100);
    var stars = pct >= 90 ? 3 : pct >= 60 ? 2 : pct >= 30 ? 1 : 0;
    var gems = stars * 5;
    document.getElementById('spotdiff-result').innerHTML = '<p>'+(pct>=60?'🎉 أحسنت!':'😢 حاول تاني')+'</p><p>لقيت '+found+' من '+total+' اختلاف</p>';
    completeLevel(stars, gems);
    GameState.gamesPlayed++;
    checkAchievements();
    saveGame();
}

// --- Memory Game ---
var memoryState = { cards:[], flipped:[], matched:0, moves:0, timer:null, locked:false };

function startMemory(num) {
    var theme = MEMORY_THEMES[num % MEMORY_THEMES.length];
    quizState.currentLevel = num;
    memoryState.matched = 0; memoryState.moves = 0; memoryState.locked = false; memoryState.flipped = [];
    var pairs = theme.pairs.slice(0, 8);
    var cards = [];
    pairs.forEach(function(p, i) { cards.push({id:i,text:p.a,pairId:i}); cards.push({id:i+100,text:p.b,pairId:i}); });
    cards.sort(function() { return Math.random()-0.5; });
    memoryState.cards = cards;
    document.getElementById('memory-matched').textContent = '0';
    document.getElementById('memory-total').textContent = pairs.length;
    document.getElementById('memory-moves').textContent = '0';
    document.getElementById('memory-time').textContent = '90';
    document.getElementById('memory-result').innerHTML = '';
    showScreen('memory-screen');
    var grid = document.getElementById('memory-grid');
    grid.innerHTML = '';
    cards.forEach(function(card, idx) {
        var el = document.createElement('div');
        el.className = 'memory-card';
        el.innerHTML = '<div class="memory-card-inner"><div class="memory-card-front">❓</div><div class="memory-card-back">'+card.text+'</div></div>';
        (function(i) { el.onclick = function() { flipMemoryCard(i, el); }; })(idx);
        grid.appendChild(el);
    });
    var timeLeft = 90;
    if (memoryState.timer) clearInterval(memoryState.timer);
    memoryState.timer = setInterval(function() {
        timeLeft--;
        document.getElementById('memory-time').textContent = timeLeft;
        if (timeLeft <= 0) { clearInterval(memoryState.timer); endMemory(); }
    }, 1000);
}

function flipMemoryCard(idx, el) {
    if (memoryState.locked) return;
    if (el.classList.contains('flipped') || el.classList.contains('matched')) return;
    el.classList.add('flipped');
    memoryState.flipped.push({idx: idx, el: el, card: memoryState.cards[idx]});
    if (memoryState.flipped.length === 2) {
        memoryState.moves++;
        document.getElementById('memory-moves').textContent = memoryState.moves;
        memoryState.locked = true;
        var a = memoryState.flipped[0], b = memoryState.flipped[1];
        if (a.card.pairId === b.card.pairId && a.idx !== b.idx) {
            a.el.classList.add('matched');
            b.el.classList.add('matched');
            memoryState.matched++;
            document.getElementById('memory-matched').textContent = memoryState.matched;
            memoryState.flipped = [];
            memoryState.locked = false;
            if (memoryState.matched >= memoryState.cards.length / 2) {
                clearInterval(memoryState.timer);
                setTimeout(endMemory, 500);
            }
        } else {
            setTimeout(function() {
                a.el.classList.remove('flipped');
                b.el.classList.remove('flipped');
                memoryState.flipped = [];
                memoryState.locked = false;
            }, 800);
        }
    }
}

function endMemory() {
    var total = memoryState.cards.length / 2;
    var pct = Math.round((memoryState.matched/total)*100);
    var stars = pct >= 90 ? 3 : pct >= 60 ? 2 : pct >= 30 ? 1 : 0;
    if (stars >= 2 && memoryState.moves <= total * 2) stars = 3;
    var gems = stars * 5;
    document.getElementById('memory-result').innerHTML = '<p>'+(pct>=60?'🎉 أحسنت!':'😢 حاول تاني')+'</p><p>لقيت '+memoryState.matched+' من '+total+' زوج في '+memoryState.moves+' محاولة</p>';
    completeLevel(stars, gems);
    GameState.gamesPlayed++;
    checkAchievements();
    saveGame();
}

// --- True/False ---
var tfState = { questions:[], index:0, score:0, streak:0, timer:null };

function startTrueFalse(num) {
    quizState.currentLevel = num;
    var shuffled = TRUE_FALSE_DATA.slice().sort(function() { return Math.random()-0.5; });
    tfState.questions = shuffled.slice(0, 15);
    tfState.index = 0; tfState.score = 0; tfState.streak = 0;
    document.getElementById('tf-score').textContent = '0';
    document.getElementById('tf-streak').textContent = '0';
    document.getElementById('tf-time').textContent = '60';
    document.getElementById('tf-result').innerHTML = '';
    showScreen('truefalse-screen');
    showTFQuestion();
    var timeLeft = 60;
    if (tfState.timer) clearInterval(tfState.timer);
    tfState.timer = setInterval(function() {
        timeLeft--;
        document.getElementById('tf-time').textContent = timeLeft;
        if (timeLeft <= 0) { clearInterval(tfState.timer); endTrueFalse(); }
    }, 1000);
}

function showTFQuestion() {
    if (tfState.index >= tfState.questions.length) { clearInterval(tfState.timer); endTrueFalse(); return; }
    var q = tfState.questions[tfState.index];
    document.getElementById('tf-statement').textContent = q.statement;
    document.getElementById('tf-question-num').textContent = (tfState.index+1);
    var pct = (tfState.index / tfState.questions.length) * 100;
    document.getElementById('tf-progress-bar').style.width = pct + '%';
    document.getElementById('tf-image-container').style.display = 'none';
    var card = document.getElementById('tf-card');
    card.classList.remove('tf-correct','tf-wrong');
}

function answerTF(val) {
    var q = tfState.questions[tfState.index];
    var card = document.getElementById('tf-card');
    if (val === q.answer) {
        tfState.score += 10 + tfState.streak * 2;
        tfState.streak++;
        card.classList.add('tf-correct');
        GameState.totalCorrect++;
        GameState.streak++;
        if (GameState.streak > GameState.bestStreak) GameState.bestStreak = GameState.streak;
    } else {
        tfState.streak = 0;
        GameState.streak = 0;
        card.classList.add('tf-wrong');
    }
    GameState.totalAnswered++;
    document.getElementById('tf-score').textContent = tfState.score;
    document.getElementById('tf-streak').textContent = tfState.streak;
    setTimeout(function() {
        tfState.index++;
        showTFQuestion();
    }, 600);
}

function endTrueFalse() {
    var total = tfState.questions.length;
    var pct = total > 0 ? Math.round((tfState.score / (total * 10)) * 100) : 0;
    var stars = pct >= 90 ? 3 : pct >= 60 ? 2 : pct >= 30 ? 1 : 0;
    var gems = stars * 5;
    document.getElementById('tf-result').innerHTML = '<p>'+(pct>=60?'🎉 أحسنت!':'😢 حاول تاني')+'</p><p>النتيجة: '+tfState.score+' نقطة | أفضل سلسلة: '+tfState.streak+'</p>';
    completeLevel(stars, gems);
    GameState.gamesPlayed++;
    checkAchievements();
    saveGame();
}

// --- Image Puzzle (Sliding) ---
var imgPuzzleState = { tiles:[], emptyIdx:8, moves:0, timer:null, solved:false };

function startImgPuzzle(num) {
    quizState.currentLevel = num;
    imgPuzzleState.moves = 0; imgPuzzleState.solved = false;
    // Create solvable sliding puzzle (numbers 1-8 + empty)
    var tiles;
    do { tiles = [1,2,3,4,5,6,7,8,0]; shuffleArray(tiles); } while (!isSolvable(tiles));
    imgPuzzleState.tiles = tiles;
    imgPuzzleState.emptyIdx = tiles.indexOf(0);
    document.getElementById('imgpuzzle-moves').textContent = '0';
    document.getElementById('imgpuzzle-time').textContent = '120';
    document.getElementById('imgpuzzle-result').innerHTML = '';
    showScreen('imgpuzzle-screen');
    renderImgPuzzle();
    var timeLeft = 120;
    if (imgPuzzleState.timer) clearInterval(imgPuzzleState.timer);
    imgPuzzleState.timer = setInterval(function() {
        timeLeft--;
        document.getElementById('imgpuzzle-time').textContent = timeLeft;
        if (timeLeft <= 0) { clearInterval(imgPuzzleState.timer); endImgPuzzle(); }
    }, 1000);
}

function shuffleArray(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
}

function isSolvable(tiles) {
    var inv = 0;
    for (var i = 0; i < tiles.length; i++) {
        for (var j = i+1; j < tiles.length; j++) {
            if (tiles[i] && tiles[j] && tiles[i] > tiles[j]) inv++;
        }
    }
    return inv % 2 === 0;
}

function renderImgPuzzle() {
    var grid = document.getElementById('imgpuzzle-grid');
    grid.innerHTML = '';
    var icons = ['','✝','⛪','📖','🕯️','🙏','🎵','🛡️','👑'];
    imgPuzzleState.tiles.forEach(function(tile, idx) {
        var el = document.createElement('div');
        el.className = 'imgpuzzle-tile' + (tile === 0 ? ' empty' : '');
        el.innerHTML = tile > 0 ? '<span class="tile-num">'+tile+'</span><span class="tile-icon">'+icons[tile]+'</span>' : '';
        (function(i) { el.onclick = function() { clickPuzzleTile(i); }; })(idx);
        grid.appendChild(el);
    });
}

function clickPuzzleTile(idx) {
    if (imgPuzzleState.solved) return;
    var empty = imgPuzzleState.emptyIdx;
    var row = Math.floor(idx/3), col = idx%3;
    var eRow = Math.floor(empty/3), eCol = empty%3;
    if ((Math.abs(row-eRow) === 1 && col === eCol) || (Math.abs(col-eCol) === 1 && row === eRow)) {
        imgPuzzleState.tiles[empty] = imgPuzzleState.tiles[idx];
        imgPuzzleState.tiles[idx] = 0;
        imgPuzzleState.emptyIdx = idx;
        imgPuzzleState.moves++;
        document.getElementById('imgpuzzle-moves').textContent = imgPuzzleState.moves;
        renderImgPuzzle();
        // Check win
        var won = true;
        for (var i = 0; i < 8; i++) { if (imgPuzzleState.tiles[i] !== i+1) { won = false; break; } }
        if (won) { imgPuzzleState.solved = true; clearInterval(imgPuzzleState.timer); endImgPuzzle(); }
    }
}

function togglePuzzlePreview() {
    var prev = document.getElementById('imgpuzzle-preview');
    prev.classList.toggle('show');
}

function endImgPuzzle() {
    var stars = imgPuzzleState.solved ? (imgPuzzleState.moves <= 30 ? 3 : imgPuzzleState.moves <= 60 ? 2 : 1) : 0;
    var gems = stars * 5;
    document.getElementById('imgpuzzle-result').innerHTML = '<p>'+(imgPuzzleState.solved?'🎉 أحسنت! حللت اللغز!':'😢 الوقت خلص')+'</p><p>'+imgPuzzleState.moves+' حركة</p>';
    completeLevel(stars, gems);
    GameState.gamesPlayed++;
    checkAchievements();
    saveGame();
}

// --- Missing Items ---
var missingState = { data:null, timer:null };

function startMissing(num) {
    quizState.currentLevel = num;
    var data = MISSING_ITEMS_DATA[num % MISSING_ITEMS_DATA.length];
    missingState.data = data;
    document.getElementById('missing-question').textContent = data.question;
    document.getElementById('missing-score').textContent = '0';
    document.getElementById('missing-time').textContent = '45';
    document.getElementById('missing-result').innerHTML = '';
    showScreen('missing-screen');
    // Render scene items
    var scene = document.getElementById('missing-scene');
    scene.innerHTML = '';
    data.items.forEach(function(item) {
        var el = document.createElement('span');
        el.className = 'missing-item';
        el.textContent = item;
        scene.appendChild(el);
    });
    // Render choices
    var choices = document.getElementById('missing-choices');
    choices.innerHTML = '';
    data.choices.forEach(function(ch) {
        var btn = document.createElement('button');
        btn.className = 'btn btn-small';
        btn.textContent = ch;
        btn.onclick = function() { checkMissing(ch); };
        choices.appendChild(btn);
    });
    var timeLeft = 45;
    if (missingState.timer) clearInterval(missingState.timer);
    missingState.timer = setInterval(function() {
        timeLeft--;
        document.getElementById('missing-time').textContent = timeLeft;
        if (timeLeft <= 0) { clearInterval(missingState.timer); document.getElementById('missing-result').innerHTML = '<p>😢 الوقت خلص! الإجابة: '+data.correct+'</p>'; completeLevel(0,0); saveGame(); }
    }, 1000);
}

function checkMissing(answer) {
    clearInterval(missingState.timer);
    var correct = answer === missingState.data.correct;
    var stars = correct ? 3 : 0;
    var gems = stars * 5;
    document.getElementById('missing-result').innerHTML = '<p>'+(correct?'🎉 صح!':'😢 غلط! الإجابة: '+missingState.data.correct)+'</p>';
    completeLevel(stars, gems);
    GameState.gamesPlayed++;
    checkAchievements();
    saveGame();
}

// --- Word Puzzle ---
var puzzleState = { word:'', display:[], letters:[], timer:null };

function startWordPuzzle(num) {
    quizState.currentLevel = num;
    var data = WORD_PUZZLES[num % WORD_PUZZLES.length];
    puzzleState.word = data.word;
    puzzleState.display = [];
    puzzleState.letters = data.word.split('').sort(function() { return Math.random()-0.5; });
    document.getElementById('puzzle-clue').textContent = '💡 ' + data.clue;
    document.getElementById('puzzle-score').textContent = '0';
    document.getElementById('puzzle-time').textContent = '90';
    document.getElementById('puzzle-result').innerHTML = '';
    showScreen('puzzle-screen');
    renderWordPuzzle();
    var timeLeft = 90;
    if (puzzleState.timer) clearInterval(puzzleState.timer);
    puzzleState.timer = setInterval(function() {
        timeLeft--;
        document.getElementById('puzzle-time').textContent = timeLeft;
        if (timeLeft <= 0) { clearInterval(puzzleState.timer); document.getElementById('puzzle-result').innerHTML = '<p>😢 الوقت خلص! الكلمة: '+puzzleState.word+'</p>'; completeLevel(0,0); saveGame(); }
    }, 1000);
}

function renderWordPuzzle() {
    var display = document.getElementById('puzzle-display');
    display.innerHTML = '';
    puzzleState.word.split('').forEach(function(ch, i) {
        var el = document.createElement('span');
        el.className = 'puzzle-slot' + (puzzleState.display[i] ? ' filled' : '');
        el.textContent = puzzleState.display[i] || '_';
        display.appendChild(el);
    });
    var letters = document.getElementById('puzzle-letters');
    letters.innerHTML = '';
    puzzleState.letters.forEach(function(ch, i) {
        var btn = document.createElement('button');
        btn.className = 'puzzle-letter-btn';
        btn.textContent = ch;
        if (puzzleState.display.indexOf(ch) >= 0) {
            // Check if already used more times than available
            var usedCount = puzzleState.display.filter(function(d) { return d === ch; }).length;
            var availCount = puzzleState.letters.filter(function(l) { return l === ch; }).length;
            if (usedCount >= availCount) btn.classList.add('used');
        }
        btn.onclick = function() { puzzleAddLetter(ch, i); };
        letters.appendChild(btn);
    });
}

function puzzleAddLetter(ch, idx) {
    var nextEmpty = -1;
    for (var i = 0; i < puzzleState.word.length; i++) {
        if (!puzzleState.display[i]) { nextEmpty = i; break; }
    }
    if (nextEmpty >= 0) {
        puzzleState.display[nextEmpty] = ch;
        renderWordPuzzle();
    }
}

function puzzleClearInput() {
    puzzleState.display = [];
    renderWordPuzzle();
}

function puzzleCheckAnswer() {
    clearInterval(puzzleState.timer);
    var answer = puzzleState.display.join('');
    var correct = answer === puzzleState.word;
    var stars = correct ? 3 : 0;
    var gems = stars * 5;
    document.getElementById('puzzle-result').innerHTML = '<p>'+(correct?'🎉 صح! الكلمة هي: '+puzzleState.word:'😢 غلط! الكلمة الصحيحة: '+puzzleState.word)+'</p>';
    completeLevel(stars, gems);
    GameState.gamesPlayed++;
    checkAchievements();
    saveGame();
}

// --- Connect Pairs ---
var connectState = { pairs:[], selected:null, matched:0, timer:null };

function startConnect(num) {
    quizState.currentLevel = num;
    var data = CONNECT_PAIRS_DATA[num % CONNECT_PAIRS_DATA.length];
    connectState.pairs = data.pairs.slice();
    connectState.selected = null;
    connectState.matched = 0;
    document.getElementById('connect-matched').textContent = '0';
    document.getElementById('connect-total').textContent = data.pairs.length;
    document.getElementById('connect-time').textContent = '60';
    document.getElementById('connect-result').innerHTML = '';
    showScreen('connect-screen');
    renderConnect();
    var timeLeft = 60;
    if (connectState.timer) clearInterval(connectState.timer);
    connectState.timer = setInterval(function() {
        timeLeft--;
        document.getElementById('connect-time').textContent = timeLeft;
        if (timeLeft <= 0) { clearInterval(connectState.timer); endConnect(); }
    }, 1000);
}

function renderConnect() {
    var left = document.getElementById('connect-left');
    var right = document.getElementById('connect-right');
    left.innerHTML = ''; right.innerHTML = '';
    var shuffledRight = connectState.pairs.slice().sort(function() { return Math.random()-0.5; });
    connectState.pairs.forEach(function(p, i) {
        var el = document.createElement('div');
        el.className = 'connect-item';
        el.textContent = p.left;
        el.setAttribute('data-pair', i);
        el.setAttribute('data-side', 'left');
        el.onclick = function() { selectConnect(el, 'left', i); };
        left.appendChild(el);
    });
    shuffledRight.forEach(function(p) {
        var origIdx = connectState.pairs.indexOf(p);
        var el = document.createElement('div');
        el.className = 'connect-item';
        el.textContent = p.right;
        el.setAttribute('data-pair', origIdx);
        el.setAttribute('data-side', 'right');
        el.onclick = function() { selectConnect(el, 'right', origIdx); };
        right.appendChild(el);
    });
}

function selectConnect(el, side, idx) {
    if (el.classList.contains('matched')) return;
    if (connectState.selected && connectState.selected.side === side) {
        connectState.selected.el.classList.remove('selected');
        connectState.selected = {el:el, side:side, idx:idx};
        el.classList.add('selected');
        return;
    }
    if (!connectState.selected) {
        connectState.selected = {el:el, side:side, idx:idx};
        el.classList.add('selected');
    } else {
        // Check match
        if (connectState.selected.idx === idx) {
            connectState.selected.el.classList.add('matched');
            el.classList.add('matched');
            connectState.matched++;
            document.getElementById('connect-matched').textContent = connectState.matched;
            if (connectState.matched >= connectState.pairs.length) {
                clearInterval(connectState.timer);
                endConnect();
            }
        } else {
            connectState.selected.el.classList.add('wrong');
            el.classList.add('wrong');
            var prev = connectState.selected.el;
            setTimeout(function() { prev.classList.remove('wrong','selected'); el.classList.remove('wrong'); }, 500);
        }
        connectState.selected.el.classList.remove('selected');
        connectState.selected = null;
    }
}

function endConnect() {
    var total = connectState.pairs.length;
    var pct = Math.round((connectState.matched/total)*100);
    var stars = pct >= 90 ? 3 : pct >= 60 ? 2 : pct >= 30 ? 1 : 0;
    var gems = stars * 5;
    document.getElementById('connect-result').innerHTML = '<p>'+(pct>=60?'🎉 أحسنت!':'😢 حاول تاني')+'</p><p>وصّلت '+connectState.matched+' من '+total+' زوج</p>';
    completeLevel(stars, gems);
    GameState.gamesPlayed++;
    checkAchievements();
    saveGame();
}

// --- Order Events ---
var orderState = { events:[], correctOrder:[], selected:[], timer:null };

function startOrder(num) {
    quizState.currentLevel = num;
    var data = ORDER_EVENTS_DATA[num % ORDER_EVENTS_DATA.length];
    orderState.correctOrder = data.events.slice();
    orderState.events = data.events.slice().sort(function() { return Math.random()-0.5; });
    orderState.selected = [];
    document.getElementById('order-hint').textContent = data.title;
    document.getElementById('order-score').textContent = '0';
    document.getElementById('order-time').textContent = '60';
    document.getElementById('order-result').innerHTML = '';
    showScreen('order-screen');
    renderOrder();
    var timeLeft = 60;
    if (orderState.timer) clearInterval(orderState.timer);
    orderState.timer = setInterval(function() {
        timeLeft--;
        document.getElementById('order-time').textContent = timeLeft;
        if (timeLeft <= 0) { clearInterval(orderState.timer); document.getElementById('order-result').innerHTML = '<p>😢 الوقت خلص!</p>'; completeLevel(0,0); saveGame(); }
    }, 1000);
}

function renderOrder() {
    var items = document.getElementById('order-items');
    items.innerHTML = '';
    orderState.events.forEach(function(ev, i) {
        if (orderState.selected.indexOf(ev) >= 0) return;
        var el = document.createElement('div');
        el.className = 'order-item';
        el.textContent = ev;
        el.onclick = function() { selectOrderItem(ev); };
        items.appendChild(el);
    });
    var selected = document.getElementById('order-selected');
    selected.innerHTML = '';
    orderState.selected.forEach(function(ev, i) {
        var el = document.createElement('div');
        el.className = 'order-selected-item';
        el.textContent = (i+1) + '. ' + ev;
        selected.appendChild(el);
    });
}

function selectOrderItem(ev) {
    orderState.selected.push(ev);
    renderOrder();
}

function resetOrder() {
    orderState.selected = [];
    renderOrder();
}

function checkOrder() {
    clearInterval(orderState.timer);
    var correct = true;
    orderState.correctOrder.forEach(function(ev, i) {
        if (orderState.selected[i] !== ev) correct = false;
    });
    if (orderState.selected.length !== orderState.correctOrder.length) correct = false;
    var stars = correct ? 3 : 0;
    var gems = stars * 5;
    document.getElementById('order-result').innerHTML = '<p>'+(correct?'🎉 ترتيب صحيح!':'😢 الترتيب غلط')+'</p><p>الترتيب الصحيح:<br>'+orderState.correctOrder.map(function(e,i){return (i+1)+'. '+e;}).join('<br>')+'</p>';
    completeLevel(stars, gems);
    GameState.gamesPlayed++;
    checkAchievements();
    saveGame();
}

// --- Maze ---
var mazeState = { grid:[], playerPos:{r:0,c:0}, keys:0, totalKeys:0, steps:0, timer:null, solved:false };

function startMaze(num) {
    quizState.currentLevel = num;
    var data = MAZE_DATA[num % MAZE_DATA.length];
    mazeState.grid = data.grid.map(function(row) { return row.slice(); });
    mazeState.keys = 0;
    mazeState.totalKeys = data.keys;
    mazeState.steps = 0;
    mazeState.solved = false;
    // Find start position
    for (var r = 0; r < mazeState.grid.length; r++) {
        for (var c = 0; c < mazeState.grid[r].length; c++) {
            if (mazeState.grid[r][c] === 4) { mazeState.playerPos = {r:r, c:c}; }
        }
    }
    document.getElementById('maze-steps').textContent = '0';
    document.getElementById('maze-keys').textContent = '0';
    document.getElementById('maze-total-keys').textContent = data.keys;
    document.getElementById('maze-time').textContent = '90';
    document.getElementById('maze-result').innerHTML = '';
    showScreen('maze-screen');
    drawMaze();
    var timeLeft = 90;
    if (mazeState.timer) clearInterval(mazeState.timer);
    mazeState.timer = setInterval(function() {
        timeLeft--;
        document.getElementById('maze-time').textContent = timeLeft;
        if (timeLeft <= 0) { clearInterval(mazeState.timer); endMaze(); }
    }, 1000);
}

function drawMaze() {
    var cv = document.getElementById('maze-canvas');
    var ctx = cv.getContext('2d');
    var rows = mazeState.grid.length;
    var cols = mazeState.grid[0].length;
    var cellW = cv.width / cols;
    var cellH = cv.height / rows;
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
            var val = mazeState.grid[r][c];
            if (val === 1) { ctx.fillStyle = '#333'; }
            else if (val === 2) { ctx.fillStyle = '#FFD700'; }
            else if (val === 3) { ctx.fillStyle = '#4CAF50'; }
            else { ctx.fillStyle = '#1a1a2e'; }
            ctx.fillRect(c*cellW, r*cellH, cellW, cellH);
            ctx.strokeStyle = '#2a2a3e';
            ctx.strokeRect(c*cellW, r*cellH, cellW, cellH);
            if (val === 2) { ctx.fillStyle = '#000'; ctx.font = Math.floor(cellW*0.6)+'px Arial'; ctx.textAlign = 'center'; ctx.fillText('🔑', c*cellW+cellW/2, r*cellH+cellH*0.7); }
            if (val === 3) { ctx.fillStyle = '#000'; ctx.font = Math.floor(cellW*0.6)+'px Arial'; ctx.textAlign = 'center'; ctx.fillText('🚪', c*cellW+cellW/2, r*cellH+cellH*0.7); }
        }
    }
    // Draw player
    var px = mazeState.playerPos.c * cellW + cellW/2;
    var py = mazeState.playerPos.r * cellH + cellH/2;
    ctx.fillStyle = '#2196F3';
    ctx.beginPath(); ctx.arc(px, py, cellW*0.35, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = Math.floor(cellW*0.4)+'px Arial'; ctx.textAlign = 'center';
    ctx.fillText('😊', px, py+cellW*0.15);
}

function moveMaze(dir) {
    if (mazeState.solved) return;
    var r = mazeState.playerPos.r;
    var c = mazeState.playerPos.c;
    if (dir === 'up') r--;
    else if (dir === 'down') r++;
    else if (dir === 'left') c++;
    else if (dir === 'right') c--;
    if (r < 0 || r >= mazeState.grid.length || c < 0 || c >= mazeState.grid[0].length) return;
    if (mazeState.grid[r][c] === 1) return;
    // Collect key
    if (mazeState.grid[r][c] === 2) {
        mazeState.keys++;
        mazeState.grid[r][c] = 0;
        document.getElementById('maze-keys').textContent = mazeState.keys;
        showToast('🔑 لقيت مفتاح!');
    }
    // Exit
    if (mazeState.grid[r][c] === 3) {
        if (mazeState.keys >= mazeState.totalKeys) {
            mazeState.solved = true;
            clearInterval(mazeState.timer);
            mazeState.playerPos = {r:r, c:c};
            drawMaze();
            endMaze();
            return;
        } else {
            showToast('محتاج تجمع كل المفاتيح الأول!');
            return;
        }
    }
    mazeState.playerPos = {r:r, c:c};
    mazeState.steps++;
    document.getElementById('maze-steps').textContent = mazeState.steps;
    drawMaze();
}

function endMaze() {
    var stars = mazeState.solved ? (mazeState.steps <= 30 ? 3 : mazeState.steps <= 60 ? 2 : 1) : 0;
    var gems = stars * 5;
    document.getElementById('maze-result').innerHTML = '<p>'+(mazeState.solved?'🎉 وصلت للباب!':'😢 الوقت خلص')+'</p><p>'+mazeState.steps+' خطوة | '+mazeState.keys+'/'+mazeState.totalKeys+' مفاتيح</p>';
    completeLevel(stars, gems);
    GameState.gamesPlayed++;
    checkAchievements();
    saveGame();
}

// Keyboard for maze
document.addEventListener('keydown', function(e) {
    if (document.getElementById('maze-screen').classList.contains('active')) {
        if (e.key === 'ArrowUp') moveMaze('up');
        else if (e.key === 'ArrowDown') moveMaze('down');
        else if (e.key === 'ArrowLeft') moveMaze('left');
        else if (e.key === 'ArrowRight') moveMaze('right');
    }
});

// --- Picture Guess ---
var picGuessState = { data:[], index:0, score:0, revealLevel:0, timer:null, revealTimer:null };

function startPicGuess(num) {
    quizState.currentLevel = num;
    var shuffled = PICTURE_GUESS_DATA.slice().sort(function() { return Math.random()-0.5; });
    picGuessState.data = shuffled.slice(0, 5);
    picGuessState.index = 0;
    picGuessState.score = 0;
    document.getElementById('picguess-score').textContent = '0';
    document.getElementById('picguess-num').textContent = '1';
    document.getElementById('picguess-total').textContent = picGuessState.data.length;
    document.getElementById('picguess-time').textContent = '60';
    document.getElementById('picguess-result').innerHTML = '';
    showScreen('picguess-screen');
    showPicGuessQuestion();
    var timeLeft = 60;
    if (picGuessState.timer) clearInterval(picGuessState.timer);
    picGuessState.timer = setInterval(function() {
        timeLeft--;
        document.getElementById('picguess-time').textContent = timeLeft;
        if (timeLeft <= 0) { clearInterval(picGuessState.timer); clearInterval(picGuessState.revealTimer); endPicGuess(); }
    }, 1000);
}

function showPicGuessQuestion() {
    if (picGuessState.index >= picGuessState.data.length) { clearInterval(picGuessState.timer); clearInterval(picGuessState.revealTimer); endPicGuess(); return; }
    var q = picGuessState.data[picGuessState.index];
    picGuessState.revealLevel = 0;
    document.getElementById('picguess-num').textContent = (picGuessState.index+1);
    document.getElementById('picguess-question').textContent = 'مين ده / إيه ده؟';
    // Draw with masking (progressive reveal)
    drawPicGuess(q, 0.2);
    document.getElementById('picguess-reveal-progress').style.width = '20%';
    // Choices
    var choices = document.getElementById('picguess-choices');
    choices.innerHTML = '';
    q.choices.forEach(function(ch) {
        var btn = document.createElement('button');
        btn.className = 'btn btn-small picguess-choice';
        btn.textContent = ch;
        btn.onclick = function() { answerPicGuess(ch, q); };
        choices.appendChild(btn);
    });
    // Gradual reveal
    if (picGuessState.revealTimer) clearInterval(picGuessState.revealTimer);
    picGuessState.revealLevel = 20;
    picGuessState.revealTimer = setInterval(function() {
        picGuessState.revealLevel += 5;
        if (picGuessState.revealLevel > 100) picGuessState.revealLevel = 100;
        drawPicGuess(q, picGuessState.revealLevel/100);
        document.getElementById('picguess-reveal-progress').style.width = picGuessState.revealLevel+'%';
        if (picGuessState.revealLevel >= 100) clearInterval(picGuessState.revealTimer);
    }, 1500);
}

function drawPicGuess(q, revealPct) {
    var cv = document.getElementById('picguess-canvas');
    var ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, cv.width, cv.height);
    // Draw the picture
    if (PIC_DRAW_FNS[q.draw]) {
        PIC_DRAW_FNS[q.draw](ctx, cv.width, cv.height, revealPct);
    }
    // Mask (cover parts based on reveal percentage)
    var blockSize = 30;
    var totalBlocks = Math.ceil(cv.width/blockSize) * Math.ceil(cv.height/blockSize);
    var blocksToHide = Math.floor(totalBlocks * (1 - revealPct));
    // Create array of block positions and shuffle
    var blocks = [];
    for (var bx = 0; bx < cv.width; bx += blockSize) {
        for (var by = 0; by < cv.height; by += blockSize) {
            blocks.push({x:bx, y:by});
        }
    }
    // Use seeded-like shuffle (consistent per question)
    var seed = q.name.length * 7;
    blocks.sort(function(a,b) { return Math.sin(seed + a.x*13 + a.y*17) - Math.sin(seed + b.x*13 + b.y*17); });
    ctx.fillStyle = '#2a2a4e';
    for (var i = 0; i < blocksToHide && i < blocks.length; i++) {
        ctx.fillRect(blocks[i].x, blocks[i].y, blockSize, blockSize);
    }
}

function answerPicGuess(answer, q) {
    clearInterval(picGuessState.revealTimer);
    if (answer === q.correct) {
        picGuessState.score += 10;
        showToast('🎉 صح!');
        GameState.totalCorrect++;
        GameState.streak++;
        if (GameState.streak > GameState.bestStreak) GameState.bestStreak = GameState.streak;
    } else {
        GameState.streak = 0;
        showToast('😢 غلط! الإجابة: ' + q.correct);
    }
    GameState.totalAnswered++;
    document.getElementById('picguess-score').textContent = picGuessState.score;
    // Show full picture
    drawPicGuess(q, 1);
    setTimeout(function() {
        picGuessState.index++;
        showPicGuessQuestion();
    }, 1500);
}

function endPicGuess() {
    var total = picGuessState.data.length;
    var pct = total > 0 ? Math.round((picGuessState.score / (total * 10)) * 100) : 0;
    var stars = pct >= 80 ? 3 : pct >= 50 ? 2 : pct >= 20 ? 1 : 0;
    var gems = stars * 5;
    document.getElementById('picguess-result').innerHTML = '<p>'+(pct>=50?'🎉 أحسنت!':'😢 حاول تاني')+'</p><p>النتيجة: '+picGuessState.score+' نقاط</p>';
    completeLevel(stars, gems);
    GameState.gamesPlayed++;
    checkAchievements();
    saveGame();
}

// --- Shop ---
var shopActiveTab = 'armor';

function renderShop() {
    document.getElementById('shop-gems').textContent = GameState.gems;
    var shopAvatar = document.getElementById('shop-avatar-img');
    var shopCh = CHARACTERS[GameState.character];
    if (shopAvatar && shopCh) { shopAvatar.src = shopCh.image; shopAvatar.alt = shopCh.name; }

    var grid = document.getElementById('shop-items-grid');
    grid.innerHTML = '';

    // Tabs
    var tabs = [
        { id: 'armor',  label: '🛡️ السلاح',   icon: 'fa-shield-halved' },
        { id: 'frames', label: '🖼️ إطارات',   icon: 'fa-image' },
        { id: 'titles', label: '🏅 ألقاب',    icon: 'fa-medal' },
        { id: 'themes', label: '🗺️ خرائط',   icon: 'fa-map' },
        { id: 'streak', label: '🔥 المداومة', icon: 'fa-fire' }
    ];
    var tabsHtml = '<div class="shop-tabs">';
    tabs.forEach(function(t) {
        tabsHtml += '<button class="shop-tab' + (shopActiveTab === t.id ? ' active' : '') + '" onclick="shopActiveTab=\'' + t.id + '\';renderShop()">' + t.label + '</button>';
    });
    tabsHtml += '</div>';
    grid.innerHTML = tabsHtml;

    var itemsHtml = '<div class="shop-grid-items">';

    if (shopActiveTab === 'armor') {
        Object.entries(ARMOR_ITEMS).forEach(function(entry) {
            var key = entry[0], item = entry[1];
            var owned = GameState.armor.indexOf(key) >= 0;
            var equipped = GameState.equippedArmor[item.slot] === key;
            itemsHtml += '<div class="shop-item-card' + (owned ? ' owned' : '') + (equipped ? ' equipped' : '') + '">';
            itemsHtml += '<div class="shop-item-icon">' + item.icon + '</div>';
            itemsHtml += '<h3>' + item.name + '</h3>';
            itemsHtml += '<p class="shop-item-desc">' + item.desc + '</p>';
            itemsHtml += '<p class="shop-item-verse">"' + item.verse + '"</p>';
            if (owned && equipped) {
                itemsHtml += '<span class="shop-badge equipped-badge">مُجهّز ✓</span>';
            } else if (owned) {
                itemsHtml += '<button class="btn btn-small btn-primary equip-btn" data-key="' + key + '" data-action="equip-armor">تجهيز</button>';
            } else {
                itemsHtml += '<button class="btn btn-small btn-gold buy-btn" data-key="' + key + '" data-action="buy-armor">💎 ' + item.cost + ' شراء</button>';
            }
            itemsHtml += '</div>';
        });
    } else if (shopActiveTab === 'frames') {
        Object.entries(PROFILE_FRAMES).forEach(function(entry) {
            var key = entry[0], frame = entry[1];
            var owned = (GameState.ownedFrames || []).indexOf(key) >= 0;
            var equipped = GameState.equippedFrame === key;
            itemsHtml += '<div class="shop-item-card shop-frame-card ' + (frame.frameClass || '') + (owned ? ' owned' : '') + (equipped ? ' equipped' : '') + '">';
            // Decorated frame wrap with icon top + bottom ornament
            itemsHtml += '<div class="shop-frame-wrap">';
            itemsHtml += '<div class="frame-deco-icon" style="color:' + frame.accentColor + '">' + frame.icon + '</div>';
            itemsHtml += '<div class="shop-frame-ring ' + (frame.frameClass || '') + '-ring">';
            itemsHtml += '<img src="' + (shopCh ? shopCh.image : '') + '" class="shop-frame-img">';
            itemsHtml += '</div>';
            itemsHtml += '<div class="frame-deco-dots" style="color:' + frame.accentColor + '">✦ ✦ ✦</div>';
            itemsHtml += '</div>';
            itemsHtml += '<h3 style="color:' + frame.accentColor + '">' + frame.name + '</h3>';
            itemsHtml += '<p class="shop-item-desc">' + frame.desc + '</p>';
            if (owned && equipped) {
                itemsHtml += '<span class="shop-badge equipped-badge">مُجهّز ✓</span>';
            } else if (owned) {
                itemsHtml += '<button class="btn btn-small btn-primary equip-btn" data-key="' + key + '" data-action="equip-frame">تجهيز</button>';
            } else {
                itemsHtml += '<button class="btn btn-small btn-gold buy-btn" data-key="' + key + '" data-action="buy-frame">💎 ' + frame.cost + ' شراء</button>';
            }
            itemsHtml += '</div>';
        });
    } else if (shopActiveTab === 'titles') {
        Object.entries(PLAYER_TITLES).forEach(function(entry) {
            var key = entry[0], title = entry[1];
            var owned = (GameState.ownedTitles || []).indexOf(key) >= 0;
            var canEarn = !owned && title.cost === 0 && title.earned();
            var equipped = GameState.equippedTitle === key;
            itemsHtml += '<div class="shop-item-card shop-title-card' + (owned ? ' owned' : '') + (equipped ? ' equipped' : '') + (canEarn ? ' earnable' : '') + '">';
            itemsHtml += '<div class="shop-item-icon" style="font-size:40px">' + title.icon + '</div>';
            itemsHtml += '<h3>' + title.name + '</h3>';
            itemsHtml += '<p class="shop-item-desc">' + title.desc + '</p>';
            if (owned && equipped) {
                itemsHtml += '<span class="shop-badge equipped-badge">مُفعّل ✓</span>';
            } else if (owned) {
                itemsHtml += '<button class="btn btn-small btn-primary equip-btn" data-key="' + key + '" data-action="equip-title">تفعيل</button>';
            } else if (canEarn) {
                itemsHtml += '<button class="btn btn-small btn-gold buy-btn" data-key="' + key + '" data-action="earn-title">🎉 استلم اللقب!</button>';
            } else if (title.cost > 0) {
                itemsHtml += '<button class="btn btn-small btn-gold buy-btn" data-key="' + key + '" data-action="buy-title">💎 ' + title.cost + ' شراء</button>';
            } else {
                itemsHtml += '<div class="shop-item-locked-hint"><i class="fas fa-lock"></i> ' + title.desc + '</div>';
            }
            itemsHtml += '</div>';
        });
    } else if (shopActiveTab === 'streak') {
        var curStreak = GameState.loginStreak || 0;
        var claimed   = GameState.claimedStreakRewards || [];
        // Streak counter header
        itemsHtml += '<div class="streak-header" style="grid-column:1/-1;text-align:center;padding:16px 0 8px">';
        itemsHtml += '<div class="streak-fire-num">🔥 ' + curStreak + '</div>';
        itemsHtml += '<p style="color:#aaa;font-size:13px;margin-top:4px">يوم متواصل من الدخول</p>';
        itemsHtml += '</div>';
        STREAK_REWARDS.forEach(function(reward) {
            var isClaimed  = claimed.indexOf(reward.id) >= 0;
            var canClaim   = !isClaimed && curStreak >= reward.streakNeeded;
            var pct        = Math.min(100, Math.round((curStreak / reward.streakNeeded) * 100));
            itemsHtml += '<div class="shop-item-card streak-reward-card' + (isClaimed ? ' owned' : '') + (canClaim ? ' earnable' : '') + '">';
            itemsHtml += '<div class="streak-reward-icon">' + reward.icon + '</div>';
            itemsHtml += '<h3>' + reward.name + '</h3>';
            itemsHtml += '<p class="shop-item-desc">' + reward.desc + '</p>';
            // Progress bar
            itemsHtml += '<div class="streak-progress-wrap">';
            itemsHtml += '<div class="streak-progress-bar" style="width:' + pct + '%"></div>';
            itemsHtml += '</div>';
            itemsHtml += '<p class="streak-progress-label">' + Math.min(curStreak, reward.streakNeeded) + ' / ' + reward.streakNeeded + ' يوم</p>';
            if (isClaimed) {
                itemsHtml += '<span class="shop-badge equipped-badge">تم الاستلام ✓</span>';
            } else if (canClaim) {
                itemsHtml += '<button class="btn btn-small btn-gold buy-btn" data-key="' + reward.id + '" data-action="claim-streak">🎉 استلم الجائزة!</button>';
            } else {
                itemsHtml += '<div class="shop-item-locked-hint"><i class="fas fa-lock"></i> ' + reward.streakNeeded + ' يوم متواصل</div>';
            }
            itemsHtml += '</div>';
        });
    } else if (shopActiveTab === 'themes') {
        Object.entries(MAP_THEMES).forEach(function(entry) {
            var key = entry[0], theme = entry[1];
            var owned = key === 'default' || GameState.mapTheme === key || (GameState.ownedFrames || []).indexOf('theme_' + key) >= 0;
            var active = GameState.mapTheme === key;
            itemsHtml += '<div class="shop-item-card shop-theme-card' + (active ? ' equipped' : '') + '">';
            itemsHtml += '<div class="shop-theme-preview" style="background:' + theme.bgColor + ';border:2px solid ' + theme.accent + '">';
            itemsHtml += '<span style="font-size:36px">' + theme.icon + '</span>';
            itemsHtml += '</div>';
            itemsHtml += '<h3>' + theme.name + '</h3>';
            itemsHtml += '<p class="shop-item-desc">' + theme.desc + '</p>';
            if (active) {
                itemsHtml += '<span class="shop-badge equipped-badge">مُفعّل ✓</span>';
            } else if (key === 'default') {
                itemsHtml += '<button class="btn btn-small btn-primary equip-btn" data-key="' + key + '" data-action="set-theme">تفعيل</button>';
            } else {
                itemsHtml += '<button class="btn btn-small btn-gold buy-btn" data-key="' + key + '" data-action="buy-theme">💎 ' + theme.cost + ' شراء وتفعيل</button>';
            }
            itemsHtml += '</div>';
        });
    }

    itemsHtml += '</div>';
    grid.innerHTML += itemsHtml;

    // Bind all buttons using event delegation
    grid.addEventListener('click', handleShopClick);
}

function handleShopClick(e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.getAttribute('data-action');
    var key = btn.getAttribute('data-key');

    if (action === 'buy-armor') buyArmor(key);
    else if (action === 'equip-armor') equipArmor(key);
    else if (action === 'buy-frame') buyFrame(key);
    else if (action === 'equip-frame') equipFrame(key);
    else if (action === 'buy-title') buyTitle(key);
    else if (action === 'equip-title') equipTitle(key);
    else if (action === 'earn-title') earnTitle(key);
    else if (action === 'buy-theme') buyMapTheme(key);
    else if (action === 'set-theme') setMapTheme(key);
    else if (action === 'claim-streak') claimStreakReward(key);
}

function claimStreakReward(id) {
    var reward = null;
    for (var i = 0; i < STREAK_REWARDS.length; i++) { if (STREAK_REWARDS[i].id === id) { reward = STREAK_REWARDS[i]; break; } }
    if (!reward) return;
    if (!GameState.claimedStreakRewards) GameState.claimedStreakRewards = [];
    if (GameState.claimedStreakRewards.indexOf(id) >= 0) { showToast('استلمته قبل كده!', 'warning'); return; }
    if ((GameState.loginStreak || 0) < reward.streakNeeded) { showToast('محتاج ' + reward.streakNeeded + ' يوم متواصل!', 'error'); return; }
    GameState.claimedStreakRewards.push(id);
    if (reward.type === 'frame') {
        if (!GameState.ownedFrames) GameState.ownedFrames = [];
        if (GameState.ownedFrames.indexOf(reward.rewardKey) < 0) GameState.ownedFrames.push(reward.rewardKey);
        GameState.equippedFrame = reward.rewardKey;
    } else if (reward.type === 'skin') {
        if (!GameState.characterTiers) GameState.characterTiers = {};
        Object.keys(CHARACTERS).forEach(function(k) {
            if (!GameState.characterTiers[k] || GameState.characterTiers[k] === 'bronze') GameState.characterTiers[k] = 'silver';
        });
    } else if (reward.type === 'title') {
        if (!GameState.ownedTitles) GameState.ownedTitles = [];
        if (GameState.ownedTitles.indexOf(reward.rewardKey) < 0) GameState.ownedTitles.push(reward.rewardKey);
        GameState.equippedTitle = reward.rewardKey;
    }
    showAchievement(reward.icon, reward.name, reward.rewardLabel + ' - تم الاستلام!');
    launchConfetti(2500);
    renderShop();
    saveGame();
}

function buyArmor(key) {
    var item = ARMOR_ITEMS[key];
    if (GameState.gems < item.cost) { showToast('محتاج ' + item.cost + ' جوهرة!'); return; }
    GameState.gems -= item.cost;
    GameState.armor.push(key);
    showToast('🛡️ اشتريت ' + item.name + '!');
    launchConfetti(1500);
    renderShop();
    saveGame();
}

function equipArmor(key) {
    var item = ARMOR_ITEMS[key];
    GameState.equippedArmor[item.slot] = key;
    showToast('تم تجهيز ' + item.name);
    renderShop();
    saveGame();
}

function buyFrame(key) {
    var frame = PROFILE_FRAMES[key];
    if (!frame) return;
    if (GameState.gems < frame.cost) { showToast('محتاج ' + frame.cost + ' جوهرة!', 'warning'); return; }
    GameState.gems -= frame.cost;
    if (!GameState.ownedFrames) GameState.ownedFrames = [];
    GameState.ownedFrames.push(key);
    GameState.equippedFrame = key;
    showToast('🖼️ اشتريت ' + frame.name + '!', 'success');
    launchConfetti(1500);
    showAchievement(frame.icon, frame.name, 'إطار جديد للبروفايل!');
    renderShop(); renderHomeHub(); saveGame();
}

function equipFrame(key) {
    GameState.equippedFrame = key;
    showToast('تم تجهيز الإطار');
    renderShop(); renderHomeHub(); saveGame();
}

function buyTitle(key) {
    var title = PLAYER_TITLES[key];
    if (!title || title.cost === 0) return;
    if (GameState.gems < title.cost) { showToast('محتاج ' + title.cost + ' جوهرة!', 'warning'); return; }
    GameState.gems -= title.cost;
    if (!GameState.ownedTitles) GameState.ownedTitles = [];
    GameState.ownedTitles.push(key);
    GameState.equippedTitle = key;
    showToast('🏅 حصلت على لقب: ' + title.name, 'success');
    launchConfetti(2000);
    showAchievement(title.icon, title.name, 'لقب جديد!');
    renderShop(); renderHomeHub(); saveGame();
}

function earnTitle(key) {
    var title = PLAYER_TITLES[key];
    if (!title || !title.earned()) return;
    if (!GameState.ownedTitles) GameState.ownedTitles = [];
    GameState.ownedTitles.push(key);
    GameState.equippedTitle = key;
    showToast('🎉 استلمت لقب: ' + title.name, 'success');
    launchConfetti(2500);
    showAchievement(title.icon, title.name, 'لقب مُكتسب بجدارة!');
    renderShop(); renderHomeHub(); saveGame();
}

function buyMapTheme(key) {
    var theme = MAP_THEMES[key];
    if (!theme) return;
    if (GameState.gems < theme.cost) { showToast('محتاج ' + theme.cost + ' جوهرة!', 'warning'); return; }
    GameState.gems -= theme.cost;
    GameState.mapTheme = key;
    applyMapTheme();
    showToast('🗺️ تم تفعيل خريطة: ' + theme.name, 'success');
    launchConfetti(1500);
    showAchievement(theme.icon, theme.name, 'خريطة جديدة!');
    renderShop(); saveGame();
}

function setMapTheme(key) {
    GameState.mapTheme = key;
    applyMapTheme();
    showToast('تم تفعيل خريطة: ' + MAP_THEMES[key].name);
    renderShop(); saveGame();
}

function applyMapTheme() {
    var key = GameState.mapTheme || 'default';
    var theme = MAP_THEMES[key];
    if (!theme) return;
    var mapScreen = document.getElementById('map-screen');
    if (!mapScreen) return;

    // Reset theme classes
    mapScreen.classList.remove('map-theme-default', 'map-theme-space', 'map-theme-underwater', 'map-theme-sky');
    mapScreen.classList.add('map-theme-' + key);

    // Apply accent color to CSS variable on the screen
    mapScreen.style.setProperty('--map-accent', theme.accent);
    mapScreen.style.setProperty('--map-bg', theme.bgColor);
}

// --- Mission System ---
var currentMissionLevel = null;

function startMission(num) {
    var lv = LEVELS[num - 1];
    if (!lv || lv.type !== 'mission') return;
    currentMissionLevel = num;
    var mission = MISSION_DATA.find(function(m) { return m.id === lv.missionId; });
    if (!mission) { showToast('مفيش مهمة متاحة'); return; }
    var mtype = MISSION_TYPES[mission.type] || {};

    // Set icon
    var iconWrap = document.getElementById('mission-icon-wrap');
    if (iconWrap) iconWrap.innerHTML = '<i class="fas ' + (mtype.icon || 'fa-clipboard-check') + '"></i>';
    if (iconWrap) iconWrap.style.background = 'linear-gradient(135deg, ' + (mtype.color || '#FF6B35') + ', ' + (mtype.color || '#FF6B35') + '44)';

    document.getElementById('mission-title').textContent = mission.title;
    document.getElementById('mission-description').textContent = mtype.description || '';

    // Instructions
    var instrEl = document.getElementById('mission-instructions');
    instrEl.innerHTML = '<div class="mission-instr-item"><i class="fas fa-info-circle"></i><p>' + mission.description + '</p></div>' +
        '<div class="mission-instr-item"><i class="fas fa-pen"></i><p>اكتب وصف لما عملته (10 حروف على الأقل)</p></div>';

    // Reward preview
    var rewardEl = document.getElementById('mission-reward-preview');
    rewardEl.innerHTML = '<span>🎁 المكافأة: </span><span>⭐ ' + mission.starsReward + ' نجوم</span><span>💎 ' + mission.reward + ' جواهر</span>';

    // Check if already completed
    var ld = GameState.levelsData[num] || {};
    var textarea = document.getElementById('mission-text');
    var statusEl = document.getElementById('mission-status');
    var submitBtn = document.getElementById('btn-submit-mission');

    if (ld.completed && ld.missionText) {
        textarea.value = ld.missionText;
        textarea.disabled = true;
        statusEl.innerHTML = '<div class="mission-done"><i class="fas fa-check-circle"></i> تم تسليم المهمة دي - أحسنت يا بطل!</div>';
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span><i class="fas fa-check"></i> تم التسليم</span>';
    } else {
        textarea.value = '';
        textarea.disabled = false;
        statusEl.innerHTML = '';
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span><i class="fas fa-paper-plane"></i> تسليم المهمة</span>';
    }

    showScreen('mission-screen');
}

function submitMission() {
    var text = document.getElementById('mission-text').value.trim();
    if (!text || text.length < 10) {
        showToast('اكتب وصف أطول (10 حروف على الأقل)', 'error');
        return;
    }

    var num = currentMissionLevel;
    if (!num) return;
    var lv = LEVELS[num - 1];
    if (!lv) return;
    var mission = MISSION_DATA.find(function(m) { return m.id === lv.missionId; });
    if (!mission) return;

    // Check if already completed
    if (GameState.levelsData[num] && GameState.levelsData[num].completed) {
        showToast('المهمة دي اتسلمت قبل كده');
        return;
    }

    // Save mission
    if (!GameState.levelsData[num]) GameState.levelsData[num] = {};
    GameState.levelsData[num].completed = true;
    GameState.levelsData[num].missionText = text;
    GameState.levelsData[num].stars = mission.starsReward;
    GameState.levelsData[num].submittedAt = new Date().toISOString();

    // Award rewards
    GameState.stars += mission.starsReward;
    GameState.gems += mission.reward;
    GameState.missionsCompleted++;
    awardXP(40, 'complete mission');

    // Advance level
    if (num >= GameState.currentLevel && num < LEVELS.length) {
        GameState.currentLevel = num + 1;
    }

    // Update UI
    var textarea = document.getElementById('mission-text');
    textarea.disabled = true;
    var statusEl = document.getElementById('mission-status');
    statusEl.innerHTML = '<div class="mission-done"><i class="fas fa-check-circle"></i> أحسنت يا بطل! كسبت ⭐' + mission.starsReward + ' نجوم و 💎' + mission.reward + ' جواهر</div>';
    var submitBtn = document.getElementById('btn-submit-mission');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span><i class="fas fa-check"></i> تم التسليم</span>';

    confetti();
    checkAchievements();
    saveGame();
    syncLeaderboard();
    showToast('🎉 تم تسليم المهمة بنجاح!', 3500);
}

// --- Paul's First Journey Map ---
function renderPaulMap() {
    // Set avatar
    var ch = CHARACTERS[GameState.character];
    var avatarImg = document.getElementById('paul-avatar-img');
    if (avatarImg && ch) avatarImg.src = ch.image;

    // Calculate totals
    var totalStars = 0;
    var earnedStars = 0;
    PAUL_JOURNEY_STATIONS.forEach(function(st) {
        totalStars += (st.reward || 3);
        var sd = GameState.paulJourneyData[st.id];
        if (sd && sd.completed) earnedStars += (st.reward || 3);
    });
    var starsEarnedEl = document.getElementById('paul-stars-earned');
    var starsTotalEl = document.getElementById('paul-stars-total');
    if (starsEarnedEl) starsEarnedEl.textContent = earnedStars;
    if (starsTotalEl) starsTotalEl.textContent = totalStars;

    // Render stations
    var container = document.getElementById('paul-stations');
    container.innerHTML = '';
    var curStation = GameState.paulJourneyStation || 1;

    PAUL_JOURNEY_STATIONS.forEach(function(st) {
        var sd = GameState.paulJourneyData[st.id] || {};
        var completed = !!sd.completed;
        var isCurrent = st.id === curStation && !completed;
        var locked = st.id > curStation;

        var marker = document.createElement('div');
        marker.className = 'paul-station-marker' + (completed ? ' completed' : '') + (isCurrent ? ' current' : '') + (locked ? ' locked' : '');
        marker.style.left = st.x + '%';
        marker.style.top = st.y + '%';
        marker.innerHTML = '<span class="station-num">' + (completed ? '<i class="fas fa-check"></i>' : st.id) + '</span>' +
            '<span class="station-label">' + st.name + '</span>' +
            (isCurrent ? '<span class="station-ping"></span>' : '');

        if (!locked) {
            (function(station) {
                marker.onclick = function() { openPaulStation(station.id); };
            })(st);
        }

        container.appendChild(marker);
    });

    // Position avatar at current station with pin
    var targetStation = PAUL_JOURNEY_STATIONS.find(function(s) { return s.id === curStation; });
    if (!targetStation && curStation > PAUL_JOURNEY_STATIONS.length) {
        targetStation = PAUL_JOURNEY_STATIONS[PAUL_JOURNEY_STATIONS.length - 1];
    }
    var avatar = document.getElementById('paul-avatar');
    if (avatar && targetStation) {
        avatar.style.left = targetStation.x + '%';
        avatar.style.top = targetStation.y + '%';
        avatar.innerHTML = '<img id="paul-avatar-img" src="' + (ch ? ch.image : '') + '" alt="avatar"><div class="paul-pin-spike"></div>';
    }

    // Update mini progress on dashboard
    updatePaulProgressMini();
}

function updatePaulProgressMini() {
    var miniEl = document.getElementById('paul-progress-mini');
    if (!miniEl) return;
    var completed = 0;
    PAUL_JOURNEY_STATIONS.forEach(function(st) {
        if (GameState.paulJourneyData[st.id] && GameState.paulJourneyData[st.id].completed) completed++;
    });
    var total = PAUL_JOURNEY_STATIONS.length;
    if (completed >= total) {
        miniEl.innerHTML = '<span class="paul-mini-done"><i class="fas fa-check-circle"></i> اكتملت!</span>';
    } else {
        var pct = Math.round((completed / total) * 100);
        miniEl.innerHTML = '<div class="paul-mini-bar"><div class="paul-mini-fill" style="width:' + pct + '%"></div></div><span class="paul-mini-text">' + completed + '/' + total + '</span>';
    }
}

function openPaulStation(stationId) {
    var st = PAUL_JOURNEY_STATIONS.find(function(s) { return s.id === stationId; });
    if (!st) return;

    var curStation = GameState.paulJourneyStation || 1;
    var sd = GameState.paulJourneyData[stationId] || {};

    document.getElementById('paul-station-icon').innerHTML = '<i class="fas ' + st.icon + '"></i>';
    document.getElementById('paul-station-name').textContent = st.name;
    document.getElementById('paul-station-num').textContent = 'محطة ' + st.id + ' من ' + PAUL_JOURNEY_STATIONS.length;
    document.getElementById('paul-station-desc').textContent = st.desc;
    document.getElementById('paul-station-verse').textContent = st.verse;

    var qArea = document.getElementById('paul-question-area');
    var resultEl = document.getElementById('paul-station-result');
    resultEl.innerHTML = '';

    if (sd.completed) {
        // Already completed
        qArea.style.display = 'none';
        resultEl.innerHTML = '<div class="paul-done-msg"><i class="fas fa-check-circle"></i> تم اجتياز المحطة دي — أحسنت يا بطل! (⭐+' + (st.reward || 3) + ')</div>';
    } else if (stationId > curStation) {
        // Locked
        qArea.style.display = 'none';
        resultEl.innerHTML = '<div class="paul-locked-msg"><i class="fas fa-lock"></i> أكمل المحطة السابقة الأول</div>';
    } else {
        // Show question
        qArea.style.display = 'block';
        document.getElementById('paul-q-text').textContent = st.question.q;
        var answersEl = document.getElementById('paul-answers');
        answersEl.innerHTML = '';
        st.question.options.forEach(function(opt, idx) {
            var btn = document.createElement('button');
            btn.className = 'paul-answer-btn';
            btn.textContent = opt;
            (function(sId, aIdx) {
                btn.onclick = function() { answerPaulQuestion(sId, aIdx); };
            })(stationId, idx);
            answersEl.appendChild(btn);
        });
    }

    document.getElementById('paul-station-info').style.display = 'flex';
}

function answerPaulQuestion(stationId, answerIdx) {
    var st = PAUL_JOURNEY_STATIONS.find(function(s) { return s.id === stationId; });
    if (!st) return;

    var btns = document.querySelectorAll('#paul-answers .paul-answer-btn');
    var resultEl = document.getElementById('paul-station-result');

    if (answerIdx === st.question.correct) {
        // Correct!
        btns[answerIdx].classList.add('correct');
        btns.forEach(function(b) { b.disabled = true; });

        // Award rewards
        var reward = st.reward || 3;
        GameState.paulJourneyData[stationId] = { completed: true, completedAt: new Date().toISOString() };
        GameState.stars += reward;

        // Advance to next station
        if (stationId >= GameState.paulJourneyStation) {
            GameState.paulJourneyStation = stationId + 1;
        }

        var allDone = GameState.paulJourneyStation > PAUL_JOURNEY_STATIONS.length;

        resultEl.innerHTML = '<div class="paul-correct-msg"><i class="fas fa-check-circle"></i> إجابة صحيحة! كسبت ⭐' + reward + ' نجوم</div>';

        saveGame();

        // Animate avatar to next station after delay
        setTimeout(function() {
            closePaulStationInfo();
            animatePaulAvatar(stationId + 1);

            if (allDone) {
                setTimeout(function() {
                    showToast('🎉 أحسنت! أكملت رحلة بولس الأولى كلها!', 4000);
                    confetti();
                }, 1200);
            }
        }, 1200);

    } else {
        // Wrong
        btns[answerIdx].classList.add('wrong');
        btns[st.question.correct].classList.add('correct');
        btns.forEach(function(b) { b.disabled = true; });

        resultEl.innerHTML = '<div class="paul-wrong-msg"><i class="fas fa-times-circle"></i> إجابة خاطئة — حاول تاني!</div>';

        // Allow retry after 2 seconds
        setTimeout(function() {
            resultEl.innerHTML = '';
            btns.forEach(function(b) {
                b.disabled = false;
                b.classList.remove('wrong', 'correct');
            });
        }, 2000);
    }
}

function animatePaulAvatar(targetStationId) {
    var target = PAUL_JOURNEY_STATIONS.find(function(s) { return s.id === targetStationId; });
    if (!target) {
        // Journey complete, stay at last station
        target = PAUL_JOURNEY_STATIONS[PAUL_JOURNEY_STATIONS.length - 1];
    }

    var avatar = document.getElementById('paul-avatar');
    if (!avatar) return;

    avatar.classList.add('moving');
    avatar.style.left = target.x + '%';
    avatar.style.top = target.y + '%';

    setTimeout(function() {
        avatar.classList.remove('moving');
        renderPaulMap();
    }, 1200);
}

function closePaulStationInfo() {
    document.getElementById('paul-station-info').style.display = 'none';
}

// --- Daily Verse & Weekly Challenge Helpers ---
function getDailyVerse() {
    var now = new Date();
    var start = new Date(now.getFullYear(), 0, 0);
    var diff = now - start;
    var dayOfYear = Math.floor(diff / 86400000);
    return DAILY_VERSES[dayOfYear % DAILY_VERSES.length];
}

function getWeeklyChallenge() {
    var now = new Date();
    var start = new Date(now.getFullYear(), 0, 1);
    var diff = now - start;
    var weekOfYear = Math.floor(diff / 86400000 / 7);
    return WEEKLY_CHALLENGES[weekOfYear % WEEKLY_CHALLENGES.length];
}


// --- Date Key Helpers ---
function getTodayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function getWeekKey() {
    var now = new Date();
    var start = new Date(now.getFullYear(), 0, 1);
    var weekNum = Math.floor(((now - start) / 86400000) / 7);
    return now.getFullYear() + '-W' + String(weekNum).padStart(2,'0');
}

function isDailyVerseCompleted() {
    var key = getTodayKey();
    return !!(GameState.dailyVerseLog[key] && GameState.dailyVerseLog[key].completed);
}

function isWeeklyChallengeCompleted() {
    var key = getWeekKey();
    return !!(GameState.weeklyChallengeLog[key] && GameState.weeklyChallengeLog[key].completed);
}

// --- Media Attachment System (Base64 in Firestore) ---
var pendingMedia = { verse: [], challenge: [] };
var activeRecorder = null;
var activeRecorderType = null;
var recordingTimer = null;
var recordingTimeLeft = 0;
var MAX_RECORDING_SECONDS = 30;
var MAX_TOTAL_MEDIA_SIZE = 500 * 1024; // 500KB total per submission

function compressImageToBase64(file, maxW, maxH, quality) {
    return new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onload = function(e) {
            var img = new Image();
            img.onload = function() {
                var canvas = document.createElement('canvas');
                var w = img.width, h = img.height;
                if (w > maxW || h > maxH) {
                    var ratio = Math.min(maxW / w, maxH / h);
                    w = Math.round(w * ratio);
                    h = Math.round(h * ratio);
                }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function blobToBase64(blob) {
    return new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onloadend = function() { resolve(reader.result); };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function getPendingMediaTotalSize(screenType) {
    var total = 0;
    pendingMedia[screenType].forEach(function(item) {
        total += (item.dataURL || '').length;
    });
    return total;
}

function handleMediaSelect(input, screenType, mediaType) {
    var file = input.files[0];
    if (!file) return;

    if (mediaType === 'video') {
        showToast('الفيديو غير متاح حاليا - استخدم صورة أو تسجيل صوتي', 'error');
        input.value = '';
        return;
    }

    var maxSize = 5 * 1024 * 1024; // 5MB raw input limit
    if (file.size > maxSize) {
        showToast('الملف كبير أوي! الحد الأقصى 5 ميجا', 'error');
        input.value = '';
        return;
    }

    if (mediaType === 'image') {
        compressImageToBase64(file, 800, 800, 0.5).then(function(dataURL) {
            if (dataURL.length > 300 * 1024) {
                return compressImageToBase64(file, 600, 600, 0.35);
            }
            return dataURL;
        }).then(function(dataURL) {
            // Remove existing image (overwrite — only 1 image allowed)
            pendingMedia[screenType] = pendingMedia[screenType].filter(function(item) {
                return item.type !== 'image';
            });
            if (getPendingMediaTotalSize(screenType) + dataURL.length > MAX_TOTAL_MEDIA_SIZE) {
                showToast('وصلت الحد الأقصى للملفات المرفقة', 'error');
                return;
            }
            pendingMedia[screenType].push({ dataURL: dataURL, type: 'image', name: file.name });
            renderMediaPreview(screenType);
        }).catch(function() {
            showToast('مشكلة في تحضير الصورة', 'error');
        });
    } else if (mediaType === 'audio') {
        blobToBase64(file).then(function(dataURL) {
            // Remove existing audio (overwrite — only 1 audio allowed)
            pendingMedia[screenType] = pendingMedia[screenType].filter(function(item) {
                return item.type !== 'audio';
            });
            if (getPendingMediaTotalSize(screenType) + dataURL.length > MAX_TOTAL_MEDIA_SIZE) {
                showToast('وصلت الحد الأقصى للملفات المرفقة', 'error');
                return;
            }
            pendingMedia[screenType].push({ dataURL: dataURL, type: 'audio', name: file.name });
            renderMediaPreview(screenType);
        }).catch(function() {
            showToast('مشكلة في تحضير الملف الصوتي', 'error');
        });
    }
    input.value = '';
}

function renderMediaPreview(screenType) {
    var container = document.getElementById(screenType + '-media-preview');
    if (!container) return;
    container.innerHTML = '';
    pendingMedia[screenType].forEach(function(item, idx) {
        var div = document.createElement('div');
        div.className = 'media-preview-item';
        var content = '';
        if (item.type === 'image' && item.dataURL) {
            content = '<img src="' + item.dataURL + '" class="media-preview-thumb" alt="">';
        } else {
            var iconMap = { image: 'fa-image', audio: 'fa-microphone' };
            content = '<i class="fas ' + (iconMap[item.type] || 'fa-file') + '"></i>';
        }
        div.innerHTML = content +
            '<span class="media-preview-name">' + (item.name || item.type) + '</span>' +
            '<button class="media-remove-btn" onclick="removeMedia(\'' + screenType + '\',' + idx + ')"><i class="fas fa-times"></i></button>';
        container.appendChild(div);
    });
}

function removeMedia(screenType, idx) {
    pendingMedia[screenType].splice(idx, 1);
    renderMediaPreview(screenType);
}

function processMediaFiles(screenType) {
    return pendingMedia[screenType].map(function(item) {
        return { type: item.type, dataURL: item.dataURL, name: item.name };
    });
}

// --- Voice Recording ---
function toggleRecording(screenType) {
    if (activeRecorder && activeRecorderType === screenType) {
        stopRecording(screenType);
        return;
    }
    if (activeRecorder) {
        showToast('في تسجيل شغال بالفعل', 'error');
        return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
        activeRecorder = new MediaRecorder(stream);
        activeRecorderType = screenType;
        var chunks = [];
        activeRecorder.ondataavailable = function(e) { chunks.push(e.data); };
        activeRecorder.onstop = function() {
            var blob = new Blob(chunks, { type: 'audio/webm' });
            if (blob.size > 200 * 1024) {
                showToast('التسجيل كبير أوي', 'error');
                stream.getTracks().forEach(function(t) { t.stop(); });
                activeRecorder = null;
                activeRecorderType = null;
                clearRecordingTimer(screenType);
                return;
            }
            blobToBase64(blob).then(function(dataURL) {
                // Remove existing audio (overwrite — only 1 audio allowed)
                pendingMedia[screenType] = pendingMedia[screenType].filter(function(item) {
                    return item.type !== 'audio';
                });
                if (getPendingMediaTotalSize(screenType) + dataURL.length > MAX_TOTAL_MEDIA_SIZE) {
                    showToast('وصلت الحد الأقصى للملفات المرفقة', 'error');
                } else {
                    pendingMedia[screenType].push({ dataURL: dataURL, type: 'audio', name: 'تسجيل صوتي' });
                    renderMediaPreview(screenType);
                }
            });
            stream.getTracks().forEach(function(t) { t.stop(); });
            activeRecorder = null;
            activeRecorderType = null;
            clearRecordingTimer(screenType);
        };
        activeRecorder.start();
        recordingTimeLeft = MAX_RECORDING_SECONDS;
        var recEl = document.getElementById(screenType + '-recording');
        if (recEl) recEl.style.display = 'flex';
        updateRecordingTimerDisplay(screenType);
        recordingTimer = setInterval(function() {
            recordingTimeLeft--;
            updateRecordingTimerDisplay(screenType);
            if (recordingTimeLeft <= 0) {
                stopRecording(screenType);
                showToast('التسجيل وصل للحد الأقصى (30 ثانية)', 'info');
            }
        }, 1000);
    }).catch(function(err) {
        console.error('Mic access error:', err);
        showToast('مقدرش أفتح الميكروفون - اسمح بالإذن', 'error');
    });
}

function stopRecording(screenType) {
    if (activeRecorder && activeRecorderType === screenType) {
        activeRecorder.stop();
    }
}

function updateRecordingTimerDisplay(screenType) {
    var timerEl = document.getElementById(screenType + '-rec-timer');
    if (timerEl) {
        var mins = Math.floor(recordingTimeLeft / 60);
        var secs = recordingTimeLeft % 60;
        timerEl.textContent = mins + ':' + String(secs).padStart(2, '0');
    }
}

function clearRecordingTimer(screenType) {
    if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
    }
    recordingTimeLeft = 0;
    var recEl = document.getElementById(screenType + '-recording');
    if (recEl) recEl.style.display = 'none';
}

function openMediaFullscreen(src) {
    var overlay = document.createElement('div');
    overlay.className = 'media-fullscreen-overlay';
    overlay.innerHTML = '<img src="' + src + '" class="media-fullscreen-img">' +
        '<button class="media-fullscreen-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
}

// --- Verse Detail Screen ---
function openVerseDetail() {
    var verse = getDailyVerse();
    var key = getTodayKey();
    var log = GameState.dailyVerseLog[key] || {};

    document.getElementById('verse-detail-text').textContent = verse.text;
    document.getElementById('verse-detail-ref').textContent = verse.ref;

    var textarea = document.getElementById('verse-reflection');
    var submitBtn = document.getElementById('btn-submit-verse');
    var statusEl = document.getElementById('verse-detail-status');

    pendingMedia.verse = [];
    renderMediaPreview('verse');

    if (log.completed) {
        textarea.value = log.text || '';
        textarea.disabled = true;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span><i class="fas fa-check"></i> تم التسليم</span>';
        statusEl.innerHTML = '<div class="mission-done"><i class="fas fa-check-circle"></i> أحسنت! سلمت تأمل آية اليوم</div>';
        var mediaItems = log.mediaDataURLs || [];
        if (mediaItems.length) {
            var mediaHtml = '<div class="saved-media-inline">';
            mediaItems.forEach(function(item) {
                if (item.type === 'image') {
                    mediaHtml += '<div class="saved-media-item"><img src="' + item.dataURL + '" class="saved-media-img" alt="صورة مرفقة" onclick="openMediaFullscreen(this.src)"></div>';
                } else if (item.type === 'audio') {
                    mediaHtml += '<div class="saved-media-item"><div class="saved-audio-player"><i class="fas fa-microphone"></i> ' + (item.name || 'تسجيل صوتي') + '<audio src="' + item.dataURL + '" controls></audio></div></div>';
                }
            });
            mediaHtml += '</div>';
            statusEl.innerHTML += mediaHtml;
        } else if (log.mediaURLs && log.mediaURLs.length) {
            var mediaHtml2 = '<div class="saved-media">';
            log.mediaURLs.forEach(function(url) { mediaHtml2 += '<a href="' + url + '" target="_blank" class="saved-media-link"><i class="fas fa-link"></i> ملف مرفق</a>'; });
            mediaHtml2 += '</div>';
            statusEl.innerHTML += mediaHtml2;
        }
    } else {
        textarea.value = '';
        textarea.disabled = false;
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span><i class="fas fa-paper-plane"></i> تسليم التأمل</span>';
        statusEl.innerHTML = '';
    }
    showScreen('verse-detail-screen');
}

function submitVerseReflection() {
    var text = document.getElementById('verse-reflection').value.trim();
    if (!text || text.length < 10) {
        showToast('اكتب تأمل أطول (10 حروف على الأقل)', 'error');
        return;
    }
    var key = getTodayKey();
    if (GameState.dailyVerseLog[key] && GameState.dailyVerseLog[key].completed) {
        showToast('سلمت تأمل اليوم بالفعل');
        return;
    }
    var btn = document.getElementById('btn-submit-verse');
    btn.disabled = true;
    btn.innerHTML = '<span><i class="fas fa-spinner fa-spin"></i> جاري الحفظ...</span>';

    var mediaItems = processMediaFiles('verse');
    GameState.dailyVerseLog[key] = {
        completed: true,
        text: text,
        mediaDataURLs: mediaItems,
        completedAt: new Date().toISOString(),
        verseRef: getDailyVerse().ref
    };
    GameState.stars += 1;
    pendingMedia.verse = [];
    btn.innerHTML = '<span><i class="fas fa-check"></i> تم التسليم</span>';
    document.getElementById('verse-reflection').disabled = true;
    document.getElementById('verse-detail-status').innerHTML = '<div class="mission-done"><i class="fas fa-check-circle"></i> أحسنت! كسبت 1 نجمة</div>';
    confetti();
    saveGame();
    syncLeaderboard();
    showToast('تم تسليم تأمل الآية!', 3500, 'success');
}

// --- Challenge Detail Screen ---
function openChallengeDetail() {
    var challenge = getWeeklyChallenge();
    var key = getWeekKey();
    var log = GameState.weeklyChallengeLog[key] || {};

    document.getElementById('challenge-detail-title').textContent = challenge.title;
    document.getElementById('challenge-detail-desc').textContent = challenge.description;
    document.getElementById('challenge-reward-preview').innerHTML = '<span>المكافأة: </span><span>' + challenge.reward + ' نجوم</span>';

    var textarea = document.getElementById('challenge-reflection');
    var submitBtn = document.getElementById('btn-submit-challenge');
    var statusEl = document.getElementById('challenge-detail-status');

    pendingMedia.challenge = [];
    renderMediaPreview('challenge');

    if (log.completed) {
        textarea.value = log.text || '';
        textarea.disabled = true;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span><i class="fas fa-check"></i> تم التسليم</span>';
        statusEl.innerHTML = '<div class="mission-done"><i class="fas fa-check-circle"></i> أحسنت! سلمت تحدي الأسبوع</div>';
        var mediaItems = log.mediaDataURLs || [];
        if (mediaItems.length) {
            var mediaHtml = '<div class="saved-media-inline">';
            mediaItems.forEach(function(item) {
                if (item.type === 'image') {
                    mediaHtml += '<div class="saved-media-item"><img src="' + item.dataURL + '" class="saved-media-img" alt="صورة مرفقة" onclick="openMediaFullscreen(this.src)"></div>';
                } else if (item.type === 'audio') {
                    mediaHtml += '<div class="saved-media-item"><div class="saved-audio-player"><i class="fas fa-microphone"></i> ' + (item.name || 'تسجيل صوتي') + '<audio src="' + item.dataURL + '" controls></audio></div></div>';
                }
            });
            mediaHtml += '</div>';
            statusEl.innerHTML += mediaHtml;
        } else if (log.mediaURLs && log.mediaURLs.length) {
            var mediaHtml2 = '<div class="saved-media">';
            log.mediaURLs.forEach(function(url) { mediaHtml2 += '<a href="' + url + '" target="_blank" class="saved-media-link"><i class="fas fa-link"></i> ملف مرفق</a>'; });
            mediaHtml2 += '</div>';
            statusEl.innerHTML += mediaHtml2;
        }
    } else {
        textarea.value = '';
        textarea.disabled = false;
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span><i class="fas fa-paper-plane"></i> تسليم التحدي</span>';
        statusEl.innerHTML = '';
    }
    showScreen('challenge-detail-screen');
}

function submitChallengeReflection() {
    var text = document.getElementById('challenge-reflection').value.trim();
    if (!text || text.length < 10) {
        showToast('اكتب وصف أطول (10 حروف على الأقل)', 'error');
        return;
    }
    var key = getWeekKey();
    var challenge = getWeeklyChallenge();
    if (GameState.weeklyChallengeLog[key] && GameState.weeklyChallengeLog[key].completed) {
        showToast('سلمت تحدي الأسبوع بالفعل');
        return;
    }
    var btn = document.getElementById('btn-submit-challenge');
    btn.disabled = true;
    btn.innerHTML = '<span><i class="fas fa-spinner fa-spin"></i> جاري الحفظ...</span>';

    var mediaItems = processMediaFiles('challenge');
    GameState.weeklyChallengeLog[key] = {
        completed: true,
        text: text,
        mediaDataURLs: mediaItems,
        completedAt: new Date().toISOString(),
        challengeTitle: challenge.title,
        rewardClaimed: true
    };
    GameState.stars += challenge.reward;
    pendingMedia.challenge = [];
    btn.innerHTML = '<span><i class="fas fa-check"></i> تم التسليم</span>';
    document.getElementById('challenge-reflection').disabled = true;
    document.getElementById('challenge-detail-status').innerHTML = '<div class="mission-done"><i class="fas fa-check-circle"></i> أحسنت! كسبت ' + challenge.reward + ' نجوم</div>';
    confetti();
    saveGame();
    syncLeaderboard();
    showToast('تم تسليم التحدي!', 3500, 'success');
}

// --- Leaderboard ---
var leaderboardData = [];
var currentLBTab = 'stars';

function renderLeaderboard() {
    // Player card (glassmorphism)
    var rank = getRank();
    var lbCh = CHARACTERS[GameState.character] || {};
    var playerCardEl = document.getElementById('lb-player-card');
    playerCardEl.innerHTML = '<div class="lb-my-avatar"><img class="lb-avatar-img" src="'+(lbCh.image||'')+'" alt="avatar"></div>' +
        '<div class="lb-my-info"><h3>'+GameState.playerName+'</h3><p class="lb-my-rank">'+rank.emoji+' '+rank.title+'</p></div>' +
        '<div class="lb-my-stats">' +
        '<div class="lb-my-stat"><span class="lb-my-stat-value">'+GameState.stars+'</span><span class="lb-my-stat-label">نجوم ⭐</span></div>' +
        '<div class="lb-my-stat"><span class="lb-my-stat-value">'+GameState.bestStreak+'</span><span class="lb-my-stat-label">سلسلة 🔥</span></div>' +
        '<div class="lb-my-stat"><span class="lb-my-stat-value">'+GameState.gems+'</span><span class="lb-my-stat-label">جواهر 💎</span></div>' +
        '<div class="lb-my-stat"><span class="lb-my-stat-value">Lv.'+ getXpLevel() +'</span><span class="lb-my-stat-label">XP 🏆</span></div>' +
        '</div>';

    // Achievements grid
    var achDiv = document.getElementById('lb-achievements');
    achDiv.innerHTML = '';
    ACHIEVEMENTS.forEach(function(ach) {
        var earned = false;
        try { earned = ach.check(); } catch(e) {}
        var el = document.createElement('div');
        el.className = 'achievement-card' + (earned ? ' earned' : '');
        el.innerHTML = '<span class="ach-icon">'+ach.icon+'</span><div class="ach-name">'+ach.name+'</div><div class="ach-desc">'+ach.desc+'</div>';
        achDiv.appendChild(el);
    });

    // Tab highlight + indicator
    updateLBTabIndicator();

    // List
    loadLeaderboardFromCloud().then(function(data) {
        leaderboardData = data || [];
        renderLeaderboardList();
    }).catch(function() {
        renderLeaderboardList();
    });
}

function updateLBTabIndicator() {
    var tabs = document.querySelectorAll('.lb-tab-modern');
    var indicator = document.querySelector('.lb-tab-indicator');
    tabs.forEach(function(tab) {
        tab.classList.remove('active');
        if (tab.getAttribute('data-tab') === currentLBTab) {
            tab.classList.add('active');
            if (indicator) {
                indicator.style.width = tab.offsetWidth + 'px';
                indicator.style.left = tab.offsetLeft + 'px';
            }
        }
    });
}

function renderLeaderboardList() {
    var list = document.getElementById('leaderboard-list');
    var podium = document.getElementById('lb-podium');
    list.innerHTML = '';
    podium.innerHTML = '';

    // Combine all players - normalize field names (Firebase uses playerName/playerPhone)
    var allPlayers = leaderboardData.map(function(p) {
        return {
            name: p.playerName || p.name || 'بطل',
            phone: p.playerPhone || p.phone || '',
            stars: p.stars || 0,
            streak: p.bestStreak || p.streak || 0,
            gems: p.gems || 0,
            level: p.currentLevel || p.level || 1,
            character: p.character || 'david',
            xp: p.xp || 0,
            team: p.team || ''
        };
    });
    var meExists = allPlayers.find(function(p) { return p.phone === GameState.playerPhone; });
    if (!meExists && GameState.playerName) {
        allPlayers.push({ name: GameState.playerName, phone: GameState.playerPhone, stars: GameState.stars, streak: GameState.bestStreak, gems: GameState.gems, level: GameState.currentLevel, character: GameState.character, xp: GameState.xp || 0, team: GameState.team || '' });
    }
    // Update current player data in list
    allPlayers.forEach(function(p) {
        if (p.phone === GameState.playerPhone) {
            p.name = GameState.playerName;
            p.stars = GameState.stars;
            p.streak = GameState.bestStreak;
            p.gems = GameState.gems;
            p.level = GameState.currentLevel;
            p.character = GameState.character;
            p.xp = GameState.xp || 0;
            p.team = GameState.team || '';
        }
    });

    var sortKey = currentLBTab === 'stars' ? 'stars' : currentLBTab === 'streak' ? 'streak' : currentLBTab === 'gems' ? 'gems' : currentLBTab === 'xp' ? 'xp' : 'level';
    allPlayers.sort(function(a, b) { return (b[sortKey] || 0) - (a[sortKey] || 0); });

    // Top 3 Podium
    var podiumClasses = ['gold', 'silver', 'bronze'];
    var podiumOrder = [1, 0, 2]; // Display: silver(1), gold(0), bronze(2)
    podiumOrder.forEach(function(idx) {
        var p = allPlayers[idx];
        if (!p) return;
        var pCh = CHARACTERS[p.character] || {};
        var isMe = p.phone === GameState.playerPhone;
        var item = document.createElement('div');
        item.className = 'lb-podium-item ' + podiumClasses[idx];
        var crown = idx === 0 ? '<div class="lb-podium-crown">👑</div>' : '';
        var medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
        item.innerHTML = crown +
            '<div class="lb-podium-rank">' + medal + '</div>' +
            '<img class="lb-podium-avatar" src="'+(pCh.image||'')+'" alt="avatar">' +
            '<div class="lb-podium-name">' + p.name + (isMe ? ' (أنت)' : '') + '</div>' +
            '<div class="lb-podium-score">' + (p[sortKey] || 0) + '</div>';
        podium.appendChild(item);
    });

    // 4th+ as list items (show ALL remaining players)
    allPlayers.slice(3).forEach(function(p, i) {
        var el = document.createElement('div');
        var isMe = p.phone === GameState.playerPhone;
        el.className = 'lb-item-modern' + (isMe ? ' me' : '');
        el.style.animationDelay = (i * 0.05) + 's';
        el.innerHTML = '<span class="lb-rank-num">' + (i + 4) + '</span>' +
            '<span class="lb-name">' + p.name + (isMe ? ' (أنت)' : '') + '</span>' +
            '<span class="lb-score">' + (p[sortKey] || 0) + '</span>';
        list.appendChild(el);
    });

    if (allPlayers.length === 0) {
        podium.innerHTML = '<p style="text-align:center;padding:40px;color:var(--text-muted);width:100%">مفيش بيانات لسه - كون أول بطل!</p>';
    }
}

function switchLBTab(tab) {
    currentLBTab = tab;
    updateLBTabIndicator();
    if (tab === 'teams') {
        renderTeamLeaderboard();
    } else {
        renderLeaderboardList();
    }
}

// --- Profile Edit ---
var PROFILE_AVATARS = [
    { id: 'avatar_cross', icon: '✝️', label: 'صليب' },
    { id: 'avatar_bible', icon: '📖', label: 'كتاب مقدس' },
    { id: 'avatar_church', icon: '⛪', label: 'كنيسة' },
    { id: 'avatar_star', icon: '⭐', label: 'نجمة' },
    { id: 'avatar_crown', icon: '👑', label: 'تاج' },
    { id: 'avatar_fire', icon: '🔥', label: 'نار' },
    { id: 'avatar_shield', icon: '🛡️', label: 'درع' },
    { id: 'avatar_dove', icon: '🕊️', label: 'حمامة' }
];

var selectedProfileAvatar = null;

function showProfileEdit() {
    var modal = document.getElementById('profile-edit-modal');
    modal.style.display = 'flex';
    document.getElementById('profile-edit-name').value = GameState.playerName;

    selectedProfileAvatar = GameState.profileAvatar || null;

    // Render avatar grid: character images + emoji avatars
    var grid = document.getElementById('profile-avatars-grid');
    grid.innerHTML = '';

    // Character images
    Object.keys(CHARACTERS).forEach(function(key) {
        var ch = CHARACTERS[key];
        var el = document.createElement('div');
        el.className = 'profile-avatar-option' + (selectedProfileAvatar === 'char_' + key ? ' selected' : '');
        el.innerHTML = '<img src="' + ch.image + '" alt="' + ch.name + '"><span>' + ch.name + '</span>';
        el.onclick = function() {
            selectedProfileAvatar = 'char_' + key;
            grid.querySelectorAll('.profile-avatar-option').forEach(function(o) { o.classList.remove('selected'); });
            el.classList.add('selected');
        };
        grid.appendChild(el);
    });

    // Emoji avatars
    PROFILE_AVATARS.forEach(function(av) {
        var el = document.createElement('div');
        el.className = 'profile-avatar-option' + (selectedProfileAvatar === av.id ? ' selected' : '');
        el.innerHTML = '<span class="profile-emoji-avatar">' + av.icon + '</span><span>' + av.label + '</span>';
        el.onclick = function() {
            selectedProfileAvatar = av.id;
            grid.querySelectorAll('.profile-avatar-option').forEach(function(o) { o.classList.remove('selected'); });
            el.classList.add('selected');
        };
        grid.appendChild(el);
    });
}

function closeProfileEdit() {
    document.getElementById('profile-edit-modal').style.display = 'none';
}

function saveProfileEdit() {
    var newName = document.getElementById('profile-edit-name').value.trim();
    if (!newName || newName.length < 2) {
        showToast('الاسم لازم يكون حرفين على الأقل', 'error');
        return;
    }
    GameState.playerName = newName;
    if (selectedProfileAvatar) {
        GameState.profileAvatar = selectedProfileAvatar;
    }
    saveToCloud();
    syncLeaderboard();
    renderHomeHub();
    closeProfileEdit();
    showToast('تم حفظ البروفايل! ✅', 'success');
}

// --- Settings ---
function renderSettings() {
    // Theme
    document.querySelectorAll('.theme-card').forEach(function(card) {
        card.classList.remove('active');
        if (card.getAttribute('data-theme') === GameState.theme) card.classList.add('active');
    });

    // Install section
    var isInstalled = window.matchMedia('(display-mode: standalone)').matches;
    var installSection = document.getElementById('settings-install-section');
    var installBtn = document.getElementById('settings-install-btn');
    var resetBtn = document.getElementById('settings-reset-install');
    if (installSection) {
        if (isInstalled) {
            installSection.style.display = 'none';
        } else {
            installSection.style.display = '';
            var isHidden = localStorage.getItem('minElBatal_installHidden') === 'true';
            if (installBtn) installBtn.style.display = isHidden ? 'none' : '';
            if (resetBtn) resetBtn.style.display = isHidden ? '' : 'none';
        }
    }
}

// --- Achievements ---
function checkAchievements() {
    ACHIEVEMENTS.forEach(function(ach) {
        try {
            if (ach.check() && !localStorage.getItem('ach_'+ach.id)) {
                localStorage.setItem('ach_'+ach.id, '1');
                showToast('🏅 إنجاز جديد: ' + ach.name + '!', 3500);
            }
        } catch(e) {}
    });
}

// --- Confetti ---
function confetti() {
    var colors = ['#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#ff6eb4','#a855f7'];
    for (var i = 0; i < 50; i++) {
        var piece = document.createElement('div');
        piece.className = 'confetti-piece';
        piece.style.left = Math.random()*100 + 'vw';
        piece.style.backgroundColor = colors[Math.floor(Math.random()*colors.length)];
        piece.style.animationDuration = (2+Math.random()*3)+'s';
        piece.style.animationDelay = Math.random()*2+'s';
        piece.style.animation = 'confettiFall '+piece.style.animationDuration+' ease-out '+piece.style.animationDelay+' forwards';
        document.body.appendChild(piece);
        (function(p) { setTimeout(function() { if (p.parentNode) p.parentNode.removeChild(p); }, 6000); })(piece);
    }
}


// --- Logout ---
function logout() {
    GameState.playerName = '';
    GameState.playerPhone = '';
    GameState.username = '';
    GameState.email = '';
    GameState.academicYear = '';
    GameState.character = 'david';
    GameState.currentLevel = 1;
    GameState.stars = 0;
    GameState.gems = 0;
    GameState.streak = 0;
    GameState.bestStreak = 0;
    GameState.totalCorrect = 0;
    GameState.totalAnswered = 0;
    GameState.levelsData = {};
    GameState.powerUps = { fiftyFifty: 2, skip: 1, doublePoints: 1, freeze: 1, hint: 2 };
    GameState.armor = [];
    GameState.equippedArmor = {};
    GameState.gamesPlayed = 0;
    GameState.perfectLevels = 0;
    GameState.missionsCompleted = 0;
    GameState.dailyVerseLog = {};
    GameState.weeklyChallengeLog = {};
    GameState.paulJourneyStation = 1;
    GameState.paulJourneyData = {};
    GameState.lampData = { points: 0, streakDays: 0, lastActiveDate: '', dailyLog: {} };
    GameState.xp = 0;
    GameState.team = '';
    GameState.redeemedRewards = [];
    GameState.dailyLoginDate = '';
    // Clear remember me
    try { localStorage.removeItem('minElBatal_remember'); } catch(e) {}
    // Reset login form fields
    var fields = ['login-username', 'login-password', 'player-name', 'player-username', 'player-email', 'player-phone', 'player-password', 'player-password-confirm'];
    fields.forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ''; });
    var yearSelect = document.getElementById('player-year');
    if (yearSelect) yearSelect.selectedIndex = 0;
    // Show login view (not register)
    showLoginView();
    showScreen('splash-screen');
    showToast('تم تسجيل الخروج');
}

// ============================================================
// XP SYSTEM, REWARDS SHOP, TEAMS, ANTI-FARMING
// ============================================================

// --- XP Helper (kept minimal - gems are the main currency) ---
function getXpLevel() {
    return Math.floor((GameState.xp || 0) / 200) + 1;
}

function awardXP(amount, reason) {
    // XP removed - gems are the main reward currency
    // Kept as no-op for backward compatibility
}

// --- Daily Login Bonus ---
function checkDailyLoginXP() {
    var today = new Date().toISOString().split('T')[0];
    if (GameState.dailyLoginDate !== today) {
        var yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        if (GameState.dailyLoginDate === yesterday) {
            GameState.loginStreak = (GameState.loginStreak || 0) + 1;
        } else {
            GameState.loginStreak = 1;
        }
        GameState.dailyLoginDate = today;
        GameState.gems = (GameState.gems || 0) + 5;
        var streakMsg = GameState.loginStreak > 1 ? ' 🔥 ' + GameState.loginStreak + ' أيام متواصلة!' : '';
        showToast('مرحباً! 💎 +5 جواهر يومية' + streakMsg, 'success');
        saveToCloud();
    }
}

// --- Anti-Farming: Diminishing Returns ---
function getDiminishingFactor(attempts) {
    if (!attempts || attempts <= 1) return 1.0;
    if (attempts === 2) return 0.8;
    if (attempts === 3) return 0.6;
    return 0.4; // 4+
}

function canAttemptQuiz(subKey, lessonIdx) {
    var data = GameState.level2Data && GameState.level2Data[subKey] &&
        GameState.level2Data[subKey]['lesson_' + lessonIdx];
    if (!data || !data.lastAttemptTime) return true;
    var elapsed = Date.now() - data.lastAttemptTime;
    var cooldownMs = 5 * 60 * 1000; // 5 minutes
    return elapsed >= cooldownMs;
}

function getCooldownRemaining(subKey, lessonIdx) {
    var data = GameState.level2Data && GameState.level2Data[subKey] &&
        GameState.level2Data[subKey]['lesson_' + lessonIdx];
    if (!data || !data.lastAttemptTime) return 0;
    var elapsed = Date.now() - data.lastAttemptTime;
    var cooldownMs = 5 * 60 * 1000;
    return Math.max(0, cooldownMs - elapsed);
}

// --- First-Time Bonus ---
function checkFirstTimePerfect(subKey, lessonIdx, percentage) {
    if (!GameState.level2Data) GameState.level2Data = {};
    if (!GameState.level2Data[subKey]) GameState.level2Data[subKey] = {};
    var data = GameState.level2Data[subKey]['lesson_' + lessonIdx] || {};
    // Only on FIRST attempt and score >= 90%
    if ((!data.attempts || data.attempts === 0) && percentage >= 90) {
        // Mark it
        if (!GameState.level2Data[subKey]['lesson_' + lessonIdx]) {
            GameState.level2Data[subKey]['lesson_' + lessonIdx] = {};
        }
        GameState.level2Data[subKey]['lesson_' + lessonIdx].firstAttemptPerfect = true;
        // Award bonuses
        GameState.gems = (GameState.gems || 0) + 20;
        GameState.stars = (GameState.stars || 0) + 10;
        awardXP(100, 'first attempt perfect');
        // Show achievement
        setTimeout(function() {
            showAchievement('🏅', 'أول مرة بطل!', 'نتيجة ممتازة من أول مرة! +20 جواهر +10 نجوم');
        }, 1000);
        return true;
    }
    return false;
}

// --- Rewards Catalog ---
var REWARDS_CATALOG = [
    { id: 'trip_discount', name: 'خصم ١٠٪ على رحلة الخدمة ✈️', desc: 'خصم على رحلة الخدمة القادمة', cost: { stars: 20000, gems: 5000 }, icon: '✈️', category: 'instant' },
    { id: 'surprise_box', name: 'صندوق المفاجآت 🎁', desc: 'هدية مفاجأة!', cost: { stars: 40000, gems: 10000 }, icon: '🎁', category: 'instant' },
    { id: 'conf_discount', name: 'خصم ١٠٪ على المؤتمر ⛪', desc: 'خصم على المؤتمر القادم', cost: { stars: 80000, gems: 20000 }, icon: '⛪', category: 'instant' },
    { id: 'cash_prize', name: 'هدية نقدية فورية 💰', desc: 'جائزة نقدية فورية', cost: { stars: 160000, gems: 40000 }, icon: '💰', category: 'premium' },
    { id: 'phone_case', name: 'جراب موبايل 📱', desc: 'جراب موبايل مميز', cost: { stars: 320000, gems: 80000 }, icon: '📱', category: 'premium' }
];

// --- Rewards Shop Rendering ---
function renderRewardsShop() {
    var container = document.getElementById('rewards-shop-body');
    if (!container) return;

    var html = '';
    // Balance bar
    html += '<div class="rewards-balance">';
    html += '<div class="rewards-balance-item"><span class="stat-icon">⭐</span><span>' + (GameState.stars || 0) + '</span><span class="rewards-balance-label">نجوم</span></div>';
    html += '<div class="rewards-balance-item"><span class="stat-icon">💎</span><span>' + (GameState.gems || 0) + '</span><span class="rewards-balance-label">جواهر</span></div>';
    html += '</div>';

    // Instant rewards
    html += '<h3 class="rewards-section-title"><i class="fas fa-gift"></i> هدايا فورية</h3>';
    html += '<div class="rewards-grid">';
    REWARDS_CATALOG.filter(function(r) { return r.category === 'instant'; }).forEach(function(reward) {
        html += renderRewardCard(reward);
    });
    html += '</div>';

    // Premium rewards
    html += '<h3 class="rewards-section-title"><i class="fas fa-crown"></i> هدايا مميزة</h3>';
    html += '<div class="rewards-grid">';
    REWARDS_CATALOG.filter(function(r) { return r.category === 'premium'; }).forEach(function(reward) {
        html += renderRewardCard(reward);
    });
    html += '</div>';

    // Redeemed history
    if (GameState.redeemedRewards && GameState.redeemedRewards.length > 0) {
        html += '<h3 class="rewards-section-title"><i class="fas fa-history"></i> طلباتك السابقة</h3>';
        html += '<div class="rewards-history">';
        GameState.redeemedRewards.slice().reverse().forEach(function(r) {
            var item = REWARDS_CATALOG.find(function(c) { return c.id === r.id; });
            html += '<div class="reward-history-item">';
            html += '<span class="reward-history-icon">' + (item ? item.icon : '🎁') + '</span>';
            html += '<div class="reward-history-info"><span>' + (item ? item.name : r.id) + '</span><small>' + (r.date || '') + '</small></div>';
            html += '<span class="reward-history-status">' + (r.fulfilled ? '✅' : '⏳') + '</span>';
            html += '</div>';
        });
        html += '</div>';
    }

    container.innerHTML = html;
}

function renderRewardCard(reward) {
    var canAfford = (GameState.stars || 0) >= reward.cost.stars && (GameState.gems || 0) >= reward.cost.gems;
    var html = '<div class="reward-card ' + (canAfford ? '' : 'reward-locked') + '">';
    html += '<div class="reward-icon">' + reward.icon + '</div>';
    html += '<h4 class="reward-name">' + reward.name + '</h4>';
    html += '<p class="reward-desc">' + reward.desc + '</p>';
    html += '<div class="reward-cost">';
    html += '<span>⭐ ' + reward.cost.stars + '</span>';
    html += '<span>💎 ' + reward.cost.gems + '</span>';
    html += '</div>';
    html += '<button class="btn ' + (canAfford ? 'btn-primary' : 'btn-secondary') + ' btn-sm reward-btn" ' +
        (canAfford ? 'onclick="redeemReward(\'' + reward.id + '\')"' : 'disabled') + '>' +
        '<span>' + (canAfford ? '<i class="fas fa-gift"></i> اطلب' : '<i class="fas fa-lock"></i> جمّع أكتر') + '</span></button>';
    html += '</div>';
    return html;
}

function redeemReward(rewardId) {
    var reward = REWARDS_CATALOG.find(function(r) { return r.id === rewardId; });
    if (!reward) return;
    if ((GameState.stars || 0) < reward.cost.stars || (GameState.gems || 0) < reward.cost.gems) {
        showToast('مش معاك نجوم أو جواهر كفاية!', 'error');
        return;
    }

    // Deduct
    GameState.stars -= reward.cost.stars;
    GameState.gems -= reward.cost.gems;

    // Record redemption
    if (!GameState.redeemedRewards) GameState.redeemedRewards = [];
    var redemption = {
        id: reward.id,
        date: new Date().toISOString().split('T')[0],
        fulfilled: false
    };
    GameState.redeemedRewards.push(redemption);

    // Save to Firestore reward_requests collection
    if (firebaseDb && GameState.playerPhone) {
        firebaseDb.collection('reward_requests').add({
            playerPhone: GameState.playerPhone,
            playerName: GameState.playerName,
            rewardId: reward.id,
            rewardName: reward.name,
            cost: reward.cost,
            date: new Date().toISOString(),
            fulfilled: false
        }).catch(function(e) { console.error('Reward request save error:', e); });
    }

    saveToCloud();
    syncLeaderboard();
    showToast('تم طلب ' + reward.name + ' بنجاح! 🎉', 'success');
    showAchievement('🎁', 'طلبت هدية!', reward.name);
    renderRewardsShop();
}

// --- Team System (Full UI) ---
var TEAM_LOGOS = ['⚔️','🛡️','🔥','⭐','🏆','💎','✝️','🕊️','⚡','🦁','🐉','👑','🎯','💪','🌟','🗡️'];

function renderTeamsScreen() {
    var container = document.getElementById('teams-screen-body');
    if (!container) return;

    var html = '';

    if (GameState.team) {
        // Show my team card
        html += '<div class="my-team-card" style="border-top:3px solid ' + (GameState.teamColor || '#6C5CE7') + '">';
        html += '<div class="my-team-header">';
        html += '<div class="my-team-logo" style="background:' + (GameState.teamColor || '#6C5CE7') + '">' + (GameState.teamLogo || '⚔️') + '</div>';
        html += '<div class="my-team-info"><h3>' + GameState.team + '</h3><p>فريقك الحالي</p></div>';
        html += '</div>';
        html += '<div id="my-team-members" class="my-team-members"><p style="text-align:center;color:var(--text-muted)">جاري التحميل...</p></div>';
        html += '<div class="my-team-actions">';
        html += '<button class="btn btn-danger btn-sm" onclick="leaveTeam()"><span><i class="fas fa-sign-out-alt"></i> اترك الفريق</span></button>';
        html += '</div>';
        html += '</div>';
        // Load team members
        loadMyTeamMembers();
    } else {
        // Create team section
        html += '<div class="team-create-card">';
        html += '<h3><i class="fas fa-plus-circle"></i> أنشئ فريق جديد</h3>';
        html += '<p style="color:var(--text-muted);font-size:13px;margin-bottom:12px">أقصى عدد 6 أعضاء في الفريق</p>';
        html += '<input type="text" id="create-team-name" class="input-field" placeholder="اسم الفريق" maxlength="20" style="margin-bottom:10px">';
        // Logo picker
        html += '<div class="team-logo-picker">';
        html += '<p style="font-size:12px;color:var(--text-muted);margin-bottom:8px">اختار شعار:</p>';
        html += '<div class="team-logos-grid" id="team-logos-grid">';
        TEAM_LOGOS.forEach(function(logo, idx) {
            html += '<div class="team-logo-option ' + (idx === 0 ? 'selected' : '') + '" data-logo="' + logo + '" onclick="selectTeamLogo(this, \'' + logo + '\')">' + logo + '</div>';
        });
        html += '</div></div>';
        // Color picker
        html += '<div class="team-color-picker">';
        html += '<p style="font-size:12px;color:var(--text-muted);margin-bottom:8px">اختار لون الفريق:</p>';
        html += '<div class="team-colors-grid">';
        TEAM_COLORS.forEach(function(color, idx) {
            html += '<div class="team-color-option ' + (idx === 0 ? 'selected' : '') + '" style="background:' + color + '" onclick="selectTeamColor(this,\'' + color + '\')"></div>';
        });
        html += '</div></div>';
        // Image upload
        html += '<div class="team-image-upload">';
        html += '<p style="font-size:12px;color:var(--text-muted);margin-bottom:8px">صورة الفريق (اختياري):</p>';
        html += '<div style="display:flex;gap:10px;align-items:center;">';
        html += '<label class="btn btn-secondary btn-sm" style="cursor:pointer"><span><i class="fas fa-camera"></i> اختار صورة</span><input type="file" accept="image/*" onchange="handleTeamImage(event)" style="display:none"></label>';
        html += '<div id="team-img-preview"></div>';
        html += '</div></div>';
        html += '<button class="btn btn-primary" style="width:100%;margin-top:12px" onclick="createTeam()"><span><i class="fas fa-plus"></i> أنشئ الفريق</span></button>';
        html += '</div>';
    }

    // Browse open teams
    html += '<div class="teams-browse-section">';
    html += '<h3 class="teams-browse-title"><i class="fas fa-search"></i> فرق متاحة للانضمام</h3>';
    html += '<div id="open-teams-list" class="open-teams-list"><p style="text-align:center;color:var(--text-muted);padding:20px">جاري التحميل...</p></div>';
    html += '</div>';

    container.innerHTML = html;
    loadOpenTeams();
}

var _selectedTeamLogo = '⚔️';
var _selectedTeamColor = '#6C5CE7';
var _teamImageData = '';
var TEAM_COLORS = ['#6C5CE7','#00CEC9','#E17055','#00B894','#FDCB6E','#E84393','#0984E3','#D63031','#6AB04C','#F9CA24','#30336B','#22A6B3'];

function selectTeamLogo(el, logo) {
    _selectedTeamLogo = logo;
    document.querySelectorAll('.team-logo-option').forEach(function(o) { o.classList.remove('selected'); });
    el.classList.add('selected');
}

function selectTeamColor(el, color) {
    _selectedTeamColor = color;
    document.querySelectorAll('.team-color-option').forEach(function(o) { o.classList.remove('selected'); });
    el.classList.add('selected');
}

function handleTeamImage(event) {
    var file = event.target.files[0];
    if (!file) return;
    // Max 2MB raw file
    if (file.size > 2 * 1024 * 1024) {
        showToast('الصورة كبيرة أوي! الحد الأقصى 2MB', 'error');
        return;
    }
    var reader = new FileReader();
    reader.onload = function(e) {
        // Compress image to max 200x200, quality 0.6
        compressImage(e.target.result, 200, 0.6, function(compressedData) {
            _teamImageData = compressedData;
            var preview = document.getElementById('team-img-preview');
            if (preview) preview.innerHTML = '<img src="' + _teamImageData + '" style="width:60px;height:60px;border-radius:50%;object-fit:cover;border:2px solid var(--gold)">';
            showToast('تم اختيار الصورة ✅ (' + Math.round(compressedData.length / 1024) + 'KB)', 'success');
        });
    };
    reader.readAsDataURL(file);
}

function compressImage(dataUrl, maxSize, quality, callback) {
    var img = new Image();
    img.onload = function() {
        var canvas = document.createElement('canvas');
        var w = img.width;
        var h = img.height;
        // Scale down to maxSize
        if (w > maxSize || h > maxSize) {
            if (w > h) {
                h = Math.round(h * maxSize / w);
                w = maxSize;
            } else {
                w = Math.round(w * maxSize / h);
                h = maxSize;
            }
        }
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        var result = canvas.toDataURL('image/jpeg', quality);
        // If still too big (>500KB), reduce quality further
        if (result.length > 500 * 1024) {
            result = canvas.toDataURL('image/jpeg', 0.3);
        }
        callback(result);
    };
    img.src = dataUrl;
}

function loadOpenTeams() {
    if (!firebaseDb) return;
    firebaseDb.collection('teams').orderBy('createdAt', 'desc').limit(20).get().then(function(snapshot) {
        var list = document.getElementById('open-teams-list');
        if (!list) return;
        if (snapshot.empty) {
            list.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px">مفيش فرق لسه - كون أول فريق!</p>';
            return;
        }
        var html = '';
        snapshot.forEach(function(doc) {
            var t = doc.data();
            var members = t.members || [];
            var memberNames = t.memberNames || [];
            var isFull = members.length >= 6;
            var isMyTeam = GameState.team === t.name;
            var isMember = members.indexOf(GameState.playerPhone) >= 0;
            var teamColor = t.color || '#6C5CE7';
            html += '<div class="open-team-card ' + (isFull ? 'full' : '') + '" style="border-right: 4px solid ' + teamColor + '">';
            // Team logo/image
            if (t.image) {
                html += '<div class="open-team-logo"><img src="' + t.image + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover"></div>';
            } else {
                html += '<div class="open-team-logo" style="background:linear-gradient(135deg, ' + teamColor + '33, ' + teamColor + '66)">' + (t.logo || '⚔️') + '</div>';
            }
            html += '<div class="open-team-info">';
            html += '<h4>' + t.name + '</h4>';
            html += '<p><i class="fas fa-users" style="margin-left:4px"></i> ' + members.length + '/6 أعضاء</p>';
            // Show ALL member names
            if (memberNames.length > 0) {
                html += '<div class="open-team-members-detail">';
                memberNames.forEach(function(name, idx) {
                    html += '<span class="team-member-chip">' + (idx + 1) + '. ' + name + '</span>';
                });
                html += '</div>';
            }
            html += '</div>';
            var hasPendingRequest = (t.joinRequests || []).some(function(r) { return r.phone === GameState.playerPhone; });
            html += '<div class="open-team-action">';
            if (isMyTeam || isMember) {
                html += '<span class="open-team-status">✅ فريقك</span>';
            } else if (hasPendingRequest) {
                html += '<span class="open-team-status" style="color:var(--gold)">⏳ في الانتظار</span>';
            } else if (isFull) {
                html += '<span class="open-team-status full">ممتلئ</span>';
            } else {
                html += '<button class="btn btn-primary btn-sm" onclick="requestJoinTeam(\'' + doc.id.replace(/'/g, "\\'") + '\')"><span>انضم</span></button>';
            }
            html += '</div>';
            html += '</div>';
        });
        list.innerHTML = html;
    }).catch(function(e) {
        console.error('Load teams error:', e);
    });
}

function loadMyTeamMembers() {
    if (!firebaseDb || !GameState.team) return;
    var docId = GameState.team.replace(/[\/\\\.#\[\]\*]/g, '_');
    firebaseDb.collection('teams').doc(docId).get().then(function(doc) {
        var el = document.getElementById('my-team-members');
        if (!el || !doc.exists) return;
        var t = doc.data();
        var names = t.memberNames || [];
        var members = t.members || [];
        var admins = t.admins || [];
        // Auto-set first 2 members as admins if admins field is empty
        if (admins.length === 0 && members.length > 0) {
            admins = members.slice(0, 2);
            firebaseDb.collection('teams').doc(docId).update({ admins: admins }).catch(function(){});
        }
        var isAdmin = admins.indexOf(GameState.playerPhone) >= 0;
        var html = '<div class="my-team-members-list">';
        names.forEach(function(name, idx) {
            var memberPhone = members[idx] || '';
            var memberIsAdmin = admins.indexOf(memberPhone) >= 0;
            html += '<div class="my-team-member" style="display:flex;align-items:center;gap:6px">';
            html += '<span class="member-num">' + (idx + 1) + '</span>';
            html += '<span style="flex:1">' + name + (memberIsAdmin ? ' <i class="fas fa-shield-alt" style="color:var(--gold);font-size:10px" title="أدمن"></i>' : '') + '</span>';
            if (isAdmin && !memberIsAdmin && memberPhone !== GameState.playerPhone) {
                html += '<button class="btn-icon-sm" onclick="removeTeamMember(\'' + docId + '\',\'' + memberPhone + '\')" title="إزالة العضو" style="background:rgba(231,76,60,0.2);border:1px solid rgba(231,76,60,0.4);color:#e74c3c;width:24px;height:24px;border-radius:50%;font-size:10px;cursor:pointer"><i class="fas fa-times"></i></button>';
            }
            html += '</div>';
        });
        html += '</div>';
        html += '<p class="my-team-count">' + names.length + '/6 أعضاء</p>';

        // Admin: show join requests
        var joinRequests = t.joinRequests || [];
        if (isAdmin && joinRequests.length > 0) {
            html += '<div class="team-join-requests" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">';
            html += '<h4 style="font-size:13px;color:var(--gold);margin-bottom:8px"><i class="fas fa-user-clock"></i> طلبات الانضمام (' + joinRequests.length + ')</h4>';
            joinRequests.forEach(function(req) {
                html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05)">';
                html += '<span style="flex:1;font-size:13px">' + req.name + '</span>';
                html += '<button onclick="approveJoinRequest(\'' + docId + '\',\'' + req.phone + '\',\'' + req.name.replace(/'/g, "\\'") + '\')" style="background:rgba(46,204,113,0.2);border:1px solid rgba(46,204,113,0.4);color:#2ecc71;padding:4px 10px;border-radius:8px;font-size:11px;cursor:pointer;font-family:Cairo"><i class="fas fa-check"></i> قبول</button>';
                html += '<button onclick="rejectJoinRequest(\'' + docId + '\',\'' + req.phone + '\')" style="background:rgba(231,76,60,0.2);border:1px solid rgba(231,76,60,0.4);color:#e74c3c;padding:4px 10px;border-radius:8px;font-size:11px;cursor:pointer;font-family:Cairo"><i class="fas fa-times"></i> رفض</button>';
                html += '</div>';
            });
            html += '</div>';
        }

        // Admin: edit team button
        if (isAdmin) {
            html += '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">';
            html += '<button class="btn btn-secondary btn-sm" onclick="showEditTeamDialog(\'' + docId + '\')" style="width:100%"><span><i class="fas fa-edit"></i> تعديل بيانات الفريق</span></button>';
            html += '</div>';
        }

        el.innerHTML = html;
    });
}

function approveJoinRequest(docId, phone, name) {
    if (!firebaseDb) return;
    firebaseDb.collection('teams').doc(docId).get().then(function(doc) {
        if (!doc.exists) return;
        var t = doc.data();
        var members = t.members || [];
        if (members.length >= 6) { showToast('الفريق ممتلئ!', 'error'); return; }
        if (members.indexOf(phone) >= 0) { showToast('العضو موجود بالفعل', 'info'); return; }
        members.push(phone);
        var joinRequests = (t.joinRequests || []).filter(function(r) { return r.phone !== phone; });
        // Auto-set first 2 members as admins
        var admins = t.admins || [];
        if (admins.length < 2 && members.length <= 2) {
            admins = members.slice(0, 2);
        }
        return firebaseDb.collection('teams').doc(docId).update({
            members: members,
            memberNames: firebase.firestore.FieldValue.arrayUnion(name),
            joinRequests: joinRequests,
            admins: admins
        }).then(function() {
            showToast('تم قبول ' + name + ' في الفريق! ✅', 'success');
            loadMyTeamMembers();
        });
    }).catch(function(e) { console.error(e); showToast('حصل مشكلة', 'error'); });
}

function rejectJoinRequest(docId, phone) {
    if (!firebaseDb) return;
    firebaseDb.collection('teams').doc(docId).get().then(function(doc) {
        if (!doc.exists) return;
        var t = doc.data();
        var joinRequests = (t.joinRequests || []).filter(function(r) { return r.phone !== phone; });
        return firebaseDb.collection('teams').doc(docId).update({ joinRequests: joinRequests });
    }).then(function() {
        showToast('تم رفض الطلب', 'info');
        loadMyTeamMembers();
    }).catch(function(e) { console.error(e); });
}

function removeTeamMember(docId, phone) {
    if (!confirm('متأكد إنك عايز تشيل العضو ده من الفريق؟')) return;
    if (!firebaseDb) return;
    firebaseDb.collection('teams').doc(docId).get().then(function(doc) {
        if (!doc.exists) return;
        var t = doc.data();
        var idx = (t.members || []).indexOf(phone);
        var members = (t.members || []).filter(function(m) { return m !== phone; });
        var memberNames = t.memberNames || [];
        if (idx >= 0 && idx < memberNames.length) {
            memberNames.splice(idx, 1);
        }
        return firebaseDb.collection('teams').doc(docId).update({
            members: members,
            memberNames: memberNames
        });
    }).then(function() {
        showToast('تم إزالة العضو من الفريق', 'success');
        loadMyTeamMembers();
    }).catch(function(e) { console.error(e); showToast('حصل مشكلة', 'error'); });
}

function showEditTeamDialog(docId) {
    if (!firebaseDb) return;
    firebaseDb.collection('teams').doc(docId).get().then(function(doc) {
        if (!doc.exists) return;
        var t = doc.data();
        var overlay = document.createElement('div');
        overlay.id = 'edit-team-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
        var card = '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:16px;padding:24px;max-width:400px;width:100%;direction:rtl;font-family:Cairo">';
        card += '<h3 style="color:var(--gold);margin-bottom:16px;text-align:center"><i class="fas fa-edit"></i> تعديل الفريق</h3>';
        card += '<label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">اسم الفريق:</label>';
        card += '<input type="text" id="edit-team-name" value="' + (t.name || '') + '" class="input-field" style="margin-bottom:12px;width:100%;box-sizing:border-box">';
        card += '<label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">شعار:</label>';
        card += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">';
        TEAM_LOGOS.forEach(function(logo) {
            card += '<div class="team-logo-option' + (logo === t.logo ? ' selected' : '') + '" onclick="document.getElementById(\'edit-team-logo-val\').value=this.textContent;document.querySelectorAll(\'#edit-team-overlay .team-logo-option\').forEach(function(o){o.classList.remove(\'selected\')});this.classList.add(\'selected\')" style="cursor:pointer;font-size:20px;padding:6px;border:2px solid ' + (logo === t.logo ? 'var(--gold)' : 'transparent') + ';border-radius:8px">' + logo + '</div>';
        });
        card += '</div><input type="hidden" id="edit-team-logo-val" value="' + (t.logo || '⚔️') + '">';
        card += '<label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">لون الفريق:</label>';
        card += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">';
        TEAM_COLORS.forEach(function(color) {
            card += '<div onclick="document.getElementById(\'edit-team-color-val\').value=\'' + color + '\';document.querySelectorAll(\'#edit-team-overlay .team-color-swatch\').forEach(function(o){o.style.border=\'2px solid transparent\'});this.style.border=\'2px solid white\'" class="team-color-swatch" style="width:28px;height:28px;border-radius:50%;background:' + color + ';cursor:pointer;border:2px solid ' + (color === t.color ? 'white' : 'transparent') + '"></div>';
        });
        card += '</div><input type="hidden" id="edit-team-color-val" value="' + (t.color || '#6C5CE7') + '">';
        card += '<label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">صورة الفريق:</label>';
        card += '<div style="display:flex;gap:10px;align-items:center;margin-bottom:16px">';
        card += '<label class="btn btn-secondary btn-sm" style="cursor:pointer"><span><i class="fas fa-camera"></i> اختار صورة</span><input type="file" accept="image/*" onchange="handleEditTeamImage(event)" style="display:none"></label>';
        card += '<div id="edit-team-img-preview">' + (t.image ? '<img src="' + t.image + '" style="width:50px;height:50px;border-radius:50%;object-fit:cover;border:2px solid var(--gold)">' : '') + '</div>';
        card += '</div>';
        card += '<div style="display:flex;gap:10px">';
        card += '<button class="btn btn-primary" style="flex:1" onclick="saveEditTeam(\'' + docId + '\')"><span><i class="fas fa-save"></i> حفظ</span></button>';
        card += '<button class="btn btn-secondary" style="flex:1" onclick="document.getElementById(\'edit-team-overlay\').remove()"><span>إلغاء</span></button>';
        card += '</div></div>';
        overlay.innerHTML = card;
        overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);
    });
}

var _editTeamImageData = '';
function handleEditTeamImage(event) {
    var file = event.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast('الصورة كبيرة أوي!', 'error'); return; }
    var reader = new FileReader();
    reader.onload = function(e) {
        compressImage(e.target.result, 200, 0.6, function(compressed) {
            _editTeamImageData = compressed;
            var preview = document.getElementById('edit-team-img-preview');
            if (preview) preview.innerHTML = '<img src="' + compressed + '" style="width:50px;height:50px;border-radius:50%;object-fit:cover;border:2px solid var(--gold)">';
        });
    };
    reader.readAsDataURL(file);
}

function saveEditTeam(docId) {
    if (!firebaseDb) return;
    var nameEl = document.getElementById('edit-team-name');
    var logoEl = document.getElementById('edit-team-logo-val');
    var colorEl = document.getElementById('edit-team-color-val');
    var newName = nameEl ? nameEl.value.trim() : '';
    if (!newName || newName.length < 2) { showToast('اسم الفريق لازم يكون حرفين على الأقل', 'error'); return; }
    var updates = {
        name: newName,
        logo: logoEl ? logoEl.value : '⚔️',
        color: colorEl ? colorEl.value : '#6C5CE7'
    };
    if (_editTeamImageData) updates.image = _editTeamImageData;
    firebaseDb.collection('teams').doc(docId).update(updates).then(function() {
        GameState.team = newName;
        GameState.teamLogo = updates.logo;
        GameState.teamColor = updates.color;
        _editTeamImageData = '';
        saveToLocalStorage();
        showToast('تم تحديث بيانات الفريق! ✅', 'success');
        var overlay = document.getElementById('edit-team-overlay');
        if (overlay) overlay.remove();
        renderTeamsScreen();
        updateHubTeamBadge();
    }).catch(function(e) { console.error(e); showToast('حصل مشكلة', 'error'); });
}

function requestJoinTeam(docId) {
    if (GameState.team) {
        showToast('لازم تترك فريقك الأول قبل ما تنضم لفريق تاني', 'error');
        return;
    }
    joinTeamByDocId(docId);
}

function joinTeamByDocId(docId) {
    if (!firebaseDb) { showToast('مفيش اتصال', 'error'); return; }
    firebaseDb.collection('teams').doc(docId).get().then(function(doc) {
        if (!doc.exists) { showToast('الفريق مش موجود', 'error'); return; }
        var teamData = doc.data();
        var members = teamData.members || [];
        if (members.length >= 6) { showToast('الفريق ممتلئ!', 'error'); return; }
        if (members.indexOf(GameState.playerPhone) >= 0) { showToast('أنت موجود بالفعل!', 'error'); return; }
        var joinRequests = teamData.joinRequests || [];
        if (joinRequests.some(function(r) { return r.phone === GameState.playerPhone; })) {
            showToast('طلبك مسجل بالفعل - استنى موافقة الأدمن', 'info');
            return;
        }
        // Submit join request instead of joining directly
        joinRequests.push({ phone: GameState.playerPhone, name: GameState.playerName, date: new Date().toISOString() });
        return firebaseDb.collection('teams').doc(docId).update({
            joinRequests: joinRequests
        }).then(function() {
            showToast('تم إرسال طلب الانضمام لفريق ' + teamData.name + '! استنى موافقة الأدمن', 'success');
            renderTeamsScreen();
        });
    }).catch(function(e) { console.error(e); showToast('حصل مشكلة', 'error'); });
}

function renderTeamSection() {
    // Legacy: redirect to teams screen rendering
    renderTeamsScreen();
}

function joinTeam() {
    // Called from browse section - redirect
    var input = document.getElementById('create-team-name');
    var teamName = input ? input.value.trim() : '';
    if (!teamName) return;
    joinTeamByName(teamName);
}

function joinTeamByName(teamName) {
    if (!teamName || teamName.length < 2) {
        showToast('اسم الفريق لازم يكون حرفين على الأقل', 'error');
        return;
    }
    if (!firebaseDb) {
        showToast('مفيش اتصال بالسيرفر', 'error');
        return;
    }

    var docId = teamName.replace(/[\/\\\.#\[\]\*]/g, '_');
    firebaseDb.collection('teams').doc(docId).get().then(function(doc) {
        if (!doc.exists) {
            showToast('الفريق ده مش موجود', 'error');
            return;
        }
        var teamData = doc.data();
        var members = teamData.members || [];
        if (members.length >= 6) {
            showToast('الفريق ده ممتلئ (أقصى عدد 6)', 'error');
            return;
        }
        if (members.indexOf(GameState.playerPhone) >= 0) {
            showToast('أنت موجود في الفريق ده بالفعل!', 'error');
            return;
        }
        var joinRequests = teamData.joinRequests || [];
        if (joinRequests.some(function(r) { return r.phone === GameState.playerPhone; })) {
            showToast('طلبك مسجل بالفعل - استنى موافقة الأدمن', 'info');
            return;
        }
        joinRequests.push({ phone: GameState.playerPhone, name: GameState.playerName, date: new Date().toISOString() });
        return firebaseDb.collection('teams').doc(docId).update({
            joinRequests: joinRequests
        }).then(function() {
            showToast('تم إرسال طلب الانضمام! استنى موافقة الأدمن', 'success');
            renderTeamsScreen();
        });
    }).catch(function(e) {
        console.error('Join team error:', e);
        showToast('حصل مشكلة، حاول تاني', 'error');
    });
}

function createTeam() {
    if (GameState.team) {
        showToast('أنت بالفعل في فريق! اترك فريقك الحالي أولاً.', 'error');
        return;
    }
    var input = document.getElementById('create-team-name');
    var teamName = input ? input.value.trim() : '';
    if (!teamName || teamName.length < 2) {
        showToast('اكتب اسم الفريق (حرفين على الأقل)', 'error');
        return;
    }

    if (!firebaseDb) {
        // Fallback: save team locally if no firebase connection
        GameState.team = teamName;
        GameState.teamLogo = _selectedTeamLogo || '⚔️';
        GameState.teamColor = _selectedTeamColor || '#6C5CE7';
        saveToLocalStorage();
        showToast('تم إنشاء فريق ' + teamName + '! 🎉 (محلي)', 'success');
        renderTeamsScreen();
        updateHubTeamBadge();
        return;
    }

    var logo = _selectedTeamLogo || '⚔️';
    var color = _selectedTeamColor || '#6C5CE7';
    // Use a safe document ID (replace problematic chars)
    var docId = teamName.replace(/[\/\\\.#\[\]\*]/g, '_');

    firebaseDb.collection('teams').doc(docId).get().then(function(doc) {
        if (doc.exists) {
            showToast('الاسم ده موجود بالفعل - اختار اسم تاني', 'error');
            return;
        }
        return firebaseDb.collection('teams').doc(docId).set({
            name: teamName,
            logo: logo,
            color: color,
            image: _teamImageData || '',
            members: [GameState.playerPhone],
            memberNames: [GameState.playerName],
            admins: [GameState.playerPhone],
            joinRequests: [],
            createdBy: GameState.playerPhone,
            createdAt: new Date().toISOString()
        }).then(function() {
            GameState.team = teamName;
            GameState.teamLogo = logo;
            GameState.teamColor = color;
            GameState.teamLastAction = Date.now();
            _teamImageData = '';
            saveToLocalStorage(); // saves to cloud too
            syncLeaderboard();
            showToast('تم إنشاء فريق ' + teamName + '! 🎉', 'success');
            renderTeamsScreen();
            updateHubTeamBadge();
        });
    }).catch(function(e) {
        console.error('Create team error:', e);
        showToast('حصل مشكلة: ' + (e.message || e.code || 'خطأ غير معروف'), 'error');
    });
}

function leaveTeam() {
    if (!GameState.team) return;
    if (!confirm('متأكد إنك عايز تسيب الفريق؟')) return;
    var teamName = GameState.team;
    // Mark team as left immediately in local state
    GameState.team = '';
    GameState.teamLogo = '';
    GameState.teamColor = '';
    GameState.teamLastAction = Date.now();
    saveToLocalStorage(true); // Save locally immediately so it survives reload
    var docId = teamName.replace(/[\/\\\.#\[\]\*]/g, '_');

    if (firebaseDb) {
        firebaseDb.collection('teams').doc(docId).get().then(function(doc) {
            if (doc.exists) {
                var teamData = doc.data();
                var members = (teamData.members || []).filter(function(m) { return m !== GameState.playerPhone; });
                var memberNames = (teamData.memberNames || []).filter(function(n) { return n !== GameState.playerName; });
                if (members.length === 0) {
                    return firebaseDb.collection('teams').doc(docId).delete();
                } else {
                    // Reassign admins if leaving member was an admin
                    var admins = (teamData.admins || []).filter(function(a) { return a !== GameState.playerPhone; });
                    if (admins.length < 2 && members.length >= 2) {
                        admins = members.slice(0, 2);
                    } else if (admins.length === 0 && members.length > 0) {
                        admins = [members[0]];
                    }
                    return firebaseDb.collection('teams').doc(docId).update({
                        members: members,
                        memberNames: memberNames,
                        admins: admins
                    });
                }
            }
        }).catch(function(e) { console.error('Leave team error:', e); });
    }

    saveToLocalStorage(); // Cloud save with team: '' and teamLastAction timestamp
    syncLeaderboard();
    showToast('تركت الفريق', 'success');
    renderTeamsScreen();
    updateHubTeamBadge();
}

// Update team badge in hub header
function updateHubTeamBadge() {
    var badge = document.getElementById('hub-team-badge');
    if (!badge) return;
    if (GameState.team) {
        var teamColor = GameState.teamColor || '#6C5CE7';
        badge.innerHTML = '<span class="hub-team-logo">' + (GameState.teamLogo || '⚔️') + '</span>' +
            '<span class="hub-team-name" style="color:' + teamColor + '">' + GameState.team + '</span>' +
            '<button class="hub-team-leave" onclick="event.stopPropagation();leaveTeam()" title="اسيب الفريق"><i class="fas fa-sign-out-alt"></i></button>';
        badge.style.display = 'flex';
        badge.style.borderColor = teamColor;
        badge.style.background = teamColor + '22';
    } else {
        badge.innerHTML = '<span class="hub-team-empty"><i class="fas fa-users"></i> انضم لفريق</span>';
        badge.style.display = 'flex';
        badge.style.borderColor = 'rgba(108, 92, 231, 0.3)';
        badge.style.background = 'rgba(108, 92, 231, 0.15)';
    }
}

// --- Team Leaderboard ---
function loadTeamLeaderboard() {
    if (!firebaseDb) return Promise.resolve([]);
    return firebaseDb.collection('teams').get().then(function(snapshot) {
        var teams = [];
        var promises = [];
        snapshot.forEach(function(doc) {
            var teamData = doc.data();
            teams.push({
                name: teamData.name || doc.id,
                members: teamData.members || [],
                memberNames: teamData.memberNames || [],
                totalStars: 0,
                totalGems: 0,
                totalXp: 0
            });
        });
        // For each team, sum up member stats from leaderboard collection
        teams.forEach(function(team) {
            team.members.forEach(function(phone) {
                var match = leaderboardData.find(function(p) { return (p.playerPhone || p.phone) === phone; });
                if (match) {
                    team.totalStars += (match.stars || 0);
                    team.totalGems += (match.gems || 0);
                    team.totalXp += (match.xp || 0);
                }
            });
        });
        teams.sort(function(a, b) { return b.totalStars - a.totalStars; });
        return teams;
    }).catch(function(e) {
        console.error('Team leaderboard error:', e);
        return [];
    });
}

function renderTeamLeaderboard() {
    var list = document.getElementById('leaderboard-list');
    var podium = document.getElementById('lb-podium');
    list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)"><i class="fas fa-spinner fa-spin"></i> جاري التحميل...</div>';
    podium.innerHTML = '';

    loadTeamLeaderboard().then(function(teams) {
        list.innerHTML = '';
        podium.innerHTML = '';

        if (teams.length === 0) {
            podium.innerHTML = '<p style="text-align:center;padding:40px;color:var(--text-muted);width:100%">مفيش فرق لسه - كون أول فريق!</p>';
            return;
        }

        // Top 3 podium
        var podiumClasses = ['gold', 'silver', 'bronze'];
        var podiumOrder = [1, 0, 2];
        podiumOrder.forEach(function(idx) {
            var t = teams[idx];
            if (!t) return;
            var isMyTeam = t.name === GameState.team;
            var item = document.createElement('div');
            item.className = 'lb-podium-item ' + podiumClasses[idx];
            var crown = idx === 0 ? '<div class="lb-podium-crown">👑</div>' : '';
            var medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
            item.innerHTML = crown +
                '<div class="lb-podium-rank">' + medal + '</div>' +
                '<div class="lb-podium-avatar" style="font-size:32px">👥</div>' +
                '<div class="lb-podium-name">' + t.name + (isMyTeam ? ' (فريقك)' : '') + '</div>' +
                '<div class="lb-podium-score">⭐ ' + t.totalStars + '</div>' +
                '<div style="font-size:11px;color:var(--text-muted)">' + t.members.length + ' أعضاء</div>';
            podium.appendChild(item);
        });

        // 4th+ as list
        teams.slice(3).forEach(function(t, i) {
            var el = document.createElement('div');
            var isMyTeam = t.name === GameState.team;
            el.className = 'lb-item-modern' + (isMyTeam ? ' me' : '');
            el.style.animationDelay = (i * 0.05) + 's';
            el.innerHTML = '<span class="lb-rank-num">' + (i + 4) + '</span>' +
                '<span class="lb-name">👥 ' + t.name + (isMyTeam ? ' (فريقك)' : '') + ' <small>(' + t.members.length + ')</small></span>' +
                '<span class="lb-score">⭐ ' + t.totalStars + '</span>';
            list.appendChild(el);
        });
    });
}

// --- Init ---
// ============================================================
// LAMP GAME — نوّر مصباحك
// ============================================================

// --- Lamp Fasting Weeks Data ---
var LAMP_FASTING_WEEKS = [
    {
        week: 1,
        goal: 'التوبة والرجوع إلى الله',
        chapters: ['يونان 1', 'يونان 2', 'يونان 3', 'لوقا 15:11-32', 'مزمور 51'],
        fatherSaying: 'مَن يتوب توبة حقيقية لا يعود للخطية كما لا يعود المريض المتعافي لأكل ما أمرضه — القديس يوحنا ذهبي الفم',
        hymn: 'لحن "أجيوس" — قدوس الله قدوس القوي قدوس الحي الذي لا يموت'
    },
    {
        week: 2,
        goal: 'الصلاة والتواصل مع الله',
        chapters: ['متى 6:5-15', 'لوقا 11:1-13', 'مزمور 63', 'دانيال 6', 'فيلبي 4:6-7'],
        fatherSaying: 'الصلاة هي مفتاح النهار وقفل الليل — القديس أمبروسيوس',
        hymn: 'لحن "كيرياليسون" — يا ربي يسوع المسيح ارحمنا'
    },
    {
        week: 3,
        goal: 'الإيمان والثقة بالله',
        chapters: ['عبرانيين 11:1-16', 'مرقس 4:35-41', 'دانيال 3', 'متى 14:22-33', 'مزمور 27'],
        fatherSaying: 'الإيمان هو أن تثق فيما لا تراه، ومكافأته أن ترى ما آمنت به — القديس أغسطينوس',
        hymn: 'لحن "إفنوتي ناي نان" — يا الله ارحمنا'
    },
    {
        week: 4,
        goal: 'المحبة والخدمة',
        chapters: ['1 كورنثوس 13', 'يوحنا 13:1-17', 'متى 25:31-46', 'لوقا 10:25-37', 'أمثال 3:27-28'],
        fatherSaying: 'المحبة لا تعرف حدودًا، ولا تحسب خسارة — القديسة تريزا الطفل يسوع',
        hymn: 'لحن "تين أوأوشت" — نسجد لك يا مسيح مع أبيك الصالح والروح القدس لأنك أتيت وخلصتنا'
    },
    {
        week: 5,
        goal: 'الصبر والاحتمال',
        chapters: ['أيوب 1', 'أيوب 2', 'يعقوب 1:2-12', 'رومية 5:1-5', 'مزمور 40'],
        fatherSaying: 'الصبر هو جذر كل الفضائل وحارسها — القديس البابا كيرلس الكبير',
        hymn: 'لحن "إبؤرو" — الملك، أسبّح اسمك'
    },
    {
        week: 6,
        goal: 'التواضع والوداعة',
        chapters: ['متى 11:28-30', 'فيلبي 2:1-11', 'لوقا 18:9-14', 'أمثال 22:4', '1 بطرس 5:5-7'],
        fatherSaying: 'التواضع هو أن تعرف نفسك على حقيقتها، لا أكثر ولا أقل — القديس باسيليوس الكبير',
        hymn: 'لحن "بي أويك" — خبز الحياة الذي نزل من السماء وأعطى العالم حياة'
    },
    {
        week: 7,
        goal: 'الاستعداد للفصح والقيامة',
        chapters: ['يوحنا 12:1-19', 'إشعياء 53', 'متى 26:36-46', 'لوقا 23:33-46', 'يوحنا 20:1-18'],
        fatherSaying: 'المسيح قام من الأموات بغلبته داس على الذين في القبور وأنعم بالحياة — القديس أثناسيوس الرسولي',
        hymn: 'لحن "خريستوس أنيستي" — المسيح قام من الأموات بالموت داس الموت والذين في القبور أنعم لهم بالحياة الأبدية'
    }
];

function getLampCurrentWeek() {
    // Get current week number within the fasting season (cycle through 7 weeks)
    var now = new Date();
    var startOfYear = new Date(now.getFullYear(), 0, 1);
    var weekNum = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
    return ((weekNum - 1) % LAMP_FASTING_WEEKS.length);
}

function getLampDailyMissions() {
    var weekIdx = getLampCurrentWeek();
    var weekData = LAMP_FASTING_WEEKS[weekIdx];
    var today = new Date().getDay(); // 0=Sun, 1=Mon...
    var chapterIdx = today % weekData.chapters.length;

    return [
        {
            id: 'bible_reading',
            title: 'قراءة الكتاب المقدس',
            desc: 'هدف الأسبوع: ' + weekData.goal,
            content: 'اصحاح اليوم: ' + weekData.chapters[chapterIdx],
            icon: 'fa-book-bible',
            color: '#4CAF50',
            points: 10,
            detail: weekData.chapters[chapterIdx]
        },
        {
            id: 'father_saying',
            title: 'أقوال الآباء',
            desc: 'تأمل في قول أحد آباء الكنيسة',
            content: weekData.fatherSaying,
            icon: 'fa-cross',
            color: '#FF9800',
            points: 10,
            detail: weekData.fatherSaying
        },
        {
            id: 'hymn',
            title: 'جزء من التسبحة',
            desc: 'احفظ أو رنم جزء من التسبحة',
            content: weekData.hymn,
            icon: 'fa-music',
            color: '#9C27B0',
            points: 10,
            detail: weekData.hymn
        }
    ];
}

var lampPendingMedia = [];
var lampCurrentMissionId = null;

function renderLampScreen() {
    var ld = GameState.lampData || { points: 0, streakDays: 0, lastActiveDate: '', dailyLog: {} };
    GameState.lampData = ld;

    // Update streak
    var todayKey = getTodayKey();
    var yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    var yesterdayKey = yesterday.toISOString().split('T')[0];

    if (ld.lastActiveDate && ld.lastActiveDate !== todayKey && ld.lastActiveDate !== yesterdayKey) {
        ld.streakDays = 0; // streak broken
    }

    // Update score display
    var pointsEl = document.getElementById('lamp-points');
    var streakEl = document.getElementById('lamp-streak-days');
    if (pointsEl) pointsEl.textContent = ld.points || 0;
    if (streakEl) streakEl.textContent = (ld.streakDays || 0) + ' يوم';

    // Render week goal header
    var weekIdx = getLampCurrentWeek();
    var weekData = LAMP_FASTING_WEEKS[weekIdx];
    var weekHeader = document.getElementById('lamp-week-header');
    if (weekHeader && weekData) {
        weekHeader.innerHTML =
            '<p class="lamp-week-goal"><i class="fas fa-bullseye"></i> هدف الأسبوع: ' + weekData.goal + '</p>' +
            '<p class="lamp-week-desc">الأسبوع ' + (weekIdx + 1) + ' — ' + weekData.chapters.length + ' اصحاحات للقراءة</p>';
    }

    // Check lamp state
    var todayLog = ld.dailyLog[todayKey] || {};
    var missions = getLampDailyMissions();
    var completedCount = 0;
    missions.forEach(function(m) {
        if (todayLog[m.id] && todayLog[m.id].completed) completedCount++;
    });
    var allDone = completedCount === missions.length;

    // Update lamp image (fixed bottom-left)
    var lampImg = document.getElementById('lamp-main-image');
    if (lampImg) {
        lampImg.src = allDone ? 'images/on_lamp-opt.png' : 'images/off_lamp-opt.png';
        lampImg.className = 'lamp-main-image' + (allDone ? ' lamp-lit' : '');
    }
    // Show/hide lamp container
    var lampBottom = document.getElementById('lamp-fixed-bottom');
    if (lampBottom) lampBottom.style.display = 'block';

    // Update XP bar
    var xpFill = document.getElementById('lamp-xp-fill');
    var xpText = document.getElementById('lamp-xp-text');
    var levelLabel = document.getElementById('lamp-level-label');
    var level = Math.floor((ld.points || 0) / 30) + 1;
    var xpInLevel = (ld.points || 0) % 30;
    if (xpFill) xpFill.style.width = ((xpInLevel / 30) * 100) + '%';
    if (xpText) xpText.textContent = completedCount + '/' + missions.length + ' مهمات';
    if (levelLabel) levelLabel.textContent = 'المستوى ' + level;

    // Render missions with chapter text shown
    var grid = document.getElementById('lamp-missions-grid');
    if (!grid) return;
    grid.innerHTML = '';

    missions.forEach(function(mission) {
        var done = todayLog[mission.id] && todayLog[mission.id].completed;
        var card = document.createElement('div');
        card.className = 'lamp-mission-card' + (done ? ' completed' : '');
        card.innerHTML =
            '<div class="lamp-mission-icon" style="background:' + mission.color + '"><i class="fas ' + mission.icon + '"></i></div>' +
            '<div class="lamp-mission-info">' +
                '<h4>' + mission.title + '</h4>' +
                '<p>' + mission.desc + '</p>' +
                '<span class="lamp-mission-chapter">' + mission.content + '</span>' +
                '<span class="lamp-mission-points">+' + mission.points + ' نقاط</span>' +
            '</div>' +
            '<div class="lamp-mission-status">' +
                (done ? '<i class="fas fa-check-circle lamp-done-icon"></i>' : '<i class="fas fa-chevron-left lamp-arrow-icon"></i>') +
            '</div>';
        if (!done) {
            (function(m) {
                card.onclick = function() { openLampMission(m); };
            })(mission);
        }
        grid.appendChild(card);
    });

    // Update mini progress on dashboard
    updateLampProgressMini();
}

function updateLampProgressMini() {
    var miniEl = document.getElementById('lamp-progress-mini');
    if (!miniEl) return;
    var todayKey = getTodayKey();
    var ld = GameState.lampData || {};
    var todayLog = (ld.dailyLog || {})[todayKey] || {};
    var missions = getLampDailyMissions();
    var completed = 0;
    missions.forEach(function(m) { if (todayLog[m.id] && todayLog[m.id].completed) completed++; });
    var total = missions.length;
    if (completed >= total) {
        miniEl.innerHTML = '<span class="lamp-mini-done"><i class="fas fa-check-circle"></i> مصباحك منوّر!</span>';
    } else {
        var pct = Math.round((completed / total) * 100);
        miniEl.innerHTML = '<div class="lamp-mini-bar"><div class="lamp-mini-fill" style="width:' + pct + '%"></div></div><span class="lamp-mini-text">' + completed + '/' + total + '</span>';
    }
}

function openLampMission(mission) {
    lampCurrentMissionId = mission.id;
    lampPendingMedia = [];

    document.getElementById('lamp-popup-icon').innerHTML = '<i class="fas ' + mission.icon + '" style="color:' + mission.color + '"></i>';
    document.getElementById('lamp-popup-title').textContent = mission.title;
    document.getElementById('lamp-popup-desc').textContent = mission.desc;

    // Build content area
    var contentEl = document.getElementById('lamp-popup-content');
    contentEl.innerHTML = '<div class="lamp-content-box"><p>' + mission.content + '</p></div>';

    // Reset form
    document.getElementById('lamp-popup-text').value = '';
    document.getElementById('lamp-popup-text').disabled = false;
    document.getElementById('lamp-popup-submit').disabled = false;
    document.getElementById('lamp-popup-submit').innerHTML = '<span><i class="fas fa-check-circle"></i> تم - نوّر المصباح!</span>';
    document.getElementById('lamp-popup-status').innerHTML = '';
    document.getElementById('lamp-popup-media-preview').innerHTML = '';
    document.getElementById('lamp-recording').style.display = 'none';

    document.getElementById('lamp-mission-popup').style.display = 'flex';
}

function closeLampMissionPopup() {
    document.getElementById('lamp-mission-popup').style.display = 'none';
    lampCurrentMissionId = null;
    lampPendingMedia = [];
}

function handleLampMedia(input, type) {
    if (!input.files || !input.files[0]) return;
    var file = input.files[0];
    if (file.size > 5 * 1024 * 1024) {
        showToast('الملف كبير (أقصى حجم 5 ميجا)', 'error');
        return;
    }
    compressImageToBase64(file, 800, 800, 0.7).then(function(dataURL) {
        lampPendingMedia.push({ type: 'image', dataURL: dataURL, name: file.name });
        renderLampMediaPreview();
    }).catch(function() {
        // Fallback to direct read
        var reader = new FileReader();
        reader.onload = function(e) {
            lampPendingMedia.push({ type: 'image', dataURL: e.target.result, name: file.name });
            renderLampMediaPreview();
        };
        reader.readAsDataURL(file);
    });
    input.value = '';
}

var lampMediaRecorder = null;
var lampRecordChunks = [];
var lampRecTimer = null;

function toggleLampRecording() {
    var recEl = document.getElementById('lamp-recording');
    if (lampMediaRecorder && lampMediaRecorder.state === 'recording') {
        stopLampRecording();
        return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
        lampMediaRecorder = new MediaRecorder(stream);
        lampRecordChunks = [];
        lampMediaRecorder.ondataavailable = function(e) { if (e.data.size > 0) lampRecordChunks.push(e.data); };
        lampMediaRecorder.onstop = function() {
            stream.getTracks().forEach(function(t) { t.stop(); });
            var blob = new Blob(lampRecordChunks, { type: 'audio/webm' });
            var reader = new FileReader();
            reader.onload = function(e) {
                lampPendingMedia.push({ type: 'audio', dataURL: e.target.result, name: 'تسجيل صوتي' });
                renderLampMediaPreview();
            };
            reader.readAsDataURL(blob);
            recEl.style.display = 'none';
            clearInterval(lampRecTimer);
        };
        lampMediaRecorder.start();
        recEl.style.display = 'flex';
        var sec = 30;
        var timerEl = document.getElementById('lamp-rec-timer');
        lampRecTimer = setInterval(function() {
            sec--;
            timerEl.textContent = '0:' + (sec < 10 ? '0' : '') + sec;
            if (sec <= 0) stopLampRecording();
        }, 1000);
    }).catch(function() { showToast('مفيش إذن للميكروفون', 'error'); });
}

function stopLampRecording() {
    if (lampMediaRecorder && lampMediaRecorder.state === 'recording') {
        lampMediaRecorder.stop();
    }
    clearInterval(lampRecTimer);
}

function renderLampMediaPreview() {
    var container = document.getElementById('lamp-popup-media-preview');
    if (!container) return;
    container.innerHTML = '';
    lampPendingMedia.forEach(function(item, idx) {
        var el = document.createElement('div');
        el.className = 'lamp-media-preview-item';
        if (item.type === 'image') {
            el.innerHTML = '<img src="' + item.dataURL + '" class="lamp-preview-img"><button class="lamp-media-remove" onclick="removeLampMedia(' + idx + ')"><i class="fas fa-times"></i></button>';
        } else {
            el.innerHTML = '<div class="lamp-preview-audio"><i class="fas fa-microphone"></i> ' + item.name + '<audio src="' + item.dataURL + '" controls></audio></div><button class="lamp-media-remove" onclick="removeLampMedia(' + idx + ')"><i class="fas fa-times"></i></button>';
        }
        container.appendChild(el);
    });
}

function removeLampMedia(idx) {
    lampPendingMedia.splice(idx, 1);
    renderLampMediaPreview();
}

function submitLampMission() {
    if (!lampCurrentMissionId) return;
    var text = document.getElementById('lamp-popup-text').value.trim();
    if (!text || text.length < 5) {
        showToast('اكتب تأمل أو ملخص (5 حروف على الأقل)', 'error');
        return;
    }
    var todayKey = getTodayKey();
    var ld = GameState.lampData;
    if (!ld.dailyLog) ld.dailyLog = {};
    if (!ld.dailyLog[todayKey]) ld.dailyLog[todayKey] = {};

    if (ld.dailyLog[todayKey][lampCurrentMissionId] && ld.dailyLog[todayKey][lampCurrentMissionId].completed) {
        showToast('المهمة دي خلصتها بالفعل');
        return;
    }

    var btn = document.getElementById('lamp-popup-submit');
    btn.disabled = true;
    btn.innerHTML = '<span><i class="fas fa-spinner fa-spin"></i> جاري الحفظ...</span>';

    var missions = getLampDailyMissions();
    var mission = missions.find(function(m) { return m.id === lampCurrentMissionId; });
    var points = mission ? mission.points : 10;

    ld.dailyLog[todayKey][lampCurrentMissionId] = {
        completed: true,
        text: text,
        mediaDataURLs: lampPendingMedia.slice(),
        completedAt: new Date().toISOString()
    };

    ld.points = (ld.points || 0) + points;
    GameState.stars += 1;

    // Update streak
    if (ld.lastActiveDate !== todayKey) {
        var yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        var yesterdayKey = yesterday.toISOString().split('T')[0];
        if (ld.lastActiveDate === yesterdayKey) {
            ld.streakDays = (ld.streakDays || 0) + 1;
        } else if (!ld.lastActiveDate) {
            ld.streakDays = 1;
        } else {
            ld.streakDays = 1;
        }
        ld.lastActiveDate = todayKey;
    }

    lampPendingMedia = [];
    btn.innerHTML = '<span><i class="fas fa-check"></i> تم!</span>';
    document.getElementById('lamp-popup-text').disabled = true;
    document.getElementById('lamp-popup-status').innerHTML = '<div class="lamp-done-msg"><i class="fas fa-check-circle"></i> أحسنت! كسبت ' + points + ' نقاط + 1 نجمة</div>';

    confetti();
    saveGame();
    syncLeaderboard();

    // Check if all missions done today
    var todayLog = ld.dailyLog[todayKey] || {};
    var allDone = missions.every(function(m) { return todayLog[m.id] && todayLog[m.id].completed; });

    setTimeout(function() {
        closeLampMissionPopup();
        renderLampScreen();
        if (allDone) {
            showToast('مصباحك اتنوّر النهاردة!', 4000, 'success');
        } else {
            showToast('تم! كمّل باقي المهمات عشان تنوّر مصباحك', 3000, 'success');
        }
    }, 1500);
}

// ============================================================
// LEVEL 2 - مدرسة أتبعني للتلمذة
// ============================================================

// --- Level 2 Subjects & Lessons Data ---
var LEVEL2_SUBJECTS = {
    faith: {
        name: 'عقيدة ولاهوت',
        desc: 'لاهوت وعقيدة',
        icon: '✝️',
        color: '#e74c3c',
        mapImage: 'images/level2-map-new-opt.jpg',
        lessons: [
            {
                name: 'التثليث والتوحيد',
                desc: 'عقيدة الإله الواحد المثلث الأقانيم',
                verse: '"فاذهبوا وتلمذوا جميع الأمم وعمدوهم باسم الآب والابن والروح القدس" (مت ٢٨: ١٩)',
                videoId: 'V8MqXGOyJqE',
                videoTitle: 'وعظة تفصيلية - عقيدة الثالوث',
                shortVideoId: 'VBI06Q6p_ec',
                shortVideoTitle: 'ملخص سريع - التثليث والتوحيد',
                content: 'نؤمن بإله واحد في ثلاثة أقانيم: الآب والابن والروح القدس. الأقنوم كلمة سريانية معناها صفة أو خاصية يقوم عليها الكيان الإلهي. الآب هو وجود الله، والابن هو عقل ونطق الله (اللوجوس)، والروح القدس هو خاصية الحياة. الجوهر الإلهي واحد لكن الخواص ثلاثة. مش بنقول 1+1+1 لكن 1×1×1 والنتيجة واحد صحيح.',
                questions: [
                    { q: 'الله واحد في جوهره وثلاثة في:', options: ['أجزائه', 'أقانيمه', 'صفاته الخارجية', 'أشكاله'], correct: 1 },
                    { q: 'كلمة "أقنوم" أصلها:', options: ['يوناني', 'سرياني', 'قبطي', 'عربي'], correct: 1 },
                    { q: '"هيبوستاسيس" كلمة يونانية تعني:', options: ['إله', 'أقنوم', 'شخص', 'روح'], correct: 1 },
                    { q: 'الآب هو أقنوم:', options: ['الوجود', 'العقل', 'الحياة', 'القوة'], correct: 0 },
                    { q: 'الابن هو أقنوم:', options: ['الوجود', 'العقل', 'الحياة', 'القوة'], correct: 1 },
                    { q: 'الروح القدس هو أقنوم:', options: ['الوجود', 'العقل', 'الحياة', 'القوة'], correct: 2 },
                    { q: 'معنى كلمة "لوجوس":', options: ['الروح', 'العقل الناطق', 'القوة', 'الحياة'], correct: 1 },
                    { q: 'بنوة الابن للآب بنوة:', options: ['جسدية', 'روحية عقلية', 'زمنية', 'مادية'], correct: 1 },
                    { q: '"مونوجينيس" تعني:', options: ['الأول', 'الوحيد الفريد', 'الخالق', 'الأكبر'], correct: 1 },
                    { q: 'الروح القدس ___ من الآب:', options: ['مولود', 'منبثق', 'مخلوق', 'منفصل'], correct: 1 },
                    { q: 'الابن ___ من الآب:', options: ['مولود', 'منبثق', 'مصنوع', 'منفصل'], correct: 0 },
                    { q: 'الانبثاق الأزلي للروح القدس هو فعل:', options: ['دائم مستمر', 'زمني انتهى', 'مستقبلي', 'غير معروف'], correct: 0 },
                    { q: 'إرسال الروح القدس يوم الخمسين فعل:', options: ['أزلي', 'زمني', 'جوهري', 'غير معروف'], correct: 1 },
                    { q: 'أقنوم الإعلان هو:', options: ['الآب', 'الابن', 'الروح القدس', 'الملاك'], correct: 1 },
                    { q: 'أقنوم الإلهام هو:', options: ['الآب', 'الابن', 'الروح القدس', 'الملاك'], correct: 2 },
                    { q: 'مجمع نيقية وضع قانون الإيمان للرد على:', options: ['مقدونيوس', 'أريوس', 'نسطور', 'أوطاخي'], correct: 1 },
                    { q: 'مجمع القسطنطينية كمل الجزء الخاص بـ:', options: ['العدرا', 'الروح القدس', 'المعمودية', 'الصليب'], correct: 1 },
                    { q: 'مقدمة قانون الإيمان وضعت في مجمع:', options: ['نيقية', 'القسطنطينية', 'أفسس', 'خلقيدونية'], correct: 2 },
                    { q: '"أنا والآب ___":', options: ['واحد', 'اثنان', 'متشابهان', 'مختلفان'], correct: 0 },
                    { q: 'بنوة الابن للآب بنوة أزلية تعني:', options: ['ليس بينهما زمن', 'الآب خلق الابن', 'الابن أكبر', 'الابن أصغر'], correct: 0 },
                    { q: 'بنوة متصلة تعني:', options: ['انفصل بعد الولادة', 'لا ينفصل عن الجوهر', 'بنوة بالتبني', 'بنوة زمنية'], correct: 1 },
                    { q: '"إله حق من إله حق" تقال عن:', options: ['الآب', 'الابن', 'الروح القدس', 'الملاك'], correct: 1 },
                    { q: 'الروح القدس منبثق من الآب والابن عند:', options: ['الأرثوذكس', 'الكاثوليك', 'اليهود', 'الجميع'], correct: 1 },
                    { q: 'الآية "الله واحد" وردت في رسالة:', options: ['روما', 'كورنثوس', 'عبرانيين', 'أفسس'], correct: 0 },
                    { q: 'انيانوس الإسكافي كان يعمل:', options: ['نجار', 'إسكافي', 'صياد', 'فلاح'], correct: 1 },
                    { q: 'مارمرقس تعرف على انيانوس في مدينة:', options: ['القاهرة', 'الإسكندرية', 'روما', 'أورشليم'], correct: 1 },
                    { q: '"اللوجوس كان عند الله وكان اللوجوس الله" في إنجيل:', options: ['متى', 'مرقس', 'يوحنا', 'لوقا'], correct: 2 },
                    { q: '"الروح القدس يحل عليكِ" قيلت لـ:', options: ['العذراء مريم', 'أليصابات', 'حنة', 'مرثا'], correct: 0 },
                    { q: 'بنوة "ابن النيل" هي بنوة:', options: ['حقيقية', 'نسبية', 'طبيعية', 'أزلية'], correct: 1 },
                    { q: 'بنوة الابن للآب هي بنوة:', options: ['طبيعية', 'وضعية', 'ممنوحة', 'مؤقتة'], correct: 0 },
                    { q: 'الروح القدس هو "الرب ___":', options: ['الخالق', 'المحيي', 'الضابط', 'القوي'], correct: 1 },
                    { q: 'الجوهر الإلهي واحد والخواص:', options: ['اثنان', 'ثلاثة', 'أربعة', 'واحد'], correct: 1 },
                    { q: '"نور من نور" تشبه ولادة:', options: ['النور من قرص الشمس', 'الفجر من الليل', 'النار من الحطب', 'الماء من النهر'], correct: 0 },
                    { q: '"المنبثق من الآب" تشبه انبعاث:', options: ['الدخان من النار', 'الحرارة من الشمس', 'الماء من البئر', 'النور من القمر'], correct: 1 },
                    { q: 'الأقنوم الذي تجسد هو:', options: ['الآب', 'الابن', 'الروح القدس', 'الثلاثة'], correct: 1 },
                    { q: 'الثالوث ظهر بوضوح في:', options: ['الصلب', 'العماد', 'التجلي', 'الميلاد'], correct: 1 },
                    { q: 'مجمع أفسس أكد لقب العذراء بـ:', options: ['ثيؤطوكوس', 'خادمة', 'ملكة', 'قديسة'], correct: 0 },
                    { q: 'البابا أثناسيوس كان يلقب بـ:', options: ['حامي الإيمان', 'الذهبي الفم', 'الناطق بالإلهيات', 'عمود الدين'], correct: 0 },
                    { q: '"الناطق في الأنبياء" هو:', options: ['الآب', 'الابن', 'الروح القدس', 'الملاك'], correct: 2 },
                    { q: '"ليس لملكه انقضاء" تقال عن:', options: ['الآب', 'الابن', 'الروح القدس', 'الملاك'], correct: 1 },
                    { q: 'الله "ضابط الكل" هو:', options: ['الآب', 'الابن', 'الروح القدس', 'الثلاثة'], correct: 0 },
                    { q: 'المسيحية تؤمن بـ:', options: ['٣ آلهة', 'إله واحد', 'آلهة كثيرة', 'لا إله'], correct: 1 },
                    { q: '"بنات أفكاره" مثال يوضح:', options: ['الولادة العقلية', 'الانبثاق', 'الخلق', 'الموت'], correct: 0 },
                    { q: 'المثلث له ٣ رؤوس وهو:', options: ['مثلث واحد', '٣ مثلثات', 'شكل دائري', 'مربع'], correct: 0 },
                    { q: 'الله "روح" (يو ٤: ٢٤) تعني أن الروح القدس:', options: ['هو الله', 'ملاك', 'قوة مادية', 'مخلوق'], correct: 0 },
                    { q: 'إرسال الروح القدس "المعزي" تم في يوم:', options: ['عيد الميلاد', 'عيد الخمسين', 'عيد القيامة', 'عيد الصعود'], correct: 1 },
                    { q: 'قانون الإيمان هو الدستور الذي يؤمن به:', options: ['كافة المسيحيين', 'الأرثوذكس فقط', 'الكاثوليك فقط', 'البروتستانت فقط'], correct: 0 },
                    { q: 'في عماد المسيح ظهر الثالوث: الروح القدس في هيئة:', options: ['نار', 'حمامة', 'سحابة', 'ريح'], correct: 1 },
                    { q: 'في سفر التكوين قال الله "نعمل الإنسان على..." بصيغة الجمع:', options: ['أمرنا', 'صورتنا', 'قدرتنا', 'حكمتنا'], correct: 1 },
                    { q: 'إشعياء النبي رأى السيرافيم يقولون "قدوس قدوس قدوس رب...":', options: ['الأرض', 'السماء', 'الجنود', 'الكون'], correct: 2 }
                ]
            },
            {
                name: 'التجسد الإلهي',
                desc: 'لماذا تجسد الله وصار إنساناً؟',
                verse: '"والكلمة صار جسداً وحل بيننا" (يو ١: ١٤)',
                videoId: 'Hju9WzYwkc0',
                videoTitle: 'لماذا التجسد - أبونا لوقا ماهر',
                content: 'بسبب سقوط آدم دخل الموت للعالم (موت أدبي وجسدي وروحي وأبدي). الله اختار أن يفدي الإنسان فتجسد أقنوم الابن من العذراء مريم بحلول الروح القدس. التجسد هو أن الله أخذ جسداً، والتأنس هو أن الجسد كان إنساناً كاملاً. المسيح طبيعة واحدة من طبيعتين (لاهوت كامل وناسوت كامل) بغير اختلاط ولا امتزاج ولا تغيير.',
                questions: [
                    // === صح أم غلط (محوَّل لـ MC) ===
                    { q: 'ماذا يعني الموت الأدبي؟', options: ['فقدان الإنسان صورته الأولى التي خُلق عليها', 'انفصال الروح عن الجسد', 'البُعد والانفصال عن الله', 'العذاب الأبدي بعيداً عن الله'], correct: 0 },
                    { q: 'الموت الجسدي هو...', options: ['البُعد عن الله', 'انفصال الروح عن الجسد', 'فقد الصورة الأولى', 'بقاء الموت حاكماً للأبد'], correct: 1 },
                    { q: 'الموت الروحي هو...', options: ['انفصال الروح عن الجسد', 'فقد الكرامة والبر', 'الانفصال والبُعد عن الله', 'العذاب الأبدي'], correct: 2 },
                    { q: 'لو الفداء ما حصلش، كان الموت هيفضل حاكم...', options: ['لألف سنة فقط', 'حتى يتوب الإنسان', 'على الإنسان للأبد', 'حتى يأتي نبي جديد'], correct: 2 },
                    { q: 'مَن وضعه الرب شرقي جنة عدن لحراسة شجرة الحياة؟', options: ['السيرافيم', 'الملاك جبرائيل', 'الكروبيم', 'الملاك ميخائيل'], correct: 2 },
                    { q: 'لو سامح الله الإنسان بدون فداء، كان هذا يكون ضد...', options: ['رحمته', 'محبته', 'قوته', 'عدله'], correct: 3 },
                    { q: '"الرحمة والحق التقيا" تحقق في...', options: ['الطوفان', 'الناموس الموسوي', 'التجسد والفداء', 'خروج بني إسرائيل'], correct: 2 },
                    { q: 'مَن حلَّ على العذراء مريم لتطهير مستودعها؟', options: ['أقنوم الابن', 'الملاك جبرائيل', 'نعمة الآب', 'الروح القدس'], correct: 3 },
                    { q: 'هل تزوَّج يوسف النجار العذراء مريم؟', options: ['نعم قبل ميلاد المسيح', 'نعم بعد ميلاد المسيح', 'لا لم يتزوجها إطلاقاً', 'تزوجها رمزياً فقط'], correct: 2 },
                    { q: 'ظهورات الله في العهد القديم كانت بـ...', options: ['جسد حقيقي تماماً كالبشر', 'أجساد ملائكية نورانية', 'هيئات مرئية وجسد غير حقيقي', 'خيالات في الأحلام فقط'], correct: 2 },
                    { q: '"التجسد" معناه إن الله...', options: ['يأخذ طبيعة إنسان كاملة', 'يأخذ جسداً', 'يظهر بشكل مرئي فقط', 'يُرسل كلمته للبشر'], correct: 1 },
                    { q: '"التأنس" معناه إن الجسد المأخوذ بقى...', options: ['شكلاً مرئياً', 'ملاكاً مقدساً', 'إنساناً كاملاً', 'روحاً محسوسة'], correct: 2 },
                    { q: 'المسيح شابهنا في كل شيء ماعدا...', options: ['الجوع والعطش', 'النوم والتعب', 'الفرح والحزن', 'الخطية وحدها'], correct: 3 },
                    { q: 'تشبيه الشمس والأوضة الإزاز يوضح إن الله...', options: ['يتحصر داخل الجسد', 'يختفي عند التجسد', 'يضعف في الجسد', 'لا ينحصر داخل الجسد'], correct: 3 },
                    { q: 'الولادة الأزلية للمسيح كانت...', options: ['في ملء الزمان من مريم', 'من الروح القدس مباشرة', 'عند عماده في الأردن', 'من الآب قبل كل الدهور'], correct: 3 },
                    { q: 'هل المسيح احتاج أباً بشرياً؟', options: ['نعم ليمنحه الجسد', 'نعم ليمنحه بذرة الوجود', 'نعم ليكون مثلنا تماماً', 'لا لأنه موجود من الأصل كإله'], correct: 3 },
                    { q: 'اتحاد اللاهوت والناسوت في المسيح يُشبَّه بـ...', options: ['الماء والزيت اللي ما بيتحدوش', 'الثلج والنار اللي بيذوبوا', 'البحر والأرض اللي بيتفصلوا', 'الحديد المحمي بالنار'], correct: 3 },
                    { q: 'ما الذي يحدث للمصباح لو انفصل عن الكهرباء؟', options: ['يزداد سطوعاً', 'يتحرك وحده', 'ينطفئ', 'يصدر صوتاً'], correct: 2 },
                    { q: 'كيف كان آدم في الجنة قبل السقوط حسب أغسطينوس؟', options: ['صامتاً لا يتكلم', 'نائماً معظم الوقت', 'غاضباً من الله', 'فصيحاً يُعطي كل حي اسمه'], correct: 3 },
                    { q: 'الكبرياء البشرية...', options: ['ترفعك للسماء', 'تجعلك أقوى', 'لا تأثير لها', 'تهبط بك إلى أسفل'], correct: 3 },
                    { q: 'الاتضاع الإلهي...', options: ['ينزلك للأرض', 'يضعفك', 'يرفعك إلى فوق', 'لا أثر له في حياتك'], correct: 2 },
                    { q: 'ما الشجرة التي حرس الله طريقها بعد سقوط آدم؟', options: ['شجرة معرفة الخير والشر', 'شجرة الزيتون', 'شجرة النعمة', 'شجرة الحياة'], correct: 3 },
                    { q: 'ما الشجرة التي نُهي آدم عن الأكل منها؟', options: ['شجرة الحياة', 'شجرة الزيتون', 'شجرة البركة', 'شجرة معرفة الخير والشر'], correct: 3 },
                    { q: 'المسيح جاء "في شبه جسد الخطية" معناها إنه...', options: ['أخذ جسداً خاطئاً', 'كان يُمثِّل فقط', 'جسده كان خيالاً', 'أخذ جسداً حقيقياً لكن بلا خطية'], correct: 3 },
                    { q: 'الحديد والنار لما يتحدا، ماذا يحدث؟', options: ['النار تطفي والحديد يبرد', 'الحديد يذوب ويصبح ناراً', 'يتحولان لمادة جديدة كلياً', 'كل منهما يبقى محتفظاً بطبيعته'], correct: 3 },
                    { q: 'المسيح وُلد من العذراء مريم بدون...', options: ['روح القدس', 'بركة الآب', 'دعاء الملاك', 'زرع بشر'], correct: 3 },
                    { q: 'المسيح ورث الخطية الأصلية من العذراء مريم؟', options: ['نعم ورثها بالكامل', 'نعم لكن أقل منا', 'ورث جزءاً منها', 'لا لم يرثها إطلاقاً'], correct: 3 },
                    { q: 'الروح القدس حل على العذراء مريم حلولاً...', options: ['مؤقتاً ثم رحل', 'جزئياً فقط', 'رمزياً لا حقيقياً', 'أقنومياً'], correct: 3 },

                    // === من أنا؟ (محوَّل لـ MC) ===
                    { q: 'الانفصال والبُعد عن الله هو الموت الـ...', options: ['الأدبي', 'الجسدي', 'الأبدي', 'الروحي'], correct: 3 },
                    { q: 'أُوقِفتُ شرقي جنة عدن ومعي لهيب سيف متقلب. مَن أنا؟', options: ['السيرافيم', 'الملاك جبرائيل', 'الملاك ميخائيل', 'الكروبيم'], correct: 3 },
                    { q: 'جئتُ للعذراء وقلتُ لها: "الروح القدس يحل عليكِ". مَن أنا؟', options: ['ميخائيل', 'إسرافيل', 'رفائيل', 'جبرائيل'], correct: 3 },
                    { q: 'حبلتُ بالمسيح من غير زرع بشر ولُقِّبتُ "ثيؤطوكوس". مَن أنا؟', options: ['حواء', 'سارة', 'حنة', 'العذراء مريم'], correct: 3 },
                    { q: 'أنا "الصورة المنظورة" لله غير المنظور. مَن أنا؟', options: ['الملاك جبرائيل', 'موسى النبي', 'إيليا النبي', 'السيد المسيح'], correct: 3 },
                    { q: 'طبيعة الله تُسمَّى...', options: ['الناسوت', 'الفداء', 'التجسد', 'اللاهوت'], correct: 3 },
                    { q: 'الطبيعة البشرية تُسمَّى...', options: ['اللاهوت', 'التجسد', 'الأزلية', 'الناسوت'], correct: 3 },
                    { q: 'أملأ الأوضة من غير أن أنحصر فيها. أي تشبيه يوضح عدم انحصار الله في الجسد؟', options: ['المصباح', 'المغناطيس', 'الكهرباء', 'الشمس'], correct: 3 },
                    { q: 'قوتي تجذب الحديد وتأثيري عجيب لكن لا لون لي. ما أنا؟', options: ['الكهرباء', 'الضوء', 'الحرارة', 'المغناطيسية'], correct: 3 },
                    { q: 'قال: "انظر يا إنسان ماذا صار الله من أجلك". مَن هذا القديس؟', options: ['أثناسيوس الرسولي', 'كيرلس الأول', 'باسيليوس الكبير', 'أغسطينوس'], correct: 3 },
                    { q: '"أجرة الخطية" هي...', options: ['المرض', 'الفقر', 'الحزن', 'الموت'], correct: 3 },
                    { q: 'طهَّر مستودع العذراء مريم. مَن أنا؟', options: ['أقنوم الابن', 'الملاك جبرائيل', 'نعمة الآب', 'الروح القدس'], correct: 3 },
                    { q: 'المكان الذي طُرد منه آدم وحواء هو...', options: ['مدينة أريحا', 'جبل سيناء', 'أرض كنعان', 'جنة عدن'], correct: 3 },
                    { q: 'الفعل الذي جمع بين الرحمة والعدل في نفس الوقت هو...', options: ['الخلق', 'الطوفان', 'الناموس', 'التجسد والفداء'], correct: 3 },
                    { q: '"بذرة الوجود" لأي إنسان عادي تأتي من...', options: ['الأم', 'كليهما معاً', 'الروح القدس', 'الأب'], correct: 3 },
                    { q: 'أنا اللقب الذي يُثبت أن المسيح أخذ الجسد من إنسان. ما أنا؟', options: ['ابن الله', 'المخلِّص', 'ابن داود', 'ابن الإنسان'], correct: 3 },
                    { q: 'أنا "الزمان" المناسب الذي اختاره الله للتجسد. ما أنا؟', options: ['يوم الميلاد', 'وقت الفصح', 'عهد الأنبياء', 'ملء الزمان'], correct: 3 },
                    { q: 'رقدتُ في مسكن حقير صغير عشان أُعطي الميتين حياة. مَن أنا؟', options: ['موسى الطفل', 'إيليا النبي', 'يوحنا المعمدان', 'المسيح الطفل'], correct: 3 },

                    // === شخصيات (محوَّل لـ MC) ===
                    { q: 'مَن الذي فقد صورته الأولى حين كسر الوصية؟', options: ['موسى', 'إبراهيم', 'نوح', 'آدم'], correct: 3 },
                    { q: 'مَن الذي جاء إليه الرب كضيف في العهد القديم؟', options: ['موسى', 'يعقوب', 'داود', 'إبراهيم'], correct: 3 },
                    { q: 'مَن الذي صارعه الرب في العهد القديم وسجد له؟', options: ['إبراهيم', 'يوسف', 'إسحاق', 'يعقوب'], correct: 3 },
                    { q: 'مَن الفتية الذين ظهر الرب معهم في الأتون الناري؟', options: ['الاثنا عشر رسولاً', 'أيوب وأصحابه', 'بني إسرائيل في البرية', 'حنانيا وميشائيل وعزريا'], correct: 3 },
                    { q: 'مَن الذي أهلك نفسه بعدم الطاعة وهو في فردوس مليء بالفاكهة؟', options: ['قايين', 'نوح', 'إسماعيل', 'آدم'], correct: 3 },
                    { q: 'مَن الذي قيل له "الذي حبل به فيها هو من الروح القدس"؟', options: ['زكريا', 'يوحنا', 'إيليا', 'يوسف النجار'], correct: 3 },
                    { q: 'مَن التي لم يجد الآب مَن يشبهها في السماء كلها فأرسل وحيده؟', options: ['حواء', 'سارة', 'راحيل', 'العذراء مريم'], correct: 3 },
                    { q: 'مَن الذي أراد أن يكون إلهاً فضلَّ (حسب أغسطينوس)؟', options: ['المسيح في تجسده', 'الشيطان', 'الملائكة', 'الإنسان / آدم'], correct: 3 },
                    { q: '"الكلمة" التي صارت جسداً هي...', options: ['التوراة', 'الناموس', 'النبوة', 'السيد المسيح'], correct: 3 },
                    { q: 'مَن الذي كان "صغير السن" في الجسد وهو "أزلي" بلاهوته؟', options: ['يوحنا المعمدان', 'إيليا النبي', 'الملاك ميخائيل', 'المسيح المتجسد'], correct: 3 },
                    { q: 'مَن الذي "عجزت فصاحة البشر" عن وصف طفولته وهو الكلمة؟', options: ['يوحنا المعمدان', 'إيليا الطفل', 'سليمان الحكيم', 'المسيح الكلمة'], correct: 3 },
                    { q: 'مَن الذي "أخذ الذي لنا وأعطانا الذي له"؟', options: ['موسى النبي', 'الروح القدس', 'الملاك جبرائيل', 'المسيح'], correct: 3 },

                    // === رتّب الآية (محوَّل لـ MC) ===
                    { q: 'أكمل الآية: "يوم تأكل منها..."', options: ['"...حياةً تحيا"', '"...بركةً تُبارَك"', '"...علماً تعلم"', '"...موتاً تموت"'], correct: 3 },
                    { q: 'أكمل: "أجرة الخطية..."', options: ['حياة أبدية', 'مرض وألم', 'فقر وعوز', 'موت'], correct: 3 },
                    { q: 'أكمل قانون الإيمان: "تجسد من الروح القدس ومن مريم العذراء..."', options: ['وصُلب عنا', 'وقام من بين الأموات', 'وقدَّس الطبيعة البشرية', 'وتأنس'], correct: 3 },
                    { q: 'أكمل البشارة: "الروح القدس يحل عليكِ وقوة العلي..."', options: ['ترفعكِ', 'تحفظكِ', 'تقدِّسكِ', 'تظللكِ'], correct: 3 },
                    { q: 'أكمل: "القدوس المولود منكِ يُدعى..."', options: ['المخلِّص', 'ابن داود', 'الرب المنتظر', 'ابن الله'], correct: 3 },
                    { q: 'أكمل: "الذي هو صورة الله..."', options: ['المرئي', 'العظيم', 'القدير', 'غير المنظور'], correct: 3 },
                    { q: 'أكمل: "هو أخذ الذي لنا وأعطانا..."', options: ['المال والغنى', 'الملكوت والسلطان', 'الخلود فقط', 'الذي له'], correct: 3 },
                    { q: 'أكمل: "في البدء كان..."', options: ['النور', 'الروح', 'الله وحده', 'الكلمة'], correct: 3 },
                    { q: 'أكمل: "وأقام شرقي جنة عدن..."', options: ['السيرافيم', 'الملاك ميخائيل', 'سيف النار', 'الكروبيم'], correct: 3 },
                    { q: 'أكمل: "الرحمة والحق..."', options: ['تنفصلان دائماً', 'يتنازعان', 'لا يجتمعان أبداً', 'التقيا'], correct: 3 },
                    { q: 'أكمل: "تطلع الآب من السماء فلم يجد من..."', options: ['يساعدكِ', 'يفديكِ', 'يُحبكِ', 'يشبهكِ'], correct: 3 },
                    { q: 'ما الترتيب الصحيح لأنواع الموت بعد سقوط آدم؟', options: ['جسدي ثم روحي ثم أدبي ثم أبدي', 'أبدي ثم روحي ثم أدبي ثم جسدي', 'روحي ثم جسدي ثم أبدي ثم أدبي', 'أدبي ثم روحي ثم جسدي ثم أبدي'], correct: 3 },

                    // === الكلمة الناقصة (محوَّل لـ MC) ===
                    { q: 'الموت _______ يعني إن الإنسان فقد صورته الأولى.', options: ['الجسدي', 'الروحي', 'الأبدي', 'الأدبي'], correct: 3 },
                    { q: 'الموت _______ هو انفصال الروح عن الجسد.', options: ['الأدبي', 'الروحي', 'الأبدي', 'الجسدي'], correct: 3 },
                    { q: 'زي المصباح لما يتفصل عن _______ بينطفي.', options: ['النور', 'المفتاح', 'السلك', 'الكهرباء'], correct: 3 },
                    { q: '"الروح القدس يحل عليكِ وقوة _______ تظللكِ".', options: ['الرب', 'الآب', 'الخالق', 'العلي'], correct: 3 },
                    { q: 'الروح القدس حل على العذراء عشان يطهر _______ العذراء.', options: ['قلبها', 'روحها', 'فكرها', 'مستودعها'], correct: 3 },
                    { q: 'الله في طبيعته غير _______.', options: ['محدود', 'قادر', 'موجود', 'منظور'], correct: 3 },
                    { q: '_______ هو إن ربنا ياخد جسد.', options: ['التأنس', 'الفداء', 'الخلاص', 'التجسد'], correct: 3 },
                    { q: '_______ هو إن الجسد اللي ربنا أخده يكون إنسان.', options: ['التجسد', 'الفداء', 'القيامة', 'التأنس'], correct: 3 },
                    { q: '"هو أخذ الذي لنا وأعطانا الذي _______".', options: ['نستحق', 'طلبناه', 'أراده', 'له'], correct: 3 },
                    { q: 'الولادة _______ كانت "من الآب قبل كل الدهور".', options: ['الزمنية', 'البشرية', 'الجسدية', 'الأزلية'], correct: 3 },
                    { q: 'المسيح اتولد من العذراء في "ملء _______".', options: ['النعمة', 'البركة', 'القدرة', 'الزمان'], correct: 3 },
                    { q: 'تشبيه _______ بيوضح إن الله مش بيتحصر جوه الجسد.', options: ['المصباح', 'المغناطيس', 'الكهرباء', 'الشمس'], correct: 3 },
                    { q: 'الحديد المحمي بالنار مثال لـ _______ اللاهوت والناسوت.', options: ['انفصال', 'تفوق', 'تحول', 'اتحاد'], correct: 3 },
                    { q: '"أنت أردت أن تكون إلهاً _______".', options: ['فعرفت', 'فأُكرمت', 'فنجحت', 'فضللت'], correct: 3 },
                    { q: 'الكبرياء البشرية _______ بك إلى أسفل.', options: ['ترفعك', 'تشرِّفك', 'تُلهمك', 'هبطت'], correct: 3 },
                    { q: 'ربنا أقام شرقي جنة عدن _______ لحراسة طريق شجرة الحياة.', options: ['السيرافيم', 'جبرائيل', 'ميخائيل', 'الكروبيم'], correct: 3 },
                    { q: 'المسيح شابهنا في كل شيء ماعدا _______ وحدها.', options: ['الجوع', 'التعب', 'الحزن', 'الخطية'], correct: 3 },
                    { q: '"الرحمة والحق _______" في التجسد والفداء.', options: ['انفصلا', 'تعارضا', 'اختلفا', 'التقيا'], correct: 3 },
                    { q: 'لو ربنا سامح من غير فداء كان هيبقى ضد _______ الله.', options: ['رحمة', 'محبة', 'قدرة', 'عدل'], correct: 3 },
                    { q: '"يوم تأكل منها _______ تموت".', options: ['حياةً', 'بركةً', 'غِنىً', 'موتاً'], correct: 3 },
                    { q: 'المسيح ورث من العذراء _______ الحقيقي.', options: ['الروح', 'اللاهوت', 'الخطية', 'الجسد'], correct: 3 },
                    { q: 'آدم أهلك نفسه بعدم _______.', options: ['الإيمان', 'المحبة', 'الصبر', 'الطاعة'], correct: 3 },
                    { q: 'المسيح هو "_______" اللي تعجز فصاحة البشر عن وصفه وهو طفل.', options: ['النور', 'الراعي', 'الرب', 'الكلمة'], correct: 3 },
                    { q: 'لهيب سيف _______ لحراسة طريق شجرة الحياة.', options: ['مشتعل', 'ثابت', 'لامع', 'متقلب'], correct: 3 },
                    { q: 'المسيح أخذ صفاتنا البشرية وأعطانا _______.', options: ['المجد فقط', 'السلطان', 'الخلود فقط', 'نعمته وطهارته'], correct: 3 },

                    // === وصّل الصح (محوَّل لـ MC) ===
                    { q: 'الموت الأدبي يرتبط بـ...', options: ['انفصال الروح عن الجسد', 'الانفصال عن الله روحياً', 'العذاب الأبدي', 'فقد الإنسان صورته الأولى عند الله'], correct: 3 },
                    { q: 'تشبيه "المصباح والكهرباء" يوضح...', options: ['إن الله منتشر في كل مكان', 'قوة الله الخالقة', 'إن المسيح هو النور', 'علاقة الإنسان بالله وإن الانفصال يعني الموت'], correct: 3 },
                    { q: 'تشبيه "الحديد المحمي بالنار" يوضح...', options: ['إن المسيح احترق بالخطية', 'إن الله قوي وساخن', 'إن الإنسان قابل للتغيير', 'إن اللاهوت والناسوت اتحدا بدون أن يتحول أحدهما للآخر'], correct: 3 },
                    { q: 'قانون الإيمان يقول: "تجسد من الروح القدس و..."', options: ['وُلد في بيت لحم', 'وطهَّر الطبيعة البشرية', 'وصار إنساناً كاملاً بدون أم', 'من مريم العذراء وتأنس'], correct: 3 },
                    { q: '"الذي لنا" الذي أخذه المسيح يعني...', options: ['خطايانا فقط', 'أموالنا', 'عالمنا وكوكبنا', 'طبيعتنا البشرية وصفاتنا'], correct: 3 },
                    { q: '"الذي له" الذي أعطاه المسيح لنا يعني...', options: ['مُلكه وسلطانه', 'طول عمره', 'معجزاته فقط', 'نعمته وطهارته وحياته الإلهية'], correct: 3 },
                    { q: 'ربنا أخرج آدم من الجنة عشان...', options: ['يعاقبه فقط', 'يبني مدناً جديدة', 'يكثر ويملأ الأرض', 'يعمل الأرض التي أُخذ منها'], correct: 3 },
                    { q: 'ظهور الرب لإبراهيم ويعقوب في العهد القديم كان...', options: ['تجسداً حقيقياً مثل ميلاد المسيح', 'خيالاً في حلم', 'ظهوراً بجسد كامل كجسدنا', 'تمهيداً للتجسد بهيئات مرئية'], correct: 3 },
                    { q: 'شرط أن يكون الفادي "إنساناً" لأن...', options: ['الملائكة أقوى منا', 'الله لا يحب الحيوانات', 'الناسوت أقدس من اللاهوت', 'الذي أخطأ كان إنساناً'], correct: 3 },
                    { q: '"الولادة الأزلية" من الآب تعني إن المسيح...', options: ['وُلد قبل ميلاده من مريم بسنوات', 'موجود منذ خلق آدم', 'خُلق قبل جميع الملائكة فقط', 'موجود قبل الزمان وقبل الخليقة'], correct: 3 },
                    { q: '"لهيب سيف متقلب" مرتبط بـ...', options: ['الطوفان الكبير', 'خروج بني إسرائيل', 'حرب الملوك', 'حراسة شجرة الحياة بعد طرد آدم'], correct: 3 },
                    { q: '"ثيؤطوكوس" معناها...', options: ['القديسة الطاهرة', 'العذراء الأبدية', 'أم النور والسماء', 'والدة الإله'], correct: 3 },

                    // === اختر الاجابة الصح (الأصلية + موسَّعة) ===
                    { q: 'الموت اللي بيخلي الإنسان يفقد "صورته الأولى" هو:', options: ['الموت الجسدي', 'الموت الروحي', 'الموت الأبدي', 'الموت الأدبي'], correct: 3 },
                    { q: 'انفصال الروح عن الجسد هو موت:', options: ['أدبي', 'روحي', 'أبدي', 'جسدي'], correct: 3 },
                    { q: 'البُعد عن ربنا هو موت:', options: ['أدبي', 'جسدي', 'أبدي', 'روحي'], correct: 3 },
                    { q: '"يوم تأكل منها موتاً تموت" اتقالت عن شجرة:', options: ['شجرة الحياة', 'شجرة الزيتون', 'شجرة النعمة', 'شجرة معرفة الخير والشر'], correct: 3 },
                    { q: 'ربنا حط "الكروبيم" ومعاهم:', options: ['عصا موسى', 'قوس قزح', 'سحابة نارية', 'لهيب سيف متقلب'], correct: 3 },
                    { q: 'لو ربنا سامح الإنسان من غير فداء، ده ضد:', options: ['رحمته', 'قوته', 'محبته', 'عدله'], correct: 3 },
                    { q: '"الرحمة والحق التقيا" في:', options: ['الطوفان', 'خروج بني إسرائيل', 'مجمع نيقية', 'التجسد والفداء'], correct: 3 },
                    { q: 'الروح القدس حل على العذراء حلول:', options: ['مؤقت', 'جزئي', 'رمزي', 'أقنومي'], correct: 3 },
                    { q: 'المسيح اتولد من العذراء:', options: ['بزرع بشر', 'برعاية يوسف النجار', 'بطريقة رمزية', 'بدون زرع بشر'], correct: 3 },
                    { q: 'يوسف النجار كان بالنسبة للعذراء مريم:', options: ['زوج حقيقي تزوجها قبل الميلاد', 'زوج تزوجها بعد الميلاد', 'ابن عمها فقط', 'حارس وخطيب ولم يتزوجها إطلاقاً'], correct: 3 },
                    { q: '"التجسد" معناه إن ربنا أخد:', options: ['اسماً جديداً', 'مكاناً في الهيكل', 'طبيعة ملائكية', 'جسداً'], correct: 3 },
                    { q: '"التأنس" معناه إن الجسد اللي ربنا أخده بقى:', options: ['ملكاً', 'كاهناً', 'نبياً', 'إنساناً'], correct: 3 },
                    { q: '"اللاهوت" هو طبيعة:', options: ['الإنسان', 'الملائكة', 'الكون', 'الله'], correct: 3 },
                    { q: 'المسيح شابهنا في كل شيء ماعدا:', options: ['الجوع', 'النوم', 'الفرح', 'الخطية'], correct: 3 },
                    { q: 'ولادة المسيح الأزلية كانت من:', options: ['مريم العذراء', 'يوسف النجار', 'الروح القدس مباشرة', 'الآب'], correct: 3 },
                    { q: 'ولادة المسيح من العذراء مريم كانت ولادة:', options: ['أزلية', 'رمزية', 'روحية فقط', 'زمنية'], correct: 3 },
                    { q: '"ملء الزمان" معناه:', options: ['آخر يوم في العالم', 'وقت الصيام', 'يوم الميلاد تحديداً', 'الوقت المناسب الذي اختاره الله'], correct: 3 },
                    { q: 'التشبيه اللي بيوضح إن الله مش بيتحصر جوه الجسد:', options: ['الحديد', 'الكهرباء', 'المصباح', 'الشمس'], correct: 3 },
                    { q: 'القوة المغناطيسية بتوضح إن القوة:', options: ['بتتحرق', 'لونها أحمر', 'بتُسمع بس مش بتُرى', 'مش بتتشاف بس ليها تأثير'], correct: 3 },
                    { q: 'تشبيه "الحديد المحمي بالنار" بيوضح اتحاد الطبيعتين بدون:', options: ['كلام', 'تعب', 'قوة خارجية', 'أن يتحول أحدهما للآخر'], correct: 3 },
                    { q: 'القديس أغسطينوس بيقول إن آدم في الجنة كان:', options: ['صامتاً ولا يتكلم', 'نائماً معظم الوقت', 'غاضباً من الله', 'فصيحاً يُعطي الأسماء'], correct: 3 },
                    { q: 'الكبرياء البشرية:', options: ['رفعتك للسما', 'ملهاش تأثير', 'جعلتك حكيماً', 'هبطت بك لأسفل'], correct: 3 },
                    { q: 'الاتضاع الإلهي:', options: ['ينزلك للأرض', 'يضعفك', 'يجعلك كالملائكة', 'يرفعك لفوق'], correct: 2 },
                    { q: 'الموت اللي كان هيفضل حاكم للأبد لو مفيش فداء:', options: ['جسدي', 'أدبي', 'روحي', 'أبدي'], correct: 3 },
                    { q: 'ربنا أخرج آدم من الجنة عشان:', options: ['يفسحه', 'يعاقب الحيوانات', 'يتعلم الصيد', 'يعمل الأرض التي أُخذ منها'], correct: 3 },
                    { q: '"القدوس المولود منكِ يدعى ابن الله" الآية دي في إنجيل:', options: ['متى', 'مرقس', 'يوحنا', 'لوقا'], correct: 3 },
                    { q: 'التجسد تم عشان أقنوم الابن ياخد جسداً وأيضاً:', options: ['يبني كنيسة', 'يغير القوانين', 'يرسل رسالة للبشر', 'يطهر مستودع العذراء وتكون الولادة بلا خطية'], correct: 3 },
                    { q: '"تطلع الآب من السماء فلم يجد من يشبهكِ" التسبحة دي بتتقال لـ:', options: ['حواء', 'سارة', 'راحيل', 'العذراء مريم'], correct: 3 },
                    { q: 'المسيح ورث من العذراء مريم:', options: ['الخطية الأصلية', 'الفلوس والحياة', 'المجد والسلطان', 'الجسد الحقيقي'], correct: 3 },
                    { q: 'في قانون الإيمان بنقول "تجسد... وتأنس و...":', options: ['طار للسماء', 'ملك للأبد', 'نزل بروحه فقط', 'صُلب عنا'], correct: 3 },
                    { q: '"ابن الإنسان" لقب يدل على إن المسيح:', options: ['ضعيف', 'مجرد نبي', 'أول إنسان', 'أخذ الجسد من إنسان'], correct: 3 },
                    { q: 'الحديد والنار بيفضلوا متحدين ومع ذلك:', options: ['النار بتطفي', 'الحديد بيذوب', 'بيتحولوا لمادة جديدة', 'النار لسه نار والحديد لسه حديد'], correct: 3 },
                    { q: 'المسيح وهو طفل كان "الكلمة" اللي:', options: ['بيكتب القصص', 'بيتعلم الكلام بصعوبة', 'لا يسمع ولا يكلم', 'تعجز فصاحة البشر قدامه'], correct: 3 },
                    { q: 'آدم أهلك نفسه بعدم الطاعة وهو في:', options: ['صحراء', 'مركب في البحر', 'بيت فقير', 'فردوس مليان فاكهة'], correct: 3 },
                    { q: '"أنت أردت أن تكون إلهاً فضللت" ده قول:', options: ['أثناسيوس الرسولي', 'كيرلس الأول', 'باسيليوس الكبير', 'أغسطينوس'], correct: 3 },
                    { q: 'الشمس لما بتدخل أوضة إزاز:', options: ['بتكسر الإزاز', 'بتختفي في الظلام', 'بتتغير لونها', 'بتملى الأوضة ومش بتنحصر جواها'], correct: 3 },
                    { q: 'المسيح أخذ الذي لنا و:', options: ['رماه بعيداً', 'خاف منه', 'غيَّره', 'أعطانا الذي له'], correct: 3 },
                    { q: 'الحراس اللي حطهم ربنا شرقي الجنة اسمهم:', options: ['الملائكة العاديين', 'الأبرار', 'السيرافيم', 'الكروبيم'], correct: 3 },
                    { q: '"الرحمة والحق التقيا" موجودة في سفر:', options: ['الأيام', 'الأمثال', 'أيوب', 'المزامير'], correct: 3 },
                    { q: 'المسيح نام وجاع وعطش عشان يثبت إنه:', options: ['إله فقط', 'خيال يتمثل', 'كيان روحاني', 'إنسان حقيقي'], correct: 3 },
                    { q: '"اللاهوت" لا يفارق "الناسوت":', options: ['وقت النوم بس', 'بعد القيامة', 'لمدة ٣ ساعات الصليب', 'لحظة واحدة ولا طرفة عين'], correct: 3 },
                    { q: 'المسيح الطفل كان "يصيح" في طفولة:', options: ['متكلمة', 'هادئة', 'حزينة', 'غير متكلمة'], correct: 3 },
                    { q: 'آدم في الجنة كان بيدي كل حي:', options: ['أكله', 'مكانه', 'حكمه', 'اسمه'], correct: 3 },
                    { q: 'المسيح جه كشخص مائت عشان:', options: ['يهرب من المشاكل', 'يتفرج على العالم', 'يعلم الناس فقط', 'يعيد الحياة لمن مات'], correct: 3 },
                    { q: '"هو أخذ الذي لنا" معناه أخد:', options: ['خطايانا فقط', 'بيوتنا', 'كل ما نملكه', 'طبيعتنا وصفاتنا البشرية'], correct: 3 },
                    { q: 'الموت الروحي يعني:', options: ['انفصال الجسد عن الروح', 'فقد الصورة الأولى', 'عذاب الجسد', 'البُعد والانفصال عن الله'], correct: 3 },
                    { q: 'مَن قال: "انظر يا إنسان ماذا صار الله من أجلك"؟', options: ['القديس أثناسيوس', 'البابا كيرلس', 'القديس باسيليوس', 'القديس أغسطينوس'], correct: 3 },
                    { q: '"الكلمة صار جسداً وحلَّ بيننا" في إنجيل:', options: ['متى', 'مرقس', 'لوقا', 'يوحنا'], correct: 3 },
                    { q: 'أقنوم مَن تجسد وأخذ الجسد من العذراء؟', options: ['أقنوم الآب', 'أقنوم الروح القدس', 'الثلاثة معاً', 'أقنوم الابن'], correct: 3 },
                    { q: 'المسيح طبيعة واحدة من طبيعتين، وهذا خلاف مجمع...', options: ['نيقية', 'الإسكندرية', 'أفسس', 'خلقيدونية'], correct: 3 },
                    { q: '"عمانوئيل" معناها:', options: ['الله قوي', 'الله عظيم', 'الله محب', 'الله معنا'], correct: 3 },
                    { q: 'في إشعياء النبي: "ها العذراء تحبل وتلد ابناً وتدعو اسمه...":', options: ['يسوع', 'المسيح', 'الرب', 'عمانوئيل'], correct: 3 },
                    { q: 'الخلاص تطلَّب تجسد الله لأن الإنسان وحده لا يقدر أن:', options: ['يصلي بكفاءة', 'يصوم كفاية', 'يعلم الأجيال', 'يخلص نفسه'], correct: 3 },
                    { q: 'سقوط آدم سبب أنواع من الموت، منها كل الآتي ما عدا:', options: ['موت أدبي', 'موت جسدي', 'موت روحي', 'موت مالي'], correct: 3 },
                    { q: 'من أي أقنوم تجسد الله؟', options: ['الآب', 'الروح القدس', 'الثلاثة معاً', 'الابن'], correct: 3 },
                    { q: 'العذراء مريم لُقِّبت بـ"ثيؤطوكوس" أي:', options: ['القديسة الطاهرة', 'العذراء الأبدية', 'أم النور', 'والدة الإله'], correct: 3 },
                    { q: 'اتحاد اللاهوت والناسوت في المسيح كان بغير:', options: ['قوة ولا إرادة', 'بداية ولا نهاية', 'حب ولا رحمة', 'اختلاط ولا امتزاج ولا تغيير'], correct: 3 },
                    { q: 'حلول الروح القدس على العذراء كان لثلاثة أسباب، منها:', options: ['ليكرمها فقط', 'لتعرف الأسرار', 'ليؤكد نبوات إشعياء فقط', 'تطهير مستودعها وتقديسه'], correct: 3 },
                    { q: 'المسيح طبيعة... من طبيعتين:', options: ['اثنتين منفصلتين كاملتين', 'ثلاثة', 'لا طبيعة محددة', 'واحدة من طبيعتين'], correct: 3 },
                    { q: 'التجسد حدث في ملء:', options: ['القوة', 'المكان', 'العدد', 'الزمان'], correct: 3 }
                ]
            },
            {
                name: 'الفداء والصليب',
                desc: 'معنى الفداء وأهمية الصليب في خلاصنا',
                verse: '"بدون سفك دم لا تحصل مغفرة" (عب ٩: ٢٢)',
                videoId: 'vxFyrnZyWRI',
                videoTitle: 'التجسد والفداء - نيافة الأنبا رافائيل',
                content: 'الفداء يعني أن حد يخلص حد تاني من الموت ويدفع التمن بدله. المسيح فدانا بدمه الطاهر مش بفضة أو ذهب. شروط الفادي: يكون إنساناً (لأن اللي أخطأ إنسان)، غير محدود، قابلاً للموت، أقوى من الموت، بلا خطية، ويقدم نفسه بإرادته. الشروط دي مش موجودة في أي ذبيحة حيوانية ولا نبي ولا ملاك، لكن اكتملت في المسيح.',
                questions: [
                    // === صح أم غلط (محوَّل لـ MC) ===
                    { q: 'ما معنى الفداء؟', options: ['الهروب من العقوبة', 'الاعتذار عن الخطأ', 'شخص يتحمل العقوبة بدلاً عن الآخر', 'الصفح بدون مقابل'], correct: 2 },
                    { q: 'ربنا فدانا بـ...', options: ['فضة كثيرة جداً', 'ذهب وفضة وفير', 'صلواته وصيامه', 'دمه الكريم الطاهر'], correct: 3 },
                    { q: 'حسب الناموس كل حاجة بتتطهر بـ...', options: ['الماء', 'النار', 'الدم', 'الزيت'], correct: 2 },
                    { q: 'مَن المسؤول الأول عن دخول الخطية للعالم؟', options: ['حواء لأنها سمعت الشيطان', 'الحية لأنها غوَّت', 'كلاهما بالتساوي', 'آدم لأنه رأس المرأة'], correct: 3 },
                    { q: 'لماذا استحق آدم العقوبة؟', options: ['لأنه أكل فاكهة ممنوعة', 'لأنه سمع كلام حواء فقط', 'لأنه أهلك نفسه', 'لأن خطيته كانت موجهة ضد الله'], correct: 3 },
                    { q: '"بإنسان واحد دخلت الخطية إلى العالم" هو...', options: ['نوح', 'إبراهيم', 'موسى', 'آدم'], correct: 3 },
                    { q: 'هل يمكن لأي إنسان طيب أن يكون فادياً للبشرية؟', options: ['نعم لو كان نبياً', 'نعم لو كان قديساً كاملاً', 'نعم لو كان رئيس كهنة', 'لا لأن الفداء يحتاج شروطاً خاصة'], correct: 3 },
                    { q: 'لماذا يجب أن يكون الفادي "غير محدود"؟', options: ['ليكون أقوى من الملائكة', 'ليغفر أكثر من مرة', 'ليكون أبدياً', 'لأن الخطية كانت ضد الله غير المحدود'], correct: 3 },
                    { q: 'هل الذبائح الحيوانية في العهد القديم كانت فيها شروط الفداء الكاملة؟', options: ['نعم كانت فيها كل الشروط', 'نعم لكن ناقص شرط واحد', 'فيها بعض الشروط كافية', 'لا لم تكن فيها شروط الفادي أبداً'], correct: 3 },
                    { q: 'لو سامح الله آدم بدون فداء، كان هذا ضد...', options: ['رحمته', 'محبته', 'قوته', 'عدله'], correct: 3 },
                    { q: 'ما معنى كلمة "أثاناطوس" اليونانية؟', options: ['القوي المنتصر', 'المقدس الطاهر', 'الفادي العظيم', 'الخالد الذي لا يموت'], correct: 3 },
                    { q: 'اتحاد اللاهوت والناسوت في المسيح كان...', options: ['بامتزاج وتحول', 'بتغيير وانقلاب', 'باندماج وتلاشٍ', 'بغير امتزاج ولا تغيير'], correct: 3 },
                    { q: 'تشبيه "الدكتور الظابط" يوضح...', options: ['إن المسيح طبيب بشري', 'إن المسيح كاهن وملك', 'إن المسيح نبي وكاهن', 'إن المسيح إله وإنسان في نفس الوقت'], correct: 3 },
                    { q: 'لماذا للصليب 4 أذرع؟', options: ['يمثل الثالوث القدوس', 'يشير للأيام الأربعة', 'يرمز للأسفار الأربعة', 'يشير إن الخلاص وصل لكل ركن في الأرض'], correct: 3 },
                    { q: 'تعليق المسيح بين السماء والأرض يذكرنا بـ...', options: ['نجمة داود', 'صولجان موسى', 'قوس قزح نوح', 'سلم يعقوب'], correct: 3 },
                    { q: 'على الصليب كان المسيح في نفس الوقت...', options: ['ملكاً ونبياً', 'قاضياً ومحامياً', 'معلماً ومريداً', 'كاهناً وذبيحة'], correct: 3 },
                    { q: 'ماذا رأى يوحنا في الرؤيا في وسط العرش؟', options: ['ملاكاً عظيماً بأجنحة', 'أسداً من سبط يهوذا', 'نسراً طائراً يرمز للمسيح', 'حمل قائم كأنه مذبوح'], correct: 3 },
                    { q: '"الرب قد ملك على..." ماذا؟', options: ['الكرسي الذهبي', 'السماء والأرض', 'جبل الرب', 'الخشبة'], correct: 3 },
                    { q: '"ليس بأحد غيره الخلاص" يعني...', options: ['الخلاص بالأعمال الصالحة', 'الخلاص بالأنبياء وسيلة', 'الخلاص متاح بأسماء مختلفة', 'الخلاص فقط في اسم يسوع المسيح'], correct: 3 },
                    { q: 'الفداء هو...', options: ['عمل بشري تطوعي', 'عمل ملائكي', 'عمل مشترك بين الله والبشر', 'عمل إلهي ربنا عمله بنفسه'], correct: 3 },
                    { q: 'الفداء يعني...', options: ['الاعتذار عن الخطأ', 'الهروب من العقوبة', 'الصفح بدون مقابل', 'دفع تمن عشان تخلص حد'], correct: 3 },
                    { q: '"بدون سفك دم لا تحصل مغفرة" في رسالة...', options: ['رومية', 'كورنثوس الأولى', 'غلاطية', 'العبرانيين'], correct: 3 },
                    { q: 'ماذا فعلت حواء في قصة السقوط؟', options: ['رفضت الثمرة أولاً ثم قبلت', 'تركت آدم وحده يأكل', 'أقنعت الله بالعفو', 'اتغوَّت من الشيطان وخلَّت آدم ياكل'], correct: 3 },
                    { q: 'هل ذرية آدم تحت حكم الموت؟', options: ['لا لأنهم لم يرتكبوا الخطية بأنفسهم', 'نعم البعض فقط من الأشرار', 'لا إلا من خطئ بنفسه', 'نعم كلهم لأنهم كانوا في صُلب آدم'], correct: 3 },
                    { q: 'لماذا يجب أن يكون الفادي "قابلاً للموت"؟', options: ['عشان يفهم ألم الموت', 'عشان يخوف الناس', 'عشان يكون إنساناً حقيقياً', 'عشان يتنفذ فيه حكم الموت عن المخطئين'], correct: 3 },
                    { q: 'لماذا يجب أن يكون الفادي "أقوى من الموت"؟', options: ['عشان يهرب منه', 'عشان يخاف منه', 'عشان يتجنبه', 'عشان يغلبه ويقوم منه'], correct: 3 },
                    { q: 'المسيح قدم نفسه للفداء...', options: ['مجبراً لأن الآب أمره', 'خوفاً من الموت الأبدي', 'بعد تردد طويل', 'بإرادته الحرة'], correct: 3 },
                    { q: 'لماذا لم يصلح ملاك أو رئيس ملاك للفداء؟', options: ['لأن الملائكة خافوا', 'لأن ربنا أراد يعملها بنفسه فقط', 'لأن الملائكة بعيدة', 'لأن شروط الفادي لا تنطبق عليهم'], correct: 3 },
                    { q: 'لو ألغى الله حرية آدم، ماذا كان سيحدث؟', options: ['كان آدم سيكون أقوى', 'كان آدم سيتحول لملاك', 'كان آدم سيرفض الخطية', 'ما كنش هيفرق عن الحيوان'], correct: 3 },
                    { q: 'لماذا لم يكن الحل هو خلق إنسان جديد؟', options: ['لأن الله تعب من الخلق', 'لأن الأرض امتلأت', 'لأن ذلك مستحيل', 'لأن مشكلة الحرية والميل للخطية ستتكرر'], correct: 3 },
                    { q: 'ماذا حدث للاهوت المسيح عندما تجسد؟', options: ['اتغير وضعُف', 'انتهى مؤقتاً', 'انقسم بين السماء والأرض', 'لم يتغير أبداً'], correct: 3 },
                    { q: 'المسيح قضى في بطن العذراء...', options: ['3 أشهر', '6 أشهر', '7 أشهر', '9 أشهر'], correct: 3 },
                    { q: 'من قال للمسيح: "حولت ليّ العقوبة خلاصاً"؟', options: ['القديس أغسطينوس', 'البابا كيرلس', 'القديس أثناسيوس', 'القديس غريغوريوس'], correct: 3 },
                    { q: 'الصليب في العقيدة المسيحية هو...', options: ['رمز للعذاب فقط', 'علامة الخزي والذل', 'أداة موت مجردة', 'العرش الذي ملك عليه الرب'], correct: 3 },
                    { q: '"أنا هو الطريق والحق و..."', options: ['النور', 'القيامة', 'السلام', 'الحياة'], correct: 3 },
                    { q: 'ذراعا المسيح المفتوحتان على الصليب يعنيان...', options: ['إنه يستسلم للموت', 'إنه يرفض البشرية', 'إنه يطلب النجاة', 'إنه يضم الكل إليه ككاهن يقدم ذبيحة'], correct: 3 },
                    { q: '"صنعت خلاصاً في وسط الأرض كلها" تُقال في صلاة الساعة...', options: ['الثالثة', 'التاسعة', 'الحادية عشرة', 'السادسة'], correct: 3 },
                    { q: 'الخطية في جوهرها هي...', options: ['أكل الثمرة المحرمة', 'سماع كلام الشيطان', 'فقدان المال والصحة', 'انفصال عن مصدر الحياة (الله)'], correct: 3 },
                    { q: 'الذي يصلح الطبيعة البشرية الفاسدة هو...', options: ['الأعمال الصالحة', 'الصوم والصلاة', 'الناموس الإلهي', 'الفداء المجاني'], correct: 3 },
                    { q: '"ليس اسم آخر تحت السماء... به ينبغي أن نخلص" - هذا الاسم هو...', options: ['اسم الآب', 'اسم موسى', 'اسم إبراهيم', 'اسم يسوع المسيح'], correct: 3 },
                    { q: 'المسيح شابهنا في كل شيء...', options: ['حتى في الخطية الأصلية', 'حتى في الخطية الشخصية', 'ما عدا الجوع والألم', 'ما عدا الخطية وحدها'], correct: 3 },
                    { q: 'اسم "أثناسيوس" مشتق من كلمة معناها...', options: ['القوي', 'القديس', 'المنتصر', 'الخالد'], correct: 3 },
                    { q: 'المسيح ذاق الموت بـ...', options: ['لاهوته', 'روحه فقط', 'قدرته الإلهية', 'جسده'], correct: 3 },
                    { q: '"الحاجز المتوسط" الذي نقضه المسيح يعني...', options: ['الحاجز بين اليهود والروم', 'الحاجز بين الكهنة والشعب', 'الحاجز بين الجنة والجهنم', 'الحاجز بين البشر وربنا'], correct: 3 },
                    { q: 'ماذا فعل المسيح بالعداوة القديمة بين السماء والأرض؟', options: ['أضافها لقائمة الخطايا', 'تجاهلها', 'أعمقها', 'هدمها وأصلح الأرضيين مع السمائيين'], correct: 3 },
                    { q: 'الصليب يصل من مشارق الشمس إلى...', options: ['جبل سيناء', 'أورشليم', 'أرض الميعاد', 'مغاربها'], correct: 3 },
                    { q: 'لماذا لا يمكن الفداء بالفضة أو الذهب؟', options: ['لأنها قليلة جداً', 'لأن الله لا يحتاج مالاً', 'لأن الكنيسة رفضتها', 'لأنها أشياء تفنى لا تعطي حرية أبدية'], correct: 3 },
                    { q: 'آدم أخطأ لأنه...', options: ['كان جاهلاً بالوصية', 'أُكره على الأكل', 'لم يفهم كلام الله', 'سمع كلام حواء وخالف وصية الله'], correct: 3 },
                    { q: 'لماذا كان يجب أن يكون الفادي إنساناً؟', options: ['لأن الملائكة ضعفاء', 'لأن الله لا يهتم بالبشر', 'لأن الإنسان أشرف المخلوقات', 'لأن اللي أخطأ كان إنساناً'], correct: 3 },
                    { q: 'من هو الوسيط الوحيد بيننا وبين الآب؟', options: ['موسى النبي', 'القديس يوحنا', 'مريم العذراء', 'يسوع المسيح'], correct: 3 },

                    // === من أنا؟ (محوَّل لـ MC) ===
                    { q: '"افتقد وصنع فداء لشعبه" - مَن هو؟', options: ['موسى النبي', 'داود الملك', 'إبراهيم الأب', 'الرب إله إسرائيل'], correct: 3 },
                    { q: '"التمن" الذي دُفع لغفران الخطايا هو...', options: ['كمية من الذهب', 'صلوات الأنبياء', 'ذبائح حيوانية كثيرة', 'دم المسيح الطاهر'], correct: 3 },
                    { q: 'من المسؤول الأول عن دخول الخطية للعالم؟', options: ['حواء', 'الحية', 'إبليس', 'آدم'], correct: 3 },
                    { q: 'مَن الذي رأى المسيح في وسط العرش "حمل قائم كأنه مذبوح"؟', options: ['بطرس الرسول', 'بولس الرسول', 'موسى النبي', 'يوحنا الرائي'], correct: 3 },
                    { q: 'من كتب القداس الذي يقول: "لا ملاك ولا رئيس ملائكة ائتمنته على خلاصنا"؟', options: ['القديس أثناسيوس', 'القديس باسيليوس', 'القديس يوحنا ذهبي الفم', 'القديس غريغوريوس'], correct: 3 },
                    { q: 'المصطلح الذي يعني "شخص يتحمل العقوبة بدلاً عن آخر" هو...', options: ['الصلح', 'التوبة', 'المغفرة', 'الفداء'], correct: 3 },
                    { q: 'الكلمة اليونانية "أثاناطوس" تعني...', options: ['القوي الغالب', 'المقدس', 'الحكيم', 'الخالد الذي لا يموت'], correct: 3 },
                    { q: '"الحاجز المتوسط نقضته والعداوة القديمة هدمتها" - مَن يقول ذلك؟', options: ['مريم العذراء', 'يوحنا المعمدان', 'القديس بولس', 'المسيح المخلص'], correct: 3 },
                    { q: 'لو أُلغيت هذه الصفة من الإنسان أصبح مثل الحيوان - ما هي؟', options: ['الذكاء', 'القوة', 'الشكل البشري', 'الحرية'], correct: 3 },
                    { q: '"بدوني لا تحصل مغفرة" - ما أنا؟', options: ['الصلاة', 'الصوم', 'التوبة', 'سفك الدم'], correct: 3 },
                    { q: '"أجرة الخطية" هي...', options: ['المرض', 'الفقر', 'الحزن', 'الموت'], correct: 3 },
                    { q: 'من الرسول الذي وصف المسيح بأنه "حمل بلا عيب ولا دنس"؟', options: ['يوحنا الرسول', 'بولس الرسول', 'يعقوب الرسول', 'بطرس الرسول'], correct: 3 },
                    { q: '"سلم يعقوب" الحقيقي الذي يصل الأرض بالسماء هو...', options: ['البيعة المقدسة', 'الصلاة والصوم', 'العماد المقدس', 'الصليب'], correct: 3 },
                    { q: '"الفداء المجاني" الذي قدمه الله هو...', options: ['الناموس والوصايا', 'الأنبياء والرسل', 'الهياكل والذبائح', 'عمل الخلاص على الصليب'], correct: 3 },
                    { q: 'من الذي تجسد "بغير استحالة" دون أن يتغير لاهوته؟', options: ['أقنوم الآب', 'أقنوم الروح القدس', 'جميع الأقانيم', 'أقنوم الابن'], correct: 3 },
                    { q: 'من الذي ملك على "عرش الصليب"؟', options: ['سليمان الملك', 'داود النبي', 'القديس بطرس', 'يسوع المسيح'], correct: 3 },
                    { q: 'من الوحيد الأقوى من الموت والقادر على التغلب عليه؟', options: ['الملاك ميخائيل', 'موسى النبي', 'إيليا النبي', 'يسوع المسيح الفادي'], correct: 3 },
                    { q: 'من الذي استلم الوصية في الجنة ولم يلتزم بها؟', options: ['حواء فقط', 'الحية', 'كلاهما معاً', 'آدم'], correct: 3 },
                    { q: 'من الذي كان "رأس المرأة" ومسؤولاً عنها وعن خطيتها؟', options: ['إسماعيل', 'نوح', 'إبراهيم', 'آدم'], correct: 3 },
                    { q: 'من الرسول الذي قال: "بدون سفك دم لا تحصل مغفرة"؟', options: ['بطرس الرسول', 'يعقوب الرسول', 'يوحنا الرسول', 'بولس الرسول'], correct: 3 },

                    // === شخصيات (محوَّل لـ MC) ===
                    { q: 'من الذي دفع ثمن حريتنا بدمه لا بفضة ولا ذهب؟', options: ['موسى النبي', 'داود الملك', 'يوحنا المعمدان', 'يسوع المسيح'], correct: 3 },
                    { q: 'من الذي حذّر آدم بقوله "يوم تأكل منها موتاً تموت"؟', options: ['الملاك جبرائيل', 'حواء', 'يوحنا المعمدان', 'الرب الإله'], correct: 3 },
                    { q: 'من الذي رأى السلم الواصل من الأرض إلى السماء؟', options: ['إبراهيم', 'موسى', 'داود', 'يعقوب'], correct: 3 },
                    { q: 'من الرسول الذي كتب "افتديتم بدم كريم كما من حمل بلا عيب"؟', options: ['بولس', 'يوحنا', 'يعقوب', 'بطرس'], correct: 3 },
                    { q: 'من الذي تنبأ "أن يسوع مزمع أن يموت عن الأمة" وهو رئيس كهنة؟', options: ['زكريا', 'أنياس', 'يهوآداع', 'قيافا'], correct: 3 },
                    { q: 'من الذي كان فاتح ذراعيه على الصليب كـ"كاهن يقدم ذبيحة"؟', options: ['موسى النبي', 'هارون الكاهن', 'إيليا النبي', 'يسوع المسيح'], correct: 3 },
                    { q: 'من الذي قال: "حولت ليّ العقوبة خلاصاً"؟', options: ['القديس أثناسيوس', 'القديس كيرلس', 'القديس أغسطينوس', 'القديس غريغوريوس'], correct: 3 },
                    { q: 'من الذي هو "آدم الجديد" الذي أعاد للإنسان حياته؟', options: ['الملاك ميخائيل', 'موسى النبي', 'يوحنا المعمدان', 'يسوع المسيح'], correct: 3 },
                    { q: 'من الذي "شابهنا في كل شيء ما خلا الخطية"؟', options: ['الملاك جبرائيل', 'يوحنا المعمدان', 'إيليا النبي', 'السيد المسيح'], correct: 3 },
                    { q: 'من الذي قدم نفسه ذبيحة "بإرادته" الحرة؟', options: ['إسحاق', 'إبراهيم', 'يوحنا المعمدان', 'السيد المسيح'], correct: 3 },
                    { q: 'من الذي لم يجد من يشبه العذراء فأرسل وحيده؟', options: ['موسى', 'أقنوم الابن', 'الروح القدس', 'الآب'], correct: 3 },
                    { q: 'من الذي كان يتحرك بـ"لهيب سيف متقلب"؟', options: ['الملاك جبرائيل', 'الملاك ميخائيل', 'السيرافيم', 'الكروبيم'], correct: 3 },

                    // === رتّب الآية (محوَّل لـ MC) ===
                    { q: 'أكمل: "بدون سفك دم لا تحصل..."', options: ['حياة', 'نعمة', 'بركة', 'مغفرة'], correct: 3 },
                    { q: 'أكمل: "ليس بأحد غيره..."', options: ['النجاة', 'القوة', 'البركة', 'الخلاص'], correct: 3 },
                    { q: 'أكمل: "أجرة الخطية..."', options: ['مرض', 'حزن', 'فقر', 'موت'], correct: 3 },
                    { q: 'أكمل: "بإنسان واحد دخلت الخطية إلى العالم وبالخطية..."', options: ['الحزن', 'المرض', 'الضلال', 'الموت'], correct: 3 },
                    { q: 'أكمل: "اجتاز الموت إلى جميع الناس إذ أخطأ..."', options: ['الواحد', 'الأقوياء', 'الأشرار', 'الجميع'], correct: 3 },
                    { q: 'أكمل: "افتديتم لا بأشياء تفنى... بل بدم..."', options: ['كثير', 'طاهر', 'إلهي', 'كريم'], correct: 3 },
                    { q: 'أكمل: "الرحمة والحق..."', options: ['تنافسا', 'انفصلا', 'اختلفا', 'التقيا'], correct: 3 },
                    { q: 'أكمل: "الرب قد ملك على..."', options: ['الجبل', 'العرش', 'السماء', 'الخشبة'], correct: 3 },
                    { q: 'أكمل: "أنا هو الطريق والحق و..."', options: ['النور', 'القيامة', 'السلام', 'الحياة'], correct: 3 },
                    { q: 'أكمل: "مبارك الرب إله..."', options: ['السماء', 'الكل', 'البشر', 'إسرائيل'], correct: 3 },
                    { q: 'أكمل: "افتقد وصنع _______ لشعبه"', options: ['سلاماً', 'عهداً', 'نبياً', 'فداءً'], correct: 3 },
                    { q: 'أكمل: "يا من ذاق الموت..."', options: ['بلاهوته', 'بروحه', 'بإرادته', 'بجسده'], correct: 3 },
                    { q: 'أكمل: "حولت ليّ العقوبة..."', options: ['فرحاً', 'حياةً', 'حريةً', 'خلاصاً'], correct: 3 },
                    { q: 'أكمل: "بغير استحالة تجسدت و..."', options: ['وقمت', 'وحللت', 'وملكت', 'وتأنست'], correct: 3 },
                    { q: 'أكمل: "شابهنا في كل شيء ما خلا..."', options: ['الجوع', 'الموت', 'التعب', 'الخطية'], correct: 3 },
                    { q: 'أكمل: "أين _______ يا موت؟"', options: ['قوتك', 'ملكك', 'عرشك', 'شوكتك'], correct: 3 },
                    { q: 'أكمل: "أين _______ يا هاوية؟"', options: ['قوتك', 'جحيمك', 'ظلامك', 'غلبتك'], correct: 3 },

                    // === الكلمة الناقصة (محوَّل لـ MC) ===
                    { q: 'الفداء هو إن الفادي يموت بدل...', options: ['نفسه', 'الملائكة', 'الله', 'المفدي'], correct: 3 },
                    { q: '"بدون سفك دم لا تحصل..."', options: ['نعمة', 'بركة', 'حياة', 'مغفرة'], correct: 3 },
                    { q: '"افتديتم لا بأشياء تفنى بل بدم..."', options: ['إلهي', 'كثير', 'مقدس', 'كريم'], correct: 3 },
                    { q: 'آدم هو المسؤول عن الخطية لأنه _______ المرأة.', options: ['خالق', 'رفيق', 'سيد', 'رأس'], correct: 3 },
                    { q: 'من شروط الفادي أن يكون _______ لأن الخطية ضد الله غير المحدود.', options: ['حكيماً', 'قوياً', 'محبوباً', 'غير محدود'], correct: 3 },
                    { q: 'يجب أن يكون الفادي _______ للموت حتى يُنفَّذ فيه الحكم.', options: ['راضياً', 'مستعداً', 'خائفاً', 'قابلاً'], correct: 3 },
                    { q: 'يجب أن يكون الفادي _______ من الموت ليغلبه.', options: ['أكبر', 'أكثر', 'أسرع', 'أقوى'], correct: 3 },
                    { q: 'لو سامح الله آدم بدون فداء، كان هذا ضد _______ الله.', options: ['رحمة', 'محبة', 'قوة', 'عدل'], correct: 3 },
                    { q: 'كلمة "أثاناطوس" اليونانية معناها...', options: ['القوي', 'القديس', 'المنتصر', 'الخالد'], correct: 3 },
                    { q: '"يا من ذاق الموت بـ..."', options: ['لاهوته', 'روحه', 'إرادته', 'الجسد'], correct: 3 },
                    { q: '"حولت ليّ _______ خلاصاً".', options: ['الأسى', 'الحزن', 'الموت', 'العقوبة'], correct: 3 },
                    { q: 'على الصليب كان المسيح هو الكاهن وهو _______ في نفس الوقت.', options: ['الملك', 'النبي', 'الوسيط', 'الذبيحة'], correct: 3 },
                    { q: 'رأى يوحنا في الرؤيا: "حمل قائم كأنه..."', options: ['طاير', 'نايم', 'ملك', 'مذبوح'], correct: 3 },
                    { q: 'للصليب _______ أذرع تشير لجهات الأرض الأربعة.', options: ['ثلاثة', 'خمسة', 'ستة', 'أربعة'], correct: 3 },
                    { q: 'المسيح هو _______ الوحيد بيننا وبين الآب.', options: ['نبي', 'رسول', 'كاهن', 'وسيط'], correct: 3 },
                    { q: '"الحاجز _______ نقضته" - ما الكلمة الناقصة؟', options: ['القوي', 'الإلهي', 'الأبدي', 'المتوسط'], correct: 3 },
                    { q: '"العداوة _______ هدمتها" - ما الكلمة الناقصة؟', options: ['الكبيرة', 'العميقة', 'الأزلية', 'القديمة'], correct: 3 },
                    { q: '"شابهنا في كل شيء ما خلا _______ وحدها".', options: ['الجوع', 'الموت', 'التعب', 'الخطية'], correct: 3 },
                    { q: '"ليس بأحد غيره..."', options: ['الحياة', 'النجاة', 'الخير', 'الخلاص'], correct: 3 },
                    { q: 'آدم وحواء طُردا من...', options: ['الجنة العلوية', 'المدينة المقدسة', 'جبل الرب', 'الفردوس'], correct: 3 },
                    { q: 'كل البشر كانوا في _______ آدم لما غلط.', options: ['فكر', 'مكان', 'قلب', 'صُلب'], correct: 3 },
                    { q: 'الفداء معناه دفع _______ عشان تخلص حد.', options: ['اعتذار', 'وعد', 'صلاة', 'تمن'], correct: 3 },
                    { q: '"أجرة الخطية..."', options: ['مرض', 'حزن', 'فقر', 'موت'], correct: 3 },
                    { q: '"الرحمة و_______ التقيا".', options: ['الخير', 'المحبة', 'الرحمة', 'الحق'], correct: 3 },
                    { q: 'المسيح شال العقوبة اللي كانت مفروض تقع على...', options: ['الملائكة', 'الأنبياء', 'الكنيسة', 'الإنسان'], correct: 3 },
                    { q: '"بدم كريم كما من _______ بلا عيب".', options: ['ثور', 'شاة', 'نسر', 'حمل'], correct: 3 },

                    // === وصّل الصح (محوَّل لـ MC) ===
                    { q: 'الفادي يجب أن يكون "إنساناً" لأن...', options: ['الله يحب الإنسان أكثر', 'الملائكة ضعفاء', 'الإنسان أشرف المخلوقات', 'اللي أخطأ كان إنساناً'], correct: 3 },
                    { q: 'الفادي يجب أن يكون "غير محدود" لأن...', options: ['الله يريد الأقوى', 'الإنسان محدود', 'الملائكة محدودون', 'الخطية كانت ضد الله غير المحدود'], correct: 3 },
                    { q: 'ما الرمز الذي يمثل تعليق المسيح بين السماء والأرض؟', options: ['قوس قزح', 'قضيب موسى', 'نجمة داود', 'سلم يعقوب'], correct: 3 },
                    { q: '"حمل قائم كأنه مذبوح" يعني...', options: ['المسيح مات ولم يقم', 'الذبيحة رُفضت', 'الحمل ضعيف وصغير', 'ذبيحة حية ومنتصرة'], correct: 3 },
                    { q: 'الأذرع الأربعة للصليب ترمز إلى...', options: ['الأسفار الأربعة', 'أربعة أنبياء كبار', 'أربع مراحل الخلاص', 'وصول الخلاص لكل ركن في الأرض'], correct: 3 },
                    { q: 'لماذا لم يكن الفداء بالفضة والذهب؟', options: ['لأنها قليلة', 'لأن الله لا يريد المال', 'لأن الكنيسة لا تقبلها', 'لأنها أشياء تفنى'], correct: 3 },
                    { q: 'من الذي أُوكل بحراسة طريق شجرة الحياة؟', options: ['الملاك جبرائيل', 'الملاك ميخائيل', 'السيرافيم', 'الكروبيم'], correct: 3 },
                    { q: '"صنعت خلاصاً في وسط الأرض" تُذكر في صلاة الساعة...', options: ['الثالثة', 'التاسعة', 'الحادية عشرة', 'السادسة'], correct: 3 },
                    { q: 'ما الذي جعل الله لا يستطيع أن يغفر لآدم دون فداء؟', options: ['قدرته', 'رحمته', 'محبته', 'عدله'], correct: 3 },
                    { q: 'المسيح "وسيط" يعني...', options: ['مجرد رسول يحمل رسالة', 'ملاك يتوسط في الصلاة', 'نبي يقرأ المستقبل', 'أصلح العلاقة بيننا وبين الآب'], correct: 3 },
                    { q: 'على الصليب كان المسيح يؤدي دور...', options: ['الملك والحاكم', 'النبي والمبشر', 'المعلم والمصلح', 'رئيس الكهنة والذبيحة معاً'], correct: 3 },
                    { q: 'الموت الجسدي يعني...', options: ['البُعد عن الله', 'فقد الكرامة', 'بقاء الموت حاكماً', 'انفصال الروح عن الجسد'], correct: 3 },
                    { q: 'المسيح "ذاق الموت بالجسد" يعني أن الذي مات كان...', options: ['لاهوته', 'روحه فقط', 'إرادته', 'ناسوته (جسده)'], correct: 3 },
                    { q: '"أنا هو الطريق والحق والحياة" هذه صفات...', options: ['إبراهيم الأب', 'موسى النبي', 'الملاك جبرائيل', 'يسوع المسيح'], correct: 3 },
                    { q: '"افتقد وصنع فداء لشعبه" هذا عمل...', options: ['النبي موسى', 'الملك داود', 'الكاهن زكريا', 'الرب إله إسرائيل'], correct: 3 },

                    // === اختر الاجابة الصح (الأصلية + موسَّعة) ===
                    { q: 'الفداء معناه إن حد يخلص حد من العقوبة بـ...', options: ['الهروب منها', 'الاعتذار فقط', 'التوبة الشخصية', 'إنه ياخد مكانه'], correct: 3 },
                    { q: 'ربنا فدانا بدمه الطاهر لا بفضة أو ذهب لأنها أشياء...', options: ['رخيصة جداً', 'صعبة الحصول عليها', 'غير مقدسة', 'تفنى'], correct: 3 },
                    { q: '"بدون سفك دم لا تحصل..."', options: ['حياة', 'نعمة', 'بركة', 'مغفرة'], correct: 3 },
                    { q: 'من المسؤول عن الخطية لأنه رأس المرأة؟', options: ['حواء', 'الحية', 'إبليس', 'آدم'], correct: 3 },
                    { q: 'الخطية والموت دخلا العالم بإنسان...', options: ['شرير', 'غريب', 'جديد', 'واحد'], correct: 3 },
                    { q: 'عشان الفادي يغلب الموت لازم يكون...', options: ['خايف منه', 'أضعف منه', 'متجاهلاً له', 'أقوى منه'], correct: 3 },
                    { q: 'الفادي يجب أن يكون "غير محدود" لأن الخطية كانت ضد...', options: ['حواء', 'الملائكة', 'آدم نفسه', 'الله'], correct: 3 },
                    { q: 'المسيح قدم نفسه للفداء...', options: ['مجبراً', 'بالصدفة', 'غير مدرك', 'بإرادته'], correct: 3 },
                    { q: 'لو سامح الله آدم دون فداء كان هذا ضد...', options: ['قوته', 'رحمته', 'محبته', 'عدله'], correct: 3 },
                    { q: '"أثاناطوس" كلمة يونانية معناها...', options: ['الميت', 'المقدس', 'القوي', 'الخالد'], correct: 3 },
                    { q: 'المسيح "طبيعة واحدة من..."', options: ['ثلاث', 'واحدة', 'لانهاية لها', 'طبيعتين'], correct: 3 },
                    { q: 'اللاهوت والناسوت اتحدا من غير...', options: ['حب وإرادة', 'قوة وإعجاز', 'علم وحكمة', 'امتزاج وتغيير'], correct: 3 },
                    { q: 'تعليق المسيح بين السماء والأرض يشبه...', options: ['عصا هارون', 'نجمة إبراهيم', 'قوس قزح', 'سلم يعقوب'], correct: 3 },
                    { q: 'المسيح فاتح ذراعيه على الصليب كـ...', options: ['ملك يستقبل', 'محارب يستسلم', 'معلم يشرح', 'كاهن وذبيحة'], correct: 3 },
                    { q: '"حمل قائم كأنه..." في رؤية يوحنا...', options: ['طائر', 'نايم', 'حي فقط', 'مذبوح'], correct: 3 },
                    { q: '"الرب قد ملك على..."', options: ['العرش الذهبي', 'السماء', 'الجبل', 'الخشبة'], correct: 3 },
                    { q: 'للصليب كم ذراع؟', options: ['2', '3', '5', '4'], correct: 3 },
                    { q: '"ليس بأحد غيره الخلاص" هذه الآية في سفر...', options: ['التكوين', 'المزامير', 'الرؤيا', 'أعمال الرسل'], correct: 3 },
                    { q: 'طُرد آدم من الجنة ليعمل في...', options: ['البحر', 'الجبل', 'الصحراء', 'الأرض'], correct: 3 },
                    { q: 'لماذا لم تكن الذبائح الحيوانية كافية للفداء الحقيقي؟', options: ['كانت قليلة', 'كانت غالية', 'كان الشعب لا يقدمها صحيح', 'لأنها حيوانية ولا تملك شروط الفادي'], correct: 3 },
                    { q: 'المسيح شابهنا في كل شيء ما خلا...', options: ['الأكل', 'النوم', 'الألم', 'الخطية'], correct: 3 },
                    { q: 'المسيح الوسيط أصلح الأرضيين مع...', options: ['البشر الآخرين', 'الأرض والطبيعة', 'الحيوانات', 'السمائيين'], correct: 3 },
                    { q: 'ماذا فعل المسيح بـ"الحاجز المتوسط"؟', options: ['بناه', 'رمَّمه', 'تجاهله', 'نقضه'], correct: 3 },
                    { q: '"العداوة القديمة" المسيح...', options: ['أضافها', 'تجاوزها', 'نسيها', 'هدمها'], correct: 3 },
                    { q: 'المسيح قضى في بطن العذراء...', options: ['7 أشهر', '6 أشهر', '10 أشهر', '9 أشهر'], correct: 3 },
                    { q: 'اسم "أثناسيوس" مشتق من كلمة معناها...', options: ['القوي', 'الملك', 'المقدس', 'الخالد'], correct: 3 },
                    { q: 'ما الذي حدث للاهوت المسيح عند التجسد؟', options: ['اتغير وتحول', 'انتهى مؤقتاً', 'انحصر في الجسد', 'لم يتبدل ولم يتغير'], correct: 3 },
                    { q: '"قضيب الاستقامة هو قضيب..."', options: ['حكمتك', 'حديد', 'كهنوتك', 'ملكك'], correct: 3 },
                    { q: '"كرسيك يا الله إلى..."', options: ['نهاية الزمان', 'يوم القيامة', 'مئة سنة', 'دهر الدهور'], correct: 3 },
                    { q: 'آدم وحواء أخطآ لأنهما سمعا كلام...', options: ['الملاك', 'بعضهما فقط', 'أحد الأنبياء', 'الشيطان'], correct: 3 },
                    { q: '"اجتاز الموت إلى جميع الناس إذ..." ماذا؟', options: ['تعبوا', 'كفروا', 'سافروا', 'أخطأوا'], correct: 3 },
                    { q: '"أين _______ يا موت؟"', options: ['قوتك', 'ملكك', 'عرشك', 'شوكتك'], correct: 3 },
                    { q: '"أين _______ يا هاوية؟"', options: ['قوتك', 'جحيمك', 'ظلامك', 'غلبتك'], correct: 3 },
                    { q: '"حولت ليّ العقوبة..."', options: ['تعباً', 'حزناً', 'فرحاً', 'خلاصاً'], correct: 3 },
                    { q: 'المسيح يُسمى "آدم..."', options: ['القديم', 'الصغير', 'الجديد', 'الثاني'], correct: 3 },
                    { q: 'من الذي تنبأ "أن يسوع مزمع أن يموت عن الأمة"؟', options: ['بطرس', 'بيلاطس', 'يهوذا', 'رئيس الكهنة قيافا'], correct: 3 },
                    { q: '"حمل قائم كأنه مذبوح" في سفر...', options: ['الخروج', 'المزامير', 'إشعياء', 'الرؤيا'], correct: 3 },
                    { q: 'الأذرع الأربعة للصليب تشير إلى...', options: ['الأسفار الأربعة', 'الأنبياء الأربعة الكبار', 'مراحل الخلاص الأربعة', 'جهات الأرض الأربعة'], correct: 3 },
                    { q: 'تعليق المسيح على الصليب كان بين...', options: ['الجبل والوادي', 'مدينتين', 'القديسين والخطاة', 'السماء والأرض'], correct: 3 },
                    { q: 'الخلاص لا طريق له غير...', options: ['الأعمال وحدها', 'الأنبياء والرسل', 'الكنيسة وسلطتها', 'المسيح وحده'], correct: 3 },
                    { q: 'الفداء "عمل إلهي" يعني أن الله قام به...', options: ['بمساعدة الملائكة', 'بواسطة الأنبياء', 'بأمر للطبيعة', 'بنفسه'], correct: 3 },
                    { q: 'ماذا أصاب الطبيعة البشرية بعد سقوط آدم؟', options: ['تحسّنت', 'تغيّرت قليلاً', 'بقيت كما هي', 'فسدت'], correct: 3 },
                    { q: '"المجد لك يا رب" صرخة الأمم المخلصة بسبب...', options: ['المعجزات والأمطار', 'الأنبياء والرسل', 'خلق العالم', 'الخلاص على الصليب'], correct: 3 },
                    { q: '"عالمين أنكم افتديتم لا بأشياء تفنى" في رسالة...', options: ['رومية', 'العبرانيين', 'غلاطية', '١بطرس'], correct: 3 },
                    { q: '"بدون سفك دم لا تحصل مغفرة" في رسالة...', options: ['كورنثوس', 'رومية', 'غلاطية', 'العبرانيين'], correct: 3 },
                    { q: 'لماذا كان لا يمكن لربنا أن يُفني آدم؟', options: ['لأن الله أحبه فقط', 'لأن الأرض ستفرغ', 'لأن الروح ستُعاقَب وحدها', 'لأن الحكم كان على الجسد والروح معاً'], correct: 3 },
                    { q: 'لماذا لم يمكن إنشاء إنسان جديد كحل للمشكلة؟', options: ['لأن الله تعب', 'لأن الأرض امتلأت', 'لأن آدم عارض', 'لأن مشكلة الحرية والميل للخطية ستتكرر'], correct: 3 },
                    { q: '"في آدم يموت الجميع وفي المسيح سيحيا الجميع" من رسالة...', options: ['رومية', 'غلاطية', 'أفسس', '١كورنثوس'], correct: 3 },
                    { q: 'عبارة "الله محبة" تتجلى أعظم تجلٍّ في...', options: ['الخلق', 'المعجزات', 'التعاليم', 'الصليب'], correct: 3 },
                    { q: 'انشقاق ستار الهيكل عند الصلب يعني أن الطريق لله أصبح...', options: ['مغلقاً', 'صعباً', 'مستحيلاً', 'مفتوحاً'], correct: 3 },
                    { q: 'المسيح صُلب يوم...', options: ['السبت', 'الأحد', 'الخميس', 'الجمعة'], correct: 3 },
                    { q: 'قام المسيح من الأموات في اليوم...', options: ['الأول', 'الثاني', 'السابع', 'الثالث'], correct: 3 },
                    { q: 'لماذا لم يصلح ملاك للفداء؟ لأن الملاك...', options: ['قوي جداً', 'مشغول', 'رفض', 'محدود ومخلوق'], correct: 3 },
                    { q: 'الفادي لازم يكون من نفس _______ المفدي.', options: ['بلد', 'لغة', 'عمر', 'جنس (طبيعة)'], correct: 3 },
                    { q: 'دم المسيح يطهر من...', options: ['المرض الجسدي فقط', 'بعض الخطايا', 'لا شيء', 'كل خطية'], correct: 3 },
                    { q: 'الذبائح في العهد القديم كانت _______ للفداء الحقيقي.', options: ['بديلاً', 'نهاية', 'تكراراً', 'رمزاً'], correct: 3 },
                    { q: 'الحمل في عيد الفصح كان يُذبح رمزاً لـ...', options: ['موسى', 'إبراهيم', 'داود', 'المسيح'], correct: 3 },
                    { q: '"هكذا أحب الله العالم حتى بذل ابنه الوحيد" في إنجيل...', options: ['متى', 'مرقس', 'لوقا', 'يوحنا'], correct: 3 },
                    { q: 'ستار الهيكل انشق عند صلب المسيح من _______ إلى أسفل.', options: ['الوسط', 'الجانب', 'تحت', 'فوق'], correct: 3 },
                    { q: 'الصليب هو رمز لـ...', options: ['الهزيمة', 'الضعف', 'الخوف', 'المحبة والانتصار'], correct: 3 },
                    { q: '"ملعون كل من عُلّق على خشبة" والمسيح حمل _______ بدلاً عنا.', options: ['الحكمة', 'البركة', 'المجد', 'اللعنة'], correct: 3 },
                    { q: 'في القداس نقول "بالصليب _______ فرحٌ في العالم كله"', options: ['حزن', 'خوف', 'انتهى', 'جاء'], correct: 3 }
                ]
            },
            {
                name: 'القيامة والمجيء الثاني',
                desc: 'قيامة المسيح وجسد القيامة والحياة الأبدية',
                verse: '"إن لم تكن قيامة أموات فلا يكون المسيح قد قام وباطلة كرازتنا" (١كو ١٥: ١٣-١٤)',
                videoId: 'k_cs1_aqGgI',
                videoTitle: 'المجيء الثاني - أبونا لوقا ماهر',
                content: 'اللاهوت لم يمت على الصليب بل الناسوت المتحد باللاهوت. في القيامة رجعت الروح الإنسانية للجسد وهما متحدين باللاهوت. جسد القيامة هو جسد روحاني ممجد. القوة التي تعمل التغيير موجودة في التناول من جسد الرب ودمه. المسيح سيأتي ثانياً ليدين الأحياء والأموات.',
                questions: [
                    { q: 'اللي مات على الصليب هو...', options: ['اللاهوت', 'الناسوت المتحد باللاهوت', 'الروح فقط', 'لم يمت أحد'], correct: 1 },
                    { q: 'في القيامة رجعت الروح الإنسانية إلى...', options: ['السماء', 'الجسد', 'الأرض', 'الفردوس'], correct: 1 },
                    { q: 'اللاهوت أثناء موت الجسد كان...', options: ['مات أيضاً', 'يدير الكون', 'اختفى', 'نام'], correct: 1 },
                    { q: 'بدون القيامة إيماننا يكون...', options: ['قوياً', 'عادياً', 'باطلاً', 'مختلفاً'], correct: 2 },
                    { q: 'جسد القيامة الممجد هو جسد...', options: ['مادي عادي', 'روحاني ممجد', 'غير موجود', 'حيواني'], correct: 1 },
                    { q: 'القوة التي تغير أجسادنا للقيامة موجودة في...', options: ['الصلاة فقط', 'التناول من جسد الرب ودمه', 'الصوم فقط', 'القراءة'], correct: 1 },
                    { q: '"من يأكل جسدي ويشرب دمي فله..." ماذا؟', options: ['صحة', 'حياة أبدية', 'قوة', 'حكمة'], correct: 1 },
                    { q: 'الترابي هو آدم الأول والسماوي هو...', options: ['موسى', 'داود', 'المسيح', 'إبراهيم'], correct: 2 },
                    { q: 'يوم الرب يأتي فجأة مثل...', options: ['الشمس', 'المطر', 'الحرامي في الليل', 'الريح'], correct: 2 },
                    { q: 'أولاد الله في النور المجيء الثاني لن يكون لهم...', options: ['فرحاً', 'مفاجأة مرعبة', 'بركة', 'نعمة'], correct: 1 },
                    { q: 'المسيح شبّه حال الناس قبل مجيئه بأيام...', options: ['موسى', 'داود', 'نوح', 'إبراهيم'], correct: 2 },
                    { q: 'من علامات المجيء الثاني انتشار الإنجيل في...', options: ['اليهودية فقط', 'كل العالم', 'أوروبا فقط', 'مصر فقط'], correct: 1 },
                    { q: 'الأماكن المؤقتة للأرواح بعد الموت هي الفردوس و...', options: ['جهنم', 'الجحيم', 'الملكوت', 'السماء'], correct: 1 },
                    { q: 'الأماكن الأبدية هي ملكوت السماوات و...', options: ['الفردوس', 'الجحيم', 'جهنم', 'الأرض'], correct: 2 },
                    { q: 'في المجيء الثاني الأموات في المسيح يقومون...', options: ['آخراً', 'أولاً', 'في نفس الوقت', 'لا يقومون'], correct: 1 },
                    { q: 'القديسون يقتربون بأجسادهم من طبيعة جسد القيامة بقوة...', options: ['إرادتهم', 'الروح القدس', 'المعرفة', 'التدريب البدني'], correct: 1 },
                    { q: 'هل المسيح سيملك على الأرض ألف سنة؟', options: ['نعم', 'لا، هذا خطأ', 'ربما', 'غير معروف'], correct: 1 },
                    { q: '"سنخطف جميعاً في السحب لملاقاة الرب في..."', options: ['الأرض', 'البحر', 'الهواء', 'الجبل'], correct: 2 },
                    { q: 'قبل ظهور المسيح في المجيء الثاني تظهر علامة ابن الإنسان وهي...', options: ['نجمة', 'الصليب', 'قوس قزح', 'سحابة'], correct: 1 },
                    { q: '"اسهروا إذاً لأنكم لا تعلمون في أية ساعة يأتي..." من؟', options: ['النبي', 'الملاك', 'ربكم', 'الضيف'], correct: 2 },
                    { q: 'قام المسيح فجر يوم...', options: ['السبت', 'الأحد', 'الجمعة', 'الاثنين'], correct: 1 },
                    { q: 'أول من رأى المسيح بعد القيامة كانت...', options: ['بطرس', 'يوحنا', 'مريم المجدلية', 'توما'], correct: 2 },
                    { q: 'جسد المسيح بعد القيامة كان يدخل والأبواب...', options: ['مفتوحة', 'مغلقة', 'مكسورة', 'لا توجد أبواب'], correct: 1 },
                    { q: 'توما آمن بالقيامة عندما...', options: ['سمع عنها', 'رأى ولمس المسيح', 'حلم', 'قرأ'], correct: 1 },
                    { q: 'المسيح بقي على الأرض بعد القيامة... يوماً', options: ['٣', '٧', '٤٠', '١٢٠'], correct: 2 },
                    { q: 'صعد المسيح إلى السماء من جبل...', options: ['سيناء', 'الزيتون', 'تابور', 'حرمون'], correct: 1 },
                    { q: '"أين شوكتك يا موت؟" تعني أن القيامة...', options: ['أضعفت الموت', 'انتصرت على الموت', 'تجاهلت الموت', 'خافت من الموت'], correct: 1 },
                    { q: 'عيد القيامة هو عيد...', options: ['الحزن', 'الأعياد', 'الفرح الأعظم', 'الصوم'], correct: 2 },
                    { q: 'المسيح الثاني يدين...', options: ['الأشرار فقط', 'الأحياء والأموات', 'الأحياء فقط', 'الملائكة فقط'], correct: 1 },
                    { q: 'في المجيء الثاني كل عين سوف...', options: ['تُغلق', 'تبصره', 'تنام', 'تخاف'], correct: 1 },
                    { q: 'المسيح قال "في بيت أبي..."', options: ['غرفة واحدة', 'منازل كثيرة', 'لا مكان', 'حجرتان'], correct: 1 },
                    { q: 'نقول في القداس "نعلن موتك يا رب ونعترف بقيامتك..."', options: ['المجيدة', 'المقدسة', 'إلى أن تجيء', 'الأبدية'], correct: 2 },
                    { q: 'القيامة تعطينا... في مواجهة الموت', options: ['خوفاً', 'قلقاً', 'رجاءً', 'حزناً'], correct: 2 },
                    { q: 'الحجر الذي كان على القبر...', options: ['بقي مكانه', 'دُحرج بعيداً', 'تحطم', 'اختفى'], correct: 1 },
                    { q: 'الملائكة قالت للنساء عند القبر "لماذا تطلبن الحي بين..."', options: ['الناس', 'الأموات', 'الملائكة', 'القبور'], correct: 1 }
                ]
            },
            {
                name: 'المعمودية والميرون',
                desc: 'سر الولادة الجديدة والختم الملوكي',
                verse: '"إن كان أحد لا يولد من الماء والروح لا يقدر أن يدخل ملكوت الله" (يو ٣: ٥)',
                videoId: 'sENBfzteQa8',
                videoTitle: 'المعمودية والميرون - أبونا لوقا ماهر',
                content: 'المعمودية هي باب الأسرار السبعة والولادة الجديدة. يُغطس المعمَّد ٣ مرات باسم الثالوث. المعمودية موت مع المسيح وقيامة معه. الميرون هو سر حلول الروح القدس بـ٣٦ رشمة تقدس كل حواس وكيان الإنسان. المعمودية لا تُعاد لأنها ولادة والإنسان يُولد مرة واحدة.',
                questions: [
                    { q: 'المعمودية هي... الأسرار السبعة', options: ['نهاية', 'باب', 'وسط', 'جزء من'], correct: 1 },
                    { q: 'كلمة معمودية باليوناني "بابتيزما" معناها...', options: ['رش', 'تغطيس', 'غسيل', 'سكب'], correct: 1 },
                    { q: 'كم مرة يُغطس المعمَّد؟', options: ['مرة', 'مرتين', '٣ مرات', '٧ مرات'], correct: 2 },
                    { q: 'المعمودية هي موت مع المسيح و... معه', options: ['حياة', 'قيامة', 'صعود', 'جلوس'], correct: 1 },
                    { q: 'الطوفان وفلك نوح كان رمزاً لـ...', options: ['الصوم', 'المعمودية', 'الصلاة', 'التوبة'], correct: 1 },
                    { q: 'عبور البحر الأحمر كان رمزاً لـ...', options: ['الحرب', 'المعمودية', 'الموت', 'السفر'], correct: 1 },
                    { q: 'المسيح لما اتعمد "صعد للوقت من الماء" يعني كان...', options: ['رشاً', 'تغطيساً', 'سكباً', 'مسحاً'], correct: 1 },
                    { q: 'يوم الخمسين اعتمد حوالي... نفس', options: ['١٠٠', '٥٠٠', '٣٠٠٠', '١٠٠٠٠'], correct: 2 },
                    { q: 'المعمودية بتغفر الخطية الجدية وكل الخطايا...', options: ['المستقبلية', 'الشخصية', 'فقط الكبيرة', 'لا تغفر'], correct: 1 },
                    { q: 'المعمودية لا تُعاد لأنها... والإنسان يُولد مرة واحدة', options: ['صلاة', 'ولادة', 'عادة', 'تقليد'], correct: 1 },
                    { q: '"رب واحد إيمان واحد... واحدة" (أف ٤: ٥)', options: ['صلاة', 'معمودية', 'كنيسة', 'ذبيحة'], correct: 1 },
                    { q: 'في ماء جرن المعمودية يوضع كم نوع من الزيوت؟', options: ['١', '٢', '٣', '٥'], correct: 2 },
                    { q: 'كم رشمة في سر الميرون؟', options: ['١٢', '٢٤', '٣٦', '٤٠'], correct: 2 },
                    { q: 'رشومات الرأس (٨ رشمات) تقدس...', options: ['الأعمال', 'الحواس', 'الأرجل', 'الإرادة'], correct: 1 },
                    { q: 'رشومات الأيدين (١٢ رشمة) تقدس...', options: ['الحواس', 'المسيرة', 'العمل', 'الإرادة'], correct: 2 },
                    { q: 'رشومات الأرجل (١٢ رشمة) تقدس...', options: ['الحواس', 'العمل', 'المسيرة', 'الإرادة'], correct: 2 },
                    { q: 'رشم الصلب والظهر يقدس...', options: ['الحواس', 'الإرادة', 'المشاعر', 'المسيرة'], correct: 1 },
                    { q: 'الولد يُعمَّد بعد... يوم', options: ['٨', '٤٠', '٨٠', '١٠٠'], correct: 1 },
                    { q: 'البنت تُعمَّد بعد... يوم', options: ['٤٠', '٦٠', '٨٠', '١٠٠'], correct: 2 },
                    { q: 'بعد المعمودية علاج الخطية يكون بـ...', options: ['إعادة المعمودية', 'التوبة والاعتراف', 'لا علاج', 'الصوم فقط'], correct: 1 },
                    { q: 'في المعمودية يموت الإنسان... ويقوم مع المسيح', options: ['جسدياً', 'عن الخطية', 'حقيقياً', 'مجازياً'], correct: 1 },
                    { q: 'الماء في المعمودية يرمز لـ...', options: ['الحياة والموت معاً', 'الغسل فقط', 'النظافة', 'الشرب'], correct: 0 },
                    { q: 'المعمودية بالتغطيس تشير للدفن مع...', options: ['آدم', 'موسى', 'المسيح', 'إبراهيم'], correct: 2 },
                    { q: 'الخروج من الماء يشير لـ... مع المسيح', options: ['الموت', 'القيامة', 'الصعود', 'الحزن'], correct: 1 },
                    { q: 'نعمان السرياني اغتسل في نهر... ٧ مرات وطهر', options: ['النيل', 'الأردن', 'دجلة', 'الفرات'], correct: 1 },
                    { q: 'قصة نعمان تُشير لسر...', options: ['الصلاة', 'المعمودية', 'الزواج', 'الكهنوت'], correct: 1 },
                    { q: 'الخصي الحبشي اعتمد على يد...', options: ['بطرس', 'بولس', 'فيلبس', 'يوحنا'], correct: 2 },
                    { q: 'الجرن المعمودية شكله يشبه...', options: ['المربع', 'القبر', 'الدائرة', 'المثلث'], correct: 1 },
                    { q: 'الطفل يلبس ملابس بيضاء بعد المعمودية رمزاً لـ...', options: ['الجمال', 'الطهارة والنقاء', 'العادات', 'لا سبب'], correct: 1 },
                    { q: 'كورنيليوس وأهل بيته اعتمدوا بعد أن حلّ عليهم...', options: ['المطر', 'الروح القدس', 'الملائكة', 'النوم'], correct: 1 },
                    { q: 'المعمودية تعطينا... في المسيح', options: ['بنوة لله', 'مال', 'شهرة', 'قوة جسدية'], correct: 0 },
                    { q: 'زيت الغاليلاون يُستخدم في المعمودية لـ...', options: ['التزيين', 'الطبخ', 'مسحة الشفاء والفرح', 'لا سبب'], correct: 2 },
                    { q: 'سر الميرون يُقام مرة واحدة مثل...', options: ['التوبة', 'التناول', 'المعمودية', 'الصلاة'], correct: 2 },
                    { q: 'كلمة "ميرون" معناها...', options: ['ماء', 'زيت', 'طيب مقدس', 'عطر عادي'], correct: 2 },
                    { q: 'في سر الميرون يحل... على المعمَّد', options: ['الملاك', 'الروح القدس', 'البركة فقط', 'لا شيء'], correct: 1 }
                ]
            },
            {
                name: 'التوبة والاعتراف',
                desc: 'سر التوبة والرجوع إلى الله',
                verse: '"إن اعترفنا بخطايانا فهو أمين وعادل حتى يغفر لنا خطايانا" (١يو ١: ٩)',
                videoId: 'sENBfzteQa8',
                videoTitle: 'سر التوبة والاعتراف - أبونا موسى نصري',
                content: 'الاعتراف هو الإقرار بالخطية أمام الكاهن الذي أعطاه المسيح سلطان الحل والربط. السر ده موجود من العهد القديم (آدم وقايين وذبائح الخطية) ومر بيوحنا المعمدان وعصر الرسل. الكاهن وكيل على أسرار الله. التوبة الحقيقية تحتاج: صدق، محاسبة نفس، عدم تبرير، وتنفيذ كلام أب الاعتراف.',
                questions: [
                    { q: 'الاعتراف هو... بالخطية', options: ['إنكار', 'إقرار وتصريح', 'نسيان', 'إخفاء'], correct: 1 },
                    { q: 'السر الكنسي هو نوال نعمة غير منظورة بواسطة مادة... على يد كاهن', options: ['غير منظورة', 'منظورة', 'سرية', 'خفية'], correct: 1 },
                    { q: 'ربنا سأل آدم "أين أنت؟" عشان يديه فرصة...', options: ['يهرب', 'يعترف', 'يختبئ', 'ينام'], correct: 1 },
                    { q: 'قايين لما ربنا سأله عن هابيل...', options: ['اعترف', 'رفض يعترف', 'بكى', 'تاب'], correct: 1 },
                    { q: 'في العهد القديم كان المخطئ يجيب ذبيحة خطية ويحط إيده على راس...', options: ['الكاهن', 'الخروف', 'الحائط', 'الأرض'], correct: 1 },
                    { q: 'الناس كانت بتروح ليوحنا المعمدان وتتعمد وهي...', options: ['صامتة', 'معترفة بخطاياها', 'نائمة', 'غاضبة'], correct: 1 },
                    { q: 'في سفر أعمال الرسل المؤمنين كانوا "يأتون مقرين و..."', options: ['صامتين', 'مخبرين بأفعالهم', 'هاربين', 'خائفين'], correct: 1 },
                    { q: 'كلمة "مخبرين" تعني اعتراف... قدام الرسل', options: ['سري', 'تفصيلي وشفاهي', 'مكتوب', 'صامت'], correct: 1 },
                    { q: 'الكاهن هو... على أسرار الله', options: ['غريب', 'وكيل', 'عدو', 'زائر'], correct: 1 },
                    { q: '"شفتي الكاهن تحفظان... ومن فمه يطلبون الشريعة" (ملا ٢: ٧)', options: ['الصمت', 'المعرفة', 'الأسرار', 'المال'], correct: 1 },
                    { q: 'المسيح أعطى الرسل سلطان... والربط', options: ['القوة', 'الحل', 'المال', 'الحكم'], correct: 1 },
                    { q: '"كل ما تربطونه على الأرض يكون مربوطاً في..."', options: ['الأرض', 'البحر', 'السماء', 'الجحيم'], correct: 2 },
                    { q: 'المسيح بيغفر بسلطانه... أما الكاهن بـ"صلاة التحليل"', options: ['الذاتي', 'المكتسب', 'المؤقت', 'البشري'], correct: 0 },
                    { q: 'أول شرط للاعتراف الحقيقي هو...', options: ['السرعة', 'التوبة الحقيقية', 'الخوف', 'الإجبار'], correct: 1 },
                    { q: 'الاعتراف يشبه الذهاب لـ... عشان نوصف المرض', options: ['المدرسة', 'الطبيب', 'السوق', 'البيت'], correct: 1 },
                    { q: '"من يكتم خطاياه لا ينجح ومن يقر بها ويتركها..."', options: ['يُعاقب', 'يُرحم', 'يُنسى', 'يُطرد'], correct: 1 },
                    { q: 'لازم نعترف بكل ضعف ومنتكسفش لأن الكاهن هو...', options: ['قاضي', 'عدو', 'طبيب الروح', 'غريب'], correct: 2 },
                    { q: 'بعد الاعتراف لازم ننفذ... اللي أب الاعتراف يطلبها', options: ['الأوامر العسكرية', 'الأدوية الروحية (التداريب)', 'العقوبات', 'الغرامات'], correct: 1 },
                    { q: 'الأنبا موسى تاب ورجع بمساعدة أبوه الروحي الأنبا...', options: ['أنطونيوس', 'مقار', 'إيسيذورس', 'باخوميوس'], correct: 2 },
                    { q: 'الخجل من الاعتراف هو... من الشيطان', options: ['نعمة', 'بركة', 'فخ', 'هدية'], correct: 2 },
                    { q: 'داود النبي اعترف بخطيته أمام... النبي', options: ['إيليا', 'إشعياء', 'ناثان', 'صموئيل'], correct: 2 },
                    { q: 'مزمور التوبة الشهير هو مزمور...', options: ['٢٣', 'الخمسين (٥٠)', '٩١', '١٠٠'], correct: 1 },
                    { q: 'بطرس أنكر المسيح... مرات', options: ['مرة', 'مرتين', 'ثلاث', 'أربع'], correct: 2 },
                    { q: 'بعد إنكاره بكى بطرس...', options: ['قليلاً', 'بكاءً مراً', 'لم يبكِ', 'ابتسم'], correct: 1 },
                    { q: 'يهوذا ندم لكنه لم...', options: ['يبكِ', 'يتوب توبة حقيقية', 'يفكر', 'ينم'], correct: 1 },
                    { q: 'الفرق بين الندم والتوبة أن التوبة تتضمن...', options: ['البكاء فقط', 'التغيير والرجوع لله', 'الحزن فقط', 'الكلام'], correct: 1 },
                    { q: 'المرأة الخاطئة غسلت قدمي المسيح بـ...', options: ['ماء', 'دموعها', 'عطر فقط', 'زيت'], correct: 1 },
                    { q: 'زكا العشّار تاب ورد أضعاف ما أخذه بالظلم...', options: ['مرتين', 'ثلاث', 'أربعة أضعاف', 'لم يرد'], correct: 2 },
                    { q: 'سرية الاعتراف تعني أن الكاهن لا يحق له أن...', options: ['يستمع', 'يفشي ما سمعه', 'يصلي', 'ينصح'], correct: 1 },
                    { q: 'التوبة في اليونانية "ميتانويا" معناها...', options: ['الحزن', 'تغيير الفكر والاتجاه', 'البكاء', 'الخوف'], correct: 1 },
                    { q: 'مثل الخروف الضال يوضح أن الله...', options: ['يعاقب الخاطئ', 'يبحث عن الخاطئ ليرده', 'يتجاهل الخاطئ', 'يغضب من الخاطئ'], correct: 1 },
                    { q: 'في مثل الابن الضال الأب...', options: ['رفض ابنه', 'ركض نحوه وقبّله', 'عاقبه', 'طرده'], correct: 1 },
                    { q: 'الاعتراف يجب أن يكون... وليس عاماً', options: ['مختصراً', 'تفصيلياً', 'سرياً', 'مكتوباً'], correct: 1 },
                    { q: 'محاسبة النفس تعني أن أسأل نفسي كل يوم عن...', options: ['المال', 'خطاياي وتصرفاتي', 'الطعام', 'الأصدقاء'], correct: 1 },
                    { q: 'أب الاعتراف يعطي "أدوية روحية" أي...', options: ['حبوب', 'تداريب روحية', 'عقوبات', 'غرامات'], correct: 1 }
                ]
            }
        ]
    },
    bible: {
        name: 'كتاب مقدس',
        desc: 'كل سفر وكل حكاية',
        icon: '📖',
        color: '#3498db',
        lessons: [
            {
                name: 'الكتاب المقدس كلمة الله',
                desc: 'كيف أُعطينا الكتاب المقدس ولماذا هو مهم',
                verse: '"كل الكتاب هو موحى به من الله" (٢ تيموثاوس 3:16)',
                content: 'الكتاب المقدس هو كلمة الله الموحى بها. كُتب بواسطة أكثر من 40 كاتباً على مدار 1500 سنة بإلهام الروح القدس. يتكون من 66 سفراً: 39 في العهد القديم و27 في العهد الجديد. الكتاب المقدس هو المصدر الأساسي لإيماننا.',
                questions: [
                    { q: 'كم عدد أسفار الكتاب المقدس؟', options: ['50', '66', '73', '80'], correct: 1 },
                    { q: 'كم كاتباً كتبوا الكتاب المقدس تقريباً؟', options: ['12', '20', '40+', '100'], correct: 2 },
                    { q: 'الكتاب المقدس موحى به من...', options: ['البشر', 'الملائكة', 'الله', 'القديسين'], correct: 2 },
                    { q: 'كم سفراً في العهد الجديد؟', options: ['27', '39', '22', '14'], correct: 0 },
                    { q: 'على مدار كم سنة كُتب الكتاب المقدس؟', options: ['100', '500', '1000', '1500'], correct: 3 }
                ]
            },
            {
                name: 'شخصيات العهد القديم',
                desc: 'أبطال الإيمان في العهد القديم',
                verse: '"بالإيمان قدم هابيل لله ذبيحة أفضل من قايين" (عبرانيين 11:4)',
                content: 'العهد القديم مليء بأبطال الإيمان: إبراهيم أبو الآباء الذي آمن بالله، موسى الذي قاد الشعب من مصر، داود الملك بحسب قلب الله، إيليا النبي الناري، دانيال في جب الأسود. كل واحد منهم يعلمنا درساً مهماً عن الإيمان.',
                questions: [
                    { q: 'من هو أبو الآباء؟', options: ['موسى', 'إبراهيم', 'يعقوب', 'إسحق'], correct: 1 },
                    { q: 'من قاد الشعب خروجاً من مصر؟', options: ['يشوع', 'داود', 'موسى', 'صموئيل'], correct: 2 },
                    { q: 'من كان ملكاً بحسب قلب الله؟', options: ['شاول', 'سليمان', 'داود', 'حزقيا'], correct: 2 },
                    { q: 'من أُلقي في جب الأسود؟', options: ['إيليا', 'إرميا', 'دانيال', 'يونان'], correct: 2 },
                    { q: 'عبرانيين 11 يتحدث عن...', options: ['الشريعة', 'أبطال الإيمان', 'النبوات', 'المزامير'], correct: 1 }
                ]
            },
            {
                name: 'حياة المسيح على الأرض',
                desc: 'ميلاد المسيح وخدمته ومعجزاته',
                verse: '"جال يصنع خيراً ويشفي جميع المتسلط عليهم إبليس" (أعمال 10:38)',
                content: 'وُلد المسيح في بيت لحم، ونشأ في الناصرة. بدأ خدمته بعد المعمودية من يوحنا المعمدان. صنع معجزات كثيرة: شفى المرضى، أقام الموتى، أطعم الجموع، مشى على الماء. علّم بأمثال عظيمة وقدم لنا نموذجاً للحياة الكاملة.',
                questions: [
                    { q: 'أين وُلد المسيح؟', options: ['الناصرة', 'أورشليم', 'بيت لحم', 'مصر'], correct: 2 },
                    { q: 'من عمّد المسيح؟', options: ['بطرس', 'يوحنا المعمدان', 'أندراوس', 'يعقوب'], correct: 1 },
                    { q: 'أين نشأ المسيح؟', options: ['بيت لحم', 'أورشليم', 'الناصرة', 'كفرناحوم'], correct: 2 },
                    { q: 'من المعجزات: أطعم المسيح...', options: ['100 شخص', '1000 شخص', '5000 شخص', '500 شخص'], correct: 2 },
                    { q: 'المسيح علّم بـ...', options: ['القوانين فقط', 'الأمثال', 'الحروب', 'السياسة'], correct: 1 }
                ]
            },
            {
                name: 'أمثال المسيح',
                desc: 'أهم أمثال المسيح ومعانيها العميقة',
                verse: '"هذا كله كلم به يسوع الجموع بأمثال" (متى 13:34)',
                content: 'استخدم المسيح الأمثال لتعليم حقائق روحية عميقة بطريقة بسيطة. من أشهر الأمثال: الابن الضال (محبة الآب)، الزارع (أنواع القلوب)، السامري الصالح (محبة القريب)، العذارى العشر (الاستعداد)، الوزنات (استثمار المواهب).',
                questions: [
                    { q: 'مثل الابن الضال يعلمنا عن...', options: ['العقاب', 'محبة الآب', 'المال', 'السفر'], correct: 1 },
                    { q: 'مثل الزارع يتحدث عن أنواع...', options: ['البذور', 'الأرض/القلوب', 'الأشجار', 'الماء'], correct: 1 },
                    { q: 'من ساعد الإنسان الجريح في مثل السامري؟', options: ['الكاهن', 'اللاوي', 'السامري', 'الفريسي'], correct: 2 },
                    { q: 'مثل العذارى العشر يعلمنا عن...', options: ['الزواج', 'الاستعداد', 'الجمال', 'النوم'], correct: 1 },
                    { q: 'مثل الوزنات يعلمنا عن...', options: ['المال', 'استثمار المواهب', 'البنوك', 'التجارة'], correct: 1 }
                ]
            },
            {
                name: 'رسائل بولس الرسول',
                desc: 'رسائل بولس وتأثيرها على الكنيسة',
                verse: '"لي الحياة هي المسيح والموت هو ربح" (فيلبي 1:21)',
                content: 'بولس الرسول كتب 14 رسالة في العهد الجديد. كان في البداية يضطهد المسيحيين ثم ظهر له المسيح في طريق دمشق فتحول وصار أعظم مبشر. رسائله تشمل: رومية، كورنثوس، غلاطية، أفسس، فيلبي، وغيرها. علّم عن النعمة والإيمان والمحبة.',
                questions: [
                    { q: 'كم رسالة كتب بولس؟', options: ['7', '10', '14', '21'], correct: 2 },
                    { q: 'أين ظهر المسيح لبولس؟', options: ['أورشليم', 'طريق دمشق', 'روما', 'أنطاكية'], correct: 1 },
                    { q: 'ماذا كان بولس يفعل قبل إيمانه؟', options: ['يبشر', 'يصلي', 'يضطهد المسيحيين', 'يكتب'], correct: 2 },
                    { q: '"لي الحياة هي المسيح" في أي رسالة؟', options: ['رومية', 'فيلبي', 'كورنثوس', 'غلاطية'], correct: 1 },
                    { q: 'بولس علّم عن النعمة والإيمان و...', options: ['القوة', 'المحبة', 'المعرفة', 'الحكمة'], correct: 1 }
                ]
            },
            {
                name: 'سفر الرؤيا والرجاء',
                desc: 'رؤيا يوحنا ورجاؤنا في المجيء الثاني',
                verse: '"ها أنا آتي سريعاً وأجرتي معي" (رؤيا 22:12)',
                content: 'سفر الرؤيا هو آخر أسفار الكتاب المقدس، كتبه يوحنا الرسول في جزيرة بطمس. يتحدث عن انتصار المسيح النهائي على الشر، والسماء الجديدة والأرض الجديدة. رسالته الأساسية هي الرجاء: مهما كانت الضيقات، المسيح غالب ونحن معه منتصرون.',
                questions: [
                    { q: 'من كتب سفر الرؤيا؟', options: ['بولس', 'بطرس', 'يوحنا', 'يعقوب'], correct: 2 },
                    { q: 'أين كان يوحنا عندما كتب الرؤيا؟', options: ['أورشليم', 'روما', 'بطمس', 'أفسس'], correct: 2 },
                    { q: 'الرسالة الأساسية لسفر الرؤيا هي...', options: ['الخوف', 'الرجاء', 'الحزن', 'الانتقام'], correct: 1 },
                    { q: 'سفر الرؤيا يتحدث عن انتصار...', options: ['الإنسان', 'الملائكة', 'المسيح', 'الطبيعة'], correct: 2 },
                    { q: '"ها أنا آتي سريعاً" في أي إصحاح؟', options: ['رؤيا 1', 'رؤيا 7', 'رؤيا 15', 'رؤيا 22'], correct: 3 }
                ]
            }
        ]
    },
    life: {
        name: 'مهارات الحياة والقياده',
        desc: 'مهارات الحياة والقيادة',
        icon: '🌟',
        color: '#f39c12',
        lessons: [
            {
                name: 'اعرف نفسك',
                desc: 'اكتشاف الذات والمواهب التي أعطاها الله لك',
                verse: '"لأنك أنت اقتنيت كليتيّ. نسجتني في بطن أمي. أحمدك من أجل أني قد امتزت عجباً" (مزمور 139:13-14)',
                content: 'الله خلق كل واحد فينا بطريقة فريدة ومميزة. لكل شخص مواهب وقدرات مختلفة. اكتشاف ذاتك هو أول خطوة للنجاح. اسأل نفسك: ما الذي أحبه؟ ما الذي أجيده؟ كيف أخدم الله والآخرين بمواهبي؟',
                questions: [
                    { q: 'أول خطوة للنجاح هي...', options: ['المال', 'الشهرة', 'اكتشاف الذات', 'القوة'], correct: 2 },
                    { q: 'الله خلق كل واحد...', options: ['متشابهاً', 'فريداً ومميزاً', 'ضعيفاً', 'بلا هدف'], correct: 1 },
                    { q: 'المواهب هي عطية من...', options: ['المجتمع', 'المدرسة', 'الله', 'الأصدقاء'], correct: 2 },
                    { q: 'ما السؤال المهم لاكتشاف الذات؟', options: ['كم عمري؟', 'ما الذي أجيده؟', 'أين أسكن؟', 'من أصدقائي؟'], correct: 1 },
                    { q: '"امتزت عجباً" تعني أن الله صنعنا...', options: ['عادياً', 'بطريقة عجيبة ورائعة', 'بسرعة', 'بدون تخطيط'], correct: 1 }
                ]
            },
            {
                name: 'قوة الكلمة',
                desc: 'تأثير الكلمات وكيف نتكلم بحكمة',
                verse: '"الموت والحياة في يد اللسان" (أمثال 18:21)',
                content: 'الكلمات لها قوة هائلة. يمكنها أن تبني أو تهدم، تشجع أو تحبط. المسيحي مدعو لاستخدام كلماته للبناء والتشجيع. تجنب الكلام الجارح والنميمة والكذب. تعلّم أن تفكر قبل أن تتكلم، واسأل نفسك: هل كلامي يمجد الله؟',
                questions: [
                    { q: 'الكلمات يمكنها أن...', options: ['تبني فقط', 'تهدم فقط', 'تبني وتهدم', 'لا تأثير لها'], correct: 2 },
                    { q: '"الموت والحياة في يد..." ماذا؟', options: ['العقل', 'القلب', 'اللسان', 'اليد'], correct: 2 },
                    { q: 'المسيحي مدعو لاستخدام كلماته لـ...', options: ['النقد', 'البناء والتشجيع', 'النميمة', 'المزاح فقط'], correct: 1 },
                    { q: 'قبل أن أتكلم يجب أن...', options: ['أصرخ', 'أفكر', 'أغضب', 'أتجاهل'], correct: 1 },
                    { q: 'من الأشياء التي يجب تجنبها...', options: ['التشجيع', 'المدح', 'النميمة', 'الابتسامة'], correct: 2 }
                ]
            },
            {
                name: 'إدارة الوقت',
                desc: 'كيف تستثمر وقتك بحكمة لمجد الله',
                verse: '"فانظروا كيف تسلكون بالتدقيق... مفتدين الوقت لأن الأيام شريرة" (أفسس 5:15-16)',
                content: 'الوقت هو أغلى ما نملك ولا يمكن استرجاعه. إدارة الوقت تعني ترتيب أولوياتك: الله أولاً، ثم الدراسة والعمل، ثم الراحة والترفيه. ضع جدولاً يومياً، تجنب المشتتات، وتعلم أن تقول "لا" للأشياء غير المفيدة.',
                questions: [
                    { q: 'الأولوية الأولى في حياة المسيحي هي...', options: ['الدراسة', 'الترفيه', 'الله', 'العمل'], correct: 2 },
                    { q: 'الوقت لا يمكن...', options: ['استثماره', 'استرجاعه', 'تنظيمه', 'تقسيمه'], correct: 1 },
                    { q: '"مفتدين الوقت" تعني...', options: ['شراء الوقت', 'استثمار الوقت بحكمة', 'إضاعة الوقت', 'نسيان الوقت'], correct: 1 },
                    { q: 'لإدارة الوقت يجب أن تضع...', options: ['أحلاماً فقط', 'جدولاً يومياً', 'قيوداً', 'لا شيء'], correct: 1 },
                    { q: 'يجب تجنب...', options: ['التخطيط', 'المشتتات', 'الأهداف', 'الصلاة'], correct: 1 }
                ]
            },
            {
                name: 'القيادة الخادمة',
                desc: 'كيف تكون قائداً على مثال المسيح',
                verse: '"من أراد أن يكون فيكم عظيماً فليكن لكم خادماً" (متى 20:26)',
                content: 'القيادة المسيحية مختلفة عن قيادة العالم. المسيح كان القائد الأعظم لكنه غسل أرجل تلاميذه. القائد الحقيقي يخدم الآخرين، يستمع لهم، يشجعهم، ويكون قدوة. القيادة ليست سلطة بل مسؤولية.',
                questions: [
                    { q: 'القيادة المسيحية أساسها...', options: ['السلطة', 'القوة', 'الخدمة', 'المال'], correct: 2 },
                    { q: 'المسيح غسل أرجل...', options: ['الفريسيين', 'الجموع', 'التلاميذ', 'الكهنة'], correct: 2 },
                    { q: '"من أراد أن يكون عظيماً فليكن..."', options: ['ملكاً', 'غنياً', 'خادماً', 'مشهوراً'], correct: 2 },
                    { q: 'القائد الحقيقي يفعل كل هذا ما عدا...', options: ['يخدم', 'يستمع', 'يتكبر', 'يشجع'], correct: 2 },
                    { q: 'القيادة ليست سلطة بل...', options: ['شهرة', 'مسؤولية', 'راحة', 'امتياز'], correct: 1 }
                ]
            },
            {
                name: 'التعامل مع الضغوط',
                desc: 'كيف تواجه التحديات والمشاكل بإيمان',
                verse: '"في العالم سيكون لكم ضيق ولكن ثقوا أنا قد غلبت العالم" (يوحنا 16:33)',
                content: 'كلنا نواجه ضغوطاً: في الدراسة، مع الأصدقاء، في البيت. المهم هو كيف نتعامل معها. أولاً: صلِّ وألقِ همك على الله. ثانياً: تكلم مع شخص تثق فيه. ثالثاً: لا تستسلم. رابعاً: تذكر أن الله معك في كل ظرف.',
                questions: [
                    { q: 'أول خطوة عند مواجهة الضغوط...', options: ['الهروب', 'الصلاة', 'الغضب', 'العزلة'], correct: 1 },
                    { q: '"ألقِ على الرب همك" تعني...', options: ['انسى مشاكلك', 'سلّم مشاكلك لله', 'لا تهتم', 'اشتكِ'], correct: 1 },
                    { q: 'عند مواجهة مشكلة يجب أن تتكلم مع...', options: ['لا أحد', 'شخص تثق فيه', 'الجميع', 'وسائل التواصل'], correct: 1 },
                    { q: '"أنا قد غلبت العالم" قالها...', options: ['بولس', 'بطرس', 'المسيح', 'داود'], correct: 2 },
                    { q: 'الخطوة الرابعة هي تذكر أن...', options: ['أنت وحدك', 'الله معك', 'لا أمل', 'المشكلة كبيرة'], correct: 1 }
                ]
            },
            {
                name: 'صانع السلام',
                desc: 'كيف تكون صانع سلام في مجتمعك',
                verse: '"طوبى لصانعي السلام لأنهم أبناء الله يُدعون" (متى 5:9)',
                content: 'صانع السلام هو من يسعى لحل الخلافات بدلاً من تصعيدها. يحتاج صبراً وحكمة ومحبة. تعلم أن تستمع للطرفين، لا تنحاز بظلم، وساعد الناس على التصالح. المسيح هو ملك السلام وقد صالحنا مع الله.',
                questions: [
                    { q: 'صانع السلام يسعى لـ...', options: ['تصعيد المشاكل', 'حل الخلافات', 'الانسحاب', 'التجاهل'], correct: 1 },
                    { q: 'صانعو السلام يُدعون...', options: ['أبطالاً', 'حكماء', 'أبناء الله', 'قضاة'], correct: 2 },
                    { q: 'يحتاج صانع السلام إلى...', options: ['قوة بدنية', 'صبر وحكمة ومحبة', 'مال', 'سلطة'], correct: 1 },
                    { q: 'المسيح صالحنا مع...', options: ['أنفسنا', 'العالم', 'الله', 'الطبيعة'], correct: 2 },
                    { q: 'عند حل خلاف يجب أن تستمع لـ...', options: ['طرف واحد', 'الطرفين', 'لا أحد', 'نفسك فقط'], correct: 1 }
                ]
            }
        ]
    },
    ritual: {
        name: 'طقس',
        desc: 'طقوس الكنيسة الأرثوذكسية',
        icon: '⛪',
        color: '#9b59b6',
        lessons: [
            {
                name: 'القداس الإلهي',
                desc: 'رحلة روحية في القداس من البداية للنهاية',
                verse: '"اصنعوا هذا لذكري" (لوقا 22:19)',
                content: 'القداس الإلهي هو أهم صلاة في الكنيسة. يبدأ بتقدمة الحمل ثم صلاة رفع بخور باكر، ثم قراءات الكتاب المقدس، ثم صلاة الصلح، ثم الأنافورا (صلاة الشكر)، وأخيراً التناول. في القداس نتحد بالمسيح ونأكل جسده ونشرب دمه.',
                questions: [
                    { q: 'القداس يبدأ بـ...', options: ['التناول', 'تقدمة الحمل', 'القراءات', 'البخور'], correct: 1 },
                    { q: 'الأنافورا تعني...', options: ['التناول', 'صلاة الشكر', 'البخور', 'القراءات'], correct: 1 },
                    { q: 'في القداس نتناول...', options: ['خبز عادي', 'جسد ودم المسيح', 'ماء مقدس', 'فاكهة'], correct: 1 },
                    { q: '"اصنعوا هذا لذكري" قالها...', options: ['بولس', 'بطرس', 'المسيح', 'موسى'], correct: 2 },
                    { q: 'القداس الإلهي هو أهم...في الكنيسة', options: ['اجتماع', 'صلاة', 'عيد', 'تعليم'], correct: 1 }
                ]
            },
            {
                name: 'المعمودية والميرون',
                desc: 'سر الولادة الجديدة والختم الملوكي',
                verse: '"إن كان أحد لا يولد من الماء والروح لا يقدر أن يدخل ملكوت الله" (يوحنا 3:5)',
                content: 'المعمودية هي الولادة الجديدة بالماء والروح. يُغطس المعمَّد ثلاث مرات باسم الثالوث القدوس. الميرون هو سر حلول الروح القدس على المعمَّد من خلال المسحة بالزيت المقدس (36 رشمة). بالمعمودية نموت مع المسيح ونقوم معه.',
                questions: [
                    { q: 'كم مرة يُغطس المعمَّد؟', options: ['مرة', 'مرتين', 'ثلاث مرات', 'أربع مرات'], correct: 2 },
                    { q: 'كم رشمة في الميرون؟', options: ['12', '24', '36', '40'], correct: 2 },
                    { q: 'المعمودية هي الولادة...', options: ['الطبيعية', 'الجديدة', 'الثالثة', 'المتكررة'], correct: 1 },
                    { q: 'الميرون هو سر حلول...', options: ['الملائكة', 'الروح القدس', 'البركة', 'الشفاء'], correct: 1 },
                    { q: 'بالمعمودية نموت مع المسيح و...', options: ['نبقى أمواتاً', 'نقوم معه', 'نحزن', 'ننتظر'], correct: 1 }
                ]
            },
            {
                name: 'الصوم والصلاة',
                desc: 'أسلحة روحية قوية في حياة المسيحي',
                verse: '"هذا الجنس لا يخرج إلا بالصلاة والصوم" (متى 17:21)',
                content: 'الصوم والصلاة هما جناحا الحياة الروحية. الصوم هو انقطاع عن الطعام لفترة ثم أكل نباتي. أصوام الكنيسة تشمل: الصوم الكبير (55 يوماً)، صوم الرسل، صوم العذراء، وصوم الميلاد. الصلاة هي حديثنا مع الله، نصلي الأجبية (7 صلوات يومية).',
                questions: [
                    { q: 'كم يوماً الصوم الكبير؟', options: ['40', '43', '55', '60'], correct: 2 },
                    { q: 'الأجبية تحتوي على...صلوات يومية', options: ['3', '5', '7', '12'], correct: 2 },
                    { q: 'الصوم يشمل أكل...', options: ['لحوم', 'نباتي', 'أي شيء', 'أسماك فقط'], correct: 1 },
                    { q: 'الصلاة هي...مع الله', options: ['حديثنا', 'صمتنا', 'عملنا', 'نومنا'], correct: 0 },
                    { q: 'من أصوام الكنيسة كل هذه ما عدا...', options: ['الصوم الكبير', 'صوم الرسل', 'صوم العذراء', 'صوم الأحد'], correct: 3 }
                ]
            },
            {
                name: 'الأعياد السيدية',
                desc: 'الأعياد الكبرى في الكنيسة القبطية',
                verse: '"هذا هو اليوم الذي صنعه الرب. نبتهج ونفرح فيه" (مزمور 118:24)',
                content: 'الأعياد السيدية الكبرى سبعة: البشارة، الميلاد، الغطاس، أحد الشعانين، القيامة، الصعود، وحلول الروح القدس (البنطقستي). والأعياد السيدية الصغرى سبعة أيضاً. كل عيد يذكرنا بحدث مهم في حياة المسيح.',
                questions: [
                    { q: 'كم عدد الأعياد السيدية الكبرى؟', options: ['5', '7', '10', '12'], correct: 1 },
                    { q: 'عيد حلول الروح القدس يُسمى أيضاً...', options: ['الغطاس', 'الشعانين', 'البنطقستي', 'النيروز'], correct: 2 },
                    { q: 'أهم عيد مسيحي هو عيد...', options: ['الميلاد', 'القيامة', 'الصعود', 'البشارة'], correct: 1 },
                    { q: 'أحد الشعانين يحتفل بدخول المسيح...', options: ['بيت لحم', 'الهيكل', 'أورشليم', 'مصر'], correct: 2 },
                    { q: 'الأعياد السيدية الصغرى عددها...', options: ['5', '7', '9', '12'], correct: 1 }
                ]
            },
            {
                name: 'التسبحة والألحان',
                desc: 'كنوز الألحان القبطية وأهميتها',
                verse: '"رنموا للرب ترنيمة جديدة" (مزمور 96:1)',
                content: 'الألحان القبطية هي كنز روحي عمره أكثر من 2000 سنة. التسبحة تُرفع كل ليلة في الكنيسة وتتكون من 4 هوسات (تسابيح). الألحان لها 3 أنواع: فرايحي (فرح)، حزايني (حزن)، وشعانيني. الموسيقى القبطية تُعتبر أقدم موسيقى كنسية في العالم.',
                questions: [
                    { q: 'كم هوس في التسبحة؟', options: ['3', '4', '5', '7'], correct: 1 },
                    { q: 'كم نوع من الألحان القبطية؟', options: ['2', '3', '4', '5'], correct: 1 },
                    { q: 'اللحن الفرايحي يعني لحن...', options: ['الحزن', 'الفرح', 'الصمت', 'السرعة'], correct: 1 },
                    { q: 'عمر الألحان القبطية أكثر من...سنة', options: ['500', '1000', '2000', '3000'], correct: 2 },
                    { q: 'التسبحة تُرفع كل...', options: ['صباح', 'ليلة', 'أسبوع', 'شهر'], correct: 1 }
                ]
            },
            {
                name: 'الكنيسة من الداخل',
                desc: 'أجزاء الكنيسة ومعناها الروحي',
                verse: '"بيتي بيت الصلاة يُدعى" (متى 21:13)',
                content: 'الكنيسة القبطية تنقسم إلى 3 أجزاء: الهيكل (قدس الأقداس حيث المذبح)، صحن الكنيسة (حيث يقف الشعب)، والخورس (بين الهيكل والصحن). المذبح يرمز لعرش الله. حامل الأيقونات يفصل الهيكل عن الصحن. الكنيسة دائماً تتجه ناحية الشرق.',
                questions: [
                    { q: 'كم جزءاً في الكنيسة القبطية؟', options: ['2', '3', '4', '5'], correct: 1 },
                    { q: 'أين يوجد المذبح؟', options: ['الصحن', 'الخورس', 'الهيكل', 'الباب'], correct: 2 },
                    { q: 'الكنيسة القبطية تتجه ناحية...', options: ['الشمال', 'الجنوب', 'الشرق', 'الغرب'], correct: 2 },
                    { q: 'الخورس يقع بين...', options: ['الباب والصحن', 'الهيكل والصحن', 'الهيكل والسقف', 'الصحن والباب'], correct: 1 },
                    { q: 'المذبح يرمز لـ...', options: ['الجبل', 'عرش الله', 'البحر', 'السماء'], correct: 1 }
                ]
            }
        ]
    }
};

// --- Level 2 State ---
var level2State = {
    currentSubject: null,
    currentLesson: -1,
    currentStage: 'learn', // learn, quiz, result
    quizIndex: 0,
    quizScore: 0,
    quizAnswers: [],
    timerInterval: null,
    timeLeft: 0,
    answered: false, // prevent double-tap
    isFullscreen: false,
    powerUps: { fiftyFifty: 0, extraTime: 0, skipQ: 0 },
    // Combo & engagement
    combo: 0,
    maxCombo: 0,
    totalPoints: 0,
    speedBonuses: 0,
    // Exam mode (weekly competition)
    examMode: false
};

// --- SOUND EFFECTS (Web Audio) ---
var audioCtx = null;
var audioUnlocked = false;

function initAudio() {
    if (!audioCtx) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch(e) {
            console.log('Web Audio not supported');
            return;
        }
    }
    // Resume suspended context (required by mobile browsers after user gesture)
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().then(function() {
            audioUnlocked = true;
        }).catch(function() {});
    } else if (audioCtx) {
        audioUnlocked = true;
    }
}

// Unlock audio on first touch/click anywhere on page
document.addEventListener('touchstart', function() { initAudio(); }, { once: true });
document.addEventListener('click', function() { initAudio(); }, { once: true });

function playTone(freq, duration, type) {
    if (!audioCtx || audioCtx.state === 'suspended') {
        initAudio();
        return; // Skip this sound, next one will work
    }
    try {
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.type = type || 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch(e) {
        console.log('Audio error:', e);
    }
}

function playCorrectSound() {
    playTone(523, 0.12, 'sine'); // C5
    setTimeout(function() { playTone(659, 0.12, 'sine'); }, 100); // E5
    setTimeout(function() { playTone(784, 0.2, 'sine'); }, 200); // G5
}

function playWrongSound() {
    playTone(250, 0.2, 'sawtooth');
    setTimeout(function() { playTone(180, 0.3, 'sawtooth'); }, 120);
}

function playComboSound(combo) {
    var baseFreq = 500 + (combo * 80);
    playTone(baseFreq, 0.1, 'sine');
    setTimeout(function() { playTone(baseFreq + 150, 0.1, 'sine'); }, 80);
    setTimeout(function() { playTone(baseFreq + 300, 0.15, 'triangle'); }, 160);
    setTimeout(function() { playTone(baseFreq + 450, 0.2, 'sine'); }, 240);
}

function playTickSound() {
    playTone(900, 0.05, 'sine');
}

function playVictorySound() {
    // Triumphant ascending fanfare
    playTone(523, 0.15, 'sine');   // C5
    setTimeout(function() { playTone(659, 0.15, 'sine'); }, 120);  // E5
    setTimeout(function() { playTone(784, 0.15, 'sine'); }, 240);  // G5
    setTimeout(function() { playTone(1047, 0.3, 'sine'); }, 360);  // C6
    setTimeout(function() { playTone(1047, 0.1, 'triangle'); }, 500); // shimmer
    setTimeout(function() { playTone(1319, 0.4, 'sine'); }, 600);  // E6 hold
}

function playMatchStartSound() {
    // Dramatic VS intro - deep impact then rise
    playTone(150, 0.3, 'sawtooth');
    setTimeout(function() { playTone(200, 0.2, 'square'); }, 150);
    setTimeout(function() { playTone(400, 0.15, 'sine'); }, 300);
    setTimeout(function() { playTone(600, 0.2, 'sine'); }, 450);
    setTimeout(function() { playTone(800, 0.25, 'triangle'); }, 600);
}

function playTurnSound() {
    // Quick alert chime
    playTone(700, 0.08, 'sine');
    setTimeout(function() { playTone(900, 0.12, 'sine'); }, 100);
}

function playTimeoutSound() {
    // Descending fail buzz
    playTone(400, 0.15, 'sawtooth');
    setTimeout(function() { playTone(300, 0.15, 'sawtooth'); }, 100);
    setTimeout(function() { playTone(200, 0.3, 'sawtooth'); }, 200);
}

function playCelebrationSound() {
    // Epic winner celebration - multi-layered
    playTone(523, 0.12, 'sine');
    setTimeout(function() { playTone(659, 0.12, 'sine'); }, 100);
    setTimeout(function() { playTone(784, 0.12, 'sine'); }, 200);
    setTimeout(function() { playTone(1047, 0.2, 'sine'); }, 300);
    setTimeout(function() { playTone(784, 0.1, 'triangle'); }, 450);
    setTimeout(function() { playTone(1047, 0.15, 'sine'); }, 550);
    setTimeout(function() { playTone(1319, 0.3, 'sine'); }, 650);
    setTimeout(function() { playTone(1568, 0.4, 'triangle'); }, 800);
}

function playStationUnlockSound() {
    // Magical unlock - sparkle ascend
    playTone(440, 0.1, 'sine');
    setTimeout(function() { playTone(554, 0.1, 'sine'); }, 80);
    setTimeout(function() { playTone(659, 0.1, 'sine'); }, 160);
    setTimeout(function() { playTone(880, 0.15, 'triangle'); }, 240);
    setTimeout(function() { playTone(1109, 0.2, 'sine'); }, 340);
}

function playNavigateSound() {
    // Soft click/pop
    playTone(600, 0.04, 'sine');
    setTimeout(function() { playTone(800, 0.06, 'sine'); }, 40);
}

// --- HAPTIC FEEDBACK ---
function vibrate(pattern) {
    try {
        if (navigator.vibrate) navigator.vibrate(pattern);
    } catch(e) {}
}

// --- ENCOURAGING MESSAGES ---
var ENCOURAGE_CORRECT = [
    'يا بطل! 🔥', 'ماشاء الله عليك! 💪', 'برافو! 🎯', 'صح كده! ✨',
    'أنت جامد! 🌟', 'كمّل يا نجم! ⭐', 'عظمة! 🏆', 'يا معلم! 👑',
    'أسد! 🦁', 'رهيب! 💫', 'خطير! 🔥🔥', 'فين ده من زمان! 💥',
    'مكنش حد يقدر! 🎉', 'كويس أوي! 👏', 'أنت أبطال! ⚡'
];
var ENCOURAGE_WRONG = [
    'المرة الجاية إن شاء الله 💪', 'متقلقش، كمّل! 🌱', 'ركّز يا بطل! 🧠',
    'حاول تاني! 💫', 'قرب تجيبها! 🎯', 'الصح جاي! ✨'
];
var COMBO_MESSAGES = [
    '', '', // 0, 1
    'كومبو! 🔥🔥', // 2
    'رائع! هات كمان! 🔥🔥🔥', // 3
    'FIRE! لا يوقفك حد! 🔥🔥🔥🔥', // 4
    'UNSTOPPABLE! ⚡⚡⚡', // 5+
];

// --- SCORE POPUP ---
function showScorePopup(points, isCombo, comboCount) {
    var popup = document.createElement('div');
    popup.className = 'score-popup';
    if (isCombo && comboCount >= 3) popup.classList.add('score-popup-combo');
    if (comboCount >= 5) popup.classList.add('score-popup-fire');

    var text = '+' + points;
    if (isCombo && comboCount >= 2) {
        text += ' x' + Math.min(comboCount, 5);
    }
    popup.textContent = text;
    document.body.appendChild(popup);
    setTimeout(function() { popup.remove(); }, 1200);
}

// --- COMBO DISPLAY ---
function updateComboDisplay(combo) {
    // Remove existing combo display
    var existing = document.querySelector('.combo-display');
    if (existing) existing.remove();

    if (combo < 2) return;

    var display = document.createElement('div');
    display.className = 'combo-display';
    if (combo >= 5) display.classList.add('combo-fire');
    else if (combo >= 3) display.classList.add('combo-hot');

    var msg = combo >= 5 ? COMBO_MESSAGES[5] : (COMBO_MESSAGES[combo] || '');
    display.innerHTML = '<div class="combo-count">' + combo + 'x</div>' +
        '<div class="combo-label">COMBO</div>' +
        (msg ? '<div class="combo-msg">' + msg + '</div>' : '');

    document.body.appendChild(display);
    setTimeout(function() { display.remove(); }, 2000);
}

// --- ENCOURAGING MESSAGE POPUP ---
function showEncourageMsg(isCorrect) {
    var msgs = isCorrect ? ENCOURAGE_CORRECT : ENCOURAGE_WRONG;
    var msg = msgs[Math.floor(Math.random() * msgs.length)];
    var el = document.createElement('div');
    el.className = 'encourage-msg ' + (isCorrect ? 'encourage-correct' : 'encourage-wrong');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function() { el.remove(); }, 1800);
}

// Power-ups system
var POWER_UPS = {
    fiftyFifty: { name: 'حذف إجابتين ❌❌', icon: 'fa-scissors', cost: 5, desc: 'احذف إجابتين غلط' },
    extraTime:  { name: 'وقت إضافي ⏰', icon: 'fa-hourglass-half', cost: 3, desc: '+15 ثانية وقت إضافي' },
    skipQ:      { name: 'تخطي سؤال ⏭️', icon: 'fa-forward', cost: 8, desc: 'تخطي السؤال وخد الإجابة الصح' }
};

// Add level2 data to GameState
if (!GameState.level2Data) {
    GameState.level2Data = {};
}

// --- Home Hub Render ---
function renderHomeHub() {
    var ch = CHARACTERS[GameState.character];
    var avatarImg = document.getElementById('hub-avatar-img');
    if (avatarImg && ch) { avatarImg.src = ch.image; }
    var nameEl = document.getElementById('hub-player-name');
    if (nameEl) nameEl.textContent = GameState.playerName;
    var rankEl = document.getElementById('hub-rank');
    var rank = getRank();
    // Show equipped title if any, otherwise rank
    var displayTitle = rank.emoji + ' ' + rank.title;
    if (GameState.equippedTitle && PLAYER_TITLES[GameState.equippedTitle]) {
        displayTitle = PLAYER_TITLES[GameState.equippedTitle].name;
    }
    if (rankEl) { rankEl.textContent = displayTitle; }

    // Apply equipped frame to hub avatar
    var hubAvatarWrap = document.querySelector('.hub-avatar-wrap');
    if (hubAvatarWrap) {
        hubAvatarWrap.className = 'hub-avatar-wrap';
        if (GameState.equippedFrame && PROFILE_FRAMES[GameState.equippedFrame]) {
            var fr = PROFILE_FRAMES[GameState.equippedFrame];
            hubAvatarWrap.style.border = fr.borderStyle;
            hubAvatarWrap.style.boxShadow = fr.shadow;
            hubAvatarWrap.classList.add('frame-equipped');
        } else {
            hubAvatarWrap.style.border = '';
            hubAvatarWrap.style.boxShadow = '';
        }
        // Gold tier glow
        var charTier = getCharacterTier(GameState.character);
        if (charTier === 'gold') hubAvatarWrap.classList.add('char-avatar-gold');
    }
    var starsEl = document.getElementById('hub-stars');
    if (starsEl) starsEl.textContent = GameState.stars;
    var gemsEl = document.getElementById('hub-gems');
    if (gemsEl) gemsEl.textContent = GameState.gems;

    // Team badge in hub
    updateHubTeamBadge();

    // Check daily login gems bonus
    checkDailyLoginXP();

    // Render daily verse card
    renderTodayVerse();

    // Daily streak
    var streakWrap = document.getElementById('hub-streak-section');
    if (!streakWrap) {
        streakWrap = document.createElement('div');
        streakWrap.id = 'hub-streak-section';
        streakWrap.className = 'hub-streak-section';
        var xpBar = document.getElementById('hub-xp-bar-wrap');
        if (xpBar && xpBar.parentNode) {
            xpBar.parentNode.insertBefore(streakWrap, xpBar.nextSibling);
        }
    }
    if (streakWrap) {
        var streak = calculateLoginStreak();
        streakWrap.innerHTML = '<div class="streak-flame">' + (streak > 0 ? '🔥' : '❄️') + '</div>' +
            '<div class="streak-info"><div class="streak-count">' + streak + '</div><div class="streak-label">يوم متواصل</div></div>' +
            '<div style="flex:1"></div>' +
            '<div style="text-align:center"><div style="font-size:20px">' + rank.emoji + '</div><div class="streak-label">' + rank.title + '</div></div>';
    }
}

function calculateLoginStreak() {
    var streak = 0;
    var today = new Date();
    for (var d = 0; d < 365; d++) {
        var checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - d);
        var dateStr = checkDate.toISOString().split('T')[0];
        var hasActivity = (GameState.bibleReadingLog && GameState.bibleReadingLog[dateStr]) ||
                         (GameState.devotionLog && GameState.devotionLog[dateStr]) ||
                         (GameState.exerciseLog && GameState.exerciseLog[dateStr]);
        if (hasActivity || d === 0) {
            streak++;
        } else {
            break;
        }
    }
    return Math.max(streak - 1, 0); // Don't count today unless they did something
}

// --- Achievement Popup System ---
function showAchievement(icon, title, desc) {
    var existing = document.querySelector('.achievement-popup');
    if (existing) existing.remove();

    var popup = document.createElement('div');
    popup.className = 'achievement-popup';
    popup.innerHTML = '<div class="achievement-popup-icon">' + icon + '</div>' +
        '<div class="achievement-popup-text"><h4>إنجاز جديد!</h4><p>' + title + '</p><small>' + (desc || '') + '</small></div>';
    document.body.appendChild(popup);

    setTimeout(function() { popup.classList.add('show'); }, 50);
    setTimeout(function() {
        popup.classList.remove('show');
        setTimeout(function() { popup.remove(); }, 600);
    }, 3500);

    // Play achievement sound
    try { playSound('correct'); } catch(e) {}
}

// --- Celebration Banner ---
function showCelebration(icon, msg, color) {
    var existing = document.querySelector('.celebration-banner');
    if (existing) existing.remove();

    var banner = document.createElement('div');
    banner.className = 'celebration-banner';
    banner.innerHTML =
        '<div class="cel-icon">' + icon + '</div>' +
        '<div class="cel-msg" style="color:' + (color || '#FDCB6E') + '">' + msg + '</div>';
    document.body.appendChild(banner);

    requestAnimationFrame(function() { banner.classList.add('show'); });
    setTimeout(function() {
        banner.classList.remove('show');
        setTimeout(function() { banner.remove(); }, 600);
    }, 2800);
}

// --- Floating Reward Popup ---
function showFloatingReward(text) {
    var el = document.createElement('div');
    el.className = 'floating-reward';
    el.textContent = text;
    // Position near top-center
    el.style.left = '50%';
    el.style.top = '80px';
    document.body.appendChild(el);
    requestAnimationFrame(function() { el.classList.add('show'); });
    setTimeout(function() { el.remove(); }, 1400);
}

// --- Confetti System ---
function launchConfetti(duration) {
    var container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);

    var colors = ['#6C5CE7', '#00CEC9', '#FDCB6E', '#FD79A8', '#00B894', '#FF6B6B', '#a29bfe', '#74b9ff'];
    var shapes = ['■', '●', '▲', '★', '♦', '✝'];
    var count = 60;

    for (var i = 0; i < count; i++) {
        (function(idx) {
            setTimeout(function() {
                var piece = document.createElement('div');
                piece.className = 'confetti-piece';
                piece.style.left = Math.random() * 100 + '%';
                piece.style.animationDuration = (2 + Math.random() * 2) + 's';
                piece.style.animationDelay = (Math.random() * 0.5) + 's';
                piece.style.fontSize = (10 + Math.random() * 14) + 'px';
                piece.style.color = colors[Math.floor(Math.random() * colors.length)];
                piece.textContent = shapes[Math.floor(Math.random() * shapes.length)];
                container.appendChild(piece);
            }, idx * 30);
        })(i);
    }

    setTimeout(function() { container.remove(); }, (duration || 3000) + 1000);
}

// --- Answer Feedback Overlay ---
function showAnswerFeedback(isCorrect) {
    var existing = document.querySelector('.answer-feedback-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.className = 'answer-feedback-overlay ' + (isCorrect ? 'correct' : 'wrong');
    overlay.innerHTML = isCorrect
        ? '<div class="af-icon">✅</div><div class="af-text">صح! برافو 🎉</div>'
        : '<div class="af-icon">❌</div><div class="af-text">غلط! حاول تاني 💪</div>';
    document.body.appendChild(overlay);

    requestAnimationFrame(function() { overlay.classList.add('show'); });
    setTimeout(function() {
        overlay.classList.remove('show');
        setTimeout(function() { overlay.remove(); }, 400);
    }, 800);
}

// --- Level 2 Subjects Render ---
function renderLevel2Subjects() {
    var totalStars = 0;
    var subjects = ['faith', 'bible', 'life', 'ritual'];
    subjects.forEach(function(subKey) {
        var completed = 0;
        var subjectData = (GameState.level2Data && GameState.level2Data[subKey]) || {};
        for (var i = 0; i < 6; i++) {
            var lessonData = subjectData['lesson_' + i];
            if (lessonData && lessonData.stars > 0) {
                completed++;
                totalStars += lessonData.stars;
            }
        }
        var progressFill = document.getElementById('l2-progress-' + subKey);
        var progressText = document.getElementById('l2-progress-' + subKey + '-text');
        if (progressFill) progressFill.style.width = (completed / 6 * 100) + '%';
        if (progressText) progressText.textContent = completed + '/6';
    });
    var totalStarsEl = document.getElementById('l2-total-stars');
    if (totalStarsEl) totalStarsEl.textContent = totalStars;

    // Render exam subjects grid
    renderExamSubjectsGrid();
}

var pendingExamSubject = null;

function renderExamSubjectsGrid() {
    var grid = document.getElementById('l2-exam-subjects-grid');
    if (!grid) return;

    var weekKey = getWeekKey();
    var subjectNames = {
        faith: { name: 'عقيدة ولاهوت', icon: '✝️' },
        bible: { name: 'كتاب مقدس', icon: '📖' },
        life: { name: 'مهارات الحياة والقياده', icon: '🌟' },
        ritual: { name: 'طقس', icon: '⛪' }
    };

    var html = '';
    ['faith', 'bible', 'life', 'ritual'].forEach(function(subKey) {
        var sub = subjectNames[subKey];
        // Check if exam taken this week
        var examKey = 'subjectExam_' + subKey + '_' + weekKey;
        var examTaken = GameState.level2Data && GameState.level2Data[examKey];

        // Check if has any completed lessons
        var hasLessons = false;
        var subjectData = (GameState.level2Data && GameState.level2Data[subKey]) || {};
        for (var i = 0; i < 6; i++) {
            if (subjectData['lesson_' + i] && subjectData['lesson_' + i].stars > 0) {
                hasLessons = true;
                break;
            }
        }

        if (examTaken) {
            html += '<div class="l2-exam-subject-item done">';
            html += '<span>' + sub.icon + ' ' + sub.name + '</span>';
            html += '<span class="l2-exam-subject-badge done"><i class="fas fa-check-circle"></i> ' + examTaken.stars + '/30</span>';
            html += '</div>';
        } else if (hasLessons) {
            html += '<div class="l2-exam-subject-item available" onclick="showExamRules(\'' + subKey + '\')">';
            html += '<span>' + sub.icon + ' ' + sub.name + '</span>';
            html += '<span class="l2-exam-subject-badge available"><i class="fas fa-scroll"></i> امتحن</span>';
            html += '</div>';
        } else {
            html += '<div class="l2-exam-subject-item locked">';
            html += '<span>' + sub.icon + ' ' + sub.name + '</span>';
            html += '<span class="l2-exam-subject-badge locked"><i class="fas fa-lock"></i></span>';
            html += '</div>';
        }
    });
    grid.innerHTML = html;
}

function showExamRules(subKey) {
    pendingExamSubject = subKey;
    var subjectNames = {
        faith: 'عقيدة ولاهوت ✝️',
        bible: 'كتاب مقدس 📖',
        life: 'مهارات الحياة والقياده 🌟',
        ritual: 'طقس ⛪'
    };
    var nameEl = document.getElementById('exam-rules-subject-name');
    if (nameEl) nameEl.textContent = 'مادة: ' + (subjectNames[subKey] || subKey);
    document.getElementById('exam-rules-modal').style.display = 'flex';
}

function closeExamRules() {
    document.getElementById('exam-rules-modal').style.display = 'none';
    pendingExamSubject = null;
}

function confirmStartSubjectExam() {
    if (!pendingExamSubject) return;
    closeExamRules();

    var subKey = pendingExamSubject;
    var subject = LEVEL2_SUBJECTS[subKey];
    if (!subject) return;

    var weekKey = getWeekKey();
    var examKey = 'subjectExam_' + subKey + '_' + weekKey;

    // Check already taken
    if (GameState.level2Data && GameState.level2Data[examKey]) {
        showToast('الامتحان ده اتعمل الأسبوع ده!', 'error');
        return;
    }

    // Collect all questions from all lessons in this subject
    var allQs = [];
    subject.lessons.forEach(function(lesson, lIdx) {
        lesson.questions.forEach(function(q) {
            allQs.push({ q: q.q, options: q.options, correct: q.correct, explanation: q.explanation, lessonName: lesson.name });
        });
    });

    // Shuffle and pick 20
    for (var i = allQs.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = allQs[i];
        allQs[i] = allQs[j];
        allQs[j] = temp;
    }

    level2State.currentSubject = subKey;
    level2State.currentLesson = -1; // subject-level exam
    level2State.currentStage = 'quiz';
    level2State.quizIndex = 0;
    level2State.quizScore = 0;
    level2State.quizAnswers = [];
    level2State.combo = 0;
    level2State.maxCombo = 0;
    level2State.totalPoints = 0;
    level2State.speedBonuses = 0;
    level2State.examMode = true;
    level2State.subjectExamKey = examKey;
    level2State.activeQuestions = allQs.slice(0, 20);
    level2State.answered = false;

    initAudio();
    showScreen('level2-lesson-screen');
    renderLevel2Lesson();
}

// Override exam beforeunload warning
window.addEventListener('beforeunload', function(e) {
    if (level2State.examMode && level2State.currentStage === 'quiz') {
        e.preventDefault();
        e.returnValue = 'الامتحان شغال - لو قفلت هيتلغي!';
        return e.returnValue;
    }
});

// --- Open Subject Map ---
function openLevel2Subject(subjectKey) {
    level2State.currentSubject = subjectKey;
    showScreen('level2-map-screen');
    // Force landscape hint
    enterMapLandscape();
}

// --- Landscape & Fullscreen for Map ---
function enterMapLandscape() {
    document.body.classList.add('landscape-map-mode');
    // Try to lock orientation to landscape
    try {
        if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(function(){});
        }
    } catch(e) {}
    // Auto-enter fullscreen
    try {
        var el = document.documentElement;
        if (el.requestFullscreen) el.requestFullscreen().catch(function(){});
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        level2State.isFullscreen = true;
    } catch(e) {}
}

function exitMapLandscape() {
    document.body.classList.remove('landscape-map-mode');
    try {
        if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
    } catch(e) {}
    try {
        if (document.exitFullscreen && document.fullscreenElement) document.exitFullscreen().catch(function(){});
        else if (document.webkitExitFullscreen && document.webkitFullscreenElement) document.webkitExitFullscreen();
        level2State.isFullscreen = false;
    } catch(e) {}
}

function toggleMapFullscreen() {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        level2State.isFullscreen = false;
    } else {
        var el = document.documentElement;
        if (el.requestFullscreen) el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        level2State.isFullscreen = true;
    }
}

// --- Confetti / Celebration Effects ---
function showCorrectCelebration() {
    // Create confetti burst container
    var container = document.createElement('div');
    container.className = 'celebration-container';
    document.body.appendChild(container);

    // Confetti pieces burst from center
    var colors = ['#FFD700', '#00B894', '#6C5CE7', '#FD79A8', '#00CEC9', '#FFEAA7', '#E17055', '#A29BFE'];
    for (var i = 0; i < 40; i++) {
        var confetti = document.createElement('div');
        confetti.className = 'confetti-piece';
        confetti.style.left = (35 + Math.random() * 30) + '%';
        confetti.style.top = (30 + Math.random() * 20) + '%';
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = (Math.random() * 0.3) + 's';
        confetti.style.animationDuration = (0.6 + Math.random() * 0.8) + 's';
        // Random directions
        var angle = Math.random() * 360;
        var dist = 80 + Math.random() * 150;
        confetti.style.setProperty('--tx', Math.cos(angle * Math.PI / 180) * dist + 'px');
        confetti.style.setProperty('--ty', Math.sin(angle * Math.PI / 180) * dist + 'px');
        confetti.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
        container.appendChild(confetti);
    }

    // Flying emojis 🎉✨🌟💫⭐🎊
    var emojis = ['🎉', '✨', '🌟', '💫', '⭐', '🎊', '🔥', '💪', '👏'];
    for (var e = 0; e < 8; e++) {
        var emoji = document.createElement('div');
        emoji.className = 'flying-emoji';
        emoji.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        emoji.style.left = (20 + Math.random() * 60) + '%';
        emoji.style.animationDelay = (Math.random() * 0.5) + 's';
        emoji.style.setProperty('--drift', (Math.random() * 100 - 50) + 'px');
        container.appendChild(emoji);
    }

    // Sparkle ring burst
    var ring = document.createElement('div');
    ring.className = 'sparkle-ring';
    container.appendChild(ring);

    // Show big checkmark with glow
    var check = document.createElement('div');
    check.className = 'answer-feedback correct-feedback';
    check.innerHTML = '<i class="fas fa-check-circle"></i><span>صح! 🎉</span>';
    document.body.appendChild(check);

    setTimeout(function() {
        container.remove();
        check.remove();
    }, 1800);
}

function showWrongFeedback() {
    // Shake the quiz container
    var qContainer = document.querySelector('.l2-quiz-container');
    if (qContainer) {
        qContainer.classList.add('shake-animation');
        setTimeout(function() { qContainer.classList.remove('shake-animation'); }, 600);
    }

    // Red flash overlay
    var flash = document.createElement('div');
    flash.className = 'wrong-flash-overlay';
    document.body.appendChild(flash);

    // Show X feedback with sad emojis
    var x = document.createElement('div');
    x.className = 'answer-feedback wrong-feedback';
    x.innerHTML = '<i class="fas fa-times-circle"></i><span>غلط 😔</span>';
    document.body.appendChild(x);

    // Falling sad emojis
    var container = document.createElement('div');
    container.className = 'celebration-container';
    document.body.appendChild(container);
    var sadEmojis = ['😔', '😢', '💔', '😞'];
    for (var i = 0; i < 4; i++) {
        var emoji = document.createElement('div');
        emoji.className = 'falling-sad-emoji';
        emoji.textContent = sadEmojis[i % sadEmojis.length];
        emoji.style.left = (20 + Math.random() * 60) + '%';
        emoji.style.animationDelay = (Math.random() * 0.3) + 's';
        container.appendChild(emoji);
    }

    setTimeout(function() {
        x.remove();
        flash.remove();
        container.remove();
    }, 1500);
}

// --- Power-Up Functions ---
function usePowerUp(type) {
    if (level2State.answered) return;

    if (type === 'fiftyFifty') {
        if (GameState.stars < POWER_UPS.fiftyFifty.cost) {
            showToast('محتاج ' + POWER_UPS.fiftyFifty.cost + ' نجوم! ⭐', 'warning');
            return;
        }
        var q = (level2State.activeQuestions || LEVEL2_SUBJECTS[level2State.currentSubject].lessons[level2State.currentLesson].questions)[level2State.quizIndex];
        var wrongOptions = [];
        for (var i = 0; i < q.options.length; i++) {
            if (i !== q.correct) wrongOptions.push(i);
        }
        // Shuffle and pick 2 to hide
        wrongOptions.sort(function() { return Math.random() - 0.5; });
        var toHide = wrongOptions.slice(0, 2);
        var btns = document.querySelectorAll('.l2-quiz-option');
        toHide.forEach(function(idx) {
            if (btns[idx]) {
                btns[idx].style.opacity = '0.2';
                btns[idx].style.pointerEvents = 'none';
                btns[idx].style.textDecoration = 'line-through';
            }
        });
        GameState.stars -= POWER_UPS.fiftyFifty.cost;
        saveToCloud();
        showToast('تم حذف إجابتين! ✂️', 'success');
        // Disable the button
        var btn = document.querySelector('.powerup-btn[data-type="fiftyFifty"]');
        if (btn) { btn.disabled = true; btn.style.opacity = '0.3'; }
    }

    if (type === 'extraTime') {
        if (GameState.stars < POWER_UPS.extraTime.cost) {
            showToast('محتاج ' + POWER_UPS.extraTime.cost + ' نجوم! ⭐', 'warning');
            return;
        }
        level2State.timeLeft += 15;
        GameState.stars -= POWER_UPS.extraTime.cost;
        saveToCloud();
        showToast('+15 ثانية! ⏰', 'success');
        var btn = document.querySelector('.powerup-btn[data-type="extraTime"]');
        if (btn) { btn.disabled = true; btn.style.opacity = '0.3'; }
    }

    if (type === 'skipQ') {
        if (GameState.stars < POWER_UPS.skipQ.cost) {
            showToast('محتاج ' + POWER_UPS.skipQ.cost + ' نجوم! ⭐', 'warning');
            return;
        }
        GameState.stars -= POWER_UPS.skipQ.cost;
        level2State.quizScore++;
        level2State.quizAnswers.push(true);
        level2State.answered = true;
        if (level2State.timerInterval) clearInterval(level2State.timerInterval);
        saveToCloud();
        showCorrectCelebration();
        // Highlight correct answer
        var q = (level2State.activeQuestions || LEVEL2_SUBJECTS[level2State.currentSubject].lessons[level2State.currentLesson].questions)[level2State.quizIndex];
        var btns = document.querySelectorAll('.l2-quiz-option');
        btns.forEach(function(opt, idx) {
            opt.classList.add('disabled');
            if (idx === q.correct) opt.classList.add('correct');
        });
        showToast('تم تخطي السؤال! ⏭️', 'success');
        setTimeout(function() {
            level2State.quizIndex++;
            level2State.answered = false;
            renderLevel2Lesson();
        }, 1200);
    }
}

// --- Level 2 Map Render ---
// Node positions on the faith map image (% from top-left)
// Mapped to the numbered stations in level2-full-bg.png
// Center coordinates (%) matching numbered markers in level2-map-new-opt.jpg
// Using transform:translate(-50%,-50%) on nodes so these are exact centers
var FAITH_MAP_POSITIONS = [
    { left: 12, top: 42 },  // 1. الثالوث القدوس  — upper-left sun/trinity marker
    { left: 16, top: 70 },  // 2. التجسد          — lower-left manger scene
    { left: 38, top: 74 },  // 3. الفداء           — center-bottom cross
    { left: 53, top: 22 },  // 4. المجيء الثاني    — upper-center clouds/Jesus
    { left: 67, top: 63 },  // 5. المعمودية والميرون — right-center baptism
    { left: 84, top: 52 }   // 6. التوبة والاعتراف  — far-right bishop scene
];

function renderLevel2Map() {
    var subKey = level2State.currentSubject;
    if (!subKey || !LEVEL2_SUBJECTS[subKey]) return;
    var subject = LEVEL2_SUBJECTS[subKey];
    var subjectData = (GameState.level2Data && GameState.level2Data[subKey]) || {};

    // Update header
    var iconEl = document.getElementById('l2-map-subject-icon');
    var nameEl = document.getElementById('l2-map-subject-name');
    if (iconEl) iconEl.textContent = subject.icon;
    if (nameEl) nameEl.textContent = subject.name;

    // Calculate stars and determine current station position
    var earnedStars = 0;
    var currentStation = 0; // Where the character should stand
    for (var s = 0; s < subject.lessons.length; s++) {
        var ld = subjectData['lesson_' + s];
        var smKey = subKey + '_' + s;
        var hasSm = GameState.lessonSummaries && GameState.lessonSummaries[smKey];
        var hasQz = ld && ld.stars > 0;
        if (ld && ld.stars > 0) {
            earnedStars += ld.stars;
        }
        if (hasSm && hasQz) {
            currentStation = s + 1; // Move past fully completed stations
        }
    }
    if (currentStation >= subject.lessons.length) currentStation = subject.lessons.length - 1;

    var earnedEl = document.getElementById('l2-map-stars-earned');
    var totalEl = document.getElementById('l2-map-stars-total');
    if (earnedEl) earnedEl.textContent = earnedStars;
    if (totalEl) totalEl.textContent = subject.lessons.length * 3;

    // Check if subject has a map image
    if (subject.mapImage) {
        renderLevel2ImageMap(subject, subjectData, currentStation);
    } else {
        renderLevel2ListMap(subject, subjectData);
    }
}

function renderLevel2ImageMap(subject, subjectData, currentStation) {
    // Show image map, hide list map
    var imgContainer = document.getElementById('l2-imgmap-container');
    var listContainer = document.getElementById('l2-map-container');
    if (imgContainer) imgContainer.style.display = 'block';
    if (listContainer) listContainer.style.display = 'none';

    // Set background image with loading indicator
    var bgImg = document.getElementById('l2-imgmap-bg');
    if (bgImg) {
        // Show loading state
        if (!bgImg.src || !bgImg.src.includes(subject.mapImage)) {
            imgContainer.classList.add('l2-imgmap-loading');
            bgImg.onload = function() {
                imgContainer.classList.remove('l2-imgmap-loading');
            };
            bgImg.onerror = function() {
                imgContainer.classList.remove('l2-imgmap-loading');
                showToast('خطأ في تحميل الخريطة - تأكد من الاتصال بالإنترنت', 'error');
            };
        }
        bgImg.src = subject.mapImage;
    }

    // Set character avatar
    var avatarImg = document.getElementById('l2-imgmap-avatar-img');
    var ch = CHARACTERS[GameState.character];
    if (avatarImg && ch) avatarImg.src = ch.image;

    // Position character at current station
    var positions = FAITH_MAP_POSITIONS;
    var avatar = document.getElementById('l2-imgmap-avatar');
    if (avatar && positions[currentStation]) {
        avatar.style.left = (positions[currentStation].left - 2) + '%';
        avatar.style.top = (positions[currentStation].top - 10) + '%';
    }

    // Render nodes
    var nodesContainer = document.getElementById('l2-imgmap-nodes');
    nodesContainer.innerHTML = '';

    for (var i = 0; i < subject.lessons.length; i++) {
        var lesson = subject.lessons[i];
        var lessonData = subjectData['lesson_' + i] || {};
        var stars = lessonData.stars || 0;

        // Station scoring: use stationScores (max 80)
        var stationKey = level2State.currentSubject + '_' + i;
        var stScore = getStationScore(stationKey);
        var summaryKey = stationKey;
        var hasSummary = GameState.lessonSummaries && GameState.lessonSummaries[summaryKey];
        var hasQuizScore = stScore.games > 0;
        var isCompleted = stScore.total >= STATION_UNLOCK_THRESHOLD;

        // Only station 1 is available for now; all others are locked
        var isAvailable = (i === 0);

        var stateClass = isCompleted ? 'l2-imgmap-node-completed' : (isAvailable ? 'l2-imgmap-node-available' : 'l2-imgmap-node-locked');
        var hasExam = GameState.level2Data && GameState.level2Data[level2State.currentSubject] &&
            GameState.level2Data[level2State.currentSubject]['exam_' + i];

        var node = document.createElement('div');
        node.className = 'l2-imgmap-node ' + stateClass;
        node.style.left = positions[i].left + '%';
        node.style.top = positions[i].top + '%';

        var circleContent = isCompleted ? '<i class="fas fa-check"></i>' : (i + 1);
        // Show station score / max
        var starsHTML = '<div class="l2-imgmap-node-stars">';
        var scoreColor = stScore.total >= STATION_UNLOCK_THRESHOLD ? '#00B894' : (stScore.total > 0 ? '#FDCB6E' : '');
        starsHTML += '<span class="node-star-count ' + (stScore.total > 0 ? '' : 'dim') + '" style="' + (scoreColor ? 'color:'+scoreColor : '') + '">' + stScore.total + '/' + STATION_MAX_SCORE + '</span>';
        // Show progress badges (sermon + summary + games)
        if (isAvailable || isCompleted) {
            var progressIcons = '';
            progressIcons += '<span class="node-progress-dot ' + (stScore.sermon > 0 ? 'done' : '') + '" title="وعظة">🎬</span>';
            progressIcons += '<span class="node-progress-dot ' + (hasSummary ? 'done' : '') + '" title="تلخيص">📝</span>';
            progressIcons += '<span class="node-progress-dot ' + (hasQuizScore ? 'done' : '') + '" title="ألعاب">🎮</span>';
            starsHTML += '<div class="node-progress-row">' + progressIcons + '</div>';
        }
        // Show unlock requirement for locked stations
        if (!isAvailable && !isCompleted) {
            starsHTML += '<div class="node-unlock-req"><i class="fas fa-lock"></i> جيب ' + STATION_UNLOCK_THRESHOLD + '+ من المحطة السابقة</div>';
        }
        starsHTML += '</div>';

        var tooltipHTML = '<div class="l2-imgmap-tooltip">' + lesson.name + '</div>';
        if (hasExam) {
            tooltipHTML += '<div class="l2-imgmap-exam-badge"><i class="fas fa-scroll"></i></div>';
        }

        node.innerHTML = circleContent + starsHTML + tooltipHTML;

        if (isAvailable || isCompleted) {
            (function(idx) {
                node.onclick = function() {
                    playNavigateSound();
                    animateCharacterToNode(idx, positions, function() {
                        startLevel2Lesson(idx);
                    });
                };
            })(i);
        } else {
            node.onclick = function() { playWrongSound(); showToast('أكمل الدرس السابق الأول! 🔒', 'warning'); };
        }

        nodesContainer.appendChild(node);
    }
}

// --- Animate character walking node-by-node ---
function animateCharacterToNode(targetIdx, positions, callback) {
    var av = document.getElementById('l2-imgmap-avatar');
    if (!av || !positions[targetIdx]) { callback(); return; }

    // Find current position of avatar
    var currentLeft = parseFloat(av.style.left) || 0;
    var currentTop = parseFloat(av.style.top) || 0;

    // Find which node we're closest to
    var startIdx = 0;
    var minDist = Infinity;
    for (var i = 0; i < positions.length; i++) {
        var dl = (positions[i].left - 2) - currentLeft;
        var dt = (positions[i].top - 10) - currentTop;
        var dist = Math.sqrt(dl * dl + dt * dt);
        if (dist < minDist) { minDist = dist; startIdx = i; }
    }

    if (startIdx === targetIdx) {
        // Already there, just bounce and go
        av.classList.add('avatar-arrive');
        setTimeout(function() { av.classList.remove('avatar-arrive'); callback(); }, 500);
        return;
    }

    // Build path of nodes to walk through
    var path = [];
    var step = startIdx < targetIdx ? 1 : -1;
    for (var n = startIdx + step; step > 0 ? n <= targetIdx : n >= targetIdx; n += step) {
        path.push(n);
    }

    // Walk each step with animation
    var stepTime = 600; // ms per step
    av.classList.add('avatar-walking');
    av.style.transition = 'left ' + (stepTime / 1000) + 's ease-in-out, top ' + (stepTime / 1000) + 's ease-in-out';

    function walkStep(stepIdx) {
        if (stepIdx >= path.length) {
            av.classList.remove('avatar-walking');
            av.classList.add('avatar-arrive');
            av.style.transition = 'left 1s ease-in-out, top 1s ease-in-out';
            setTimeout(function() { av.classList.remove('avatar-arrive'); callback(); }, 400);
            return;
        }
        var nodeIdx = path[stepIdx];
        av.style.left = (positions[nodeIdx].left - 2) + '%';
        av.style.top = (positions[nodeIdx].top - 10) + '%';

        // Highlight passed node
        var nodeEl = document.querySelectorAll('.l2-imgmap-node')[nodeIdx];
        if (nodeEl) nodeEl.classList.add('node-passed');

        setTimeout(function() { walkStep(stepIdx + 1); }, stepTime);
    }
    walkStep(0);
}

function renderLevel2ListMap(subject, subjectData) {
    // Show list map, hide image map
    var imgContainer = document.getElementById('l2-imgmap-container');
    var listContainer = document.getElementById('l2-map-container');
    if (imgContainer) imgContainer.style.display = 'none';
    if (listContainer) listContainer.style.display = 'block';

    var container = document.getElementById('l2-map-path');
    container.innerHTML = '';

    for (var i = 0; i < subject.lessons.length; i++) {
        var lesson = subject.lessons[i];
        var lessonData = subjectData['lesson_' + i] || {};
        var stars = lessonData.stars || 0;

        // Station completion requires: summary + quiz
        var lmSummaryKey = level2State.currentSubject + '_' + i;
        var lmHasSummary = GameState.lessonSummaries && GameState.lessonSummaries[lmSummaryKey];
        var lmHasQuiz = stars > 0;
        var isCompleted = lmHasSummary && lmHasQuiz;

        var isAvailable = (i === 0);
        if (i > 0) {
            var prevSmKey = level2State.currentSubject + '_' + (i - 1);
            var prevSmDone = GameState.lessonSummaries && GameState.lessonSummaries[prevSmKey];
            var prevData = subjectData['lesson_' + (i - 1)] || {};
            var prevQzDone = (prevData.stars || 0) > 0;
            isAvailable = prevSmDone && prevQzDone;
        }

        var stateClass = isCompleted ? 'l2-map-node-completed' : (isAvailable ? 'l2-map-node-available' : 'l2-map-node-locked');

        if (i > 0) {
            var connector = document.createElement('div');
            connector.className = 'l2-map-connector' + (isCompleted || isAvailable ? ' active' : '');
            container.appendChild(connector);
        }

        var node = document.createElement('div');
        node.className = 'l2-map-node ' + stateClass;

        var circleContent = isCompleted ? '<i class="fas fa-check"></i>' : (i + 1);
        var starsHTML = '';
        for (var st = 0; st < 3; st++) {
            starsHTML += '<i class="fas fa-star ' + (st < stars ? 'earned' : '') + '"></i>';
        }

        var lockHTML = '';
        if (!isAvailable && !isCompleted) {
            lockHTML = '<div class="l2-node-lock"><i class="fas fa-lock"></i></div>';
        }

        node.innerHTML = '<div class="l2-node-circle" style="border-color: ' + (isCompleted ? 'var(--success)' : (isAvailable ? subject.color : 'var(--border)')) + '">' +
            circleContent + lockHTML + '</div>' +
            '<div class="l2-node-info"><h4>' + lesson.name + '</h4>' +
            '<p>' + lesson.desc + '</p>' +
            '<div class="l2-node-stars">' + starsHTML + '</div></div>';

        if (isAvailable || isCompleted) {
            (function(idx) {
                node.onclick = function() { startLevel2Lesson(idx); };
            })(i);
        } else {
            node.onclick = function() { showToast('أكمل الدرس السابق الأول! 🔒', 'warning'); };
        }

        container.appendChild(node);
    }
}

// --- Start Level 2 Lesson ---
function startLevel2Lesson(lessonIdx) {
    var subKey = level2State.currentSubject;
    var subject = LEVEL2_SUBJECTS[subKey];
    if (!subject || !subject.lessons[lessonIdx]) return;

    level2State.currentLesson = lessonIdx;
    level2State.currentStage = 'learn';
    level2State.quizIndex = 0;
    level2State.quizScore = 0;
    level2State.quizAnswers = [];

    showScreen('level2-lesson-screen');
    renderLevel2Lesson();
}

// --- Render Level 2 Lesson ---
function renderLevel2Lesson() {
    var subKey = level2State.currentSubject;
    var subject = LEVEL2_SUBJECTS[subKey];
    // Handle subject-level exam (currentLesson = -1)
    var lesson;
    if (level2State.currentLesson >= 0) {
        lesson = subject.lessons[level2State.currentLesson];
    } else {
        // Subject-level exam - create virtual lesson
        lesson = { name: 'امتحان ' + subject.name, desc: '', content: '', verse: '', questions: [] };
    }

    // Back button
    var backBtn = document.getElementById('l2-lesson-back-btn');
    backBtn.onclick = function() {
        if (level2State.timerInterval) clearInterval(level2State.timerInterval);
        // Stop any mini-game timer
        if (miniGameState.timer) { clearInterval(miniGameState.timer); miniGameState.timer = null; }
        // If in a mini-game, save partial score then go back to games tab
        if (miniGameState.type) {
            // Save whatever score the user earned so far (even if they didn't finish)
            if (miniGameState.score > 0) {
                saveMiniGameScore(miniGameState.type, miniGameState.score);
                showToast('تم حفظ ' + miniGameState.score + ' نقطة! 💾', 'success');
            }
            miniGameState.type = null;
            level2State.currentStage = 'games';
            renderLevel2Lesson();
            return;
        }
        // If on games tab, go back to learn
        if (level2State.currentStage === 'games') {
            level2State.currentStage = 'learn';
            renderLevel2Lesson();
            return;
        }
        if (level2State.examMode && level2State.currentStage === 'quiz') {
            // Exam in progress - warn and cancel
            if (confirm('لو خرجت الامتحان هيتلغي! متأكد؟')) {
                level2State.examMode = false;
                showScreen(level2State.currentLesson < 0 ? 'level2-subjects-screen' : 'level2-map-screen');
            }
            return;
        }
        showScreen(level2State.currentLesson < 0 ? 'level2-subjects-screen' : 'level2-map-screen');
    };

    // Title
    document.getElementById('l2-lesson-title').textContent = lesson.name;

    var body = document.getElementById('l2-lesson-body');
    body.innerHTML = '';

    if (level2State.currentStage === 'learn') {
        renderLevel2Learn(body, lesson, subject);
    } else if (level2State.currentStage === 'games') {
        renderLevel2Games(body, lesson, subject);
    } else if (level2State.currentStage === 'quiz') {
        renderLevel2Quiz(body, lesson, subject);
    } else if (level2State.currentStage === 'result') {
        renderLevel2Result(body, lesson, subject);
    }

    // Stage label
    var stageLabel = document.getElementById('l2-lesson-stage-label');
    if (level2State.currentStage === 'learn') stageLabel.textContent = '📚 تعلّم';
    else if (level2State.currentStage === 'games') stageLabel.textContent = '🎮 ألعاب';
    else if (level2State.currentStage === 'quiz') stageLabel.textContent = '❓ اختبار';
    else stageLabel.textContent = '🏆 النتيجة';
}

// --- Learn Stage ---
function renderLevel2Learn(container, lesson, subject) {
    var subKey = level2State.currentSubject;
    var lessonIdx = level2State.currentLesson;
    var summaryKey = subKey + '_' + lessonIdx;
    var hasSummary = GameState.lessonSummaries && GameState.lessonSummaries[summaryKey];

    // Tabs: تعلّم + تلخيص + ألعاب + النتيجة
    var html = '<div class="l2-stage-tabs">' +
        '<button class="l2-stage-tab active"><i class="fas fa-book-open"></i> تعلّم</button>' +
        '<button class="l2-stage-tab" onclick="showLessonSummaryTab()"><i class="fas fa-pen"></i> تلخيص' + (hasSummary ? ' ✅' : '') + '</button>' +
        '<button class="l2-stage-tab' + (hasSummary ? '' : ' locked') + '" onclick="' + (hasSummary ? 'goToGamesTab()' : '') + '"><i class="fas fa-gamepad"></i> ألعاب</button>' +
        '<button class="l2-stage-tab"><i class="fas fa-trophy"></i> النتيجة</button>' +
        '</div>';

    // Global station progress
    html += getStationProgressHTML();

    html += '<div class="l2-learn-content">';
    html += '<div class="l2-learn-header">';
    html += '<div class="l2-learn-icon">' + subject.icon + '</div>';
    html += '<h3>' + lesson.name + '</h3>';
    html += '<p class="l2-learn-desc">' + lesson.desc + '</p>';
    html += '</div>';

    // Short Video Embed (if available)
    if (lesson.shortVideoId) {
        var shortVideoKey = level2State.currentSubject + '_lesson_' + level2State.currentLesson + '_short_video';
        var shortVideoWatched = GameState.watchedVideos && GameState.watchedVideos[shortVideoKey];
        html += '<div class="l2-video-section l2-video-short">';
        html += '<div class="l2-video-label"><i class="fas fa-bolt"></i> ' + (lesson.shortVideoTitle || 'ملخص سريع') + ' <span class="l2-video-badge-short">فيديو قصير</span></div>';
        html += '<div class="l2-video-wrap">';
        html += '<iframe src="https://www.youtube.com/embed/' + lesson.shortVideoId + '?rel=0&modestbranding=1" ';
        html += 'frameborder="0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ';
        html += 'style="width:100%;aspect-ratio:16/9;border-radius:12px;"></iframe>';
        html += '</div>';
        if (!shortVideoWatched) {
            html += '<button class="btn btn-primary l2-video-done-btn" onclick="markVideoWatched(\'' + shortVideoKey + '\')" style="width:100%;margin-top:10px">';
            html += '<span><i class="fas fa-check-circle"></i> شاهدت الملخص ✅ (+5 نجوم)</span></button>';
        } else {
            html += '<div class="l2-video-watched-badge"><i class="fas fa-check-circle"></i> شاهدت الملخص وأخدت 5 نجوم ⭐</div>';
        }
        html += '</div>';
    }

    // Detailed YouTube Video Embed
    if (lesson.videoId) {
        var videoKey = level2State.currentSubject + '_lesson_' + level2State.currentLesson + '_video';
        var videoWatched = GameState.watchedVideos && GameState.watchedVideos[videoKey];
        html += '<div class="l2-video-section">';
        html += '<div class="l2-video-label"><i class="fas fa-play-circle"></i> ' + (lesson.videoTitle || 'وعظة الدرس') + ' <span class="l2-video-badge-detail">وعظة تفصيلية</span></div>';
        html += '<div class="l2-video-wrap">';
        html += '<iframe src="https://www.youtube.com/embed/' + lesson.videoId + '?rel=0&modestbranding=1" ';
        html += 'frameborder="0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ';
        html += 'style="width:100%;aspect-ratio:16/9;border-radius:12px;"></iframe>';
        html += '</div>';
        if (!videoWatched) {
            html += '<button class="btn btn-primary l2-video-done-btn" onclick="markVideoWatched(\'' + videoKey + '\')" style="width:100%;margin-top:10px">';
            html += '<span><i class="fas fa-check-circle"></i> شاهدت الوعظة ✅ (+5 نجوم)</span></button>';
        } else {
            html += '<div class="l2-video-watched-badge"><i class="fas fa-check-circle"></i> شاهدت الوعظة وأخدت 5 نجوم ⭐</div>';
        }
        html += '</div>';
    }

    // Lesson summary image if available
    if (lesson.summaryImage) {
        html += '<div class="l2-learn-img-wrap"><img src="' + lesson.summaryImage + '" alt="ملخص الدرس" class="l2-learn-img"></div>';
    }

    // Break content into key points for better readability
    var contentText = lesson.content;
    var sentences = contentText.split(/[.،]/);
    if (sentences.length > 3) {
        html += '<div class="l2-learn-points">';
        html += '<h4><i class="fas fa-lightbulb"></i> النقاط الرئيسية</h4>';
        html += '<ul>';
        sentences.forEach(function(s) {
            s = s.trim();
            if (s.length > 5) {
                html += '<li>' + s + '</li>';
            }
        });
        html += '</ul>';
        html += '</div>';
    } else {
        html += '<div class="l2-learn-text">' + contentText + '</div>';
    }

    html += '<div class="l2-learn-verse"><i class="fas fa-book-bible"></i> ' + lesson.verse + '</div>';

    html += '</div>';

    // Summary section - always visible
    if (!hasSummary) {
        html += '<div class="l2-summary-required">';
        html += '<h4><i class="fas fa-pen"></i> لازم تعمل تلخيص الأول قبل ما تبدأ المسابقات</h4>';
        html += '<button class="btn btn-primary" onclick="showLessonSummaryTab()" style="width:100%;margin-top:8px;">' +
            '<span><i class="fas fa-pen"></i> اكتب تلخيص الدرس (+5 نجوم)</span></button>';
        html += '</div>';
    } else {
        // Show saved summary with edit option (no extra stars)
        var savedSummary = GameState.lessonSummaries[summaryKey];
        html += '<div class="l2-saved-summary">';
        html += '<h4><i class="fas fa-check-circle" style="color:var(--success)"></i> تلخيصك ✅</h4>';
        if (savedSummary.text) html += '<p>' + savedSummary.text + '</p>';
        if (savedSummary.image) html += '<img src="' + savedSummary.image + '" class="l2-summary-saved-img">';
        html += '<button class="btn btn-secondary btn-sm" onclick="showLessonSummaryTab()" style="margin-top:8px">' +
            '<span><i class="fas fa-pen"></i> عدّل التلخيص</span></button>';
        html += '</div>';

        // Button to go to games/quiz tab
        html += '<button class="btn btn-primary" onclick="goToGamesTab()" style="width:100%;margin-top:16px;">' +
            '<span><i class="fas fa-gamepad"></i> يلا نلعب ونتحدى! 🎮</span></button>';
    }

    container.innerHTML = html;
}

// Switch to the games tab
function goToGamesTab() {
    level2State.currentStage = 'games';
    renderLevel2Lesson();
}

// --- Games Stage (replaces quiz as the main play tab) ---
function renderLevel2Games(container, lesson, subject) {
    var subKey = level2State.currentSubject;
    var lessonIdx = level2State.currentLesson;
    var summaryKey = subKey + '_' + lessonIdx;
    var hasSummary = GameState.lessonSummaries && GameState.lessonSummaries[summaryKey];

    // Tabs
    var html = '<div class="l2-stage-tabs">' +
        '<button class="l2-stage-tab completed" onclick="level2State.currentStage=\'learn\';renderLevel2Lesson()"><i class="fas fa-check"></i> تعلّم</button>' +
        '<button class="l2-stage-tab" onclick="showLessonSummaryTab()"><i class="fas fa-pen"></i> تلخيص ✅</button>' +
        '<button class="l2-stage-tab active"><i class="fas fa-gamepad"></i> ألعاب</button>' +
        '<button class="l2-stage-tab"><i class="fas fa-trophy"></i> النتيجة</button>' +
        '</div>';

    // Global station progress
    html += getStationProgressHTML();

    // Mini-games section
    html += renderMiniGamesSection();

    // Weekly exam button
    var lessonPracticed = GameState.level2Data && GameState.level2Data[subKey] &&
        GameState.level2Data[subKey]['lesson_' + lessonIdx] &&
        GameState.level2Data[subKey]['lesson_' + lessonIdx].stars > 0;
    var examTaken = GameState.level2Data && GameState.level2Data[subKey] &&
        GameState.level2Data[subKey]['exam_' + lessonIdx];

    if (lessonPracticed && !examTaken) {
        html += '<button class="btn btn-exam" onclick="startLevel2Exam(' + lessonIdx + ')" style="width:100%;margin-top:10px;">' +
            '<span><i class="fas fa-scroll"></i> المسابقة الأسبوعية (مرة واحدة)</span></button>';
    } else if (examTaken) {
        var examData = GameState.level2Data[subKey]['exam_' + lessonIdx];
        html += '<div class="exam-taken-badge"><i class="fas fa-check-circle"></i> المسابقة الأسبوعية: ' + examData.stars + '/30 ⭐</div>';
    }

    container.innerHTML = html;
}

// ============================================================
// MINI-GAMES ENTERTAINMENT ZONE
// ============================================================
var LESSON_MINI_GAMES = {
    'faith_0': {
        trueFalse: [
            { statement: 'المسيحية بتؤمن بـ ٣ إلهة منفصلين', answer: false },
            { statement: 'كلمة "أقنوم" هي كلمة سريانية معناها "صفة ذاتية"', answer: true },
            { statement: 'الإله لازم يكون أزلي وغير مخلوق', answer: true },
            { statement: 'الوثنيين في وقت مارمرقس كانوا بيؤمنوا باله واحد', answer: false },
            { statement: 'انيانوس الإسكافي صرخ وقال "يا الله الواحد" لما إبرته دخلت في إيده', answer: true },
            { statement: 'إحنا بنرشم الصليب بنقول "بأسماء" الآب والابن والروح القدس', answer: false },
            { statement: 'قانون الإيمان بيبدأ بعبارة "بالحقيقة نؤمن بإله واحد"', answer: true },
            { statement: 'الأقنوم هو "جزء" من الله', answer: false },
            { statement: 'الآب هو "وجود الله"', answer: true },
            { statement: 'الابن هو "عقل ونطق الله"', answer: true },
            { statement: 'الروح القدس هو "خاصية الحياة أو الروح"', answer: true },
            { statement: 'الآب والابن والروح القدس ليهم ٣ جواهر مختلفة', answer: false },
            { statement: 'الابن هو "اللوجوس" يعني العقل الناطق', answer: true },
            { statement: 'في علاقة العقل بالفكر، الفكر لما بيخرج بيسيب العقل ويمشي', answer: false },
            { statement: 'ولادة الابن من الآب زي مولد الفكر من العقل', answer: true },
            { statement: 'الإنسان عبارة عن (روح ونفس وجسد) ومع ذلك هو شخص واحد', answer: true },
            { statement: 'النار فيها (لهب وضياء وحرارة) ومع ذلك هي نار واحدة', answer: true },
            { statement: 'الشمس فيها (قرص وشعاع وحرارة) ومع ذلك هي شمس واحدة', answer: true },
            { statement: 'المثلث له ٣ رؤوس ومع ذلك هو مثلث واحد', answer: true },
            { statement: 'الثالوث في المسيحية يعني ١+١+١=٣', answer: false },
            { statement: 'العملية الحسابية للثالوث هي ١×١×١=١', answer: true },
            { statement: '"أنا في الآب والآب فيّ" دي آية قالها السيد المسيح', answer: true },
            { statement: 'بنوة الابن للآب بنوة مادية حسية', answer: false },
            { statement: 'كلمة "مونوجينيس" معناها الوحيد أو الفريد في جنسه', answer: true },
            { statement: 'بنوة الابن للآب أزلية (مفيش وقت كان فيه الآب من غير ابن)', answer: true },
            { statement: 'الآب جه الأول وبعدين الابن جه بعده بشوية', answer: false },
            { statement: 'بنوة الابن للآب بنوة "متصلة" مفيهاش انفصال', answer: true },
            { statement: 'الروح القدس هو "الرب المحيي"', answer: true },
            { statement: 'الأرثوذكس بيؤمنوا إن الروح القدس منبثق من "الآب والابن"', answer: false },
            { statement: 'التعبير الصح هو "الروح القدس المنبثق من الآب"', answer: true },
            { statement: 'الانبثاق الأزلي للروح القدس مستمر بدون توقف', answer: true },
            { statement: 'إرسال الروح القدس في يوم الخمسين ده فعل "زمني" مش أزلي', answer: true },
            { statement: 'أقنوم الابن هو أقنوم "الإعلان" لأنه يُرى', answer: true },
            { statement: 'أقنوم الروح القدس هو أقنوم "الإلهام" لأنه لا يُرى بالعين', answer: true },
            { statement: 'مجمع نيقية والقسطنطينية هما اللي حطوا قانون الإيمان', answer: true },
            { statement: 'مقدمة قانون الإيمان (نعظمك يا أم النور) اتحطت في مجمع أفسس', answer: true },
            { statement: 'البابا أثناسيوس قال إن الثالوث كامل مفيش فيه شيء غريب', answer: true },
            { statement: 'الآب بيفعل كل شيء "خلال الابن بالروح القدس"', answer: true },
            { statement: 'الثالوث مجرد "كلام" مش حقيقة وواقع', answer: false },
            { statement: 'الروح القدس منبثق من الآب زي انبثاق الحرارة من قرص الشمس', answer: true },
            { statement: 'الابن مولود من الآب زي ولادة النور من قرص الشمس', answer: true },
            { statement: 'الوحدانية المطلقة اللي بترفض عقل الله وروحه هي وحدانية ناقصة', answer: true },
            { statement: 'مفيش فرق بين "الانبثاق" و"الإرسال" في الزمن', answer: false },
            { statement: '"بنات أفكاره" تعبير بيوضح إن الفكر مولود من العقل', answer: true },
            { statement: 'الآب هو الإله والابن إله تاني صغير', answer: false },
            { statement: 'الثالوث ظهر بوضوح في وقت "عماد السيد المسيح"', answer: true },
            { statement: 'عيد الظهور الإلهي هو نفسه عيد الغطاس', answer: true },
            { statement: 'الله "روح" والروح "قدوس" عشان كدا الروح القدس هو الله', answer: true },
            { statement: 'الابن مساوٍ للآب في الجوهر', answer: true },
            { statement: 'الجوهر الإلهي واحد والخواص (الأقانيم) تلاتة', answer: true }
        ],
        whoAmI: [
            { clues: ['أنا كلمة سريانية', 'معناي "صفة يقوم عليها الكيان الإلهي"', 'في اليونانية اسمي "هيبوستاسيس"'], answer: 'الأقنوم' },
            { clues: ['أنا كلمة يونانية', 'معناي "العقل الناطق"', 'بتوصف أقنوم الابن'], answer: 'اللوجوس' },
            { clues: ['أنا إسكافي', 'صرخت "يا الله الواحد"', 'إبرتي جرحت إيدي', 'مارمرقس بشّرني'], answer: 'انيانوس' },
            { clues: ['أنا كاروز الديار المصرية', 'بشرت انيانوس بالإله الواحد', 'أنا رسول وإنجيلي'], answer: 'مارمرقس' },
            { clues: ['أنا بابا إسكندرية', 'دافعت عن الثالوث في مجمع نيقية', 'لقبي "حامي الإيمان"'], answer: 'البابا أثناسيوس الرسولي' },
            { clues: ['أنا مجمع مسكوني', 'كمّلت قانون الإيمان', 'حطيت الجزء الخاص بالروح القدس'], answer: 'مجمع القسطنطينية' },
            { clues: ['أنا مجمع مسكوني', 'أضفت مقدمة قانون الإيمان', '"نعظمك يا أم النور"'], answer: 'مجمع أفسس' },
            { clues: ['أنا أقنوم من الثالوث', 'بمثّل "وجود الله" وكينونته', 'مصدر اللاهوت', 'منّي وُلد الابن وانبثق الروح'], answer: 'الآب' },
            { clues: ['أنا أقنوم من الثالوث', 'بمثّل "عقل الله وحكمته"', 'اسمي اللوجوس', 'تجسدت وصرت إنساناً'], answer: 'الابن' },
            { clues: ['أنا أقنوم من الثالوث', 'بمثّل "حياة الله"', 'أنا الرب المحيي', 'منبثق من الآب'], answer: 'الروح القدس' },
            { clues: ['أنا حدث مهم', 'ظهر فيّ الآب بصوت والابن في الماء', 'والروح القدس كحمامة', 'عيد الظهور الإلهي'], answer: 'العماد / الغطاس' },
            { clues: ['أنا خاصية', 'بتوصف خروج الروح القدس من الآب', 'مش ولادة ومش خلق'], answer: 'الانبثاق' },
            { clues: ['أنا خاصية', 'بتوصف خروج الابن من الآب', 'زي مولد الفكر من العقل'], answer: 'الولادة' },
            { clues: ['أنا مثال طبيعي', 'فيّ قرص وشعاع وحرارة', 'وأنا شيء واحد'], answer: 'الشمس' },
            { clues: ['أنا مثال طبيعي', 'فيّ لهب وضياء وحرارة', 'وأنا شيء واحد'], answer: 'النار' },
            { clues: ['أنا مثال من الخليقة', 'فيّ روح ونفس وجسد', 'وأنا شخص واحد'], answer: 'الإنسان' },
            { clues: ['أنا شكل هندسي', 'ليّ ٣ رؤوس', 'وأنا كيان واحد'], answer: 'المثلث' },
            { clues: ['أنا كلمة يونانية', 'معناي "الوحيد أو الفريد"', 'بتوصف بنوة المسيح'], answer: 'مونوجينيس' },
            { clues: ['أنا اللي بعت الإنجيليين', 'قلت "عمدوهم باسم الآب والابن والروح القدس"'], answer: 'السيد المسيح' },
            { clues: ['أنا صلاة', 'بتبدأ بـ "بالحقيقة نؤمن بإله واحد"', 'دستور الإيمان المسيحي'], answer: 'قانون الإيمان' },
            { clues: ['أنا عبارة', 'بنبدأ بيها كل صلواتنا', 'بنقول "باسم" مش "بأسماء"'], answer: 'البسملة' },
            { clues: ['أنا أقنوم الإعلان', 'لأني تجسدت وشُفتني الناس', 'أنا الكلمة المتجسد'], answer: 'الابن' },
            { clues: ['أنا أقنوم الإلهام', 'بعمل في القلوب والأنبياء', 'لا يُرى بالعين'], answer: 'الروح القدس' },
            { clues: ['أنا تعبير يوناني', 'بتكوّن من "هيبو" و"ستاسيس"', 'معناي "تحت الكيان"'], answer: 'هيبوستاسيس (الأقنوم)' },
            { clues: ['أنا قلت "أنا في الآب والآب فيّ"', 'أنا كلمة الله المتجسد'], answer: 'يسوع المسيح' },
            { clues: ['أنا صفة', 'بتقول إن الله ملوش بداية', 'موجود قبل الزمن'], answer: 'الأزلية' },
            { clues: ['أنا المصدر الواحد لللاهوت', 'بيولد منّي الابن', 'وينبثق منّي الروح'], answer: 'الآب' },
            { clues: ['أنا فعل حصل يوم الخمسين', 'أنا فعل "زمني" مش أزلي', 'الروح القدس نزل على التلاميذ'], answer: 'إرسال الروح القدس' },
            { clues: ['أنا بشهد في الأنبياء', 'وبحيي النفوس', 'أنا الناطق في الأنبياء'], answer: 'الروح القدس' },
            { clues: ['أنا آية من رسالة يوحنا الأولى', '"الذين يشهدون في السماء هم ثلاثة"', '"وهؤلاء الثلاثة هم واحد"'], answer: '١ يوحنا ٥: ٧' },
            { clues: ['أنا ملاك', 'قلت لمريم "الروح القدس يحل عليك"', '"وقوة العلي تظللك"'], answer: 'الملاك جبرائيل' },
            { clues: ['أنا لقب الروح القدس', 'معناي "المعزي"'], answer: 'باراكليت' },
            { clues: ['أنا صرخت في إشعياء', '"أنا الرب وليس آخر. لا إله سواي"'], answer: 'الله' },
            { clues: ['أنا عملية حسابية', 'بتوصف وحدانية الأقانيم', '١ × ١ × ١ = ١'], answer: '١ × ١ × ١' },
            { clues: ['أنا شرحت إن الآب بيفعل كل شيء', 'خلال الكلمة بالروح القدس', 'أنا حامي الإيمان'], answer: 'البابا أثناسيوس' },
            { clues: ['أنا نوع بنوة', 'بتوصف ولادة الفكر من العقل', 'مش بنوة جسدية'], answer: 'بنوة روحية عقلية' },
            { clues: ['أنا نوع بنوة', 'مفيهاش زمن بين الآب والابن', 'مستحيل الله يكون من غير عقل لحظة'], answer: 'بنوة أزلية' },
            { clues: ['أنا نوع بنوة', 'مفيهاش انفصال بعد الولادة', 'الابن لا ينفصل عن الآب'], answer: 'بنوة متصلة' },
            { clues: ['أنا نوع بنوة', 'من "جوهر" الآب مش مجرد لقب', 'بنوة حقيقية طبيعية'], answer: 'بنوة طبيعية' },
            { clues: ['أنا الرد على الكاثوليك', '"روح الحق الذي من عند الآب ينبثق"', 'يوحنا ١٥: ٢٦'], answer: 'آية يوحنا ١٥: ٢٦' },
            { clues: ['أنا كائن واحد مع عقلي ونطقي', 'لو جردتني من عقلي وروحي مبقاش كائن حي', 'مثال لوحدانية الله'], answer: 'الإنسان' },
            { clues: ['أنا "نور من نور"', '"إله حق من إله حق"', 'مولود غير مخلوق'], answer: 'السيد المسيح' },
            { clues: ['أنا "خالق السماء والأرض"', '"ما يُرى وما لا يُرى"', 'ضابط الكل'], answer: 'الله الآب' },
            { clues: ['أنا "الناطق في الأنبياء"', 'الرب المحيي', 'المنبثق من الآب'], answer: 'الروح القدس' }
        ],
        sortVerse: [
            { full: 'أنت الرب الإله وحدك', ref: '٢ مل ١٩' },
            { full: 'أنا الرب وليس آخر لا إله سواي', ref: 'إش ٤٥' },
            { full: 'أنا الرب صانع كل شيء ناشر السماوات وحدي', ref: 'إش ٤٤' },
            { full: 'لأن الله واحد', ref: 'رو ٣' },
            { full: 'ولكن الله واحد', ref: 'غل ٣' },
            { full: 'في البدء كان اللوجوس', ref: 'يو ١: ١أ' },
            { full: 'واللوجوس كان عند الله', ref: 'يو ١: ١ب' },
            { full: 'وكان اللوجوس الله', ref: 'يو ١: ١ج' },
            { full: 'الروح القدس يحل عليك', ref: 'لو ١: ٣٥أ' },
            { full: 'وقوة العلي تظللك', ref: 'لو ١: ٣٥ب' },
            { full: 'القدوس المولود منك يدعى ابن الله', ref: 'لو ١: ٣٥ج' },
            { full: 'نعمة ربنا يسوع المسيح', ref: '٢ كو ١٣: ١٤أ' },
            { full: 'ومحبة الله', ref: '٢ كو ١٣: ١٤ب' },
            { full: 'وشركة الروح القدس', ref: '٢ كو ١٣: ١٤ج' },
            { full: 'مع جميعكم آمين', ref: '٢ كو ١٣: ١٤د' },
            { full: 'فاذهبوا وتلمذوا جميع الأمم', ref: 'مت ٢٨: ١٩أ' },
            { full: 'وعمدوهم باسم الآب والابن والروح القدس', ref: 'مت ٢٨: ١٩ب' },
            { full: 'فإن الذين يشهدون في السماء هم ثلاثة', ref: '١ يو ٥: ٧أ' },
            { full: 'الآب والكلمة والروح القدس', ref: '١ يو ٥: ٧ب' },
            { full: 'وهؤلاء الثلاثة هم واحد', ref: '١ يو ٥: ٧ج' },
            { full: 'أنا في الآب والآب فيّ', ref: 'يو ١٤: ١٠' },
            { full: 'الذي من عند الآب ينبثق', ref: 'يو ١٥: ٢٦' },
            { full: 'إن لم أنطلق لا يأتيكم المعزى', ref: 'يو ١٦: ٧أ' },
            { full: 'ولكن إن ذهبت أرسله إليكم', ref: 'يو ١٦: ٧ب' },
            { full: 'بالحقيقة نؤمن بإله واحد', ref: 'قانون الإيمان' },
            { full: 'الله الآب ضابط الكل', ref: 'قانون الإيمان' },
            { full: 'خالق السماء والأرض', ref: 'قانون الإيمان' },
            { full: 'ما يرى وما لا يرى', ref: 'قانون الإيمان' },
            { full: 'نؤمن برب واحد يسوع المسيح', ref: 'قانون الإيمان' },
            { full: 'ابن الله الوحيد', ref: 'قانون الإيمان' },
            { full: 'المولود من الآب قبل كل الدهور', ref: 'قانون الإيمان' },
            { full: 'نور من نور', ref: 'قانون الإيمان' },
            { full: 'إله حق من إله حق', ref: 'قانون الإيمان' },
            { full: 'مولود غير مخلوق', ref: 'قانون الإيمان' },
            { full: 'مساو للآب في الجوهر', ref: 'قانون الإيمان' },
            { full: 'الذي به كان كل شيء', ref: 'قانون الإيمان' },
            { full: 'الذي من أجلنا نحن البشر', ref: 'قانون الإيمان' },
            { full: 'ومن أجل خلاصنا', ref: 'قانون الإيمان' },
            { full: 'نزل من السماء', ref: 'قانون الإيمان' },
            { full: 'وتجسد من الروح القدس', ref: 'قانون الإيمان' },
            { full: 'ومن مريم العذراء', ref: 'قانون الإيمان' },
            { full: 'وتأنس', ref: 'قانون الإيمان' },
            { full: 'صُلب عنا على عهد بيلاطس البنطي', ref: 'قانون الإيمان' },
            { full: 'كما في الكتب', ref: 'قانون الإيمان' },
            { full: 'وجلس عن يمين أبيه', ref: 'قانون الإيمان' },
            { full: 'ليدين الأحياء والأموات', ref: 'قانون الإيمان' },
            { full: 'الذي ليس لملكه انقضاء', ref: 'قانون الإيمان' },
            { full: 'الرب المحيي المنبثق من الآب', ref: 'قانون الإيمان' },
            { full: 'الناطق في الأنبياء', ref: 'قانون الإيمان' }
        ],
        fillBlank: [
            { text: 'الإله لازم من صفاته إنه ___ وغير مخلوق', blank: 'أزلي', options: ['أزلي', 'صغير', 'محدود', 'ضعيف'] },
            { text: 'من صفات الله إنه غير ___ وقادر على كل شيء', blank: 'محدود', options: ['محدود', 'قوي', 'موجود', 'عظيم'] },
            { text: 'انيانوس الإسكافي صرخ وقال "أيها الإله ___"', blank: 'الواحد', options: ['الواحد', 'العظيم', 'القوي', 'الحي'] },
            { text: 'تبدأ صلواتنا باسم الآب والابن والروح القدس الإله ___ آمين', blank: 'الواحد', options: ['الواحد', 'الثلاثة', 'العظيم', 'الحي'] },
            { text: 'الله واحد في جوهره وذاته لكن في الجوهر ده ثلاثة ___', blank: 'أقانيم', options: ['أقانيم', 'آلهة', 'أجزاء', 'أنصاف'] },
            { text: 'كلمة أقنوم هي كلمة ___ معناها هيبوستاسيس', blank: 'سريانية', options: ['سريانية', 'يونانية', 'عربية', 'قبطية'] },
            { text: 'هيبو معناها ___ وستاسيس معناها الكيان القائم', blank: 'تحت', options: ['تحت', 'فوق', 'داخل', 'خارج'] },
            { text: 'الآب هو ___ الله', blank: 'وجود', options: ['وجود', 'عقل', 'حياة', 'قوة'] },
            { text: 'الابن هو عقل ونطق الله والكلمة ___', blank: 'اللوجوس', options: ['اللوجوس', 'الروح', 'النور', 'الحياة'] },
            { text: 'الروح القدس هو خاصية الحياة أو ___', blank: 'الروح', options: ['الروح', 'العقل', 'الوجود', 'النطق'] },
            { text: 'في البدء كان اللوجوس واللوجوس كان عند ___', blank: 'الله', options: ['الله', 'الناس', 'السماء', 'الأرض'] },
            { text: 'ولادة الابن من الآب كمولد ___ من العقل', blank: 'الفكر', options: ['الفكر', 'الماء', 'النار', 'الهواء'] },
            { text: 'الشيء الصادر عن شيء يسمى ___ منه', blank: 'مولود', options: ['مولود', 'مخلوق', 'مصنوع', 'منفصل'] },
            { text: 'الإنسان واحد وفيه يحوي روح ونفس و___', blank: 'جسد', options: ['جسد', 'عقل', 'قلب', 'ماء'] },
            { text: 'النار واحدة وفيها اللهب والضوء و___', blank: 'الحرارة', options: ['الحرارة', 'الماء', 'الهواء', 'التراب'] },
            { text: 'المثلث واحد وفيه ثلاثة ___', blank: 'رؤوس', options: ['رؤوس', 'دوائر', 'مربعات', 'خطوط'] },
            { text: 'لا نقول ١+١+١ بل نقول ١___١___١', blank: '×', options: ['×', '+', '-', '÷'] },
            { text: '"أنا في الآب والآب ___"', blank: 'فيّ', options: ['فيّ', 'معي', 'بعيد', 'قريب'] },
            { text: 'بنوة الابن للآب بنوة ___ وليست مادية حسية', blank: 'روحية عقلية', options: ['روحية عقلية', 'جسدية', 'مادية', 'زمنية'] },
            { text: 'كلمة "مونوجينيس" باليونانية معناها ___/الفريد', blank: 'الوحيد', options: ['الوحيد', 'الأول', 'الأخير', 'الأكبر'] },
            { text: 'بنوة الابن للآب بنوة ___ (مستحيل الله كان موجود لحظة من غير عقل)', blank: 'أزلية', options: ['أزلية', 'زمنية', 'حديثة', 'مؤقتة'] },
            { text: 'بنوة الابن للآب بنوة ___ (مفيش انفصال عن الجوهر)', blank: 'متصلة', options: ['متصلة', 'منفصلة', 'بعيدة', 'ضعيفة'] },
            { text: 'الروح القدس هو الرب ___ يعني باعث الحياة', blank: 'المحيي', options: ['المحيي', 'الخالق', 'الضابط', 'القوي'] },
            { text: 'الروح القدس ___ من الآب أي منبعث وصادر منه', blank: 'منبثق', options: ['منبثق', 'مولود', 'مخلوق', 'منفصل'] },
            { text: 'يختلف الكاثوليك عن الأرثوذكس في قولهم إن الروح القدس ينبثق من الآب و___', blank: 'الابن', options: ['الابن', 'الآب', 'الملائكة', 'القديسين'] },
            { text: 'الانبثاق دا أزلى ومستمر أما ___ الروح القدس فهو فعل زمني', blank: 'إرسال', options: ['إرسال', 'ولادة', 'خلق', 'موت'] },
            { text: 'أقنوم الابن هو أقنوم ___ لأنه يُرى', blank: 'الإعلان', options: ['الإعلان', 'الإلهام', 'الوجود', 'الحياة'] },
            { text: 'أقنوم الروح القدس هو أقنوم ___ لأنه لا يُرى', blank: 'الإلهام', options: ['الإلهام', 'الإعلان', 'الوجود', 'العقل'] },
            { text: 'مجمع ___ والقسطنطينية هما اللي حطوا قانون الإيمان', blank: 'نيقية', options: ['نيقية', 'أفسس', 'خلقيدونية', 'روما'] },
            { text: 'مجمع أفسس حط مقدمة قانون الإيمان "___ يا أم النور"', blank: 'نعظمك', options: ['نعظمك', 'نمجدك', 'نحبك', 'نسألك'] },
            { text: 'البابا أثناسيوس قال إن اللاهوت ليس فيه شيء ___ يلتحم به', blank: 'غريب', options: ['غريب', 'جميل', 'قوي', 'عظيم'] },
            { text: '"أنت الرب الإله ___" (٢ مل ١٩)', blank: 'وحدك', options: ['وحدك', 'العظيم', 'القوي', 'الحي'] },
            { text: '"أنا الرب وليس آخر. لا إله ___" (إش ٤٥)', blank: 'سواي', options: ['سواي', 'غيري', 'معي', 'بعدي'] },
            { text: '"لأن الله ___" (رو ٣)', blank: 'واحد', options: ['واحد', 'عظيم', 'كبير', 'قوي'] },
            { text: 'الآب والابن والروح القدس ليسوا ٣ آلهة بل إله ___', blank: 'واحد', options: ['واحد', 'ثلاثة', 'كثير', 'عظيم'] },
            { text: 'الأقنوم هو صفة أو ___ يقوم عليها الكيان الإلهي', blank: 'خاصية', options: ['خاصية', 'جزء', 'نصف', 'قطعة'] },
            { text: 'الشمس واحدة وفيها القرص و___ والحرارة', blank: 'الشعاع', options: ['الشعاع', 'الماء', 'الهواء', 'التراب'] },
            { text: 'ولادة الابن زي ولادة ___ من قرص الشمس', blank: 'النور', options: ['النور', 'الماء', 'الهواء', 'النار'] },
            { text: 'انبثاق الروح القدس زي انبثاق ___ من قرص الشمس', blank: 'الحرارة', options: ['الحرارة', 'النور', 'الماء', 'الهواء'] },
            { text: '"الروح القدس يحل عليك وقوة ___ تظللك"', blank: 'العلي', options: ['العلي', 'الأرض', 'الناس', 'الملائكة'] },
            { text: '"وهؤلاء الثلاثة هم ___" (١ يوحنا ٥)', blank: 'واحد', options: ['واحد', 'ثلاثة', 'كثير', 'منفصلين'] },
            { text: 'وقت ___ السيد المسيح نرى الثالوث ظاهراً', blank: 'عماد', options: ['عماد', 'صلب', 'ميلاد', 'صعود'] },
            { text: 'عيد الظهور الإلهي يسمى أيضاً عيد ___', blank: 'الغطاس', options: ['الغطاس', 'الميلاد', 'القيامة', 'الصعود'] },
            { text: 'البنوة الطبيعية تعني أن الابن من ___ الآب', blank: 'جوهر', options: ['جوهر', 'خارج', 'بعيد', 'تحت'] },
            { text: 'الروح القدس منبثق من الآب أزلياً ويعمل في المؤمنين لـ ___', blank: 'تجديدهم', options: ['تجديدهم', 'عقابهم', 'تدميرهم', 'نسيانهم'] },
            { text: 'الله ___ (يو ٤: ٢٤) والله قدوس (رؤ ١٥: ٤)', blank: 'روح', options: ['روح', 'جسد', 'نار', 'ماء'] },
            { text: 'قانون الإيمان يقول: "نؤمن برب واحد ___"', blank: 'يسوع المسيح', options: ['يسوع المسيح', 'موسى', 'إبراهيم', 'داود'] },
            { text: '"مساو للآب في ___" (قانون الإيمان)', blank: 'الجوهر', options: ['الجوهر', 'الشكل', 'العمر', 'المكان'] },
            { text: '"الناطق في ___" (عن الروح القدس)', blank: 'الأنبياء', options: ['الأنبياء', 'الملائكة', 'الكهنة', 'الناس'] }
        ],
        matchPairs: [
            { left: 'الآب', right: 'وجود الله' },
            { left: 'الابن', right: 'عقل ونطق الله' },
            { left: 'الروح القدس', right: 'حياة وروح الله' },
            { left: 'أقنوم', right: 'هيبوستاسيس' },
            { left: 'لوجوس', right: 'الكلمة / العقل الناطق' },
            { left: 'مونوجينيس', right: 'الوحيد / الفريد' },
            { left: 'نيقية', right: 'مجمع وضع قانون الإيمان' },
            { left: 'القسطنطينية', right: 'مجمع كمل الروح القدس' },
            { left: 'أفسس', right: 'مجمع نعظمك يا أم النور' },
            { left: 'بنوة أزلية', right: 'لا يسبق فيها الآب الابن بالزمن' },
            { left: 'بنوة متصلة', right: 'لا انفصال فيها عن الجوهر' },
            { left: 'بنوة طبيعية', right: 'من جوهر الآب وطبيعته' },
            { left: 'بنوة وضعية', right: 'بنوة بالتبني' },
            { left: 'الانبثاق', right: 'خاصية الروح القدس' },
            { left: 'الولادة', right: 'خاصية الابن' },
            { left: 'انيانوس', right: 'آمن بالإله الواحد' },
            { left: 'مارمرقس', right: 'كاروز الديار المصرية' },
            { left: 'قرص وشعاع وحرارة', right: 'مثال للثالوث في الشمس' },
            { left: 'روح ونفس وجسد', right: 'مثال للثالوث في الإنسان' },
            { left: 'لهب وضياء وحرارة', right: 'مثال للثالوث في النار' },
            { left: '١ × ١ × ١', right: 'وحدانية الأقانيم' },
            { left: 'أثناسيوس', right: 'حامي الإيمان' },
            { left: 'إشعياء', right: 'نبي أكد الوحدانية' },
            { left: 'بولس الرسول', right: 'قال الله واحد في روما' },
            { left: 'يوحنا الحبيب', right: 'كتب عن اللوجوس' },
            { left: 'المعزي', right: 'لقب الروح القدس' },
            { left: 'ضابط الكل', right: 'لقب الله الآب' },
            { left: 'التجسد', right: 'فعل أقنوم الابن' },
            { left: 'الظهور الإلهي', right: 'وقت عماد المسيح' },
            { left: 'هيبو', right: 'معناها تحت' },
            { left: 'ستاسيس', right: 'معناها الكيان' },
            { left: 'الرب الإله وحدك', right: 'آية من سفر الملوك' },
            { left: 'لا إله سواي', right: 'آية من سفر إشعياء' },
            { left: 'عقل وفكر', right: 'مثال لولادة الابن' },
            { left: 'قرص ونور', right: 'مثال لولادة الابن' },
            { left: 'قرص وحرارة', right: 'مثال لانبثاق الروح' },
            { left: 'إرسال الروح', right: 'فعل زمني في الخمسين' },
            { left: 'نطق عاقل', right: 'معنى كلمة لوجوس' },
            { left: 'واحد في الجوهر', right: 'مساوٍ للآب' },
            { left: 'مجمع نيقية', right: '٣١٨ أسقف' },
            { left: 'بيلاطس البنطي', right: 'الوالي وقت الصلب' },
            { left: 'مريم العذراء', right: 'والدة الإله' },
            { left: 'الرب المحيي', right: 'الروح القدس' },
            { left: 'الناطق في الأنبياء', right: 'الروح القدس' },
            { left: 'بنوة روحية', right: 'ليست مادية حسية' },
            { left: 'أزلي', right: 'ليس له بداية' },
            { left: 'غير محدود', right: 'لا يحويه مكان' },
            { left: 'إله حق من إله حق', right: 'السيد المسيح' },
            { left: 'باراكليت', right: 'المعزي' },
            { left: 'ثيؤطوكوس', right: 'والدة الإله' }
        ],
        // Characters questions (rendered as MCQ)
        characters: [
            { q: 'مين اللي بشر انيانوس في الإسكندرية؟', options: ['بولس الرسول', 'مارمرقس', 'يوحنا المعمدان', 'بطرس الرسول'], correct: 1 },
            { q: 'مين اللي صلح جزمته مارمرقس وعرفه على المسيح؟', options: ['إشعياء', 'انيانوس', 'بولس', 'تيموثاوس'], correct: 1 },
            { q: 'مين الشخصية اللي بنعتبرها "الكلمة المتجسد"؟', options: ['الآب', 'الروح القدس', 'يسوع المسيح', 'موسى'], correct: 2 },
            { q: 'مين النبي اللي قال "أنا الرب صانع كل شيء ناشر السماوات وحدي"؟', options: ['إرميا', 'إشعياء', 'دانيال', 'حزقيال'], correct: 1 },
            { q: 'مين الرسول اللي كتب "لأن الله واحد" في رسالة روما؟', options: ['بطرس', 'يعقوب', 'بولس الرسول', 'يوحنا'], correct: 2 },
            { q: 'مين الرسول اللي كتب بداية إنجيله عن "اللوجوس"؟', options: ['متى', 'مرقس', 'لوقا', 'يوحنا الحبيب'], correct: 3 },
            { q: 'مين البابا اللي قاد معركة الدفاع عن الإيمان في نيقية؟', options: ['كيرلس', 'أثناسيوس', 'ديسقوروس', 'بطرس'], correct: 1 },
            { q: 'مين اللي ظهر في العماد "بهيئة جسمية كحمامة"؟', options: ['الآب', 'الابن', 'الروح القدس', 'الملاك'], correct: 2 },
            { q: 'مين اللي قال في العماد "هذا هو ابني الحبيب"؟', options: ['الابن', 'الروح القدس', 'يوحنا المعمدان', 'الآب'], correct: 3 },
            { q: 'مين اللي كان بيعمد الناس في الأردن وقت الظهور الإلهي؟', options: ['بطرس', 'بولس', 'يوحنا المعمدان', 'أندراوس'], correct: 2 },
            { q: 'مين الشخص اللي بنوته لله "ممنوحة بالتبني" مش بالطبيعة؟', options: ['المسيح', 'المؤمنون', 'الملائكة', 'الأنبياء'], correct: 1 },
            { q: 'مين النبي اللي ربنا قاله "أنا الرب وليس آخر"؟', options: ['موسى', 'إشعياء', 'إرميا', 'عاموس'], correct: 1 },
            { q: 'مين الوالي اللي اتصلب في عهده السيد المسيح؟', options: ['هيرودس', 'بيلاطس البنطي', 'قيصر', 'فيلكس'], correct: 1 },
            { q: 'مين الأم اللي ولدت الابن بالجسد في ملء الزمان؟', options: ['أليصابات', 'حنة', 'مريم العذراء', 'راحيل'], correct: 2 },
            { q: 'مين اللي بشر مريم العذراء بالحلول الأقنومي؟', options: ['ميخائيل', 'الملاك جبرائيل', 'رافائيل', 'سوريال'], correct: 1 },
            { q: 'مين اللي بيدعي إن الروح القدس ينبثق من الآب والابن؟', options: ['الأرثوذكس', 'اليهود', 'الكاثوليك والبروتستانت', 'المسلمون'], correct: 2 },
            { q: 'مين الشخصية اللي هي "نور من نور وإله حق من إله حق"؟', options: ['الآب', 'الابن', 'الروح القدس', 'الملاك'], correct: 1 },
            { q: 'مين اللي بيعمل في المؤمنين لتجديدهم وإرشادهم؟', options: ['الآب', 'الابن', 'الروح القدس', 'الكاهن'], correct: 2 },
            { q: 'مين اللي جلس عن يمين أبيه؟', options: ['الروح القدس', 'يسوع المسيح', 'الملاك', 'موسى'], correct: 1 },
            { q: 'مين اللي هييجي في مجده ليدين الأحياء والأموات؟', options: ['الآب', 'الابن / الديان', 'الروح القدس', 'الملائكة'], correct: 1 },
            { q: 'مين اللي ربنا وصفه بـ "الابن الوحيد في جنسه"؟', options: ['آدم', 'المسيح', 'موسى', 'داود'], correct: 1 },
            { q: 'مين اللي الروح القدس نطق فيهم؟', options: ['الملائكة', 'الأنبياء', 'الحيوانات', 'الأشجار'], correct: 1 },
            { q: 'مين اللي وضع مقدمة قانون الإيمان "نعظمك يا أم النور"؟', options: ['آباء نيقية', 'آباء مجمع أفسس', 'آباء القسطنطينية', 'بولس الرسول'], correct: 1 },
            { q: 'مين حامي الإيمان اللي قال "يوجد ثالوث كامل"؟', options: ['كيرلس', 'البابا أثناسيوس', 'ديسقوروس', 'بطرس'], correct: 1 },
            { q: 'مين اللي الآب بيفعل كل شيء "خلاله"؟', options: ['الروح القدس', 'الابن', 'الملائكة', 'الأنبياء'], correct: 1 },
            { q: 'مين اللي المسيح سماه "المعزي"؟', options: ['الآب', 'الابن', 'الروح القدس', 'الملاك'], correct: 2 },
            { q: 'مين اللي نزل من السماء وتجسد لخلاصنا؟', options: ['الآب', 'الابن', 'الروح القدس', 'الملاك'], correct: 1 },
            { q: 'مين اللي كتب رسالة غلاطية وقال فيها "ولكن الله واحد"؟', options: ['بطرس', 'بولس الرسول', 'يعقوب', 'يوحنا'], correct: 1 },
            { q: 'مين اللي بنسميه "ضابط الكل"؟', options: ['الابن', 'الله الآب', 'الروح القدس', 'الملاك ميخائيل'], correct: 1 },
            { q: 'مين اللي صُلب وقُبر وقام؟', options: ['الآب', 'يسوع المسيح', 'الروح القدس', 'بولس'], correct: 1 },
            { q: 'مين اللي بنسجد له ونمجده مع الآب والابن؟', options: ['الملائكة', 'القديسين', 'الروح القدس', 'الأنبياء'], correct: 2 },
            { q: 'مين اللي بنوته "طبيعية" من جوهر الآب؟', options: ['المؤمنون', 'الابن', 'الملائكة', 'آدم'], correct: 1 },
            { q: 'مين اللي بنعترف بـ "معمودية واحدة" لمغفرة خطاياهم؟', options: ['اليهود', 'المؤمنون', 'الملائكة', 'الأنبياء'], correct: 1 },
            { q: 'مين اللي "تأنس" من أجلنا؟', options: ['الآب', 'الابن', 'الروح القدس', 'الملاك'], correct: 1 },
            { q: 'مين اللي "منبثق" أزلياً؟', options: ['الآب', 'الابن', 'الروح القدس', 'الملاك'], correct: 2 },
            { q: 'مين "المولود" أزلياً؟', options: ['الآب', 'الابن', 'الروح القدس', 'الملائكة'], correct: 1 },
            { q: 'مين اللي "غير مولود وغير منبثق"؟', options: ['الابن', 'الروح القدس', 'الآب', 'الملاك'], correct: 2 },
            { q: 'مين اللي قال في قانون الإيمان "نعم نؤمن بالروح القدس"؟', options: ['آباء نيقية', 'آباء مجمع القسطنطينية', 'آباء أفسس', 'بولس'], correct: 1 },
            { q: 'مين الشخصية اللي بنسميها "لوجوس"؟', options: ['الآب', 'أقنوم الابن', 'الروح القدس', 'الملاك'], correct: 1 }
        ]
    }
};

// Mini-game state
var miniGameState = {
    type: null,
    index: 0,
    score: 0,
    total: 0,
    answers: [],
    timer: null,
    timeLeft: 0,
    data: null,
    // Who Am I
    clueIndex: 0,
    maxPoints: 0,
    // Sort Verse
    selectedWords: [],
    // Match Pairs
    selectedLeft: null,
    matched: []
};

function getMiniGamesForLesson() {
    var key = level2State.currentSubject + '_' + level2State.currentLesson;
    return LESSON_MINI_GAMES[key] || null;
}

// Render mini-games hub inside learn tab
function renderMiniGamesSection() {
    var games = getMiniGamesForLesson();
    if (!games) {
        // No mini-games data — fallback to old quiz button
        return '<button class="btn btn-primary" onclick="startLevel2Quiz()" style="width:100%;margin-top:16px;">' +
            '<span><i class="fas fa-play"></i> جمّع واكسب ⭐</span></button>';
    }

    var html = '<div class="mini-games-section">';

    // BIG Challenge card — mixed questions from all types
    html += '<div class="mg-challenge-card" onclick="startMixedChallenge()">';
    html += '<div class="mg-challenge-bg"></div>';
    html += '<div class="mg-challenge-content">';
    html += '<div class="mg-challenge-icon"><i class="fas fa-fire"></i></div>';
    html += '<h3>يلا نبتدي! 🏆</h3>';
    html += '<p>أسئلة متنوعة ومتغيرة كل مرة — لو شاطر هتجاوب!</p>';
    html += '<div class="mg-challenge-stats">';
    html += '<span><i class="fas fa-shuffle"></i> أنواع مختلفة</span>';
    html += '<span><i class="fas fa-star"></i> حتى 60 نجمة</span>';
    html += '</div>';
    html += getMiniGameBadge('mixedChallenge');
    html += '</div></div>';

    // Section title
    html += '<div class="mini-games-header">';
    html += '<h3><i class="fas fa-gamepad"></i> أنواع المسابقات</h3>';
    html += '<p>اختار نوع واحد وتحدّى نفسك!</p>';
    html += '</div>';

    html += '<div class="mini-games-grid">';

    if (games.trueFalse) {
        html += '<div class="mini-game-card mg-truefalse" onclick="startMiniGame(\'trueFalse\')">';
        html += '<div class="mg-card-icon"><i class="fas fa-bolt"></i></div>';
        html += '<h4>صح ولا غلط</h4>';
        html += '<p>20 سؤال × 5 ثواني</p>';
        html += '<div class="mg-card-reward"><i class="fas fa-star"></i> حتى 10 نجوم</div>';
        html += getMiniGameBadge('trueFalse');
        html += '</div>';
    }
    if (games.whoAmI) {
        html += '<div class="mini-game-card mg-whoami" onclick="startMiniGame(\'whoAmI\')">';
        html += '<div class="mg-card-icon"><i class="fas fa-user-secret"></i></div>';
        html += '<h4>من أنا؟</h4>';
        html += '<p>' + games.whoAmI.length + ' شخصيات</p>';
        html += '<div class="mg-card-reward"><i class="fas fa-star"></i> حتى 10 نجوم</div>';
        html += getMiniGameBadge('whoAmI');
        html += '</div>';
    }
    if (games.sortVerse) {
        html += '<div class="mini-game-card mg-sort" onclick="startMiniGame(\'sortVerse\')">';
        html += '<div class="mg-card-icon"><i class="fas fa-sort-amount-down"></i></div>';
        html += '<h4>رتّب الآية</h4>';
        html += '<p>' + games.sortVerse.length + ' آيات</p>';
        html += '<div class="mg-card-reward"><i class="fas fa-star"></i> حتى 10 نجوم</div>';
        html += getMiniGameBadge('sortVerse');
        html += '</div>';
    }
    if (games.fillBlank) {
        html += '<div class="mini-game-card mg-fill" onclick="startMiniGame(\'fillBlank\')">';
        html += '<div class="mg-card-icon"><i class="fas fa-pen-fancy"></i></div>';
        html += '<h4>الكلمة الناقصة</h4>';
        html += '<p>' + games.fillBlank.length + ' أسئلة</p>';
        html += '<div class="mg-card-reward"><i class="fas fa-star"></i> حتى 10 نجوم</div>';
        html += getMiniGameBadge('fillBlank');
        html += '</div>';
    }
    if (games.matchPairs) {
        html += '<div class="mini-game-card mg-match" onclick="startMiniGame(\'matchPairs\')">';
        html += '<div class="mg-card-icon"><i class="fas fa-link"></i></div>';
        html += '<h4>وصّل الصح</h4>';
        html += '<p>' + games.matchPairs.length + ' أزواج</p>';
        html += '<div class="mg-card-reward"><i class="fas fa-star"></i> حتى 10 نجوم</div>';
        html += getMiniGameBadge('matchPairs');
        html += '</div>';
    }
    if (games.characters) {
        html += '<div class="mini-game-card mg-characters" onclick="startMiniGame(\'characters\')">';
        html += '<div class="mg-card-icon"><i class="fas fa-users"></i></div>';
        html += '<h4>شخصيات</h4>';
        html += '<p>' + games.characters.length + ' سؤال</p>';
        html += '<div class="mg-card-reward"><i class="fas fa-star"></i> حتى 10 نجوم</div>';
        html += getMiniGameBadge('characters');
        html += '</div>';
    }

    html += '</div>';

    // === NEW INTERACTIVE GAMES SECTION ===
    var iGames = getInteractiveGamesForLesson();
    if (iGames) {
        html += '<div class="mini-games-header" style="margin-top:20px">';
        html += '<h3><i class="fas fa-fire-flame-curved"></i> ألعاب تفاعلية</h3>';
        html += '<p>ألعاب جديدة — قرارات ومغامرات وألغاز!</p>';
        html += '</div>';
        html += '<div class="mini-games-grid interactive-games-grid">';

        if (iGames.courtOfFaith) {
            html += '<div class="mini-game-card mg-court" onclick="startMiniGame(\'courtOfFaith\')">';
            html += '<div class="mg-card-icon"><i class="fas fa-gavel"></i></div>';
            html += '<h4>محكمة الإيمان</h4>';
            html += '<p>دافع عن العقيدة!</p>';
            html += '<div class="mg-card-reward"><i class="fas fa-star"></i> حتى 15 نجمة</div>';
            html += getMiniGameBadge('courtOfFaith');
            html += '</div>';
        }

        if (iGames.creedBuilder) {
            html += '<div class="mini-game-card mg-creed" onclick="startMiniGame(\'creedBuilder\')">';
            html += '<div class="mg-card-icon"><i class="fas fa-building"></i></div>';
            html += '<h4>بناء العقيدة</h4>';
            html += '<p>رتّب العبارات صح!</p>';
            html += '<div class="mg-card-reward"><i class="fas fa-star"></i> حتى 15 نجمة</div>';
            html += getMiniGameBadge('creedBuilder');
            html += '</div>';
        }

        if (iGames.councilJourney) {
            html += '<div class="mini-game-card mg-council" onclick="startMiniGame(\'councilJourney\')">';
            html += '<div class="mg-card-icon"><i class="fas fa-' + iGames.councilJourney.icon + '"></i></div>';
            html += '<h4>' + iGames.councilJourney.title.split('—')[0] + '</h4>';
            html += '<p>اختار طريقك!</p>';
            html += '<div class="mg-card-reward"><i class="fas fa-star"></i> حتى 15 نجمة</div>';
            html += getMiniGameBadge('councilJourney');
            html += '</div>';
        }

        if (iGames.detective) {
            html += '<div class="mini-game-card mg-detective" onclick="startMiniGame(\'detective\')">';
            html += '<div class="mg-card-icon"><i class="fas fa-magnifying-glass"></i></div>';
            html += '<h4>المحقق</h4>';
            html += '<p>اكتشف الأدلة!</p>';
            html += '<div class="mg-card-reward"><i class="fas fa-star"></i> حتى 15 نجمة</div>';
            html += getMiniGameBadge('detective');
            html += '</div>';
        }

        if (iGames.balance) {
            html += '<div class="mini-game-card mg-balance" onclick="startMiniGame(\'balance\')">';
            html += '<div class="mg-card-icon"><i class="fas fa-balance-scale"></i></div>';
            html += '<h4>ميزان الإيمان</h4>';
            html += '<p>صح ولا غلط — حافظ على التوازن!</p>';
            html += '<div class="mg-card-reward"><i class="fas fa-star"></i> حتى 15 نجمة</div>';
            html += getMiniGameBadge('balance');
            html += '</div>';
        }

        html += '</div>';
    }

    html += '</div>';
    return html;
}

// ========== MIXED CHALLENGE ==========
function startMixedChallenge() {
    var games = getMiniGamesForLesson();
    if (!games) return;

    miniGameState = {
        type: 'mixedChallenge',
        index: 0,
        score: 0,
        total: 0,
        answers: [],
        timer: null,
        timeLeft: 0,
        data: null,
        clueIndex: 0,
        maxPoints: 0,
        selectedWords: [],
        selectedLeft: null,
        matched: []
    };

    initAudio();

    // Build mixed round: pick random questions from all types
    var rounds = [];

    // Add 5 true/false questions
    if (games.trueFalse) {
        var tf = games.trueFalse.slice();
        shuffleArray(tf);
        tf.slice(0, 5).forEach(function(q) {
            rounds.push({ type: 'trueFalse', data: q });
        });
    }
    // Add 3 fill-blank
    if (games.fillBlank) {
        var fb = games.fillBlank.slice();
        shuffleArray(fb);
        fb.slice(0, 3).forEach(function(q) {
            rounds.push({ type: 'fillBlank', data: q });
        });
    }
    // Add 2 who-am-i
    if (games.whoAmI) {
        var wai = games.whoAmI.slice();
        shuffleArray(wai);
        wai.slice(0, 2).forEach(function(q) {
            rounds.push({ type: 'whoAmI', data: q });
        });
    }
    // Add 3 characters questions (rendered as MCQ)
    if (games.characters) {
        var chars = games.characters.slice();
        shuffleArray(chars);
        chars.slice(0, 3).forEach(function(q) {
            rounds.push({ type: 'mcq', data: q });
        });
    }
    // Add 2 MCQ from lesson questions
    var subKey = level2State.currentSubject;
    var lesson = LEVEL2_SUBJECTS[subKey].lessons[level2State.currentLesson];
    if (lesson && lesson.questions) {
        var mcqs = lesson.questions.slice();
        shuffleArray(mcqs);
        mcqs.slice(0, 3).forEach(function(q) {
            rounds.push({ type: 'mcq', data: prepareQuestion(q) });
        });
    }

    // Shuffle all rounds
    shuffleArray(rounds);

    miniGameState.data = rounds;
    miniGameState.total = rounds.length * 2; // ~2 points each
    miniGameState.index = 0;
    miniGameState.score = 0;

    renderMixedRound();
}

function shuffleArray(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
}

// Shuffle the options of a question so the correct answer is never in a fixed position
function prepareQuestion(q) {
    var opts = q.options.slice();
    var correctAnswer = opts[q.correct];
    for (var i = opts.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = opts[i]; opts[i] = opts[j]; opts[j] = t;
    }
    return { q: q.q, options: opts, correct: opts.indexOf(correctAnswer) };
}

// Smart question picker: prioritises questions not seen recently, then shuffles options
function getSmartQuestions(allQs, count, historyKey) {
    var history = (GameState.questionHistory && GameState.questionHistory[historyKey]) || [];
    var unseen = [], seen = [];
    allQs.forEach(function(q) {
        (history.indexOf(q.q) >= 0 ? seen : unseen).push(q);
    });
    shuffleArray(unseen);
    shuffleArray(seen);
    var picked = unseen.concat(seen).slice(0, count);
    return picked.map(prepareQuestion);
}

// Record the questions shown in a session so future sessions deprioritise them
function recordQuestionHistory(historyKey, questions) {
    if (!GameState.questionHistory) GameState.questionHistory = {};
    var existing = GameState.questionHistory[historyKey] || [];
    questions.forEach(function(q) {
        if (existing.indexOf(q.q) < 0) existing.push(q.q);
    });
    // Rolling window of last 30
    if (existing.length > 30) existing = existing.slice(existing.length - 30);
    GameState.questionHistory[historyKey] = existing;
    saveToLocalStorage();
}

function renderMixedRound() {
    if (miniGameState.index >= miniGameState.data.length) {
        showMiniGameResult('التحدي المتنوع');
        return;
    }

    var round = miniGameState.data[miniGameState.index];
    var progress = (miniGameState.index + 1) + '/' + miniGameState.data.length;
    var typeLabel = { trueFalse: '⚡ صح ولا غلط', fillBlank: '✏️ الكلمة الناقصة', whoAmI: '🎭 من أنا؟', mcq: '❓ اختر الإجابة' };

    var html = '<div class="mg-progress">' + progress + '</div>';
    html += '<div class="mg-round-type">' + (typeLabel[round.type] || '') + '</div>';

    if (round.type === 'trueFalse') {
        html += '<div class="mg-timer-bar"><div class="mg-timer-fill" id="mg-timer-fill" style="width:100%"></div></div>';
        html += '<div class="mg-tf-statement" id="mg-tf-statement">' + round.data.statement + '</div>';
        html += '<div class="mg-tf-buttons">';
        html += '<button class="mg-tf-btn mg-tf-true" onclick="answerMixedTF(true)"><i class="fas fa-check"></i> صح</button>';
        html += '<button class="mg-tf-btn mg-tf-false" onclick="answerMixedTF(false)"><i class="fas fa-times"></i> غلط</button>';
        html += '</div>';
        renderMiniGameUI('التحدي المتنوع 🔥', 'fire', html);
        // Timer
        miniGameState.timeLeft = 7;
        if (miniGameState.timer) clearInterval(miniGameState.timer);
        miniGameState.timer = setInterval(function() {
            miniGameState.timeLeft -= 0.1;
            var fill = document.getElementById('mg-timer-fill');
            if (fill) fill.style.width = Math.max(0, (miniGameState.timeLeft / 7) * 100) + '%';
            if (miniGameState.timeLeft <= 0) {
                clearInterval(miniGameState.timer);
                answerMixedTF(null);
            }
        }, 100);

    } else if (round.type === 'fillBlank') {
        html += '<div class="mg-timer-bar"><div class="mg-timer-fill" id="mg-timer-fill" style="width:100%"></div></div>';
        var displayText = round.data.text.replace('___', '<span class="mg-fb-blank">؟</span>');
        var opts = round.data.options.slice();
        shuffleArray(opts);
        html += '<div class="mg-fb-text">' + displayText + '</div>';
        html += '<div class="mg-fb-options">';
        opts.forEach(function(opt) {
            html += '<button class="mg-fb-option" onclick="answerMixedFB(\'' + opt.replace(/'/g, "\\'") + '\')">' + opt + '</button>';
        });
        html += '</div>';
        renderMiniGameUI('التحدي المتنوع 🔥', 'fire', html);
        // 20 sec timer
        miniGameState.timeLeft = 20;
        if (miniGameState.timer) clearInterval(miniGameState.timer);
        miniGameState.timer = setInterval(function() {
            miniGameState.timeLeft -= 0.1;
            var fill = document.getElementById('mg-timer-fill');
            if (fill) fill.style.width = Math.max(0, (miniGameState.timeLeft / 20) * 100) + '%';
            if (miniGameState.timeLeft <= 0) {
                clearInterval(miniGameState.timer);
                answerMixedFB(null);
            }
        }, 100);

    } else if (round.type === 'whoAmI') {
        miniGameState.clueIndex = 0;
        miniGameState.maxPoints = 4;
        var item = round.data;
        html += '<div class="mg-wai-card">';
        html += '<div class="mg-wai-icon"><i class="fas fa-user-secret"></i></div>';
        html += '<h4>من أنا؟</h4>';
        html += '<div class="mg-wai-clues" id="mg-wai-clues">';
        html += '<div class="mg-wai-clue visible">💡 ' + item.clues[0] + '</div>';
        for (var i = 1; i < item.clues.length; i++) {
            html += '<div class="mg-wai-clue hidden" id="mg-clue-' + i + '">💡 ' + item.clues[i] + '</div>';
        }
        html += '</div>';
        html += '<div class="mg-wai-points" id="mg-wai-points">🏆 ' + miniGameState.maxPoints + ' نقاط</div>';
        html += '<div class="mg-wai-actions">';
        html += '<button class="btn btn-secondary mg-wai-hint-btn" id="mg-hint-btn" onclick="mixedWhoAmIHint()"><span><i class="fas fa-eye"></i> تلميح (-1)</span></button>';
        html += '<button class="btn btn-primary mg-wai-answer-btn" onclick="mixedWhoAmIGuess()"><span><i class="fas fa-lightbulb"></i> أعرفه!</span></button>';
        html += '</div></div>';
        renderMiniGameUI('التحدي المتنوع 🔥', 'fire', html);

    } else if (round.type === 'mcq') {
        var q = round.data;
        html += '<div class="mg-timer-bar"><div class="mg-timer-fill" id="mg-timer-fill" style="width:100%"></div></div>';
        html += '<div class="mg-tf-statement">' + q.q + '</div>';
        html += '<div class="mg-mcq-options">';
        q.options.forEach(function(opt, idx) {
            html += '<button class="mg-fb-option" onclick="answerMixedMCQ(' + idx + ')">' + opt + '</button>';
        });
        html += '</div>';
        renderMiniGameUI('التحدي المتنوع 🔥', 'fire', html);
        // 20 sec timer
        miniGameState.timeLeft = 20;
        if (miniGameState.timer) clearInterval(miniGameState.timer);
        miniGameState.timer = setInterval(function() {
            miniGameState.timeLeft -= 0.1;
            var fill = document.getElementById('mg-timer-fill');
            if (fill) fill.style.width = Math.max(0, (miniGameState.timeLeft / 20) * 100) + '%';
            if (miniGameState.timeLeft <= 0) {
                clearInterval(miniGameState.timer);
                answerMixedMCQ(-1);
            }
        }, 100);
    }
}

function answerMixedTF(answer) {
    if (miniGameState.timer) clearInterval(miniGameState.timer);
    var round = miniGameState.data[miniGameState.index];
    var correct = answer === round.data.answer;
    // Character power: shield
    if (!correct && activePowers.shield) {
        activePowers.shield = false;
        correct = true; // Shield absorbs the wrong answer
        showToast('🛡️ درع الإيمان حماك!', 'success');
    }
    showAnswerFeedback(correct);
    if (correct) {
        var pts = activePowers.doublePoints ? 4 : 2;
        if (activePowers.doublePoints) { activePowers.doublePoints = false; showToast('🪨 نقاط مضاعفة!', 'success'); }
        miniGameState.score += pts; playCorrectSound(); vibrate(50);
    }
    else { playWrongSound(); vibrate([50, 30, 50]); }
    var stmt = document.getElementById('mg-tf-statement');
    if (stmt) {
        stmt.style.background = correct ? 'rgba(0,184,148,0.2)' : 'rgba(255,107,107,0.2)';
        stmt.style.borderColor = correct ? '#00B894' : '#FF6B6B';
    }
    var scoreEl = document.getElementById('mg-score');
    if (scoreEl) scoreEl.textContent = miniGameState.score;
    miniGameState.index++;
    setTimeout(renderMixedRound, 600);
}

function answerMixedFB(answer) {
    if (miniGameState.timer) clearInterval(miniGameState.timer);
    var round = miniGameState.data[miniGameState.index];
    var correct = answer === round.data.blank;
    if (!correct && activePowers.shield) { activePowers.shield = false; correct = true; showToast('🛡️ درع الإيمان حماك!', 'success'); }
    showAnswerFeedback(correct);
    if (correct) {
        var pts = activePowers.doublePoints ? 4 : 2;
        if (activePowers.doublePoints) { activePowers.doublePoints = false; showToast('🪨 نقاط مضاعفة!', 'success'); }
        miniGameState.score += pts; playCorrectSound(); vibrate(50);
    }
    else { playWrongSound(); vibrate([50, 30, 50]); showToast('الكلمة الصح: ' + round.data.blank, 'error'); }
    var blank = document.querySelector('.mg-fb-blank');
    if (blank) {
        blank.textContent = round.data.blank;
        blank.style.background = correct ? 'rgba(0,184,148,0.3)' : 'rgba(255,107,107,0.3)';
        blank.style.color = correct ? '#00B894' : '#FF6B6B';
    }
    var scoreEl = document.getElementById('mg-score');
    if (scoreEl) scoreEl.textContent = miniGameState.score;
    miniGameState.index++;
    setTimeout(renderMixedRound, 800);
}

function answerMixedMCQ(idx) {
    if (miniGameState.timer) clearInterval(miniGameState.timer);
    var round = miniGameState.data[miniGameState.index];
    var correct = idx === round.data.correct;
    if (!correct && activePowers.shield) { activePowers.shield = false; correct = true; showToast('🛡️ درع الإيمان حماك!', 'success'); }
    showAnswerFeedback(correct);
    if (correct) {
        var pts = activePowers.doublePoints ? 4 : 2;
        if (activePowers.doublePoints) { activePowers.doublePoints = false; showToast('🪨 نقاط مضاعفة!', 'success'); }
        miniGameState.score += pts; playCorrectSound(); vibrate(50);
    }
    else { playWrongSound(); vibrate([50, 30, 50]); showToast('الإجابة: ' + round.data.options[round.data.correct], 'error'); }
    var scoreEl = document.getElementById('mg-score');
    if (scoreEl) scoreEl.textContent = miniGameState.score;
    miniGameState.index++;
    setTimeout(renderMixedRound, 800);
}

function mixedWhoAmIHint() {
    var round = miniGameState.data[miniGameState.index];
    var item = round.data;
    miniGameState.clueIndex++;
    miniGameState.maxPoints = Math.max(1, 4 - miniGameState.clueIndex);
    if (miniGameState.clueIndex < item.clues.length) {
        var el = document.getElementById('mg-clue-' + miniGameState.clueIndex);
        if (el) { el.classList.remove('hidden'); el.classList.add('visible'); }
    }
    var pts = document.getElementById('mg-wai-points');
    if (pts) pts.innerHTML = '🏆 ' + miniGameState.maxPoints + ' نقاط';
    if (miniGameState.clueIndex >= item.clues.length - 1) {
        var btn = document.getElementById('mg-hint-btn');
        if (btn) btn.style.display = 'none';
    }
}

function mixedWhoAmIGuess() {
    var round = miniGameState.data[miniGameState.index];
    var item = round.data;
    // Build options
    var allGames = getMiniGamesForLesson();
    var allAnswers = allGames.whoAmI.map(function(d) { return d.answer; });
    var wrong = allAnswers.filter(function(a) { return a !== item.answer; });
    shuffleArray(wrong);
    var options = [item.answer, wrong[0] || 'إجابة خاطئة', wrong[1] || 'إجابة خاطئة 2'];
    shuffleArray(options);

    var overlay = document.createElement('div');
    overlay.id = 'mg-guess-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;font-family:Cairo,sans-serif;direction:rtl';

    var btnsHtml = '';
    options.forEach(function(opt) {
        btnsHtml += '<button onclick="checkMixedWhoAmI(\'' + opt.replace(/'/g, "\\'") + '\')" style="width:100%;background:rgba(255,255,255,0.08);border:1px solid var(--border);color:var(--text-primary);border-radius:12px;padding:14px;font-family:Cairo;font-size:15px;font-weight:700;cursor:pointer;margin-bottom:8px">' + opt + '</button>';
    });

    overlay.innerHTML = '<div style="background:var(--bg-card);border-radius:20px;padding:24px;max-width:340px;width:100%;text-align:center">' +
        '<h3 style="color:var(--text-primary);margin:0 0 16px">من هو؟</h3>' + btnsHtml +
        '<button onclick="document.getElementById(\'mg-guess-overlay\').remove()" style="background:none;border:none;color:var(--text-muted);font-family:Cairo;font-size:13px;cursor:pointer;margin-top:4px">إلغاء</button></div>';
    document.body.appendChild(overlay);
}

function checkMixedWhoAmI(guess) {
    var overlay = document.getElementById('mg-guess-overlay');
    if (overlay) overlay.remove();
    var round = miniGameState.data[miniGameState.index];
    var correct = guess === round.data.answer;
    if (correct) {
        miniGameState.score += miniGameState.maxPoints;
        playCorrectSound();
        showToast('✅ صح! ' + round.data.answer + ' (+' + miniGameState.maxPoints + ')', 'success');
    } else {
        playWrongSound();
        showToast('❌ الإجابة: ' + round.data.answer, 'error');
    }
    var scoreEl = document.getElementById('mg-score');
    if (scoreEl) scoreEl.textContent = miniGameState.score;
    miniGameState.index++;
    setTimeout(renderMixedRound, 1000);
}

function getMiniGameBadge(type) {
    var key = level2State.currentSubject + '_' + level2State.currentLesson + '_mg_' + type;
    var best = GameState.miniGameScores && GameState.miniGameScores[key];
    if (best) {
        return '<div class="mg-card-best"><i class="fas fa-trophy"></i> ' + best + '</div>';
    }
    return '<div class="mg-card-new">جديد!</div>';
}

// Station scoring: max 80 per station (10 sermon + 10 summary + 60 games)
// Games: mixed challenge max 60, or 6 mini-games × 10 each = 60
// Best score is always kept (max of old vs new)
var STATION_MAX_SCORE = 80;
var STATION_GAMES_MAX = 60;
var STATION_SERMON_SCORE = 10;
var STATION_SUMMARY_SCORE = 10;
var STATION_UNLOCK_THRESHOLD = 70; // 70-80 to unlock next station

// Global station progress bar - appears below tabs in ALL stages
function getStationProgressHTML() {
    var stationKey = level2State.currentSubject + '_' + level2State.currentLesson;
    var stScore = getStationScore(stationKey);
    var pct = Math.min(stScore.total / STATION_MAX_SCORE * 100, 100);
    var scoreColor = stScore.total >= STATION_UNLOCK_THRESHOLD ? '#00B894' : 'var(--gold)';
    var html = '<div class="station-progress-global" id="station-progress-live">';
    html += '<div class="station-progress-row">';
    html += '<span class="station-progress-label">نتيجة المحطة</span>';
    html += '<span class="station-progress-badges">';
    html += '<span class="sp-badge ' + (stScore.sermon > 0 ? 'done' : '') + '">🎬 ' + stScore.sermon + '</span>';
    html += '<span class="sp-badge ' + (stScore.summary > 0 ? 'done' : '') + '">📝 ' + stScore.summary + '</span>';
    html += '<span class="sp-badge ' + (stScore.games > 0 ? 'done' : '') + '">🎮 ' + stScore.games + '</span>';
    html += '</span>';
    html += '<span class="station-progress-score" style="color:' + scoreColor + '">' + stScore.total + '/' + STATION_MAX_SCORE + '</span>';
    html += '</div>';
    html += '<div class="station-progress-bar"><div class="station-progress-fill" style="width:' + pct + '%"></div></div>';
    html += '</div>';
    return html;
}

function liveRefreshStationProgress() {
    var el = document.getElementById('station-progress-live');
    if (!el) return;
    var stationKey = level2State.currentSubject + '_' + level2State.currentLesson;
    var stScore = getStationScore(stationKey);
    var pct = Math.min(stScore.total / STATION_MAX_SCORE * 100, 100);
    var scoreColor = stScore.total >= STATION_UNLOCK_THRESHOLD ? '#00B894' : 'var(--gold)';
    el.innerHTML =
        '<div class="station-progress-row">' +
        '<span class="station-progress-label">نتيجة المحطة</span>' +
        '<span class="station-progress-badges">' +
        '<span class="sp-badge ' + (stScore.sermon > 0 ? 'done' : '') + '">🎬 ' + stScore.sermon + '</span>' +
        '<span class="sp-badge ' + (stScore.summary > 0 ? 'done' : '') + '">📝 ' + stScore.summary + '</span>' +
        '<span class="sp-badge ' + (stScore.games > 0 ? 'done' : '') + '">🎮 ' + stScore.games + '</span>' +
        '</span>' +
        '<span class="station-progress-score" style="color:' + scoreColor + '">' + stScore.total + '/' + STATION_MAX_SCORE + '</span>' +
        '</div>' +
        '<div class="station-progress-bar"><div class="station-progress-fill" style="width:' + pct + '%"></div></div>';
    // Animate fill bar
    var fill = el.querySelector('.station-progress-fill');
    if (fill) {
        fill.style.width = '0%';
        setTimeout(function() { fill.style.width = pct + '%'; }, 50);
    }
}

function getStationKey() {
    return level2State.currentSubject + '_' + level2State.currentLesson;
}

function getStationScore(stationKey) {
    if (!GameState.stationScores) GameState.stationScores = {};
    return GameState.stationScores[stationKey] || { sermon: 0, summary: 0, games: 0, total: 0 };
}

function updateStationScore(stationKey, field, newScore) {
    if (!GameState.stationScores) GameState.stationScores = {};
    var current = GameState.stationScores[stationKey] || { sermon: 0, summary: 0, games: 0, total: 0 };

    // Keep best score (max)
    var maxForField = field === 'sermon' ? STATION_SERMON_SCORE : (field === 'summary' ? STATION_SUMMARY_SCORE : STATION_GAMES_MAX);
    var cappedScore = Math.min(newScore, maxForField);

    if (cappedScore > current[field]) {
        current[field] = cappedScore;
    }

    current.total = Math.min(current.sermon + current.summary + current.games, STATION_MAX_SCORE);
    GameState.stationScores[stationKey] = current;
    saveToLocalStorage(true); // Save locally but skip cloud (callers handle cloud save)
    return current;
}

function saveMiniGameScore(type, score) {
    var stationKey = getStationKey();
    var mgKey = stationKey + '_mg_' + type;
    if (!GameState.miniGameScores) GameState.miniGameScores = {};
    var prev = GameState.miniGameScores[mgKey] || 0;

    // Keep best score
    if (score > prev) {
        GameState.miniGameScores[mgKey] = score;
    }

    // Calculate total games score for this station from all mini-games
    var totalGamesScore = 0;
    var gameTypes = ['trueFalse', 'whoAmI', 'sortVerse', 'fillBlank', 'matchPairs', 'characters', 'mixedChallenge'];
    gameTypes.forEach(function(gt) {
        var k = stationKey + '_mg_' + gt;
        var s = GameState.miniGameScores[k] || 0;
        if (gt === 'mixedChallenge') {
            // Mixed challenge alone can fill the full games score
            totalGamesScore = Math.max(totalGamesScore, Math.min(s, STATION_GAMES_MAX));
        } else {
            totalGamesScore += s; // Direct contribution — no per-game cap
        }
    });
    // Cap total at 60
    totalGamesScore = Math.min(totalGamesScore, STATION_GAMES_MAX);

    // Update station score (games portion)
    var stScore = updateStationScore(stationKey, 'games', totalGamesScore);

    // Live-refresh progress bar immediately
    liveRefreshStationProgress();

    // Check if station just crossed unlock threshold (first time)
    var prevStScore = getStationScore(stationKey);
    var justUnlocked = prevStScore.total < STATION_UNLOCK_THRESHOLD && stScore.total >= STATION_UNLOCK_THRESHOLD;

    // Award gems based on score
    var gemsEarned = Math.floor(score / 4);
    if (gemsEarned > 0) {
        GameState.gems = (GameState.gems || 0) + gemsEarned;
        showFloatingReward('+' + gemsEarned + ' 💎');
    }

    // Save to both local and cloud
    saveToLocalStorage(); // This triggers saveToCloud() as well

    // Station unlock celebration
    if (justUnlocked) {
        setTimeout(function() {
            showCelebration('🏆', 'فتحت المحطة الجاية!', '#00B894');
            launchConfetti(3000);
        }, 500);
    }
}

// ========== START MINI GAME ==========
function startMiniGame(type) {
    if (type === 'mixedChallenge') { startMixedChallenge(); return; }

    // New interactive game types — data is in INTERACTIVE_GAMES, not LESSON_MINI_GAMES
    var interactiveTypes = ['courtOfFaith', 'creedBuilder', 'councilJourney', 'detective', 'balance'];
    if (interactiveTypes.indexOf(type) !== -1) {
        initAudio();
        if (type === 'courtOfFaith') startCourtOfFaith();
        else if (type === 'creedBuilder') startCreedBuilder();
        else if (type === 'councilJourney') startCouncilJourney();
        else if (type === 'detective') startDetective();
        else if (type === 'balance') startBalance();
        return;
    }

    var games = getMiniGamesForLesson();
    if (!games || !games[type]) return;

    miniGameState = {
        type: type,
        index: 0,
        score: 0,
        total: 0,
        answers: [],
        timer: null,
        timeLeft: 0,
        data: null,
        clueIndex: 0,
        maxPoints: 0,
        selectedWords: [],
        selectedLeft: null,
        matched: []
    };

    initAudio();

    if (type === 'trueFalse') startTrueFalseGame(games.trueFalse);
    else if (type === 'whoAmI') startWhoAmIGame(games.whoAmI);
    else if (type === 'sortVerse') startSortVerseGame(games.sortVerse);
    else if (type === 'fillBlank') startFillBlankGame(games.fillBlank);
    else if (type === 'matchPairs') startMatchPairsGame(games.matchPairs);
    else if (type === 'characters') startCharactersGame(games.characters);
}

// Characters game - MCQ-style quiz about characters
function startCharactersGame(data) {
    var questions = data.slice();
    shuffleArray(questions);
    questions = questions.slice(0, 15); // Pick 15 random
    miniGameState.data = questions;
    miniGameState.total = questions.length;
    miniGameState.index = 0;
    renderCharactersQuestion();
}

function renderCharactersQuestion() {
    if (miniGameState.index >= miniGameState.data.length) {
        showMiniGameResult('شخصيات');
        return;
    }
    var q = miniGameState.data[miniGameState.index];
    var progress = (miniGameState.index + 1) + '/' + miniGameState.data.length;
    var opts = q.options.slice();
    var correctText = opts[q.correct];
    shuffleArray(opts);
    var newCorrect = opts.indexOf(correctText);

    var html = '<div class="mg-progress">' + progress + '</div>';
    html += '<div class="mg-round-type"><i class="fas fa-users"></i> شخصيات</div>';
    html += '<div class="mg-question-text">' + q.q + '</div>';
    html += '<div class="mg-mcq-options">';
    opts.forEach(function(opt, i) {
        html += '<button class="mg-mcq-btn" onclick="answerCharactersQ(' + i + ',' + newCorrect + ')">' + opt + '</button>';
    });
    html += '</div>';
    renderMiniGameUI('شخصيات', 'users', html);
}

function answerCharactersQ(selected, correct) {
    var btns = document.querySelectorAll('.mg-mcq-btn');
    btns.forEach(function(btn, i) {
        btn.onclick = null;
        if (i === correct) btn.classList.add('mg-correct');
        if (i === selected && selected !== correct) btn.classList.add('mg-wrong');
    });
    showAnswerFeedback(selected === correct);
    if (selected === correct) {
        miniGameState.score += 2;
        updateMGScore();
        if (typeof playCorrectSound === 'function') playCorrectSound();
    } else {
        if (typeof playWrongSound === 'function') playWrongSound();
    }
    setTimeout(function() {
        miniGameState.index++;
        renderCharactersQuestion();
    }, 1200);
}

function renderMiniGameUI(title, icon, bodyHtml) {
    var container = document.getElementById('l2-lesson-body');
    if (!container) return;
    var html = '<div class="mini-game-screen">';
    html += '<div class="mg-header">';
    html += '<div class="mg-title"><i class="fas fa-' + icon + '"></i> ' + title + '</div>';
    html += '<div class="mg-score-bar">النقاط: <strong id="mg-score">' + miniGameState.score + '</strong></div>';
    html += '</div>';
    // Character power button
    html += getCharPowerButtonHTML();
    html += '<div class="mg-body" id="mg-body">' + bodyHtml + '</div>';
    html += '</div>';
    container.innerHTML = html;
}

function showMiniGameResult(title) {
    if (miniGameState.timer) clearInterval(miniGameState.timer);
    saveMiniGameScore(miniGameState.type, miniGameState.score);

    var pct = miniGameState.total > 0 ? Math.round((miniGameState.score / miniGameState.total) * 100) : 0;
    var emoji = pct >= 90 ? '🏆' : (pct >= 70 ? '🌟' : (pct >= 50 ? '👏' : '💪'));
    var message = pct >= 90 ? 'ممتاز! أداء رائع!' : (pct >= 70 ? 'برافو عليك!' : (pct >= 50 ? 'كويس، كمّل!' : 'حاول تاني هتعمل أحسن!'));

    // Get station score
    var stationKey = getStationKey();
    var stScore = getStationScore(stationKey);

    var html = '<div class="mg-result">';
    html += '<div class="mg-result-emoji">' + emoji + '</div>';
    html += '<h3>' + title + '</h3>';
    html += '<div class="mg-result-score">' + miniGameState.score + ' / ' + miniGameState.total + '</div>';
    html += '<div class="mg-result-message" style="color:var(--gold);font-size:16px;margin:8px 0">' + message + '</div>';

    // Show station score progress bar
    html += '<div class="mg-station-score" style="margin:12px 0;padding:12px;background:rgba(108,92,231,0.15);border-radius:12px;text-align:center">';
    html += '<div style="font-size:13px;color:var(--text-muted);margin-bottom:6px">نتيجة المحطة</div>';
    html += '<div style="font-size:24px;font-weight:800;color:' + (stScore.total >= STATION_UNLOCK_THRESHOLD ? '#00B894' : 'var(--gold)') + '">' + stScore.total + ' / ' + STATION_MAX_SCORE + '</div>';
    html += '<div style="height:8px;background:rgba(255,255,255,0.1);border-radius:4px;margin-top:8px;overflow:hidden">';
    html += '<div style="height:100%;width:' + Math.min(stScore.total / STATION_MAX_SCORE * 100, 100) + '%;background:linear-gradient(90deg,#6C5CE7,#00CEC9);border-radius:4px;transition:width 1s"></div>';
    html += '</div>';
    html += '<div style="display:flex;justify-content:space-around;margin-top:8px;font-size:11px;color:var(--text-muted)">';
    html += '<span>🎬 ' + stScore.sermon + '/10</span>';
    html += '<span>📝 ' + stScore.summary + '/10</span>';
    html += '<span>🎮 ' + stScore.games + '/60</span>';
    html += '</div>';
    if (stScore.total >= STATION_UNLOCK_THRESHOLD) {
        html += '<div style="color:#00B894;font-size:13px;margin-top:6px"><i class="fas fa-unlock"></i> المحطة الجاية مفتوحة!</div>';
    } else {
        html += '<div style="color:var(--text-muted);font-size:13px;margin-top:6px">🔒 محتاج ' + (STATION_UNLOCK_THRESHOLD - stScore.total) + ' نقطة كمان لفتح المحطة الجاية</div>';
    }
    html += '</div>';

    html += '<div class="mg-result-btns">';
    var replayType = miniGameState.type;
    html += '<button class="btn btn-primary" onclick="startMiniGame(\'' + replayType + '\')"><span><i class="fas fa-redo"></i> العب تاني</span></button>';
    html += '<button class="btn btn-secondary" onclick="miniGameState.type=null;level2State.currentStage=\'games\';renderLevel2Lesson()"><span><i class="fas fa-arrow-right"></i> رجوع</span></button>';
    html += '</div></div>';

    var body = document.getElementById('mg-body');
    if (body) body.innerHTML = html;
    else renderMiniGameUI(title, 'trophy', html);

    if (pct >= 50) launchConfetti(1500);
    if (pct >= 80) {
        setTimeout(function() { launchConfetti(1500); }, 800);
        showCelebration(pct >= 95 ? '🏆' : '🌟', pct >= 95 ? 'مثالي! ما شاء الله!' : 'رائع جداً! برافو عليك!', '#FDCB6E');
    } else if (pct >= 60) {
        showCelebration('👏', 'شاطر! كمّل كده!', '#6C5CE7');
    }
}

// ========== TRUE/FALSE BLITZ ==========
function startTrueFalseGame(data) {
    var shuffled = data.slice();
    for (var i = shuffled.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = t;
    }
    miniGameState.data = shuffled.slice(0, 20);
    miniGameState.total = 20;
    miniGameState.index = 0;
    miniGameState.score = 0;
    miniGameState.timeLeft = 5;
    renderTrueFalseQ();
}

function renderTrueFalseQ() {
    if (miniGameState.index >= miniGameState.data.length) {
        showMiniGameResult('صح ولا غلط');
        return;
    }
    var q = miniGameState.data[miniGameState.index];
    var progress = (miniGameState.index + 1) + '/' + miniGameState.data.length;

    var html = '<div class="mg-progress">' + progress + '</div>';
    html += '<div class="mg-timer-bar"><div class="mg-timer-fill" id="mg-timer-fill" style="width:100%"></div></div>';
    html += '<div class="mg-tf-statement" id="mg-tf-statement">' + q.statement + '</div>';
    html += '<div class="mg-tf-buttons">';
    html += '<button class="mg-tf-btn mg-tf-true" onclick="answerTrueFalse(true)"><i class="fas fa-check"></i> صح</button>';
    html += '<button class="mg-tf-btn mg-tf-false" onclick="answerTrueFalse(false)"><i class="fas fa-times"></i> غلط</button>';
    html += '</div>';

    renderMiniGameUI('صح ولا غلط ⚡', 'bolt', html);

    // Start timer
    miniGameState.timeLeft = 5;
    if (miniGameState.timer) clearInterval(miniGameState.timer);
    miniGameState.timer = setInterval(function() {
        miniGameState.timeLeft -= 0.1;
        var fill = document.getElementById('mg-timer-fill');
        if (fill) fill.style.width = Math.max(0, (miniGameState.timeLeft / 5) * 100) + '%';
        if (miniGameState.timeLeft <= 0) {
            clearInterval(miniGameState.timer);
            answerTrueFalse(null); // Time's up
        }
    }, 100);
}

function answerTrueFalse(answer) {
    if (miniGameState.timer) clearInterval(miniGameState.timer);
    var q = miniGameState.data[miniGameState.index];
    var correct = answer === q.answer;

    showAnswerFeedback(correct);

    if (correct) {
        miniGameState.score++;
        playCorrectSound();
        vibrate(50);
    } else {
        playWrongSound();
        vibrate([50, 30, 50]);
    }

    // Flash feedback
    var stmt = document.getElementById('mg-tf-statement');
    if (stmt) {
        stmt.style.background = correct ? 'rgba(0,184,148,0.2)' : 'rgba(255,107,107,0.2)';
        stmt.style.borderColor = correct ? '#00B894' : '#FF6B6B';
    }

    // Update score display
    var scoreEl = document.getElementById('mg-score');
    if (scoreEl) scoreEl.textContent = miniGameState.score;

    miniGameState.index++;
    setTimeout(renderTrueFalseQ, 600);
}

// ========== WHO AM I? ==========
function startWhoAmIGame(data) {
    miniGameState.data = data.slice();
    miniGameState.total = data.length * 4; // Max 4 points per character
    miniGameState.index = 0;
    miniGameState.score = 0;
    renderWhoAmIQ();
}

function renderWhoAmIQ() {
    if (miniGameState.index >= miniGameState.data.length) {
        showMiniGameResult('من أنا؟');
        return;
    }
    var item = miniGameState.data[miniGameState.index];
    miniGameState.clueIndex = 0;
    miniGameState.maxPoints = 4;

    var html = '<div class="mg-progress">' + (miniGameState.index + 1) + '/' + miniGameState.data.length + '</div>';
    html += '<div class="mg-wai-card">';
    html += '<div class="mg-wai-icon"><i class="fas fa-user-secret"></i></div>';
    html += '<h4>من أنا؟</h4>';
    html += '<div class="mg-wai-clues" id="mg-wai-clues">';
    html += '<div class="mg-wai-clue visible">💡 ' + item.clues[0] + '</div>';
    for (var i = 1; i < item.clues.length; i++) {
        html += '<div class="mg-wai-clue hidden" id="mg-clue-' + i + '">💡 ' + item.clues[i] + '</div>';
    }
    html += '</div>';
    html += '<div class="mg-wai-points" id="mg-wai-points">🏆 ' + miniGameState.maxPoints + ' نقاط</div>';
    html += '<div class="mg-wai-actions">';
    html += '<button class="btn btn-secondary mg-wai-hint-btn" id="mg-hint-btn" onclick="whoAmIHint()"><span><i class="fas fa-eye"></i> تلميح تاني (-1 نقطة)</span></button>';
    html += '<button class="btn btn-primary mg-wai-answer-btn" onclick="whoAmIGuess()"><span><i class="fas fa-lightbulb"></i> أعرفه!</span></button>';
    html += '</div></div>';

    renderMiniGameUI('من أنا؟ 🎭', 'user-secret', html);
}

function whoAmIHint() {
    var item = miniGameState.data[miniGameState.index];
    miniGameState.clueIndex++;
    miniGameState.maxPoints = Math.max(1, 4 - miniGameState.clueIndex);

    if (miniGameState.clueIndex < item.clues.length) {
        var clueEl = document.getElementById('mg-clue-' + miniGameState.clueIndex);
        if (clueEl) { clueEl.classList.remove('hidden'); clueEl.classList.add('visible'); }
    }

    var pointsEl = document.getElementById('mg-wai-points');
    if (pointsEl) pointsEl.innerHTML = '🏆 ' + miniGameState.maxPoints + ' نقاط';

    // Hide hint button if no more clues
    if (miniGameState.clueIndex >= item.clues.length - 1) {
        var hintBtn = document.getElementById('mg-hint-btn');
        if (hintBtn) hintBtn.style.display = 'none';
    }
}

function whoAmIGuess() {
    var item = miniGameState.data[miniGameState.index];
    // Show input modal
    var overlay = document.createElement('div');
    overlay.id = 'mg-guess-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;font-family:Cairo,sans-serif;direction:rtl';

    // Build options (correct + 2 random wrong)
    var allAnswers = miniGameState.data.map(function(d) { return d.answer; });
    var wrongAnswers = allAnswers.filter(function(a) { return a !== item.answer; });
    // Shuffle wrong answers and take 2
    for (var i = wrongAnswers.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = wrongAnswers[i]; wrongAnswers[i] = wrongAnswers[j]; wrongAnswers[j] = t;
    }
    var options = [item.answer, wrongAnswers[0] || 'إجابة خاطئة', wrongAnswers[1] || 'إجابة خاطئة 2'];
    // Shuffle options
    for (var i = options.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = options[i]; options[i] = options[j]; options[j] = t;
    }

    var btnsHtml = '';
    options.forEach(function(opt) {
        btnsHtml += '<button onclick="checkWhoAmI(\'' + opt.replace(/'/g, "\\'") + '\')" style="width:100%;background:rgba(255,255,255,0.08);border:1px solid var(--border);color:var(--text-primary);border-radius:12px;padding:14px;font-family:Cairo;font-size:15px;font-weight:700;cursor:pointer;margin-bottom:8px;transition:all 0.2s">' + opt + '</button>';
    });

    overlay.innerHTML = '<div style="background:var(--bg-card);border-radius:20px;padding:24px;max-width:340px;width:100%;text-align:center">' +
        '<h3 style="color:var(--text-primary);margin:0 0 16px">من هو؟</h3>' +
        btnsHtml +
        '<button onclick="document.getElementById(\'mg-guess-overlay\').remove()" style="background:none;border:none;color:var(--text-muted);font-family:Cairo;font-size:13px;cursor:pointer;margin-top:4px">إلغاء</button></div>';
    document.body.appendChild(overlay);
}

function checkWhoAmI(guess) {
    var overlay = document.getElementById('mg-guess-overlay');
    if (overlay) overlay.remove();

    var item = miniGameState.data[miniGameState.index];
    var correct = guess === item.answer;

    if (correct) {
        miniGameState.score += miniGameState.maxPoints;
        playCorrectSound();
        showToast('✅ صح! ' + item.answer + ' (+' + miniGameState.maxPoints + ')', 'success');
    } else {
        playWrongSound();
        showToast('❌ الإجابة الصح: ' + item.answer, 'error');
    }

    var scoreEl = document.getElementById('mg-score');
    if (scoreEl) scoreEl.textContent = miniGameState.score;

    miniGameState.index++;
    setTimeout(renderWhoAmIQ, 1000);
}

// ========== SORT THE VERSE ==========
function startSortVerseGame(data) {
    miniGameState.data = data.slice();
    miniGameState.total = data.length * 5;
    miniGameState.index = 0;
    miniGameState.score = 0;
    renderSortVerseQ();
}

function renderSortVerseQ() {
    if (miniGameState.index >= miniGameState.data.length) {
        showMiniGameResult('رتّب الآية');
        return;
    }
    var item = miniGameState.data[miniGameState.index];
    var words = item.full.split(' ');
    miniGameState.selectedWords = [];

    // Shuffle words
    var shuffled = words.slice();
    for (var i = shuffled.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = t;
    }

    var html = '<div class="mg-progress">' + (miniGameState.index + 1) + '/' + miniGameState.data.length + '</div>';
    html += '<div class="mg-sv-ref"><i class="fas fa-book-bible"></i> ' + item.ref + '</div>';
    html += '<div class="mg-sv-result" id="mg-sv-result"><span class="mg-sv-placeholder">اضغط على الكلمات بالترتيب الصح...</span></div>';
    html += '<div class="mg-sv-words" id="mg-sv-words">';
    shuffled.forEach(function(w, idx) {
        html += '<button class="mg-sv-word" data-word="' + w + '" data-idx="' + idx + '" onclick="selectSortWord(this)">' + w + '</button>';
    });
    html += '</div>';
    html += '<div class="mg-sv-actions">';
    html += '<button class="btn btn-secondary" onclick="resetSortVerse()"><span><i class="fas fa-undo"></i> إعادة</span></button>';
    html += '<button class="btn btn-primary" onclick="checkSortVerse()"><span><i class="fas fa-check"></i> تأكيد</span></button>';
    html += '</div>';

    renderMiniGameUI('رتّب الآية 📖', 'sort-amount-down', html);
}

function selectSortWord(btn) {
    if (btn.classList.contains('used')) return;
    btn.classList.add('used');
    miniGameState.selectedWords.push(btn.getAttribute('data-word'));

    var result = document.getElementById('mg-sv-result');
    if (result) {
        result.innerHTML = miniGameState.selectedWords.map(function(w) {
            return '<span class="mg-sv-selected">' + w + '</span>';
        }).join(' ');
    }
}

function resetSortVerse() {
    miniGameState.selectedWords = [];
    var result = document.getElementById('mg-sv-result');
    if (result) result.innerHTML = '<span class="mg-sv-placeholder">اضغط على الكلمات بالترتيب الصح...</span>';
    document.querySelectorAll('.mg-sv-word').forEach(function(btn) { btn.classList.remove('used'); });
}

function checkSortVerse() {
    var item = miniGameState.data[miniGameState.index];
    var correctWords = item.full.split(' ');
    var userWords = miniGameState.selectedWords;

    if (userWords.length !== correctWords.length) {
        showToast('رتّب كل الكلمات الأول!', 'error');
        return;
    }

    var correct = true;
    for (var i = 0; i < correctWords.length; i++) {
        if (correctWords[i] !== userWords[i]) { correct = false; break; }
    }

    if (correct) {
        miniGameState.score += 5;
        playCorrectSound();
        showToast('✅ ممتاز! الآية صح!', 'success');
    } else {
        playWrongSound();
        showToast('❌ الترتيب الصح: ' + item.full, 'error');
    }

    var scoreEl = document.getElementById('mg-score');
    if (scoreEl) scoreEl.textContent = miniGameState.score;

    miniGameState.index++;
    setTimeout(renderSortVerseQ, 1500);
}

// ========== FILL IN THE BLANK ==========
function startFillBlankGame(data) {
    var shuffled = data.slice();
    for (var i = shuffled.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = t;
    }
    miniGameState.data = shuffled;
    miniGameState.total = data.length * 2;
    miniGameState.index = 0;
    miniGameState.score = 0;
    renderFillBlankQ();
}

function renderFillBlankQ() {
    if (miniGameState.index >= miniGameState.data.length) {
        showMiniGameResult('الكلمة الناقصة');
        return;
    }
    var q = miniGameState.data[miniGameState.index];
    var displayText = q.text.replace('___', '<span class="mg-fb-blank">؟</span>');

    // Shuffle options
    var opts = q.options.slice();
    for (var i = opts.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = opts[i]; opts[i] = opts[j]; opts[j] = t;
    }

    var html = '<div class="mg-progress">' + (miniGameState.index + 1) + '/' + miniGameState.data.length + '</div>';
    html += '<div class="mg-fb-text">' + displayText + '</div>';
    html += '<div class="mg-fb-options">';
    opts.forEach(function(opt) {
        html += '<button class="mg-fb-option" onclick="answerFillBlank(\'' + opt.replace(/'/g, "\\'") + '\')">' + opt + '</button>';
    });
    html += '</div>';

    renderMiniGameUI('الكلمة الناقصة ✏️', 'pen-fancy', html);
}

function answerFillBlank(answer) {
    var q = miniGameState.data[miniGameState.index];
    var correct = answer === q.blank;

    showAnswerFeedback(correct);

    if (correct) {
        miniGameState.score += 2;
        playCorrectSound();
        vibrate(50);
    } else {
        playWrongSound();
        vibrate([50, 30, 50]);
        showToast('الكلمة الصح: ' + q.blank, 'error');
    }

    // Visual feedback on blank
    var blank = document.querySelector('.mg-fb-blank');
    if (blank) {
        blank.textContent = q.blank;
        blank.style.background = correct ? 'rgba(0,184,148,0.3)' : 'rgba(255,107,107,0.3)';
        blank.style.color = correct ? '#00B894' : '#FF6B6B';
    }

    var scoreEl = document.getElementById('mg-score');
    if (scoreEl) scoreEl.textContent = miniGameState.score;

    miniGameState.index++;
    setTimeout(renderFillBlankQ, 800);
}

// ========== MATCH PAIRS ==========
function startMatchPairsGame(data) {
    miniGameState.data = data.slice();
    miniGameState.total = data.length * 2;
    miniGameState.score = 0;
    miniGameState.matched = [];
    miniGameState.selectedLeft = null;
    renderMatchPairs();
}

function renderMatchPairs() {
    var data = miniGameState.data;
    var matched = miniGameState.matched;

    if (matched.length === data.length) {
        showMiniGameResult('وصّل الصح');
        return;
    }

    // Shuffle right side
    var rightItems = data.map(function(d, i) { return { text: d.right, idx: i }; });
    for (var i = rightItems.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = rightItems[i]; rightItems[i] = rightItems[j]; rightItems[j] = t;
    }

    var html = '<div class="mg-progress">' + matched.length + '/' + data.length + ' متصلين</div>';
    html += '<div class="mg-mp-container">';

    // Left column
    html += '<div class="mg-mp-col mg-mp-left">';
    data.forEach(function(d, idx) {
        var isMatched = matched.indexOf(idx) >= 0;
        var isSelected = miniGameState.selectedLeft === idx;
        html += '<button class="mg-mp-item' + (isMatched ? ' matched' : '') + (isSelected ? ' selected' : '') + '" ' +
            (isMatched ? 'disabled' : 'onclick="selectMatchLeft(' + idx + ')"') + '>' + d.left + '</button>';
    });
    html += '</div>';

    // Right column
    html += '<div class="mg-mp-col mg-mp-right">';
    rightItems.forEach(function(item) {
        var isMatched = matched.indexOf(item.idx) >= 0;
        html += '<button class="mg-mp-item' + (isMatched ? ' matched' : '') + '" ' +
            (isMatched ? 'disabled' : 'onclick="selectMatchRight(' + item.idx + ')"') + '>' + item.text + '</button>';
    });
    html += '</div>';

    html += '</div>';

    renderMiniGameUI('وصّل الصح 🔗', 'link', html);
}

function selectMatchLeft(idx) {
    miniGameState.selectedLeft = idx;
    // Re-render to show selection
    renderMatchPairs();
}

function selectMatchRight(rightIdx) {
    if (miniGameState.selectedLeft === null) {
        showToast('اختار من الشمال الأول!', 'info');
        return;
    }

    var leftIdx = miniGameState.selectedLeft;
    var correct = leftIdx === rightIdx;

    if (correct) {
        miniGameState.matched.push(leftIdx);
        miniGameState.score += 2;
        playCorrectSound();
        vibrate(50);
    } else {
        playWrongSound();
        vibrate([50, 30, 50]);
    }

    miniGameState.selectedLeft = null;

    var scoreEl = document.getElementById('mg-score');
    if (scoreEl) scoreEl.textContent = miniGameState.score;

    setTimeout(renderMatchPairs, 500);
}

// ========== PULL TO REFRESH ==========
var pullToRefreshState = { startY: 0, pulling: false };

function initPullToRefresh() {
    var indicator = document.createElement('div');
    indicator.id = 'ptr-indicator';
    indicator.style.cssText = 'position:fixed;top:0;left:0;right:0;height:0;background:linear-gradient(135deg,var(--primary),#a29bfe);z-index:9999;transition:height 0.2s;display:flex;align-items:center;justify-content:center;overflow:hidden;font-family:Cairo,sans-serif;color:#fff;font-weight:700;font-size:14px';
    indicator.innerHTML = '<i class="fas fa-sync-alt" id="ptr-icon" style="margin-left:8px"></i> اسحب للتحديث';
    document.body.appendChild(indicator);

    document.addEventListener('touchstart', function(e) {
        if (window.scrollY === 0) {
            pullToRefreshState.startY = e.touches[0].clientY;
            pullToRefreshState.pulling = true;
        }
    }, { passive: true });

    document.addEventListener('touchmove', function(e) {
        if (!pullToRefreshState.pulling) return;
        var diff = e.touches[0].clientY - pullToRefreshState.startY;
        if (diff > 0 && diff < 150) {
            var ind = document.getElementById('ptr-indicator');
            if (ind) {
                ind.style.height = Math.min(diff * 0.5, 50) + 'px';
                if (diff > 80) {
                    ind.innerHTML = '<i class="fas fa-sync-alt fa-spin" style="margin-left:8px"></i> حرر للتحديث';
                }
            }
        }
    }, { passive: true });

    document.addEventListener('touchend', function() {
        if (!pullToRefreshState.pulling) return;
        var ind = document.getElementById('ptr-indicator');
        var h = ind ? parseInt(ind.style.height) : 0;

        if (h >= 40) {
            // Trigger refresh
            if (ind) {
                ind.innerHTML = '<i class="fas fa-sync-alt fa-spin" style="margin-left:8px"></i> جاري التحديث...';
                ind.style.height = '40px';
            }
            setTimeout(function() {
                window.location.reload();
            }, 600);
        } else {
            if (ind) ind.style.height = '0';
        }
        pullToRefreshState.pulling = false;
    });
}

// Init pull to refresh on load
if ('ontouchstart' in window) {
    document.addEventListener('DOMContentLoaded', initPullToRefresh);
}

// --- Lesson Summary Tab ---
function showLessonSummaryTab() {
    var container = document.getElementById('l2-lesson-body');
    if (!container) return;

    var subKey = level2State.currentSubject;
    var lessonIdx = level2State.currentLesson;
    var subject = LEVEL2_SUBJECTS[subKey];
    var lesson = subject.lessons[lessonIdx];

    var html = '<div class="l2-stage-tabs">' +
        '<button class="l2-stage-tab completed" onclick="level2State.currentStage=\'learn\'; renderLevel2Lesson()"><i class="fas fa-check"></i> تعلّم</button>' +
        '<button class="l2-stage-tab active"><i class="fas fa-pen"></i> تلخيص</button>' +
        '<button class="l2-stage-tab"><i class="fas fa-gamepad"></i> ألعاب</button>' +
        '<button class="l2-stage-tab"><i class="fas fa-trophy"></i> النتيجة</button>' +
        '</div>';

    // Global station progress
    html += getStationProgressHTML();

    html += '<div class="l2-summary-section">';
    html += '<h3><i class="fas fa-pen-fancy"></i> تلخيص درس: ' + lesson.name + '</h3>';
    html += '<p class="l2-summary-hint">لخّص الدرس بكلامك أو حط صورة أو سجّل صوتك</p>';

    // Text input
    html += '<label class="l2-summary-label"><i class="fas fa-keyboard"></i> اكتب تلخيص</label>';
    html += '<textarea id="lesson-summary-text" class="input-field" placeholder="اكتب تلخيص بسيط للدرس..." rows="4"></textarea>';

    // Image upload
    html += '<label class="l2-summary-label"><i class="fas fa-camera"></i> أضف صورة</label>';
    html += '<label class="l2-summary-upload-btn">';
    html += '<input type="file" accept="image/*" onchange="handleLessonSummaryImage(event)" style="display:none">';
    html += '<span class="btn btn-secondary" style="width:100%"><span><i class="fas fa-image"></i> اختار صورة من الجاليري أو التقط صورة</span></span>';
    html += '</label>';
    html += '<div id="lesson-summary-img-preview"></div>';

    // Audio record
    html += '<label class="l2-summary-label"><i class="fas fa-microphone"></i> سجّل صوتك</label>';
    html += '<div class="l2-summary-audio-section">';
    html += '<button class="btn btn-secondary" id="lesson-record-btn" onclick="toggleLessonRecording()" style="width:100%">';
    html += '<span><i class="fas fa-microphone"></i> ابدأ التسجيل</span></button>';
    html += '<div id="lesson-recording-status"></div>';
    html += '<div id="lesson-audio-preview"></div>';
    html += '</div>';

    // Submit button - different text if re-editing
    var summaryKey = subKey + '_' + lessonIdx;
    var alreadyHasSummary = GameState.lessonSummaries && GameState.lessonSummaries[summaryKey];
    if (alreadyHasSummary) {
        html += '<button class="btn btn-primary" onclick="submitLessonSummary()" style="width:100%;margin-top:16px;">' +
            '<span><i class="fas fa-save"></i> حفظ التعديلات</span></button>';
    } else {
        html += '<button class="btn btn-primary" onclick="submitLessonSummary()" style="width:100%;margin-top:16px;">' +
            '<span><i class="fas fa-paper-plane"></i> سلّم التلخيص (+10 نقاط)</span></button>';
    }

    html += '</div>';

    container.innerHTML = html;

    // Pre-fill existing data after DOM is ready
    if (alreadyHasSummary) {
        setTimeout(function() {
            // Pre-fill text
            var ta = document.getElementById('lesson-summary-text');
            if (ta && alreadyHasSummary.text) ta.value = alreadyHasSummary.text;

            // Pre-fill image
            if (alreadyHasSummary.image) {
                var imgPreview = document.getElementById('lesson-summary-img-preview');
                if (imgPreview) {
                    imgPreview.innerHTML = '<img src="' + alreadyHasSummary.image + '" class="l2-summary-preview-img"><button class="l2-summary-remove-img" onclick="this.parentElement.innerHTML=\'\'; window._lessonSummaryImage=null;">✕</button>';
                    window._lessonSummaryImage = alreadyHasSummary.image;
                }
            }

            // Pre-fill audio
            if (alreadyHasSummary.audio) {
                var audioPreview = document.getElementById('lesson-audio-preview');
                if (audioPreview) {
                    audioPreview.innerHTML = '<audio controls src="' + alreadyHasSummary.audio + '" style="width:100%;margin-top:8px"></audio><button class="btn btn-sm" onclick="this.previousElementSibling.remove();this.remove();window._lessonSummaryAudio=null;" style="margin-top:4px;font-size:11px;color:#FF6B6B">🗑️ حذف التسجيل</button>';
                    window._lessonSummaryAudio = alreadyHasSummary.audio;
                }
            }
        }, 50);
    }
}

var lessonRecorder = null;
var lessonAudioChunks = [];
var lessonRecordingActive = false;

function handleLessonSummaryImage(event) {
    var file = event.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
        var preview = document.getElementById('lesson-summary-img-preview');
        if (preview) {
            preview.innerHTML = '<img src="' + e.target.result + '" class="l2-summary-preview-img"><button class="l2-summary-remove-img" onclick="this.parentElement.innerHTML=\'\'; window._lessonSummaryImage=null;">✕</button>';
            window._lessonSummaryImage = e.target.result;
        }
    };
    reader.readAsDataURL(file);
}

function toggleLessonRecording() {
    if (lessonRecordingActive) {
        // Stop recording
        if (lessonRecorder && lessonRecorder.state === 'recording') {
            lessonRecorder.stop();
        }
        lessonRecordingActive = false;
        var btn = document.getElementById('lesson-record-btn');
        if (btn) btn.innerHTML = '<span><i class="fas fa-microphone"></i> ابدأ التسجيل</span>';
        var status = document.getElementById('lesson-recording-status');
        if (status) status.innerHTML = '';
    } else {
        // Start recording
        navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
            lessonRecorder = new MediaRecorder(stream);
            lessonAudioChunks = [];
            lessonRecorder.ondataavailable = function(e) { lessonAudioChunks.push(e.data); };
            lessonRecorder.onstop = function() {
                var blob = new Blob(lessonAudioChunks, { type: 'audio/webm' });
                var url = URL.createObjectURL(blob);
                var preview = document.getElementById('lesson-audio-preview');
                if (preview) {
                    preview.innerHTML = '<audio controls src="' + url + '"></audio>';
                }
                // Convert to base64 for storage
                var reader = new FileReader();
                reader.onload = function() { window._lessonSummaryAudio = reader.result; };
                reader.readAsDataURL(blob);
                stream.getTracks().forEach(function(t) { t.stop(); });
            };
            lessonRecorder.start();
            lessonRecordingActive = true;
            var btn = document.getElementById('lesson-record-btn');
            if (btn) btn.innerHTML = '<span><i class="fas fa-stop" style="color:#e74c3c"></i> وقّف التسجيل</span>';
            var status = document.getElementById('lesson-recording-status');
            if (status) status.innerHTML = '<span class="recording-indicator"><i class="fas fa-circle" style="color:red;animation:blink 1s infinite"></i> جاري التسجيل...</span>';
        }).catch(function(err) {
            showToast('مش قادر أفتح الميكروفون - اسمح بالأذن', 'error');
        });
    }
}

function submitLessonSummary() {
    var subKey = level2State.currentSubject;
    var lessonIdx = level2State.currentLesson;
    var summaryKey = subKey + '_' + lessonIdx;

    var textEl = document.getElementById('lesson-summary-text');
    var text = textEl ? textEl.value.trim() : '';
    var image = window._lessonSummaryImage || null;
    var audio = window._lessonSummaryAudio || null;

    if (!text && !image && !audio) {
        showToast('لازم تكتب حاجة أو تحط صورة أو تسجل صوت!', 'error');
        return;
    }

    if (!GameState.lessonSummaries) GameState.lessonSummaries = {};
    var alreadySubmitted = GameState.lessonSummaries[summaryKey];
    GameState.lessonSummaries[summaryKey] = {
        text: text,
        image: image,
        audio: audio,
        date: getTodayKey()
    };

    // Only award station score on FIRST submission
    if (!alreadySubmitted) {
        var stationKey = subKey + '_' + lessonIdx;
        updateStationScore(stationKey, 'summary', STATION_SUMMARY_SCORE);
        GameState.gems = (GameState.gems || 0) + 3;
        showToast('تم حفظ التلخيص! +10 نقاط للمحطة + 3 جواهر 💎', 'success');
    } else {
        showToast('تم تحديث التلخيص! ✅', 'success');
    }
    window._lessonSummaryImage = null;
    window._lessonSummaryAudio = null;

    saveToLocalStorage(); // This will also trigger saveToCloud()

    // Re-render learn stage
    level2State.currentStage = 'learn';
    renderLevel2Lesson();
}

// --- Mark Video as Watched & Award Stars ---
function markVideoWatched(videoKey) {
    if (GameState.watchedVideos && GameState.watchedVideos[videoKey]) return; // already rewarded
    if (!GameState.watchedVideos) GameState.watchedVideos = {};
    GameState.watchedVideos[videoKey] = true;

    // Determine if this station has both short + detailed videos
    var stationKey = getStationKey();
    var baseKey = level2State.currentSubject + '_lesson_' + level2State.currentLesson;
    var shortKey = baseKey + '_short_video';
    var detailKey = baseKey + '_video';
    var shortWatched = GameState.watchedVideos[shortKey] || false;
    var detailWatched = GameState.watchedVideos[detailKey] || false;
    var totalSermon = (shortWatched ? 5 : 0) + (detailWatched ? 5 : 0);

    // If lesson has both videos, use combined score; otherwise use 10
    var lesson = LEVEL2_SUBJECTS[level2State.currentSubject] && LEVEL2_SUBJECTS[level2State.currentSubject].lessons[level2State.currentLesson];
    if (lesson && lesson.shortVideoId) {
        updateStationScore(stationKey, 'sermon', totalSermon);
    } else {
        updateStationScore(stationKey, 'sermon', STATION_SERMON_SCORE);
    }

    var isShort = videoKey.indexOf('_short_video') >= 0;
    GameState.gems = (GameState.gems || 0) + 3;
    saveToLocalStorage();
    showAchievement('🎬', isShort ? 'شاهدت الملخص!' : 'شاهدت الوعظة!', 'كسبت 5 نقاط للمحطة + 3 جواهر 💎');
    // Re-render to show watched badge
    setTimeout(function() { renderLevel2Lesson(); }, 2000);
}

// --- Start Quiz ---
function startLevel2Quiz() {
    // Anti-farming cooldown check
    var _subKey = level2State.currentSubject;
    var _lessonIdx = level2State.currentLesson;
    if (!canAttemptQuiz(_subKey, _lessonIdx)) {
        var remaining = getCooldownRemaining(_subKey, _lessonIdx);
        var mins = Math.ceil(remaining / 60000);
        showToast('استنى ' + mins + ' دقيقة قبل ما تحاول تاني ⏳', 'warning');
        return;
    }

    level2State.currentStage = 'quiz';
    level2State.quizIndex = 0;
    level2State.quizScore = 0;
    level2State.quizAnswers = [];
    level2State.combo = 0;
    level2State.maxCombo = 0;
    level2State.totalPoints = 0;
    level2State.speedBonuses = 0;
    // Initialize audio on first user interaction
    initAudio();

    // Smart-shuffle and pick 20 questions from the bank (prioritise unseen, shuffle options)
    var subKey = level2State.currentSubject;
    var lesson = LEVEL2_SUBJECTS[subKey].lessons[level2State.currentLesson];
    var histKey = subKey + '_' + level2State.currentLesson;
    level2State.activeQuestions = getSmartQuestions(lesson.questions, 20, histKey);
    level2State.examMode = false;
    renderLevel2Lesson();
}

// --- Start Weekly Exam (no powerups, no feedback, one-time) ---
function startLevel2Exam(lessonIdx) {
    var subKey = level2State.currentSubject;
    var subject = LEVEL2_SUBJECTS[subKey];
    if (!subject || !subject.lessons[lessonIdx]) return;

    // Check if already taken
    if (GameState.level2Data && GameState.level2Data[subKey] &&
        GameState.level2Data[subKey]['exam_' + lessonIdx]) {
        showToast('الامتحان ده اتعمل قبل كده - مره واحده بس!', 'error');
        return;
    }

    level2State.currentLesson = lessonIdx;
    level2State.currentStage = 'quiz';
    level2State.quizIndex = 0;
    level2State.quizScore = 0;
    level2State.quizAnswers = [];
    level2State.combo = 0;
    level2State.maxCombo = 0;
    level2State.totalPoints = 0;
    level2State.speedBonuses = 0;
    level2State.examMode = true;
    initAudio();

    // Smart-shuffle and pick 20 questions (prioritise unseen, shuffle options)
    var lesson = subject.lessons[lessonIdx];
    var histKey = level2State.currentSubject + '_' + lessonIdx;
    level2State.activeQuestions = getSmartQuestions(lesson.questions, 20, histKey);

    showScreen('level2-lesson-screen');
    renderLevel2Lesson();
}

// --- Quiz Stage ---
function renderLevel2Quiz(container, lesson, subject) {
    var qIdx = level2State.quizIndex;
    var questions = level2State.activeQuestions || lesson.questions;
    if (qIdx >= questions.length) {
        // Quiz finished
        level2State.currentStage = 'result';
        renderLevel2Lesson();
        return;
    }

    level2State.answered = false; // Reset answered flag for new question

    var q = questions[qIdx];
    var total = questions.length;

    // Progress tabs
    var html = '<div class="l2-stage-tabs">' +
        '<button class="l2-stage-tab completed"><i class="fas fa-check"></i> تعلّم</button>' +
        '<button class="l2-stage-tab completed"><i class="fas fa-check"></i> ألعاب</button>' +
        '<button class="l2-stage-tab active"><i class="fas fa-question-circle"></i> اختبار</button>' +
        '<button class="l2-stage-tab"><i class="fas fa-trophy"></i> النتيجة</button>' +
        '</div>';

    // Progress dots
    html += '<div class="l2-quiz-progress">';
    for (var d = 0; d < total; d++) {
        var dotClass = 'l2-quiz-dot';
        if (d === qIdx) dotClass += ' active';
        else if (d < qIdx) dotClass += (level2State.quizAnswers[d] ? ' correct' : ' wrong');
        html += '<div class="' + dotClass + '"></div>';
    }
    html += '</div>';

    // Timer bar + countdown number
    html += '<div class="l2-timer-row">';
    html += '<div class="l2-timer-number" id="l2-timer-number">20</div>';
    html += '<div class="l2-timer-bar"><div class="l2-timer-fill" id="l2-timer-fill" style="width:100%"></div></div>';
    html += '</div>';

    // Power-ups bar (hidden in exam mode)
    if (!level2State.examMode) {
        html += '<div class="l2-powerups-bar">';
        html += '<button class="powerup-btn" data-type="fiftyFifty" onclick="usePowerUp(\'fiftyFifty\')" title="' + POWER_UPS.fiftyFifty.desc + '">' +
            '<i class="fas ' + POWER_UPS.fiftyFifty.icon + '"></i><span class="powerup-cost">' + POWER_UPS.fiftyFifty.cost + '⭐</span></button>';
        html += '<button class="powerup-btn" data-type="extraTime" onclick="usePowerUp(\'extraTime\')" title="' + POWER_UPS.extraTime.desc + '">' +
            '<i class="fas ' + POWER_UPS.extraTime.icon + '"></i><span class="powerup-cost">' + POWER_UPS.extraTime.cost + '⭐</span></button>';
        html += '<button class="powerup-btn" data-type="skipQ" onclick="usePowerUp(\'skipQ\')" title="' + POWER_UPS.skipQ.desc + '">' +
            '<i class="fas ' + POWER_UPS.skipQ.icon + '"></i><span class="powerup-cost">' + POWER_UPS.skipQ.cost + '⭐</span></button>';
        html += '</div>';
    } else {
        html += '<div class="exam-mode-badge"><i class="fas fa-scroll"></i> وضع الامتحان - مفيش وسائل مساعدة</div>';
    }

    // Question with entrance animation
    html += '<div class="l2-quiz-container quiz-entrance-anim">';
    html += '<p style="text-align:center;color:var(--text-muted);font-size:12px;margin:0 0 8px;">سؤال ' + (qIdx + 1) + ' من ' + total + '</p>';
    html += '<p class="l2-quiz-question">' + q.q + '</p>';
    html += '<div class="l2-quiz-options">';
    for (var o = 0; o < q.options.length; o++) {
        html += '<button class="l2-quiz-option option-entrance" style="animation-delay:' + (o * 0.1) + 's" data-idx="' + o + '" onclick="answerLevel2Quiz(' + o + ')">' + q.options[o] + '</button>';
    }
    html += '</div></div>';

    // Combo indicator (if active)
    if (level2State.combo >= 2) {
        html += '<div class="l2-combo-indicator">' +
            '<span class="combo-fire-icon">' + (level2State.combo >= 5 ? '🔥🔥🔥' : (level2State.combo >= 3 ? '🔥🔥' : '🔥')) + '</span>' +
            '<span class="combo-x">' + level2State.combo + 'x</span>' +
            '</div>';
    }

    container.innerHTML = html;

    // Record question start time for speed bonus
    level2State.questionStartTime = Date.now();

    // Start timer (20 seconds per question)
    level2State.timeLeft = 20;
    if (level2State.timerInterval) clearInterval(level2State.timerInterval);
    var timerFill = document.getElementById('l2-timer-fill');
    var timerNum = document.getElementById('l2-timer-number');
    level2State.timerInterval = setInterval(function() {
        level2State.timeLeft--;
        var pct = Math.max(0, level2State.timeLeft / 20 * 100);
        if (timerFill) timerFill.style.width = pct + '%';
        if (timerNum) {
            timerNum.textContent = Math.max(0, level2State.timeLeft);
            // Color change when time is low
            if (level2State.timeLeft <= 5) {
                timerNum.classList.add('timer-danger');
                timerNum.classList.add('timer-pulse');
                playTickSound(); // Tick sound in last 5 seconds
                vibrate(30); // Short vibrate
            } else if (level2State.timeLeft <= 10) {
                timerNum.classList.add('timer-warning');
            }
        }
        if (level2State.timeLeft <= 0) {
            clearInterval(level2State.timerInterval);
            answerLevel2Quiz(-1);
        }
    }, 1000);
}

// --- Answer Quiz ---
function answerLevel2Quiz(selectedIdx) {
    // Prevent double-tap
    if (level2State.answered) return;
    level2State.answered = true;

    if (level2State.timerInterval) clearInterval(level2State.timerInterval);

    var subKey = level2State.currentSubject;
    var lesson = LEVEL2_SUBJECTS[subKey].lessons[level2State.currentLesson];
    var q = (level2State.activeQuestions || lesson.questions)[level2State.quizIndex];
    var isCorrect = selectedIdx === q.correct;

    // Calculate speed bonus
    var answerTime = level2State.questionStartTime ? (Date.now() - level2State.questionStartTime) / 1000 : 20;
    var speedBonus = 0;
    if (isCorrect && answerTime < 3) { speedBonus = 5; }
    else if (isCorrect && answerTime < 5) { speedBonus = 3; }
    else if (isCorrect && answerTime < 8) { speedBonus = 1; }

    // Score tracking
    if (isCorrect) {
        level2State.quizScore++;
    }

    level2State.quizAnswers.push(isCorrect);

    // EXAM MODE: no feedback, no celebrations, just record and advance
    if (level2State.examMode) {
        // Just highlight selected option briefly
        var options = document.querySelectorAll('.l2-quiz-option');
        options.forEach(function(opt) {
            opt.classList.add('disabled');
            var idx = parseInt(opt.getAttribute('data-idx'));
            if (idx === selectedIdx) opt.classList.add('selected-exam');
        });
        setTimeout(function() {
            level2State.quizIndex++;
            level2State.answered = false;
            renderLevel2Lesson();
        }, 500);
        return;
    }

    // PRACTICE MODE: full feedback
    // Combo system
    if (isCorrect) {
        level2State.combo++;
        if (level2State.combo > level2State.maxCombo) level2State.maxCombo = level2State.combo;

        // Calculate points with combo multiplier
        var basePoints = 10;
        var comboMultiplier = Math.min(level2State.combo, 5);
        var totalPts = basePoints + (speedBonus * 2) + (comboMultiplier > 1 ? comboMultiplier * 2 : 0);
        level2State.totalPoints += totalPts;
        if (speedBonus > 0) level2State.speedBonuses++;

        // Show score popup
        showScorePopup(totalPts, level2State.combo >= 2, level2State.combo);

        // Show combo display if streak
        if (level2State.combo >= 2) {
            updateComboDisplay(level2State.combo);
            if (level2State.combo >= 3) playComboSound(level2State.combo);
            else playCorrectSound();
        } else {
            playCorrectSound();
        }

        // Haptic - short buzz
        vibrate(50);

        // Speed bonus indicator
        if (speedBonus > 0) {
            var speedEl = document.createElement('div');
            speedEl.className = 'speed-bonus-popup';
            speedEl.textContent = '⚡ سريع! +' + (speedBonus * 2);
            document.body.appendChild(speedEl);
            setTimeout(function() { speedEl.remove(); }, 1200);
        }
    } else {
        level2State.combo = 0; // Reset combo
        playWrongSound();
        vibrate([50, 30, 50]); // Double vibrate for wrong
    }

    // Highlight correct/wrong with animations
    var options = document.querySelectorAll('.l2-quiz-option');
    options.forEach(function(opt) {
        opt.classList.add('disabled');
        var idx = parseInt(opt.getAttribute('data-idx'));
        if (idx === q.correct) {
            opt.classList.add('correct');
            opt.classList.add('correct-pop');
        }
        else if (idx === selectedIdx && !isCorrect) {
            opt.classList.add('wrong');
            opt.classList.add('wrong-shake');
        }
    });

    // Show celebration or wrong feedback + encouraging message
    if (isCorrect) {
        showCorrectCelebration();
        showEncourageMsg(true);
        // Auto-advance after delay for correct answers
        setTimeout(function() {
            level2State.quizIndex++;
            level2State.answered = false;
            renderLevel2Lesson();
        }, 1500);
    } else {
        showWrongFeedback();
        showEncourageMsg(false);
        // Show correct answer explanation + continue button for wrong answers
        var quizContainer = document.querySelector('.l2-quiz-container');
        if (quizContainer) {
            var correctText = q.options[q.correct];
            var explanationEl = document.createElement('div');
            explanationEl.className = 'l2-wrong-explanation';
            // Build explanation: use question-specific if available, otherwise generate from context
            var explainText = '';
            if (q.explanation) {
                explainText = q.explanation;
            } else {
                // Auto-generate explanation from question + correct answer
                explainText = 'السؤال كان: "' + q.q + '" والإجابة الصحيحة هي "' + correctText + '"';
                if (q.options[selectedIdx]) {
                    explainText += '، وليس "' + q.options[selectedIdx] + '"';
                }
                explainText += '. حاول تتذكر المعلومة دي كويس!';
            }
            explanationEl.innerHTML = '<div class="wrong-explain-icon">📖</div>' +
                '<p class="wrong-explain-text">الإجابة الصحيحة هي:</p>' +
                '<p class="wrong-explain-answer">' + correctText + '</p>' +
                '<div class="wrong-explain-detail"><i class="fas fa-info-circle"></i> ' + explainText + '</div>' +
                '<button class="btn btn-primary wrong-continue-btn" onclick="continueAfterWrong()"><span>تمام فهمت، كمّل <i class="fas fa-arrow-left"></i></span></button>';
            quizContainer.appendChild(explanationEl);
        }
    }
}

function continueAfterWrong() {
    level2State.quizIndex++;
    level2State.answered = false;
    renderLevel2Lesson();
}

// --- Result Stage ---
function renderLevel2Result(container, lesson, subject) {
    // Record which questions were shown so future sessions deprioritise them
    if (level2State.activeQuestions && level2State.activeQuestions.length) {
        var _histKey = level2State.currentSubject + '_' + level2State.currentLesson;
        recordQuestionHistory(_histKey, level2State.activeQuestions);
    }

    var total = (level2State.activeQuestions || lesson.questions).length;
    var score = level2State.quizScore;
    var percentage = Math.round(score / total * 100);

    // Calculate stars out of 30 (station max = 30 stars)
    var MAX_STATION_STARS = 30;
    var stars = Math.round(percentage / 100 * MAX_STATION_STARS);

    // Save progress (keep best score) with anti-farming
    if (!GameState.level2Data) GameState.level2Data = {};
    if (!GameState.level2Data[level2State.currentSubject]) GameState.level2Data[level2State.currentSubject] = {};
    var existingData = GameState.level2Data[level2State.currentSubject]['lesson_' + level2State.currentLesson] || {};
    var existingStars = existingData.stars || 0;
    var currentAttempts = existingData.attempts || 0;

    if (level2State.examMode) {
        // Subject-level exam
        if (level2State.subjectExamKey) {
            if (!GameState.level2Data[level2State.subjectExamKey]) {
                GameState.level2Data[level2State.subjectExamKey] = {
                    stars: stars, score: score, total: total, date: new Date().toISOString()
                };
                GameState.stars += stars;
                awardXP(50, 'exam complete');
                if (percentage >= 90) awardXP(100, 'exam perfect');
                saveToCloud();
                syncLeaderboard();
            }
        } else if (level2State.currentLesson >= 0) {
            // Lesson-level exam
            if (!GameState.level2Data[level2State.currentSubject]['exam_' + level2State.currentLesson]) {
                GameState.level2Data[level2State.currentSubject]['exam_' + level2State.currentLesson] = {
                    stars: stars, score: score, total: total, date: new Date().toISOString()
                };
                GameState.stars += stars;
                awardXP(50, 'exam complete');
                if (percentage >= 90) awardXP(100, 'exam perfect');
                saveToCloud();
                syncLeaderboard();
            }
        }
    } else {
        // Practice mode: anti-farming diminishing returns
        var attemptNum = currentAttempts + 1;
        var diminishingFactor = getDiminishingFactor(attemptNum);
        var adjustedStars = Math.round(stars * diminishingFactor);

        // Check first-time perfect bonus (before incrementing attempts)
        checkFirstTimePerfect(level2State.currentSubject, level2State.currentLesson, percentage);

        // Keep best score, but new score is multiplied by diminishing factor before comparing
        if (adjustedStars > existingStars) {
            GameState.level2Data[level2State.currentSubject]['lesson_' + level2State.currentLesson] = {
                stars: adjustedStars, score: score, total: total,
                attempts: attemptNum,
                lastAttemptTime: Date.now(),
                firstAttemptPerfect: existingData.firstAttemptPerfect || false
            };
            var newStars = adjustedStars - existingStars;
            GameState.stars += newStars;
            GameState.gems += Math.ceil(adjustedStars / 10);
        } else {
            // Still track attempts and cooldown even if score didn't improve
            var _existing = GameState.level2Data[level2State.currentSubject]['lesson_' + level2State.currentLesson];
            if (!_existing) {
                GameState.level2Data[level2State.currentSubject]['lesson_' + level2State.currentLesson] = { stars: 0 };
                _existing = GameState.level2Data[level2State.currentSubject]['lesson_' + level2State.currentLesson];
            }
            _existing.attempts = attemptNum;
            _existing.lastAttemptTime = Date.now();
        }

        // XP for completing a station quiz
        awardXP(50, 'station complete');
        if (percentage >= 90 && attemptNum === 1) awardXP(100, 'first attempt perfect');

        // Update stars variable for display (show adjusted)
        stars = adjustedStars;

        saveToCloud();
        syncLeaderboard();
    }

    var starRatio = stars / MAX_STATION_STARS;
    var icon = starRatio >= 0.9 ? '🏆' : (starRatio >= 0.7 ? '⭐' : (starRatio >= 0.4 ? '👍' : '😔'));
    var title = starRatio >= 0.9 ? 'ممتاز! أداء رائع!' : (starRatio >= 0.7 ? 'أحسنت! كويس جداً' : (starRatio >= 0.4 ? 'محتاج تذاكر أكتر' : 'حاول تاني يا بطل!'));

    // Play sound based on result
    if (starRatio >= 0.7) {
        playVictorySound();
    } else if (starRatio >= 0.4) {
        playCorrectSound();
    }

    var html = '<div class="l2-stage-tabs">' +
        '<button class="l2-stage-tab completed"><i class="fas fa-check"></i> تعلّم</button>' +
        '<button class="l2-stage-tab completed"><i class="fas fa-check"></i> ألعاب</button>' +
        '<button class="l2-stage-tab active"><i class="fas fa-trophy"></i> النتيجة</button>' +
        '</div>';

    html += '<div class="l2-result-card">';
    if (level2State.examMode) {
        html += '<div class="exam-result-badge"><i class="fas fa-scroll"></i> نتيجة الامتحان الأسبوعي</div>';
    }
    html += '<div class="l2-result-icon">' + icon + '</div>';
    html += '<h2 class="l2-result-title">' + title + '</h2>';
    html += '<p class="l2-result-subtitle">' + (level2State.examMode ? 'امتحان: ' : 'درس: ') + lesson.name + '</p>';

    // Stars display - show earned out of 30
    html += '<div class="l2-result-stars-30">';
    html += '<div class="stars-30-fill" style="width:' + (stars / MAX_STATION_STARS * 100) + '%"></div>';
    html += '<span class="stars-30-text">⭐ ' + stars + ' / ' + MAX_STATION_STARS + '</span>';
    html += '</div>';

    // Stats
    html += '<div class="l2-result-stats">';
    html += '<div class="l2-result-stat"><div class="l2-result-stat-value">' + score + '/' + total + '</div><div class="l2-result-stat-label">إجابات صحيحة</div></div>';
    html += '<div class="l2-result-stat"><div class="l2-result-stat-value">' + percentage + '%</div><div class="l2-result-stat-label">النسبة</div></div>';
    if (!level2State.examMode && level2State.maxCombo >= 2) {
        html += '<div class="l2-result-stat"><div class="l2-result-stat-value" style="color:#E17055">🔥 ' + level2State.maxCombo + 'x</div><div class="l2-result-stat-label">أعلى كومبو</div></div>';
    }
    if (stars > existingStars && !level2State.examMode) {
        html += '<div class="l2-result-stat"><div class="l2-result-stat-value" style="color:var(--gold)">+' + (stars - existingStars) + '</div><div class="l2-result-stat-label">نجوم جديدة</div></div>';
    }
    html += '</div>';

    // Bonus stats row (not in exam mode)
    if (!level2State.examMode) {
        html += '<div class="l2-result-bonus-row">';
        html += '<div class="bonus-badge">🏆 ' + level2State.totalPoints + ' نقطة</div>';
        if (level2State.speedBonuses > 0) {
            html += '<div class="bonus-badge">⚡ ' + level2State.speedBonuses + ' بونص سرعة</div>';
        }
        if (level2State.maxCombo >= 3) {
            html += '<div class="bonus-badge">🔥 كومبو نار!</div>';
        }
        // Show diminishing returns info
        var _attemptNum = currentAttempts + 1;
        if (_attemptNum > 1) {
            var _factor = getDiminishingFactor(_attemptNum);
            html += '<div class="bonus-badge" style="color:var(--warning)">📉 المحاولة ' + _attemptNum + ' (' + Math.round(_factor * 100) + '% من النجوم)</div>';
        }
        // Show first-time perfect
        var _lessonData = GameState.level2Data[level2State.currentSubject] &&
            GameState.level2Data[level2State.currentSubject]['lesson_' + level2State.currentLesson];
        if (_lessonData && _lessonData.firstAttemptPerfect) {
            html += '<div class="bonus-badge" style="color:var(--success)">🏅 أول مرة بطل!</div>';
        }
        html += '</div>';
    }

    // Exam mode: show full question-by-question review
    if (level2State.examMode && level2State.activeQuestions) {
        html += '<div class="exam-review-section">';
        html += '<h4 class="exam-review-title"><i class="fas fa-clipboard-list"></i> ملخص الأسئلة</h4>';
        level2State.activeQuestions.forEach(function(q, idx) {
            var wasCorrect = level2State.quizAnswers[idx];
            html += '<div class="exam-review-item ' + (wasCorrect ? 'correct' : 'wrong') + '">';
            html += '<div class="exam-review-header">';
            html += '<span class="exam-review-num">' + (idx + 1) + '</span>';
            html += '<span class="exam-review-status">' + (wasCorrect ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-times-circle"></i>') + '</span>';
            html += '</div>';
            html += '<p class="exam-review-q">' + q.q + '</p>';
            html += '<p class="exam-review-a"><i class="fas fa-check"></i> ' + q.options[q.correct] + '</p>';
            html += '</div>';
        });
        html += '</div>';
    }

    // Buttons
    html += '<div class="l2-result-buttons">';
    if (!level2State.examMode) {
        html += '<button class="btn btn-secondary" onclick="startLevel2Lesson(' + level2State.currentLesson + ')"><span><i class="fas fa-redo"></i> حاول تاني</span></button>';
    }
    if (level2State.subjectExamKey || level2State.currentLesson < 0) {
        html += '<button class="btn btn-primary" onclick="exitMapLandscape(); showScreen(\'level2-subjects-screen\')"><span><i class="fas fa-arrow-right"></i></span></button>';
    } else {
        html += '<button class="btn btn-primary" onclick="exitMapLandscape(); showScreen(\'level2-map-screen\')"><span><i class="fas fa-arrow-right"></i></span></button>';
    }
    html += '</div></div>';

    container.innerHTML = html;

    // Big celebration if good score
    if (stars >= 2) {
        showResultCelebration(stars);
    }

    // Check if this station just became fully completed (unlocking next)
    var justCompletedSummaryKey = level2State.currentSubject + '_' + level2State.currentLesson;
    var justHasSummary = GameState.lessonSummaries && GameState.lessonSummaries[justCompletedSummaryKey];
    if (justHasSummary && stars > 0 && level2State.currentLesson < subject.lessons.length - 1) {
        setTimeout(function() {
            playStationUnlockSound();
            showToast('🔓 تم فتح المحطة التالية!', 'success');
        }, 1500);
    }
}

// --- Result Celebration (big confetti for good scores) ---
function showResultCelebration(stars) {
    var container = document.createElement('div');
    container.className = 'result-celebration-overlay';
    document.body.appendChild(container);

    var colors = ['#FFD700', '#00B894', '#6C5CE7', '#FD79A8', '#00CEC9', '#FFEAA7', '#E17055', '#A29BFE'];
    var count = stars >= 3 ? 60 : 30;
    for (var i = 0; i < count; i++) {
        var c = document.createElement('div');
        c.className = 'result-confetti';
        c.style.left = (Math.random() * 100) + '%';
        c.style.background = colors[Math.floor(Math.random() * colors.length)];
        c.style.animationDelay = (Math.random() * 1) + 's';
        c.style.animationDuration = (1.5 + Math.random() * 1.5) + 's';
        var size = Math.random() > 0.5 ? 'big' : 'small';
        c.classList.add('confetti-' + size);
        container.appendChild(c);
    }

    setTimeout(function() { container.remove(); }, 3500);
}

// ============================================================
// COMPETITIONS / MULTIPLAYER SYSTEM
// ============================================================

// Global competition filter — persists while the user is on the compete screen
var globalCompeteFilter = { subjects: [], lessons: {} };

var competeState = {
    roomId: null,
    isHost: false,
    players: [],
    questions: [],
    currentQ: 0,
    myScore: 0,
    myAnswers: [],
    status: 'idle', // idle, lobby, playing, results
    listener: null,
    timerInterval: null,
    timeLeft: 0,
    streak: 0
};

// --- Global filter panel (renders HTML, wired after insertion) ---
function renderCompeteFilterPanel() {
    var subjectList = [
        { key: 'faith',  label: '✝️ عقيدة ولاهوت',          color: '#e74c3c' },
        { key: 'bible',  label: '📖 كتاب مقدس',             color: '#3498db' },
        { key: 'life',   label: '🌟 مهارات الحياة والقياده', color: '#f39c12' },
        { key: 'ritual', label: '⛪ طقس',                   color: '#9b59b6' }
    ];
    var f = globalCompeteFilter;
    var allSelected = f.subjects.length === 0;
    // "كل المواد" pill + individual topic pills
    var topicPills = '<button class="filter-pill' + (allSelected ? ' active' : '') +
        '" onclick="clearCompeteFilter()" style="--pill-color:#6C5CE7">🎲 كل المواد</button>';
    topicPills += subjectList.map(function(s) {
        var active = f.subjects.indexOf(s.key) >= 0;
        return '<button class="filter-pill' + (active ? ' active' : '') +
            '" onclick="toggleCompeteSubject(\'' + s.key + '\')" style="--pill-color:' + s.color + '">' + s.label + '</button>';
    }).join('');

    // Build lesson pills for selected subjects
    var lessonGroups = '';
    if (f.subjects.length > 0) {
        lessonGroups = '<div class="compete-filter-label" style="margin-top:12px">📝 الدروس <span style="font-weight:400;opacity:.6">(اختياري)</span></div>';
        f.subjects.forEach(function(subKey) {
            var sub = LEVEL2_SUBJECTS[subKey];
            var sObj = subjectList.find(function(s) { return s.key === subKey; });
            if (!sub || !sub.lessons || !sObj) return;
            var selL = f.lessons[subKey] || [];
            lessonGroups += '<div class="compete-filter-sub-group">';
            lessonGroups += '<div class="compete-filter-sub-label" style="color:' + sObj.color + '">' + sObj.label + '</div>';
            lessonGroups += '<div class="compete-filter-pills">';
            sub.lessons.forEach(function(lesson, i) {
                var active = selL.indexOf(i) >= 0;
                lessonGroups += '<button class="filter-pill' + (active ? ' active' : '') +
                    '" onclick="toggleCompeteLesson(\'' + subKey + '\',' + i + ')" style="--pill-color:' + sObj.color + '">' +
                    (i + 1) + '. ' + lesson.name + '</button>';
            });
            lessonGroups += '</div></div>';
        });
    }

    // Active summary
    var summaryText = buildCompeteFilterSummary();
    var summaryHtml = summaryText !== '🎲 عشوائي من كل المواد'
        ? '<div class="compete-active-filter-summary">' + summaryText + '</div>'
        : '';

    return '<div class="compete-filter-panel">' +
        '<div class="compete-filter-panel-header">' +
            '<div class="compete-filter-panel-title"><i class="fas fa-filter"></i> فلتر الأسئلة</div>' +
            '<button class="compete-filter-clear-btn" onclick="clearCompeteFilter()">مسح الكل</button>' +
        '</div>' +
        '<div class="compete-filter-label">📚 المواد <span style="font-weight:400;opacity:.6">(اضغط أكتر من واحدة)</span></div>' +
        '<div class="compete-filter-pills">' + topicPills + '</div>' +
        lessonGroups +
        summaryHtml +
    '</div>';
}

function buildCompeteFilterSummary() {
    var f = globalCompeteFilter;
    var subjectDisplayNames = { faith: 'عقيدة ولاهوت ✝️', bible: 'كتاب مقدس 📖', life: 'مهارات الحياة والقياده 🌟', ritual: 'طقس ⛪' };
    if (!f.subjects || f.subjects.length === 0) return '🎲 عشوائي من كل المواد';
    return f.subjects.map(function(subKey) {
        var part = subjectDisplayNames[subKey] || subKey;
        var selL = f.lessons && f.lessons[subKey] && f.lessons[subKey].length > 0 ? f.lessons[subKey] : [];
        if (selL.length > 0) {
            var sub = LEVEL2_SUBJECTS[subKey];
            var lessonNames = selL.map(function(idx) {
                return sub && sub.lessons[idx] ? sub.lessons[idx].name : 'درس ' + (idx + 1);
            });
            part += ' (' + lessonNames.join('، ') + ')';
        }
        return part;
    }).join('  +  ');
}

function toggleCompeteSubject(subKey) {
    var f = globalCompeteFilter;
    var idx = f.subjects.indexOf(subKey);
    if (idx >= 0) {
        f.subjects.splice(idx, 1);
        delete f.lessons[subKey];
    } else {
        f.subjects.push(subKey);
        if (!f.lessons[subKey]) f.lessons[subKey] = [];
    }
    renderCompeteHub();
}

function toggleCompeteLesson(subKey, lessonIdx) {
    var f = globalCompeteFilter;
    if (!f.lessons[subKey]) f.lessons[subKey] = [];
    var arr = f.lessons[subKey];
    var pos = arr.indexOf(lessonIdx);
    if (pos >= 0) arr.splice(pos, 1);
    else arr.push(lessonIdx);
    renderCompeteHub();
}

function clearCompeteFilter() {
    globalCompeteFilter = { subjects: [], lessons: {} };
    renderCompeteHub();
}

// --- Competition Hub ---
function renderCompeteHub() {
    var body = document.getElementById('compete-body');
    if (!body) return;

    var html = '';

    // Hero section with vector decorations
    html += '<div class="compete-hero">';
    html += '<div class="vector-decor vector-circle-1"></div>';
    html += '<div class="vector-decor vector-circle-2"></div>';
    html += '<div class="vector-decor vector-diamond"></div>';
    html += '<div class="vector-decor vector-triangle"></div>';
    html += '<div class="compete-hero-icon"><i class="fas fa-bolt"></i></div>';
    html += '<h3>تحدّي أصحابك!</h3>';
    html += '<p>العب مع أصحابك في مسابقات حيّة وشوف مين البطل الحقيقي</p>';
    html += '</div>';

    // Quick actions
    html += '<div class="compete-actions">';
    html += '<button class="compete-action-btn compete-create" onclick="createCompeteRoom(\'classic\', globalCompeteFilter)">';
    html += '<i class="fas fa-plus-circle"></i>';
    html += '<span>إنشاء غرفة</span>';
    html += '<small>ابدأ مسابقة جديدة</small>';
    html += '</button>';

    html += '<button class="compete-action-btn compete-join" onclick="showJoinRoom()">';
    html += '<i class="fas fa-sign-in-alt"></i>';
    html += '<span>دخول غرفة</span>';
    html += '<small>ادخل بكود الغرفة</small>';
    html += '</button>';
    html += '</div>';

    // Join room input (hidden initially)
    html += '<div class="compete-join-section" id="compete-join-section" style="display:none">';
    html += '<h4><i class="fas fa-key"></i> ادخل كود الغرفة</h4>';
    html += '<div class="compete-join-input-row">';
    html += '<input type="text" id="compete-join-code" class="input-field" placeholder="كود الغرفة (6 أرقام)" maxlength="6" inputmode="numeric" pattern="[0-9]*">';
    html += '<button class="btn btn-primary" onclick="joinCompeteRoom()"><span><i class="fas fa-arrow-left"></i> دخول</span></button>';
    html += '</div>';
    html += '</div>';

    // Global filter panel
    html += renderCompeteFilterPanel();

    // Game modes
    html += '<h4 class="compete-section-title"><i class="fas fa-gamepad"></i> أنواع المسابقات</h4>';
    html += '<div class="compete-modes-grid">';

    html += '<div class="compete-mode-card compete-mode-sparkle" onclick="selectCompeteMode(\'sparkle\')">';
    html += '<div class="compete-mode-icon"><i class="fas fa-star-of-life"></i></div>';
    html += '<h5>سباركل Sparkle</h5>';
    html += '<p>سؤال وجواب سريع - اللي يغلط يطلع!</p>';
    html += '<div class="compete-mode-badge">20 سؤال · 10 ثواني</div>';
    html += '</div>';

    html += '<div class="compete-mode-card compete-mode-speed" onclick="selectCompeteMode(\'speed\')">';
    html += '<div class="compete-mode-icon"><i class="fas fa-bolt"></i></div>';
    html += '<h5>سباق السرعة</h5>';
    html += '<p>أسرع واحد يجاوب صح ياخد أكتر نقط</p>';
    html += '<div class="compete-mode-badge">15 سؤال · 8 ثواني</div>';
    html += '</div>';

    html += '<div class="compete-mode-card compete-mode-classic" onclick="selectCompeteMode(\'classic\')">';
    html += '<div class="compete-mode-icon"><i class="fas fa-trophy"></i></div>';
    html += '<h5>كلاسيك</h5>';
    html += '<p>10 أسئلة - أكتر واحد يجاوب صح يكسب</p>';
    html += '<div class="compete-mode-badge">10 أسئلة · 15 ثانية</div>';
    html += '</div>';

    html += '<div class="compete-mode-card compete-mode-team" onclick="selectCompeteMode(\'team\')">';
    html += '<div class="compete-mode-icon"><i class="fas fa-users"></i></div>';
    html += '<h5>فريق ضد فريق</h5>';
    html += '<p>اتقسموا فرق وتنافسوا!</p>';
    html += '<div class="compete-mode-badge">10 أسئلة · فريقين</div>';
    html += '</div>';

    html += '<div class="compete-mode-card compete-mode-blitz" onclick="startBlitz()">';
    html += '<div class="compete-mode-icon" style="font-size:28px">⚡</div>';
    html += '<h5>تحدي الـ 30 ثانية</h5>';
    html += '<p>أجوب أكتر ما تقدر في 30 ثانية!</p>';
    html += '<div class="compete-mode-badge">أسبوعي</div>';
    html += '</div>';

    html += '<div class="compete-mode-card compete-mode-duel" onclick="openDuelHub()">';
    html += '<div class="compete-mode-icon" style="font-size:28px">⚔️</div>';
    html += '<h5>مبارزة 1v1</h5>';
    html += '<p>تحدى صاحبك مباشرة!</p>';
    html += '<div class="compete-mode-badge">جديد</div>';
    html += '</div>';

    html += '</div>';

    // Tournament Cup Card
    html += '<div class="compete-tournament-card" onclick="window.open(\'tournament.html\', \'_blank\')">';
    html += '<div class="compete-tournament-bg"></div>';
    html += '<div class="compete-tournament-content">';
    html += '<img src="images/tournament-logo.png" alt="كأس مين البطل" class="compete-tournament-logo">';
    html += '<h3>كأس مين البطل</h3>';
    html += '<p>بطولة خروج بين الفرق — زي كأس العالم!</p>';
    html += '<div class="compete-tournament-badge"><i class="fas fa-tv"></i> يُعرض على البروجكتور</div>';
    html += '</div></div>';

    // Weekly ranking
    html += '<h4 class="compete-section-title"><i class="fas fa-crown"></i> ترتيب الأسبوع</h4>';
    html += '<div id="compete-weekly-ranking"></div>';

    // Recent games
    html += '<h4 class="compete-section-title"><i class="fas fa-history"></i> آخر المسابقات</h4>';
    html += '<div id="compete-recent-games"></div>';

    body.innerHTML = html;

    // Load rankings
    loadCompeteRankings();
    loadRecentGames();
}

function showJoinRoom() {
    var section = document.getElementById('compete-join-section');
    if (section) {
        section.style.display = section.style.display === 'none' ? 'block' : 'none';
        if (section.style.display === 'block') {
            document.getElementById('compete-join-code').focus();
        }
    }
}

// --- Generate room code ---
function generateRoomCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

// --- Select mode & confirm ---
function selectCompeteMode(mode) {
    var modeNames = {
        sparkle: 'سباركل Sparkle ✨',
        speed: 'سباق السرعة ⚡',
        classic: 'كلاسيك 🏆',
        team: 'فريق ضد فريق 👥'
    };
    var modeDescs = {
        sparkle: 'اللي يغلط يطلع! 20 سؤال، 10 ثواني لكل سؤال',
        speed: 'أسرع واحد ياخد أكتر نقط! 15 سؤال، 8 ثواني بس',
        classic: '10 أسئلة، 15 ثانية لكل سؤال. أكتر واحد صح يكسب',
        team: 'اتقسموا فريقين وتنافسوا! 10 أسئلة'
    };

    var filterSummary = buildCompeteFilterSummary();

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
        '<div class="modal-card compete-mode-confirm">' +
            '<div class="compete-confirm-icon"><i class="fas fa-gamepad"></i></div>' +
            '<h3>' + (modeNames[mode] || mode) + '</h3>' +
            '<p class="compete-confirm-desc">' + (modeDescs[mode] || '') + '</p>' +
            '<div class="compete-filter-summary" style="margin:12px 0 4px">' + filterSummary + '</div>' +
            '<div class="compete-confirm-actions">' +
                '<button class="btn btn-primary" id="confirm-create-room"><span><i class="fas fa-plus-circle"></i> إنشاء الغرفة</span></button>' +
                '<button class="btn btn-secondary" id="cancel-mode-select"><span><i class="fas fa-arrow-right"></i></span></button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(overlay);
    setTimeout(function() { overlay.classList.add('active'); }, 10);

    overlay.querySelector('#confirm-create-room').onclick = function() {
        overlay.classList.remove('active');
        setTimeout(function() { overlay.remove(); }, 300);
        createCompeteRoom(mode, globalCompeteFilter);
    };
    overlay.querySelector('#cancel-mode-select').onclick = function() {
        overlay.classList.remove('active');
        setTimeout(function() { overlay.remove(); }, 300);
    };
}

// --- Create Room ---
function createCompeteRoom(mode, filter) {
    if (!firebaseDb) {
        showToast('مفيش اتصال بالسيرفر - تأكد إن الإنترنت شغال وجرب تاني', 'error');
        return;
    }

    mode = mode || 'classic';
    filter = filter || { subjects: [], lessons: {} };
    var roomCode = generateRoomCode();

    // Build question pool based on multi-select filter
    var allQs = [];
    var subjectKeys = (filter.subjects && filter.subjects.length > 0)
        ? filter.subjects
        : ['faith', 'bible', 'life', 'ritual'];
    subjectKeys.forEach(function(subKey) {
        var subject = LEVEL2_SUBJECTS[subKey];
        if (!subject || !subject.lessons) return;
        var selLessons = (filter.lessons && filter.lessons[subKey] && filter.lessons[subKey].length > 0)
            ? filter.lessons[subKey].map(function(idx) { return subject.lessons[idx]; }).filter(Boolean)
            : subject.lessons;
        selLessons.forEach(function(lesson) {
            if (!lesson || !lesson.questions) return;
            lesson.questions.forEach(function(q) {
                allQs.push({ q: q.q, options: q.options, correct: q.correct, subject: subKey });
            });
        });
    });

    // Shuffle
    for (var i = allQs.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = allQs[i]; allQs[i] = allQs[j]; allQs[j] = temp;
    }

    var numQs = mode === 'sparkle' ? 20 : (mode === 'speed' ? 15 : 10);
    var selectedQs = allQs.slice(0, Math.min(numQs, allQs.length)).map(function(q) {
        var pq = prepareQuestion(q);
        pq.subject = q.subject;
        return pq;
    });
    var timePerQ = mode === 'speed' ? 8 : (mode === 'sparkle' ? 10 : 15);

    // Build human-readable filter label for lobby display
    var subjectDisplayNames = { faith: 'عقيدة ولاهوت ✝️', bible: 'كتاب مقدس 📖', life: 'مهارات الحياة والقياده 🌟', ritual: 'طقس ⛪' };
    var filterLabel;
    if (!filter.subjects || filter.subjects.length === 0) {
        filterLabel = '🎲 عشوائي من كل المواد';
    } else {
        var labelParts = filter.subjects.map(function(subKey) {
            var part = subjectDisplayNames[subKey] || subKey;
            var selL = filter.lessons && filter.lessons[subKey] && filter.lessons[subKey].length > 0
                ? filter.lessons[subKey] : [];
            if (selL.length > 0) {
                var sub = LEVEL2_SUBJECTS[subKey];
                var lessonNames = selL.map(function(idx) {
                    return sub && sub.lessons[idx] ? sub.lessons[idx].name : 'درس ' + (idx + 1);
                });
                part += ' (' + lessonNames.join('، ') + ')';
            }
            return part;
        });
        filterLabel = labelParts.join(' + ');
    }

    var roomData = {
        code: roomCode,
        mode: mode,
        host: GameState.playerPhone,
        hostName: GameState.playerName,
        status: 'lobby',
        players: {},
        questions: selectedQs,
        currentQuestion: -1,
        timePerQuestion: timePerQ,
        filter: filter,
        filterLabel: filterLabel,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Add host as player
    roomData.players[GameState.playerPhone] = {
        name: GameState.playerName,
        character: GameState.character,
        score: 0,
        answers: [],
        streak: 0,
        alive: true, // for sparkle mode
        joinedAt: Date.now()
    };

    firebaseDb.collection('compete_rooms').doc(roomCode).set(roomData)
        .then(function() {
            competeState.roomId = roomCode;
            competeState.isHost = true;
            competeState.status = 'lobby';
            showScreen('compete-lobby-screen');
            listenToRoom(roomCode);
            showToast('تم إنشاء الغرفة! كود: ' + roomCode, 'success');
        })
        .catch(function(err) {
            var msg = 'خطأ في إنشاء الغرفة';
            if (err.message && err.message.indexOf('permission') !== -1) {
                msg = 'مفيش صلاحيات - محتاج تحدث Firebase Rules. أضف compete_rooms للقواعد';
            } else if (err.message) {
                msg += ': ' + err.message;
            }
            showToast(msg, 'error');
        });
}

// --- Join Room ---
function joinCompeteRoom() {
    if (!firebaseDb) {
        showToast('مفيش اتصال بالإنترنت', 'error');
        return;
    }

    var codeInput = document.getElementById('compete-join-code');
    var code = codeInput ? codeInput.value.trim() : '';
    if (!code || code.length !== 6) {
        showToast('ادخل كود الغرفة (6 أرقام)', 'error');
        return;
    }

    firebaseDb.collection('compete_rooms').doc(code).get()
        .then(function(doc) {
            if (!doc.exists) {
                showToast('مفيش غرفة بالكود ده!', 'error');
                return;
            }
            var room = doc.data();
            if (room.status !== 'lobby') {
                showToast('المسابقة بدأت بالفعل!', 'error');
                return;
            }

            // Add player
            var update = {};
            update['players.' + GameState.playerPhone] = {
                name: GameState.playerName,
                character: GameState.character,
                score: 0,
                answers: [],
                streak: 0,
                alive: true,
                joinedAt: Date.now()
            };

            return firebaseDb.collection('compete_rooms').doc(code).update(update)
                .then(function() {
                    competeState.roomId = code;
                    competeState.isHost = false;
                    competeState.status = 'lobby';
                    showScreen('compete-lobby-screen');
                    listenToRoom(code);
                    showToast('انضممت للغرفة!', 'success');
                });
        })
        .catch(function(err) {
            showToast('خطأ: ' + err.message, 'error');
        });
}

// --- Listen to Room (real-time) ---
function listenToRoom(roomCode) {
    if (competeState.listener) competeState.listener(); // unsubscribe old

    competeState.listener = firebaseDb.collection('compete_rooms').doc(roomCode)
        .onSnapshot(function(doc) {
            if (!doc.exists) {
                showToast('الغرفة اتحذفت!', 'error');
                showScreen('compete-screen');
                return;
            }
            var room = doc.data();
            competeState.players = room.players || {};
            competeState.questions = room.questions || [];

            if (room.status === 'lobby') {
                renderCompeteLobby(room);
            } else if (room.status === 'playing') {
                if (competeState.status !== 'playing' || room.currentQuestion !== competeState.currentQ) {
                    competeState.status = 'playing';
                    competeState.currentQ = room.currentQuestion;
                    if (document.getElementById('compete-game-screen') && !document.getElementById('compete-game-screen').classList.contains('active')) {
                        showScreen('compete-game-screen');
                    }
                    renderCompeteQuestion(room);
                }
            } else if (room.status === 'finished') {
                competeState.status = 'results';
                showScreen('compete-results-screen');
                renderCompeteResults(room);
            }
        });
}

// --- Lobby ---
function renderCompeteLobby(room) {
    var body = document.getElementById('compete-lobby-body');
    if (!body) return;

    var players = room.players || {};
    var playerList = Object.keys(players);
    var modeNames = { classic: '🏆 كلاسيك', sparkle: '✨ سباركل', speed: '⚡ سباق السرعة', team: '👥 فريق ضد فريق' };

    var html = '';

    // Room info
    html += '<div class="lobby-room-info">';
    html += '<div class="lobby-code-display">';
    html += '<p class="lobby-code-label">كود الغرفة</p>';
    html += '<div class="lobby-code-number" onclick="copyRoomCode(\'' + room.code + '\')">' + room.code + ' <i class="fas fa-copy"></i></div>';
    html += '<p class="lobby-code-hint">شارك الكود ده مع أصحابك عشان يدخلوا</p>';
    html += '<div class="lobby-share-btns">';
    html += '<button class="btn btn-primary lobby-share-btn" onclick="shareRoomLink(\'' + room.code + '\')"><span><i class="fas fa-share-nodes"></i> شارك اللينك</span></button>';
    html += '<button class="btn btn-secondary lobby-copy-btn" onclick="copyRoomCode(\'' + room.code + '\')"><span><i class="fas fa-copy"></i> انسخ الكود</span></button>';
    html += '</div>';
    html += '</div>';
    html += '<div class="lobby-mode-badge">' + (modeNames[room.mode] || room.mode) + '</div>';
    html += '<div class="lobby-filter-badge"><i class="fas fa-book-open"></i> ' + (room.filterLabel || '🎲 عشوائي من كل المواد') + '</div>';
    html += '</div>';

    // Players list
    html += '<h4 class="lobby-section-title"><i class="fas fa-users"></i> اللاعبين (' + playerList.length + ')</h4>';
    html += '<div class="lobby-players-grid">';
    playerList.forEach(function(phone) {
        var p = players[phone];
        var ch = CHARACTERS[p.character] || CHARACTERS.david;
        var isHostPlayer = (phone === room.host);
        html += '<div class="lobby-player-card">';
        html += '<img src="' + ch.image + '" class="lobby-player-avatar">';
        html += '<span class="lobby-player-name">' + (p.name || 'لاعب') + '</span>';
        if (isHostPlayer) html += '<span class="lobby-host-badge"><i class="fas fa-crown"></i></span>';
        html += '</div>';
    });
    html += '</div>';

    // Waiting message
    if (playerList.length < 2) {
        html += '<div class="lobby-waiting"><div class="lobby-waiting-spinner"></div><p>مستنين لاعبين تانيين...</p></div>';
    }

    // Start button (host only)
    if (competeState.isHost && playerList.length >= 2) {
        html += '<button class="btn btn-primary compete-start-btn" onclick="startCompeteGame()">';
        html += '<span><i class="fas fa-play"></i> ابدأ المسابقة! (' + playerList.length + ' لاعبين)</span></button>';
    } else if (!competeState.isHost) {
        html += '<div class="lobby-waiting-host"><i class="fas fa-hourglass-half"></i> مستنين المضيف يبدأ المسابقة...</div>';
    }

    body.innerHTML = html;
}

function copyRoomCode(code) {
    navigator.clipboard.writeText(code).then(function() {
        showToast('تم نسخ الكود: ' + code + ' 📋', 'success');
    }).catch(function() {});
}

function shareRoomLink(code) {
    var url = window.location.origin + '?room=' + code;
    var shareData = {
        title: 'مين البطل؟ - مسابقة جماعية',
        text: 'تعالى العب معايا في مسابقة مين البطل! 🏆\nكود الغرفة: ' + code,
        url: url
    };
    if (navigator.share) {
        navigator.share(shareData).catch(function() {});
    } else {
        // Fallback: copy full link
        navigator.clipboard.writeText(shareData.text + '\n' + url).then(function() {
            showToast('تم نسخ اللينك! شاركه مع أصحابك 📋', 'success');
        }).catch(function() {
            // Double fallback: prompt
            prompt('انسخ اللينك ده وابعته لأصحابك:', url);
        });
    }
}

// --- Auto-join from shared link ---
function checkPendingRoomJoin() {
    var pendingRoom = sessionStorage.getItem('minElBatal_pendingRoom');
    if (!pendingRoom) return;
    sessionStorage.removeItem('minElBatal_pendingRoom');
    // Small delay to let UI settle
    setTimeout(function() { autoJoinRoom(pendingRoom); }, 1500);
}

function autoJoinRoom(code) {
    if (!firebaseDb || !GameState.playerPhone) return;
    firebaseDb.collection('compete_rooms').doc(code).get().then(function(doc) {
        if (!doc.exists) { showToast('الغرفة مش موجودة أو اتقفلت', 'error'); return; }
        var room = doc.data();
        if (room.status !== 'lobby') { showToast('المسابقة بدأت بالفعل!', 'error'); return; }
        // Add player
        var update = {};
        update['players.' + GameState.playerPhone] = {
            name: GameState.playerName,
            character: GameState.character,
            score: 0, answers: [], streak: 0, alive: true, joinedAt: Date.now()
        };
        return firebaseDb.collection('compete_rooms').doc(code).update(update).then(function() {
            competeState.roomId = code;
            competeState.isHost = false;
            competeState.status = 'lobby';
            showScreen('compete-lobby-screen');
            listenToRoom(code);
            showToast('انضممت للغرفة! 🎉', 'success');
        });
    }).catch(function(err) { showToast('خطأ: ' + err.message, 'error'); });
}

// --- Start Game (host only) ---
function startCompeteGame() {
    if (!competeState.isHost || !competeState.roomId) return;

    firebaseDb.collection('compete_rooms').doc(competeState.roomId).update({
        status: 'playing',
        currentQuestion: 0,
        questionStartedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function() {
        competeState.myScore = 0;
        competeState.myAnswers = [];
        competeState.streak = 0;
    });
}

// --- Render Question ---
function renderCompeteQuestion(room) {
    var body = document.getElementById('compete-game-body');
    if (!body) return;

    var qIdx = room.currentQuestion;
    if (qIdx < 0 || qIdx >= room.questions.length) return;

    var q = room.questions[qIdx];
    var totalQs = room.questions.length;
    var timePerQ = room.timePerQuestion || 15;

    // Check if already answered this question
    var myData = room.players[GameState.playerPhone];
    var alreadyAnswered = myData && myData.answers && myData.answers.length > qIdx;

    // Check if eliminated in sparkle mode
    var isEliminated = room.mode === 'sparkle' && myData && !myData.alive;

    var html = '';

    // Streak indicator
    if (competeState.streak >= 2) {
        html += '<div class="compete-streak"><span class="streak-fire">🔥</span> ' + competeState.streak + ' إجابات متتالية!</div>';
    }

    // Timer bar
    html += '<div class="compete-timer-bar"><div class="compete-timer-fill" id="compete-timer-fill" style="width:100%;background:linear-gradient(90deg,var(--primary),var(--secondary))"></div></div>';

    // Live player scores strip
    var playerKeys = Object.keys(room.players);
    html += '<div class="compete-live-scores">';
    playerKeys.sort(function(a, b) { return (room.players[b].score || 0) - (room.players[a].score || 0); });
    playerKeys.forEach(function(phone, idx) {
        var p = room.players[phone];
        var isMe = phone === GameState.playerPhone;
        var ch = CHARACTERS[p.character] || CHARACTERS.david;
        var eliminated = room.mode === 'sparkle' && !p.alive;
        html += '<div class="compete-live-score-item ' + (isMe ? 'me' : '') + (eliminated ? ' eliminated' : '') + '">';
        html += '<img src="' + ch.image + '">';
        html += '<span>' + (p.name || '').substring(0, 6) + '</span>';
        html += '<span class="compete-game-score">' + (p.score || 0) + '</span>';
        html += '</div>';
    });
    html += '</div>';

    if (isEliminated) {
        html += '<div class="compete-eliminated" style="text-align:center;padding:40px 20px;">';
        html += '<div style="font-size:60px;margin-bottom:12px;animation:flameDance 0.5s ease-in-out infinite alternate">💀</div>';
        html += '<h3 style="color:var(--text-primary);font-size:20px;margin:0 0 6px">تم إقصاءك!</h3>';
        html += '<p style="color:var(--text-secondary);font-size:14px">تابع المسابقة كمشاهد</p></div>';
    } else if (alreadyAnswered) {
        html += '<div style="text-align:center;padding:40px 20px;">';
        html += '<div class="lobby-waiting-spinner" style="margin-bottom:16px"></div>';
        html += '<p style="color:var(--text-secondary);font-size:14px">مستنين باقي اللاعبين...</p></div>';
    } else {
        // Question card with number
        html += '<div class="compete-question-card">';
        html += '<p class="compete-question-num">سؤال ' + (qIdx + 1) + ' من ' + totalQs + '</p>';
        html += '<p class="compete-question-text">' + q.q + '</p>';
        html += '</div>';

        // Kahoot-style colored options
        html += '<div class="compete-options-grid">';
        var optShapes = ['▲', '◆', '●', '★'];
        q.options.forEach(function(opt, idx) {
            html += '<button class="compete-option" onclick="answerCompete(' + idx + ')">';
            html += '<span class="option-shape">' + optShapes[idx] + '</span> ' + opt;
            html += '</button>';
        });
        html += '</div>';
    }

    body.innerHTML = html;

    // Start timer
    startCompeteTimer(timePerQ, qIdx);
}

function startCompeteTimer(seconds, qIdx) {
    if (competeState.timerInterval) clearInterval(competeState.timerInterval);
    competeState.timeLeft = seconds;

    var fill = document.getElementById('compete-timer-fill');
    if (fill) fill.style.width = '100%';

    competeState.timerInterval = setInterval(function() {
        competeState.timeLeft--;
        if (fill) {
            fill.style.width = (competeState.timeLeft / seconds * 100) + '%';
            if (competeState.timeLeft <= 3) {
                fill.className = 'compete-timer-fill warning';
                playTickSound();
            } else if (competeState.timeLeft <= 5) {
                fill.style.background = 'linear-gradient(90deg, #f39c12, #e17055)';
                playTickSound();
            }
        }
        if (competeState.timeLeft <= 0) {
            clearInterval(competeState.timerInterval);
            // Time's up - auto submit no answer
            var myData = competeState.players[GameState.playerPhone];
            if (myData && (!myData.answers || myData.answers.length <= qIdx)) {
                answerCompete(-1); // no answer
            }
        }
    }, 1000);
}

// --- Answer Question ---
function answerCompete(selectedIdx) {
    if (!competeState.roomId) return;

    var room = competeState;
    var qIdx = room.currentQ;
    var q = room.questions[qIdx];
    if (!q) return;

    var isCorrect = selectedIdx === q.correct;
    var timeBonus = Math.max(0, competeState.timeLeft) * 2;
    var points = 0;

    if (isCorrect) {
        competeState.streak++;
        points = 100 + timeBonus + (competeState.streak > 1 ? competeState.streak * 20 : 0);
        playCorrectSound();
        vibrate(50);
    } else {
        competeState.streak = 0;
        if (room.questions && room.questions[0] && competeState.players) {
            // Sparkle mode: mark as eliminated
        }
        playWrongSound();
        vibrate([50, 30, 50]);
    }

    competeState.myScore += points;
    competeState.myAnswers.push({ selected: selectedIdx, correct: isCorrect, points: points });

    // Update Firebase
    var update = {};
    update['players.' + GameState.playerPhone + '.score'] = competeState.myScore;
    update['players.' + GameState.playerPhone + '.answers'] = competeState.myAnswers;
    update['players.' + GameState.playerPhone + '.streak'] = competeState.streak;

    // Sparkle mode: eliminate on wrong answer
    if (competeState.questions[0] && !isCorrect) {
        // Check mode from room data
        firebaseDb.collection('compete_rooms').doc(competeState.roomId).get().then(function(doc) {
            if (doc.exists && doc.data().mode === 'sparkle') {
                var elimUpdate = {};
                elimUpdate['players.' + GameState.playerPhone + '.alive'] = false;
                firebaseDb.collection('compete_rooms').doc(competeState.roomId).update(elimUpdate);
            }
        });
    }

    firebaseDb.collection('compete_rooms').doc(competeState.roomId).update(update)
        .then(function() {
            // Check if all players answered - if host, advance
            checkAllAnswered();
        });

    // Show dramatic feedback overlay
    var feedbackEl = document.createElement('div');
    feedbackEl.className = 'compete-feedback-overlay ' + (isCorrect ? 'compete-feedback-correct' : 'compete-feedback-wrong');
    feedbackEl.innerHTML = '<div class="compete-feedback-icon">' +
        (isCorrect ? '✅' : '❌') + '</div>' +
        '<div style="position:absolute;bottom:30%;text-align:center;width:100%">' +
        '<p style="font-size:24px;font-weight:900;color:#fff;text-shadow:0 4px 12px rgba(0,0,0,0.5)">' +
        (isCorrect ? 'صح! +' + points : 'غلط!') + '</p></div>';
    document.body.appendChild(feedbackEl);
    setTimeout(function() { feedbackEl.remove(); }, 1000);

    // Disable options after answering
    var optBtns = document.querySelectorAll('.compete-option');
    optBtns.forEach(function(btn) { btn.classList.add('disabled'); });
}

function checkAllAnswered() {
    if (!competeState.isHost || !competeState.roomId) return;

    firebaseDb.collection('compete_rooms').doc(competeState.roomId).get()
        .then(function(doc) {
            if (!doc.exists) return;
            var room = doc.data();
            var players = room.players || {};
            var allAnswered = true;
            var qIdx = room.currentQuestion;

            Object.keys(players).forEach(function(phone) {
                var p = players[phone];
                // Skip eliminated players in sparkle mode
                if (room.mode === 'sparkle' && !p.alive) return;
                if (!p.answers || p.answers.length <= qIdx) {
                    allAnswered = false;
                }
            });

            if (allAnswered) {
                // Advance to next question or finish
                if (qIdx + 1 >= room.questions.length) {
                    // Game over
                    firebaseDb.collection('compete_rooms').doc(competeState.roomId).update({
                        status: 'finished',
                        finishedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    // Award stars to players
                    awardCompeteStars(room);
                } else {
                    // Next question after brief delay
                    setTimeout(function() {
                        firebaseDb.collection('compete_rooms').doc(competeState.roomId).update({
                            currentQuestion: qIdx + 1,
                            questionStartedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    }, 2000);
                }

                // Check sparkle mode - if only 1 alive, end game
                if (room.mode === 'sparkle') {
                    var aliveCount = 0;
                    Object.keys(players).forEach(function(phone) {
                        if (players[phone].alive) aliveCount++;
                    });
                    if (aliveCount <= 1) {
                        firebaseDb.collection('compete_rooms').doc(competeState.roomId).update({
                            status: 'finished',
                            finishedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        awardCompeteStars(room);
                    }
                }
            }
        });
}

function awardCompeteStars(room) {
    // Award stars based on ranking
    var players = room.players || {};
    var sorted = Object.keys(players).sort(function(a, b) {
        return (players[b].score || 0) - (players[a].score || 0);
    });

    var myRank = sorted.indexOf(GameState.playerPhone);
    var starRewards = [20, 12, 8, 5, 3]; // 1st to 5th place
    var reward = myRank >= 0 && myRank < starRewards.length ? starRewards[myRank] : 2;

    GameState.stars += reward;
    saveToCloud();
    saveToLocalStorage();
}

// --- Results ---
function renderCompeteResults(room) {
    var body = document.getElementById('compete-results-body');
    if (!body) return;

    var players = room.players || {};
    var sorted = Object.keys(players).sort(function(a, b) {
        return (players[b].score || 0) - (players[a].score || 0);
    });
    var modeNames = { classic: '🏆 كلاسيك', sparkle: '✨ سباركل', speed: '⚡ سباق السرعة', team: '👥 فريق ضد فريق' };

    var html = '';

    // Winner celebration
    if (sorted.length > 0) {
        var winner = players[sorted[0]];
        var winnerCh = CHARACTERS[winner.character] || CHARACTERS.david;
        var isMe = sorted[0] === GameState.playerPhone;

        html += '<div class="compete-winner-section">';
        html += '<div class="compete-winner-crown">👑</div>';
        html += '<img src="' + winnerCh.image + '" class="compete-winner-avatar">';
        html += '<h3 class="compete-winner-name">' + (winner.name || 'البطل') + '</h3>';
        html += '<p class="compete-winner-score">⭐ ' + (winner.score || 0) + ' نقطة</p>';
        if (isMe) html += '<div class="compete-winner-me">🎉 أنت الفائز!</div>';
        html += '</div>';
    }

    // Full ranking
    html += '<div class="compete-results-ranking">';
    html += '<h4><i class="fas fa-list-ol"></i> الترتيب النهائي</h4>';
    sorted.forEach(function(phone, idx) {
        var p = players[phone];
        var ch = CHARACTERS[p.character] || CHARACTERS.david;
        var isMe = phone === GameState.playerPhone;
        var rankEmoji = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : (idx + 1)));
        var eliminated = room.mode === 'sparkle' && !p.alive;

        html += '<div class="compete-result-player ' + (isMe ? 'me' : '') + (eliminated ? ' eliminated' : '') + '">';
        html += '<span class="compete-result-rank">' + rankEmoji + '</span>';
        html += '<img src="' + ch.image + '" class="compete-result-avatar">';
        html += '<div class="compete-result-info">';
        html += '<span class="compete-result-name">' + (p.name || 'لاعب') + '</span>';
        var correctCount = (p.answers || []).filter(function(a) { return a.correct; }).length;
        html += '<span class="compete-result-detail">' + correctCount + '/' + room.questions.length + ' صح</span>';
        html += '</div>';
        html += '<span class="compete-result-score">⭐ ' + (p.score || 0) + '</span>';
        html += '</div>';
    });
    html += '</div>';

    // Stars earned
    var myRank = sorted.indexOf(GameState.playerPhone);
    var starRewards = [20, 12, 8, 5, 3];
    var reward = myRank >= 0 && myRank < starRewards.length ? starRewards[myRank] : 2;
    html += '<div class="compete-reward-card">';
    html += '<p>🎁 حصلت على <strong>' + reward + ' ⭐</strong> نجوم!</p>';
    html += '</div>';

    // Actions
    html += '<div class="compete-result-actions">';
    if (competeState.isHost) {
        html += '<button class="btn btn-primary" onclick="rematchCompete()"><span><i class="fas fa-redo"></i> العب تاني</span></button>';
    }
    html += '<button class="btn btn-secondary" onclick="leaveCompeteRoom(); showScreen(\'compete-screen\')"><span><i class="fas fa-arrow-right"></i></span></button>';
    html += '</div>';

    body.innerHTML = html;

    // Cleanup
    if (competeState.timerInterval) clearInterval(competeState.timerInterval);

    // Launch confetti if player won or placed top 3
    if (myRank >= 0 && myRank < 3) {
        launchConfetti(4000);
        if (myRank === 0) {
            showAchievement('🏆', 'فزت بالمسابقة!', 'أنت البطل الحقيقي 🎉');
        }
    }

    // Award stars + XP
    if (myRank >= 0) {
        GameState.stars = (GameState.stars || 0) + reward;
        GameState.gems = (GameState.gems || 0) + Math.floor(reward / 4);
        awardXP(50, 'competition participation');
        if (myRank === 0) awardXP(60, 'competition win');
        saveToLocalStorage();
        if (typeof saveToCloud === 'function') saveToCloud();
    }
}

function rematchCompete() {
    if (!competeState.isHost || !competeState.roomId) return;

    // Collect new questions
    var allQs = [];
    ['faith', 'bible', 'life', 'ritual'].forEach(function(subKey) {
        var subject = LEVEL2_SUBJECTS[subKey];
        if (subject && subject.lessons) {
            subject.lessons.forEach(function(lesson) {
                if (lesson.questions) {
                    lesson.questions.forEach(function(q) {
                        allQs.push({ q: q.q, options: q.options, correct: q.correct });
                    });
                }
            });
        }
    });
    shuffleArray(allQs);
    allQs = allQs.map(prepareQuestion);

    // Reset players
    var players = competeState.players;
    var resetPlayers = {};
    Object.keys(players).forEach(function(phone) {
        resetPlayers[phone] = {
            name: players[phone].name,
            character: players[phone].character,
            score: 0,
            answers: [],
            streak: 0,
            alive: true,
            joinedAt: Date.now()
        };
    });

    firebaseDb.collection('compete_rooms').doc(competeState.roomId).update({
        status: 'lobby',
        players: resetPlayers,
        questions: allQs.slice(0, 10),
        currentQuestion: -1
    }).then(function() {
        competeState.myScore = 0;
        competeState.myAnswers = [];
        competeState.streak = 0;
        showScreen('compete-lobby-screen');
    });
}

function leaveCompeteRoom() {
    if (competeState.listener) {
        competeState.listener();
        competeState.listener = null;
    }
    if (competeState.timerInterval) clearInterval(competeState.timerInterval);

    // Remove player from room
    if (competeState.roomId && firebaseDb) {
        var update = {};
        update['players.' + GameState.playerPhone] = firebase.firestore.FieldValue.delete();
        firebaseDb.collection('compete_rooms').doc(competeState.roomId).update(update).catch(function() {});
    }

    competeState.roomId = null;
    competeState.isHost = false;
    competeState.status = 'idle';
    competeState.players = [];
    showScreen('compete-screen');
}

// --- Weekly Rankings ---
function loadCompeteRankings() {
    var container = document.getElementById('compete-weekly-ranking');
    if (!container || !firebaseDb) {
        if (container) container.innerHTML = '<p class="compete-empty">مفيش ترتيب لسه - ابدأ العب!</p>';
        return;
    }

    firebaseDb.collection('leaderboard').orderBy('stars', 'desc').limit(10).get()
        .then(function(snapshot) {
            var html = '';
            var rank = 0;
            snapshot.forEach(function(doc) {
                rank++;
                var d = doc.data();
                var rankEmoji = rank === 1 ? '🥇' : (rank === 2 ? '🥈' : (rank === 3 ? '🥉' : rank));
                var isMe = doc.id === GameState.playerPhone;
                var playerName = d.playerName || d.name || 'لاعب';
                var teamBadge = d.team ? '<span style="font-size:9px;color:var(--text-muted);margin-right:4px">(' + d.team + ')</span>' : '';
                html += '<div class="compete-rank-item ' + (isMe ? 'me' : '') + '">';
                html += '<span class="compete-rank-pos">' + rankEmoji + '</span>';
                html += '<span class="compete-rank-name">' + playerName + teamBadge + '</span>';
                html += '<span class="compete-rank-stars">⭐ ' + (d.stars || 0) + ' 💎 ' + (d.gems || 0) + '</span>';
                html += '</div>';
            });
            if (!html) html = '<p class="compete-empty">مفيش ترتيب لسه</p>';
            container.innerHTML = html;
        })
        .catch(function(err) {
            console.error('Ranking load error:', err);
            container.innerHTML = '<p class="compete-empty">خطأ في تحميل الترتيب</p>';
        });
}

function loadRecentGames() {
    var container = document.getElementById('compete-recent-games');
    if (!container) return;
    container.innerHTML = '<p class="compete-empty">مفيش مسابقات سابقة - ابدأ أول مسابقة!</p>';
}

// ============================================================
// SPIRITUAL LIFE FEATURES
// ============================================================

// --- Mark's Gospel Data (16 chapters) ---
var MARK_CHAPTERS = [
    { ch: 1, title: 'بداية بشارة يسوع المسيح', verses: '45 آية', summary: 'معمودية يسوع، دعوة التلاميذ الأوائل، شفاء كثيرين' },
    { ch: 2, title: 'شفاء المفلوج ودعوة لاوي', verses: '28 آية', summary: 'شفاء المفلوج، دعوة لاوي، الصوم والسبت' },
    { ch: 3, title: 'اختيار الاثني عشر', verses: '35 آية', summary: 'شفاء يوم السبت، اختيار الرسل، التجديف على الروح القدس' },
    { ch: 4, title: 'أمثال الملكوت', verses: '41 آية', summary: 'مثل الزارع، السراج، حبة الخردل، تهدئة العاصفة' },
    { ch: 5, title: 'معجزات القوة', verses: '43 آية', summary: 'مجنون كورة الجدريين، نازفة الدم، إقامة ابنة يايرس' },
    { ch: 6, title: 'إرسال التلاميذ', verses: '56 آية', summary: 'رفض الناصرة، إرسالية الاثني عشر، إشباع الخمسة آلاف، المشي على الماء' },
    { ch: 7, title: 'ما يُنجّس الإنسان', verses: '37 آية', summary: 'تقليد الشيوخ، شفاء ابنة المرأة الفينيقية، شفاء الأصم' },
    { ch: 8, title: 'اعتراف بطرس', verses: '38 آية', summary: 'إشباع الأربعة آلاف، شفاء أعمى بيت صيدا، اعتراف بطرس بالمسيح' },
    { ch: 9, title: 'التجلي', verses: '50 آية', summary: 'التجلي على الجبل، شفاء الصبي المصروع، من هو الأعظم' },
    { ch: 10, title: 'الطريق إلى أورشليم', verses: '52 آية', summary: 'الطلاق، مباركة الأطفال، الشاب الغني، شفاء بارتيماوس' },
    { ch: 11, title: 'دخول أورشليم', verses: '33 آية', summary: 'الدخول المظفر، لعن التينة، تطهير الهيكل' },
    { ch: 12, title: 'أمثال وتعاليم', verses: '44 آية', summary: 'مثل الكرامين، الجزية لقيصر، القيامة، أعظم وصية، فلسا الأرملة' },
    { ch: 13, title: 'علامات النهاية', verses: '37 آية', summary: 'خراب الهيكل، علامات الأزمنة الأخيرة، مجيء ابن الإنسان، السهر' },
    { ch: 14, title: 'الآلام', verses: '72 آية', summary: 'سكب الطيب، العشاء الأخير، جثسيماني، القبض على يسوع، إنكار بطرس' },
    { ch: 15, title: 'الصليب', verses: '47 آية', summary: 'المحاكمة أمام بيلاطس، الصلب، موت يسوع، الدفن' },
    { ch: 16, title: 'القيامة', verses: '20 آية', summary: 'القيامة، ظهورات المسيح، الإرسالية العظمى، الصعود' }
];

// --- Daily Exercises ---
var DAILY_EXERCISES = [
    { id: 'read_bible', text: 'قرأت أصحاح من الكتاب المقدس', icon: '📖', points: 5 },
    { id: 'memorize_verse', text: 'حفظت آية جديدة', icon: '💡', points: 3 },
    { id: 'help_someone', text: 'ساعدت حد النهاردة', icon: '🤝', points: 3 },
    { id: 'no_bad_words', text: 'ما قلتش كلام وحش النهاردة', icon: '🤐', points: 2 }
];

var WEEKLY_EXERCISES = [
    { id: 'attend_church', text: 'حضرت القداس', icon: '⛪', points: 10 },
    { id: 'confession', text: 'اعترفت', icon: '🙏', points: 10 },
    { id: 'communion', text: 'تناولت', icon: '🍷', points: 10 },
    { id: 'attend_meeting', text: 'حضرت الاجتماع', icon: '👥', points: 5 },
    { id: 'serve', text: 'خدمت في الكنيسة', icon: '💪', points: 5 }
];

function getTodayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function getWeekKey() {
    var d = new Date();
    var jan1 = new Date(d.getFullYear(), 0, 1);
    var weekNum = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
    return d.getFullYear() + '-W' + weekNum;
}

// --- Bible Reading Screen ---
function renderBibleReading() {
    var body = document.getElementById('bible-reading-body');
    if (!body) return;

    var todayKey = getTodayKey();
    var todayLog = (GameState.bibleReadingLog || {})[todayKey] || {};
    var currentCh = GameState.bibleChapter || 1;
    var chapter = MARK_CHAPTERS[currentCh - 1];

    // Auto-load text from embedded MARK_FULL_TEXT if available
    if (typeof MARK_FULL_TEXT !== 'undefined' && MARK_FULL_TEXT[currentCh] && (!chapter.text || chapter.text.length === 0)) {
        chapter.text = MARK_FULL_TEXT[currentCh];
    }

    // Auto-fetch from API if no text loaded yet
    if (!chapter.text || chapter.text.length === 0) {
        if (!chapter._fetching) {
            chapter._fetching = true;
            fetch('https://bolls.life/get-chapter/SVD/41/' + currentCh + '/')
                .then(function(res) { return res.json(); })
                .then(function(data) {
                    if (data && Array.isArray(data) && data.length > 0) {
                        chapter.text = data.map(function(v) { return v.text.replace(/<[^>]*>/g, '').trim(); });
                        chapter._fetching = false;
                        renderBibleReading();
                    }
                })
                .catch(function() { chapter._fetching = false; });
        }
    }

    // Get highlighted verses for this chapter
    if (!GameState.highlightedVerses) GameState.highlightedVerses = {};
    var chHighlights = GameState.highlightedVerses['mark_' + currentCh] || [];

    var html = '';

    // Progress bar
    html += '<div class="bible-progress-section">';
    html += '<div class="bible-progress-bar"><div class="bible-progress-fill" style="width:' + (currentCh / 16 * 100) + '%"></div></div>';
    html += '<p class="bible-progress-text">الأصحاح ' + currentCh + ' من 16</p>';
    html += '</div>';

    // Today's chapter card
    html += '<div class="bible-chapter-card">';
    html += '<div class="bible-chapter-number">الأصحاح ' + chapter.ch + '</div>';
    html += '<h3>' + chapter.title + '</h3>';
    html += '<p class="bible-chapter-verses">' + chapter.verses + '</p>';
    html += '<div class="bible-chapter-summary">';
    html += '<h4><i class="fas fa-lightbulb"></i> ملخص الأصحاح</h4>';
    html += '<p>' + chapter.summary + '</p>';
    html += '</div>';

    // Full chapter text
    if (chapter.text && chapter.text.length > 0) {
        html += '<div class="bible-full-text">';
        html += '<h4 class="bible-full-text-title"><i class="fas fa-book-open"></i> نص الأصحاح</h4>';
        html += '<p class="bible-tap-hint"><i class="fas fa-highlighter"></i> اضغط على الآية لتلوينها</p>';
        chapter.text.forEach(function(verse, vIdx) {
            var isHighlighted = chHighlights.indexOf(vIdx) !== -1;
            html += '<p class="bible-verse-line ' + (isHighlighted ? 'highlighted' : '') + '" data-vidx="' + vIdx + '" onclick="toggleVerseHighlight(' + currentCh + ',' + vIdx + ')">';
            html += '<span class="bible-verse-num">' + (vIdx + 1) + '</span> ';
            html += verse;
            html += '<button class="bible-share-btn" onclick="event.stopPropagation(); shareBibleVerse(' + currentCh + ',' + vIdx + ')" title="مشاركة"><i class="fas fa-share-alt"></i></button>';
            html += '</p>';
        });
        html += '</div>';
    } else {
        // Fallback: fetch from API or show placeholder
        html += '<div class="bible-full-text">';
        html += '<div class="bible-fetch-section">';
        html += '<button class="btn btn-secondary" onclick="fetchMarkChapter(' + currentCh + ')" style="width:100%">';
        html += '<span><i class="fas fa-download"></i> تحميل نص الأصحاح</span></button>';
        html += '</div>';
        html += '</div>';
    }

    if (todayLog.done) {
        html += '<div class="bible-done-badge"><i class="fas fa-check-circle"></i> تم قراءة أصحاح النهاردة! ⭐ +10</div>';
        if (todayLog.summary) {
            html += '<div class="bible-user-summary"><strong>تلخيصك:</strong> ' + todayLog.summary + '</div>';
        }
    } else {
        html += '<div class="bible-action-section">';
        html += '<p class="bible-action-hint">اقرأ الأصحاح واكتب تلخيص بسيط</p>';
        html += '<textarea id="bible-summary-input" class="input-field" placeholder="اكتب تلخيص بسيط للأصحاح..." rows="3"></textarea>';
        html += '<label class="bible-upload-label">';
        html += '<input type="file" accept="image/*" onchange="handleBibleImage(event)" style="display:none">';
        html += '<span class="btn btn-secondary" style="width:100%"><span><i class="fas fa-camera"></i> أضف صورة من الكتاب</span></span>';
        html += '</label>';
        html += '<div id="bible-image-preview"></div>';
        html += '<button class="btn btn-primary" onclick="completeBibleReading()" style="width:100%;margin-top:10px;">';
        html += '<span><i class="fas fa-check"></i> خلصت القراءة! (+10 ⭐)</span></button>';
        html += '</div>';
    }
    html += '</div>';

    // Chapter list
    html += '<h4 class="bible-chapters-title"><i class="fas fa-list"></i> كل الأصحاحات</h4>';
    html += '<div class="bible-chapters-grid">';
    for (var i = 0; i < MARK_CHAPTERS.length; i++) {
        var mc = MARK_CHAPTERS[i];
        var isDone = false;
        Object.keys(GameState.bibleReadingLog || {}).forEach(function(key) {
            if (GameState.bibleReadingLog[key].chapter === mc.ch && GameState.bibleReadingLog[key].done) {
                isDone = true;
            }
        });
        var isCurrent = (mc.ch === currentCh);
        html += '<div class="bible-ch-item ' + (isDone ? 'done' : '') + (isCurrent ? ' current' : '') + '" onclick="navigateBibleChapter(' + mc.ch + ')">';
        html += '<span class="bible-ch-num">' + mc.ch + '</span>';
        html += '<span class="bible-ch-title">' + mc.title + '</span>';
        if (isDone) html += '<i class="fas fa-check-circle bible-ch-check"></i>';
        html += '</div>';
    }
    html += '</div>';

    body.innerHTML = html;
}

function navigateBibleChapter(ch) {
    GameState.bibleChapter = ch;
    renderBibleReading();
    // Scroll to top
    var body = document.getElementById('bible-reading-body');
    if (body) body.scrollTop = 0;
}

function toggleVerseHighlight(ch, vIdx) {
    if (!GameState.highlightedVerses) GameState.highlightedVerses = {};
    var key = 'mark_' + ch;
    if (!GameState.highlightedVerses[key]) GameState.highlightedVerses[key] = [];

    var arr = GameState.highlightedVerses[key];
    var pos = arr.indexOf(vIdx);
    if (pos !== -1) {
        arr.splice(pos, 1); // Remove highlight
    } else {
        arr.push(vIdx); // Add highlight
    }
    saveToLocalStorage();

    // Update just the verse element
    var el = document.querySelector('.bible-verse-line[data-vidx="' + vIdx + '"]');
    if (el) el.classList.toggle('highlighted');
}

function shareBibleVerse(ch, vIdx) {
    var chapter = MARK_CHAPTERS[ch - 1];
    // Try loading from embedded text if not already loaded
    if (chapter && (!chapter.text || !chapter.text[vIdx]) && typeof MARK_FULL_TEXT !== 'undefined' && MARK_FULL_TEXT[ch]) {
        chapter.text = MARK_FULL_TEXT[ch];
    }
    if (!chapter || !chapter.text || !chapter.text[vIdx]) {
        showToast('مفيش نص للآية دي', 'warning');
        return;
    }
    var verseText = '"' + chapter.text[vIdx] + '" (مرقس ' + ch + ':' + (vIdx + 1) + ')';

    if (navigator.share) {
        navigator.share({
            title: 'آية من إنجيل مار مرقس',
            text: verseText
        }).catch(function() {});
    } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(verseText).then(function() {
            showToast('تم نسخ الآية! 📋', 'success');
        }).catch(function() {
            showToast(verseText, 'info');
        });
    }
}

function handleBibleImage(event) {
    var file = event.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
        var preview = document.getElementById('bible-image-preview');
        if (preview) {
            preview.innerHTML = '<img src="' + e.target.result + '" class="bible-preview-img">';
            // Store temporarily
            window._bibleImageData = e.target.result;
        }
    };
    reader.readAsDataURL(file);
}

function fetchMarkChapter(ch) {
    // Load from embedded MARK_FULL_TEXT if available
    if (typeof MARK_FULL_TEXT !== 'undefined' && MARK_FULL_TEXT[ch]) {
        var chapter = MARK_CHAPTERS[ch - 1];
        chapter.text = MARK_FULL_TEXT[ch];
        renderBibleReading();
        showToast('تم تحميل الأصحاح! 📖', 'success');
        return;
    }

    // Fallback: fetch from bolls.life free API (no CORS issues)
    showToast('جاري تحميل الأصحاح...', 'info');
    fetch('https://bolls.life/get-chapter/SVD/41/' + ch + '/')
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data && Array.isArray(data) && data.length > 0) {
                var chapter = MARK_CHAPTERS[ch - 1];
                chapter.text = data.map(function(v) { return v.text.replace(/<[^>]*>/g, '').trim(); });
                renderBibleReading();
                showToast('تم تحميل الأصحاح! 📖', 'success');
            } else {
                showToast('لم يتم العثور على النص', 'warning');
            }
        })
        .catch(function(err) {
            // Try alternative API
            fetch('https://bible-api.com/mark+' + ch + '?translation=svd')
                .then(function(res) { return res.json(); })
                .then(function(data2) {
                    if (data2 && data2.verses) {
                        var chapter = MARK_CHAPTERS[ch - 1];
                        chapter.text = data2.verses.map(function(v) { return v.text.trim(); });
                        renderBibleReading();
                        showToast('تم تحميل الأصحاح! 📖', 'success');
                    }
                })
                .catch(function() {
                    showToast('خطأ في التحميل - تأكد من الاتصال بالإنترنت', 'error');
                });
        });
}

function completeBibleReading() {
    var todayKey = getTodayKey();
    var summaryInput = document.getElementById('bible-summary-input');
    var summary = summaryInput ? summaryInput.value.trim() : '';

    if (!GameState.bibleReadingLog) GameState.bibleReadingLog = {};
    GameState.bibleReadingLog[todayKey] = {
        chapter: GameState.bibleChapter,
        summary: summary,
        image: window._bibleImageData || null,
        done: true,
        date: todayKey
    };
    window._bibleImageData = null;

    // Award points
    GameState.stars += 10;

    // Advance to next chapter
    if (GameState.bibleChapter < 16) {
        GameState.bibleChapter++;
    }

    saveToCloud();
    saveToLocalStorage();
    renderBibleReading();
    showToast('أحسنت! ⭐ +10 نجوم', 'success');
}

// --- Devotion Screen ---
function renderDevotion() {
    var body = document.getElementById('devotion-body');
    if (!body) return;

    var todayKey = getTodayKey();
    var todayLog = (GameState.devotionLog || {})[todayKey] || {};

    var html = '';

    // Streak counter
    var streak = calculateDevotionStreak();
    html += '<div class="devotion-streak-card">';
    html += '<div class="devotion-streak-number">' + streak + '</div>';
    html += '<p>يوم متواصل في الصلاة 🔥</p>';
    html += '</div>';

    // Morning prayer
    html += '<div class="devotion-card ' + (todayLog.morning ? 'done' : '') + '">';
    html += '<div class="devotion-card-header">';
    html += '<span class="devotion-icon">🌅</span>';
    html += '<div><h4>صلاة باكر</h4><p>ابدأ يومك بالصلاة</p></div>';
    html += '</div>';
    if (todayLog.morning) {
        html += '<div class="devotion-done-badge"><i class="fas fa-check-circle"></i> تمت ⭐ +5</div>';
    } else {
        html += '<button class="btn btn-primary devotion-btn" onclick="completeDevotionTask(\'morning\')">';
        html += '<span><i class="fas fa-check"></i> صليت صلاة باكر (+5 ⭐)</span></button>';
    }
    html += '</div>';

    // Night prayer
    html += '<div class="devotion-card ' + (todayLog.night ? 'done' : '') + '">';
    html += '<div class="devotion-card-header">';
    html += '<span class="devotion-icon">🌙</span>';
    html += '<div><h4>صلاة النوم</h4><p>اختم يومك بالصلاة</p></div>';
    html += '</div>';
    if (todayLog.night) {
        html += '<div class="devotion-done-badge"><i class="fas fa-check-circle"></i> تمت ⭐ +5</div>';
    } else {
        html += '<button class="btn btn-primary devotion-btn" onclick="completeDevotionTask(\'night\')">';
        html += '<span><i class="fas fa-check"></i> صليت صلاة النوم (+5 ⭐)</span></button>';
    }
    html += '</div>';

    // Tips
    html += '<div class="devotion-tip-card">';
    html += '<h4><i class="fas fa-lightbulb"></i> نصيحة اليوم</h4>';
    var tips = [
        'صلي بتركيز وهدوء، وابعد عن الموبايل وقت الصلاة',
        'خصص مكان هادي للصلاة كل يوم',
        'ابدأ صلاتك بشكر ربنا على نعمه',
        'صلي من أجل أصحابك وأهلك',
        'اقرأ مزمور قبل ما تبدأ صلاتك',
        'خلي الصلاة عادة يومية مش مجرد واجب',
        'كلم ربنا زي ما بتكلم صاحبك المقرب'
    ];
    var tipIdx = new Date().getDate() % tips.length;
    html += '<p>' + tips[tipIdx] + '</p>';
    html += '</div>';

    body.innerHTML = html;
}

function completeDevotionTask(type) {
    var todayKey = getTodayKey();
    if (!GameState.devotionLog) GameState.devotionLog = {};
    if (!GameState.devotionLog[todayKey]) GameState.devotionLog[todayKey] = {};

    GameState.devotionLog[todayKey][type] = true;
    GameState.stars += 5;

    saveToCloud();
    saveToLocalStorage();
    renderDevotion();
    showToast('أحسنت! ⭐ +5 نجوم', 'success');
}

function calculateDevotionStreak() {
    var streak = 0;
    var d = new Date();
    for (var i = 0; i < 365; i++) {
        var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        var dayLog = (GameState.devotionLog || {})[key];
        if (dayLog && (dayLog.morning || dayLog.night)) {
            streak++;
        } else if (i > 0) {
            break; // streak broken
        }
        d.setDate(d.getDate() - 1);
    }
    return streak;
}

// --- Exercises Screen ---
function renderExercises() {
    var body = document.getElementById('exercises-body');
    if (!body) return;

    var todayKey = getTodayKey();
    var weekKey = getWeekKey();
    if (!GameState.exerciseLog) GameState.exerciseLog = {};
    var todayLog = GameState.exerciseLog[todayKey] || { daily: [] };
    var weekLog = GameState.exerciseLog[weekKey] || { weekly: [] };

    var html = '';

    // Daily exercises
    html += '<h3 class="exercise-section-title"><i class="fas fa-sun"></i> تداريب يومية</h3>';
    html += '<div class="exercise-list">';
    DAILY_EXERCISES.forEach(function(ex) {
        var isDone = (todayLog.daily || []).indexOf(ex.id) !== -1;
        html += '<div class="exercise-item ' + (isDone ? 'done' : '') + '" onclick="' + (isDone ? '' : 'toggleDailyExercise(\'' + ex.id + '\')') + '">';
        html += '<span class="exercise-icon">' + ex.icon + '</span>';
        html += '<span class="exercise-text">' + ex.text + '</span>';
        html += '<span class="exercise-points">' + (isDone ? '<i class="fas fa-check-circle"></i>' : '+' + ex.points + ' ⭐') + '</span>';
        html += '</div>';
    });
    html += '</div>';

    // Weekly exercises
    html += '<h3 class="exercise-section-title"><i class="fas fa-calendar-week"></i> تداريب أسبوعية</h3>';
    html += '<div class="exercise-list">';
    WEEKLY_EXERCISES.forEach(function(ex) {
        var isDone = (weekLog.weekly || []).indexOf(ex.id) !== -1;
        html += '<div class="exercise-item ' + (isDone ? 'done' : '') + '" onclick="' + (isDone ? '' : 'toggleWeeklyExercise(\'' + ex.id + '\')') + '">';
        html += '<span class="exercise-icon">' + ex.icon + '</span>';
        html += '<span class="exercise-text">' + ex.text + '</span>';
        html += '<span class="exercise-points">' + (isDone ? '<i class="fas fa-check-circle"></i>' : '+' + ex.points + ' ⭐') + '</span>';
        html += '</div>';
    });
    html += '</div>';

    // Today's total
    var dailyPts = 0;
    (todayLog.daily || []).forEach(function(id) {
        var ex = DAILY_EXERCISES.find(function(e) { return e.id === id; });
        if (ex) dailyPts += ex.points;
    });
    var weeklyPts = 0;
    (weekLog.weekly || []).forEach(function(id) {
        var ex = WEEKLY_EXERCISES.find(function(e) { return e.id === id; });
        if (ex) weeklyPts += ex.points;
    });

    html += '<div class="exercise-total-card">';
    html += '<div class="exercise-total-stat"><span>⭐ ' + dailyPts + '</span><small>نجوم النهاردة</small></div>';
    html += '<div class="exercise-total-stat"><span>⭐ ' + weeklyPts + '</span><small>نجوم الأسبوع</small></div>';
    html += '</div>';

    body.innerHTML = html;
}

function toggleDailyExercise(id) {
    var todayKey = getTodayKey();
    if (!GameState.exerciseLog) GameState.exerciseLog = {};
    if (!GameState.exerciseLog[todayKey]) GameState.exerciseLog[todayKey] = { daily: [] };
    if (!GameState.exerciseLog[todayKey].daily) GameState.exerciseLog[todayKey].daily = [];

    if (GameState.exerciseLog[todayKey].daily.indexOf(id) === -1) {
        GameState.exerciseLog[todayKey].daily.push(id);
        var ex = DAILY_EXERCISES.find(function(e) { return e.id === id; });
        if (ex) {
            GameState.stars += ex.points;
            showToast(ex.icon + ' أحسنت! +' + ex.points + ' ⭐', 'success');
        }
        saveToCloud();
        saveToLocalStorage();
    }
    renderExercises();
}

function toggleWeeklyExercise(id) {
    var weekKey = getWeekKey();
    if (!GameState.exerciseLog) GameState.exerciseLog = {};
    if (!GameState.exerciseLog[weekKey]) GameState.exerciseLog[weekKey] = { weekly: [] };
    if (!GameState.exerciseLog[weekKey].weekly) GameState.exerciseLog[weekKey].weekly = [];

    if (GameState.exerciseLog[weekKey].weekly.indexOf(id) === -1) {
        GameState.exerciseLog[weekKey].weekly.push(id);
        var ex = WEEKLY_EXERCISES.find(function(e) { return e.id === id; });
        if (ex) {
            GameState.stars += ex.points;
            showToast(ex.icon + ' أحسنت! +' + ex.points + ' ⭐', 'success');
        }
        saveToCloud();
        saveToLocalStorage();
    }
    renderExercises();
}

// --- Update spiritual badges on home hub ---
function updateSpiritualBadges() {
    var todayKey = getTodayKey();

    // Bible reading
    ['bible-streak-badge', 'bible-streak-badge-top'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) {
            var bibleToday = (GameState.bibleReadingLog || {})[todayKey];
            el.innerHTML = bibleToday && bibleToday.done ?
                '<i class="fas fa-check-circle"></i> تم' :
                'الأصحاح ' + (GameState.bibleChapter || 1);
            el.className = 'spiritual-card-streak' + (bibleToday && bibleToday.done ? ' done' : '');
        }
    });

    // Devotion
    ['devotion-streak-badge', 'devotion-streak-badge-top'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) {
            var devLog = (GameState.devotionLog || {})[todayKey] || {};
            var devCount = (devLog.morning ? 1 : 0) + (devLog.night ? 1 : 0);
            el.innerHTML = devCount + '/2 صلوات';
            el.className = 'spiritual-card-streak' + (devCount === 2 ? ' done' : '');
        }
    });

    // Exercises
    ['exercise-streak-badge', 'exercise-streak-badge-top'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) {
            var exLog = (GameState.exerciseLog || {})[todayKey] || {};
            var exCount = (exLog.daily || []).length;
            el.innerHTML = exCount + '/' + DAILY_EXERCISES.length + ' تداريب';
            el.className = 'spiritual-card-streak' + (exCount === DAILY_EXERCISES.length ? ' done' : '');
        }
    });
}

// --- Hook screen rendering ---
var _origShowScreen = typeof showScreen === 'function' ? showScreen : null;

// ============================================================
// DAILY SPIN WHEEL
// ============================================================

var SPIN_PRIZES = [
    { label: '50 ⭐', type: 'stars', value: 50, color: '#FDCB6E' },
    { label: '5 💎', type: 'gems', value: 5, color: '#00CEC9' },
    { label: '100 ⭐', type: 'stars', value: 100, color: '#6C5CE7' },
    { label: '10 💎', type: 'gems', value: 10, color: '#FD79A8' },
    { label: '200 ⭐', type: 'stars', value: 200, color: '#E17055' },
    { label: '20 💎', type: 'gems', value: 20, color: '#00B894' },
    { label: 'تخطي ❓', type: 'skipQ', value: 1, color: '#a29bfe' },
    { label: 'صندوق 🎁', type: 'mystery', value: 0, color: '#fd6b6b' }
];

// ============================================================
// VERSES FOR صوت يسوع WHEEL
// ============================================================
var JESUS_VERSES = [
    { ref: 'يو ٣: ١٦', short: 'محبة الله', color: '#6C5CE7',
      text: 'لأنه هكذا أحب الله العالم حتى بذل ابنه الوحيد لكي لا يهلك كل من يؤمن به بل تكون له الحياة الأبدية.' },
    { ref: 'مز ٢٣: ١', short: 'الراعي الصالح', color: '#00B894',
      text: 'الرب راعيَّ فلا يعوزني شيء.' },
    { ref: 'في ٤: ١٣', short: 'المسيح يقوّيني', color: '#FDCB6E',
      text: 'أستطيع كل شيء في المسيح الذي يقوّيني.' },
    { ref: 'إر ٢٩: ١١', short: 'أفكار السلام', color: '#FD79A8',
      text: 'لأني أنا عارف الأفكار التي أنا أفكر بها نحوكم، يقول الرب. أفكار سلامة لا أفكار شر، لأعطيكم آخرة ورجاءً.' },
    { ref: 'يش ١: ٩', short: 'لا تخف', color: '#00CEC9',
      text: 'لأن الرب إلهك معك أينما توجهت.' },
    { ref: 'مت ١١: ٢٨', short: 'تعالوا إليّ', color: '#E17055',
      text: 'تعالوا إليّ يا جميع المتعبين والثقيلي الأحمال وأنا أريحكم.' },
    { ref: 'رو ٨: ٢٨', short: 'كل شيء للخير', color: '#a29bfe',
      text: 'ونحن نعلم أن كل الأشياء تعمل معاً للخير للذين يحبون الله.' },
    { ref: 'مز ٤٦: ١', short: 'الله ملجأنا', color: '#fd6b6b',
      text: 'الله ملجأنا وقوتنا عوناً في الضيقات وُجد سريعاً.' },
    { ref: '١ بط ٥: ٧', short: 'ألقِ همّك', color: '#55efc4',
      text: 'مُلقين كل همّكم عليه لأنه هو يعتني بكم.' },
    { ref: 'مز ٣٧: ٤', short: 'تلذذ بالرب', color: '#fdcb6e',
      text: 'تلذذ بالرب فيعطيك سؤال قلبك.' },
    { ref: 'غل ٢: ٢٠', short: 'المسيح يحيا فيّ', color: '#6c5ce7',
      text: 'مع المسيح صُلبتُ فأحيا لا أنا بل المسيح يحيا فيّ.' },
    { ref: 'يو ١٤: ٢٧', short: 'سلامي أعطيكم', color: '#0984e3',
      text: 'السلام أتركه لكم، سلامي أعطيكم. لا كما يعطي العالم أعطيكم أنا. لا تضطرب قلوبكم ولا ترهب.' },
    { ref: 'يو ١٥: ١٢', short: 'وصية المحبة', color: '#E84393',
      text: 'هَذِهِ هِيَ وَصِيَّتِي أَنْ تُحِبُّوا بَعْضُكُمْ بَعْضًا كَمَا أَحْبَبْتُكُمْ.' },
    { ref: 'يو ١٥: ١٣', short: 'المحبة العظمى', color: '#C0392B',
      text: 'لَيْسَ لِأَحَدٍ حُبٌّ أَعْظَمُ مِنْ هَذَا: أَنْ يَضَعَ أَحَدٌ نَفْسَهُ لِأَجْلِ أَحِبَّائِهِ.' },
    { ref: 'مر ١٢: ٣٠', short: 'أحبب الرب', color: '#8E44AD',
      text: 'وَتُحِبُّ الرَّبَّ إِلَهَكَ مِنْ كُلِّ قَلْبِكَ، وَمِنْ كُلِّ نَفْسِكَ، وَمِنْ كُلِّ فِكْرِكَ، وَمِنْ كُلِّ قُدْرَتِكَ.' },
    { ref: '١ كو ١٠: ٢٤', short: 'ما هو للآخر', color: '#1ABC9C',
      text: 'لَا يَطْلُبْ أَحَدٌ مَا هُوَ لِنَفْسِهِ، بَلْ كُلُّ وَاحِدٍ مَا هُوَ لِلْآخَرِ.' },
    { ref: '٢ تي ١: ٧', short: 'روح القوة', color: '#D35400',
      text: 'لِأَنَّ اللهَ لَمْ يُعْطِنَا رُوحَ الْفَشَلِ، بَلْ رُوحَ الْقُوَّةِ وَالْمَحَبَّةِ وَالنُّصْحِ.' },
    { ref: '١ تي ٤: ١٢', short: 'كن قدوة', color: '#27AE60',
      text: 'لَا يَسْتَهِنْ أَحَدٌ بِحَدَاثَتِكَ، بَلْ كُنْ قُدْوَةً لِلْمُؤْمِنِينَ: فِي الْكَلَامِ، فِي التَّصَرُّفِ، فِي الْمَحَبَّةِ، فِي الرُّوحِ، فِي الْإِيمَانِ، فِي الطَّهَارَةِ.' },
    { ref: 'رو ٨: ٣٥', short: 'محبة المسيح', color: '#2980B9',
      text: 'مَنْ سَيَفْصِلُنَا عَنْ مَحَبَّةِ الْمَسِيحِ؟ أَشِدَّةٌ أَمْ ضِيقٌ أَمِ اضْطِهَادٌ أَمْ جُوعٌ أَمْ عُرْيٌ أَمْ خَطَرٌ أَمْ سَيْفٌ؟' },
    { ref: 'مز ١٠٣: ٨', short: 'رحمة الرب', color: '#F39C12',
      text: 'الرَّبُّ رَحِيمٌ وَرَؤُوفٌ، طَوِيلُ الرُّوحِ وَكَثِيرُ الرَّحْمَةِ.' },
    { ref: 'لو ١٠: ٢٧', short: 'أحبب قريبك', color: '#16A085',
      text: 'تُحِبُّ الرَّبَّ إِلَهَكَ مِنْ كُلِّ قَلْبِكَ، وَمِنْ كُلِّ نَفْسِكَ، وَمِنْ كُلِّ قُدْرَتِكَ، وَمِنْ كُلِّ فِكْرِكَ، وَقَرِيبَكَ مِثْلَ نَفْسِكَ.' },
    { ref: 'يو ١٤: ١٥', short: 'احفظ وصاياه', color: '#7F8C8D',
      text: 'إِنْ كُنْتُمْ تُحِبُّونَنِي فَاحْفَظُوا وَصَايَايَ.' },
    { ref: 'أم ٤: ٢٣', short: 'احفظ قلبك', color: '#E74C3C',
      text: 'فَوْقَ كُلِّ تَحَفُّظٍ احْفَظْ قَلْبَكَ، لِأَنَّ مِنْهُ مَخَارِجَ الْحَيَاةِ.' },
    { ref: 'مز ١٦: ٨', short: 'الرب أمامي', color: '#5DADE2',
      text: 'جَعَلْتُ الرَّبَّ أَمَامِي فِي كُلِّ حِينٍ، لِأَنَّهُ عَنْ يَمِينِي فَلَا أَتَزَعْزَعُ.' },
    { ref: 'أم ١٨: ١٠', short: 'برج حصين', color: '#884EA0',
      text: 'اسْمُ الرَّبِّ بُرْجٌ حَصِينٌ، يَرْكُضُ إِلَيْهِ الصِّدِّيقُ وَيَتَمَنَّعُ.' },
    { ref: 'نا ١: ٧', short: 'الرب حصن', color: '#1F618D',
      text: 'صَالِحٌ هُوَ الرَّبُّ. حِصْنٌ فِي يَوْمِ الضَّيقِ، وَهُوَ يَعْرِفُ الْمُتَوَكِّلِينَ عَلَيْهِ.' },
    { ref: '١ كو ١٥: ٥٨', short: 'كونوا راسخين', color: '#1E8449',
      text: 'كُونُوا رَاسِخِينَ، غَيْرَ مُتَزَعْزِعِينَ، مُكْثِرِينَ فِي عَمَلِ الرَّبِّ كُلَّ حِينٍ، عَالِمِينَ أَنَّ تَعَبَكُمْ لَيْسَ بَاطِلًا فِي الرَّبِّ.' },
    { ref: 'غل ٥: ١٣', short: 'بالمحبة اخدموا', color: '#A93226',
      text: 'فَإِنَّكُمْ إِنَّمَا دُعِيتُمْ لِلْحُرِّيَّةِ أَيُّهَا الْإِخْوَةُ. غَيْرَ أَنَّهُ لَا تُصَيِّرُوا الْحُرِّيَّةَ فُرْصَةً لِلْجَسَدِ، بَلْ بِالْمَحَبَّةِ اخْدِمُوا بَعْضُكُمْ بَعْضًا.' },
    { ref: 'رو ٦: ١٣', short: 'قدموا ذواتكم لله', color: '#117A65',
      text: 'قَدِّمُوا ذَوَاتِكُمْ لِلهِ كَأَحْيَاءٍ مِنَ الْأَمْوَاتِ وَأَعْضَاءَكُمْ آلَاتِ بِرٍّ لِلهِ.' },
    { ref: 'لو ٥: ٣٢', short: 'دعوة التوبة', color: '#6C3483',
      text: 'لَمْ آتِ لِأَدْعُوَ أَبْرَارًا بَلْ خُطَاةً إِلَى التَّوْبَةِ.' }
];

// ============================================================
// صوت يسوع — VERSE WHEEL
// ============================================================

function openVerseWheel() {
    var existing = document.getElementById('verse-wheel-overlay');
    if (existing) existing.remove();

    var today = getTodayKey();
    var alreadySpun = GameState.todayVerseSpinDate === today && GameState.todayVerse;

    var overlay = document.createElement('div');
    overlay.id = 'verse-wheel-overlay';
    overlay.className = 'spin-overlay';

    if (alreadySpun) {
        // Already spun today — show read-only verse, no re-spin allowed
        var v = GameState.todayVerse;
        overlay.innerHTML =
            '<div class="spin-modal verse-wheel-modal">' +
            '<div class="verse-wheel-title-row">' +
            '<div class="verse-wheel-cross">🙏</div>' +
            '<h3>صوت يسوع ليك النهارده</h3>' +
            '</div>' +
            '<div class="verse-already-spun">' +
            '<div class="verse-spin-result" style="border-color:' + (v.color || '#6C5CE7') + ';margin:0">' +
            '<div class="verse-spin-ref" style="color:' + (v.color || '#6C5CE7') + ';border-color:' + (v.color || '#6C5CE7') + '">' + v.ref + '</div>' +
            '<div class="verse-spin-text">"' + v.text + '"</div>' +
            '</div>' +
            '<p class="verse-locked-msg">🔒 آيتك لهذا اليوم — تعود الغد بآية جديدة</p>' +
            '</div>' +
            '<div class="spin-actions">' +
            '<button class="btn btn-primary" onclick="closeVerseWheel()" style="width:100%">' +
            '<span>🙏 آمين</span></button>' +
            '</div>' +
            '</div>';
        document.body.appendChild(overlay);
        setTimeout(function() { overlay.classList.add('visible'); }, 10);
        return;
    }

    // First spin today — show the wheel
    overlay.innerHTML =
        '<div class="spin-modal verse-wheel-modal">' +
        '<div class="verse-wheel-title-row">' +
        '<div class="verse-wheel-cross">🙏</div>' +
        '<h3>صوت يسوع ليك النهارده</h3>' +
        '</div>' +
        '<p class="verse-wheel-subtitle">اضغط العجلة عشان تكشف آيتك اليوم</p>' +
        '<div class="spin-wheel-container">' +
        '<div class="spin-pointer-top">▼</div>' +
        '<canvas id="verse-canvas" width="260" height="260"></canvas>' +
        '</div>' +
        '<div id="verse-result-area"></div>' +
        '<div class="spin-actions" id="verse-spin-actions">' +
        '<button class="btn btn-primary spin-go-btn verse-spin-btn" id="btn-verse-spin" onclick="executeVerseSpin()">' +
        '<span>🙏 اكشف الآية</span></button>' +
        '<button class="btn btn-secondary" onclick="closeVerseWheel()"><span>لاحقاً</span></button>' +
        '</div>' +
        '</div>';
    document.body.appendChild(overlay);
    setTimeout(function() { overlay.classList.add('visible'); }, 10);
    drawVerseCanvas(null, 0);
}

var _verseAngle = 0;

function drawVerseCanvas(highlightIdx, rotationDeg) {
    var canvas = document.getElementById('verse-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var n = JESUS_VERSES.length;
    var arc = (2 * Math.PI) / n;
    var cx = 130, cy = 130, r = 125;
    ctx.clearRect(0, 0, 260, 260);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(((rotationDeg || 0) * Math.PI) / 180);
    ctx.translate(-cx, -cy);

    JESUS_VERSES.forEach(function(v, i) {
        var start = i * arc - Math.PI / 2;
        var end = start + arc;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, start, end);
        ctx.closePath();
        ctx.fillStyle = v.color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Text label
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(start + arc / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px Cairo, sans-serif';
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = 4;
        ctx.fillText(v.ref, r - 8, 5);
        ctx.restore();
    });
    // Highlight
    if (highlightIdx !== null && highlightIdx !== undefined) {
        var hs = highlightIdx * arc - Math.PI / 2;
        var he = hs + arc;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, hs, he);
        ctx.closePath();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;
        ctx.stroke();
    }
    ctx.restore();

    // Center circle with cross
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, 2 * Math.PI);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '18px Cairo';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🙏', cx, cy);
    ctx.textBaseline = 'alphabetic';
}

var _verseAnimFrame = null;

function executeVerseSpin() {
    var today = getTodayKey();
    var spinBtn = document.getElementById('btn-verse-spin');
    if (spinBtn) spinBtn.disabled = true;

    var winIdx = Math.floor(Math.random() * JESUS_VERSES.length);
    var n = JESUS_VERSES.length;
    var arcDeg = 360 / n;
    var targetDeg = 360 * 6 + (270 - winIdx * arcDeg - arcDeg / 2);
    var startDeg = _verseAngle % 360;
    var totalDeg = targetDeg - startDeg;
    if (totalDeg < 360) totalDeg += 360;

    var startTime = null;
    var duration = 4500;

    function animate(ts) {
        if (!startTime) startTime = ts;
        var elapsed = ts - startTime;
        var t = Math.min(elapsed / duration, 1);
        var eased = 1 - Math.pow(1 - t, 3);
        var currentDeg = startDeg + totalDeg * eased;
        _verseAngle = currentDeg;
        drawVerseCanvas(null, currentDeg);
        if (t < 1) {
            _verseAnimFrame = requestAnimationFrame(animate);
        } else {
            _verseAnimFrame = null;
            onVerseSpinComplete(winIdx, today);
        }
    }
    _verseAnimFrame = requestAnimationFrame(animate);
}

function onVerseSpinComplete(winIdx, today) {
    var verse = JESUS_VERSES[winIdx];

    // Save to GameState
    GameState.todayVerseSpinDate = today;
    GameState.todayVerse = { ref: verse.ref, text: verse.text, color: verse.color, short: verse.short };
    saveToLocalStorage();

    // Show result in wheel modal
    var area = document.getElementById('verse-result-area');
    if (area) {
        area.innerHTML =
            '<div class="verse-spin-result" style="border-color:' + verse.color + '">' +
            '<div class="verse-spin-ref" style="color:' + verse.color + ';border-color:' + verse.color + '">' + verse.ref + '</div>' +
            '<div class="verse-spin-text">"' + verse.text + '"</div>' +
            '</div>' +
            '<p class="verse-locked-msg">🔒 آيتك لهذا اليوم — تعود الغد بآية جديدة</p>';
    }
    // Update button — lock the spin
    var actionsDiv = document.getElementById('verse-spin-actions');
    if (actionsDiv) {
        actionsDiv.innerHTML =
            '<button class="btn btn-primary" onclick="closeVerseWheel()" style="width:100%">' +
            '<span>🙏 آمين! إغلاق</span></button>';
    }
    launchConfetti(2000);
    showCelebration('🙏', 'صوت يسوع ليك النهارده!', '#FDCB6E');
}

function closeVerseWheel() {
    var overlay = document.getElementById('verse-wheel-overlay');
    if (!overlay) return;
    overlay.classList.remove('visible');
    setTimeout(function() {
        overlay.remove();
        renderHomeHub();
    }, 300);
}

function renderTodayVerse() {
    var section = document.getElementById('today-verse-section');
    var today = getTodayKey();
    var badge = document.getElementById('verse-spin-badge');

    if (GameState.todayVerseSpinDate === today && GameState.todayVerse) {
        var v = GameState.todayVerse;
        if (section) {
            section.innerHTML =
                '<div class="today-verse-card" style="border-color:' + (v.color || '#6C5CE7') + '">' +
                '<div class="today-verse-label">✝ صوت يسوع ليك النهارده</div>' +
                '<div class="today-verse-ref" style="color:' + (v.color || '#6C5CE7') + '">' + v.ref + '</div>' +
                '<div class="today-verse-text">"' + v.text + '"</div>' +
                '</div>';
        }
        if (badge) {
            badge.textContent = '✅ ' + v.ref;
            badge.className = 'spiritual-card-streak done';
        }
    } else {
        if (section) {
            section.innerHTML =
                '<div class="today-verse-card today-verse-pending" onclick="openVerseWheel()">' +
                '<div class="today-verse-label">✝ صوت يسوع ليك النهارده</div>' +
                '<div class="today-verse-spin-prompt">🎡 اضغط لتكشف آيتك اليوم</div>' +
                '</div>';
        }
        if (badge) {
            badge.textContent = 'اكشف آيتك';
            badge.className = 'spiritual-card-streak';
        }
    }
}

function openSpinWheel() {
    var existing = document.getElementById('spin-wheel-overlay');
    if (existing) existing.remove();

    var today = getTodayKey();
    var hasFreeSpin = GameState.dailySpinDate !== today;

    // Check if bonus spin should be awarded (all daily exercises done today)
    var exLog = (GameState.exerciseLog || {})[today] || {};
    var exDoneCount = (exLog.daily || []).length;
    var allExDone = DAILY_EXERCISES.length > 0 && exDoneCount >= DAILY_EXERCISES.length;
    if (allExDone && !GameState.dailyBonusSpin && !hasFreeSpin) {
        GameState.dailyBonusSpin = true;
        saveToLocalStorage();
    }

    var hasSpin = hasFreeSpin || GameState.dailyBonusSpin;

    var overlay = document.createElement('div');
    overlay.id = 'spin-wheel-overlay';
    overlay.className = 'spin-overlay';
    overlay.innerHTML = '<div class="spin-modal">' +
        '<div class="spin-modal-header">' +
        '<h3>🎰 عجلة الحظ</h3>' +
        (allExDone && GameState.dailyBonusSpin ? '<div class="spin-bonus-badge">🎉 لفة مكافأة - أكملت تداريبك!</div>' : '') +
        '</div>' +
        '<div class="spin-wheel-container">' +
        '<div class="spin-pointer-top">▼</div>' +
        '<canvas id="spin-canvas" width="260" height="260"></canvas>' +
        '</div>' +
        '<div id="spin-result-area"></div>' +
        '<div class="spin-actions">' +
        '<button class="btn btn-primary spin-go-btn" id="btn-spin-go" onclick="executeSpin()" ' + (hasSpin ? '' : 'disabled') + '>' +
        '<span>' + (hasSpin ? '🎰 العب!' : '⏰ اجيت النهارده') + '</span></button>' +
        '<button class="btn btn-secondary" onclick="closeSpinWheel()"><span>إغلاق</span></button>' +
        '</div>' +
        '</div>';
    document.body.appendChild(overlay);
    setTimeout(function() { overlay.classList.add('visible'); }, 10);
    drawSpinCanvas(null);
}

function drawSpinCanvas(highlightIdx) {
    var canvas = document.getElementById('spin-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var n = SPIN_PRIZES.length;
    var arc = (2 * Math.PI) / n;
    var cx = 130, cy = 130, r = 125;
    ctx.clearRect(0, 0, 260, 260);
    SPIN_PRIZES.forEach(function(p, i) {
        var start = i * arc - Math.PI / 2;
        var end = start + arc;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, start, end);
        ctx.closePath();
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Text
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(start + arc / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Cairo, sans-serif';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 3;
        ctx.fillText(p.label, r - 8, 5);
        ctx.restore();
    });
    // Highlight border
    if (highlightIdx !== null && highlightIdx !== undefined) {
        var hs = highlightIdx * arc - Math.PI / 2;
        var he = hs + arc;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, hs, he);
        ctx.closePath();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;
        ctx.stroke();
    }
    // Center
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, 2 * Math.PI);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
}

var _spinAngle = 0;
var _spinAnimFrame = null;

function executeSpin() {
    var today = getTodayKey();
    var hasFreeSpin = GameState.dailySpinDate !== today;
    var isBonus = !hasFreeSpin && GameState.dailyBonusSpin;
    if (!hasFreeSpin && !isBonus) { showToast('استخدمت العجلة النهاردة!', 'warning'); return; }

    var spinBtn = document.getElementById('btn-spin-go');
    if (spinBtn) spinBtn.disabled = true;

    // Consume the spin
    if (hasFreeSpin) { GameState.dailySpinDate = today; GameState.dailyBonusSpin = false; }
    else { GameState.dailyBonusSpin = false; }
    saveToLocalStorage();

    var winIdx = Math.floor(Math.random() * SPIN_PRIZES.length);
    var n = SPIN_PRIZES.length;
    var arcDeg = 360 / n;
    // Calculate final angle so that pointer (top) lands on winIdx segment center
    var targetDeg = 360 * 6 + (270 - winIdx * arcDeg - arcDeg / 2);
    var startDeg = _spinAngle % 360;
    var totalDeg = targetDeg - startDeg;
    if (totalDeg < 360) totalDeg += 360;

    var startTime = null;
    var duration = 4000;

    function animate(ts) {
        if (!startTime) startTime = ts;
        var elapsed = ts - startTime;
        var t = Math.min(elapsed / duration, 1);
        // ease-out cubic
        var eased = 1 - Math.pow(1 - t, 3);
        var currentDeg = startDeg + totalDeg * eased;
        _spinAngle = currentDeg;

        // Redraw canvas rotated
        var canvas = document.getElementById('spin-canvas');
        if (!canvas) return;
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 260, 260);
        ctx.save();
        ctx.translate(130, 130);
        ctx.rotate((currentDeg * Math.PI) / 180);
        ctx.translate(-130, -130);
        drawSpinCanvas(null);
        ctx.restore();

        if (t < 1) {
            _spinAnimFrame = requestAnimationFrame(animate);
        } else {
            _spinAnimFrame = null;
            onSpinComplete(winIdx);
        }
    }

    _spinAnimFrame = requestAnimationFrame(animate);
}

function onSpinComplete(winIdx) {
    var prize = SPIN_PRIZES[winIdx];
    var resultHTML = '';

    if (prize.type === 'stars') {
        GameState.stars = (GameState.stars || 0) + prize.value;
        resultHTML = '<div class="spin-prize-result"><span class="spin-prize-icon">⭐</span><div>كسبت <strong>' + prize.value + '</strong> نجمة!</div></div>';
        launchConfetti(1500);
    } else if (prize.type === 'gems') {
        GameState.gems = (GameState.gems || 0) + prize.value;
        resultHTML = '<div class="spin-prize-result"><span class="spin-prize-icon">💎</span><div>كسبت <strong>' + prize.value + '</strong> جوهرة!</div></div>';
        launchConfetti(1500);
    } else if (prize.type === 'skipQ') {
        if (!GameState.powerUps) GameState.powerUps = {};
        GameState.powerUps.skipQ = (GameState.powerUps.skipQ || 0) + 1;
        resultHTML = '<div class="spin-prize-result"><span class="spin-prize-icon">⏭️</span><div>كسبت <strong>تخطي سؤال</strong>!</div></div>';
    } else if (prize.type === 'mystery') {
        var mysterys = [{type:'stars',value:30},{type:'stars',value:150},{type:'gems',value:3},{type:'gems',value:8}];
        var m = mysterys[Math.floor(Math.random()*mysterys.length)];
        if (m.type === 'stars') { GameState.stars = (GameState.stars||0)+m.value; resultHTML = '<div class="spin-prize-result"><span class="spin-prize-icon">🎁</span><div>صندوق المفاجآت: <strong>' + m.value + ' ⭐</strong>!</div></div>'; }
        else { GameState.gems = (GameState.gems||0)+m.value; resultHTML = '<div class="spin-prize-result"><span class="spin-prize-icon">🎁</span><div>صندوق المفاجآت: <strong>' + m.value + ' 💎</strong>!</div></div>'; }
        launchConfetti(1500);
    }

    saveToLocalStorage();
    var area = document.getElementById('spin-result-area');
    if (area) area.innerHTML = resultHTML;

    // Update button to "done"
    var btn = document.getElementById('btn-spin-go');
    if (btn) { btn.innerHTML = '<span>✅ تم!</span>'; btn.disabled = true; }
}

function closeSpinWheel() {
    var overlay = document.getElementById('spin-wheel-overlay');
    if (!overlay) return;
    overlay.classList.remove('visible');
    setTimeout(function() { overlay.remove(); renderHomeHub(); }, 300);
}

// ============================================================
// 30-SECOND BLITZ
// ============================================================

function getBlitzQuestions() {
    var pool = [];
    Object.keys(LEVEL2_SUBJECTS).forEach(function(subKey) {
        var sub = LEVEL2_SUBJECTS[subKey];
        (sub.lessons || []).forEach(function(lesson) {
            (lesson.questions || []).forEach(function(q) {
                pool.push({ q: q.q, options: q.options, correct: q.correct, subject: sub.name });
            });
        });
    });
    shuffleArray(pool);
    // Shuffle options for each question
    return pool.map(function(q) {
        var pq = prepareQuestion(q);
        pq.subject = q.subject;
        return pq;
    });
}

var blitzState = { questions: [], index: 0, score: 0, timer: null, timeLeft: 30 };

function startBlitz() {
    blitzState.questions = getBlitzQuestions();
    blitzState.index = 0;
    blitzState.score = 0;
    blitzState.timeLeft = 30;

    var existing = document.getElementById('blitz-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'blitz-overlay';
    overlay.className = 'blitz-overlay';
    overlay.innerHTML = '<div class="blitz-modal">' +
        '<div class="blitz-header">' +
        '<span class="blitz-title">⚡ تحدي الـ 30 ثانية</span>' +
        '<span class="blitz-timer" id="blitz-timer">30</span>' +
        '</div>' +
        '<div class="blitz-progress-bar"><div id="blitz-progress-fill" style="width:100%"></div></div>' +
        '<div id="blitz-body"></div>' +
        '<div class="blitz-score-row"><span>النقاط: </span><span id="blitz-score">0</span></div>' +
        '</div>';
    document.body.appendChild(overlay);
    setTimeout(function() { overlay.classList.add('visible'); }, 10);

    renderBlitzQuestion();

    blitzState.timer = setInterval(function() {
        blitzState.timeLeft--;
        var timerEl = document.getElementById('blitz-timer');
        var fillEl = document.getElementById('blitz-progress-fill');
        if (timerEl) timerEl.textContent = blitzState.timeLeft;
        if (fillEl) fillEl.style.width = (blitzState.timeLeft / 30 * 100) + '%';
        if (blitzState.timeLeft <= 0) {
            clearInterval(blitzState.timer);
            showBlitzResult();
        }
    }, 1000);
}

function renderBlitzQuestion() {
    var body = document.getElementById('blitz-body');
    if (!body) return;
    if (blitzState.index >= blitzState.questions.length) {
        showBlitzResult(); return;
    }
    var q = blitzState.questions[blitzState.index];
    var html = '<div class="blitz-question">' + q.q + '</div>';
    html += '<div class="blitz-options">';
    q.options.forEach(function(opt, i) {
        html += '<button class="blitz-opt" onclick="answerBlitz(' + i + ',' + q.correct + ')">' + opt + '</button>';
    });
    html += '</div>';
    html += '<button class="blitz-skip-btn" onclick="skipBlitz()">تخطي ⏭</button>';
    body.innerHTML = html;
}

function answerBlitz(chosen, correct) {
    if (chosen === correct) {
        blitzState.score += 2;
        var sc = document.getElementById('blitz-score');
        if (sc) sc.textContent = blitzState.score;
        playCorrectSound();
        vibrate(30);
    } else {
        playWrongSound();
    }
    blitzState.index++;
    renderBlitzQuestion();
}

function skipBlitz() {
    blitzState.index++;
    renderBlitzQuestion();
}

function showBlitzResult() {
    if (blitzState.timer) { clearInterval(blitzState.timer); blitzState.timer = null; }

    var score = blitzState.score;
    // Update weekly best
    var weekKey = getWeekKey();
    if (weekKey !== GameState.blitzWeeklyKey) {
        GameState.blitzWeeklyKey = weekKey;
        GameState.blitzWeeklyScore = 0;
    }
    var isNewBest = score > (GameState.blitzWeeklyScore || 0);
    if (isNewBest) { GameState.blitzWeeklyScore = score; }

    // Give stars reward
    var reward = Math.floor(score / 2);
    if (reward > 0) GameState.stars = (GameState.stars || 0) + reward;
    saveToLocalStorage();

    // Save to Firestore blitzLeaderboard
    if (firebaseDb && GameState.playerPhone && isNewBest) {
        firebaseDb.collection('blitzLeaderboard').doc(GameState.playerPhone).set({
            playerName: GameState.playerName,
            playerPhone: GameState.playerPhone,
            score: score,
            weekKey: weekKey,
            character: GameState.character || 'david',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }).catch(function(e) { console.warn('blitz save err', e); });
    }

    var overlay = document.getElementById('blitz-overlay');
    if (!overlay) return;
    var emoji = score >= 30 ? '🏆' : score >= 20 ? '🌟' : score >= 10 ? '👏' : '💪';
    overlay.querySelector('.blitz-modal').innerHTML =
        '<div class="blitz-result">' +
        '<div class="blitz-result-emoji">' + emoji + '</div>' +
        '<h3>انتهى الوقت!</h3>' +
        '<div class="blitz-result-score">' + score + ' نقطة</div>' +
        (isNewBest ? '<div style="color:#00B894;font-size:13px;margin:4px 0">🔥 أحسن نتيجة هذا الأسبوع!</div>' : '') +
        '<div class="blitz-result-reward">+' + reward + ' ⭐ مكافأة</div>' +
        '<div class="blitz-result-btns">' +
        '<button class="btn btn-primary" onclick="document.getElementById(\'blitz-overlay\').remove(); startBlitz();"><span>🔁 تاني</span></button>' +
        '<button class="btn btn-secondary" onclick="document.getElementById(\'blitz-overlay\').remove();"><span>رجوع</span></button>' +
        '</div></div>';
    if (score >= 20) launchConfetti(2000);
}

// ============================================================
// 1v1 DUEL
// ============================================================

var duelState = { code: null, role: null, unsubscribe: null, questions: [], index: 0, score: 0, opponentScore: 0, done: false };

function openDuelHub() {
    var existing = document.getElementById('duel-overlay');
    if (existing) existing.remove();
    var overlay = document.createElement('div');
    overlay.id = 'duel-overlay';
    overlay.className = 'duel-overlay';
    overlay.innerHTML = '<div class="duel-modal">' +
        '<h3>⚔️ مبارزة 1v1</h3>' +
        '<div class="duel-options">' +
        '<button class="btn btn-primary duel-big-btn" onclick="createDuel()"><span>➕ إنشاء مبارزة</span></button>' +
        '<div class="duel-divider">أو</div>' +
        '<div class="duel-join-row">' +
        '<input type="text" id="duel-code-input" class="duel-input" placeholder="أدخل كود المبارزة" maxlength="6" style="text-transform:uppercase">' +
        '<button class="btn btn-secondary" onclick="joinDuel()"><span>انضم</span></button>' +
        '</div>' +
        '</div>' +
        '<button class="btn btn-secondary" onclick="document.getElementById(\'duel-overlay\').remove()" style="margin-top:12px;width:100%"><span>إغلاق</span></button>' +
        '</div>';
    document.body.appendChild(overlay);
    setTimeout(function() { overlay.classList.add('visible'); }, 10);
}

function getDuelQuestions() {
    var pool = [];
    Object.keys(LEVEL2_SUBJECTS).forEach(function(subKey) {
        LEVEL2_SUBJECTS[subKey].lessons.forEach(function(lesson) {
            (lesson.questions || []).forEach(function(q) { pool.push(q); });
        });
    });
    shuffleArray(pool);
    return pool.slice(0, 10).map(prepareQuestion);
}

function createDuel() {
    if (!GameState.playerPhone) { showToast('لازم تسجل دخول الأول', 'error'); return; }
    if (!firebaseDb) { showToast('تحتاج إنترنت للمبارزة', 'error'); return; }
    var code = Math.random().toString(36).substr(2, 6).toUpperCase();
    var questions = getDuelQuestions();
    var duelData = {
        code: code,
        player1: GameState.playerPhone,
        player1Name: GameState.playerName,
        player2: null,
        player2Name: null,
        questions: JSON.stringify(questions),
        player1Score: 0,
        player2Score: 0,
        player1Done: false,
        player2Done: false,
        status: 'waiting',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    firebaseDb.collection('duels').doc(code).set(duelData).then(function() {
        duelState.code = code;
        duelState.role = 'player1';
        duelState.questions = questions;
        duelState.index = 0; duelState.score = 0; duelState.opponentScore = 0; duelState.done = false;
        showDuelWaiting(code);
        listenDuel(code, 'player1');
    }).catch(function(e) { showToast('حصل خطأ: ' + e.message, 'error'); });
}

function joinDuel() {
    if (!GameState.playerPhone) { showToast('لازم تسجل دخول الأول', 'error'); return; }
    if (!firebaseDb) { showToast('تحتاج إنترنت للمبارزة', 'error'); return; }
    var code = (document.getElementById('duel-code-input').value || '').trim().toUpperCase();
    if (!code || code.length !== 6) { showToast('أدخل كود صحيح من 6 خانات', 'error'); return; }
    firebaseDb.collection('duels').doc(code).get().then(function(doc) {
        if (!doc.exists) { showToast('المبارزة مش موجودة', 'error'); return; }
        var data = doc.data();
        if (data.status !== 'waiting') { showToast('المبارزة اتلغت أو خلصت', 'error'); return; }
        if (data.player1 === GameState.playerPhone) { showToast('مش ممكن تبارز نفسك 😅', 'warning'); return; }
        firebaseDb.collection('duels').doc(code).update({
            player2: GameState.playerPhone,
            player2Name: GameState.playerName,
            status: 'active'
        }).then(function() {
            duelState.code = code;
            duelState.role = 'player2';
            duelState.questions = JSON.parse(data.questions);
            duelState.index = 0; duelState.score = 0; duelState.opponentScore = 0; duelState.done = false;
            var overlay = document.getElementById('duel-overlay');
            if (overlay) overlay.remove();
            startDuelGame();
            listenDuel(code, 'player2');
        });
    }).catch(function(e) { showToast('حصل خطأ: ' + e.message, 'error'); });
}

function showDuelWaiting(code) {
    var overlay = document.getElementById('duel-overlay');
    if (!overlay) return;
    overlay.querySelector('.duel-modal').innerHTML =
        '<h3>⚔️ مبارزة جاهزة!</h3>' +
        '<p style="color:var(--text-muted)">شارك الكود مع منافسك:</p>' +
        '<div class="duel-code-display">' + code + '</div>' +
        '<div class="duel-waiting-msg" id="duel-wait-msg"><i class="fas fa-spinner fa-spin"></i> بنستنى منافسك...</div>' +
        '<button class="btn btn-secondary" onclick="cancelDuel()" style="margin-top:12px;width:100%"><span>إلغاء</span></button>';
}

function listenDuel(code, role) {
    if (duelState.unsubscribe) duelState.unsubscribe();
    duelState.unsubscribe = firebaseDb.collection('duels').doc(code).onSnapshot(function(doc) {
        if (!doc.exists) return;
        var data = doc.data();
        var oppScore = role === 'player1' ? data.player2Score : data.player1Score;
        duelState.opponentScore = oppScore || 0;
        var oppScoreEl = document.getElementById('duel-opp-score');
        if (oppScoreEl) oppScoreEl.textContent = duelState.opponentScore;

        // If player1 and status just became active, start game
        if (role === 'player1' && data.status === 'active' && !duelState.done && duelState.index === 0) {
            var overlay = document.getElementById('duel-overlay');
            if (overlay) overlay.remove();
            startDuelGame();
        }
        // If both done, show result
        if (data.player1Done && data.player2Done && !duelState.done) {
            duelState.done = true;
            var myScore = role === 'player1' ? data.player1Score : data.player2Score;
            var theirScore = role === 'player1' ? data.player2Score : data.player1Score;
            var theirName = role === 'player1' ? data.player2Name : data.player1Name;
            showDuelResult(myScore, theirScore, theirName || 'المنافس');
        }
    });
}

function cancelDuel() {
    if (duelState.code && firebaseDb) {
        firebaseDb.collection('duels').doc(duelState.code).update({ status: 'cancelled' }).catch(function(){});
    }
    if (duelState.unsubscribe) { duelState.unsubscribe(); duelState.unsubscribe = null; }
    var overlay = document.getElementById('duel-overlay');
    if (overlay) overlay.remove();
}

function startDuelGame() {
    var overlay = document.createElement('div');
    overlay.id = 'duel-game-overlay';
    overlay.className = 'duel-overlay';
    overlay.innerHTML = '<div class="duel-modal">' +
        '<div class="duel-game-header">' +
        '<div class="duel-player-score"><div class="duel-score-label">أنت</div><div class="duel-score-val" id="duel-my-score">0</div></div>' +
        '<div class="duel-vs">⚔️</div>' +
        '<div class="duel-player-score"><div class="duel-score-label">المنافس</div><div class="duel-score-val" id="duel-opp-score">0</div></div>' +
        '</div>' +
        '<div class="duel-progress">س <span id="duel-q-num">1</span> من 10</div>' +
        '<div id="duel-game-body"></div>' +
        '</div>';
    document.body.appendChild(overlay);
    setTimeout(function() { overlay.classList.add('visible'); }, 10);
    renderDuelQuestion();
}

function renderDuelQuestion() {
    var body = document.getElementById('duel-game-body');
    if (!body) return;
    if (duelState.index >= duelState.questions.length) {
        finishDuel(); return;
    }
    var qNum = document.getElementById('duel-q-num');
    if (qNum) qNum.textContent = duelState.index + 1;
    var q = duelState.questions[duelState.index];
    var html = '<div class="duel-question">' + q.q + '</div><div class="duel-options">';
    q.options.forEach(function(opt, i) {
        html += '<button class="duel-opt" onclick="answerDuel(' + i + ',' + q.correct + ')">' + opt + '</button>';
    });
    html += '</div>';
    body.innerHTML = html;
}

function answerDuel(chosen, correct) {
    var btns = document.querySelectorAll('.duel-opt');
    btns.forEach(function(b) { b.disabled = true; });
    if (chosen === correct) {
        duelState.score += 2;
        var sc = document.getElementById('duel-my-score');
        if (sc) sc.textContent = duelState.score;
        if (btns[chosen]) btns[chosen].style.background = '#00B894';
        playCorrectSound();
    } else {
        if (btns[chosen]) btns[chosen].style.background = '#e17055';
        if (btns[correct]) btns[correct].style.background = '#00B894';
        playWrongSound();
    }
    // Update Firestore with my score
    if (firebaseDb && duelState.code) {
        var updateObj = {};
        updateObj[duelState.role + 'Score'] = duelState.score;
        firebaseDb.collection('duels').doc(duelState.code).update(updateObj).catch(function(){});
    }
    duelState.index++;
    setTimeout(renderDuelQuestion, 900);
}

function finishDuel() {
    if (!firebaseDb || !duelState.code) return;
    // Mark as done in Firestore
    var updateObj = {};
    updateObj[duelState.role + 'Done'] = true;
    updateObj[duelState.role + 'Score'] = duelState.score;
    firebaseDb.collection('duels').doc(duelState.code).update(updateObj).catch(function(){});

    var body = document.getElementById('duel-game-body');
    if (body) body.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)"><i class="fas fa-spinner fa-spin"></i> بنستنى المنافس يخلص...</div>';
}

function showDuelResult(myScore, theirScore, theirName) {
    if (duelState.unsubscribe) { duelState.unsubscribe(); duelState.unsubscribe = null; }
    var gameOverlay = document.getElementById('duel-game-overlay');
    if (gameOverlay) gameOverlay.remove();

    var won = myScore > theirScore;
    var tied = myScore === theirScore;
    var gemsReward = won ? 15 : tied ? 8 : 5;
    GameState.gems = (GameState.gems || 0) + gemsReward;
    saveToLocalStorage();

    var overlay = document.createElement('div');
    overlay.id = 'duel-result-overlay';
    overlay.className = 'duel-overlay visible';
    overlay.innerHTML = '<div class="duel-modal">' +
        '<div class="duel-result-icon">' + (won ? '🏆' : tied ? '🤝' : '😔') + '</div>' +
        '<h3>' + (won ? 'انتصرت!' : tied ? 'تعادل!' : 'خسرت!') + '</h3>' +
        '<div class="duel-result-scores">' +
        '<div><div>أنت</div><div class="duel-final-score">' + myScore + '</div></div>' +
        '<div style="align-self:center;font-size:20px">⚔️</div>' +
        '<div><div>' + theirName + '</div><div class="duel-final-score">' + theirScore + '</div></div>' +
        '</div>' +
        '<div class="duel-gems-reward">+' + gemsReward + ' 💎 مكافأة</div>' +
        '<button class="btn btn-primary" onclick="document.getElementById(\'duel-result-overlay\').remove();openDuelHub();" style="width:100%;margin-top:12px"><span>مبارزة جديدة</span></button>' +
        '<button class="btn btn-secondary" onclick="document.getElementById(\'duel-result-overlay\').remove();" style="width:100%;margin-top:8px"><span>إغلاق</span></button>' +
        '</div>';
    document.body.appendChild(overlay);
    if (won) launchConfetti(3000);
}

// ============================================================
// BOSS BATTLE
// ============================================================

var DEFAULT_BOSS = {
    bossName: 'أريوس الهرطوقي',
    bossEmoji: '👿',
    bossHP: 500,
    weekKey: '',
    description: 'أريوس ينشر هرطقة إنكار ألوهية المسيح — هاجمه بالإجابات الصحيحة!',
    questions: []
};

function getBossQuestions() {
    var pool = [];
    Object.keys(LEVEL2_SUBJECTS).forEach(function(subKey) {
        LEVEL2_SUBJECTS[subKey].lessons.forEach(function(lesson) {
            (lesson.questions || []).forEach(function(q) { pool.push(q); });
        });
    });
    shuffleArray(pool);
    return pool.slice(0, 10).map(prepareQuestion);
}

function openBossBattle() {
    var weekKey = getWeekKey();
    var localBoss = Object.assign({}, DEFAULT_BOSS, {
        weekKey: weekKey,
        totalDamage: 0,
        contributors: {},
        status: 'active',
        questions: JSON.stringify(getBossQuestions())
    });

    // If no Firebase, show offline boss battle
    if (!firebaseDb) {
        showBossScreen(localBoss);
        return;
    }
    // Load current boss from Firestore
    firebaseDb.collection('bossBattle').doc('current').get().then(function(doc) {
        var boss;
        if (doc.exists) {
            boss = doc.data();
            if (boss.weekKey !== weekKey) {
                // New week - reset boss
                boss = Object.assign({}, DEFAULT_BOSS, { weekKey: weekKey, totalDamage: 0, contributors: {}, status: 'active', questions: JSON.stringify(getBossQuestions()) });
                firebaseDb.collection('bossBattle').doc('current').set(boss).catch(function(){});
            }
        } else {
            boss = Object.assign({}, DEFAULT_BOSS, { weekKey: weekKey, totalDamage: 0, contributors: {}, status: 'active', questions: JSON.stringify(getBossQuestions()) });
            firebaseDb.collection('bossBattle').doc('current').set(boss).catch(function(){});
        }
        showBossScreen(boss);
    }).catch(function(e) {
        // Fallback: show boss battle without community tracking
        showBossScreen(localBoss);
    });
}

function showBossScreen(boss) {
    var today = getTodayKey();
    var alreadyFought = GameState.bossFoughtDate === today;
    var hp = boss.bossHP || 500;
    var damage = boss.totalDamage || 0;
    var pct = Math.min(damage / hp * 100, 100);
    var defeated = boss.status === 'defeated' || damage >= hp;

    var existing = document.getElementById('boss-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'boss-overlay';
    overlay.className = 'boss-overlay';

    var myContrib = (boss.contributors || {})[GameState.playerPhone] || 0;

    overlay.innerHTML = '<div class="boss-modal">' +
        '<div class="boss-header">' +
        '<div class="boss-emoji">' + (boss.bossEmoji || '👿') + '</div>' +
        '<div class="boss-info">' +
        '<div class="boss-name">' + (boss.bossName || 'العدو') + '</div>' +
        '<div class="boss-desc">' + (boss.description || '') + '</div>' +
        '</div>' +
        '</div>' +
        '<div class="boss-hp-section">' +
        '<div class="boss-hp-label"><span>نقاط الحياة</span><span>' + Math.max(0,hp-damage) + '/' + hp + '</span></div>' +
        '<div class="boss-hp-bar"><div class="boss-hp-fill" style="width:' + (100-pct) + '%"></div></div>' +
        '</div>' +
        (myContrib > 0 ? '<div class="boss-my-contrib">مساهمتك: <strong>' + myContrib + '</strong> ضربة 🗡️</div>' : '') +
        (defeated ?
            '<div class="boss-defeated-msg">🎉 تم هزيمته هذا الأسبوع! شكراً لمساهمتك</div>' :
            alreadyFought ?
            '<div class="boss-already-msg">✅ قاتلت اليوم! عد غداً للمزيد</div>' :
            '<button class="btn btn-primary boss-fight-btn" onclick="startBossFight()"><span>⚔️ هاجم الآن!</span></button>'
        ) +
        '<button class="btn btn-secondary" onclick="document.getElementById(\'boss-overlay\').remove()" style="margin-top:10px;width:100%"><span>إغلاق</span></button>' +
        '</div>';
    document.body.appendChild(overlay);
    setTimeout(function() { overlay.classList.add('visible'); }, 10);
}

var bossFightState = { questions: [], index: 0, damage: 0 };

function startBossFight() {
    var launchFight = function(bossEmoji, bossName, questions) {
        bossFightState.questions = questions;
        bossFightState.index = 0;
        bossFightState.damage = 0;
        var overlay = document.getElementById('boss-overlay');
        if (!overlay) return;
        overlay.querySelector('.boss-modal').innerHTML =
            '<div class="boss-fight-header">' +
            '<div class="boss-fight-emoji">' + (bossEmoji||'👿') + '</div>' +
            '<div class="boss-fight-name">' + (bossName||'العدو') + '</div>' +
            '</div>' +
            '<div class="boss-fight-progress">س <span id="boss-q-num">1</span> من ' + questions.length + '</div>' +
            '<div class="boss-fight-damage">ضرباتك: <span id="boss-dmg">0</span> 🗡️</div>' +
            '<div id="boss-fight-body"></div>';
        renderBossFightQuestion();
    };

    if (!firebaseDb) {
        launchFight(DEFAULT_BOSS.bossEmoji, DEFAULT_BOSS.bossName, getBossQuestions());
        return;
    }
    firebaseDb.collection('bossBattle').doc('current').get().then(function(doc) {
        var qs = [];
        var bossEmoji = DEFAULT_BOSS.bossEmoji;
        var bossName = DEFAULT_BOSS.bossName;
        if (doc.exists) {
            var boss = doc.data();
            bossEmoji = boss.bossEmoji || bossEmoji;
            bossName = boss.bossName || bossName;
            try { qs = JSON.parse(boss.questions || '[]'); } catch(e) {}
        }
        if (!qs.length) qs = getBossQuestions();
        launchFight(bossEmoji, bossName, qs);
    }).catch(function() {
        launchFight(DEFAULT_BOSS.bossEmoji, DEFAULT_BOSS.bossName, getBossQuestions());
    });
}

function renderBossFightQuestion() {
    var body = document.getElementById('boss-fight-body');
    if (!body) return;
    if (bossFightState.index >= bossFightState.questions.length) {
        finishBossFight(); return;
    }
    var qNum = document.getElementById('boss-q-num');
    if (qNum) qNum.textContent = bossFightState.index + 1;
    var q = bossFightState.questions[bossFightState.index];
    var html = '<div class="boss-question">' + q.q + '</div><div class="boss-options">';
    q.options.forEach(function(opt, i) {
        html += '<button class="boss-opt" onclick="answerBoss(' + i + ',' + q.correct + ')">' + opt + '</button>';
    });
    html += '</div>';
    body.innerHTML = html;
}

function answerBoss(chosen, correct) {
    var btns = document.querySelectorAll('.boss-opt');
    btns.forEach(function(b) { b.disabled = true; });
    if (chosen === correct) {
        bossFightState.damage += 10;
        var dmgEl = document.getElementById('boss-dmg');
        if (dmgEl) dmgEl.textContent = bossFightState.damage;
        if (btns[chosen]) btns[chosen].style.background = '#00B894';
        playCorrectSound();
        vibrate(50);
        // Flash boss emoji
        var emojiEl = document.querySelector('.boss-fight-emoji');
        if (emojiEl) { emojiEl.style.transform = 'scale(1.3)'; setTimeout(function(){emojiEl.style.transform='';},200); }
    } else {
        if (btns[chosen]) btns[chosen].style.background = '#e17055';
        if (btns[correct]) btns[correct].style.background = '#00B894';
        playWrongSound();
    }
    bossFightState.index++;
    setTimeout(renderBossFightQuestion, 900);
}

function finishBossFight() {
    var today = getTodayKey();
    GameState.bossFoughtDate = today;
    var damage = bossFightState.damage;

    var showBossResult = function(defeated, gemsReward) {
        var gemsR = gemsReward || 0;
        if (gemsR > 0) { GameState.gems = (GameState.gems||0) + gemsR; }
        saveToLocalStorage();
        var overlay = document.getElementById('boss-overlay');
        if (!overlay) return;
        overlay.querySelector('.boss-modal').innerHTML =
            '<div class="boss-result">' +
            '<div class="boss-result-emoji">' + (damage >= 80 ? '🏆' : damage >= 50 ? '⚔️' : '💪') + '</div>' +
            '<h3>' + (defeated ? '🎉 هُزم العدو!' : 'معركة شرسة!') + '</h3>' +
            '<div class="boss-result-damage">ألحقت <strong>' + damage + '</strong> ضربة بالعدو 🗡️</div>' +
            '<div class="boss-result-reward">+' + gemsR + ' 💎 مكافأة</div>' +
            (defeated ? '<div style="color:#00B894;font-size:13px;margin:8px 0">أنت ساعدت في هزيمة العدو!</div>' : '') +
            '<button class="btn btn-secondary" onclick="document.getElementById(\'boss-overlay\').remove()" style="margin-top:12px;width:100%"><span>إغلاق</span></button>' +
            '</div>';
        if (defeated) launchConfetti(3000);
    };

    var gemsReward = Math.floor(damage / 10);

    // If no Firebase, show result locally
    if (!firebaseDb) {
        showBossResult(false, gemsReward);
        return;
    }

    // Update Firestore boss document
    firebaseDb.collection('bossBattle').doc('current').get().then(function(doc) {
        var newTotal = damage;
        var defeated = false;
        if (doc.exists) {
            var boss = doc.data();
            newTotal = (boss.totalDamage || 0) + damage;
            var contributors = boss.contributors || {};
            contributors[GameState.playerPhone] = (contributors[GameState.playerPhone]||0) + damage;
            defeated = newTotal >= (boss.bossHP || 500);
            firebaseDb.collection('bossBattle').doc('current').update({
                totalDamage: newTotal,
                contributors: contributors,
                status: defeated ? 'defeated' : 'active'
            }).catch(function(){});
        }
        if (defeated) gemsReward += 20;
        showBossResult(defeated, gemsReward);
    }).catch(function() {
        showBossResult(false, gemsReward);
    });
}

document.addEventListener('DOMContentLoaded', function() {
    // Apply saved theme immediately (both html and body for consistency)
    var savedTheme = 'dark';
    try { savedTheme = localStorage.getItem('minElBatal_theme') || 'dark'; } catch(e) {}
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.body.setAttribute('data-theme', savedTheme);
    GameState.theme = savedTheme;

    // Load saved state from localStorage FIRST before any cloud calls
    loadFromLocalStorage();

    createParticles();
    preloadCharImages();
    // Preload heavy map images in background
    (function() {
        var preloadImgs = ['images/level2-full-bg-opt.jpg', 'images/level2-bg-opt.jpg'];
        preloadImgs.forEach(function(src) {
            var img = new Image();
            img.src = src;
        });
    })();
    initFirebase();

    // Check "Remember Me" — auto-login from cloud
    var rememberedPhone = null;
    try { rememberedPhone = localStorage.getItem('minElBatal_remember'); } catch(e) {}
    if (rememberedPhone && firebaseDb) {
        // Show loading state
        showScreen('login-screen');
        var btn = document.getElementById('btn-login');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span><i class="fas fa-spinner fa-spin"></i> جاري تسجيل الدخول...</span>';
        }

        loadFromCloud(rememberedPhone).then(function(data) {
            if (data && data.playerName) {
                // Restore username/email from cloud (non-score fields only)
                GameState.username = data.username || '';
                GameState.email = data.email || '';
                // NOTE: Do NOT overwrite miniGameScores/stationScores here!
                // loadFromCloud() already merged cloud+local keeping max values.
                showToast('أهلاً بيك يا ' + GameState.playerName.split(' ')[0] + '!', 'success');
                showScreen('home-hub-screen');
                // Force team badge update after cloud data is loaded
                updateHubTeamBadge();
                syncLeaderboard();
            } else {
                // No cloud data found for this phone — account was deleted
                // Clear all local data to prevent stale re-login
                localStorage.removeItem('minElBatal_remember');
                localStorage.removeItem('minElBatal_gameState');
                resetLoginBtn(btn);
                showScreen('splash-screen');
                showToast('الحساب مش موجود - سجّل حساب جديد', 'info');
            }
        }).catch(function() {
            resetLoginBtn(btn);
            showScreen('splash-screen');
        });
    } else {
        // Sync leaderboard if we have data
        syncLeaderboard();
    }

    // Auto-save to localStorage as backup every 30 seconds
    setInterval(function() {
        saveToLocalStorage();
    }, 30000);

    // Save on page unload
    window.addEventListener('beforeunload', function() {
        saveToLocalStorage();
    });

    // Save on visibility change (app going to background on mobile)
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'hidden') {
            saveToLocalStorage();
            if (GameState.playerPhone) saveToCloud();
        }
    });
});

// --- Local Storage Backup ---
function saveToLocalStorage(skipCloud) {
    try {
        localStorage.setItem('minElBatal_gameState', JSON.stringify(GameState));
    } catch(e) {
        console.warn('localStorage save failed:', e);
    }
    // Only sync to cloud if explicitly requested (avoid recursive double-saves)
    if (!skipCloud && GameState.playerPhone) {
        saveToCloud();
    }
}

function loadFromLocalStorage() {
    try {
        var saved = localStorage.getItem('minElBatal_gameState');
        if (saved) {
            var data = JSON.parse(saved);
            Object.keys(data).forEach(function(key) {
                if (key in GameState) {
                    GameState[key] = data[key];
                }
            });
            return true;
        }
    } catch(e) {
        console.warn('localStorage load failed:', e);
    }
    return false;
}

// ============================================================
// PWA: Service Worker, Push Notifications & Install Prompt
// ============================================================

// --- Service Worker Registration ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js')
            .then(function(reg) {
                console.log('[PWA] Service Worker registered, scope:', reg.scope);
                // Check for updates every 30 minutes
                setInterval(function() { reg.update(); }, 30 * 60 * 1000);
            })
            .catch(function(err) {
                console.warn('[PWA] SW registration failed:', err);
            });
    });
}

// --- Push Notifications (Firebase Cloud Messaging) ---
var fcmToken = null;

function initPushNotifications() {
    if (typeof firebase === 'undefined' || !firebase.messaging) {
        console.warn('[FCM] Firebase Messaging not available');
        return;
    }

    var messaging = firebase.messaging();

    // Request permission
    Notification.requestPermission().then(function(permission) {
        if (permission === 'granted') {
            console.log('[FCM] Notification permission granted');
            return messaging.getToken({
                vapidKey: 'BCK-Gml28B9WpWb_umCHAwmVqNP6FFptoLLLxWpfQwGkNc7zC_ixVRNYQL5t2Ls4lG3v_pa42WCZ9jQeCNtN3tk' // Will be set when VAPID key is generated in Firebase Console
            });
        } else {
            console.log('[FCM] Notification permission denied');
        }
    }).then(function(token) {
        if (token) {
            fcmToken = token;
            console.log('[FCM] Token:', token.substring(0, 20) + '...');
            // Save token + lastActiveDate to Firestore
            if (firebaseDb && GameState.playerPhone) {
                var todayStr = new Date().toISOString().split('T')[0];
                firebaseDb.collection('players').doc(GameState.playerPhone).update({
                    fcmToken: token,
                    lastTokenUpdate: new Date().toISOString(),
                    lastActiveDate: todayStr,
                    // Default notification preferences (all on)
                    notifPrefs: {
                        competitions: true,
                        lessons: true,
                        reminders: true,
                        streakReminder: true
                    }
                }).catch(function(err) {
                    console.warn('[FCM] Failed to save token:', err);
                });
            }

            // Subscribe to FCM topics
            console.log('[FCM] Subscribing to topics...');
            // Note: Topic subscription is managed server-side via Cloud Functions
            // The token saved to Firestore is used by Cloud Functions to send targeted notifications
        }
    }).catch(function(err) {
        console.warn('[FCM] Token error:', err);
    });

    // Handle foreground messages with smart display
    messaging.onMessage(function(payload) {
        console.log('[FCM] Foreground message:', payload);
        var title = payload.notification ? payload.notification.title : 'مين البطل؟';
        var body = payload.notification ? payload.notification.body : '';
        var dataType = (payload.data && payload.data.type) ? payload.data.type : '';

        // Competition invite → show special modal
        if (dataType === 'compete_invite') {
            showCompeteInvite(payload.data);
            return;
        }

        // Exercise/streak reminder → show achievement-style popup
        if (dataType === 'exercise_reminder' || dataType === 'streak_recovery' || dataType === 'weekly_reminder') {
            showAchievement(
                dataType === 'streak_recovery' ? '🔥' : dataType === 'weekly_reminder' ? '⛪' : '📖',
                title,
                body
            );
            return;
        }

        // New lesson → show with action
        if (dataType === 'new_lesson') {
            showAchievement('📚', title, body);
            return;
        }

        // Default → toast
        showToast(title + (body ? ': ' + body : ''), 'info');
    });
}

function showCompeteInvite(data) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = '<div class="modal-card" style="text-align:center;max-width:320px">' +
        '<div style="font-size:48px;margin-bottom:12px">⚡</div>' +
        '<h3 style="color:var(--text-primary);margin:0 0 8px">دعوة مسابقة!</h3>' +
        '<p style="color:var(--text-secondary);font-size:14px;margin:0 0 16px">' +
        (data.hostName || 'صاحبك') + ' بيتحداك تلعب معاه</p>' +
        '<p style="color:var(--gold);font-size:24px;font-weight:900;letter-spacing:6px">' +
        (data.roomCode || '') + '</p>' +
        '<div style="display:flex;gap:10px;margin-top:16px">' +
        '<button class="btn btn-primary" style="flex:1" onclick="this.closest(\'.modal-overlay\').remove();' +
        'showScreen(\'compete-screen\');"><span>ادخل!</span></button>' +
        '<button class="btn btn-secondary" style="flex:1" onclick="this.closest(\'.modal-overlay\').remove()"><span>مش دلوقتي</span></button>' +
        '</div></div>';
    document.body.appendChild(overlay);
    setTimeout(function() { overlay.classList.add('active'); }, 10);
}

// Auto-init notifications after login (delayed to not annoy users immediately)
function requestNotificationsAfterLogin() {
    setTimeout(function() {
        if (GameState.playerPhone && 'Notification' in window) {
            // Only ask if not already decided
            if (Notification.permission === 'default') {
                // Show a friendly in-app prompt first
                showNotificationPrompt();
            } else if (Notification.permission === 'granted') {
                initPushNotifications();
            }
        }
    }, 5000); // Wait 5 seconds after login
}

function showNotificationPrompt() {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'notif-prompt-overlay';
    overlay.innerHTML = '<div class="modal-card" style="text-align:center;max-width:340px">' +
        '<div style="font-size:48px;margin-bottom:12px">🔔</div>' +
        '<h3 style="color:var(--text-primary);font-size:18px;margin:0 0 8px">فعّل الإشعارات</h3>' +
        '<p style="color:var(--text-secondary);font-size:13px;line-height:1.6;margin:0 0 16px">' +
        'عشان نبلّغك لما حد يتحداك في مسابقة أو لما يكون فيه درس جديد</p>' +
        '<div style="display:flex;flex-direction:column;gap:10px">' +
        '<button class="btn btn-primary" onclick="acceptNotifications()"><span><i class="fas fa-bell"></i> فعّل الإشعارات</span></button>' +
        '<button class="btn btn-secondary" onclick="dismissNotificationPrompt()"><span>مش دلوقتي</span></button>' +
        '</div></div>';
    document.body.appendChild(overlay);
    setTimeout(function() { overlay.classList.add('active'); }, 10);
}

function acceptNotifications() {
    var overlay = document.getElementById('notif-prompt-overlay');
    if (overlay) { overlay.classList.remove('active'); setTimeout(function() { overlay.remove(); }, 300); }
    initPushNotifications();
}

function dismissNotificationPrompt() {
    var overlay = document.getElementById('notif-prompt-overlay');
    if (overlay) { overlay.classList.remove('active'); setTimeout(function() { overlay.remove(); }, 300); }
    // Remember they dismissed, don't ask again for 7 days
    localStorage.setItem('minElBatal_notifDismissed', Date.now().toString());
}

// --- Install Prompt (Add to Home Screen) ---
var deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    deferredInstallPrompt = e;
    console.log('[PWA] Install prompt captured');
    // Show floating install button immediately (if not permanently hidden)
    showInstallFAB();
});

// Floating install button - always visible until installed/hidden
function showInstallFAB() {
    if (!deferredInstallPrompt) return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    // If user chose "never show again"
    if (localStorage.getItem('minElBatal_installHidden') === 'true') return;
    // If already showing
    if (document.getElementById('install-fab')) return;

    var fab = document.createElement('div');
    fab.id = 'install-fab';
    fab.style.cssText = 'position:fixed;bottom:80px;left:16px;z-index:9998;direction:rtl;font-family:Cairo,sans-serif;animation:slideUp 0.4s ease';

    fab.innerHTML = '<button id="install-fab-btn" onclick="showInstallModal()" style="' +
        'display:flex;align-items:center;gap:8px;background:linear-gradient(135deg,var(--primary),#a29bfe);' +
        'color:#fff;border:none;border-radius:50px;padding:10px 18px;font-family:Cairo;font-weight:700;' +
        'font-size:13px;cursor:pointer;box-shadow:0 4px 20px rgba(108,92,231,0.4);' +
        'animation:installPulse 3s ease-in-out infinite">' +
        '<i class="fas fa-download" style="font-size:16px"></i> حمّل التطبيق' +
        '</button>';
    document.body.appendChild(fab);
}

function showInstallModal() {
    var overlay = document.createElement('div');
    overlay.id = 'install-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;font-family:Cairo,sans-serif;direction:rtl;animation:fadeIn 0.2s ease';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

    overlay.innerHTML = '<div style="background:var(--bg-card);border-radius:20px;padding:28px 24px;max-width:340px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.4)">' +
        '<img src="images/Logo-192.png" style="width:64px;height:64px;border-radius:16px;margin-bottom:12px">' +
        '<h3 style="color:var(--text-primary);margin:0 0 6px;font-size:18px">حمّل مين البطل؟</h3>' +
        '<p style="color:var(--text-secondary);font-size:13px;margin:0 0 20px;line-height:1.6">حمّل التطبيق على موبايلك وشغّله زي الأبلكيشن بدون ما تحتاج متجر!</p>' +
        '<button onclick="installApp()" style="width:100%;background:linear-gradient(135deg,var(--primary),#a29bfe);color:#fff;border:none;border-radius:14px;padding:14px;font-family:Cairo;font-weight:700;font-size:15px;cursor:pointer;margin-bottom:10px">' +
        '<i class="fas fa-download"></i> حمّل دلوقتي</button>' +
        '<button onclick="dismissInstallTemp()" style="width:100%;background:rgba(255,255,255,0.08);color:var(--text-secondary);border:1px solid var(--border);border-radius:14px;padding:12px;font-family:Cairo;font-weight:600;font-size:13px;cursor:pointer;margin-bottom:8px">' +
        'مش دلوقتي</button>' +
        '<button onclick="dismissInstallForever()" style="background:none;border:none;color:var(--text-muted);font-family:Cairo;font-size:11px;cursor:pointer;padding:4px">' +
        'متوريهاليش تاني</button>' +
        '</div>';
    document.body.appendChild(overlay);
}

function installApp() {
    if (!deferredInstallPrompt) return;
    removeInstallModal();
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(function(result) {
        if (result.outcome === 'accepted') {
            showToast('تم تثبيت التطبيق! 🎉', 'success');
            showAchievement('📱', 'تم التحميل!', 'حمّلت مين البطل على موبايلك');
            removeInstallFAB();
        }
        deferredInstallPrompt = null;
    });
}

function dismissInstallTemp() {
    removeInstallModal();
    // FAB stays visible - user can tap it anytime
}

function dismissInstallForever() {
    removeInstallModal();
    removeInstallFAB();
    localStorage.setItem('minElBatal_installHidden', 'true');
    showToast('تقدر تحملها من الإعدادات في أي وقت', 'info');
}

function removeInstallModal() {
    var modal = document.getElementById('install-modal-overlay');
    if (modal) modal.remove();
}

function removeInstallFAB() {
    var fab = document.getElementById('install-fab');
    if (fab) fab.remove();
}

// Settings: re-enable install button
function resetInstallPrompt() {
    localStorage.removeItem('minElBatal_installHidden');
    showToast('هيظهر زرار التحميل تاني', 'success');
    showInstallFAB();
}

// iOS Install Detection
function showIOSInstallHint() {
    var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    var isInStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isIOS && !isInStandalone) {
        var dismissed = localStorage.getItem('minElBatal_iosHintDismissed');
        if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

        setTimeout(function() {
            var hint = document.createElement('div');
            hint.id = 'ios-install-hint';
            hint.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:var(--bg-card);border-top:1px solid var(--border);padding:16px 20px;z-index:9999;text-align:center;font-family:Cairo,sans-serif;direction:rtl;animation:slideUp 0.4s ease';
            hint.innerHTML = '<p style="font-size:13px;color:var(--text-primary);margin:0 0 4px"><strong>حمّل التطبيق على الآيفون</strong></p>' +
                '<p style="font-size:12px;color:var(--text-secondary);margin:0">اضغط <i class="fas fa-share-from-square" style="color:var(--primary)"></i> ثم <strong>"Add to Home Screen"</strong></p>' +
                '<button onclick="this.parentNode.remove();localStorage.setItem(\'minElBatal_iosHintDismissed\',Date.now())" ' +
                'style="position:absolute;top:8px;left:8px;background:none;border:none;color:var(--text-muted);font-size:16px;cursor:pointer">&times;</button>';
            document.body.appendChild(hint);
        }, 15000);
    }
}

// Animations for install UI
var styleEl = document.createElement('style');
styleEl.textContent = '@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }' +
    '@keyframes installPulse { 0%,100% { transform: scale(1); box-shadow: 0 4px 20px rgba(108,92,231,0.4); } 50% { transform: scale(1.05); box-shadow: 0 6px 28px rgba(108,92,231,0.6); } }' +
    '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }';
document.head.appendChild(styleEl);

// Initialize iOS hint on load + track activity + auto-join room from URL
window.addEventListener('load', function() {
    showIOSInstallHint();
    trackLastActiveDate();

    // Auto-join room from shared link (?room=CODE)
    var urlParams = new URLSearchParams(window.location.search);
    var roomCode = urlParams.get('room');
    if (roomCode && roomCode.length === 6) {
        // Store room code, will attempt join after login
        sessionStorage.setItem('minElBatal_pendingRoom', roomCode);
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
    }
});

// ============================================================
// Activity Tracking (for smart notifications)
// ============================================================
function trackLastActiveDate() {
    if (!firebaseDb || !GameState.playerPhone) return;
    var todayStr = new Date().toISOString().split('T')[0];
    firebaseDb.collection('players').doc(GameState.playerPhone).update({
        lastActiveDate: todayStr
    }).catch(function() {});
}

// Call trackLastActiveDate also when returning from background
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
        trackLastActiveDate();
    }
});

// ============================================================
// Notification Preferences UI
// ============================================================
function showNotificationSettings() {
    // Load current prefs from Firestore
    var prefs = { competitions: true, lessons: true, reminders: true, streakReminder: true };

    if (firebaseDb && GameState.playerPhone) {
        firebaseDb.collection('players').doc(GameState.playerPhone).get()
            .then(function(doc) {
                if (doc.exists && doc.data().notifPrefs) {
                    prefs = doc.data().notifPrefs;
                }
                renderNotifSettings(prefs);
            })
            .catch(function() {
                renderNotifSettings(prefs);
            });
    } else {
        renderNotifSettings(prefs);
    }
}

function renderNotifSettings(prefs) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'notif-settings-overlay';

    var html = '<div class="modal-card" style="max-width:380px;direction:rtl">';
    html += '<h3 style="color:var(--text-primary);text-align:center;margin:0 0 16px"><i class="fas fa-bell" style="color:var(--gold);margin-left:8px"></i>إعدادات الإشعارات</h3>';

    var items = [
        { key: 'competitions', icon: '⚡', label: 'مسابقات جديدة', desc: 'لما حد يعمل مسابقة' },
        { key: 'lessons', icon: '📚', label: 'دروس جديدة', desc: 'لما ينزل محتوى جديد' },
        { key: 'reminders', icon: '📖', label: 'تذكير التداريب', desc: 'لو معملتش تداريبك اليومية أو الأسبوعية' },
        { key: 'streakReminder', icon: '🔥', label: 'حماية السلسلة', desc: 'لو سلسلتك المتتابعة هتتقطع' },
    ];

    items.forEach(function(item) {
        var checked = prefs[item.key] !== false;
        html += '<div style="display:flex;align-items:center;gap:12px;padding:12px;background:rgba(255,255,255,0.05);border-radius:12px;margin-bottom:8px">';
        html += '<span style="font-size:24px">' + item.icon + '</span>';
        html += '<div style="flex:1"><p style="color:var(--text-primary);font-size:14px;font-weight:700;margin:0">' + item.label + '</p>';
        html += '<p style="color:var(--text-secondary);font-size:11px;margin:2px 0 0">' + item.desc + '</p></div>';
        html += '<label class="notif-toggle">';
        html += '<input type="checkbox" data-pref="' + item.key + '" ' + (checked ? 'checked' : '') + '>';
        html += '<span class="notif-toggle-slider"></span>';
        html += '</label></div>';
    });

    html += '<div style="display:flex;gap:10px;margin-top:16px">';
    html += '<button class="btn btn-primary" style="flex:1" onclick="saveNotifSettings()"><span><i class="fas fa-check"></i> حفظ</span></button>';
    html += '<button class="btn btn-secondary" style="flex:1" onclick="closeNotifSettings()"><span>إلغاء</span></button>';
    html += '</div></div>';

    overlay.innerHTML = html;
    document.body.appendChild(overlay);
    setTimeout(function() { overlay.classList.add('active'); }, 10);
}

function saveNotifSettings() {
    var overlay = document.getElementById('notif-settings-overlay');
    if (!overlay) return;

    var prefs = {};
    overlay.querySelectorAll('input[data-pref]').forEach(function(input) {
        prefs[input.getAttribute('data-pref')] = input.checked;
    });

    if (firebaseDb && GameState.playerPhone) {
        firebaseDb.collection('players').doc(GameState.playerPhone).update({
            notifPrefs: prefs
        }).then(function() {
            showToast('تم حفظ إعدادات الإشعارات ✅', 'success');
        }).catch(function() {
            showToast('حصل مشكلة، حاول تاني', 'error');
        });
    }

    closeNotifSettings();
}

function closeNotifSettings() {
    var overlay = document.getElementById('notif-settings-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(function() { overlay.remove(); }, 300);
    }
}

// ============================================================
// NEW INTERACTIVE GAMES ENGINE
// 5 Game Types: Court of Faith, Creed Builder, Council Journey,
//               Detective, The Balance
// ============================================================

// --- Helper: update score display ---
function updateMGScore() {
    var el = document.getElementById('mg-score');
    if (el) el.textContent = miniGameState.score;
}

// ============================================================
// GAME DATA: INTERACTIVE GAMES PER LESSON (faith subject)
// ============================================================
var INTERACTIVE_GAMES = {
    // ===== LESSON 0: التثليث والتوحيد =====
    'faith_0': {
        courtOfFaith: {
            title: 'محكمة الإيمان — الدفاع عن الثالوث',
            icon: 'gavel',
            heretic: 'أريوس',
            hereticTitle: 'كاهن من الإسكندرية',
            defender: 'البابا أثناسيوس',
            intro: 'أنت في مجمع نيقية سنة ٣٢٥م. أريوس بيقول إن الابن مخلوق ومش مساوي للآب. دافع عن الإيمان الأرثوذكسي!',
            rounds: [
                {
                    claim: 'الابن مخلوق من العدم، كان فيه وقت مكانش فيه الابن!',
                    evidence: [
                        { text: '"في البدء كان الكلمة والكلمة كان عند الله وكان الكلمة الله" (يو ١: ١)', correct: true },
                        { text: '"خلق الله الإنسان على صورته" (تك ١: ٢٧)', correct: false },
                        { text: '"أنا والآب واحد" (يو ١٠: ٣٠)', correct: true },
                        { text: '"في البدء خلق الله السماوات والأرض" (تك ١: ١)', correct: false }
                    ],
                    explanation: 'الابن مولود وليس مخلوق، أزلي مع الآب'
                },
                {
                    claim: 'لو الابن إله، يبقى عندنا إلهين مش إله واحد!',
                    evidence: [
                        { text: '١×١×١=١ — الجوهر الإلهي واحد والخواص ثلاثة', correct: true },
                        { text: '"اسمعي يا إسرائيل، الرب إلهنا رب واحد" (تث ٦: ٤)', correct: false },
                        { text: 'الشمس واحدة فيها قرص وشعاع وحرارة — مثال للثالوث', correct: true },
                        { text: '"لا تصنع لك تمثالاً منحوتاً" (خر ٢٠: ٤)', correct: false }
                    ],
                    explanation: 'التثليث لا ينفي التوحيد — جوهر واحد وثلاث خواص'
                },
                {
                    claim: 'الابن أقل من الآب في المرتبة والجوهر!',
                    evidence: [
                        { text: '"إله حق من إله حق، مولود غير مخلوق، مساوٍ للآب في الجوهر" — قانون الإيمان', correct: true },
                        { text: '"الذين يشهدون في السماء هم ثلاثة وهؤلاء الثلاثة هم واحد" (١يو ٥: ٧)', correct: true },
                        { text: '"الآب أعظم مني" (يو ١٤: ٢٨)', correct: false },
                        { text: '"كل شيء به كان" (يو ١: ٣)', correct: false }
                    ],
                    explanation: 'الابن مساوٍ للآب في الجوهر — "أعظم مني" تشير للتدبير لا الجوهر'
                },
                {
                    claim: 'الروح القدس مجرد قوة من الله مش أقنوم حقيقي!',
                    evidence: [
                        { text: '"الروح القدس الرب المحيي المنبثق من الآب" — قانون الإيمان', correct: true },
                        { text: '"روح الحق الذي من عند الآب ينبثق" (يو ١٥: ٢٦)', correct: true },
                        { text: '"وروح الله يرف على وجه المياه" (تك ١: ٢)', correct: false },
                        { text: '"الريح تهب حيث تشاء" (يو ٣: ٨)', correct: false }
                    ],
                    explanation: 'الروح القدس أقنوم حقيقي — الرب المحيي المنبثق من الآب'
                }
            ]
        },
        creedBuilder: {
            title: 'بناء قانون الإيمان',
            icon: 'building',
            blocks: [
                'بالحقيقة نؤمن',
                'بإله واحد',
                'الله الآب',
                'ضابط الكل',
                'خالق السماء والأرض',
                'نؤمن برب واحد',
                'يسوع المسيح',
                'ابن الله الوحيد',
                'نور من نور',
                'إله حق من إله حق',
                'مولود غير مخلوق',
                'مساوٍ للآب في الجوهر'
            ]
        },
        councilJourney: {
            title: 'رحلة المجامع — نيقية',
            icon: 'landmark',
            scenes: [
                {
                    id: 'arrival',
                    text: 'وصلت مجمع نيقية سنة ٣٢٥م. الإمبراطور قسطنطين جمع ٣١٨ أسقفاً. أريوس بيهاجم ألوهية المسيح. إيه أول خطوة؟',
                    character: 'athanasius',
                    choices: [
                        { text: 'أبدأ بآيات الكتاب المقدس اللي بتثبت ألوهية المسيح', next: 'bible_proof', points: 10, faith: 10 },
                        { text: 'أطلب من الأساقفة يشاركوا خبرتهم', next: 'bishops_help', points: 7, faith: 5 },
                        { text: 'أتجاهل أريوس وأصلي', next: 'pray_only', points: 3, faith: -5 }
                    ]
                },
                {
                    id: 'bible_proof',
                    text: 'ممتاز! فتحت الكتاب المقدس. أريوس بيقول "الابن مخلوق". أنت هتقرأ آية. أنهي آية أقوى رد؟',
                    choices: [
                        { text: '"أنا والآب واحد" (يو ١٠: ٣٠)', next: 'strong_defense', points: 10, faith: 10 },
                        { text: '"في البدء خلق الله" (تك ١: ١)', next: 'weak_verse', points: 3, faith: 0 },
                        { text: '"أحبوا بعضكم بعضاً" (يو ١٣: ٣٤)', next: 'off_topic', points: 1, faith: -5 }
                    ]
                },
                {
                    id: 'bishops_help',
                    text: 'الأساقفة شاركوا خبراتهم. البابا ألكسندروس طلب منك تكمل الدفاع. إيه اللي هتعمله؟',
                    choices: [
                        { text: 'أشرح إن الابن "مولود غير مخلوق" من جوهر الآب', next: 'strong_defense', points: 10, faith: 10 },
                        { text: 'أقول إن الموضوع صعب ومحتاج وقت', next: 'hesitate', points: 2, faith: -3 }
                    ]
                },
                {
                    id: 'pray_only',
                    text: 'الصلاة مهمة لكن لازم كمان تدافع بالعقل والكتاب. الأساقفة محتاجينك. هترجع تدافع؟',
                    choices: [
                        { text: 'أيوه، هفتح الكتاب المقدس وأرد على أريوس', next: 'bible_proof', points: 5, faith: 5 },
                        { text: 'لأ، الصلاة كافية', next: 'end_weak', points: 0, faith: -10 }
                    ]
                },
                {
                    id: 'strong_defense',
                    text: 'دفاعك كان قوي! المجمع قرر إن الابن "مساوٍ للآب في الجوهر". آخر خطوة: إيه اللي المجمع هيعمله عشان يحفظ الإيمان للأجيال الجاية؟',
                    choices: [
                        { text: 'نكتب قانون الإيمان — دستور واضح لكل المسيحيين', next: 'end_perfect', points: 10, faith: 10 },
                        { text: 'نحفظ الكلام شفاهي بدون كتابة', next: 'end_good', points: 5, faith: 3 }
                    ]
                },
                {
                    id: 'weak_verse',
                    text: 'الآية دي عن الخلق مش عن ألوهية المسيح. أريوس لسه بيهاجم. حاول تاني بآية أقوى.',
                    choices: [
                        { text: '"الكلمة كان الله" (يو ١: ١)', next: 'strong_defense', points: 8, faith: 8 },
                        { text: 'أسكت وأستسلم', next: 'end_weak', points: 0, faith: -15 }
                    ]
                },
                {
                    id: 'off_topic',
                    text: 'الآية جميلة بس مش الوقت المناسب. المطلوب إثبات ألوهية المسيح.',
                    choices: [
                        { text: '"في البدء كان الكلمة وكان الكلمة الله" (يو ١: ١)', next: 'strong_defense', points: 8, faith: 8 }
                    ]
                },
                {
                    id: 'hesitate',
                    text: 'التردد خلّى أريوس يقوى. لازم ترد بسرعة!',
                    choices: [
                        { text: 'أقوم وأشرح بقوة إن المسيح "نور من نور، إله حق من إله حق"', next: 'strong_defense', points: 7, faith: 7 }
                    ]
                },
                {
                    id: 'end_perfect',
                    text: '🏆 مبروك! ساعدت في كتابة قانون الإيمان! الكنيسة كلها بتصلي بيه لغاية النهاردة. أنت بطل الإيمان!',
                    choices: [],
                    ending: true
                },
                {
                    id: 'end_good',
                    text: '👏 دفاعك كان كويس! بس الكتابة كانت هتحفظ الإيمان أحسن. قانون الإيمان هو اللي حفظ العقيدة.',
                    choices: [],
                    ending: true
                },
                {
                    id: 'end_weak',
                    text: '💪 للأسف مرديتش على أريوس. بس البابا أثناسيوس والأساقفة دافعوا وكتبوا قانون الإيمان. حاول تاني!',
                    choices: [],
                    ending: true
                }
            ]
        },
        detective: {
            title: 'المحقق — اكتشف الشخصية',
            icon: 'magnifying-glass',
            scenes: [
                {
                    setting: 'مكتبة الإسكندرية القديمة',
                    objects: [
                        { name: 'مخطوطة قديمة', icon: 'scroll', clue: 'مكتوب عليها: "حامي الإيمان"' },
                        { name: 'ختم أسقفي', icon: 'stamp', clue: 'ختم بابا الإسكندرية رقم ٢٠' },
                        { name: 'خطاب', icon: 'envelope', clue: 'خطاب للإمبراطور قسطنطين عن مجمع نيقية' },
                        { name: 'أيقونة', icon: 'image', clue: 'شاب يقف أمام آريوس يدافع عن الإيمان' }
                    ],
                    answer: 'البابا أثناسيوس الرسولي',
                    hint: 'دافع عن ألوهية المسيح في مجمع نيقية'
                },
                {
                    setting: 'ورشة إسكافي في الإسكندرية',
                    objects: [
                        { name: 'إبرة مكسورة', icon: 'syringe', clue: 'إبرة دخلت في إيد صاحبها وصرخ' },
                        { name: 'لافتة المحل', icon: 'store', clue: 'الشخص ده صنعته إسكافي' },
                        { name: 'صليب خشبي', icon: 'cross', clue: 'أول مسيحي في مصر بعد مارمرقس' },
                        { name: 'صرخة مكتوبة', icon: 'comment', clue: '"يا الله الواحد!"' }
                    ],
                    answer: 'انيانوس الإسكافي',
                    hint: 'أول مؤمن بشّره مارمرقس في مصر'
                },
                {
                    setting: 'قاعة مجمع كبيرة',
                    objects: [
                        { name: 'وثيقة رسمية', icon: 'file-alt', clue: 'قانون الإيمان مكتوب فيها' },
                        { name: 'كرسي ملوكي', icon: 'chair', clue: 'الإمبراطور قسطنطين جلس عليه' },
                        { name: 'لوحة تذكارية', icon: 'landmark', clue: 'سنة ٣٢٥ ميلادية — ٣١٨ أسقفاً' },
                        { name: 'حكم محكمة', icon: 'gavel', clue: 'حُكم على أريوس بالحرم' }
                    ],
                    answer: 'مجمع نيقية',
                    hint: 'أول مجمع مسكوني في تاريخ الكنيسة'
                },
                {
                    setting: 'مذبح كنيسة قديمة',
                    objects: [
                        { name: 'نار مشتعلة', icon: 'fire', clue: 'فيها لهب وضياء وحرارة — وهي واحدة' },
                        { name: 'شمس مرسومة', icon: 'sun', clue: 'قرص وشعاع وحرارة — شمس واحدة' },
                        { name: 'مثلث ذهبي', icon: 'shapes', clue: '٣ رؤوس وهو كيان واحد' },
                        { name: 'معادلة', icon: 'calculator', clue: '١×١×١=١' }
                    ],
                    answer: 'أمثلة الثالوث في الطبيعة',
                    hint: 'كل مثال فيه ثلاث خواص لكنه شيء واحد'
                }
            ]
        },
        balance: {
            title: 'ميزان الإيمان',
            icon: 'balance-scale',
            statements: [
                { text: 'الله واحد في جوهره', answer: true, weight: 5 },
                { text: 'الأقانيم الثلاثة هم ثلاثة آلهة', answer: false, weight: 10 },
                { text: 'الابن مولود من الآب أزلياً', answer: true, weight: 5 },
                { text: 'الروح القدس مخلوق', answer: false, weight: 10 },
                { text: 'الابن هو اللوجوس — عقل الله الناطق', answer: true, weight: 5 },
                { text: 'كان فيه وقت مكانش فيه الابن', answer: false, weight: 10 },
                { text: 'الجوهر الإلهي واحد', answer: true, weight: 5 },
                { text: 'الآب أعظم من الابن في الجوهر', answer: false, weight: 10 },
                { text: 'قانون الإيمان كتبه مجمع نيقية والقسطنطينية', answer: true, weight: 5 },
                { text: 'الروح القدس منبثق من الآب والابن', answer: false, weight: 8 },
                { text: 'البابا أثناسيوس دافع عن الثالوث', answer: true, weight: 5 },
                { text: 'الابن أقل من الآب في القدرة', answer: false, weight: 10 },
                { text: 'الثالوث ظهر في عماد المسيح', answer: true, weight: 5 },
                { text: '١+١+١=٣ هي معادلة الثالوث', answer: false, weight: 8 },
                { text: 'الشمس فيها قرص وشعاع وحرارة — مثال للثالوث', answer: true, weight: 5 },
                { text: 'الانبثاق هو نفسه الولادة', answer: false, weight: 8 },
                { text: 'الإنسان فيه روح ونفس وجسد — مثال للوحدانية', answer: true, weight: 5 },
                { text: 'أقنوم كلمة عربية', answer: false, weight: 5 },
                { text: 'الروح القدس هو الرب المحيي', answer: true, weight: 5 },
                { text: 'الأقانيم ثلاثة أجزاء من الله', answer: false, weight: 10 }
            ]
        }
    },
    // ===== LESSON 1: التجسد الإلهي =====
    'faith_1': {
        courtOfFaith: {
            title: 'محكمة الإيمان — الدفاع عن التجسد',
            icon: 'gavel',
            heretic: 'أوطاخي',
            hereticTitle: 'راهب من القسطنطينية',
            defender: 'القديس كيرلس',
            intro: 'أوطاخي بيقول إن الطبيعة الإنسانية ذابت في اللاهوت! دافع عن إن المسيح طبيعة واحدة من طبيعتين بدون اختلاط.',
            rounds: [
                {
                    claim: 'اللاهوت ابتلع الناسوت! الطبيعة الإنسانية ذابت في الإلهية!',
                    evidence: [
                        { text: '"الكلمة صار جسداً وحل بيننا" (يو ١: ١٤) — صار جسداً حقيقياً', correct: true },
                        { text: '"في البدء كان الكلمة" — الكلمة هو الله فقط', correct: false },
                        { text: 'مثال الحديد والنار: الحديد المحمي بالنار — اتحاد بدون اختلاط', correct: true },
                        { text: '"الله روح" — يعني مفيش جسد', correct: false }
                    ],
                    explanation: 'المسيح طبيعة واحدة متحدة — بدون اختلاط ولا امتزاج ولا تغيير'
                },
                {
                    claim: 'لو المسيح إنسان حقيقي، يبقى ممكن يخطئ!',
                    evidence: [
                        { text: '"شابهنا في كل شيء ما عدا الخطية وحدها" (عب ٤: ١٥)', correct: true },
                        { text: '"مَن مِنكم يُبكّتني على خطية؟" (يو ٨: ٤٦)', correct: true },
                        { text: '"الجميع أخطأوا" (رو ٣: ٢٣) — يعني المسيح كمان', correct: false },
                        { text: '"لا صالح إلا واحد وهو الله" — يعني المسيح مش صالح', correct: false }
                    ],
                    explanation: 'المسيح إنسان كامل لكن بلا خطية لأن اللاهوت متحد بالناسوت'
                },
                {
                    claim: 'ليه ما ينفعش ملاك يتجسد بدل ما الله نفسه يتجسد؟',
                    evidence: [
                        { text: 'الملاك محدود ومخلوق — مش قادر يفدي البشرية كلها', correct: true },
                        { text: 'الفادي لازم يكون غير محدود عشان يفدي عدد غير محدود', correct: true },
                        { text: 'الملائكة أقوى من الله في بعض الأحيان', correct: false },
                        { text: 'الملاك ممكن يموت عن البشر', correct: false }
                    ],
                    explanation: 'الفادي لازم يكون الله نفسه — غير محدود وبلا خطية'
                }
            ]
        },
        creedBuilder: {
            title: 'بناء عقيدة التجسد',
            icon: 'building',
            blocks: [
                'هذا الذي',
                'من أجلنا نحن البشر',
                'ومن أجل خلاصنا',
                'نزل من السماء',
                'وتجسد',
                'من الروح القدس',
                'ومن مريم العذراء',
                'تأنس',
                'وصُلب عنا',
                'على عهد بيلاطس البنطي',
                'تألم وقُبر',
                'وقام من الأموات في اليوم الثالث'
            ]
        },
        councilJourney: {
            title: 'رحلة إلى بيت لحم',
            icon: 'star',
            scenes: [
                {
                    id: 'start',
                    text: 'الملاك جبرائيل ظهر للعذراء مريم. قالها "الروح القدس يحل عليكِ وقوة العلي تظللكِ". إيه رد العذراء؟',
                    choices: [
                        { text: '"هوذا أنا أَمة الرب، ليكن لي كقولك"', next: 'bethlehem', points: 10, faith: 10 },
                        { text: '"مش فاهمة، ازاي ده يحصل؟"', next: 'question', points: 5, faith: 3 },
                        { text: '"مش موافقة"', next: 'refuse', points: 0, faith: -10 }
                    ]
                },
                {
                    id: 'question',
                    text: 'سؤال العذراء كان من تواضع. الملاك شرحلها. الروح القدس حلّ عليها لتطهير المستودع. إيه معنى التجسد؟',
                    choices: [
                        { text: 'الله أخذ جسداً إنسانياً حقيقياً', next: 'bethlehem', points: 8, faith: 8 },
                        { text: 'الله ظهر بشكل مرئي فقط بدون جسد حقيقي', next: 'wrong_view', points: 2, faith: -5 }
                    ]
                },
                {
                    id: 'bethlehem',
                    text: 'المسيح وُلد في بيت لحم. اتحد اللاهوت بالناسوت. الحديد المحمي بالنار مثال للاتحاد. ليه التجسد كان ضروري؟',
                    choices: [
                        { text: 'عشان الفادي لازم يكون من نفس طبيعة المفدي — إنسان وإله', next: 'end_perfect', points: 10, faith: 10 },
                        { text: 'عشان الله عايز يشوف الأرض', next: 'end_ok', points: 3, faith: 0 }
                    ]
                },
                {
                    id: 'refuse',
                    text: 'طبعاً العذراء ماقالتش كده! هي أطاعت بتواضع. القصة الحقيقية:',
                    choices: [
                        { text: 'ابدأ من الأول وأتعلم', next: 'start', points: 0, faith: 0 }
                    ]
                },
                {
                    id: 'wrong_view',
                    text: 'لا! التجسد = الله أخذ جسداً حقيقياً. والتأنس = الجسد كان إنساناً كاملاً. مش مجرد ظهور.',
                    choices: [
                        { text: 'فهمت! أكمل الرحلة', next: 'bethlehem', points: 5, faith: 5 }
                    ]
                },
                {
                    id: 'end_perfect',
                    text: '🏆 ممتاز! فهمت سر التجسد — الله صار إنساناً ليفدينا. "الكلمة صار جسداً وحل بيننا"!',
                    choices: [],
                    ending: true
                },
                {
                    id: 'end_ok',
                    text: '👏 كويس! بس التجسد الهدف الأساسي منه الفداء — الله صار إنساناً ليموت عنا ويقيمنا.',
                    choices: [],
                    ending: true
                }
            ]
        },
        detective: {
            title: 'المحقق — أسرار التجسد',
            icon: 'magnifying-glass',
            scenes: [
                {
                    setting: 'مغارة بيت لحم',
                    objects: [
                        { name: 'مذود خشبي', icon: 'baby', clue: 'وُلد في مذود — الإله صار طفلاً' },
                        { name: 'نجمة ساطعة', icon: 'star', clue: 'أرشدت المجوس من المشرق' },
                        { name: 'أقمشة بيضاء', icon: 'shirt', clue: 'لفّته أمه بأقمطة' },
                        { name: 'قنديل قديم', icon: 'candle-holder', clue: '"الكلمة صار جسداً وحل بيننا"' }
                    ],
                    answer: 'ميلاد المسيح — سر التجسد',
                    hint: 'الإله أخذ جسداً وسكن بيننا'
                },
                {
                    setting: 'نهر الأردن',
                    objects: [
                        { name: 'ماء النهر', icon: 'water', clue: 'اللي اتعمد هنا هو الله المتجسد' },
                        { name: 'حمامة بيضاء', icon: 'dove', clue: 'الروح القدس نزل بشكل حمامة' },
                        { name: 'صوت من السماء', icon: 'volume-up', clue: '"هذا هو ابني الحبيب"' },
                        { name: 'يوحنا المعمدان', icon: 'person-praying', clue: '"هوذا حمل الله الذي يرفع خطية العالم"' }
                    ],
                    answer: 'عماد المسيح — ظهور الثالوث',
                    hint: 'الحدث الذي ظهر فيه الثالوث بوضوح'
                }
            ]
        },
        balance: {
            title: 'ميزان التجسد',
            icon: 'balance-scale',
            statements: [
                { text: 'المسيح إله كامل وإنسان كامل', answer: true, weight: 5 },
                { text: 'اللاهوت تحوّل إلى ناسوت', answer: false, weight: 10 },
                { text: 'التجسد هو أن الله أخذ جسداً', answer: true, weight: 5 },
                { text: 'المسيح شابهنا في كل شيء حتى الخطية', answer: false, weight: 10 },
                { text: 'الروح القدس حلّ على العذراء لتطهير المستودع', answer: true, weight: 5 },
                { text: 'يوسف النجار هو أب المسيح البيولوجي', answer: false, weight: 10 },
                { text: 'اتحاد اللاهوت بالناسوت بدون اختلاط ولا امتزاج', answer: true, weight: 5 },
                { text: 'الله انحصر داخل الجسد وما كانش يدير الكون', answer: false, weight: 10 },
                { text: 'ولادة الابن الزمنية كانت من مريم العذراء', answer: true, weight: 5 },
                { text: 'ظهورات الله في العهد القديم كانت تجسداً حقيقياً', answer: false, weight: 8 },
                { text: 'الكلمة صار جسداً وحل بيننا', answer: true, weight: 5 },
                { text: 'المسيح طبيعتين منفصلتين', answer: false, weight: 10 },
                { text: 'مثال الحديد والنار يوضح الاتحاد بدون اختلاط', answer: true, weight: 5 },
                { text: 'الملاك كان يقدر يفدي البشرية بدل المسيح', answer: false, weight: 10 },
                { text: 'التأنس يعني أن الجسد المأخوذ كان إنساناً كاملاً', answer: true, weight: 5 }
            ]
        }
    },
    // ===== LESSON 2: الفداء والصليب =====
    'faith_2': {
        courtOfFaith: {
            title: 'محكمة الإيمان — ضرورة الفداء',
            icon: 'gavel',
            heretic: 'المعترض',
            hereticTitle: 'فيلسوف يشكك في الصليب',
            defender: 'القديس بولس',
            intro: 'فيلسوف بيسأل: ليه الله مش ممكن يسامح بدون صليب؟ ليه لازم دم؟ دافع عن حكمة الصليب!',
            rounds: [
                {
                    claim: 'ليه مينفعش ربنا يسامح آدم بدون كل ده؟ هو مش رحيم؟',
                    evidence: [
                        { text: '"الرحمة والحق التقيا، البر والسلام تلاثما" (مز ٨٥: ١٠) — لازم العدل والرحمة يتحققوا', correct: true },
                        { text: '"بدون سفك دم لا تحصل مغفرة" (عب ٩: ٢٢)', correct: true },
                        { text: '"الله محبة" — يعني المسامحة كافية', correct: false },
                        { text: '"من يحبني يحفظ وصاياي" — يعني الأعمال كافية', correct: false }
                    ],
                    explanation: 'لو الله سامح بدون فداء كان ده ضد عدله — الرحمة والحق لازم يتحققوا'
                },
                {
                    claim: 'ليه ما بعتش ملاك يموت بدل ما يموت هو؟',
                    evidence: [
                        { text: 'الملاك محدود ومخلوق — دمه ما ينفعش يفدي خطية غير محدودة', correct: true },
                        { text: 'الفادي لازم يكون من نفس طبيعة المفدي — إنسان', correct: true },
                        { text: 'الملائكة أقوياء كفاية للفداء', correct: false },
                        { text: 'ذبائح الحيوانات كانت كافية', correct: false }
                    ],
                    explanation: 'الفادي لازم يكون إنسان كامل وإله كامل — ماحدش غير المسيح يقدر'
                },
                {
                    claim: 'الصليب ضعف! إله يموت؟ ده مش منطقي!',
                    evidence: [
                        { text: '"حمل قائم كأنه مذبوح" (رؤ ٥: ٦) — القوة في التضحية', correct: true },
                        { text: 'اللاهوت لم يمت — الناسوت المتحد باللاهوت هو اللي مات', correct: true },
                        { text: 'الموت على الصليب كان هزيمة', correct: false },
                        { text: 'الله ضعيف لأنه سمح بالصلب', correct: false }
                    ],
                    explanation: 'الصليب قوة ومحبة — "أين شوكتك يا موت؟"'
                }
            ]
        },
        creedBuilder: {
            title: 'بناء عقيدة الفداء',
            icon: 'cross',
            blocks: [
                'في آدم يموت الجميع',
                'وفي المسيح سيحيا الجميع',
                'الرحمة والحق التقيا',
                'البر والسلام تلاثما',
                'بدون سفك دم',
                'لا تحصل مغفرة',
                'هكذا أحب الله العالم',
                'حتى بذل ابنه الوحيد',
                'لكي لا يهلك كل من يؤمن به',
                'بل تكون له الحياة الأبدية',
                'حمل الله الذي يرفع',
                'خطية العالم'
            ]
        },
        councilJourney: {
            title: 'رحلة إلى الجلجثة',
            icon: 'cross',
            scenes: [
                {
                    id: 'start',
                    text: 'أنت واقف عند قدم الصليب يوم الجمعة العظيمة. المسيح معلق بين السماء والأرض. ليه المسيح اختار ده؟',
                    choices: [
                        { text: 'لأن الفداء محتاج حد غير محدود يموت عن خطية غير محدودة', next: 'understand', points: 10, faith: 10 },
                        { text: 'لأن الله غضبان من البشر', next: 'wrong', points: 2, faith: -5 },
                        { text: 'مش فاهم ليه', next: 'learn', points: 5, faith: 0 }
                    ]
                },
                {
                    id: 'understand',
                    text: 'صح! "هكذا أحب الله العالم حتى بذل ابنه الوحيد". ستار الهيكل انشق. إيه معنى ده؟',
                    choices: [
                        { text: 'الطريق لله بقى مفتوح — الحجاب بيننا وبين الله اترفع', next: 'end_perfect', points: 10, faith: 10 },
                        { text: 'الهيكل اتخرب', next: 'end_ok', points: 5, faith: 3 }
                    ]
                },
                {
                    id: 'wrong',
                    text: 'لا! الصليب مش غضب — ده حب! "الله محبة" والصليب أعظم تعبير عن المحبة.',
                    choices: [
                        { text: 'فهمت — الصليب محبة مش غضب', next: 'understand', points: 5, faith: 5 }
                    ]
                },
                {
                    id: 'learn',
                    text: 'بعد سقوط آدم، الموت حكم على الجميع. الله مش ممكن يسامح بدون عدل. فالمسيح أخذ مكاننا.',
                    choices: [
                        { text: 'فهمت! الفداء يحقق العدل والرحمة معاً', next: 'understand', points: 8, faith: 8 }
                    ]
                },
                {
                    id: 'end_perfect',
                    text: '🏆 ممتاز! فهمت سر الصليب — المحبة فتحت الطريق لله! "بالصليب جاء فرح في العالم كله"!',
                    choices: [],
                    ending: true
                },
                {
                    id: 'end_ok',
                    text: '👏 الهيكل ماتخربش — ستار الهيكل انشق يعني الحجاب اتشال والطريق لله بقى مفتوح!',
                    choices: [],
                    ending: true
                }
            ]
        },
        detective: {
            title: 'المحقق — رموز الفداء',
            icon: 'magnifying-glass',
            scenes: [
                {
                    setting: 'خيمة الاجتماع في العهد القديم',
                    objects: [
                        { name: 'حمل مذبوح', icon: 'drumstick-bite', clue: 'ذبيحة عيد الفصح — رمز لذبيحة أعظم' },
                        { name: 'دم على الباب', icon: 'door-open', clue: 'دم الحمل على الأبواب حمى من الملاك المهلك' },
                        { name: 'عظام غير مكسورة', icon: 'bone', clue: '"عظم لا يُكسر منه" — نبوة تحققت' },
                        { name: 'سفر الخروج', icon: 'book', clue: 'خروج ١٢ — أول عيد فصح' }
                    ],
                    answer: 'خروف الفصح — رمز للمسيح',
                    hint: 'ذبيحة العهد القديم التي ترمز لفداء المسيح'
                },
                {
                    setting: 'تل الجلجثة',
                    objects: [
                        { name: 'صليب خشبي', icon: 'cross', clue: 'أداة الإعدام صارت رمز الانتصار' },
                        { name: 'ستار ممزق', icon: 'scroll', clue: 'انشق من فوق إلى أسفل — الطريق لله انفتح' },
                        { name: 'ظلمة على الأرض', icon: 'moon', clue: 'من الساعة السادسة إلى التاسعة' },
                        { name: 'قائد المئة', icon: 'person', clue: '"حقاً كان هذا ابن الله!"' }
                    ],
                    answer: 'صلب المسيح — الفداء الحقيقي',
                    hint: 'الحدث الذي غيّر مصير البشرية'
                }
            ]
        },
        balance: {
            title: 'ميزان الفداء',
            icon: 'balance-scale',
            statements: [
                { text: 'الفداء عمل إلهي قام به الله بنفسه', answer: true, weight: 5 },
                { text: 'ممكن ملاك يفدي البشرية', answer: false, weight: 10 },
                { text: 'الرحمة والحق التقيا في الصليب', answer: true, weight: 5 },
                { text: 'ربنا ممكن يسامح بدون فداء', answer: false, weight: 10 },
                { text: 'المسيح هو آدم الثاني', answer: true, weight: 5 },
                { text: 'ذبائح العهد القديم كانت كافية لمغفرة الخطايا', answer: false, weight: 8 },
                { text: 'الصليب رمز للمحبة والانتصار', answer: true, weight: 5 },
                { text: 'اللاهوت مات على الصليب', answer: false, weight: 10 },
                { text: 'ستار الهيكل انشق من فوق إلى أسفل', answer: true, weight: 5 },
                { text: 'المسيح صُلب يوم الأحد', answer: false, weight: 5 },
                { text: 'الصليب فتح الطريق بيننا وبين الله', answer: true, weight: 5 },
                { text: 'خروف الفصح كان رمزاً للمسيح', answer: true, weight: 5 },
                { text: 'دم المسيح يطهر من كل خطية', answer: true, weight: 5 },
                { text: 'الفادي مش لازم يكون من نفس طبيعة المفدي', answer: false, weight: 10 },
                { text: 'بدون سفك دم لا تحصل مغفرة', answer: true, weight: 5 }
            ]
        }
    },
    // ===== LESSON 3: القيامة والمجيء الثاني =====
    'faith_3': {
        courtOfFaith: {
            title: 'محكمة الإيمان — حقيقة القيامة',
            icon: 'gavel',
            heretic: 'المشكك',
            hereticTitle: 'منكر القيامة',
            defender: 'بولس الرسول',
            intro: 'حد بيشكك في القيامة ويقول إنها مجرد رمز أو خيال. دافع عن حقيقة قيامة المسيح بالجسد!',
            rounds: [
                {
                    claim: 'القيامة مجرد فكرة رمزية وروحية مش حقيقية!',
                    evidence: [
                        { text: '"إن لم يكن المسيح قد قام فباطلة كرازتنا وباطل إيمانكم" (١كو ١٥: ١٤)', correct: true },
                        { text: 'توما لمس جراحات المسيح بعد القيامة — قيامة جسدية حقيقية', correct: true },
                        { text: '"الروح لا جسد لها" — يعني القيامة روحية بس', correct: false },
                        { text: '"أنا والآب واحد" — مش ليها علاقة بالقيامة', correct: false }
                    ],
                    explanation: 'القيامة كانت جسدية حقيقية — المسيح أكل وشرب وظهر ل٥٠٠ أخ'
                },
                {
                    claim: 'لو المسيح قام فعلاً، ليه ما بقاش على الأرض؟',
                    evidence: [
                        { text: 'بقي ٤٠ يوماً يعلّم ثم صعد — عنده رسالة سماوية', correct: true },
                        { text: '"في بيت أبي منازل كثيرة... أمضي لأعد لكم مكاناً" (يو ١٤: ٢)', correct: true },
                        { text: 'لأنه خاف من اليهود', correct: false },
                        { text: 'لأن جسد القيامة ضعيف', correct: false }
                    ],
                    explanation: 'صعد ليعد لنا مكاناً وسيأتي ثانياً ليدين الأحياء والأموات'
                }
            ]
        },
        creedBuilder: {
            title: 'بناء عقيدة القيامة',
            icon: 'sun',
            blocks: [
                'وقام من الأموات',
                'في اليوم الثالث',
                'كما في الكتب',
                'وصعد إلى السماوات',
                'وجلس عن يمين أبيه',
                'وأيضاً يأتي',
                'في مجده',
                'ليدين الأحياء والأموات',
                'الذي ليس لملكه انقضاء',
                'ونعترف بمعمودية واحدة',
                'لمغفرة الخطايا',
                'وننتظر قيامة الأموات وحياة الدهر الآتي'
            ]
        },
        councilJourney: {
            title: 'رحلة القيامة',
            icon: 'sun',
            scenes: [
                {
                    id: 'tomb',
                    text: 'فجر الأحد. أنت عند القبر الفارغ. الحجر مدحرج والأكفان موجودة. إيه أول حاجة هتعملها؟',
                    choices: [
                        { text: 'أدخل القبر وأشوف الأكفان — دليل إن الجسد قام مش اتسرق', next: 'evidence', points: 10, faith: 10 },
                        { text: 'أهرب من الخوف', next: 'fear', points: 2, faith: -5 },
                        { text: 'أستنى أشوف إيه هيحصل', next: 'wait', points: 5, faith: 3 }
                    ]
                },
                {
                    id: 'evidence',
                    text: 'الأكفان مطوية بنظام — لو حد سرق الجسد مكانش هيطوي الأكفان! الملائكة قالوا "ليس هو ههنا لأنه قام". مين أول واحدة شافت المسيح؟',
                    choices: [
                        { text: 'مريم المجدلية — أول شاهدة على القيامة', next: 'appearances', points: 10, faith: 10 },
                        { text: 'بطرس الرسول', next: 'wrong_witness', points: 3, faith: 0 }
                    ]
                },
                {
                    id: 'fear',
                    text: 'الخوف طبيعي، بس الملائكة قالوا "لا تخافوا"! القيامة فرح مش خوف.',
                    choices: [
                        { text: 'أرجع للقبر وأشوف الحقيقة', next: 'evidence', points: 5, faith: 5 }
                    ]
                },
                {
                    id: 'wait',
                    text: 'وأنت مستني، المسيح ظهر لمريم المجدلية. جسد القيامة كان حقيقي بس ممجد.',
                    choices: [
                        { text: 'أروح أبشّر التلاميذ', next: 'appearances', points: 8, faith: 8 }
                    ]
                },
                {
                    id: 'wrong_witness',
                    text: 'بطرس راح للقبر بس أول واحدة شافت المسيح كانت مريم المجدلية.',
                    choices: [
                        { text: 'فهمت، أكمل', next: 'appearances', points: 5, faith: 5 }
                    ]
                },
                {
                    id: 'appearances',
                    text: 'المسيح ظهر لتلاميذه والأبواب مغلقة. جسد القيامة الممجد يقدر يدخل الأبواب المغلقة. بعد ٤٠ يوم إيه اللي حصل؟',
                    choices: [
                        { text: 'صعد إلى السماء من جبل الزيتون — وسيأتي ثانياً ليدين', next: 'end_perfect', points: 10, faith: 10 },
                        { text: 'اختفى', next: 'end_ok', points: 3, faith: 0 }
                    ]
                },
                {
                    id: 'end_perfect',
                    text: '🏆 ممتاز! "أين شوكتك يا موت؟" — القيامة انتصرت على الموت! وننتظر مجيئه الثاني بفرح.',
                    choices: [],
                    ending: true
                },
                {
                    id: 'end_ok',
                    text: '👏 ما اختفاش — صعد إلى السماء وجلس عن يمين الآب. وأيضاً يأتي في مجده ليدين.',
                    choices: [],
                    ending: true
                }
            ]
        },
        detective: {
            title: 'المحقق — أدلة القيامة',
            icon: 'magnifying-glass',
            scenes: [
                {
                    setting: 'القبر الفارغ صباح الأحد',
                    objects: [
                        { name: 'حجر مدحرج', icon: 'circle', clue: 'الحجر الضخم اتدحرج — مين قدر يعمل كده؟' },
                        { name: 'أكفان مطوية', icon: 'scroll', clue: 'لو سرقة مكانش حد هيطوي الأكفان' },
                        { name: 'ملاكين جالسين', icon: 'user-shield', clue: '"ليس هو ههنا لأنه قام"' },
                        { name: 'حراس نايمين', icon: 'bed', clue: 'الحراس رُشوا عشان يقولوا "التلاميذ سرقوه"' }
                    ],
                    answer: 'قيامة المسيح من الأموات',
                    hint: 'أعظم حدث في التاريخ — القبر فارغ والمسيح حي'
                }
            ]
        },
        balance: {
            title: 'ميزان القيامة',
            icon: 'balance-scale',
            statements: [
                { text: 'المسيح قام بالجسد في اليوم الثالث', answer: true, weight: 5 },
                { text: 'القيامة كانت رمزية فقط', answer: false, weight: 10 },
                { text: 'جسد القيامة روحاني ممجد', answer: true, weight: 5 },
                { text: 'اللاهوت مات على الصليب', answer: false, weight: 10 },
                { text: 'مريم المجدلية أول من رأت المسيح بعد القيامة', answer: true, weight: 5 },
                { text: 'المسيح سيملك على الأرض ألف سنة', answer: false, weight: 8 },
                { text: 'المسيح بقي ٤٠ يوماً بعد القيامة ثم صعد', answer: true, weight: 5 },
                { text: 'يوم الرب يأتي فجأة مثل الحرامي في الليل', answer: true, weight: 5 },
                { text: 'في المجيء الثاني المسيح يدين الأحياء فقط', answer: false, weight: 8 },
                { text: 'جسد المسيح بعد القيامة كان يدخل والأبواب مغلقة', answer: true, weight: 5 },
                { text: 'التناول من جسد الرب ودمه يعطينا قوة القيامة', answer: true, weight: 5 },
                { text: 'القيامة لا تعطينا رجاء', answer: false, weight: 10 },
                { text: 'توما آمن لما رأى ولمس جراحات المسيح', answer: true, weight: 5 },
                { text: 'صعد المسيح من جبل سيناء', answer: false, weight: 5 },
                { text: 'الأموات في المسيح يقومون أولاً عند المجيء الثاني', answer: true, weight: 5 }
            ]
        }
    },
    // ===== LESSON 4: المعمودية والميرون =====
    'faith_4': {
        courtOfFaith: {
            title: 'محكمة الإيمان — ضرورة المعمودية',
            icon: 'gavel',
            heretic: 'المعترض',
            hereticTitle: 'رافض المعمودية للأطفال',
            defender: 'الكاهن',
            intro: 'حد بيقول: "الأطفال مش محتاجين معمودية! يكبروا ويقرروا بنفسهم!" دافع عن معمودية الأطفال.',
            rounds: [
                {
                    claim: 'الأطفال مش محتاجين معمودية لأنهم بريئين!',
                    evidence: [
                        { text: '"إن كان أحد لا يولد من الماء والروح لا يقدر أن يدخل ملكوت الله" (يو ٣: ٥)', correct: true },
                        { text: 'المعمودية تغفر الخطية الجدية (الأصلية) الموروثة من آدم', correct: true },
                        { text: '"دعوا الأولاد يأتون إلي" — بس ما قالش يعمّدوهم', correct: false },
                        { text: '"الإنسان يولد بريئاً" — فمش محتاج معمودية', correct: false }
                    ],
                    explanation: 'كل إنسان يولد بالخطية الجدية — والمعمودية هي الولادة الجديدة'
                },
                {
                    claim: 'المعمودية مجرد رش ماء، مش محتاج تغطيس!',
                    evidence: [
                        { text: '"بابتيزما" كلمة يونانية معناها "تغطيس" — مش رش', correct: true },
                        { text: 'المسيح نفسه "صعد من الماء" — يعني كان مغطس', correct: true },
                        { text: '"الروح القدس حلّ عليه" — يعني الرش كافي', correct: false },
                        { text: 'يوحنا كان بيرش الناس بالماء', correct: false }
                    ],
                    explanation: 'المعمودية بالتغطيس — ٣ مرات باسم الثالوث — دفن وقيامة مع المسيح'
                }
            ]
        },
        creedBuilder: {
            title: 'بناء ترتيب المعمودية',
            icon: 'water',
            blocks: [
                'الصلاة على الماء',
                'وضع زيت الغاليلاون',
                'مسح المعمَّد بالزيت',
                'خلع الملابس القديمة',
                'التغطيسة الأولى — باسم الآب',
                'التغطيسة الثانية — باسم الابن',
                'التغطيسة الثالثة — باسم الروح القدس',
                'لبس الملابس البيضاء',
                'مسح الميرون — ٣٦ رشمة',
                'رشومات الرأس — تقديس الحواس',
                'رشومات الأيدين — تقديس العمل',
                'رشومات الأرجل — تقديس المسيرة'
            ]
        },
        councilJourney: {
            title: 'رحلة المعمودية',
            icon: 'water',
            scenes: [
                {
                    id: 'start',
                    text: 'أنت في كنيسة قديمة. طفل صغير جاي للمعمودية. الكاهن بيبدأ بالصلاة على الماء. إيه أول خطوة بعد الصلاة؟',
                    choices: [
                        { text: 'مسح الطفل بزيت الغاليلاون — زيت الفرح والتقديس', next: 'oil', points: 10, faith: 10 },
                        { text: 'تغطيس الطفل في الماء مباشرة', next: 'rush', points: 3, faith: -3 },
                        { text: 'لبس الطفل ملابس بيضاء', next: 'wrong_order', points: 2, faith: -5 }
                    ]
                },
                {
                    id: 'oil',
                    text: 'ممتاز! بعد المسح بالزيت، الكاهن بيغطس الطفل. كام مرة بيتغطس ولماذا؟',
                    choices: [
                        { text: '٣ مرات — باسم الآب والابن والروح القدس', next: 'baptism', points: 10, faith: 10 },
                        { text: 'مرة واحدة كفاية', next: 'wrong_count', points: 3, faith: -3 }
                    ]
                },
                {
                    id: 'rush',
                    text: 'لا! في خطوات قبل التغطيس — لازم يتمسح بزيت الغاليلاون الأول. كل خطوة ليها معنى.',
                    choices: [
                        { text: 'فهمت! أبدأ بالترتيب الصح', next: 'oil', points: 5, faith: 5 }
                    ]
                },
                {
                    id: 'wrong_order',
                    text: 'الملابس البيضاء بتيجي بعد التغطيس مش قبله — رمز للطهارة والنقاء بعد الولادة الجديدة.',
                    choices: [
                        { text: 'فهمت! أرجع للترتيب الصح', next: 'oil', points: 3, faith: 3 }
                    ]
                },
                {
                    id: 'wrong_count',
                    text: '٣ مرات مش مرة واحدة! كل تغطيسة باسم أقنوم — الآب والابن والروح القدس.',
                    choices: [
                        { text: 'فهمت — ٣ تغطيسات باسم الثالوث', next: 'baptism', points: 5, faith: 5 }
                    ]
                },
                {
                    id: 'baptism',
                    text: 'بعد التغطيس، الطفل لبس ملابس بيضاء. الآن سر الميرون — كام رشمة بيعملها الكاهن؟',
                    choices: [
                        { text: '٣٦ رشمة — تقدس كل حواس وكيان الإنسان', next: 'end_perfect', points: 10, faith: 10 },
                        { text: '١٢ رشمة', next: 'wrong_chrism', points: 3, faith: 0 }
                    ]
                },
                {
                    id: 'wrong_chrism',
                    text: '٣٦ مش ١٢! — ٨ للرأس (الحواس) + ١٢ للأيدين (العمل) + ١٢ للأرجل (المسيرة) + ٤ للصلب والظهر.',
                    choices: [
                        { text: 'فهمت!', next: 'end_perfect', points: 5, faith: 5 }
                    ]
                },
                {
                    id: 'end_perfect',
                    text: '🏆 مبروك! الطفل اتعمد واتمسح بالميرون. بقى عضو في جسد المسيح! "رب واحد، إيمان واحد، معمودية واحدة".',
                    choices: [],
                    ending: true
                }
            ]
        },
        detective: {
            title: 'المحقق — رموز المعمودية',
            icon: 'magnifying-glass',
            scenes: [
                {
                    setting: 'فلك نوح القديم',
                    objects: [
                        { name: 'فلك خشبي', icon: 'ship', clue: 'أنقذ أسرة واحدة من الطوفان' },
                        { name: 'ماء الطوفان', icon: 'water', clue: 'الماء أهلك العالم القديم وبدأ عالم جديد' },
                        { name: 'حمامة بغصن زيتون', icon: 'dove', clue: 'علامة أن الأرض جفت — بداية جديدة' },
                        { name: 'قوس قزح', icon: 'rainbow', clue: 'عهد الله الجديد مع البشرية' }
                    ],
                    answer: 'فلك نوح — رمز للمعمودية',
                    hint: 'الماء أهلك القديم وبدأ الجديد — مثل المعمودية'
                },
                {
                    setting: 'البحر الأحمر',
                    objects: [
                        { name: 'عصا موسى', icon: 'wand-magic', clue: 'ضرب بيها البحر فانشق' },
                        { name: 'ممر في البحر', icon: 'road', clue: 'الشعب عبر على أرض يابسة' },
                        { name: 'جيش فرعون', icon: 'horse', clue: 'غرق في الماء — الشر هُزم' },
                        { name: 'ترنيمة مريم', icon: 'music', clue: '"رنموا للرب فإنه قد تعظم" — فرح الخلاص' }
                    ],
                    answer: 'عبور البحر الأحمر — رمز للمعمودية',
                    hint: 'عبور من العبودية للحرية عبر الماء'
                }
            ]
        },
        balance: {
            title: 'ميزان المعمودية',
            icon: 'balance-scale',
            statements: [
                { text: 'المعمودية هي باب الأسرار السبعة', answer: true, weight: 5 },
                { text: 'المعمودية بالرش كافية', answer: false, weight: 10 },
                { text: 'المعمَّد يُغطس ٣ مرات', answer: true, weight: 5 },
                { text: 'المعمودية ممكن تتعاد', answer: false, weight: 10 },
                { text: 'الميرون فيه ٣٦ رشمة', answer: true, weight: 5 },
                { text: 'المعمودية لا تغفر الخطية الجدية', answer: false, weight: 10 },
                { text: 'الطوفان وفلك نوح رمز للمعمودية', answer: true, weight: 5 },
                { text: 'الولد يُعمَّد بعد ٨٠ يوم', answer: false, weight: 5 },
                { text: 'عبور البحر الأحمر رمز للمعمودية', answer: true, weight: 5 },
                { text: 'المعمودية لا تحتاج كاهن', answer: false, weight: 10 },
                { text: 'المعمودية موت وقيامة مع المسيح', answer: true, weight: 5 },
                { text: 'البنت تُعمَّد بعد ٤٠ يوم', answer: false, weight: 5 },
                { text: 'بعد المعمودية علاج الخطية بالتوبة والاعتراف', answer: true, weight: 5 },
                { text: 'الميرون سر حلول الروح القدس', answer: true, weight: 5 },
                { text: 'كلمة معمودية معناها "رش"', answer: false, weight: 8 }
            ]
        }
    },
    // ===== LESSON 5: التوبة والاعتراف =====
    'faith_5': {
        courtOfFaith: {
            title: 'محكمة الإيمان — ضرورة الاعتراف',
            icon: 'gavel',
            heretic: 'المعترض',
            hereticTitle: 'رافض الاعتراف للكاهن',
            defender: 'الكاهن',
            intro: 'حد بيقول: "أنا بعترف لربنا مباشرة! مش محتاج كاهن!" دافع عن سر الاعتراف.',
            rounds: [
                {
                    claim: 'أنا بعترف لربنا مباشرة! مش محتاج وسيط!',
                    evidence: [
                        { text: '"من غفرتم خطاياه تُغفر له ومن أمسكتم خطاياه أُمسكت" (يو ٢٠: ٢٣)', correct: true },
                        { text: 'المؤمنون في أعمال الرسل كانوا "يأتون مقرين ومخبرين بأفعالهم"', correct: true },
                        { text: '"الله غفور رحيم" — يعني مش محتاج كاهن', correct: false },
                        { text: '"صلوا بعضكم لأجل بعض" — يعني الصلاة كافية', correct: false }
                    ],
                    explanation: 'المسيح أعطى الكهنة سلطان الحل والربط — الاعتراف سر كنسي'
                },
                {
                    claim: 'ربنا سأل آدم "أين أنت؟" — يعني الله عارف خطايانا ومش محتاج نعترف!',
                    evidence: [
                        { text: 'سأله عشان يديه فرصة للاعتراف — مش عشان هو مش عارف', correct: true },
                        { text: 'قايين رفض يعترف فحُرم — الاعتراف أهم من المعرفة', correct: true },
                        { text: 'ربنا عارف كل حاجة فالاعتراف غير ضروري', correct: false },
                        { text: 'آدم اعتذر وخلاص', correct: false }
                    ],
                    explanation: 'الاعتراف فرصة للتوبة والعلاج — مش مجرد إخبار الله'
                }
            ]
        },
        creedBuilder: {
            title: 'بناء خطوات التوبة',
            icon: 'heart',
            blocks: [
                'الشعور بالخطية والندم',
                'فحص النفس ومحاسبتها',
                'العزم على عدم الرجوع',
                'الذهاب لأب الاعتراف',
                'الإقرار بالخطية بصدق',
                'عدم تبرير النفس',
                'عدم إلقاء اللوم على الآخرين',
                'سماع إرشاد الكاهن',
                'تنفيذ كلام أب الاعتراف',
                'نوال الحل من الكاهن',
                'التناول من جسد الرب ودمه',
                'الحياة الجديدة في المسيح'
            ]
        },
        councilJourney: {
            title: 'رحلة التوبة — الابن الضال',
            icon: 'heart',
            scenes: [
                {
                    id: 'start',
                    text: 'أنت الابن الضال. أخدت ميراثك وسافرت بلد بعيدة. صرفت كل حاجة. دلوقتي جعان وبترعى خنازير. إيه اللي هتعمله؟',
                    choices: [
                        { text: '"أقوم وأذهب إلى أبي وأقول له: أخطأت إلى السماء وقدامك"', next: 'return', points: 10, faith: 10 },
                        { text: 'أستمر في البلد البعيدة وأحاول لوحدي', next: 'stay', points: 2, faith: -5 },
                        { text: 'ألوم الظروف والناس', next: 'blame', points: 0, faith: -10 }
                    ]
                },
                {
                    id: 'return',
                    text: 'قومت ورحت لأبوك. وأنت لسه بعيد، أبوك شافك وجري ناحيتك وحضنك! إيه اللي هتقوله؟',
                    choices: [
                        { text: '"يا أبي أخطأت إلى السماء وقدامك ولست مستحقاً أن أُدعى لك ابناً"', next: 'forgiven', points: 10, faith: 10 },
                        { text: '"يا أبي أنا مش غلطان، الظروف هي السبب"', next: 'justify', points: 1, faith: -8 }
                    ]
                },
                {
                    id: 'stay',
                    text: 'البقاء في البعد مش حل. بتجوع أكتر. المخرج هو الرجوع للأب.',
                    choices: [
                        { text: 'فعلاً — أقوم وأرجع', next: 'return', points: 5, faith: 5 }
                    ]
                },
                {
                    id: 'blame',
                    text: 'قايين لوّم ربنا وقال "خطيتي أعظم من أن تُحتمل" — تبرير مش توبة. آدم لوّم حواء. اللوم مش حل.',
                    choices: [
                        { text: 'فهمت — لازم أعترف بغلطي أنا', next: 'return', points: 5, faith: 5 }
                    ]
                },
                {
                    id: 'justify',
                    text: 'التبرير مش اعتراف! آدم قال "المرأة هي السبب" وما اعترفش. التوبة الحقيقية = صدق بدون تبرير.',
                    choices: [
                        { text: '"يا أبي أنا أخطأت فعلاً"', next: 'forgiven', points: 5, faith: 5 }
                    ]
                },
                {
                    id: 'forgiven',
                    text: '🏆 أبوك فرح بيك! قال "ابني هذا كان ميتاً فعاش وكان ضالاً فوُجد". ألبسك الحلة الأولى وعمل فرح كبير! هكذا يكون فرح في السماء بخاطئ واحد يتوب!',
                    choices: [],
                    ending: true
                }
            ]
        },
        detective: {
            title: 'المحقق — شخصيات التوبة',
            icon: 'magnifying-glass',
            scenes: [
                {
                    setting: 'بيت في أورشليم',
                    objects: [
                        { name: 'دموع كتيرة', icon: 'tint', clue: 'بللت قدمي المسيح بدموعها' },
                        { name: 'طيب ثمين', icon: 'flask', clue: 'سكبت طيب على قدميه' },
                        { name: 'شعر طويل', icon: 'user', clue: 'مسحت قدميه بشعرها' },
                        { name: 'كلمة المسيح', icon: 'comment', clue: '"غُفرت لها خطاياها الكثيرة لأنها أحبت كثيراً"' }
                    ],
                    answer: 'المرأة الخاطئة التائبة',
                    hint: 'سكبت دموعها وطيبها على قدمي المسيح'
                },
                {
                    setting: 'شجرة جميزة في أريحا',
                    objects: [
                        { name: 'شجرة عالية', icon: 'tree', clue: 'طلع عليها عشان يشوف المسيح لأنه قصير' },
                        { name: 'أموال مسروقة', icon: 'coins', clue: 'كان عشّار يأخذ أكثر من الحق' },
                        { name: 'تعهد مكتوب', icon: 'file-contract', clue: '"أعطي نصف أموالي للمساكين ومن ظلمته أرد أربعة أضعاف"' },
                        { name: 'كلمة المسيح', icon: 'comment', clue: '"اليوم حصل خلاص لهذا البيت"' }
                    ],
                    answer: 'زكا العشار',
                    hint: 'عشّار تاب ورد ما أخذه أربعة أضعاف'
                }
            ]
        },
        balance: {
            title: 'ميزان التوبة',
            icon: 'balance-scale',
            statements: [
                { text: 'المسيح أعطى التلاميذ سلطان الحل والربط', answer: true, weight: 5 },
                { text: 'ممكن أعترف لربنا مباشرة بدون كاهن', answer: false, weight: 10 },
                { text: 'الكاهن وكيل على أسرار الله', answer: true, weight: 5 },
                { text: 'آدم اعترف بخطيته وتاب', answer: false, weight: 8 },
                { text: 'الاعتراف موجود من العهد القديم', answer: true, weight: 5 },
                { text: 'التبرير والدفاع عن النفس هو اعتراف صحيح', answer: false, weight: 10 },
                { text: 'المؤمنون في أعمال الرسل كانوا يعترفون شفاهياً', answer: true, weight: 5 },
                { text: 'الاعتراف مجرد تقليد بشري', answer: false, weight: 10 },
                { text: 'ربنا سأل آدم ليديه فرصة للاعتراف', answer: true, weight: 5 },
                { text: 'قايين اعترف بخطيته وربنا سامحه', answer: false, weight: 8 },
                { text: 'التوبة تحتاج صدق ومحاسبة نفس', answer: true, weight: 5 },
                { text: 'لازم ننفذ كلام أب الاعتراف', answer: true, weight: 5 },
                { text: 'الابن الضال رجع لأبوه واعترف', answer: true, weight: 5 },
                { text: 'إلقاء اللوم على الآخرين هو توبة حقيقية', answer: false, weight: 10 },
                { text: '"من غفرتم خطاياه تُغفر" قالها المسيح للتلاميذ', answer: true, weight: 5 }
            ]
        }
    }
};

// ============================================================
// GAME ENGINE 1: محكمة الإيمان (COURT OF FAITH)
// ============================================================
function startCourtOfFaith() {
    var games = getInteractiveGamesForLesson();
    if (!games || !games.courtOfFaith) return;
    var data = games.courtOfFaith;

    miniGameState = {
        type: 'courtOfFaith', index: 0, score: 0, total: data.rounds.length * 10,
        answers: [], timer: null, timeLeft: 0, data: data,
        faithMeter: 50, selectedEvidence: [], roundAnswered: false
    };

    renderCourtIntro(data);
}

function renderCourtIntro(data) {
    var html = '<div class="court-game">';
    html += '<div class="court-intro">';
    html += '<div class="court-vs">';
    html += '<div class="court-person court-heretic"><div class="court-avatar"><i class="fas fa-user-slash"></i></div><h4>' + data.heretic + '</h4><p>' + data.hereticTitle + '</p></div>';
    html += '<div class="court-versus">⚔️</div>';
    html += '<div class="court-person court-defender"><div class="court-avatar"><i class="fas fa-shield-alt"></i></div><h4>' + data.defender + '</h4><p>المدافع عن الإيمان</p></div>';
    html += '</div>';
    html += '<p class="court-intro-text">' + data.intro + '</p>';
    html += '<button class="btn btn-primary court-start-btn" onclick="renderCourtRound()"><span><i class="fas fa-gavel"></i> ابدأ المحاكمة!</span></button>';
    html += '</div></div>';

    renderMiniGameUI(data.title, data.icon, html);
}

function renderCourtRound() {
    var data = miniGameState.data;
    if (miniGameState.index >= data.rounds.length) {
        showCourtResult();
        return;
    }

    var round = data.rounds[miniGameState.index];
    var progress = (miniGameState.index + 1) + '/' + data.rounds.length;

    var html = '<div class="court-round">';
    // Faith meter
    html += '<div class="court-faith-meter"><div class="court-faith-label">ميزان الإيمان</div>';
    html += '<div class="court-faith-bar"><div class="court-faith-fill" id="court-faith-fill" style="width:' + miniGameState.faithMeter + '%"></div></div>';
    html += '<div class="court-faith-ends"><span>هرطقة</span><span>أرثوذكسية</span></div></div>';

    // Progress
    html += '<div class="mg-progress">' + progress + '</div>';

    // Heretic claim
    html += '<div class="court-claim"><div class="court-claim-icon"><i class="fas fa-exclamation-triangle"></i></div>';
    html += '<div class="court-claim-text">';
    html += '<strong>' + data.heretic + ':</strong> ' + round.claim;
    html += '</div></div>';

    // Evidence cards
    html += '<div class="court-evidence-title"><i class="fas fa-book-bible"></i> اختار الأدلة الصحيحة للرد:</div>';
    html += '<div class="court-evidence-grid">';
    var shuffled = round.evidence.slice();
    shuffleArray(shuffled);
    shuffled.forEach(function(ev, i) {
        html += '<div class="court-evidence-card" id="court-ev-' + i + '" onclick="selectCourtEvidence(' + i + ', ' + ev.correct + ')" data-correct="' + ev.correct + '">';
        html += '<i class="fas fa-' + (ev.correct ? 'book-bible' : 'question') + '"></i>';
        html += '<p>' + ev.text + '</p>';
        html += '</div>';
    });
    html += '</div>';

    // Confirm button
    html += '<div class="court-actions" id="court-actions" style="display:none">';
    html += '<button class="btn btn-primary" onclick="confirmCourtRound()"><span><i class="fas fa-check"></i> ثبّت ردك</span></button>';
    html += '</div>';

    html += '</div>';

    var body = document.getElementById('mg-body');
    if (body) body.innerHTML = html;
}

function selectCourtEvidence(idx, isCorrect) {
    if (miniGameState.roundAnswered) return;

    var card = document.getElementById('court-ev-' + idx);
    if (!card) return;

    if (card.classList.contains('selected')) {
        card.classList.remove('selected');
        return;
    }
    card.classList.add('selected');

    // Show confirm button
    var actions = document.getElementById('court-actions');
    if (actions) actions.style.display = 'flex';
}

function confirmCourtRound() {
    if (miniGameState.roundAnswered) return;
    miniGameState.roundAnswered = true;

    var cards = document.querySelectorAll('.court-evidence-card');
    var correctSelected = 0;
    var wrongSelected = 0;

    cards.forEach(function(card) {
        var isCorrect = card.getAttribute('data-correct') === 'true';
        var isSelected = card.classList.contains('selected');

        if (isSelected && isCorrect) {
            card.classList.add('court-correct');
            correctSelected++;
        } else if (isSelected && !isCorrect) {
            card.classList.add('court-wrong');
            wrongSelected++;
        } else if (!isSelected && isCorrect) {
            card.classList.add('court-missed');
        }
        card.onclick = null;
    });

    // Score calculation
    var roundScore = Math.max(0, (correctSelected * 5) - (wrongSelected * 3));
    miniGameState.score += roundScore;
    miniGameState.faithMeter = Math.min(100, Math.max(0, miniGameState.faithMeter + (correctSelected * 10) - (wrongSelected * 15)));
    updateMGScore();

    // Animate faith meter
    var fill = document.getElementById('court-faith-fill');
    if (fill) fill.style.width = miniGameState.faithMeter + '%';

    // Show explanation
    var round = miniGameState.data.rounds[miniGameState.index];
    var actions = document.getElementById('court-actions');
    if (actions) {
        actions.innerHTML = '<div class="court-explanation"><i class="fas fa-lightbulb"></i> ' + round.explanation + '</div>' +
            '<button class="btn btn-primary" onclick="nextCourtRound()"><span><i class="fas fa-arrow-left"></i> التالي</span></button>';
    }

    showAnswerFeedback(correctSelected > wrongSelected);
    if (correctSelected > 0) { if (typeof playCorrectSound === 'function') playCorrectSound(); vibrate(50); }
    else { if (typeof playWrongSound === 'function') playWrongSound(); }
}

function nextCourtRound() {
    miniGameState.index++;
    miniGameState.roundAnswered = false;
    renderCourtRound();
}

function showCourtResult() {
    saveMiniGameScore('courtOfFaith', miniGameState.score);

    var pct = miniGameState.total > 0 ? Math.round((miniGameState.score / miniGameState.total) * 100) : 0;
    var emoji = pct >= 90 ? '⚖️' : (pct >= 60 ? '🛡️' : '💪');
    var message = pct >= 90 ? 'مدافع عظيم عن الإيمان!' : (pct >= 60 ? 'دفاع جيد! كمّل!' : 'حاول تاني — اقرأ الدرس وارجع!');

    showMiniGameResult('محكمة الإيمان');
}

// ============================================================
// GAME ENGINE 2: بناء العقيدة (CREED BUILDER)
// ============================================================
function startCreedBuilder() {
    var games = getInteractiveGamesForLesson();
    if (!games || !games.creedBuilder) return;
    var data = games.creedBuilder;

    miniGameState = {
        type: 'creedBuilder', index: 0, score: 0, total: data.blocks.length * 3,
        answers: [], timer: null, timeLeft: 60, data: data,
        placedBlocks: [], availableBlocks: []
    };

    // Shuffle blocks for the player
    var shuffled = data.blocks.map(function(b, i) { return { text: b, correctIndex: i }; });
    shuffleArray(shuffled);
    miniGameState.availableBlocks = shuffled;

    renderCreedBuilder(data);
}

function renderCreedBuilder(data) {
    var html = '<div class="creed-game">';
    html += '<div class="creed-title"><i class="fas fa-' + data.icon + '"></i> ' + data.title + '</div>';

    // Timer
    html += '<div class="creed-timer"><div class="mg-timer-bar"><div class="mg-timer-fill" id="creed-timer-fill" style="width:100%"></div></div></div>';

    // Building area (drop zone)
    html += '<div class="creed-building" id="creed-building">';
    html += '<div class="creed-building-label"><i class="fas fa-arrow-down"></i> رتّب العبارات بالترتيب الصح</div>';
    for (var i = 0; i < data.blocks.length; i++) {
        html += '<div class="creed-slot" id="creed-slot-' + i + '" data-index="' + i + '" onclick="removeCreedBlock(' + i + ')">';
        html += '<span class="creed-slot-num">' + (i + 1) + '</span>';
        html += '<span class="creed-slot-text" id="creed-slot-text-' + i + '"></span>';
        html += '</div>';
    }
    html += '</div>';

    // Available blocks (source)
    html += '<div class="creed-blocks" id="creed-blocks">';
    miniGameState.availableBlocks.forEach(function(block, i) {
        html += '<div class="creed-block" id="creed-avail-' + i + '" onclick="placeCreedBlock(' + i + ')">' + block.text + '</div>';
    });
    html += '</div>';

    // Check button
    html += '<button class="btn btn-primary creed-check-btn" onclick="checkCreedBuilder()" style="width:100%;margin-top:12px"><span><i class="fas fa-check"></i> تحقق من الترتيب</span></button>';

    html += '</div>';

    renderMiniGameUI(data.title, data.icon, html);
    startCreedTimer();
}

function startCreedTimer() {
    miniGameState.timeLeft = 60;
    if (miniGameState.timer) clearInterval(miniGameState.timer);
    miniGameState.timer = setInterval(function() {
        miniGameState.timeLeft -= 0.1;
        var fill = document.getElementById('creed-timer-fill');
        if (fill) fill.style.width = Math.max(0, (miniGameState.timeLeft / 60) * 100) + '%';
        if (miniGameState.timeLeft <= 0) {
            clearInterval(miniGameState.timer);
            checkCreedBuilder();
        }
    }, 100);
}

function placeCreedBlock(availIdx) {
    var block = miniGameState.availableBlocks[availIdx];
    if (!block || block.placed) return;

    // Find first empty slot
    var slotIdx = miniGameState.placedBlocks.length;
    if (slotIdx >= miniGameState.data.blocks.length) return;

    miniGameState.placedBlocks.push(availIdx);
    block.placed = true;

    // Update UI
    var slotText = document.getElementById('creed-slot-text-' + slotIdx);
    var slot = document.getElementById('creed-slot-' + slotIdx);
    if (slotText) slotText.textContent = block.text;
    if (slot) slot.classList.add('filled');

    var avail = document.getElementById('creed-avail-' + availIdx);
    if (avail) avail.classList.add('used');
}

function removeCreedBlock(slotIdx) {
    if (slotIdx >= miniGameState.placedBlocks.length) return;

    // Remove this block and shift everything after it
    var removed = miniGameState.placedBlocks.splice(slotIdx, 1)[0];
    miniGameState.availableBlocks[removed].placed = false;

    // Re-render placed blocks
    var data = miniGameState.data;
    for (var i = 0; i < data.blocks.length; i++) {
        var slotText = document.getElementById('creed-slot-text-' + i);
        var slot = document.getElementById('creed-slot-' + i);
        if (i < miniGameState.placedBlocks.length) {
            var aIdx = miniGameState.placedBlocks[i];
            if (slotText) slotText.textContent = miniGameState.availableBlocks[aIdx].text;
            if (slot) slot.classList.add('filled');
        } else {
            if (slotText) slotText.textContent = '';
            if (slot) slot.classList.remove('filled');
        }
    }

    // Re-render available
    var avail = document.getElementById('creed-avail-' + removed);
    if (avail) avail.classList.remove('used');
}

function checkCreedBuilder() {
    if (miniGameState.timer) clearInterval(miniGameState.timer);

    var data = miniGameState.data;
    var correct = 0;

    for (var i = 0; i < data.blocks.length; i++) {
        var slot = document.getElementById('creed-slot-' + i);
        if (i < miniGameState.placedBlocks.length) {
            var aIdx = miniGameState.placedBlocks[i];
            var block = miniGameState.availableBlocks[aIdx];
            if (block.correctIndex === i) {
                correct++;
                if (slot) slot.classList.add('creed-correct');
            } else {
                if (slot) slot.classList.add('creed-wrong');
            }
        } else {
            if (slot) slot.classList.add('creed-wrong');
        }
    }

    miniGameState.score = correct * 3;
    updateMGScore();

    showAnswerFeedback(correct >= data.blocks.length * 0.7);
    if (correct >= data.blocks.length * 0.7) {
        if (typeof playCorrectSound === 'function') playCorrectSound();
    }

    setTimeout(function() {
        showMiniGameResult('بناء العقيدة');
    }, 1500);
}

// ============================================================
// GAME ENGINE 3: رحلة المجامع (COUNCIL JOURNEY)
// ============================================================
function startCouncilJourney() {
    var games = getInteractiveGamesForLesson();
    if (!games || !games.councilJourney) return;
    var data = games.councilJourney;

    miniGameState = {
        type: 'councilJourney', index: 0, score: 0, total: 50,
        answers: [], timer: null, timeLeft: 0, data: data,
        faithMeter: 50, currentScene: data.scenes[0].id, path: [], scenesVisited: 0
    };

    renderCouncilScene(data.scenes[0]);
}

function renderCouncilScene(scene) {
    if (!scene) return;
    miniGameState.currentScene = scene.id;
    miniGameState.scenesVisited++;

    var data = miniGameState.data;
    var html = '<div class="council-game">';

    // Faith meter
    html += '<div class="court-faith-meter"><div class="court-faith-label"><i class="fas fa-' + data.icon + '"></i> ' + data.title + '</div>';
    html += '<div class="court-faith-bar"><div class="court-faith-fill" style="width:' + miniGameState.faithMeter + '%"></div></div>';
    html += '<div class="court-faith-ends"><span>ضعيف</span><span>قوي</span></div></div>';

    // Scene text
    html += '<div class="council-scene">';
    if (scene.character) {
        html += '<div class="council-character"><i class="fas fa-user-shield"></i></div>';
    }
    html += '<div class="council-text">' + scene.text + '</div>';

    // Choices
    if (scene.choices && scene.choices.length > 0) {
        html += '<div class="council-choices">';
        scene.choices.forEach(function(choice, i) {
            html += '<button class="council-choice-btn" onclick="makeCouncilChoice(\'' + choice.next + '\',' + choice.points + ',' + choice.faith + ')">';
            html += '<span class="council-choice-text">' + choice.text + '</span>';
            html += '</button>';
        });
        html += '</div>';
    } else if (scene.ending) {
        // Ending scene
        html += '<div class="council-ending">';
        html += '<button class="btn btn-primary" onclick="finishCouncilJourney()"><span><i class="fas fa-flag-checkered"></i> النتيجة</span></button>';
        html += '</div>';
    }

    html += '</div></div>';

    var body = document.getElementById('mg-body');
    if (body) {
        body.innerHTML = html;
        body.scrollTop = 0;
    } else {
        renderMiniGameUI(data.title, data.icon, html);
    }
}

function makeCouncilChoice(nextId, points, faith) {
    miniGameState.score += points;
    miniGameState.faithMeter = Math.min(100, Math.max(0, miniGameState.faithMeter + faith));
    miniGameState.path.push(nextId);
    updateMGScore();

    if (points >= 8) {
        showAnswerFeedback(true);
        if (typeof playCorrectSound === 'function') playCorrectSound();
        vibrate(50);
    } else if (points <= 2) {
        showAnswerFeedback(false);
        if (typeof playWrongSound === 'function') playWrongSound();
    }

    // Find next scene
    var scenes = miniGameState.data.scenes;
    var next = null;
    for (var i = 0; i < scenes.length; i++) {
        if (scenes[i].id === nextId) { next = scenes[i]; break; }
    }

    setTimeout(function() {
        if (next) renderCouncilScene(next);
        else finishCouncilJourney();
    }, 800);
}

function finishCouncilJourney() {
    // Cap score at total
    miniGameState.score = Math.min(miniGameState.score, miniGameState.total);
    showMiniGameResult('رحلة المجامع');
}

// ============================================================
// GAME ENGINE 4: المحقق (DETECTIVE)
// ============================================================
function startDetective() {
    var games = getInteractiveGamesForLesson();
    if (!games || !games.detective) return;
    var data = games.detective;

    miniGameState = {
        type: 'detective', index: 0, score: 0, total: data.scenes.length * 10,
        answers: [], timer: null, timeLeft: 0, data: data,
        cluesFound: [], maxPoints: 10, guessSubmitted: false
    };

    renderDetectiveScene();
}

function renderDetectiveScene() {
    var data = miniGameState.data;
    if (miniGameState.index >= data.scenes.length) {
        showMiniGameResult('المحقق');
        return;
    }

    var scene = data.scenes[miniGameState.index];
    miniGameState.cluesFound = [];
    miniGameState.maxPoints = 10;
    miniGameState.guessSubmitted = false;

    var progress = (miniGameState.index + 1) + '/' + data.scenes.length;

    var html = '<div class="detective-game">';
    html += '<div class="mg-progress">' + progress + '</div>';

    // Setting
    html += '<div class="detective-setting">';
    html += '<div class="detective-setting-icon"><i class="fas fa-map-marker-alt"></i></div>';
    html += '<h4>' + scene.setting + '</h4>';
    html += '</div>';

    // Points indicator
    html += '<div class="detective-points" id="detective-points"><i class="fas fa-star"></i> نقاط متاحة: <strong>' + miniGameState.maxPoints + '</strong></div>';

    // Objects to investigate
    html += '<div class="detective-objects">';
    scene.objects.forEach(function(obj, i) {
        html += '<div class="detective-object" id="det-obj-' + i + '" onclick="investigateObject(' + i + ')">';
        html += '<div class="detective-obj-icon"><i class="fas fa-' + obj.icon + '"></i></div>';
        html += '<div class="detective-obj-name">' + obj.name + '</div>';
        html += '<div class="detective-obj-clue" id="det-clue-' + i + '" style="display:none">' + obj.clue + '</div>';
        html += '</div>';
    });
    html += '</div>';

    // Guess area
    html += '<div class="detective-guess" id="detective-guess" style="display:none">';
    html += '<div class="detective-guess-label"><i class="fas fa-lightbulb"></i> مين/إيه الإجابة؟</div>';
    html += '<input type="text" class="detective-input" id="detective-answer" placeholder="اكتب إجابتك..." autocomplete="off">';
    html += '<div class="detective-hint" id="detective-hint" style="display:none"><i class="fas fa-info-circle"></i> تلميح: ' + scene.hint + '</div>';
    html += '<div class="detective-guess-btns">';
    html += '<button class="btn btn-primary" onclick="submitDetectiveGuess()"><span><i class="fas fa-check"></i> تأكيد</span></button>';
    html += '<button class="btn btn-secondary" onclick="showDetectiveHint()"><span><i class="fas fa-question"></i> تلميح (-3 نقاط)</span></button>';
    html += '</div></div>';

    html += '</div>';

    var body = document.getElementById('mg-body');
    if (body) body.innerHTML = html;
    else renderMiniGameUI(data.title, data.icon, html);
}

function investigateObject(idx) {
    if (miniGameState.guessSubmitted) return;
    var clue = document.getElementById('det-clue-' + idx);
    var obj = document.getElementById('det-obj-' + idx);
    if (!clue || !obj) return;

    if (miniGameState.cluesFound.indexOf(idx) === -1) {
        miniGameState.cluesFound.push(idx);
        // Each clue after the first reduces max points
        if (miniGameState.cluesFound.length > 1) {
            miniGameState.maxPoints = Math.max(3, miniGameState.maxPoints - 2);
            var pts = document.getElementById('detective-points');
            if (pts) pts.innerHTML = '<i class="fas fa-star"></i> نقاط متاحة: <strong>' + miniGameState.maxPoints + '</strong>';
        }
    }

    clue.style.display = 'block';
    obj.classList.add('investigated');
    vibrate(30);

    // Show guess area after at least 2 clues
    if (miniGameState.cluesFound.length >= 2) {
        var guess = document.getElementById('detective-guess');
        if (guess) guess.style.display = 'block';
    }
}

function showDetectiveHint() {
    miniGameState.maxPoints = Math.max(1, miniGameState.maxPoints - 3);
    var pts = document.getElementById('detective-points');
    if (pts) pts.innerHTML = '<i class="fas fa-star"></i> نقاط متاحة: <strong>' + miniGameState.maxPoints + '</strong>';

    var hint = document.getElementById('detective-hint');
    if (hint) hint.style.display = 'block';
}

function submitDetectiveGuess() {
    if (miniGameState.guessSubmitted) return;
    miniGameState.guessSubmitted = true;

    var scene = miniGameState.data.scenes[miniGameState.index];
    var input = document.getElementById('detective-answer');
    var userAnswer = input ? input.value.trim() : '';

    // Fuzzy match: check if answer contains key words
    var correct = false;
    var answerWords = scene.answer.split(/[\s—\-\/]+/);
    var matchCount = 0;
    answerWords.forEach(function(word) {
        if (word.length > 2 && userAnswer.indexOf(word) !== -1) matchCount++;
    });
    if (matchCount >= Math.ceil(answerWords.length * 0.4) || userAnswer.length > 3 && scene.answer.indexOf(userAnswer) !== -1) {
        correct = true;
    }

    if (correct) {
        miniGameState.score += miniGameState.maxPoints;
        updateMGScore();
        showAnswerFeedback(true);
        if (typeof playCorrectSound === 'function') playCorrectSound();
    } else {
        showAnswerFeedback(false);
        if (typeof playWrongSound === 'function') playWrongSound();
    }

    // Show correct answer
    var guess = document.getElementById('detective-guess');
    if (guess) {
        guess.innerHTML = '<div class="detective-result ' + (correct ? 'correct' : 'wrong') + '">' +
            '<div class="detective-result-icon">' + (correct ? '✅' : '❌') + '</div>' +
            '<div class="detective-result-text">' + (correct ? 'صح! ' : 'الإجابة الصحيحة: ') + scene.answer + '</div>' +
            '</div>' +
            '<button class="btn btn-primary" onclick="nextDetectiveScene()" style="margin-top:12px"><span><i class="fas fa-arrow-left"></i> التالي</span></button>';
    }
}

function nextDetectiveScene() {
    miniGameState.index++;
    renderDetectiveScene();
}

// ============================================================
// GAME ENGINE 5: الميزان (THE BALANCE)
// ============================================================
function startBalance() {
    var games = getInteractiveGamesForLesson();
    if (!games || !games.balance) return;
    var data = games.balance;

    var stmts = data.statements.slice();
    shuffleArray(stmts);
    stmts = stmts.slice(0, 15); // Pick 15

    miniGameState = {
        type: 'balance', index: 0, score: 0, total: stmts.length * 3,
        answers: [], timer: null, timeLeft: 0, data: stmts,
        balanceValue: 50, streak: 0
    };

    renderBalanceCard();
}

function renderBalanceCard() {
    var data = miniGameState.data;
    if (miniGameState.index >= data.length) {
        showMiniGameResult('ميزان الإيمان');
        return;
    }

    var stmt = data[miniGameState.index];
    var progress = (miniGameState.index + 1) + '/' + data.length;

    var html = '<div class="balance-game">';

    // Balance visual
    var angle = (miniGameState.balanceValue - 50) * 0.6; // -30 to +30 degrees
    html += '<div class="balance-scale-wrap">';
    html += '<div class="balance-pivot"><i class="fas fa-balance-scale"></i></div>';
    html += '<div class="balance-beam" id="balance-beam" style="transform:rotate(' + angle + 'deg)">';
    html += '<div class="balance-side balance-heresy"><span>هرطقة</span></div>';
    html += '<div class="balance-side balance-orthodox"><span>أرثوذكسية</span></div>';
    html += '</div>';
    html += '<div class="balance-value" id="balance-value">' + miniGameState.balanceValue + '%</div>';
    html += '</div>';

    // Progress and streak
    html += '<div class="balance-info">';
    html += '<div class="mg-progress">' + progress + '</div>';
    if (miniGameState.streak > 1) {
        html += '<div class="balance-streak"><i class="fas fa-fire"></i> ' + miniGameState.streak + 'x</div>';
    }
    html += '</div>';

    // Statement card
    html += '<div class="balance-card" id="balance-card">';
    html += '<div class="balance-stmt">' + stmt.text + '</div>';
    html += '</div>';

    // Swipe buttons
    html += '<div class="balance-buttons">';
    html += '<button class="balance-btn balance-btn-false" onclick="answerBalance(false)">';
    html += '<i class="fas fa-times"></i> غلط';
    html += '</button>';
    html += '<button class="balance-btn balance-btn-true" onclick="answerBalance(true)">';
    html += '<i class="fas fa-check"></i> صح';
    html += '</button>';
    html += '</div>';

    html += '</div>';

    var body = document.getElementById('mg-body');
    if (body) body.innerHTML = html;
    else renderMiniGameUI('ميزان الإيمان', 'balance-scale', html);

    // Add swipe support
    setTimeout(function() {
        var card = document.getElementById('balance-card');
        if (!card) return;
        var startX = 0;
        card.addEventListener('touchstart', function(e) { startX = e.touches[0].clientX; }, { passive: true });
        card.addEventListener('touchend', function(e) {
            var diff = e.changedTouches[0].clientX - startX;
            if (Math.abs(diff) > 60) {
                answerBalance(diff > 0); // Swipe right = true, left = false
            }
        }, { passive: true });
    }, 100);
}

function answerBalance(userAnswer) {
    var stmt = miniGameState.data[miniGameState.index];
    var correct = (userAnswer === stmt.answer);

    var card = document.getElementById('balance-card');
    if (card) {
        card.classList.add(correct ? 'balance-correct' : 'balance-wrong');
        card.style.transform = 'translateX(' + (userAnswer ? '80px' : '-80px') + ') rotate(' + (userAnswer ? '8' : '-8') + 'deg)';
        card.style.opacity = '0.5';
    }

    if (correct) {
        miniGameState.streak++;
        var points = Math.min(3 + miniGameState.streak, 5); // Streak bonus
        miniGameState.score += points;
        miniGameState.balanceValue = Math.min(100, miniGameState.balanceValue + stmt.weight);
        if (typeof playCorrectSound === 'function') playCorrectSound();
        vibrate(50);
    } else {
        miniGameState.streak = 0;
        miniGameState.balanceValue = Math.max(0, miniGameState.balanceValue - stmt.weight);
        if (typeof playWrongSound === 'function') playWrongSound();
        vibrate([50, 30, 50]);
    }

    updateMGScore();

    // Animate balance
    var beam = document.getElementById('balance-beam');
    var valEl = document.getElementById('balance-value');
    if (beam) {
        var angle = (miniGameState.balanceValue - 50) * 0.6;
        beam.style.transform = 'rotate(' + angle + 'deg)';
    }
    if (valEl) valEl.textContent = miniGameState.balanceValue + '%';

    showAnswerFeedback(correct);

    miniGameState.index++;
    setTimeout(renderBalanceCard, 900);
}

// ============================================================
// HELPER: Get interactive games for current lesson
// ============================================================
function getInteractiveGamesForLesson() {
    var key = level2State.currentSubject + '_' + level2State.currentLesson;
    return INTERACTIVE_GAMES[key] || null;
}

// ============================================================
// UPDATE: saveMiniGameScore to include new game types
// ============================================================
(function() {
    var origSaveMiniGameScore = saveMiniGameScore;
    saveMiniGameScore = function(type, score) {
        // Add new game types to the calculation
        var newTypes = ['courtOfFaith', 'creedBuilder', 'councilJourney', 'detective', 'balance'];
        origSaveMiniGameScore(type, score);

        // If it's a new game type, also recalculate total
        if (newTypes.indexOf(type) !== -1) {
            var stationKey = getStationKey();
            var totalGamesScore = 0;
            var allTypes = ['trueFalse', 'whoAmI', 'sortVerse', 'fillBlank', 'matchPairs', 'characters', 'mixedChallenge',
                            'courtOfFaith', 'creedBuilder', 'councilJourney', 'detective', 'balance'];
            allTypes.forEach(function(gt) {
                var k = stationKey + '_mg_' + gt;
                var s = GameState.miniGameScores[k] || 0;
                if (gt === 'mixedChallenge') {
                    totalGamesScore = Math.max(totalGamesScore, Math.min(s, STATION_GAMES_MAX));
                } else {
                    totalGamesScore += s;
                }
            });
            totalGamesScore = Math.min(totalGamesScore, STATION_GAMES_MAX);
            updateStationScore(stationKey, 'games', totalGamesScore);
            liveRefreshStationProgress();
        }
    };
})();
