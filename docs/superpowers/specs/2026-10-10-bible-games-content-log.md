# Bible games expansion — content log

Sources for every new question, word and verse added in phase 1 (and later phases). Review by the user or a servant
before release. Format per station: game id → source card titles / existing game ids, and every new verse with its reference.

## الترم الأول (l1_bible)

### Station 0 — مقدمة: الكتاب المقدس
- `s0_treasure`: cards «يعني إيه الكتاب المقدس؟»، «مين اللي كتبه؟»، diagram «لغات الكتاب المقدس»، «الترجمة السبعينية»، «إصحاحات وآيات»، «يعني إيه عهد؟»، diagram «العهد القديم والعهد الجديد»، diagram «عهود الله مع الإنسان في العهد القديم»، diagram «عصور العهد القديم الستة»؛ `s0_langs` items (لغات الأسفار، «طليثا قومي»، «أبا»، «ماران آثا»، «إنجيل»)، `s0_langs` facts (١٦٦٠ لغة).
  Verses quoted: ٢ تي ٣: ١٦ (station verse)، ٢ بط ١: ٢١ (card check / `s0_decode`)، مر ٥: ٤١، ١ كو ١٦: ٢٢، مر ١٤: ٣٦ (`s0_langs` items). No new verses.
- `s0_words`: عبرية، يونانية، آرامية (diagram «لغات الكتاب المقدس»، `s0_langs`)، سبعينية (card «الترجمة السبعينية»)، هوجو (card «إصحاحات وآيات»)، العهد (card «يعني إيه عهد؟»)، موحى (station verse ٢ تي ٣: ١٦)، أسفار (card «يعني إيه الكتاب المقدس؟»).
  Deviation from the brief: `إسكندرية` (8 letters) replaced by `سبعينية` because an 8-letter word in the 8×8 grid failed the placement check on 4–8 of 100 seeds in every list position.

### Station 1 — عصر الخليقة
- `s1_treasure`: cards «عصر الخليقة»، diagram «أيام الخليقة»، «السقوط... والوعد»، «قايين وهابيل»، diagram «نسل شيث»، «فُلك نوح»، «الطوفان وقوس قزح»، tree «أولاد نوح والأمم»، «برج بابل».
- `s1_order`: تك ١: ١ (card)، تك ١: ٢٧ (new, Van Dyke)، تك ٣: ١٥ (card)، تك ٥: ٢٤ (check explain)، تك ٩: ١٣ (`s1_ark` outro and quiz explain).

### Station 2 — عصر الآباء البطاركة
- `s2_treasure`: cards «اخرج من أرضك»، «هاجر وإسماعيل»، check «وعود ربنا لإبراهيم»، tree «عيلة تارح»، «إحنا إخوات»، «سدوم: ربنا عادل ورحيم»، «تقديم إسحاق»، «إسحاق المسالم ويعقوب»، tree «زوجات يعقوب والأسباط»، «من البير للقصر»، «يوسف الأمين الطاهر»؛ `s2_joseph` stages / outro، `s2_clues` (سارة، إسماعيل).
  Verses quoted: تك ١٢: ٢-٣، ٧ (card check)، تك ١٣: ٨ (card)، تك ١٧: ١٧ (card)، تك ٢٢: ١٢، ١٨ (card)، تك ٣٩: ٩، تك ٥٠: ٢٠ (`s2_joseph`). No new verses.
- `s2_order`: تك ١٣: ٨ (card «إحنا إخوات»)، تك ٣٩: ٢ (card «يوسف الأمين الطاهر»)، تك ٣٩: ٩ (`s2_joseph` stage)، تك ٥٠: ٢٠ (`s2_joseph` stage)، مز ١٠٥: ٨ (station verse). No new verses.

