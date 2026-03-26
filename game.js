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
    watchedVideos: {}         // { 'faith_lesson_0_video': true, ... }
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

// --- Registration & Login ---
function submitRegister() {
    var name = document.getElementById('player-name').value.trim();
    var year = document.getElementById('player-year').value;
    var phone = document.getElementById('player-phone').value.trim();
    var rememberMe = document.getElementById('remember-me').checked;

    // Validate inputs
    if (!name || name.length < 2) { showToast('اكتب اسمك يا بطل (حرفين على الأقل)', 'error'); return; }
    if (!year) { showToast('اختار السنة الدراسية', 'error'); return; }
    if (!phone || !/^01\d{9}$/.test(phone)) { showToast('اكتب رقم تليفون صحيح (01xxxxxxxxx)', 'error'); return; }

    var btn = document.getElementById('btn-register');
    btn.disabled = true;
    btn.innerHTML = '<span><i class="fas fa-spinner fa-spin"></i> جاري التحقق...</span>';

    if (!firebaseDb) {
        showToast('مفيش اتصال بالسيرفر، حاول تاني', 'error');
        resetRegisterBtn(btn);
        return;
    }

    // Step 1: Check if phone already exists
    firebaseDb.collection('players').where('playerPhone', '==', phone).get()
        .then(function(phoneSnapshot) {
            if (!phoneSnapshot.empty) {
                // Phone exists — this is a login attempt
                var existingData = phoneSnapshot.docs[0].data();
                if (existingData.playerName !== name) {
                    showToast('الرقم ده مسجل باسم تاني', 'error');
                    resetRegisterBtn(btn);
                    return;
                }
                // Name matches — login successfully
                Object.keys(existingData).forEach(function(key) {
                    if (key in GameState && key !== 'lastUpdated') {
                        GameState[key] = existingData[key];
                    }
                });
                GameState.playerName = name;
                GameState.playerPhone = phone;
                GameState.academicYear = existingData.academicYear || year;
                handleRememberMe(rememberMe, phone);
                showToast('أهلاً بيك تاني يا بطل!', 'success');
                showScreen('home-hub-screen');
                syncLeaderboard();
                requestNotificationsAfterLogin();
                checkPendingRoomJoin();
                return;
            }

            // Step 2: Phone doesn't exist — check if name is unique
            firebaseDb.collection('players').where('playerName', '==', name).get()
                .then(function(nameSnapshot) {
                    if (!nameSnapshot.empty) {
                        showToast('الاسم ده مستخدم قبل كده، اختار اسم تاني', 'error');
                        resetRegisterBtn(btn);
                        return;
                    }

                    // Step 3: Both unique — new registration
                    GameState.playerName = name;
                    GameState.playerPhone = phone;
                    GameState.academicYear = year;
                    handleRememberMe(rememberMe, phone);
                    saveToCloud();
                    showToast('تم التسجيل بنجاح!', 'success');
                    showScreen('character-screen');
                    requestNotificationsAfterLogin();
                })
                .catch(function(err) {
                    console.error('Name check error:', err);
                    showToast('حصل مشكلة، حاول تاني', 'error');
                    resetRegisterBtn(btn);
                });
        })
        .catch(function(err) {
            console.error('Phone check error:', err);
            showToast('حصل مشكلة، حاول تاني', 'error');
            resetRegisterBtn(btn);
        });
}

