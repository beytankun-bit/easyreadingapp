/**
 * EasyReading — Re-engagement Push (FCM)
 * Her 6 saatte bir çalışır. 6 saattir girmeyen ve henüz bildirilmemiş
 * (ya da son bildirimden 6+ saat geçmiş) kullanıcılara, kendi dillerinde
 * "sen yoksun" bildirimi gönderir.
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { onCall } = require("firebase-functions/v2/https");
const textToSpeech = require("@google-cloud/text-to-speech");
const ttsClient = new textToSpeech.TextToSpeechClient();

initializeApp();
const db = getFirestore();

// ── 10 mesajlık havuz ──
const MESSAGES = [
  {
    tr: { t: "Bir şey eksikti bugün 🤍", b: "Sonra fark ettik… sen yoksun 📖" },
    de: { t: "Heute hat etwas gefehlt 🤍", b: "Dann merkten wir… du warst nicht da 📖" },
    fr: { t: "Il manquait quelque chose aujourd'hui 🤍", b: "On a réalisé… c'était toi qui manquais 📖" },
    es: { t: "Algo faltaba hoy 🤍", b: "Luego nos dimos cuenta… eras tú 📖" },
    it: { t: "Mancava qualcosa oggi 🤍", b: "Poi abbiamo capito… mancavi tu 📖" },
    pt: { t: "Algo estava faltando hoje 🤍", b: "Então percebemos… era você 📖" },
    ru: { t: "Сегодня чего-то не хватало 🤍", b: "Потом поняли… тебя не было 📖" },
    ar: { t: "كان هناك شيء ناقص اليوم 🤍", b: "ثم أدركنا… لم تكن هنا 📖" },
    zh: { t: "今天少了点什么 🤍", b: "后来我们发现…是你不在 📖" },
    ja: { t: "今日、何かが足りなかった 🤍", b: "そして気づいた…あなたがいなかった 📖" },
    ko: { t: "오늘 뭔가 부족했어요 🤍", b: "그리고 알았어요… 당신이 없었어요 📖" },
    nl: { t: "Er ontbrak iets vandaag 🤍", b: "Toen beseften we… jij was er niet 📖" },
    pl: { t: "Czegoś brakowało dziś 🤍", b: "Potem zdaliśmy sobie sprawę… ciebie nie było 📖" },
    uk: { t: "Сьогодні чогось бракувало 🤍", b: "Потім зрозуміли… тебе не було 📖" },
    bg: { t: "Днес нещо липсваше 🤍", b: "После разбрахме… теб те нямаше 📖" },
    en: { t: "Something was missing today 🤍", b: "Then we realized… it was you 📖" },
    el: { t: "Κάτι έλειπε σήμερα 🤍", b: "Μετά καταλάβαμε… ήσουν εσύ 📖" },
    hi: { t: "आज कुछ कमी थी 🤍", b: "फिर हमें एहसास हुआ… वो तुम थे 📖" },
  },
  {
    tr: { t: "Kitabın seni son çevrimiçi gördüğünde Mayıs'tı 👀📚", b: "Geri dönme vakti geldi mi? 😄" },
    de: { t: "Dein Buch hat dich zuletzt im Mai gesehen 👀📚", b: "Zeit zurückzukommen? 😄" },
    fr: { t: "Ton livre t'a vu pour la dernière fois en mai 👀📚", b: "C'est le moment de revenir ? 😄" },
    es: { t: "Tu libro te vio por última vez en mayo 👀📚", b: "¿Es hora de volver? 😄" },
    it: { t: "Il tuo libro ti ha visto l'ultima volta a maggio 👀📚", b: "È ora di tornare? 😄" },
    pt: { t: "Seu livro te viu pela última vez em maio 👀📚", b: "Hora de voltar? 😄" },
    ru: { t: "Твоя книга видела тебя последний раз в мае 👀📚", b: "Пора вернуться? 😄" },
    ar: { t: "رآك كتابك آخر مرة في مايو 👀📚", b: "حان وقت العودة؟ 😄" },
    zh: { t: "你的书上次见到你是在五月 👀📚", b: "是时候回来了吗？ 😄" },
    ja: { t: "あなたの本が最後にあなたを見たのは5月でした 👀📚", b: "戻る時間ですか？ 😄" },
    ko: { t: "당신의 책이 당신을 마지막으로 본 게 5월이었어요 👀📚", b: "돌아올 시간인가요? 😄" },
    nl: { t: "Je boek zag je voor het laatst in mei 👀📚", b: "Tijd om terug te komen? 😄" },
    pl: { t: "Twoja książka widziała cię ostatnio w maju 👀📚", b: "Czas wrócić? 😄" },
    uk: { t: "Твоя книга бачила тебе востаннє в травні 👀📚", b: "Час повернутися? 😄" },
    bg: { t: "Книгата ти те видя за последен път през май 👀📚", b: "Дошло ли е времето да се върнеш? 😄" },
    en: { t: "Your book last saw you online in May 👀📚", b: "Time to come back? 😄" },
    el: { t: "Το βιβλίο σου σε είδε τελευταία φορά online τον Μάιο 👀📚", b: "Ώρα να επιστρέψεις; 😄" },
    hi: { t: "आपकी किताब ने आपको आखिरी बार मई में ऑनलाइन देखा था 👀📚", b: "वापस आने का समय है? 😄" },
  },
  {
    tr: { t: "Bugün de okumayı yarına mı bırakıyoruz? 😄", b: "EasyReading seni bekliyor 📖" },
    de: { t: "Verschieben wir das Lesen wieder auf morgen? 😄", b: "EasyReading wartet auf dich 📖" },
    fr: { t: "On remet encore la lecture à demain ? 😄", b: "EasyReading t'attend 📖" },
    es: { t: "¿Dejamos la lectura para mañana otra vez? 😄", b: "EasyReading te espera 📖" },
    it: { t: "Rimandiamo ancora la lettura a domani? 😄", b: "EasyReading ti aspetta 📖" },
    pt: { t: "Vamos deixar a leitura para amanhã de novo? 😄", b: "EasyReading está te esperando 📖" },
    ru: { t: "Снова переносим чтение на завтра? 😄", b: "EasyReading ждёт тебя 📖" },
    ar: { t: "هل نؤجل القراءة إلى الغد مرة أخرى؟ 😄", b: "EasyReading ينتظرك 📖" },
    zh: { t: "今天又把阅读推到明天吗？ 😄", b: "EasyReading 在等你 📖" },
    ja: { t: "また読書を明日に回しますか？ 😄", b: "EasyReadingがあなたを待っています 📖" },
    ko: { t: "또 오늘 독서를 내일로 미룰 건가요? 😄", b: "EasyReading이 기다리고 있어요 📖" },
    nl: { t: "Stellen we het lezen weer uit tot morgen? 😄", b: "EasyReading wacht op je 📖" },
    pl: { t: "Znowu odkładamy czytanie na jutro? 😄", b: "EasyReading czeka na ciebie 📖" },
    uk: { t: "Знову переносимо читання на завтра? 😄", b: "EasyReading чекає на тебе 📖" },
    bg: { t: "Пак отлагаме четенето за утре? 😄", b: "EasyReading те чака 📖" },
    en: { t: "Leaving reading for tomorrow again? 😄", b: "EasyReading is waiting for you 📖" },
    el: { t: "Αφήνεις πάλι το διάβασμα για αύριο; 😄", b: "Το EasyReading σε περιμένει 📖" },
    hi: { t: "फिर से पढ़ाई कल के लिए छोड़ रहे हो? 😄", b: "EasyReading आपका इंतज़ार कर रहा है 📖" },
  },
  {
    tr: { t: "Birkaç sayfa okusan kimseye söylemeyiz 🤫😄", b: "Sadece aramızda kalsın 📖" },
    de: { t: "Wenn du ein paar Seiten liest, sagen wir's niemandem 🤫😄", b: "Bleibt unter uns 📖" },
    fr: { t: "Si tu lis quelques pages, on ne dira rien à personne 🤫😄", b: "Ça reste entre nous 📖" },
    es: { t: "Si lees unas páginas, no se lo decimos a nadie 🤫😄", b: "Queda entre nosotros 📖" },
    it: { t: "Se leggi qualche pagina, non lo diciamo a nessuno 🤫😄", b: "Rimane tra noi 📖" },
    pt: { t: "Se você ler algumas páginas, não contamos pra ninguém 🤫😄", b: "Fica entre nós 📖" },
    ru: { t: "Прочитаешь пару страниц — никому не скажем 🤫😄", b: "Останется между нами 📖" },
    ar: { t: "لو قرأت بضع صفحات، لن نخبر أحداً 🤫😄", b: "تبقى بيننا 📖" },
    zh: { t: "如果你读几页，我们不会告诉任何人 🤫😄", b: "就在我们之间 📖" },
    ja: { t: "数ページ読んでも誰にも言いませんよ 🤫😄", b: "内緒にしておきます 📖" },
    ko: { t: "몇 페이지 읽어도 아무한테도 말 안 해요 🤫😄", b: "우리끼리 비밀이에요 📖" },
    nl: { t: "Als je een paar pagina's leest, zeggen we het aan niemand 🤫😄", b: "Blijft onder ons 📖" },
    pl: { t: "Jak przeczytasz kilka stron, nikomu nie powiemy 🤫😄", b: "To zostaje między nami 📖" },
    uk: { t: "Прочитаєш кілька сторінок — нікому не скажемо 🤫😄", b: "Залишиться між нами 📖" },
    bg: { t: "Ако прочетеш няколко страници, няма да кажем на никого 🤫😄", b: "Остава между нас 📖" },
    en: { t: "Read a few pages and we won't tell anyone 🤫😄", b: "Just between us 📖" },
    el: { t: "Διάβασε λίγες σελίδες και δεν θα πούμε τίποτα σε κανέναν 🤫😄", b: "Μείνει μεταξύ μας 📖" },
    hi: { t: "कुछ पन्ने पढ़ लो, हम किसी को नहीं बताएंगे 🤫😄", b: "बस हमारे बीच की बात 📖" },
  },
  {
    tr: { t: "Dikkat! 🚨 Uzun süre okunmayan kitaplar trip atabilir.", b: "Hemen bir göz at 📖" },
    de: { t: "Achtung! 🚨 Lange ungelesene Bücher können schmollen.", b: "Schau schnell rein 📖" },
    fr: { t: "Attention ! 🚨 Les livres non lus trop longtemps peuvent bouder.", b: "Jette un œil 📖" },
    es: { t: "¡Atención! 🚨 Los libros sin leer por mucho tiempo pueden protestar.", b: "Échales un vistazo 📖" },
    it: { t: "Attenzione! 🚨 I libri non letti a lungo possono fare i capricci.", b: "Dagli un'occhiata 📖" },
    pt: { t: "Atenção! 🚨 Livros não lidos por muito tempo podem reclamar.", b: "Dê uma olhada 📖" },
    ru: { t: "Внимание! 🚨 Давно непрочитанные книги могут обидеться.", b: "Загляни скорее 📖" },
    ar: { t: "تنبيه! 🚨 الكتب غير المقروءة لفترة طويلة قد تتذمر.", b: "ألقِ نظرة سريعة 📖" },
    zh: { t: "注意！🚨 长时间未读的书可能会闹情绪。", b: "快去看看 📖" },
    ja: { t: "注意！🚨 長い間読まれていない本はふてくされるかもしれません。", b: "ちょっと見てあげて 📖" },
    ko: { t: "주의! 🚨 오래 읽지 않은 책들이 삐칠 수 있어요.", b: "얼른 들여다봐요 📖" },
    nl: { t: "Let op! 🚨 Lang ongelezen boeken kunnen pruilen.", b: "Kijk even snel 📖" },
    pl: { t: "Uwaga! 🚨 Długo nieczytane książki mogą się obrazić.", b: "Rzuć okiem 📖" },
    uk: { t: "Увага! 🚨 Довго непрочитані книги можуть образитися.", b: "Заглянь швидше 📖" },
    bg: { t: "Внимание! 🚨 Дълго непрочетените книги може да се наобидят.", b: "Погледни набързо 📖" },
    en: { t: "Warning! 🚨 Books left unread for too long may throw a tantrum.", b: "Go check on them 📖" },
    el: { t: "Προσοχή! 🚨 Τα βιβλία που μένουν αδιάβαστα για πολύ καιρό μπορεί να θυμώσουν.", b: "Πήγαινε να τα δεις 📖" },
    hi: { t: "चेतावनी! 🚨 बहुत लंबे समय तक न पढ़ी गई किताबें नाराज़ हो सकती हैं।", b: "जाकर देख लो 📖" },
  },
  {
    tr: { t: "Birkaç sayfa okuyup çıkacağız... Muhtemelen. 😄", b: "EasyReading hazır 📖" },
    de: { t: "Wir lesen nur ein paar Seiten... Wahrscheinlich. 😄", b: "EasyReading ist bereit 📖" },
    fr: { t: "On lit juste quelques pages... Probablement. 😄", b: "EasyReading est prêt 📖" },
    es: { t: "Solo leeremos unas páginas... Probablemente. 😄", b: "EasyReading está listo 📖" },
    it: { t: "Leggiamo solo qualche pagina... Probabilmente. 😄", b: "EasyReading è pronto 📖" },
    pt: { t: "Vamos ler só algumas páginas... Provavelmente. 😄", b: "EasyReading está pronto 📖" },
    ru: { t: "Прочитаем пару страниц и всё... Наверное. 😄", b: "EasyReading готов 📖" },
    ar: { t: "سنقرأ بضع صفحات فقط... على الأرجح. 😄", b: "EasyReading جاهز 📖" },
    zh: { t: "就读几页然后退出…大概吧。 😄", b: "EasyReading 已就绪 📖" },
    ja: { t: "数ページだけ読んで終わりにします…たぶん。 😄", b: "EasyReadingの準備ができています 📖" },
    ko: { t: "몇 페이지만 읽고 나올 거예요... 아마도. 😄", b: "EasyReading 준비됐어요 📖" },
    nl: { t: "We lezen maar een paar pagina's... Waarschijnlijk. 😄", b: "EasyReading staat klaar 📖" },
    pl: { t: "Przeczytamy tylko kilka stron... Prawdopodobnie. 😄", b: "EasyReading gotowy 📖" },
    uk: { t: "Прочитаємо кілька сторінок і все... Мабуть. 😄", b: "EasyReading готовий 📖" },
    bg: { t: "Ще прочетем само няколко страници... Вероятно. 😄", b: "EasyReading е готов 📖" },
    en: { t: "Just reading a few pages and leaving... Probably. 😄", b: "EasyReading is ready 📖" },
    el: { t: "Θα διαβάσουμε μόνο λίγες σελίδες και θα φύγουμε... Μάλλον. 😄", b: "Το EasyReading είναι έτοιμο 📖" },
    hi: { t: "बस कुछ पन्ने पढ़कर निकल जाएंगे... शायद। 😄", b: "EasyReading तैयार है 📖" },
  },
  {
    tr: { t: "Sadece 5 dakika... 😇", b: "Evet, geçen sefer de öyle demiştik. 📖" },
    de: { t: "Nur 5 Minuten... 😇", b: "Ja, das haben wir letztes Mal auch gesagt. 📖" },
    fr: { t: "Juste 5 minutes... 😇", b: "Oui, c'est ce qu'on a dit la dernière fois aussi. 📖" },
    es: { t: "Solo 5 minutos... 😇", b: "Sí, eso mismo dijimos la última vez también. 📖" },
    it: { t: "Solo 5 minuti... 😇", b: "Sì, l'abbiamo detto anche l'ultima volta. 📖" },
    pt: { t: "Só 5 minutos... 😇", b: "Sim, foi o que dissemos da última vez também. 📖" },
    ru: { t: "Всего 5 минут... 😇", b: "Да, мы так говорили и в прошлый раз. 📖" },
    ar: { t: "5 دقائق فقط... 😇", b: "نعم، هذا ما قلناه في المرة الماضية أيضاً. 📖" },
    zh: { t: "就5分钟... 😇", b: "是的，上次我们也是这么说的。 📖" },
    ja: { t: "5分だけ... 😇", b: "そう、前回もそう言いましたよね。 📖" },
    ko: { t: "5분만... 😇", b: "네, 지난번에도 그렇게 말했죠. 📖" },
    nl: { t: "Maar 5 minuten... 😇", b: "Ja, dat zeiden we de vorige keer ook. 📖" },
    pl: { t: "Tylko 5 minut... 😇", b: "Tak, tak samo mówiliśmy ostatnim razem. 📖" },
    uk: { t: "Лише 5 хвилин... 😇", b: "Так, ми так само казали минулого разу. 📖" },
    bg: { t: "Само 5 минути... 😇", b: "Да, това казахме и миналия път. 📖" },
    en: { t: "Just 5 minutes... 😇", b: "Yes, that's what we said last time too. 📖" },
    el: { t: "Μόνο 5 λεπτά... 😇", b: "Ναι, αυτό είπαμε και την προηγούμενη φορά. 📖" },
    hi: { t: "बस 5 मिनट... 😇", b: "हाँ, पिछली बार भी यही कहा था। 📖" },
  },
  {
    tr: { t: "Kitapla aranızın açılması beni üzer 👋📚", b: "Barışın zamanı geldi 📖" },
    de: { t: "Es macht mich traurig, wenn du dich mit deinem Buch zerstreitest 👋📚", b: "Zeit zur Versöhnung 📖" },
    fr: { t: "Ça me rend triste de vous voir te fâcher avec ton livre 👋📚", b: "Il est temps de faire la paix 📖" },
    es: { t: "Me entristece que te distancies de tu libro 👋📚", b: "Es hora de reconciliarse 📖" },
    it: { t: "Mi rattristisce vederti allontanare dal tuo libro 👋📚", b: "È ora di fare pace 📖" },
    pt: { t: "Fico triste quando você se afasta do seu livro 👋📚", b: "Hora de fazer as pazes 📖" },
    ru: { t: "Мне грустно, когда вы с книгой в размолвке 👋📚", b: "Пора помириться 📖" },
    ar: { t: "يحزنني أن تبتعد عن كتابك 👋📚", b: "حان وقت المصالحة 📖" },
    zh: { t: "看到你和书疏远让我难过 👋📚", b: "是时候和好了 📖" },
    ja: { t: "本とのあいだに距離ができるのは悲しい 👋📚", b: "仲直りする時間です 📖" },
    ko: { t: "책과 사이가 멀어지는 게 슬퍼요 👋📚", b: "화해할 시간이에요 📖" },
    nl: { t: "Het maakt me verdrietig als jij en je boek uit elkaar groeien 👋📚", b: "Tijd om het goed te maken 📖" },
    pl: { t: "Smuci mnie, gdy oddalasz się od swojej książki 👋📚", b: "Czas na pojednanie 📖" },
    uk: { t: "Мені сумно, коли ти й книга сваритеся 👋📚", b: "Час помиритися 📖" },
    bg: { t: "Тъжно ми е, когато се отдалечаваш от книгата си 👋📚", b: "Дошло е времето за помирение 📖" },
    en: { t: "It makes me sad when you and your book drift apart 👋📚", b: "Time to make up 📖" },
    el: { t: "Με στενοχωρεί όταν εσύ και το βιβλίο σου απομακρύνεστε 👋📚", b: "Ώρα να τα φτιάξετε 📖" },
    hi: { t: "मुझे दुख होता है जब तुम अपनी किताब से दूर हो जाते हो 👋📚", b: "सुलह का समय है 📖" },
  },
  {
    tr: { t: "Okuma hedeflerin hâlâ sana inanıyor 🥹", b: "Sen de inan kendine 📖" },
    de: { t: "Deine Leseziele glauben noch an dich 🥹", b: "Glaub auch du an dich 📖" },
    fr: { t: "Tes objectifs de lecture croient encore en toi 🥹", b: "Crois en toi aussi 📖" },
    es: { t: "Tus metas de lectura todavía creen en ti 🥹", b: "Tú también créete 📖" },
    it: { t: "I tuoi obiettivi di lettura credono ancora in te 🥹", b: "Credi anche tu in te stesso 📖" },
    pt: { t: "Suas metas de leitura ainda acreditam em você 🥹", b: "Acredite em você também 📖" },
    ru: { t: "Твои цели по чтению всё ещё верят в тебя 🥹", b: "Верь и ты в себя 📖" },
    ar: { t: "أهدافك في القراءة لا تزال تؤمن بك 🥹", b: "آمن بنفسك أيضاً 📖" },
    zh: { t: "你的阅读目标还在相信你 🥹", b: "你也要相信自己 📖" },
    ja: { t: "あなたの読書目標はまだあなたを信じています 🥹", b: "あなたも自分を信じて 📖" },
    ko: { t: "당신의 독서 목표들이 아직도 당신을 믿고 있어요 🥹", b: "당신도 스스로를 믿어요 📖" },
    nl: { t: "Je leesdoelen geloven nog steeds in jou 🥹", b: "Geloof ook in jezelf 📖" },
    pl: { t: "Twoje cele czytelnicze wciąż w ciebie wierzą 🥹", b: "Ty też wierz w siebie 📖" },
    uk: { t: "Твої читацькі цілі все ще вірять у тебе 🥹", b: "Вір і ти в себе 📖" },
    bg: { t: "Целите ти за четене все още вярват в теб 🥹", b: "Вярвай и ти в себе си 📖" },
    en: { t: "Your reading goals still believe in you 🥹", b: "Believe in yourself too 📖" },
    el: { t: "Οι στόχοι ανάγνωσής σου ακόμα πιστεύουν σε σένα 🥹", b: "Πίστεψε κι εσύ στον εαυτό σου 📖" },
    hi: { t: "आपके पढ़ने के लक्ष्य अभी भी आप पर विश्वास करते हैं 🥹", b: "खुद पर भी विश्वास करो 📖" },
  },
  {
    tr: { t: "Bir bölüm, bir makale, birkaç dakika... 📖", b: "Gerisini sen halledersin 😄" },
    de: { t: "Ein Kapitel, ein Artikel, ein paar Minuten... 📖", b: "Den Rest schaffst du 😄" },
    fr: { t: "Un chapitre, un article, quelques minutes... 📖", b: "Tu gères le reste 😄" },
    es: { t: "Un capítulo, un artículo, unos minutos... 📖", b: "El resto lo manejas tú 😄" },
    it: { t: "Un capitolo, un articolo, qualche minuto... 📖", b: "Il resto lo gestisci tu 😄" },
    pt: { t: "Um capítulo, um artigo, alguns minutos... 📖", b: "O resto você resolve 😄" },
    ru: { t: "Одна глава, одна статья, несколько минут... 📖", b: "Остальное ты сам разберёшься 😄" },
    ar: { t: "فصل واحد، مقال واحد، بضع دقائق... 📖", b: "الباقي ستتولاه أنت 😄" },
    zh: { t: "一章、一篇文章、几分钟... 📖", b: "其余的你来搞定 😄" },
    ja: { t: "1章、1記事、数分... 📖", b: "あとはあなた次第 😄" },
    ko: { t: "챕터 하나, 기사 하나, 몇 분... 📖", b: "나머지는 네가 알아서 해요 😄" },
    nl: { t: "Eén hoofdstuk, één artikel, een paar minuten... 📖", b: "De rest red jij wel 😄" },
    pl: { t: "Jeden rozdział, jeden artykuł, kilka minut... 📖", b: "Resztę sam ogarniesz 😄" },
    uk: { t: "Один розділ, одна стаття, кілька хвилин... 📖", b: "Решту ти сам розберешся 😄" },
    bg: { t: "Една глава, една статия, няколко минути... 📖", b: "Останалото ти сам ще се оправиш 😄" },
    en: { t: "One chapter, one article, a few minutes... 📖", b: "You'll handle the rest 😄" },
    el: { t: "Ένα κεφάλαιο, ένα άρθρο, λίγα λεπτά... 📖", b: "Τα υπόλοιπα τα αναλαμβάνεις εσύ 😄" },
    hi: { t: "एक अध्याय, एक लेख, कुछ मिनट... 📖", b: "बाकी आप संभाल लेंगे 😄" },
  },
];

function pickLang(raw) {
  if (!raw) return "en";
  const code = String(raw).split("-")[0].toLowerCase();
  return MESSAGES[0][code] ? code : "en";
}

// ── FCM gönderim yardımcı fonksiyonu ──
async function _sendFcm(token, title, body, data) {
  try {
    await getMessaging().send({
      token,
      notification: { title, body },
      data,
    });
  } catch (err) {
    console.error(`FCM gonderim hatasi (${token}):`, err.message);
  }
}

// ── Her 6 saatte bir çalışan zamanlanmış fonksiyon ──
exports.reengagementPush = onSchedule(
  { schedule: "0 */6 * * *", timeZone: "UTC", region: "europe-west3", timeoutSeconds: 300 },
  async () => {
    const now = Date.now();
    const INACTIVITY_MS = 6 * 60 * 60 * 1000; // 6 saat
    const cutoff = Timestamp.fromMillis(now - INACTIVITY_MS);

    // lastActive cutoff'tan eski VE (notifiedAt hic yok YA DA notifiedAt cutoff'tan eski)
    const [neverNotifiedSnap, staleNotifiedSnap] = await Promise.all([
      db.collection("er_users")
        .where("lastActive", "<", cutoff)
        .where("notifiedAt", "==", null)
        .get(),
      db.collection("er_users")
        .where("lastActive", "<", cutoff)
        .where("notifiedAt", "<", cutoff)
        .get(),
    ]);

    // iki sonucu birlestir, ayni kullanici iki listede de olabilir
    const docsMap = new Map();
    [...neverNotifiedSnap.docs, ...staleNotifiedSnap.docs].forEach((d) => docsMap.set(d.id, d));

    let sent = 0;
    for (const doc of docsMap.values()) {
      const data = doc.data();
      const token = data.token;
      if (!token) continue;

      const lang = pickLang(data.lang);
      const pool = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
      const { t: title, b: body } = pool[lang];

      await _sendFcm(token, title, body, { type: "reengagement" });
      await doc.ref.set({ notifiedAt: Timestamp.now() }, { merge: true });
      sent++;
    }
    console.log(`reengagementPush: ${sent} bildirim gonderildi.`);
  }
);

