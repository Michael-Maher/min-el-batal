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
let firebaseAuth = null;
let firebaseDb = null;

// --- Game State ---
const GameState = {
    playerName: '',
    playerPhone: '',
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
    musicOn: true,
    volume: 0.5,
    theme: 'dark',
    armor: [],
    equippedArmor: {},
    gamesPlayed: 0,
    perfectLevels: 0
};

// --- Firebase Initialization & Auth ---
function initFirebase() {
    try {
        if (typeof firebase !== 'undefined') {
            firebaseApp = firebase.initializeApp(firebaseConfig);
            firebaseAuth = firebase.auth();
            firebaseDb = firebase.firestore();
            console.log('Firebase initialized successfully');
            signInAnon();
        } else {
            console.warn('Firebase SDK not loaded');
        }
    } catch (e) {
        console.error('Firebase init error:', e);
    }
}

function signInAnon() {
    if (!firebaseAuth) return Promise.resolve(null);
    return firebaseAuth.signInAnonymously()
        .then(result => {
            console.log('Signed in anonymously:', result.user.uid);
            return result.user;
        })
        .catch(err => {
            console.error('Anonymous sign-in failed:', err);
            return null;
        });
}

function saveToCloud() {
    if (!firebaseDb || !GameState.playerPhone) return Promise.resolve();
    const docRef = firebaseDb.collection('players').doc(GameState.playerPhone);
    const data = {
        playerName: GameState.playerName,
        playerPhone: GameState.playerPhone,
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
        musicOn: GameState.musicOn,
        volume: GameState.volume,
        theme: GameState.theme,
        armor: GameState.armor,
        equippedArmor: GameState.equippedArmor,
        gamesPlayed: GameState.gamesPlayed,
        perfectLevels: GameState.perfectLevels,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    };
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
    document.body.setAttribute('data-theme', theme);
    document.querySelectorAll('.theme-card').forEach(function(card) {
        card.classList.remove('active');
        if (card.getAttribute('data-theme') === theme) card.classList.add('active');
    });
    saveGame();
}

// --- Character Definitions ---
const CHARACTERS = {
    david: {
        name: 'داود الملك',
        emoji: '👑',
        color: '#FFD700',
        role: 'محارب شجاع وملك عظيم',
        ability: 'ضربة المقلاع - قوة مضاعفة',
        unlocked: true
    },
    joshua: {
        name: 'يشوع بن نون',
        emoji: '⚔️',
        color: '#FF6B35',
        role: 'قائد شعب الله',
        ability: 'صيحة النصر - تجميد الوقت',
        unlocked: true
    },
    daniel: {
        name: 'دانيال النبي',
        emoji: '🦁',
        color: '#4ECDC4',
        role: 'حكيم في جب الأسود',
        ability: 'حكمة إلهية - كشف الإجابة',
        cost: 30,
        unlocked: false
    },
    moses: {
        name: 'موسى النبي',
        emoji: '🔥',
        color: '#E63946',
        role: 'كليم الله',
        ability: 'عصا موسى - حذف إجابتين',
        cost: 50,
        unlocked: false
    },
    samson: {
        name: 'شمشون الجبار',
        emoji: '💪',
        color: '#2EC4B6',
        role: 'أقوى رجل في التاريخ',
        ability: 'قوة خارقة - نقاط إضافية',
        cost: 80,
        unlocked: false
    },
    samuel: {
        name: 'صموئيل النبي',
        emoji: '📖',
        color: '#9B5DE5',
        role: 'سمع صوت الرب',
        ability: 'صوت الرب - تلميح إضافي',
        cost: 100,
        unlocked: false
    }
};