function resetRegisterBtn(btn) {
    if (!btn) btn = document.getElementById('btn-register');
    btn.disabled = false;
    btn.innerHTML = '<span>يلا نبدأ <i class="fas fa-arrow-left"></i></span>';
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
                Object.keys(data).forEach(key => {
                    if (key in GameState && key !== 'lastUpdated') {
                        GameState[key] = data[key];
                    }
                });
                console.log('Game loaded from cloud for', phone);
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
        unlocked: true
    },
    philomena: {
        name: 'فيلومينا الأمينة',
        emoji: '⚓',
        color: '#F5A0B8',
        image: 'images/philomena-opt.jpg',
        role: 'القديسة الأمينة حتى الموت',
        ability: 'إيمان ثابت - حماية من الخطأ',
        unlocked: true
    },
    paul: {
        name: 'بولس الرسول',
        emoji: '✉️',
        color: '#7B5EA7',
        image: 'images/paul-opt.jpg',
        role: 'رسول الأمم وكاتب الرسائل',
        ability: 'سيف الروح - كشف الإجابة',
        cost: 30,
        unlocked: false
    },
    george: {
        name: 'مارجرجس الروماني',
        emoji: '🐴',
        color: '#D4461A',
        image: 'images/george-opt.jpg',
        role: 'الشهيد الشجاع قاتل التنين',
        ability: 'رمح النصر - نقاط إضافية',
        cost: 50,
        unlocked: false
    }
};

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
        x: 25, y: 15,
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
    var fabScreens = ['map-screen','category-screen','shop-screen','leaderboard-screen','settings-screen','lamp-screen'];
    var fab = document.getElementById('fab-container');
    if (fab) fab.style.display = fabScreens.indexOf(id) >= 0 ? 'flex' : 'none';
    // Hide lamp fixed element when leaving lamp screen
    var lampBottom = document.getElementById('lamp-fixed-bottom');
    if (lampBottom) lampBottom.style.display = (id === 'lamp-screen') ? 'block' : 'none';
    if (id === 'home-hub-screen') { renderHomeHub(); updateSpiritualBadges(); }
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
        var card = document.createElement('div');
        card.className = 'char-card' + (key === GameState.character ? ' selected' : '') + (ch.unlocked ? '' : ' locked');
        var inner = '<div class="char-avatar-wrap"><img class="char-img" src="'+ch.image+'" alt="'+ch.name+'" onerror="this.style.display=\'none\'"></div>';
        inner += '<h3>' + ch.name + '</h3>';
        inner += '<p class="char-role">' + ch.role + '</p>';
        inner += '<p class="char-ability"><i class="fas fa-star"></i> ' + ch.ability + '</p>';
        if (!ch.unlocked) inner += '<div class="char-lock"><i class="fas fa-lock"></i> ' + (ch.cost||0) + ' ⭐</div>';
        card.innerHTML = inner;
        (function(k, c, el) {
            el.onclick = function() {
                if (!CHARACTERS[k].unlocked) {
                    if (GameState.stars >= (CHARACTERS[k].cost||0)) {
                        CHARACTERS[k].unlocked = true;
                        GameState.stars -= (CHARACTERS[k].cost||0);
                        showToast('تم فتح ' + CHARACTERS[k].name);
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
function renderShop() {
    document.getElementById('shop-gems').textContent = GameState.gems;
    // Show character preview
    var shopAvatar = document.getElementById('shop-avatar-img');
    var shopCh = CHARACTERS[GameState.character];
    if (shopAvatar && shopCh) { shopAvatar.src = shopCh.image; shopAvatar.alt = shopCh.name; }
    var grid = document.getElementById('shop-items-grid');
    grid.innerHTML = '';
    Object.entries(ARMOR_ITEMS).forEach(function(entry) {
        var key = entry[0], item = entry[1];
        var owned = GameState.armor.indexOf(key) >= 0;
        var equipped = GameState.equippedArmor[item.slot] === key;
        var card = document.createElement('div');
        card.className = 'shop-item-card' + (owned ? ' owned' : '') + (equipped ? ' equipped' : '');
        card.innerHTML = '<div class="shop-item-icon">'+item.icon+'</div><h3>'+item.name+'</h3><p class="shop-item-desc">'+item.desc+'</p><p class="shop-item-verse">"'+item.verse+'"</p>' +
            (owned ? (equipped ? '<span class="shop-badge equipped-badge">مُجهّز ✓</span>' : '<button class="btn btn-small btn-primary equip-btn">تجهيز</button>') :
            '<button class="btn btn-small btn-gold buy-btn">💎 '+item.cost+' شراء</button>');
        if (!owned) {
            card.querySelector('.buy-btn').onclick = function() { buyArmor(key); };
        } else if (!equipped) {
            card.querySelector('.equip-btn').onclick = function() { equipArmor(key); };
        }
        grid.appendChild(card);
    });
}

function buyArmor(key) {
    var item = ARMOR_ITEMS[key];
    if (GameState.gems < item.cost) { showToast('محتاج ' + item.cost + ' جوهرة!'); return; }
    GameState.gems -= item.cost;
    GameState.armor.push(key);
    showToast('🛡️ اشتريت ' + item.name + '!');
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
            character: p.character || 'david'
        };
    });
    var meExists = allPlayers.find(function(p) { return p.phone === GameState.playerPhone; });
    if (!meExists && GameState.playerName) {
        allPlayers.push({ name: GameState.playerName, phone: GameState.playerPhone, stars: GameState.stars, streak: GameState.bestStreak, gems: GameState.gems, level: GameState.currentLevel, character: GameState.character });
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
        }
    });

    var sortKey = currentLBTab === 'stars' ? 'stars' : currentLBTab === 'streak' ? 'streak' : currentLBTab === 'gems' ? 'gems' : 'level';
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

    // 4th+ as list items
    allPlayers.slice(3, 20).forEach(function(p, i) {
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
    renderLeaderboardList();
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
    // Clear remember me
    try { localStorage.removeItem('minElBatal_remember'); } catch(e) {}
    // Reset login form
    var nameInput = document.getElementById('player-name');
    var phoneInput = document.getElementById('player-phone');
    var yearSelect = document.getElementById('player-year');
    if (nameInput) nameInput.value = '';
    if (phoneInput) phoneInput.value = '';
    if (yearSelect) yearSelect.selectedIndex = 0;
    resetRegisterBtn();
    showScreen('splash-screen');
    showToast('تم تسجيل الخروج');
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
        name: 'إيماننا الأرثوذوكسي',
        desc: 'لاهوت وعقيدة',
        icon: '✝️',
        color: '#e74c3c',
        mapImage: 'images/level2-full-bg-opt.jpg',
        lessons: [
            {
                name: 'التثليث والتوحيد',
                desc: 'عقيدة الإله الواحد المثلث الأقانيم',
                verse: '"فاذهبوا وتلمذوا جميع الأمم وعمدوهم باسم الآب والابن والروح القدس" (مت ٢٨: ١٩)',
                videoId: 'V8MqXGOyJqE',
                videoTitle: 'عقيدة الثالوث - أبونا داود لمعي',
                content: 'نؤمن بإله واحد في ثلاثة أقانيم: الآب والابن والروح القدس. الأقنوم كلمة سريانية معناها صفة أو خاصية يقوم عليها الكيان الإلهي. الآب هو وجود الله، والابن هو عقل ونطق الله (اللوجوس)، والروح القدس هو خاصية الحياة. الجوهر الإلهي واحد لكن الخواص ثلاثة. مش بنقول 1+1+1 لكن 1×1×1 والنتيجة واحد صحيح.',
                questions: [
                    { q: 'كم عدد أقانيم الثالوث القدوس؟', options: ['٢', '٣', '٤', '١'], correct: 1 },
                    { q: 'كلمة "أقنوم" هي كلمة...', options: ['يونانية', 'عربية', 'سريانية', 'قبطية'], correct: 2 },
                    { q: 'معنى كلمة أقنوم في اللاهوت هو...', options: ['جزء من الله', 'صفة يقوم عليها الكيان الإلهي', 'إله مستقل', 'ملاك'], correct: 1 },
                    { q: 'أقنوم الابن يُسمى أيضاً...', options: ['الروح', 'اللوجوس (الكلمة)', 'الوجود', 'الحياة'], correct: 1 },
                    { q: 'الروح القدس هو خاصية...', options: ['الوجود', 'النطق والعقل', 'الحياة', 'القوة'], correct: 2 },
                    { q: 'هل الثالوث يعني ثلاثة آلهة؟', options: ['نعم', 'أحياناً', 'لا، إله واحد', 'غير محدد'], correct: 2 },
                    { q: 'من صفات الإله أنه...', options: ['مخلوق', 'محدود', 'أزلي وغير مخلوق', 'ضعيف'], correct: 2 },
                    { q: '"أنا الرب وليس آخر. لا إله سواي" في أي سفر؟', options: ['التكوين', 'إشعياء', 'المزامير', 'دانيال'], correct: 1 },
                    { q: 'صلواتنا تبدأ بـ"باسم" وليس "بأسماء" لأن...', options: ['اختصاراً', 'الله واحد', 'عادة قديمة', 'لا سبب'], correct: 1 },
                    { q: 'في قانون الإيمان نقول "نؤمن بإله..."', options: ['عظيم', 'واحد', 'ثلاثة', 'كثير'], correct: 1 },
                    { q: 'الابن مولود من الآب كمولد...', options: ['الطفل من أمه', 'الفكر من العقل', 'الماء من النهر', 'النار من الحطب'], correct: 1 },
                    { q: 'الروح القدس...من الآب', options: ['مولود', 'منبثق', 'مخلوق', 'منفصل'], correct: 1 },
                    { q: 'بالنسبة للثالوث بنقول 1×1×1 والنتيجة...', options: ['ثلاثة', 'واحد صحيح', 'صفر', 'غير محددة'], correct: 1 },
                    { q: 'الشمس واحدة وفيها ثلاث خواص هي القرص والشعاع و...', options: ['الماء', 'الحرارة', 'الهواء', 'الظل'], correct: 1 },
                    { q: 'من أقوال المسيح عن الثالوث: "أنا في الآب و..."', options: ['الابن فيّ', 'الآب فيّ', 'الروح فيّ', 'الكل فيّ'], correct: 1 },
                    { q: 'يختلف الكاثوليك عن الأرثوذكس في أن الروح القدس منبثق من...', options: ['الآب فقط ❌', 'الآب والابن ❌', 'الابن فقط ❌', 'الآب والابن (وهذا خطأ)'], correct: 3 },
                    { q: 'في عماد المسيح ظهر الثالوث: الآب من السماء والابن في الأردن والروح القدس في هيئة...', options: ['نار', 'حمامة', 'سحابة', 'ريح'], correct: 1 },
                    { q: 'عيد الظهور الإلهي يحتفل بـ...', options: ['الميلاد', 'القيامة', 'عماد المسيح', 'الصعود'], correct: 2 },
                    { q: 'مارمرقس تعرف على أنيانوس لما صرخ "أيها الإله..."', options: ['العظيم', 'الواحد', 'القوي', 'الحي'], correct: 1 },
                    { q: 'للاهوت مبدأ أو مصدر واحد هو...', options: ['الابن', 'الروح القدس', 'الآب', 'الثلاثة معاً'], correct: 2 },
                    { q: 'الآب هو خاصية... الله', options: ['العقل', 'الوجود', 'الحياة', 'النطق'], correct: 1 },
                    { q: 'الابن هو خاصية... الله', options: ['الوجود', 'العقل والنطق', 'الحياة', 'القدرة'], correct: 1 },
                    { q: 'كلمة "لوجوس" معناها...', options: ['الحياة', 'النور', 'الكلمة', 'القوة'], correct: 2 },
                    { q: 'التشبيه بالشمس: القرص يشبه...', options: ['الابن', 'الروح', 'الآب', 'الثلاثة'], correct: 2 },
                    { q: 'التشبيه بالشمس: الشعاع يشبه...', options: ['الآب', 'الابن', 'الروح', 'الثلاثة'], correct: 1 },
                    { q: 'التشبيه بالشمس: الحرارة تشبه...', options: ['الآب', 'الابن', 'الروح القدس', 'لا أحد'], correct: 2 },
                    { q: 'هل الأقانيم أجزاء من الله؟', options: ['نعم', 'أحياناً', 'لا، كل أقنوم هو الله كله', 'غير معروف'], correct: 2 },
                    { q: 'في البسملة نقول "باسم الآب و..."', options: ['الروح والابن', 'الابن والروح القدس', 'الملائكة', 'القديسين'], correct: 1 },
                    { q: 'الثالوث ظاهر في قصة... في العهد القديم', options: ['نوح', 'إبراهيم والثلاث ملائكة', 'موسى', 'داود'], correct: 1 },
                    { q: 'في سفر التكوين قال الله "نعمل الإنسان على..." بصيغة الجمع', options: ['أمرنا', 'صورتنا', 'قدرتنا', 'حكمتنا'], correct: 1 },
                    { q: 'الآب غير مولود، الابن مولود، الروح القدس...', options: ['مولود أيضاً', 'منبثق', 'مخلوق', 'غير موجود'], correct: 1 },
                    { q: 'مثلث الإيمان: الثالوث = إله واحد في...', options: ['جوهر واحد', 'ثلاثة جواهر', 'جوهرين', 'أربعة جواهر'], correct: 0 },
                    { q: 'في تقديس المياه يقول الكاهن "قدوس قدوس قدوس" كم مرة؟', options: ['مرة', 'مرتين', 'ثلاث مرات', 'أربع مرات'], correct: 2 },
                    { q: 'إشعياء النبي رأى السيرافيم يقولون "قدوس قدوس قدوس رب..."', options: ['الأرض', 'السماء', 'الجنود', 'الكون'], correct: 2 },
                    { q: 'أقنوم الآب هو... اللاهوت', options: ['بداية', 'مصدر', 'نهاية', 'جزء من'], correct: 1 }
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
                    { q: 'سقوط آدم سبب أنواع من الموت، منها كل الآتي ما عدا...', options: ['موت أدبي', 'موت جسدي', 'موت مالي', 'موت روحي'], correct: 2 },
                    { q: 'بعد السقوط طُرد آدم من...', options: ['مصر', 'الجنة', 'الأرض', 'السماء'], correct: 1 },
                    { q: 'ربنا اختار أن... الإنسان', options: ['يترك', 'يعاقب', 'يفدي', 'ينسى'], correct: 2 },
                    { q: '"الرحمة والحق التقيا" تحققت في...', options: ['الخلق', 'التجسد والفداء', 'الطوفان', 'الناموس'], correct: 1 },
                    { q: 'من أي أقنوم تجسد؟', options: ['الآب', 'الابن', 'الروح القدس', 'الثلاثة'], correct: 1 },
                    { q: 'حلول الروح القدس على العذراء كان لـ...', options: ['سبب واحد', 'ثلاثة أسباب', 'لا سبب', 'سببين'], correct: 1 },
                    { q: 'هل العذراء مريم تزوجت يوسف النجار؟', options: ['نعم قبل الميلاد', 'نعم بعد الميلاد', 'لا أبداً', 'غير معروف'], correct: 2 },
                    { q: 'التجسد يعني أن الله أخذ...', options: ['شكلاً فقط', 'جسداً حقيقياً', 'جسداً غير حقيقي', 'صورة'], correct: 1 },
                    { q: 'التأنس يعني أن الجسد المأخوذ هو...', options: ['ملاك', 'حيوان', 'إنسان كامل', 'روح فقط'], correct: 2 },
                    { q: 'في قانون الإيمان نقول "تجسد من الروح القدس و..."', options: ['من السماء', 'من مريم العذراء', 'من الآب', 'من الأرض'], correct: 1 },
                    { q: 'المسيح له كم ولادة؟', options: ['واحدة', 'اثنتان', 'ثلاثة', 'لا يُولد'], correct: 1 },
                    { q: 'الولادة الأولى للمسيح هي...', options: ['زمنية من مريم', 'أزلية من الآب', 'من الروح القدس', 'من البشر'], correct: 1 },
                    { q: 'المسيح لم يحتاج أباً بشرياً لأنه...', options: ['ضعيف', 'موجود من الأصل (الله)', 'لم يُرد', 'مستحيل'], correct: 1 },
                    { q: 'اللاهوت يعني...', options: ['طبيعة الإنسان', 'طبيعة الله', 'طبيعة الملائكة', 'طبيعة العالم'], correct: 1 },
                    { q: 'نقول في التسبحة "هو أخذ الذي لنا وأعطانا..."', options: ['المال', 'الذي له', 'الأرض', 'الملائكة'], correct: 1 },
                    { q: 'المسيح شابهنا في كل شيء ما عدا...', options: ['الجوع', 'النوم', 'الخطية وحدها', 'الألم'], correct: 2 },
                    { q: 'مثال على اتحاد اللاهوت بالناسوت هو...', options: ['الماء والزيت', 'الحديد المحمي بالنار', 'الرمل والحصى', 'الهواء والتراب'], correct: 1 },
                    { q: '"الذي هو صورة الله غير المنظور" في أي رسالة؟', options: ['رومية', 'كولوسي', 'غلاطية', 'أفسس'], correct: 1 },
                    { q: 'بنقول على المسيح "ابن الإنسان" لأنه...', options: ['ضعيف', 'أخذ الجسد من إنسان (مريم)', 'ليس إلهاً', 'بشر عادي'], correct: 1 },
                    { q: 'القديس أغسطينوس قال عن التجسد: "أنت أردت أن تكون إلهاً فضللت وهو أراد أن يكون... لكي يرد الضال"', options: ['ملاكاً', 'إنساناً', 'ملكاً', 'نبياً'], correct: 1 },
                    { q: 'الموت الأدبي يعني فقدان...', options: ['المال', 'الكرامة والبر', 'الصحة', 'الأصدقاء'], correct: 1 },
                    { q: 'الموت الروحي يعني الانفصال عن...', options: ['الناس', 'العالم', 'الله', 'الملائكة'], correct: 2 },
                    { q: 'الموت الأبدي يعني...', options: ['النوم الطويل', 'العذاب الأبدي بعيداً عن الله', 'الاختفاء', 'النسيان'], correct: 1 },
                    { q: 'العذراء مريم حبلت بالمسيح بقوة...', options: ['يوسف', 'الملائكة', 'الروح القدس', 'البشر'], correct: 2 },
                    { q: 'حلول الروح القدس على العذراء كان لتطهير و... الرحم', options: ['تدمير', 'تقديس', 'توسيع', 'إغلاق'], correct: 1 },
                    { q: 'المسيح طبيعة... من طبيعتين', options: ['اثنتين', 'واحدة', 'ثلاثة', 'لا طبيعة'], correct: 1 },
                    { q: 'اتحاد اللاهوت والناسوت بغير...', options: ['قوة', 'اختلاط ولا امتزاج ولا تغيير', 'بداية', 'نهاية'], correct: 1 },
                    { q: 'العذراء مريم لُقبت بـ"ثيؤطوكوس" أي...', options: ['القديسة', 'والدة الإله', 'أم النور', 'العذراء فقط'], correct: 1 },
                    { q: 'المسيح جاع وعطش لأنه...', options: ['ضعيف', 'إنسان حقيقي', 'ممثل', 'ليس إلهاً'], correct: 1 },
                    { q: 'في سفر إشعياء "ها العذراء تحبل وتلد ابناً وتدعو اسمه..."', options: ['يسوع', 'عمانوئيل', 'ميخائيل', 'جبرائيل'], correct: 1 },
                    { q: 'عمانوئيل معناها...', options: ['الله قوي', 'الله معنا', 'الله عظيم', 'الله محب'], correct: 1 },
                    { q: 'الخلاص تطلب تجسد الله لأن الإنسان وحده لا يقدر أن...', options: ['يصلي', 'يصوم', 'يخلص نفسه', 'يتعلم'], correct: 2 },
                    { q: 'مجمع خلقيدونية أخطأ لأنه قال المسيح له... طبيعتين', options: ['واحدة', 'اثنتين منفصلتين', 'ثلاث', 'لا طبيعة'], correct: 1 },
                    { q: '"الكلمة صار جسداً" في إنجيل...', options: ['متى', 'مرقس', 'لوقا', 'يوحنا'], correct: 3 },
                    { q: 'التجسد حدث في ملء...', options: ['القوة', 'الزمان', 'المكان', 'العدد'], correct: 1 }
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
                    { q: 'الفداء يعني أن شخص يموت بدل...', options: ['نفسه', 'المفدي', 'الملائكة', 'لا أحد'], correct: 1 },
                    { q: 'المسيح فدانا بـ...', options: ['ذهب وفضة', 'دمه الكريم', 'صلواته فقط', 'تعاليمه'], correct: 1 },
                    { q: '"بدون سفك دم لا تحصل..." ماذا؟', options: ['بركة', 'قوة', 'مغفرة', 'حكمة'], correct: 2 },
                    { q: 'من شروط الفادي أن يكون إنساناً لأن اللي أخطأ كان...', options: ['ملاكاً', 'حيواناً', 'إنساناً', 'لا أحد'], correct: 2 },
                    { q: 'لازم الفادي يكون غير محدود لأن الخطية كانت ضد الله...', options: ['المحدود', 'الضعيف', 'غير المحدود', 'البعيد'], correct: 2 },
                    { q: 'الفادي لازم يكون بلا خطية عشان الذبيحة تكون مقدمة عن...', options: ['نفسه', 'العالم كله', 'شخص واحد', 'الملائكة'], correct: 1 },
                    { q: 'الفادي لازم يكون أقوى من الموت عشان...', options: ['يهرب منه', 'ينتصر عليه', 'يخاف منه', 'يتجنبه'], correct: 1 },
                    { q: 'هل شروط الفادي موجودة في ذبيحة حيوانية؟', options: ['نعم', 'أحياناً', 'لا أبداً', 'في بعضها'], correct: 2 },
                    { q: '"أجرة الخطية..." ماذا؟', options: ['مرض', 'فقر', 'موت', 'حزن'], correct: 2 },
                    { q: 'ربنا مكنش ينفع يسامح آدم وخلاص لأن ده ضد... الله', options: ['محبة', 'عدل', 'رحمة', 'حكمة'], correct: 1 },
                    { q: 'ربنا مكنش ينفع يفني آدم لأن العقوبة هتكون على... بس', options: ['الروح', 'الجسد', 'العقل', 'القلب'], correct: 1 },
                    { q: 'مكنش ينفع ربنا يخلق آدم جديد لأن المشكلة ممكن...', options: ['تنتهي', 'تتكرر', 'تختفي', 'تصغر'], correct: 1 },
                    { q: 'الصليب له ٤ أذرع يشير إلى الخلاص الذي وصل...', options: ['لليهود فقط', 'لكل الأرض', 'للملائكة', 'للأنبياء'], correct: 1 },
                    { q: 'الصليب هو العرش لأن المزمور يقول "الرب قد ملك على..."', options: ['السماء', 'خشبة', 'الأرض', 'البحر'], correct: 1 },
                    { q: 'المسيح كان على الصليب هو الكاهن و... في نفس الوقت', options: ['الملك', 'الذبيحة', 'النبي', 'الكاتب'], correct: 1 },
                    { q: 'يوحنا في سفر الرؤيا رأى المسيح كـ...', options: ['أسد', 'حمل مذبوح قائم', 'ملاك', 'نسر'], correct: 1 },
                    { q: '"وليس بأحد غيره الخلاص" تعني أن الخلاص فقط بـ...', options: ['الأعمال', 'المال', 'المسيح وحده', 'الأنبياء'], correct: 2 },
                    { q: 'في القداس نقول "حولت لي العقوبة..."', options: ['هلاكاً', 'خلاصاً', 'حزناً', 'فرحاً'], correct: 1 },
                    { q: 'في صلاة الساعة السادسة نقول "صنعت خلاصاً في وسط..."', options: ['السماء', 'الأرض كلها', 'البحر', 'الجبل'], correct: 1 },
                    { q: '"افتديتم لا بأشياء تفنى بل بدم كريم" في أي رسالة؟', options: ['رومية', 'بطرس الأولى', 'كورنثوس', 'يعقوب'], correct: 1 },
                    { q: 'الذبائح في العهد القديم كانت... للفداء الحقيقي', options: ['بديلاً', 'رمزاً', 'نهاية', 'تكراراً'], correct: 1 },
                    { q: 'الحمل في عيد الفصح كان يُذبح رمزاً لـ...', options: ['موسى', 'المسيح', 'إبراهيم', 'داود'], correct: 1 },
                    { q: 'المسيح قدم نفسه بإرادته يعني...', options: ['أُجبر', 'اختار الموت بحريته', 'لم يكن يعرف', 'هرب'], correct: 1 },
                    { q: 'الصليب هو رمز لـ...', options: ['الهزيمة', 'المحبة والانتصار', 'الضعف', 'الخوف'], correct: 1 },
                    { q: '"هكذا أحب الله العالم حتى بذل ابنه الوحيد" في إنجيل...', options: ['متى', 'مرقس', 'يوحنا 3:16', 'لوقا'], correct: 2 },
                    { q: 'ستار الهيكل انشق عند صلب المسيح من... إلى أسفل', options: ['الوسط', 'فوق', 'الجانب', 'تحت'], correct: 1 },
                    { q: 'انشقاق ستار الهيكل يعني أن الطريق لله أصبح...', options: ['مغلقاً', 'مفتوحاً', 'صعباً', 'مستحيلاً'], correct: 1 },
                    { q: 'المسيح صُلب يوم...', options: ['السبت', 'الأحد', 'الجمعة', 'الخميس'], correct: 2 },
                    { q: 'قام المسيح من الأموات في اليوم...', options: ['الأول', 'الثاني', 'الثالث', 'السابع'], correct: 2 },
                    { q: 'عبارة "الله محبة" تتجلى أعظم تجلي في...', options: ['الخلق', 'الصليب', 'المعجزات', 'التعاليم'], correct: 1 },
                    { q: 'لماذا لم يصلح ملاك للفداء؟ لأن الملاك...', options: ['قوي جداً', 'محدود ومخلوق', 'مشغول', 'رفض'], correct: 1 },
                    { q: 'الفادي لازم يكون من نفس... المفدي', options: ['بلد', 'لغة', 'جنس (طبيعة)', 'عمر'], correct: 2 },
                    { q: 'دم المسيح يطهر من...', options: ['المرض الجسدي فقط', 'كل خطية', 'بعض الخطايا', 'لا شيء'], correct: 1 },
                    { q: 'في القداس نقول "بالصليب... فرحٌ في العالم كله"', options: ['حزن', 'خوف', 'جاء', 'انتهى'], correct: 2 },
                    { q: '"ملعون كل من عُلّق على خشبة" والمسيح حمل... بدلاً عنا', options: ['الحكمة', 'البركة', 'اللعنة', 'المجد'], correct: 2 }
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
        name: 'روح وحياة',
        desc: 'كتاب مقدس',
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
        name: 'جيل يصنع التغيير',
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
        name: 'حركة ومعنى',
        desc: 'طقس',
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
    if (rankEl) { rankEl.textContent = rank.emoji + ' ' + rank.title; }
    var starsEl = document.getElementById('hub-stars');
    if (starsEl) starsEl.textContent = GameState.stars;
    var gemsEl = document.getElementById('hub-gems');
    if (gemsEl) gemsEl.textContent = GameState.gems;

    // XP bar
    var xpWrap = document.getElementById('hub-xp-bar-wrap');
    if (!xpWrap) {
        xpWrap = document.createElement('div');
        xpWrap.id = 'hub-xp-bar-wrap';
        xpWrap.className = 'hub-xp-bar-wrap';
        var playerRow = document.querySelector('.hub-player-row');
        if (playerRow && playerRow.parentNode) {
            playerRow.parentNode.insertBefore(xpWrap, playerRow.nextSibling);
        }
    }
    if (xpWrap) {
        var currentRankIdx = 0;
        for (var ri = 0; ri < RANKS.length; ri++) {
            if (GameState.stars >= RANKS[ri].min) currentRankIdx = ri;
        }
        var nextRank = RANKS[Math.min(currentRankIdx + 1, RANKS.length - 1)];
        var currentMin = RANKS[currentRankIdx].min;
        var nextMin = nextRank.min;
        var xpPct = nextMin > currentMin ? Math.min(((GameState.stars - currentMin) / (nextMin - currentMin)) * 100, 100) : 100;
        xpWrap.innerHTML = '<div class="hub-xp-bar"><div class="hub-xp-fill" style="width:' + xpPct + '%"></div></div>' +
            '<div class="hub-xp-info"><span class="hub-xp-text">' + GameState.stars + ' / ' + nextMin + ' نجمة</span>' +
            '<span class="hub-xp-level"><i class="fas fa-arrow-up"></i> ' + nextRank.title + '</span></div>';
    }

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
        faith: { name: 'إيماننا الأرثوذوكسي', icon: '✝️' },
        bible: { name: 'روح وحياة', icon: '📖' },
        life: { name: 'جيل يصنع التغيير', icon: '🌟' },
        ritual: { name: 'حركة ومعنى', icon: '⛪' }
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
        faith: 'إيماننا الأرثوذوكسي ✝️',
        bible: 'روح وحياة 📖',
        life: 'جيل يصنع التغيير 🌟',
        ritual: 'حركة ومعنى ⛪'
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
var FAITH_MAP_POSITIONS = [
    { left: 11, top: 38 },  // 1. التثليث والتوحيد
    { left: 26, top: 62 },  // 2. التجسد
    { left: 40, top: 38 },  // 3. الفداء
    { left: 62, top: 28 },  // 4. القيامة والمجيء الثاني
    { left: 65, top: 70 },  // 5. المعمودية والميرون
    { left: 82, top: 52 }   // 6. التوبة والاعتراف
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

    // Calculate stars
    var earnedStars = 0;
    var currentStation = 0; // Where the character should stand
    for (var s = 0; s < subject.lessons.length; s++) {
        var ld = subjectData['lesson_' + s];
        if (ld && ld.stars > 0) {
            earnedStars += ld.stars;
            currentStation = s + 1; // Move past completed
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
        avatar.style.left = (positions[currentStation].left - 3) + '%';
        avatar.style.top = (positions[currentStation].top - 6) + '%';
    }

    // Render nodes
    var nodesContainer = document.getElementById('l2-imgmap-nodes');
    nodesContainer.innerHTML = '';

    for (var i = 0; i < subject.lessons.length; i++) {
        var lesson = subject.lessons[i];
        var lessonData = subjectData['lesson_' + i] || {};
        var stars = lessonData.stars || 0;
        var isCompleted = stars > 0;
        var isAvailable = (i === 0);
        if (i > 0) {
            var prevData = subjectData['lesson_' + (i - 1)] || {};
            isAvailable = (prevData.stars || 0) > 0;
        }

        var stateClass = isCompleted ? 'l2-imgmap-node-completed' : (isAvailable ? 'l2-imgmap-node-available' : 'l2-imgmap-node-locked');
        var hasExam = GameState.level2Data && GameState.level2Data[level2State.currentSubject] &&
            GameState.level2Data[level2State.currentSubject]['exam_' + i];

        var node = document.createElement('div');
        node.className = 'l2-imgmap-node ' + stateClass;
        node.style.left = positions[i].left + '%';
        node.style.top = positions[i].top + '%';

        var circleContent = isCompleted ? '<i class="fas fa-check"></i>' : (i + 1);
        // Show stars out of 30
        var starsHTML = '<div class="l2-imgmap-node-stars">';
        if (stars > 0) {
            starsHTML += '<span class="node-star-count">⭐' + stars + '</span>';
        } else {
            starsHTML += '<span class="node-star-count dim">⭐0</span>';
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
                    animateCharacterToNode(idx, positions, function() {
                        startLevel2Lesson(idx);
                    });
                };
            })(i);
        } else {
            node.onclick = function() { showToast('أكمل الدرس السابق الأول! 🔒', 'warning'); };
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
        var dl = (positions[i].left - 3) - currentLeft;
        var dt = (positions[i].top - 6) - currentTop;
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
        av.style.left = (positions[nodeIdx].left - 3) + '%';
        av.style.top = (positions[nodeIdx].top - 6) + '%';

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
        var isCompleted = stars > 0;
        var isAvailable = (i === 0);
        if (i > 0) {
            var prevData = subjectData['lesson_' + (i - 1)] || {};
            isAvailable = (prevData.stars || 0) > 0;
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
    } else if (level2State.currentStage === 'quiz') {
        renderLevel2Quiz(body, lesson, subject);
    } else if (level2State.currentStage === 'result') {
        renderLevel2Result(body, lesson, subject);
    }

    // Stage label
    var stageLabel = document.getElementById('l2-lesson-stage-label');
    if (level2State.currentStage === 'learn') stageLabel.textContent = '📚 تعلّم';
    else if (level2State.currentStage === 'quiz') stageLabel.textContent = '❓ اختبار';
    else stageLabel.textContent = '🏆 النتيجة';
}

// --- Learn Stage ---
function renderLevel2Learn(container, lesson, subject) {
    var subKey = level2State.currentSubject;
    var lessonIdx = level2State.currentLesson;
    var summaryKey = subKey + '_' + lessonIdx;
    var hasSummary = GameState.lessonSummaries && GameState.lessonSummaries[summaryKey];

    // Tabs: تعلّم + تلخيص + اختبار + نتيجة
    var html = '<div class="l2-stage-tabs">' +
        '<button class="l2-stage-tab active"><i class="fas fa-book-open"></i> تعلّم</button>' +
        '<button class="l2-stage-tab ' + (hasSummary ? 'completed' : '') + '" onclick="' + (hasSummary ? '' : 'showLessonSummaryTab()') + '"><i class="fas ' + (hasSummary ? 'fa-check' : 'fa-pen') + '"></i> تلخيص</button>' +
        '<button class="l2-stage-tab"><i class="fas fa-question-circle"></i> اختبار</button>' +
        '<button class="l2-stage-tab"><i class="fas fa-trophy"></i> النتيجة</button>' +
        '</div>';

    html += '<div class="l2-learn-content">';
    html += '<div class="l2-learn-header">';
    html += '<div class="l2-learn-icon">' + subject.icon + '</div>';
    html += '<h3>' + lesson.name + '</h3>';
    html += '<p class="l2-learn-desc">' + lesson.desc + '</p>';
    html += '</div>';

    // YouTube Video Embed
    if (lesson.videoId) {
        var videoKey = level2State.currentSubject + '_lesson_' + level2State.currentLesson + '_video';
        var videoWatched = GameState.watchedVideos && GameState.watchedVideos[videoKey];
        html += '<div class="l2-video-section">';
        html += '<div class="l2-video-label"><i class="fas fa-play-circle"></i> ' + (lesson.videoTitle || 'وعظة الدرس') + '</div>';
        html += '<div class="l2-video-wrap">';
        html += '<iframe src="https://www.youtube.com/embed/' + lesson.videoId + '?rel=0&modestbranding=1" ';
        html += 'frameborder="0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ';
        html += 'style="width:100%;aspect-ratio:16/9;border-radius:12px;"></iframe>';
        html += '</div>';
        if (!videoWatched) {
            html += '<button class="btn btn-primary l2-video-done-btn" onclick="markVideoWatched(\'' + videoKey + '\')" style="width:100%;margin-top:10px">';
            html += '<span><i class="fas fa-check-circle"></i> شاهدت الوعظة ✅ (+10 نجوم)</span></button>';
        } else {
            html += '<div class="l2-video-watched-badge"><i class="fas fa-check-circle"></i> شاهدت الوعظة وأخدت 10 نجوم ⭐</div>';
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

    // Show previous best score if exists
    var prevData = GameState.level2Data && GameState.level2Data[subKey] &&
        GameState.level2Data[subKey]['lesson_' + lessonIdx];
    if (prevData && prevData.stars > 0) {
        html += '<div class="l2-learn-prev-score">أعلى نتيجة سابقة: ⭐ ' + prevData.stars + '/30 (' + prevData.score + '/' + prevData.total + ' إجابة صح)</div>';
    }

    html += '</div>';

    // If summary not submitted yet, show summary section
    if (!hasSummary) {
        html += '<div class="l2-summary-required">';
        html += '<h4><i class="fas fa-pen"></i> لازم تعمل تلخيص الأول قبل ما تبدأ الاختبار</h4>';
        html += '<button class="btn btn-primary" onclick="showLessonSummaryTab()" style="width:100%;margin-top:8px;">' +
            '<span><i class="fas fa-pen"></i> اكتب تلخيص الدرس</span></button>';
        html += '</div>';
    } else {
        // Summary done - show quiz button
        html += '<button class="btn btn-primary" onclick="startLevel2Quiz()" style="width:100%;margin-top:16px;">' +
            '<span><i class="fas fa-play"></i> جمّع واكسب ⭐</span></button>';

        // Show weekly exam button if practiced
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

        // Show saved summary
        var savedSummary = GameState.lessonSummaries[summaryKey];
        html += '<div class="l2-saved-summary">';
        html += '<h4><i class="fas fa-check-circle"></i> تلخيصك المحفوظ</h4>';
        if (savedSummary.text) html += '<p>' + savedSummary.text + '</p>';
        if (savedSummary.image) html += '<img src="' + savedSummary.image + '" class="l2-summary-saved-img">';
        html += '</div>';
    }

    container.innerHTML = html;
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
        '<button class="l2-stage-tab"><i class="fas fa-question-circle"></i> اختبار</button>' +
        '<button class="l2-stage-tab"><i class="fas fa-trophy"></i> النتيجة</button>' +
        '</div>';

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

    // Submit button
    html += '<button class="btn btn-primary" onclick="submitLessonSummary()" style="width:100%;margin-top:16px;">' +
        '<span><i class="fas fa-paper-plane"></i> سلّم التلخيص (+5 ⭐)</span></button>';

    html += '</div>';

    container.innerHTML = html;
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
    GameState.lessonSummaries[summaryKey] = {
        text: text,
        image: image,
        audio: audio,
        date: getTodayKey()
    };

    GameState.stars += 5;
    window._lessonSummaryImage = null;
    window._lessonSummaryAudio = null;

    saveToCloud();
    saveToLocalStorage();
    showToast('تم حفظ التلخيص! ⭐ +5 نجوم', 'success');

    // Re-render learn stage
    level2State.currentStage = 'learn';
    renderLevel2Lesson();
}

// --- Mark Video as Watched & Award Stars ---
function markVideoWatched(videoKey) {
    if (GameState.watchedVideos && GameState.watchedVideos[videoKey]) return; // already rewarded
    if (!GameState.watchedVideos) GameState.watchedVideos = {};
    GameState.watchedVideos[videoKey] = true;
    GameState.stars += 10;
    saveToCloud();
    showAchievement('🎬', 'شاهدت الوعظة!', 'كسبت 10 نجوم إضافية ⭐');
    // Re-render to show watched badge
    setTimeout(function() { renderLevel2Lesson(); }, 2000);
}

// --- Start Quiz ---
function startLevel2Quiz() {
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

    // Shuffle and pick 20 questions from the bank
    var subKey = level2State.currentSubject;
    var lesson = LEVEL2_SUBJECTS[subKey].lessons[level2State.currentLesson];
    var allQs = lesson.questions.slice(); // copy
    // Fisher-Yates shuffle
    for (var i = allQs.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = allQs[i];
        allQs[i] = allQs[j];
        allQs[j] = temp;
    }
    level2State.activeQuestions = allQs.slice(0, 20);
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

    // Shuffle and pick 20 questions
    var lesson = subject.lessons[lessonIdx];
    var allQs = lesson.questions.slice();
    for (var i = allQs.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = allQs[i];
        allQs[i] = allQs[j];
        allQs[j] = temp;
    }
    level2State.activeQuestions = allQs.slice(0, 20);

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
    var total = (level2State.activeQuestions || lesson.questions).length;
    var score = level2State.quizScore;
    var percentage = Math.round(score / total * 100);

    // Calculate stars out of 30 (station max = 30 stars)
    var MAX_STATION_STARS = 30;
    var stars = Math.round(percentage / 100 * MAX_STATION_STARS);

    // Save progress (keep best score)
    if (!GameState.level2Data) GameState.level2Data = {};
    if (!GameState.level2Data[level2State.currentSubject]) GameState.level2Data[level2State.currentSubject] = {};
    var existingData = GameState.level2Data[level2State.currentSubject]['lesson_' + level2State.currentLesson] || {};
    var existingStars = existingData.stars || 0;

    if (level2State.examMode) {
        // Subject-level exam
        if (level2State.subjectExamKey) {
            if (!GameState.level2Data[level2State.subjectExamKey]) {
                GameState.level2Data[level2State.subjectExamKey] = {
                    stars: stars, score: score, total: total, date: new Date().toISOString()
                };
                GameState.stars += stars;
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
                saveToCloud();
                syncLeaderboard();
            }
        }
    } else {
        // Practice mode: keep best score, cap at 30
        if (stars > existingStars) {
            GameState.level2Data[level2State.currentSubject]['lesson_' + level2State.currentLesson] = {
                stars: stars, score: score, total: total
            };
            var newStars = stars - existingStars;
            GameState.stars += newStars;
            GameState.gems += Math.ceil(stars / 10);
            saveToCloud();
            syncLeaderboard();
        }
    }

    var starRatio = stars / MAX_STATION_STARS;
    var icon = starRatio >= 0.9 ? '🏆' : (starRatio >= 0.7 ? '⭐' : (starRatio >= 0.4 ? '👍' : '😔'));
    var title = starRatio >= 0.9 ? 'ممتاز! أداء رائع!' : (starRatio >= 0.7 ? 'أحسنت! كويس جداً' : (starRatio >= 0.4 ? 'محتاج تذاكر أكتر' : 'حاول تاني يا بطل!'));

    var html = '<div class="l2-stage-tabs">' +
        '<button class="l2-stage-tab completed"><i class="fas fa-check"></i> تعلّم</button>' +
        '<button class="l2-stage-tab completed"><i class="fas fa-check"></i> اختبار</button>' +
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
    html += '<button class="compete-action-btn compete-create" onclick="createCompeteRoom()">';
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

    html += '</div>';

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

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = '<div class="modal-card compete-mode-confirm">' +
        '<div class="compete-confirm-icon"><i class="fas fa-gamepad"></i></div>' +
        '<h3>' + (modeNames[mode] || mode) + '</h3>' +
        '<p class="compete-confirm-desc">' + (modeDescs[mode] || '') + '</p>' +
        '<div class="compete-confirm-actions">' +
        '<button class="btn btn-primary" id="confirm-create-room"><span><i class="fas fa-plus-circle"></i> إنشاء غرفة</span></button>' +
        '<button class="btn btn-secondary" id="cancel-mode-select"><span><i class="fas fa-arrow-right"></i></span></button>' +
        '</div></div>';
    document.body.appendChild(overlay);

    setTimeout(function() { overlay.classList.add('active'); }, 10);

    document.getElementById('confirm-create-room').onclick = function() {
        overlay.classList.remove('active');
        setTimeout(function() { overlay.remove(); }, 300);
        createCompeteRoom(mode);
    };
    document.getElementById('cancel-mode-select').onclick = function() {
        overlay.classList.remove('active');
        setTimeout(function() { overlay.remove(); }, 300);
    };
}

// --- Create Room ---
function createCompeteRoom(mode) {
    if (!firebaseDb) {
        showToast('مفيش اتصال بالسيرفر - تأكد إن الإنترنت شغال وجرب تاني', 'error');
        return;
    }

    mode = mode || 'classic';
    var roomCode = generateRoomCode();

    // Collect questions from all Level 2 subjects
    var allQs = [];
    ['faith', 'bible', 'life', 'ritual'].forEach(function(subKey) {
        var subject = LEVEL2_SUBJECTS[subKey];
        if (subject && subject.lessons) {
            subject.lessons.forEach(function(lesson) {
                if (lesson.questions) {
                    lesson.questions.forEach(function(q) {
                        allQs.push({ q: q.q, options: q.options, correct: q.correct, subject: subKey });
                    });
                }
            });
        }
    });

    // Shuffle and pick questions based on mode
    for (var i = allQs.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = allQs[i]; allQs[i] = allQs[j]; allQs[j] = temp;
    }

    var numQs = mode === 'sparkle' ? 20 : (mode === 'speed' ? 15 : 10);
    var selectedQs = allQs.slice(0, numQs);
    var timePerQ = mode === 'speed' ? 8 : (mode === 'sparkle' ? 10 : 15);

    var roomData = {
        code: roomCode,
        mode: mode,
        host: GameState.playerPhone,
        hostName: GameState.playerName,
        status: 'lobby', // lobby, playing, finished
        players: {},
        questions: selectedQs,
        currentQuestion: -1,
        timePerQuestion: timePerQ,
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
            } else if (competeState.timeLeft <= 5) {
                fill.style.background = 'linear-gradient(90deg, #f39c12, #e17055)';
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

    // Award stars
    if (myRank >= 0) {
        GameState.stars = (GameState.stars || 0) + reward;
        GameState.gems = (GameState.gems || 0) + Math.floor(reward / 4);
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
    for (var i = allQs.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = allQs[i]; allQs[i] = allQs[j]; allQs[j] = temp;
    }

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
                html += '<div class="compete-rank-item ' + (isMe ? 'me' : '') + '">';
                html += '<span class="compete-rank-pos">' + rankEmoji + '</span>';
                html += '<span class="compete-rank-name">' + (d.name || 'لاعب') + '</span>';
                html += '<span class="compete-rank-stars">⭐ ' + (d.stars || 0) + '</span>';
                html += '</div>';
            });
            if (!html) html = '<p class="compete-empty">مفيش ترتيب لسه</p>';
            container.innerHTML = html;
        })
        .catch(function() {
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
    { id: 'pray_morning', text: 'صليت صلاة باكر', icon: '🌅', points: 5 },
    { id: 'read_bible', text: 'قرأت أصحاح من الكتاب المقدس', icon: '📖', points: 5 },
    { id: 'memorize_verse', text: 'حفظت آية جديدة', icon: '💡', points: 3 },
    { id: 'help_someone', text: 'ساعدت حد النهاردة', icon: '🤝', points: 3 },
    { id: 'no_bad_words', text: 'ما قلتش كلام وحش النهاردة', icon: '🤐', points: 2 },
    { id: 'pray_night', text: 'صليت صلاة النوم', icon: '🌙', points: 5 }
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

document.addEventListener('DOMContentLoaded', function() {
    // Apply saved theme immediately (both html and body for consistency)
    var savedTheme = 'dark';
    try { savedTheme = localStorage.getItem('minElBatal_theme') || 'dark'; } catch(e) {}
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.body.setAttribute('data-theme', savedTheme);
    GameState.theme = savedTheme;

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
        var btn = document.getElementById('btn-register');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span><i class="fas fa-spinner fa-spin"></i> جاري تسجيل الدخول...</span>';
        }

        loadFromCloud(rememberedPhone).then(function(data) {
            if (data && data.playerName) {
                showToast('أهلاً بيك يا ' + GameState.playerName + '!', 'success');
                showScreen('home-hub-screen');
                syncLeaderboard();
            } else {
                // No cloud data found for this phone, clear remember
                localStorage.removeItem('minElBatal_remember');
                resetRegisterBtn(btn);
                showScreen('splash-screen');
            }
        }).catch(function() {
            resetRegisterBtn(btn);
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
function saveToLocalStorage() {
    try {
        localStorage.setItem('minElBatal_gameState', JSON.stringify(GameState));
    } catch(e) {
        console.warn('localStorage save failed:', e);
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