// ── GEÇİCİ: Türkçe seslerin tam listesini görmek için ──
exports.listTurkishVoices = onCall(
  { region: "europe-west3" },
  async () => {
    const [result] = await ttsClient.listVoices({ languageCode: "tr-TR" });
    return {
      voices: result.voices.map((v) => ({
        name: v.name,
        gender: v.ssmlGender,
        naturalSampleRateHertz: v.naturalSampleRateHertz,
      })),
    };
  }
);

// ── Türkçe (iOS) için bulut TTS: metni SSML mark'larla böler,
// WaveNet-B (erkek) ile seslendirir, ses + kelime zaman damgalarını döner ──
exports.synthesizeTurkishTts = onCall(
  { region: "europe-west3", timeoutSeconds: 60 },
  async (request) => {
    const text = (request.data && request.data.text) || "";
    if (!text.trim()) {
      throw new Error("text bos olamaz");
    }

    // Kelimelere ayır, her kelimenin önüne bir <mark> koy
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    const ssmlParts = words.map(
      (w, i) => `<mark name="w${i}"/>${escapeXml(w)}`
    );
    const ssml = `<speak>${ssmlParts.join(" ")}</speak>`;

    const [response] = await ttsClient.synthesizeSpeech({
      input: { ssml },
      voice: { languageCode: "tr-TR", name: "tr-TR-Wavenet-B" },
      audioConfig: { audioEncoding: "MP3" },
      enableTimePointing: ["SSML_MARK"],
    });

    return {
      audioContent: response.audioContent.toString("base64"),
      timepoints: (response.timepoints || []).map((tp) => ({
        markName: tp.markName,
        timeSeconds: tp.timeSeconds,
      })),
      wordCount: words.length,
    };
  }
);

function escapeXml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}