### Station 3 — عصر الخروج
- `s3_treasure`: cards «مديان والعليقة»، diagram «الضربات العشر ضد آلهة مصر»، «عبور البحر الأحمر»، «جبل سيناء»، «العجل الدهب»، diagram «في البرية ٤٠ سنة»، «موسى على جبل نبو»، card check «موسى عاش في قصر فرعون»؛ `s3_redsea` facts (عمود السحاب، خر ١٤: ١٩-٢٠).
  Verses quoted: خر ١٢: ١٢ (card check)، refs خر ١٦، خر ٣٢، عد ١٤، عد ١٦، عد ٢٠: ١١-١٢، عد ٢١، تث ٣٤: ١-٥، يو ٣: ١٤ (all cited in cards).
- `s3_order`: خر ٢٠: ٢ (new, Van Dyke)، خر ١٢: ١٢ (card check explain)، مز ٧٨: ٥٢ (station verse)، مز ٧٨: ٥٣ (station verse)، يو ٣: ١٤ (new, Van Dyke — the reference is cited on diagram «في البرية ٤٠ سنة» but its text is not in the station).

### Station 4 — عصر القضاة
- `s4_treasure`: cards «عصر القضاة»، «يشوع بن نون»، diagram «دايرة القضاة»، diagrams «القضاة (١)» و«القضاة (٢)»، «شمشون الجبار»، «عالي وصموئيل»، «شعبك شعبي وإلهك إلهي»، «راعوث وبوعز»، diagram «من راعوث للمسيح»؛ `s4_gideon` facts (قض ٧: ٢).
  Verses quoted: نح ٩: ٢٨ (station verse)، قض ٧: ٢ (`s4_gideon`)، قض ٤: ٢ (diagram)، را ٤: ١٧، مت ١: ٥ (card). No new verses.
- `s4_words`: يشوع (card «يشوع بن نون»)، صموئيل (card «عالي وصموئيل»)، جدعون، دبورة (diagram «القضاة (١)»)، شمشون (card «شمشون الجبار»)، راعوث، نعمي، بوعز (cards «شعبك شعبي وإلهك إلهي»، «راعوث وبوعز»).

### Station 5 — عصر المملكة
- `s5_treasure`: cards «الشعب عايز ملك»، diagram «أول ٣ ملوك»، tree «المملكة الموحدة والمنقسمة»، «المملكة الشمالية (إسرائيل)»، «إيليا النبي»، «أليشع النبي»، «طوبيا والملاك رافائيل»، «المملكة الجنوبية (يهوذا)»، «يهوديت الشجاعة»؛ `s5_kings`، `s5_north_south` items (رحبعام، المملكة انقسمت من بعد سليمان)، `s5_sling` (٢ مل ٢٥: ٨-١١).
  Verses quoted: ١ مل ١٨: ٢١ (card). No new verses.
- `s5_order`: ١ صم ١٢: ١٢ (station verse)، ١ صم ١٢: ١٣ (station verse)، ١ صم ١٧: ٤٥ (`s5_sling` outro)، ١ مل ١٨: ٢١ (card «إيليا النبي»). No new verses.

### Notes for reviewers
- Hints (fix rounds 1-2): each hint is a story, context or card/diagram reference nudge that still needs the child to know
  the fact. Self-check used: with the question covered, the hint must not pick one of the 4 options or rule out the other
  three, and no hint may answer another question in the same treasure. Hint details beyond the station cards (all accurate):
  - Station 0: ١ كو ١٦: ٢٢ is near the end of the letter (hint «في آخر رسالته الأولى لأهل كورنثوس»).
  - Station 1: «بعد ١٥٠ يوم» (تك ٨: ٣) and the ark resting (تك ٨: ٤)؛ «هيفتكر عهده» (تك ٩: ١٥-١٦).
  - Station 3: «يخلع حذاءه لأن المكان مقدس» (خر ٣: ٥)؛ «كانوا بياكلوا لحم في مصر» (خر ١٦: ٣)؛
    «بيرقصوا حوالين العجل» (خر ٣٢: ١٩)؛ قورح من سبط لاوي والأرض بلعته (عد ١٦: ١، ٣٢).
  - Station 4: فضة دليلة (قض ١٦: ٥)؛ سر شعر شمشون (قض ١٦: ١٧)؛ ٩٠٠ مركبة حديد جمعها سيسرا (قض ٤: ١٣)؛
    الجاسوسين الأمناء (عد ١٤: ٦-٩).
  - Station 5: إيليا مستخبي عند نهر كريث (١ مل ١٧: ٣)؛ رافائيل رافق ابن طوبيا في شكل إنسان (طو ٥)؛
    غنائم عماليق (١ صم ١٥).
