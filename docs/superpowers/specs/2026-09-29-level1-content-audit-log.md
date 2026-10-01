# Level 1 Bible — content audit log (2026-09-29)

File: `level1-bible-data.js`. Scope: everything except the non-`questions` fields of each station's `games[0].data` (arcade agent).

Sources: (1) servant lesson doc (intro + eras 1-5, incl. image tables), (2) Arabic Van Dyke text (spellings checked on st-takla.org for Gen 5, Gen 11, Judg 12), (3) Coptic Orthodox teaching.

## Coverage

| Area | Reviewed |
|---|---|
| Station verses | 6 (all match Van Dyke wording and refs) |
| Cards (text / verse / image / diagram / check) | 84, incl. 21 checks |
| Arcade `questions` | 36 |
| Clue rounds | 25 |
| Swipe items | 85 |
| Timeline items | 40 |
| Tree nodes | 39 |
| Connect pairs | 10 |
| Decode verses | 10 (all verbatim Van Dyke, no tashkeel, ≤10 words) |

No wrong `correct` index was found. No 39-book OT count appears anywhere.

## Changes

| Station | Location | Old → New | Reason / source |
|---|---|---|---|
| 0 | check "كام كاتب" explain | + (٢ بط ١: ٢١) | ref |
| 0 | card "الترجمة السبعينية" | + "في كنيستنا: السبعينية اتعملت في مصر، وكنيستنا القبطية بتعتمد عليها في العهد القديم، وفيها أسفار زي طوبيا ويهوديت والحكمة" | Coptic framing; LXX is the Coptic OT basis and contains the deuterocanon |
| 0 | check "السبعينية من إيه لإيه" explain | + "سنة ٢٥٠ ق.م" | doc |
| 0 | check "دم المسيح" explain | + «هذه الكأس هي العهد الجديد بدمي» (لو ٢٢: ٢٠); "السيد المسيح" | ref, church vocabulary |
| 0 | check "بعد عصر الخروج" explain | + "بعد موسى دخل يشوع كنعان وبدأ عصر القضاة" | clarity |
| 0 | q "كام كاتب" explain | + (٢ بط ١: ٢١) | ref |
| 0 | q "السبعينية فين" explain | "في الإسكندرية" → "في الإسكندرية في مصر" | Coptic framing |
| 0 | q "العهد هو علاقة" explain | + «وأما أنت فتحفظ عهدي» (تك ١٧: ٩) | ref (verse from doc) |
| 0 | q "أول عصر" explain | + (تك ١ – ١١) | ref |
| 0 | q "العهد الجديد" explain | "المخلّص أتى وخلّصنا" → quote + (لو ٢٢: ٢٠) | ref |
| 0 | clue Hugo #1 | "عاش سنة ١٢٤٠ م" → "اسمه مرتبط بسنة ١٢٤٠ م" | 1240 is the date of the work, not his lifetime |
| 1 | check "اليوم الرابع" explain | + (تك ١: ٣، ١٦-١٩) | ref |
| 1 | card "السقوط والوعد" | «نسل المرأة يسحق رأس الحية» (in quote marks) → نسل المرأة هيسحق رأس الحية، «هو يسحق رأسك» (تك ٣: ١٥); "السيد المسيح" | the old text was a paraphrase shown as a direct quote; now uses the Van Dyke wording |
| 1 | check "نسل المرأة" q | quote marks removed from the paraphrase | same |
| 1 | card "قايين وهابيل" | + (تك ٤: ٤-٨) | ref |
| 1 | diagram نسل شيث | "مهلليل" → "مهللئيل"; "أخنوخ (صعد للسما حي)" → "أخنوخ (ربنا أخده وهو حي)" | Van Dyke spelling (تك ٥: ١٢); biblical wording "لأن الله أخذه" (تك ٥: ٢٤، عب ١١: ٥) instead of "صعد" (cf. يو ٣: ١٣) |
| 1 | check أخنوخ | q "صعد للسما وهو حي" → "ربنا أخده وهو حي من غير ما يشوف الموت"; explain quotes تك ٥: ٢٤ + متوشالح ٩٦٩ سنة (تك ٥: ٢٧) | same |
| 1 | card الطوفان | "وبعد ١٥٠ يوم بدأت رؤوس الجبال تظهر" → "وبعد ١٥٠ يوم المية بدأت تنقص ورؤوس الجبال بدأت تظهر (تك ٧: ١٢؛ ٨: ٣-٥)" | Gen 8:3-5: after 150 days the water went down; the peaks appeared later (10th month). The doc's 150 is kept |
| 1 | card برج بابل | "راعو ← ساروج" → "رعو ← سروج" + (تك ١١: ١٠-٢٦) | Van Dyke spelling |
| 1 | ark q1 explain | + "نوح ومراته وولاده التلاتة ومراتاتهم (تك ٧: ١٣؛ ١ بط ٣: ٢٠)" | ref |
| 1 | ark q2 explain | "المياه فضلت" → "المطر نزل ... (تك ٧: ١٢)" | accuracy + ref |
| 1 | ark q3 explain | + "جبال أراراط (تك ٨: ٤)" | Van Dyke wording + ref |
| 1 | ark q4 | "علامة العهد الجديد بعد الطوفان" → "علامة عهد ربنا مع نوح بعد الطوفان"; explain quotes تك ٩: ١٣ | the term "العهد الجديد" could be confused with the New Testament |
| 1 | ark q5 explain | + "نوح قدّم من الطاهرة محرقات (تك ٨: ٢٠)" | ref |
| 1 | ark q6 | "بعد كام يوم بدأت رؤوس الجبال تظهر؟" → "المية فضلت عالية على الأرض كام يوم قبل ما تبدأ تنقص؟" (answer still ١٥٠) + (تك ٧: ٢٤؛ ٨: ٣-٥) | same as the flood card |
| 1 | s1_seth timeline | "مهلليل" → "مهللئيل" | Van Dyke |
| 2 | check وعود إبراهيم explain | + (تك ١٢: ٢-٣، ٧) and why option 4 is wrong | ref |
| 2 | check إبراهيم عم لوط explain | + (تك ١١: ٢٧؛ ١٢: ٥) | ref |
| 2 | card تقديم إسحاق | "(تك ٢٢: ١٢)" was placed after the blessing → ref moved to the quote; blessing now quoted «ويتبارك في نسلك جميع أمم الأرض» (تك ٢٢: ١٨) | wrong verse for the blessing |
| 2 | check يوسف وبنيامين explain | + (تك ٣٥: ٢٤) | ref |
| 2 | joseph q1-q6 explains | refs added: تك ٣٠: ٢٢-٢٤، ٣٧: ٢٨، ٣٩: ١ ("رئيس الشرط")، ٤١: ٥١-٥٢، ٣٩: ٩ (quote)، ٤١: ٤٠-٤٣ | refs |
| 3 | check موسى في القصر explain | + (أع ٧: ٢٢-٢٣) | ref |
| 3 | check ضربة الظلام explain | + «وأصنع أحكاماً بكل آلهة المصريين. أنا الرب» (خر ١٢: ١٢) | Scripture basis for the plagues-vs-gods teaching |
| 3 | card عبور البحر | + "تسبحة موسى (خر ١٥)" + full line "الفرس وراكبه طرحهما في البحر" + "في كنيستنا: دي الهوس الأول اللي بنسبّح بيه كل يوم في تسبحة نص الليل" | Coptic framing (doc) + ref |
| 3 | check العجل الدهب explain | "وربنا غفر لهم" → "وبعدين صلى عشانهم (خر ٣٢: ٤، ١٩، ٣١-٣٢)" | ref (the card still says ربنا غفر, from the doc) |
| 3 | diagram "في البرية ٤٠ سنة" | reordered by Bible order (المن خر ١٦ → الصخرة خر ١٧ → عماليق خر ١٧ → التوهان عد ١٤ → قورح عد ١٦ → الحية عد ٢١ → سيحون وعوج عد ٢١ → بلعام عد ٢٢), refs added; قورح "ضد هارون" → "ضد موسى وهارون" (عد ١٦: ٣); التوهان "الجيل الجديد بس" → "... مع يشوع وكالب" (عد ١٤: ٣٠); الحية + "رمز للصليب (يو ٣: ١٤)"; بلعام "قصة حمارة بلعام" → "ربنا خلّى الحمارة تتكلم وتمنع بلعام (عد ٢٢: ٢٨)" | a "steps" diagram implies an order; the doc's list is not ordered. Joshua and Caleb also entered Canaan. The Christological reading comes from the words of Christ |
| 3 | card جبل نبو | + (تث ٣٤: ١-٥) | ref |
| 3 | check يشوع explain | + (عد ٢٧: ١٨؛ تث ٣١: ٧) | ref |
| 3 | redSea q1-q6 explains | refs: تك ٤٧: ٢٧/خر ١: ٧، خر ١٢: ٣٧، خر ١٥ + تسبحة نص الليل، خر ٣٤: ٢٨، خر ٨: ٦ + خر ١٢: ١٢، تث ٣٤: ١-٥ | refs |
| 3 | swipe s3_desert | "الجيل الجديد ... هو اللي دخل كنعان" → "... دخل كنعان"; "الشعب عمل الحية النحاسية عشان يعبدها" → "... من نفسه عشان يعبدها" | "هو اللي" left out Joshua and Caleb; the false item is now clearly false (Moses made it at God's command, عد ٢١: ٨) |
| 4 | check دايرة القضاة explain | + (قض ٢: ١٦-١٩؛ نح ٩: ٢٧) | ref |
| 4 | diagram القضاة (١) دبورة | "سيسرا قائد الجيش" → "سيسرا قائد جيش يابين ملك كنعان (قض ٤: ٢)" | the doc says Sisera led Midian's army (wrong, see below) |
| 4 | diagram القضاة (٢) | "إيبصان وأيلون ... إيبصان البيت لحمي ... عبدون بن هلليل" → "إبصان وإيلون وعبدون: إبصان من بيت لحم، إيلون الزبولوني، عبدون بن هليل (قض ١٢: ٨-١٣)" | Van Dyke spellings |
| 4 | check شمجر explain | + "رجل ... بمنساس البقر (قض ٣: ٣١)" | ref |
| 4 | check عالي explain | → "أولاده جلبوا اللعنة على أنفسهم وهو ما ردعهمش (١ صم ٣: ١٣)" | wording from Scripture + ref |
| 4 | card راعوث وبوعز | "بقت جدة لربنا يسوع المسيح" → "بقت من جدود السيد المسيح بالجسد (را ٤: ١٧؛ مت ١: ٥)" | precise Orthodox wording (ancestry is through His humanity) |
| 4 | diagram "من راعوث للمسيح" | last node "ربنا يسوع المسيح" → "السيد المسيح من نسل داود" | the chain made it look like David led straight to Christ |
| 4 | check راعوث explain | + quote (را ١: ٤، ١٦) | ref |
| 4 | gideon q1-q5 explains | refs: قض ٧: ٧ (quote)، ١ صم ٧: ١٥؛ ١٠: ١، يش ١٤: ٢؛ ١٨: ١٠، قض ٣: ١٥-٢١، قض ٤: ٢، ١٤-١٥ | refs |
| 4 | gideon q6 | q + "(من عثنيئيل لصموئيل)"; distractor "١٢" → "١٠" | "12 judges" is a defensible answer for the Book of Judges alone, so the question had two defensible options |
| 4 | clue يفتاح options | "إيبصان" → "إبصان" | Van Dyke |
| 5 | check الهيكل explain | "ظهر له يوم تدشينه" → "ظهر له بعد ما خلّصه (١ مل ٦: ١٤؛ ٩: ١-٣)" | 1 Kgs 9:1-3 (second appearance, after the dedication) |
| 5 | card إيليا | + (١ مل ١٨: ٢١) | ref |
| 5 | check الكرمل explain | + "نار الرب وأكلت المحرقة (١ مل ١٨: ١٩، ٣٨)" | ref |
| 5 | card طوبيا | «يا رب ارحمني» (in quote marks) → "صلى لربنا وطلب رحمته"; + "في كنيستنا: سفر طوبيا من أسفار العهد القديم" | not a verbatim quote (see طو ٣); Coptic canon |
| 5 | check نعمان explain | + (٢ مل ٥: ١٤) | ref |
| 5 | sling q1-q5 explains | refs: ١ صم ٩: ١-٢؛ ١٠: ١، ١ صم ١٦: ١ / را ٤: ٢٢، ١ مل ٦: ١٤، ١ مل ١٦: ٢٤، ٢ مل ٢٥: ٨-١١ | refs |
| 5 | swipe s5_kings | removed the Saul item "صموئيل مسح داود ملك في عهده" | it fits both the Saul and David bins (a duplicate of David's "مسحه عوضاً عن شاول") |
| 5 | swipe s5_kings | "ربنا ظهر له يوم تدشين الهيكل" → "ربنا ظهر له بعد ما دشّن الهيكل" | 1 Kgs 9:1-3 / 2 Chr 7:12 |
| 5 | swipe s5_kings | "كتب الأمثال والجامعة ونشيد الأنشاد" → "... والحكمة" | doc lists الحكمة; the Wisdom of Solomon is canonical in the Coptic Church |
| 5 | swipe s5_north_south | "ملكها رحبعام" → "أول ملك ليها رحبعام ابن سليمان" | Rehoboam was only the first of many kings |

Not changed (checked OK, outside my scope): the langLibrary gate items (Hebrew/Aramaic/Greek facts, e.g. طليثا قومي / أبا / ماران آثا = Aramaic) are correct. The Joseph arcade stages are fine.

Egypt's blessing ("مبارك شعبي مصر" إش ١٩: ٢٥) was not added: no station is about Egypt as a blessed people (Exodus is about judgment on Egypt's gods), so it did not fit.

## Items to confirm with the servant

These are cases where the doc itself seems wrong or unclear. The doc's text was kept as-is unless a row above says otherwise.

1. **Fall of the northern kingdom, "٧٢٧ ق.م"** (card + swipe "انتهت سنة ٧٢٧ ق.م"). Samaria fell in **722/721 ق.م** (٢ مل ١٧: ٦). 727 is the year Shalmaneser V took the throne. Suggest changing to ٧٢٢.
2. **Sisera "قائد جيش مديان"** (doc). Sisera was the army commander of **يابين ملك كنعان** (قض ٤: ٢). Midian is Gideon's enemy. The card now says Canaan; please confirm.
3. **Patriarchs' dates "١٦٦١ - ١٨٧٦ ق.م"** (doc; not shown in the app). The first number looks like a typo for ~٢١٦٦ (Abraham's birth) or ~٢٠٩١ (his call). Please give the intended range before it is used.
4. **Solomon "تاب في شيخوخته"** (column + swipe). ١ مل ١١: ٤ says that in his old age his wives turned his heart to other gods. His repentance comes from church tradition (linked to سفر الجامعة). Kept per the doc. Please confirm you want it taught as a fact.
5. **Plagues vs gods table.** This is an extra-biblical tradition; only خر ١٢: ١٢ is Scripture. Specific doubts:
   - **"البرد والنار: إله الهواء إيزيس".** Isis is not an air god (air = شو، sky = نوت). Usual lists give نوت for hail.
   - **"الضفادع: حيكا-حابي".** The frog goddess is usually حقت (Heqet). حابي is the Nile god.
   - **"الجراد: إله الخصب".** Unnamed; often given as سِت or أوزوريس.
   
   These are kept exactly, because the connect game and the questions are keyed to the table.
