/* ==========================================================================
   GILDSPINE — Stay Gold
   js/data.js  ·  Весь контент сайта в JS-объектах (RU / EN)

   ПОДКЛЮЧЕНИЕ (до скриптов страницы, после i18n.js):
     <script src="js/i18n.js" defer></script>
     <script src="js/data.js" defer></script>
     <script src="js/music.js" defer></script>   ← скрипт конкретной страницы

   ДОСТУП К ДАННЫМ
     const D = window.GildspineData;
     D.tracks, D.books, D.chapters, D.characters, D.abysses, D.links, ...

   ЛОКАЛИЗУЕМЫЕ ПОЛЯ
     Поля вида { ru: '...', en: '...' } достаются через D.tr(поле) —
     язык берётся из GildspineI18n.getLang(). Если у поля есть массив абзацев
     { ru: ['...', '...'], en: ['...', '...'] }, D.tr() вернёт массив.
     При смене языка слушайте событие:
       document.addEventListener('gildspine:languagechange', render);

   ВАЖНО: всё, что помечено REPLACE_… — заглушки. Замените их реальными
   ссылками, ID и адресами кошельков перед публикацией.
   ========================================================================== */

(function () {
  'use strict';

  /* ========================================================================
     1. СТИЛИ МУЗЫКИ (20 штук для фильтров)
        category: 'main' — 10 основных томов, 'experimental' — 10 экспериментальных
        Поле name — точное название жанра, именно его используют tracks[].style
     ======================================================================== */
  var musicStyles = [
    /* --- 10 основных томов --- */
    { id: 'dark-trap',          name: 'Dark Trap',            category: 'main', volume: 1 },
    { id: 'phonk-drift',        name: 'Phonk / Drift',        category: 'main', volume: 2 },
    { id: 'witch-house',        name: 'Witch House',          category: 'main', volume: 3 },
    { id: 'industrial-bass',    name: 'Industrial Bass',      category: 'main', volume: 4 },
    { id: 'dark-ambient',       name: 'Dark Ambient',         category: 'main', volume: 5 },
    { id: 'cyberpunk-midtempo', name: 'Cyberpunk / Midtempo', category: 'main', volume: 6 },
    { id: 'gothic-trap',        name: 'Gothic Trap',          category: 'main', volume: 7 },
    { id: 'orchestral-dark',    name: 'Orchestral Dark',      category: 'main', volume: 8 },
    { id: 'hardwave',           name: 'Hardwave',             category: 'main', volume: 9 },
    { id: 'shadow-rap',         name: 'Shadow Rap',           category: 'main', volume: 10 },

    /* --- 10 экспериментальных --- */
    { id: 'ritual-noise',       name: 'Ritual Noise',         category: 'experimental', volume: null },
    { id: 'glitch-core',        name: 'Glitch Core',          category: 'experimental', volume: null },
    { id: 'void-techno',        name: 'Void Techno',          category: 'experimental', volume: null },
    { id: 'doom-synth',         name: 'Doom Synth',           category: 'experimental', volume: null },
    { id: 'ethereal-dark',      name: 'Ethereal Dark',        category: 'experimental', volume: null },
    { id: 'metal-trap',         name: 'Metal Trap',           category: 'experimental', volume: null },
    { id: 'sub-bass',           name: 'Sub Bass',             category: 'experimental', volume: null },
    { id: 'cinematic-score',    name: 'Cinematic Score',      category: 'experimental', volume: null },
    { id: 'broken-beat',        name: 'Broken Beat',          category: 'experimental', volume: null },
    { id: 'abyssal-drone',      name: 'Abyssal Drone',        category: 'experimental', volume: null }
  ];

  /* Подписи категорий для табов-фильтров */
  var musicCategories = [
    { id: 'all',          label: { ru: 'Все',              en: 'All' } },
    { id: 'main',         label: { ru: 'Основные тома',    en: 'Main volumes' } },
    { id: 'experimental', label: { ru: 'Эксперименты',     en: 'Experimental' } }
  ];


  /* ========================================================================
     2. ТРЕКИ
        Сортировка: от нового к старому. isLatest: true — только у одного
        (самый свежий трек для главной страницы).
        bandlabEmbed — заглушка под iframe плеера BandLab.
        bandlinkUrl  — ссылка для РФ, hypedditUrl — ссылка для мира.
     ======================================================================== */
  var tracks = [
    {
      id: 'track-4',
      title: 'Golden Spine',
      style: 'Dark Trap',
      category: 'main',
      date: '2026-10-31',
      duration: '2:47',
      bpm: 140,
      tags: ['808', 'choir', 'gold'],
      cover: 'assets/images/track4.jpg',
      snippet: 'assets/audio/track4.mp3',
      bandlabEmbed: '<iframe src="https://www.bandlab.com/embed/?id=REPLACE_BANDLAB_TRACK_ID_4" width="100%" height="140" frameborder="0" loading="lazy" allowfullscreen></iframe>',
      bandlinkUrl: 'https://band.link/REPLACE_GOLDEN_SPINE',
      hypedditUrl: 'https://hypeddit.com/REPLACE_GOLDEN_SPINE',
      description: {
        ru: 'Гимн проекта. Тяжёлый 808 качает, как шаги по золотому хребту, а над ним — хор, который звучит так, будто поёт из-под земли. Трек о цене блеска и о том, что остаться золотом можно только пройдя через огонь.',
        en: 'The project anthem. A heavy 808 thumps like footsteps along a golden spine, and above it a choir sounds as if it sings from beneath the earth. A track about the price of shine — and how you can only stay gold by walking through fire.'
      },
      isLatest: true
    },
    {
      id: 'track-3',
      title: 'Night Drift Protocol',
      style: 'Phonk / Drift',
      category: 'main',
      date: '2026-09-13',
      duration: '3:05',
      bpm: 150,
      tags: ['cowbell', 'drift', 'night'],
      cover: 'assets/images/track3.jpg',
      snippet: 'assets/audio/track3.mp3',
      bandlabEmbed: '<iframe src="https://www.bandlab.com/embed/?id=REPLACE_BANDLAB_TRACK_ID_3" width="100%" height="140" frameborder="0" loading="lazy" allowfullscreen></iframe>',
      bandlinkUrl: 'https://band.link/REPLACE_NIGHT_DRIFT_PROTOCOL',
      hypedditUrl: 'https://hypeddit.com/REPLACE_NIGHT_DRIFT_PROTOCOL',
      description: {
        ru: 'Ночная гонка по мосту над Алой Бездной. Кованый кау-белл, скрежет шин и бас, от которого дрожит асфальт. Если слышишь в наушниках двигатель — значит, Они уже сидит на пассажирском.',
        en: 'A night race across the bridge above the Crimson Abyss. Forged cowbell, screeching tires and a bass that makes the asphalt shake. If you hear an engine in your headphones, Oni is already in the passenger seat.'
      },
      isLatest: false
    },
    {
      id: 'track-2',
      title: 'Ritual of Static',
      style: 'Ritual Noise',
      category: 'experimental',
      date: '2026-07-04',
      duration: '4:12',
      bpm: 90,
      tags: ['noise', 'chant', 'tape'],
      cover: 'assets/images/track2.jpg',
      snippet: 'assets/audio/track2.mp3',
      bandlabEmbed: '<iframe src="https://www.bandlab.com/embed/?id=REPLACE_BANDLAB_TRACK_ID_2" width="100%" height="140" frameborder="0" loading="lazy" allowfullscreen></iframe>',
      bandlinkUrl: 'https://band.link/REPLACE_RITUAL_OF_STATIC',
      hypedditUrl: 'https://hypeddit.com/REPLACE_RITUAL_OF_STATIC',
      description: {
        ru: 'Эксперимент на грани обряда: плёночный шум, шёпот на мёртвом языке и ритм, собранный из ударов по ржавому металлу. Лучше слушать в темноте и не оборачиваться.',
        en: 'An experiment on the edge of a rite: tape noise, whispers in a dead language and a rhythm built from blows on rusted metal. Best heard in the dark — and without looking back.'
      },
      isLatest: false
    },
    {
      id: 'track-1',
      title: 'Abyss Signal 0',
      style: 'Abyssal Drone',
      category: 'experimental',
      date: '2026-03-21',
      duration: '5:30',
      bpm: 60,
      tags: ['drone', 'sub', 'void'],
      cover: 'assets/images/track1.jpg',
      snippet: 'assets/audio/track1.mp3',
      bandlabEmbed: '<iframe src="https://www.bandlab.com/embed/?id=REPLACE_BANDLAB_TRACK_ID_1" width="100%" height="140" frameborder="0" loading="lazy" allowfullscreen></iframe>',
      bandlinkUrl: 'https://band.link/REPLACE_ABYSS_SIGNAL_0',
      hypedditUrl: 'https://hypeddit.com/REPLACE_ABYSS_SIGNAL_0',
      description: {
        ru: 'Первый сигнал из Бездны Безмолвия. Один длинный гул, в котором слышно, как медленно меняется сама тишина. С этого трека началась вселенная GILDSPINE.',
        en: 'The first signal from the Abyss of Silence. One long drone in which you can hear silence itself slowly changing. The GILDSPINE universe began with this track.'
      },
      isLatest: false
    }
  ];


  /* ========================================================================
     3. КНИГИ СЕРИИ
        status:
          'available' — книга доступна, есть ссылки на магазины
          'soon'      — название открыто, выход скоро
          'locked'    — засекречена: показываем шифр и маску вместо названия
     ======================================================================== */
  var LOCKED_HINT = {
    ru: 'Частота ещё не поймана.',
    en: 'The frequency has not been caught yet.'
  };

  var books = [
    {
      id: 'book-1',
      number: 1,
      status: 'available',
      title: { ru: 'Первая частота', en: 'The First Frequency' },
      cover: 'assets/images/book-cover.jpg',
      annotation: {
        ru: [
          'Мир держится на золотом хребте — древней струне, натянутой между четырьмя Безднами. Пока она звучит, чудовища спят, а тьма знает своё место. Но хребет начал фальшивить, и первыми это услышали мёртвые.',
          'Кастер, изгнанный певчий Позолоченного квартала, просыпается с чужой нотой в горле. Первая частота — та самая, что когда-то пропела мир, — выбрала его своим голосом. Теперь за ним охотятся ржавые жрецы, алые палачи и те, кто готов продать тишину за звонкую монету. Единственная, кто знает цену ноты, — арфистка Лира, пережившая собственную смерть.',
          '«Первая частота» — тёмное фэнтези о музыке как оружии, о цене золота и о том, что случается с тем, кто услышал песню, которую не должен был слышать. Stay Gold.'
        ],
        en: [
          'The world is held together by a golden spine — an ancient string stretched between the Four Abysses. While it sounds, monsters sleep and darkness knows its place. But the spine has begun to go out of tune, and the dead were the first to hear it.',
          'Caster, an exiled cantor of the Gilded Quarter, wakes with a stranger\u2019s note in his throat. The First Frequency — the very one that once sang the world into being — has chosen him as its voice. Now he is hunted by rust-priests, crimson executioners and those who would sell silence for a ringing coin. The only one who knows the price of a note is Lyra, a harpist who outlived her own death.',
          '\u201cThe First Frequency\u201d is dark fantasy about music as a weapon, about the price of gold, and about what happens to those who hear a song they were never meant to hear. Stay Gold.'
        ]
      },
      shops: {
        litres:      'https://www.litres.ru/REPLACE_BOOK_1_LITRES',
        ozon:        'https://www.ozon.ru/REPLACE_BOOK_1_OZON',
        wildberries: 'https://www.wildberries.ru/REPLACE_BOOK_1_WILDBERRIES'
      },
      cipher: null,
      hint: null
    },
    {
      id: 'book-2',
      number: 2,
      status: 'soon',
      title: { ru: 'Кровь и частота', en: 'Blood and Frequency' },
      cover: 'assets/images/book2-cover.jpg',
      annotation: {
        ru: [
          'Алая Бездна отвечает на зов. Там, где у других сердце, у неё — барабан, и он бьёт всё громче. Кастеру предстоит спуститься в самую глубину, чтобы узнать, какую частоту у крови.'
        ],
        en: [
          'The Crimson Abyss answers the call. Where others have a heart, it has a drum — and it beats louder with every night. Caster must descend to its very depths to learn the frequency of blood.'
        ]
      },
      shops: { litres: null, ozon: null, wildberries: null },
      cipher: null,
      hint: null
    },
    {
      id: 'book-3',
      number: 3,
      status: 'locked',
      title: { ru: '▓▓▓▓▓▓ ▓▓▓▓▓▓▓▓', en: '▓▓▓▓▓▓ ▓▓▓▓▓▓▓▓' },
      cover: 'assets/images/book-locked.jpg',
      annotation: null,
      shops: null,
      cipher: 'III-7F2A',
      hint: LOCKED_HINT
    },
    {
      id: 'book-4',
      number: 4,
      status: 'locked',
      title: { ru: '████ ▒▒▒▒▒▒▒', en: '████ ▒▒▒▒▒▒▒' },
      cover: 'assets/images/book-locked.jpg',
      annotation: null,
      shops: null,
      cipher: 'IV-C41E',
      hint: LOCKED_HINT
    },
    {
      id: 'book-5',
      number: 5,
      status: 'locked',
      title: { ru: '▒▒▒▒▒▒▒▒ ▓▓▓', en: '▒▒▒▒▒▒▒▒ ▓▓▓' },
      cover: 'assets/images/book-locked.jpg',
      annotation: null,
      shops: null,
      cipher: 'V-09BD',
      hint: LOCKED_HINT
    },
    {
      id: 'book-6',
      number: 6,
      status: 'locked',
      title: { ru: '▓▓▓ ████████ ▒▒▒', en: '▓▓▓ ████████ ▒▒▒' },
      cover: 'assets/images/book-locked.jpg',
      annotation: null,
      shops: null,
      cipher: 'VI-E3A7',
      hint: LOCKED_HINT
    },
    {
      id: 'book-7',
      number: 7,
      status: 'locked',
      title: { ru: '██████ ▓▓▓▓▓', en: '██████ ▓▓▓▓▓' },
      cover: 'assets/images/book-locked.jpg',
      annotation: null,
      shops: null,
      cipher: 'VII-52D0',
      hint: LOCKED_HINT
    },
    {
      id: 'book-8',
      number: 8,
      status: 'locked',
      title: { ru: '▒▒▒▒ ▓▓▓▓▓▓▓▓▓', en: '▒▒▒▒ ▓▓▓▓▓▓▓▓▓' },
      cover: 'assets/images/book-locked.jpg',
      annotation: null,
      shops: null,
      cipher: 'VIII-B6C9',
      hint: LOCKED_HINT
    },
    {
      id: 'book-9',
      number: 9,
      status: 'locked',
      title: { ru: '▓▓▓▓▓▓▓ ▒▒', en: '▓▓▓▓▓▓▓ ▒▒' },
      cover: 'assets/images/book-locked.jpg',
      annotation: null,
      shops: null,
      cipher: 'IX-1A8F',
      hint: LOCKED_HINT
    },
    {
      id: 'book-10',
      number: 10,
      status: 'locked',
      title: { ru: '████████ ▓▓▓▓ █', en: '████████ ▓▓▓▓ █' },
      cover: 'assets/images/book-locked.jpg',
      annotation: null,
      shops: null,
      cipher: 'X-FF00',
      hint: LOCKED_HINT
    }
  ];


  /* ========================================================================
     4. ГЛАВЫ ПЕРВОЙ КНИГИ
        status: 'available' — текст доступен в читалке, 'soon' — скоро.
        text — массив абзацев для каждого языка (рендерить по одному <p>).
     ======================================================================== */
  var chapters = [
    {
      id: 'b1-ch1',
      bookId: 'book-1',
      number: 1,
      status: 'available',
      readingMinutes: 3,
      title: { ru: 'Тишина перед нотой', en: 'The Silence Before the Note' },
      text: {
        ru: [
          'Говорят, мир не сотворили словом — его пропели. Одной-единственной нотой, такой чистой и такой голодной, что она до сих пор ищет, чем бы наполниться. Кастер узнал об этом в ночь, когда колокола Позолоченного квартала зазвонили без звонарей, а над крышами пошёл дождь из тёплого пепла.',
          'Он стоял на мосту из костей и меди, и под ним, в провале, где когда-то текла река, шевелилась Бездна. Она не рычала, как рычат звери. Она гудела — низко, ровно, на частоте, от которой дрожали зубы, а мёртвые прятались глубже в землю. Золотая жила на его левой руке вспыхнула сама: без заклинания, без просьбы, будто давно ждала этого звука.',
          '— Ты слышишь, — сказала Лира за его плечом, и струны её арфы лопнули одна за другой, словно кто-то невидимый провёл по ним ножом. — Значит, это правда. Хребет проснулся.',
          'Кастер не ответил. Он смотрел вниз, в чёрное, и чёрное смотрело на него в ответ чужими, до боли знакомыми глазами. Где-то на самом краю слуха начиналась мелодия. Он вдруг понял, что она началась уже давно — просто до этой ночи он был слишком громким, чтобы её услышать.'
        ],
        en: [
          'They say the world was not spoken into being — it was sung. By a single note, so pure and so hungry that it is still searching for something to fill. Caster learned this on the night the bells of the Gilded Quarter began to ring without a single bell-ringer, and a rain of warm ash fell across the rooftops.',
          'He stood on a bridge of bone and copper, and beneath him, in the chasm where a river once ran, the Abyss stirred. It did not growl the way beasts growl. It hummed — low and even, on a frequency that rattled teeth and sent the dead burrowing deeper into the earth. The golden vein along his left arm flared on its own: no spell, no plea, as if it had long been waiting for that sound.',
          '\u201cYou hear it,\u201d said Lyra behind his shoulder, and the strings of her harp snapped one by one, as though an unseen hand had drawn a knife across them. \u201cThen it\u2019s true. The Spine has awakened.\u201d',
          'Caster did not answer. He looked down into the black, and the black looked back at him with eyes that were strange and painfully familiar. Somewhere at the very edge of hearing, a melody was beginning. He realized, all at once, that it had begun long ago — he had simply been too loud, until tonight, to hear it.'
        ]
      }
    },
    {
      id: 'b1-ch2',
      bookId: 'book-1',
      number: 2,
      status: 'soon',
      readingMinutes: null,
      title: { ru: 'Арфистка без пульса', en: 'The Harpist Without a Pulse' },
      text: null
    },
    {
      id: 'b1-ch3',
      bookId: 'book-1',
      number: 3,
      status: 'soon',
      readingMinutes: null,
      title: { ru: 'Ржавые жрецы', en: 'The Rust-Priests' },
      text: null
    },
    {
      id: 'b1-ch4',
      bookId: 'book-1',
      number: 4,
      status: 'soon',
      readingMinutes: null,
      title: { ru: 'Цена золотой ноты', en: 'The Price of a Golden Note' },
      text: null
    }
  ];


  /* ========================================================================
     5. ЧЕТЫРЕ БЕЗДНЫ
        color — основной цвет мира, glow — цвет свечения для box-shadow.
     ======================================================================== */
  var abysses = [
    {
      id: 'crimson',
      order: 1,
      name: { ru: 'Алая Бездна', en: 'The Crimson Abyss' },
      epithet: { ru: 'Где пульс становится барабаном', en: 'Where the pulse becomes a drum' },
      color: '#8b0000',
      glow: 'rgba(139, 0, 0, 0.55)',
      description: {
        ru: 'Мир раскалённого железа, жертвенных алтарей и бесконечной войны. Здесь всё живое подчиняется единому ритму — глубокому, как удар сердца великана. Алая Бездна не прощает слабости, но щедро платит тем, кто выдержит её бас.',
        en: 'A realm of white-hot iron, sacrificial altars and endless war. Everything alive here obeys a single rhythm — deep as the heartbeat of a giant. The Crimson Abyss forgives no weakness, but pays generously those who can endure its bass.'
      }
    },
    {
      id: 'gilded',
      order: 2,
      name: { ru: 'Позолоченная Бездна', en: 'The Gilded Abyss' },
      epithet: { ru: 'Где память звенит золотом', en: 'Where memory rings in gold' },
      color: '#c9a227',
      glow: 'rgba(201, 162, 39, 0.5)',
      description: {
        ru: 'Город соборов, хоров и бесконечных лестниц, где каждая стена помнит чей-то голос. Красота здесь — валюта, а блеск — ловушка. Тот, кто возьмёт слишком много золота, рискует забыть собственное имя.',
        en: 'A city of cathedrals, choirs and endless staircases, where every wall remembers someone\u2019s voice. Beauty is currency here, and shine is a trap. Whoever takes too much gold risks forgetting his own name.'
      }
    },
    {
      id: 'violet',
      order: 3,
      name: { ru: 'Фиолетовая Бездна', en: 'The Violet Abyss' },
      epithet: { ru: 'Где эхо учится лгать', en: 'Where the echo learns to lie' },
      color: '#7b2cbf',
      glow: 'rgba(123, 44, 191, 0.55)',
      description: {
        ru: 'Неоновый туман, ведьмины огни и зеркала, отвечающие не теми словами. Реальность здесь трескается, как плохая запись, а сны продаются по частям. Фиолетовая Бездна обожает тех, кто умеет петь в два голоса.',
        en: 'Neon fog, witch-lights and mirrors that answer with the wrong words. Reality cracks here like a bad recording, and dreams are sold piece by piece. The Violet Abyss adores those who can sing in two voices.'
      }
    },
    {
      id: 'silent',
      order: 4,
      name: { ru: 'Бездна Безмолвия', en: 'The Abyss of Silence' },
      epithet: { ru: 'Где кончается звук', en: 'Where sound ends' },
      color: '#6b7a8f',
      glow: 'rgba(107, 122, 143, 0.5)',
      description: {
        ru: 'Холодная пустота, в которой слышно лишь собственное дыхание — да и то недолго. Здесь родился первый гул, и здесь он вернётся, когда Хребет оборвётся. Говорят, Безмолвие не враг: оно просто ждёт последней ноты.',
        en: 'A cold emptiness in which you can hear only your own breathing — and not for long. The first drone was born here, and here it will return when the Spine finally snaps. They say Silence is no enemy: it is simply waiting for the last note.'
      }
    }
  ];


  /* ========================================================================
     6. ПЕРСОНАЖИ ЛОРА (8)
        abyss — id из массива abysses выше.
     ======================================================================== */
  var characters = [
    {
      id: 'caster',
      name: { ru: 'Кастер', en: 'Caster' },
      role: { ru: 'Певчий-изгнанник, носитель Первой частоты', en: 'Exiled cantor, bearer of the First Frequency' },
      abyss: 'gilded',
      image: 'assets/images/char-caster.jpg',
      bio: {
        ru: 'Бывший певчий Позолоченного квартала. Ноту, создавшую мир, он услышал первым — и с тех пор не может замолчать. Золотая жила на его левой руке разгорается всякий раз, когда рядом открывается Бездна.',
        en: 'A former cantor of the Gilded Quarter. He was the first to hear the note that created the world — and has been unable to fall silent since. The golden vein on his left arm blazes whenever an Abyss opens nearby.'
      }
    },
    {
      id: 'oni',
      name: { ru: 'Они', en: 'Oni' },
      role: { ru: 'Алый палач, страж Крови', en: 'Crimson executioner, warden of the Blood' },
      abyss: 'crimson',
      image: 'assets/images/char-oni.jpg',
      bio: {
        ru: 'Демон в маске из чёрного лака. Приводит приговоры в исполнение под бой собственного сердца и никогда не промахивается. Поговаривают, что за Кастером он охотится не по приказу, а из любопытства.',
        en: 'A demon in a mask of black lacquer. He carries out sentences to the beat of his own heart and never misses. Rumor has it he hunts Caster not on orders, but out of curiosity.'
      }
    },
    {
      id: 'lyra',
      name: { ru: 'Лира', en: 'Lyra' },
      role: { ru: 'Арфистка, пережившая собственную смерть', en: 'Harpist who outlived her own death' },
      abyss: 'gilded',
      image: 'assets/images/char-lyra.jpg',
      bio: {
        ru: 'Хранительница золотых струн. Однажды она сыграла реквием по себе — и осталась на этом свете, потому что Хребет не принял её последнюю ноту. С тех пор её пульс не слышен, а арфа лжёт только в одном случае: когда речь о ней самой.',
        en: 'Keeper of the golden strings. Once she played a requiem for herself — and remained in this world, because the Spine refused her final note. Her pulse has been silent ever since, and her harp lies in only one case: when it speaks of her.'
      }
    },
    {
      id: 'vector',
      name: { ru: 'Вектор', en: 'Vector' },
      role: { ru: 'Картограф Бездн, наёмный проводник', en: 'Cartographer of the Abysses, mercenary guide' },
      abyss: 'silent',
      image: 'assets/images/char-vector.jpg',
      bio: {
        ru: 'Единственный, кто возвращался из Бездны Безмолвия с картой. Ведёт за плату и никогда не спрашивает, куда вы идёте — только где собираетесь остановиться. Его компас указывает не на север, а на самую тихую точку мира.',
        en: 'The only one who ever came back from the Abyss of Silence with a map. He guides for a fee and never asks where you are going — only where you plan to stop. His compass points not north, but toward the quietest place in the world.'
      }
    },
    {
      id: 'echo-panther',
      name: { ru: 'Эхо / Пантера', en: 'Echo / Panther' },
      role: { ru: 'Двуликая певица-призрак', en: 'Two-faced ghost singer' },
      abyss: 'violet',
      image: 'assets/images/char-echo-panther.jpg',
      bio: {
        ru: 'Днём она — Эхо, голос, повторяющий чужие слова. Ночью — Пантера, голос, который никто не смеет повторять. Две души делят одно горло, и ни одна не уверена, кто из них настоящая.',
        en: 'By day she is Echo, a voice that repeats the words of others. By night she is Panther, a voice no one dares to repeat. Two souls share a single throat, and neither is certain which of them is real.'
      }
    },
    {
      id: 'synth',
      name: { ru: 'Синт', en: 'Synth' },
      role: { ru: 'Хор из тысячи синтезаторов', en: 'A choir of a thousand synthesizers' },
      abyss: 'violet',
      image: 'assets/images/char-synth.jpg',
      bio: {
        ru: 'Голем, собранный из мёртвых клавиш, проводов и чужих воспоминаний. Говорит аккордами и обижается на фальшь. Однажды он сыграл целую симфонию из одного вздоха — и с тех пор боится тишины.',
        en: 'A golem assembled from dead keys, wires and borrowed memories. He speaks in chords and takes offense at a false note. Once he played an entire symphony out of a single sigh — and has feared silence ever since.'
      }
    },
    {
      id: 'chrome',
      name: { ru: 'Хром', en: 'Chrome' },
      role: { ru: 'Кузнец-оружейник железных теней', en: 'Armorer-smith of iron shadows' },
      abyss: 'crimson',
      image: 'assets/images/char-chrome.jpg',
      bio: {
        ru: 'Куёт клинки, которые поют при ударе, и доспехи, отражающие даже звук. Его кузня стоит на границе Алой Бездны, и молот там никогда не остывает. Берёт плату не золотом, а историями.',
        en: 'Forges blades that sing when struck and armor that reflects even sound. His forge stands on the border of the Crimson Abyss, and the hammer there never cools. He takes payment not in gold, but in stories.'
      }
    },
    {
      id: 'shadow',
      name: { ru: 'Тень', en: 'Shadow' },
      role: { ru: 'Безмолвный убийца', en: 'Silent assassin' },
      abyss: 'silent',
      image: 'assets/images/char-shadow.jpg',
      bio: {
        ru: 'Не отбрасывает звука — и потому единственный, кого не слышит Хребет. Никто не знает её лица, а те, кто знал, уже не могут рассказать. Если вам стало слишком тихо, оглянитесь.',
        en: 'She casts no sound — and so is the only one the Spine cannot hear. No one knows her face, and those who did can no longer tell. If it has suddenly grown too quiet, turn around.'
      }
    }
  ];


  /* ========================================================================
     7. РЕКВИЗИТЫ И СОЦСЕТИ (заглушки — замените на реальные)
        Для рендера списков используйте Object.values(links.crypto) и
        Object.values(links.social).
     ======================================================================== */
  var links = {
    /* Поддержка — рубли (РФ) */
    cloudtips: {
      name: 'CloudTips',
      url: 'https://pay.cloudtips.ru/p/REPLACE_CLOUDTIPS_ID'
    },

    /* Поддержка — криптокошельки */
    crypto: {
      usdtTrc20: {
        id: 'usdt-trc20',
        name: 'USDT',
        network: 'TRC-20',
        address: 'REPLACE_WITH_USDT_TRC20_ADDRESS',
        memo: null,
        qr: 'assets/images/qr/usdt-trc20.png'
      },
      btc: {
        id: 'btc',
        name: 'Bitcoin',
        network: 'BTC',
        address: 'REPLACE_WITH_BTC_ADDRESS',
        memo: null,
        qr: 'assets/images/qr/btc.png'
      },
      ton: {
        id: 'ton',
        name: 'Toncoin',
        network: 'TON',
        address: 'REPLACE_WITH_TON_ADDRESS',
        memo: 'REPLACE_WITH_TON_MEMO_OR_NULL',
        qr: 'assets/images/qr/ton.png'
      },
      sol: {
        id: 'sol',
        name: 'Solana',
        network: 'SOL',
        address: 'REPLACE_WITH_SOL_ADDRESS',
        memo: null,
        qr: 'assets/images/qr/sol.png'
      },
      eth: {
        id: 'eth',
        name: 'Ethereum',
        network: 'ETH (ERC-20)',
        address: 'REPLACE_WITH_ETH_ADDRESS',
        memo: null,
        qr: 'assets/images/qr/eth.png'
      }
    },

    /* Соцсети и платформы */
    social: {
      youtube:         { name: 'YouTube',            url: 'https://www.youtube.com/@REPLACE_YOUTUBE' },
      vk:              { name: 'VK',                 url: 'https://vk.com/REPLACE_VK' },
      telegramRu:      { name: 'Telegram (RU)',      url: 'https://t.me/REPLACE_TELEGRAM_RU' },
      telegramGlobal:  { name: 'Telegram (Global)',  url: 'https://t.me/REPLACE_TELEGRAM_GLOBAL' },
      tiktok:          { name: 'TikTok',             url: 'https://www.tiktok.com/@REPLACE_TIKTOK' },
      discord:         { name: 'Discord',            url: 'https://discord.gg/REPLACE_DISCORD_INVITE' },
      pinterest:       { name: 'Pinterest',          url: 'https://www.pinterest.com/REPLACE_PINTEREST/' }
    },

    /* Дистрибуция музыки — общие страницы артиста */
    music: {
      bandlab:   'https://www.bandlab.com/REPLACE_BANDLAB_PROFILE',
      bandlink:  'https://band.link/REPLACE_BANDLINK_PROFILE',
      hypeddit:  'https://hypeddit.com/REPLACE_HYPEDDIT_PROFILE'
    },

    email: 'REPLACE_WITH_EMAIL@example.com'
  };


  /* ========================================================================
     ХЕЛПЕРЫ
     ======================================================================== */

  /** Текущий язык интерфейса: 'ru' | 'en' */
  function getLang() {
    if (window.GildspineI18n && typeof window.GildspineI18n.getLang === 'function') {
      return window.GildspineI18n.getLang();
    }
    return document.documentElement.getAttribute('lang') === 'en' ? 'en' : 'ru';
  }

  /**
   * Достаёт локализованное значение:
   *   tr({ ru: 'Привет', en: 'Hello' })       → строка
   *   tr({ ru: [..], en: [..] })              → массив абзацев
   *   tr('просто строка')                     → та же строка
   * Если нужного языка нет — возвращается русская версия.
   */
  function tr(field, lang) {
    if (field === null || field === undefined) return '';
    if (typeof field !== 'object' || Array.isArray(field)) return field;
    var l = lang || getLang();
    return field[l] !== undefined && field[l] !== null ? field[l] : field.ru;
  }

  /** Форматирует ISO-дату (YYYY-MM-DD) под текущий язык */
  function formatDate(iso, lang) {
    var l = lang || getLang();
    var parts = String(iso).split('-');
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString(l === 'ru' ? 'ru-RU' : 'en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  function findById(list, id) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function getStyleByName(name) {
    for (var i = 0; i < musicStyles.length; i++) {
      if (musicStyles[i].name === name) return musicStyles[i];
    }
    return null;
  }

  /** Стили по категории: 'main' | 'experimental' | 'all' */
  function getStyles(category) {
    if (!category || category === 'all') return musicStyles.slice();
    return musicStyles.filter(function (s) { return s.category === category; });
  }

  /** Треки с фильтрами: { category: 'main'|'experimental'|'all', style: 'Dark Trap' } */
  function getTracks(filters) {
    var f = filters || {};
    return tracks.filter(function (t) {
      var okCategory = !f.category || f.category === 'all' || t.category === f.category;
      var okStyle = !f.style || f.style === 'all' || t.style === f.style;
      return okCategory && okStyle;
    });
  }

  /** Самый свежий трек: сначала по флагу isLatest, иначе по дате */
  function getLatestTrack() {
    for (var i = 0; i < tracks.length; i++) {
      if (tracks[i].isLatest) return tracks[i];
    }
    return tracks.slice().sort(function (a, b) {
      return a.date < b.date ? 1 : -1;
    })[0] || null;
  }

  function getChaptersByBook(bookId) {
    return chapters
      .filter(function (c) { return c.bookId === bookId; })
      .sort(function (a, b) { return a.number - b.number; });
  }

  function getCharactersByAbyss(abyssId) {
    return characters.filter(function (c) { return c.abyss === abyssId; });
  }

  /* ========================================================================
     ЭКСПОРТ
     ======================================================================== */
  window.GildspineData = {
    /* данные */
    musicStyles: musicStyles,
    musicCategories: musicCategories,
    tracks: tracks,
    books: books,
    chapters: chapters,
    abysses: abysses,
    characters: characters,
    links: links,

    /* хелперы */
    getLang: getLang,
    tr: tr,
    formatDate: formatDate,
    getStyles: getStyles,
    getStyleByName: getStyleByName,
    getTracks: getTracks,
    getTrackById: function (id) { return findById(tracks, id); },
    getLatestTrack: getLatestTrack,
    getBookById: function (id) { return findById(books, id); },
    getChaptersByBook: getChaptersByBook,
    getChapterById: function (id) { return findById(chapters, id); },
    getAbyssById: function (id) { return findById(abysses, id); },
    getCharacterById: function (id) { return findById(characters, id); },
    getCharactersByAbyss: getCharactersByAbyss
  };
})();