- Verses copied from station data had their tanween / shadda removed so the verse tiles carry no tashkeel
  (e.g. «رجلا ناجحا»، «شرا ... خيرا»، «كلاما»، «أحكاما»، «ملكا»، «إلي»). Words are otherwise unchanged.
- Station verse texts (مز ٧٨: ٥٢-٥٣، ١ صم ١٢: ١٢-١٣) are copied as they appear in the station data; please confirm they match
  the Van Dyke edition used by the servants.

## الترم التاني (l2_bible)

### Station 0 — بانوراما الأسفار القانونية الثانية
- `s0_treasure`: cards «قانونية… وثانية؟» (and its check)، image «الأسفار القانونية الثانية»، diagram «الاعتراضات والردود»، check عيد التجديد، diagram «إزاي نعرف إنها قانونية؟»، diagram «نبذة عن كل سفر»، image «مكانها في الكتاب المقدس»، check باروخ، «في كنيستنا»؛ `s0_scrolls` facts / books / objections (السبعينية حوالي ٢٨٥ ق.م، يوسيفوس)، `s0_clues`.
  Verses quoted: يو ١٠: ٢٢، ١ مك ٤: ٥٩ (card check)، طو ١٢: ١٥ (`s0_scrolls` explain)، با ٣: ٣٨ (card check)، عب ١١: ٣٥ (diagram). No new verses.
- `s0_order`: ٢ تي ٣: ١٦ (station verse)، يو ١٠: ٢٢ (card check explain)، طو ١٢: ١٥ (`s0_scrolls` explain)، با ٣: ٣٨ (card check explain)، عب ١١: ٣٥ «وآخرون عذبوا ولم يقبلوا النجاة لكي ينالوا قيامة أفضل» (the diagram «إزاي نعرف إنها قانونية؟» quotes the clause from «لم يقبلوا»; «وآخرون عذبوا» added from Van Dyke).

### Station 1 — طرق دراسة الكتاب المقدس والتأمل فيه
- `s1_treasure`: cards «أهداف المحطة»، «ليه أدرس الكتاب؟»، diagrams «الطرق من ١ لـ ٥» و«الطرق من ٦ لـ ١٠»، check (أع ٩)، «أمثلة: «لماذا؟» و«التربيطات»»، image «ماذا لو؟»، «مثال: وصية، وعد، حقيقة، تشبيه»، image «تاريخ وجغرافيا + قراءات كنسية»، «تطبيق عملي»؛ `s1_lamp` methods (شعار «خليك محقق»، مثال إشباع الجموع)، `s1_connect`.
  Verses quoted: مت ١٤: ٣٠، مز ٢٣: ١، أع ٩: ٦، ١١، مت ٦: ٢٥-٢٨، يو ٤: ٩، يو ١١: ١٧، ٢٥، إر ١٥: ١٦ (all in cards). No new verses.
- `s1_words`: سراج (station verse)، محقق (diagram + `s1_lamp`)، لعازر، يوسف (card «أمثلة»)، بطرس (image «ماذا لو؟»)، زنابق، تشبيه (card «مثال: وصية…»)، قطمارس (diagram «الطرق من ٦ لـ ١٠»: «القطمارس»).

### Station 2 — مقدمة عن رسائل الجامعة (الكاثوليكون)
- `s2_treasure`: cards «أهداف المحطة»، diagram «٧ رسائل و٤ رسل»، diagram «قراءات القداس»، «بطرس: بين الجهاد والمجد»، «يوحنا الحبيب»، image «يهوذا»، image «كاتب رسالة يعقوب»، «رجل الصلاة» (and its check)؛ `s2_mail`، `s2_clues`.
  Verses quoted: يه ١، ٣، ٧، ١ بط ١: ٧، ٢ بط ١: ٤، ١ يو ٣: ١٨، يع ١: ١، أع ١٢: ٢، لو ٢٣: ٣٤ (all in cards). No new verses.