6. **Chapters and verses "الكاردينال هوجو ١٢٤٠ م".** Chapters are usually credited to Stephen Langton (~١٢٢٧ م); Hugo de Saint-Cher (~١٢٤٠) used and spread them. Verse numbers came later: Rabbi Nathan (OT, ~١٤٤٨) and Robert Estienne (NT, ١٥٥١). Kept per the doc. Consider softening to "التقسيم لإصحاحات بدأ حوالي القرن ١٣".
7. **Mountain tops "بعد ١٥٠ يوم"** (doc). By تك ٨: ٣-٥ the water started going down after 150 days, and the peaks appeared in the 10th month. The wording was clarified (above); the number 150 is kept.
8. **"أخنوخ صعد إلى السماء حيا"** (doc). Reworded to the biblical "الله أخذه / نُقل لكي لا يرى الموت" (تك ٥: ٢٤؛ عب ١١: ٥). Same teaching, Scripture's words.
9. **Number of judges "١٤".** The count only works if Eli and Samuel are included and Barak is not counted separately. The question now says "من عثنيئيل لصموئيل". The Book of Judges alone is usually counted as 12.
10. **Southern kingdom "١٩ ملك"** (doc). Judah had 19 kings plus Queen Athaliah (20 rulers). Fine for kids; confirm.
11. **Luke 3:36** lists قينان between أرفكشاد and شالح (as in the Septuagint Genesis). The card follows Gen 11 in Van Dyke, which does not have him. No change; note only.
12. **Liturgical wording of the first Hoos:** "فلنسبح للرب" (doc) vs "فلنسبح الرب" (common print). Kept the doc's wording.
