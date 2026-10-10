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
- Hints (fix round 1): each hint is a story or reference nudge that still needs the child to know the fact; no letter hints,
  no hints that eliminate every distractor, no hints that repeat a word or idea found only in the correct option. A few hints
  use accurate Bible details beyond the station cards: عد ١٦: ١، ٣٢ (قورح لاوي والأرض بلعته)، قض ١٦: ٥ (فضة دليلة)، شعر شمشون،
  قض ٤: ٣ (٩٠٠ مركبة حديد)، تك ١٣: ٩، تك ١: ٣، تك ٨: ٤، ١ صم ١٥ (غنائم عماليق)، عد ١٤ (الجاسوسين الأمناء)، يو ٣ (نيقوديموس)،
  طو ٥ (رافائيل في شكل إنسان)، ١ مل ١٧: ٣ (إيليا مستخبي عند كريث).
- Verses copied from station data had their tanween / shadda removed so the verse tiles carry no tashkeel
  (e.g. «رجلا ناجحا»، «شرا ... خيرا»، «كلاما»، «أحكاما»، «ملكا»، «إلي»). Words are otherwise unchanged.
- Station verse texts (مز ٧٨: ٥٢-٥٣، ١ صم ١٢: ١٢-١٣) are copied as they appear in the station data; please confirm they match
  the Van Dyke edition used by the servants.