- `s2_order`: ١ يو ٣: ١٨، ١ بط ١: ٧، ١ يو ٤: ١٦، ٢ بط ٣: ١٨، ٢ بط ١: ٢١ (all quoted on station cards). No new verses.

### Station 3 — الإصحاح الأول (يع ١)
- `s3_treasure`: cards «رسالة يعقوب: الإصحاح الأول»، diagram «بركات التجارب»، image «التجربة استثمار سماوي»، check المرتاب، diagram «سلسلة الخطية»، «نوعين تجربة»، «مسرع في الاستماع»، image «الكلمة المغروسة والمراية»، diagram «الديانة الطاهرة»؛ `s3_sea` questions، `s3_fill`.
  Verses quoted: يع ١: ١، ٢، ٣، ٦، ٨، ١٢، ١٣، ١٥، ١٧، ١٩، ٢٤، ٢٧، عب ١٢: ٧، مت ١٩: ٢١ (cards / `s3_sea`). يع ١: ١٥ «والخطية إذا كملت تنتج موتا» is quoted in the explain (the station diagram paraphrases it; Van Dyke wording).
- `s3_words`: فرح، صبر، حكمة، موج، إكليل (diagram «بركات التجارب» + verse)، شهوة (diagram «سلسلة الخطية»)، مراية (image «الكلمة المغروسة والمراية»)، يتامى (diagram «الديانة الطاهرة»).

### Station 4 — الإصحاح الثاني (يع ٢)
- `s4_treasure`: cards «تحذير من المحاباة» (and its check)، «أغنياء في الإيمان»، diagram «أسماء شريعة العهد الجديد» (and its check)، «إيمان بلا أعمال ميت»، check الشياطين، image «الإيمان العامل»، «في كنيستنا: إيمان وأعمال مع بعض»؛ `s4_seats`، `s4_decode` (يع ٢: ١٣، ٢٣).
  Verses quoted: يع ٢: ٣، ٤، ٥، ٨، ٩، ١٥-١٧، ١٩، ٢٠، ٢١، ٢٤، ٢٥، غل ٥: ٦، يع ١: ٢٥ (cards / `s4_decode`).
  New wording (Van Dyke, not in the station): يع ٢: ١٣ first half «لأن الحكم هو بلا رحمة لمن لم يعمل رحمة» (explain)، يع ٢: ٢٣ ending «ودعي خليل الله» (hint + explain). The يع ٢: ١٥-١٦ question uses the station's singular paraphrase from `s4_seats` without quote marks or tashkeel (امض بسلام، استدفئ واشبع); it is not a Van Dyke quote.
- `s4_words`: محاباة، فقير (image «تحذير من المحاباة»)، إبراهيم، إسحاق، راحاب (image «الإيمان العامل»)، ناموس (diagram)، إيمان، أعمال (station verse يع ٢: ٢٦، يع ٢: ٢٢ in `s4_decode`).

### Station 5 — الإصحاح الثالث (يع ٣)
- `s5_treasure`: cards «عيش قبل ما تعلّم»، image «اللسان عضو صغير»، diagram «اللسان زي…»، «من الفم الواحد»، image «الحكمة تبان في التصرف»، diagram «نوعين حكمة»، «غيرة مُرة ولا غيرة في الحسنى؟» (and the check)؛ `s5_tongue` questions، `s5_scenario` (يع ٣: ١٥).
  Verses quoted: يع ٣: ١، ٢، ٣، ٤، ٥، ١٠، ١٥، ١٦، ١٧، ١ مل ٣: ٩، غل ٤: ١٨، تك ١٣: ٨ (cards / games).
  New wording (Van Dyke): يع ٣: ١٢ «هل تقدر يا إخوتي تينة أن تصنع زيتونا، أو كرمة تينا؟» (the station diagram paraphrases it).
