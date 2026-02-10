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
    weeklyChallengeLog: {}
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
                showScreen('map-screen');
                syncLeaderboard();
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
        image: 'images/david.png',
        role: 'المرنم الشجاع صاحب المقلاع',
        ability: 'ضربة المقلاع - قوة مضاعفة',
        unlocked: true
    },
    philomena: {
        name: 'فيلومينا الأمينة',
        emoji: '⚓',
        color: '#F5A0B8',
        image: 'images/philomena.png',
        role: 'القديسة الأمينة حتى الموت',
        ability: 'إيمان ثابت - حماية من الخطأ',
        unlocked: true
    },
    paul: {
        name: 'بولس الرسول',
        emoji: '✉️',
        color: '#7B5EA7',
        image: 'images/paul.png',
        role: 'رسول الأمم وكاتب الرسائل',
        ability: 'سيف الروح - كشف الإجابة',
        cost: 30,
        unlocked: false
    },
    george: {
        name: 'مارجرجس الروماني',
        emoji: '🐴',
        color: '#D4461A',
        image: 'images/george.png',
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
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show' + (toastType ? ' ' + toastType : '');
    setTimeout(function() { t.className = 'toast'; }, dur);
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
    var el = document.getElementById(id);
    if (el) el.classList.add('active');
    var fabScreens = ['map-screen','category-screen','shop-screen','leaderboard-screen','settings-screen'];
    var fab = document.getElementById('fab-container');
    if (fab) fab.style.display = fabScreens.indexOf(id) >= 0 ? 'flex' : 'none';
    if (id === 'map-screen') renderMap();
    if (id === 'character-screen') renderCharacters();
    if (id === 'shop-screen') renderShop();
    if (id === 'leaderboard-screen') renderLeaderboard();
    if (id === 'settings-screen') renderSettings();
}

function createParticles() {
    var c = document.getElementById('particles');
    if (!c) return;
    c.innerHTML = '';
    for (var i = 0; i < 30; i++) {
        var p = document.createElement('div');
        p.className = 'particle';
        p.style.left = Math.random()*100 + '%';
        p.style.animationDelay = Math.random()*15 + 's';
        p.style.animationDuration = (15+Math.random()*10) + 's';
        p.style.opacity = Math.random()*0.5+0.1;
        p.style.width = p.style.height = (3+Math.random()*6)+'px';
        c.appendChild(p);
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
        showScreen('map-screen');
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

    // Combine all players
    var allPlayers = leaderboardData.slice();
    var meExists = allPlayers.find(function(p) { return p.phone === GameState.playerPhone; });
    if (!meExists && GameState.playerName) {
        allPlayers.push({ name: GameState.playerName, phone: GameState.playerPhone, stars: GameState.stars, streak: GameState.bestStreak, gems: GameState.gems, level: GameState.currentLevel, character: GameState.character });
    }
    // Update current player data in list
    allPlayers.forEach(function(p) {
        if (p.phone === GameState.playerPhone) {
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

// --- Settings ---
function renderSettings() {
    // Theme
    document.querySelectorAll('.theme-card').forEach(function(card) {
        card.classList.remove('active');
        if (card.getAttribute('data-theme') === GameState.theme) card.classList.add('active');
    });
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
document.addEventListener('DOMContentLoaded', function() {
    // Apply saved theme immediately (both html and body for consistency)
    var savedTheme = 'dark';
    try { savedTheme = localStorage.getItem('minElBatal_theme') || 'dark'; } catch(e) {}
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.body.setAttribute('data-theme', savedTheme);
    GameState.theme = savedTheme;

    createParticles();
    preloadCharImages();
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
                showScreen('map-screen');
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
});