function drawCharacter(ctx, charKey, x, y, size) {
    const ch = CHARACTERS[charKey];
    if (!ch) return;
    // Body circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    const gradient = ctx.createRadialGradient(x, y, size * 0.2, x, y, size);
    gradient.addColorStop(0, ch.color);
    gradient.addColorStop(1, shadeColor(ch.color, -30));
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Emoji
    ctx.font = `${size}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch.emoji, x, y);
    ctx.restore();
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
    { id: 9,  name: 'صل وتذكر',         type: 'memory',    questions: 6,  timePerQ: 30, starsNeeded: 25, reward: 30 },
    { id: 10, name: 'الوحش الثاني',      type: 'quiz',      questions: 12, timePerQ: 14, starsNeeded: 28, reward: 40 },
    { id: 11, name: 'صور مقدسة',        type: 'picguess',  questions: 5,  timePerQ: 20, starsNeeded: 32, reward: 30 },
    { id: 12, name: 'أوصل الخط',        type: 'connect',   questions: 6,  timePerQ: 25, starsNeeded: 35, reward: 30 },
    { id: 13, name: 'اللغز المقدس',      type: 'puzzle',    questions: 5,  timePerQ: 35, starsNeeded: 38, reward: 35 },
    { id: 14, name: 'صح أم خطأ ٢',      type: 'truefalse', questions: 10, timePerQ: 10, starsNeeded: 42, reward: 30 },
    { id: 15, name: 'الوحش الثالث',      type: 'quiz',      questions: 14, timePerQ: 13, starsNeeded: 45, reward: 50 },
    { id: 16, name: 'المتاهة',           type: 'maze',      questions: 3,  timePerQ: 45, starsNeeded: 50, reward: 40 },
    { id: 17, name: 'صور وألغاز',       type: 'imgpuzzle', questions: 5,  timePerQ: 30, starsNeeded: 54, reward: 35 },
    { id: 18, name: 'الذاكرة القوية',    type: 'memory',    questions: 8,  timePerQ: 25, starsNeeded: 58, reward: 35 },
    { id: 19, name: 'تحدي السرعة',      type: 'quiz',    questions: 10, timePerQ: 10, starsNeeded: 62, reward: 40 },
    { id: 20, name: 'الوحش الرابع',      type: 'quiz',      questions: 16, timePerQ: 12, starsNeeded: 66, reward: 60 },
    { id: 21, name: 'المزامير ٢',        type: 'psalm',     questions: 8,  timePerQ: 20, starsNeeded: 72, reward: 45 },
    { id: 22, name: 'أوصل ٢',          type: 'connect',   questions: 8,  timePerQ: 22, starsNeeded: 76, reward: 45 },
    { id: 23, name: 'الترتيب النهائي',   type: 'order',     questions: 8,  timePerQ: 25, starsNeeded: 80, reward: 50 },
    { id: 24, name: 'التحدي الأخير',     type: 'quiz',    questions: 15, timePerQ: 12, starsNeeded: 85, reward: 60 },
    { id: 25, name: 'ملك الأبطال',       type: 'quiz',      questions: 20, timePerQ: 10, starsNeeded: 90, reward: 100 }
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
    { id: 'armor3', name: 'محارب الإيمان', icon: '🛡️', desc: 'اشترِ 3 قطع درع', check: () => GameState.armor.length >= 3 }
];


// ============ PART 2B: GAME LOGIC ============

// --- Utilities ---
function showToast(msg, dur) {
    dur = dur || 2500;
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function() { t.classList.remove('show'); }, dur);
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

function saveLocal() {
    try { localStorage.setItem('minElBatal_save', JSON.stringify(GameState)); } catch(e) {}
}

function loadLocal() {
    try {
        var s = localStorage.getItem('minElBatal_save');
        if (s) { Object.assign(GameState, JSON.parse(s)); return true; }
    } catch(e) {}
    return false;
}

function saveGame() { saveLocal(); saveToCloud(); }

// --- Login ---
function submitLogin() {
    var name = document.getElementById('player-name').value.trim();
    var phone = document.getElementById('player-phone').value.trim();
    if (!name || name.length < 2) { showToast('اكتب اسمك يا بطل (حرفين على الأقل)'); return; }
    if (!phone || !/^01\d{9}$/.test(phone)) { showToast('اكتب رقم تليفون صحيح (01xxxxxxxxx)'); return; }
    GameState.playerName = name;
    GameState.playerPhone = phone;
    loadFromCloud(phone).then(function(data) {
        if (data) {
            Object.assign(GameState, data);
            GameState.playerName = name;
            GameState.playerPhone = phone;
            showToast('🎉 تم تحميل تقدمك السابق!');
            saveLocal();
            showScreen('map-screen');
        } else {
            saveLocal();
            showScreen('character-screen');
        }
    }).catch(function() {
        saveLocal();
        showScreen('character-screen');
    });
}

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
        var inner = '<div class="char-avatar-wrap"><canvas class="char-canvas" width="100" height="100" data-char="'+key+'"></canvas></div>';
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
                        showToast('🎉 تم فتح ' + CHARACTERS[k].name);
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
        var cv = card.querySelector('.char-canvas');
        if (cv) { var ctx = cv.getContext('2d'); drawCharacter(ctx, key, 50, 50, 45); }
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
    var ac = document.getElementById('avatar-canvas');
    if (ac) { var ctx = ac.getContext('2d'); ctx.clearRect(0,0,64,64); drawCharacter(ctx, GameState.character, 32, 32, 28); }
    var path = document.getElementById('levels-path');
    path.innerHTML = '';
    var icons = {quiz:'fa-question-circle',psalm:'fa-scroll',spotdiff:'fa-magnifying-glass',memory:'fa-brain',truefalse:'fa-bolt',imgpuzzle:'fa-puzzle-piece',missing:'fa-question',puzzle:'fa-spell-check',connect:'fa-link',maze:'fa-route',picguess:'fa-image',order:'fa-sort-numeric-down'};
    var colors = {quiz:'#4CAF50',psalm:'#9C27B0',spotdiff:'#FF9800',memory:'#2196F3',truefalse:'#F44336',imgpuzzle:'#00BCD4',missing:'#E91E63',puzzle:'#FF5722',connect:'#3F51B5',maze:'#795548',picguess:'#607D8B',order:'#009688'};
    LEVELS.forEach(function(lv, i) {
        var num = i + 1;
        var ld = GameState.levelsData[num] || {};
        var unlocked = num <= GameState.currentLevel;
        var completed = !!ld.completed;
        var starsE = ld.stars || 0;
        var node = document.createElement('div');
        node.className = 'level-node' + (unlocked?' unlocked':'') + (completed?' completed':'') + (num===GameState.currentLevel && !completed?' current':'');
        var starStr = '';
        for (var s = 0; s < 3; s++) starStr += s < starsE ? '⭐' : '☆';
        node.innerHTML = '<div class="level-circle" style="'+(unlocked?'border-color:'+(colors[lv.type]||'#4CAF50'):'')+'"><i class="fas '+(icons[lv.type]||'fa-question-circle')+'"></i><span class="level-num">'+num+'</span></div><p class="level-name">'+lv.name+'</p><div class="level-stars">'+starStr+'</div>' + (lv.starsNeeded>0 ? '<span class="level-req">'+lv.starsNeeded+'⭐ مطلوب</span>' : '');
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
    // Draw character preview
    var cv = document.getElementById('shop-avatar-canvas');
    if (cv) {
        var ctx = cv.getContext('2d');
        ctx.clearRect(0, 0, cv.width, cv.height);
        drawCharacter(ctx, GameState.character, 80, 100, 70);
    }
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

// --- Leaderboard ---
var leaderboardData = [];
var currentLBTab = 'stars';

function renderLeaderboard() {
    // Player card
    var rank = getRank();
    document.getElementById('lb-player-card').innerHTML = '<div class="lb-avatar"><canvas id="lb-avatar-canvas" width="48" height="48"></canvas></div><div class="lb-info"><h3>'+GameState.playerName+'</h3><p>'+rank.emoji+' '+rank.title+'</p></div><div class="lb-stats"><span>⭐ '+GameState.stars+'</span><span>🔥 '+GameState.bestStreak+'</span><span>💎 '+GameState.gems+'</span></div>';
    var lbCv = document.getElementById('lb-avatar-canvas');
    if (lbCv) { var ctx = lbCv.getContext('2d'); drawCharacter(ctx, GameState.character, 24, 24, 20); }
    // Achievements
    var achDiv = document.getElementById('lb-achievements');
    achDiv.innerHTML = '';
    ACHIEVEMENTS.forEach(function(ach) {
        var earned = false;
        try { earned = ach.check(); } catch(e) {}
        var el = document.createElement('div');
        el.className = 'achievement-item' + (earned ? ' earned' : '');
        el.innerHTML = '<span class="ach-icon">'+ach.icon+'</span><div><strong>'+ach.name+'</strong><p>'+ach.desc+'</p></div>';
        achDiv.appendChild(el);
    });
    // Tab highlight
    document.querySelectorAll('.lb-tab').forEach(function(tab) {
        tab.classList.remove('active');
        if (tab.textContent.indexOf(currentLBTab === 'stars' ? 'النجوم' : currentLBTab === 'streak' ? 'السلسلة' : currentLBTab === 'gems' ? 'الجواهر' : 'المستويات') >= 0) {
            tab.classList.add('active');
        }
    });
    // List
    loadLeaderboardFromCloud().then(function(data) {
        leaderboardData = data || [];
        renderLeaderboardList();
    }).catch(function() {
        renderLeaderboardList();
    });
}

function renderLeaderboardList() {
    var list = document.getElementById('leaderboard-list');
    list.innerHTML = '';
    // Add current player
    var allPlayers = leaderboardData.slice();
    var meExists = allPlayers.find(function(p) { return p.phone === GameState.playerPhone; });
    if (!meExists && GameState.playerName) {
        allPlayers.push({ name: GameState.playerName, phone: GameState.playerPhone, stars: GameState.stars, streak: GameState.bestStreak, gems: GameState.gems, level: GameState.currentLevel });
    }
    // Sort
    var sortKey = currentLBTab === 'stars' ? 'stars' : currentLBTab === 'streak' ? 'streak' : currentLBTab === 'gems' ? 'gems' : 'level';
    allPlayers.sort(function(a, b) { return (b[sortKey] || 0) - (a[sortKey] || 0); });
    allPlayers.slice(0, 20).forEach(function(p, i) {
        var el = document.createElement('div');
        var isMe = p.phone === GameState.playerPhone;
        el.className = 'lb-item' + (isMe ? ' me' : '');
        var medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i+1)+'.';
        el.innerHTML = '<span class="lb-rank">'+medal+'</span><span class="lb-name">'+p.name+(isMe?' (أنت)':'')+'</span><span class="lb-score">'+(p[sortKey]||0)+'</span>';
        list.appendChild(el);
    });
    if (allPlayers.length === 0) {
        list.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text-muted)">مفيش بيانات لسه - كون أول بطل!</p>';
    }
}

function switchLBTab(tab) {
    currentLBTab = tab;
    document.querySelectorAll('.lb-tab').forEach(function(t) { t.classList.remove('active'); });
    event.target.classList.add('active');
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
    localStorage.removeItem('minElBatal_save');
    showScreen('splash-screen');
    showToast('تم تسجيل الخروج');
}

// --- Init ---
document.addEventListener('DOMContentLoaded', function() {
    createParticles();
    initFirebase();
    
    // Try auto-login
    if (loadLocal() && GameState.playerName) {
        showScreen('map-screen');
    }
    
    // Set saved theme
    if (GameState.theme) {
        document.body.setAttribute('data-theme', GameState.theme || 'dark');
    }
    
    // Sync leaderboard
    syncLeaderboard();
});