- `s5_order`: يع ٣: ١٠ (station verse)، يع ٣: ٥ (image)، يع ٣: ١٧ (card check explain)، يع ٣: ٢ (card)، مز ١٤١: ٣ (card «من الفم الواحد»). No new verses.

### Station 6 — الإصحاح الرابع (يع ٤)
- `s6_treasure`: image «منين الخناقات؟» (and the check)، diagram «٣ شهوات بتولّع الحروب»، «ليه مش بناخد؟» (and the check)، image «محبة العالم»، diagram «أعيش مع ربنا إزاي؟»، image «نعمة أعظم للمتواضعين»، «لا تدينوا… وقول إن شاء الرب» (and the check)؛ `s6_resist` questions.
  Verses quoted: يع ٤: ١، ٣، ٤، ٦، ٧، ١٢، ١٤، ١٥، ١٧، لو ١١: ١١، مت ٦: ٣٣ (cards / games). No new verses.
- `s6_words`: إبليس، اخضعوا (station verse / diagram)، بخار، خطية (card «لا تدينوا»)، نعمة (image)، شهوات (diagram)، عداوة (image «محبة العالم»)، تواضع (image «نعمة أعظم للمتواضعين»).

### Station 7 — الإصحاح الخامس (يع ٥)
- `s7_treasure`: cards «قلبك فين؟»، image «تأنّوا» (and the check)، image «الديان واقف قدام الباب»، diagram «وصايا مهمة» (and the check)، image «سر مسحة المرضى»، «الاعتراف والشفاعة»، diagram «صلاة إيليا» (and the check)، «رد خاطئ»؛ `s7_rain`، `s7_clues` (أيوب، موسى، إبراهيم)، `s7_memory`.
  Verses quoted: يع ٥: ٢-٣، ٧، ٩، ١١، ١٢، ١٣، ١٤، ١٦، ١٧، ٢٠، تك ١٨: ٢٣-٣٢، خر ٣٢: ١١-١٤ (cards). No new verses.
- `s7_words`: فلاح، مطر (image «تأنّوا»)، أيوب (diagram «وصايا مهمة»)، إيليا (diagram «صلاة إيليا»)، زيت، قنديل (image «سر مسحة المرضى»)، الديان (image)، اعتراف (card «الاعتراف والشفاعة»).

### Notes for reviewers (l2_bible)
- Same hint rule as l1_bible: each hint is a story/context nudge or a card/verse reference whose title does not frame the
  answer; no hint picks an option or rules out all three distractors, and no stem, option or hint answers another question
  in the same treasure. Card/picture titles quoted in hints had their emojis dropped where the emoji pointed at the answer
  (e.g. «قانونية… وثانية؟» without 📏، «تأنّوا» without 🌱، «اللسان عضو صغير» without 🐎⛵🔥).
- Hint and explain details beyond the station cards (all accurate, please confirm):
  - Station 0: يهوديت دخلت معسكر القائد بشجاعة بعد حصار مدينتها (يهوديت ٧، ١٠-١٣؛ خرجت ومعاها جاريتها، يهوديت ١٠: ١٠)؛ يوسيفوس «مؤرخ يهودي كتب تاريخ شعبه».
  - Station 1: يسوع راح بيت عنيا (يو ١١: ١، ١٨)؛ إرميا قال إنه ما يعرفش يتكلم «لأني ولد» (إر ١: ٦)؛ مت ٦: ٢٦ عن طيور السماء «وأبوكم السماوي يقوتها».
  - Station 2: لوط كان ساكن في سدوم (تك ١٣: ١٢؛ ١٩: ١)؛ distractor «اتصلب منكس» (تقليد استشهاد بطرس) is used only as a wrong option for يعقوب.
  - Station 4: «ودعي خليل الله» (يع ٢: ٢٣).
  - Station 7: أيوب خسر ولاده وفلوسه وصحته وما جدّفش (من `s7_clues`)؛ لوط ابن أخو إبراهيم كان ساكن في سدوم (تك ١٢: ٥؛ ١٤: ١٢).
- Verse tiles: commas, «!» and «؟» were dropped from verseOrder texts so tiles carry only words (words unchanged).
