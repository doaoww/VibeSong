/**
 * VibeSong catalog seeder — run while dev server is live:
 *   npm run dev          (terminal 1)
 *   node scripts/seed-catalog.mjs   (terminal 2)
 *
 * Each song is auto-tagged via iTunes + Last.fm + GPT-4o and inserted into Supabase.
 * Already-catalogued songs are skipped (duplicate check), so this file is safe to re-run.
 * Takes ~15-16 min to process the full list (2s delay between calls to respect rate limits).
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_SECRET = "vibesong-admin-2026";

// ─── CATALOG ──────────────────────────────────────────────────────────────────
// Original batch covers: Russian indie/underground, English indie/alt pop,
// dark/cinematic, dreamy/nostalgic, confident/energy, post-breakup, electronic,
// acoustic. Second batch (below, "GENRE EXPANSION") fills genres that were
// nearly absent from the live catalog: Latin/reggaeton, K-pop, Afrobeats,
// EDM/house, country, metal/punk, jazz/soul standards, reggae, cinematic
// classical, J-pop, disco/funk, 80s/90s pop icons, more Russian genres,
// French pop, drum & bass/dubstep, Brazilian, Punjabi pop.
const SONGS = [
  // ── RUSSIAN ─────────────────────────────────────────────────────────────────

  // Земфира
  { title: "Хочешь?", artist: "Земфира" },
  { title: "Почему?", artist: "Земфира" },
  { title: "Ариес", artist: "Земфира" },
  { title: "Прогулка", artist: "Земфира" },
  { title: "До свидания", artist: "Земфира" },
  { title: "Самолёт", artist: "Земфира" },
  { title: "Ботаника", artist: "Земфира" },

  // Молчат Дома (Molchat Doma)
  { title: "Судно (Борис Рыжий)", artist: "Molchat Doma" },
  { title: "Этажи", artist: "Molchat Doma" },
  { title: "Клетка", artist: "Molchat Doma" },
  { title: "Прогулка", artist: "Molchat Doma" },
  { title: "Zvyozdy", artist: "Molchat Doma" },

  // IC3PEAK
  { title: "Плак Плак", artist: "IC3PEAK" },
  { title: "Смерть", artist: "IC3PEAK" },
  { title: "Нет", artist: "IC3PEAK" },

  // Shortparis
  { title: "Страшно", artist: "Shortparis" },
  { title: "Человек со рта", artist: "Shortparis" },
  { title: "Мясо", artist: "Shortparis" },

  // Монеточка
  { title: "Каждый раз", artist: "Монеточка" },
  { title: "Листопад", artist: "Монеточка" },
  { title: "Тёмная лошадка", artist: "Монеточка" },

  // Pharaoh
  { title: "Angel Dust", artist: "Pharaoh" },
  { title: "Элегантно", artist: "Pharaoh" },
  { title: "Розовый ламборгини", artist: "Pharaoh" },
  { title: "Белый гетто", artist: "Pharaoh" },

  // Дора
  { title: "Ромашки", artist: "Дора" },
  { title: "Ничего не жаль", artist: "Дора" },

  // Гречка
  { title: "Невеста", artist: "Гречка" },
  { title: "Привет", artist: "Гречка" },

  // АИГЕЛ
  { title: "Пуля", artist: "АИГЕЛ" },
  { title: "Татарин", artist: "АИГЕЛ" },

  // Kate NV (experimental Russian)
  { title: "Sayonara", artist: "Kate NV" },
  { title: "Telefon", artist: "Kate NV" },

  // Сплин
  { title: "Романс", artist: "Сплин" },
  { title: "Выхода нет", artist: "Сплин" },
  { title: "Апельсиновый остров", artist: "Сплин" },

  // Кино (Viktor Tsoi classics)
  { title: "Группа крови", artist: "Кино" },
  { title: "Звезда по имени Солнце", artist: "Кино" },
  { title: "Пачка сигарет", artist: "Кино" },

  // Мумий Тролль
  { title: "Утекай", artist: "Мумий Тролль" },
  { title: "Дельфины", artist: "Мумий Тролль" },

  // Theodor Bastard (dark Russian folk)
  { title: "Fara", artist: "Theodor Bastard" },
  { title: "Yagna", artist: "Theodor Bastard" },

  // Макс Корж
  { title: "Мало половин", artist: "Макс Корж" },
  { title: "Внутри", artist: "Макс Корж" },

  // Bi-2
  { title: "Серая мышь", artist: "Би-2" },
  { title: "Полковнику никто не пишет", artist: "Би-2" },

  // Наутилус Помпилиус
  { title: "Скованные одной цепью", artist: "Наутилус Помпилиус" },
  { title: "Гибралтар-Лабрадор", artist: "Наутилус Помпилиус" },

  // ── ENGLISH — DREAMY / NOSTALGIC ────────────────────────────────────────────

  // Beach House
  { title: "Space Song", artist: "Beach House" },
  { title: "Myth", artist: "Beach House" },
  { title: "Sparks", artist: "Beach House" },
  { title: "Girls of Summer", artist: "Beach House" },

  // Cigarettes After Sex
  { title: "Nothing's Gonna Hurt You Baby", artist: "Cigarettes After Sex" },
  { title: "Apocalypse", artist: "Cigarettes After Sex" },
  { title: "Each Time You Fall in Love", artist: "Cigarettes After Sex" },
  { title: "Tejano Blue", artist: "Cigarettes After Sex" },

  // Men I Trust
  { title: "Lauren", artist: "Men I Trust" },
  { title: "Numb", artist: "Men I Trust" },
  { title: "Show Me How", artist: "Men I Trust" },

  // Mazzy Star
  { title: "Fade Into You", artist: "Mazzy Star" },
  { title: "Into Dust", artist: "Mazzy Star" },

  // ── ENGLISH — DARK / CINEMATIC ──────────────────────────────────────────────

  // Lana Del Rey
  { title: "Video Games", artist: "Lana Del Rey" },
  { title: "Summertime Sadness", artist: "Lana Del Rey" },
  { title: "Young and Beautiful", artist: "Lana Del Rey" },
  { title: "White Dress", artist: "Lana Del Rey" },
  { title: "California", artist: "Lana Del Rey" },
  { title: "Did you know that there's a tunnel under Ocean Blvd", artist: "Lana Del Rey" },

  // Portishead
  { title: "Glory Box", artist: "Portishead" },
  { title: "Roads", artist: "Portishead" },
  { title: "Wandering Star", artist: "Portishead" },

  // Massive Attack
  { title: "Teardrop", artist: "Massive Attack" },
  { title: "Unfinished Sympathy", artist: "Massive Attack" },
  { title: "Angel", artist: "Massive Attack" },

  // Weyes Blood
  { title: "Movies", artist: "Weyes Blood" },
  { title: "Andromeda", artist: "Weyes Blood" },
  { title: "Titanic Rising", artist: "Weyes Blood" },

  // Chelsea Wolfe
  { title: "Feral Love", artist: "Chelsea Wolfe" },
  { title: "Carrion Flowers", artist: "Chelsea Wolfe" },

  // FKA Twigs
  { title: "Two Weeks", artist: "FKA twigs" },
  { title: "Cellophane", artist: "FKA twigs" },
  { title: "Water Me", artist: "FKA twigs" },

  // ── ENGLISH — POST-BREAKUP / EMOTIONAL ──────────────────────────────────────

  // Billie Eilish
  { title: "when the party's over", artist: "Billie Eilish" },
  { title: "lovely", artist: "Billie Eilish" },
  { title: "everything i wanted", artist: "Billie Eilish" },
  { title: "Happier Than Ever", artist: "Billie Eilish" },
  { title: "ocean eyes", artist: "Billie Eilish" },

  // Olivia Rodrigo
  { title: "drivers license", artist: "Olivia Rodrigo" },
  { title: "good 4 u", artist: "Olivia Rodrigo" },
  { title: "brutal", artist: "Olivia Rodrigo" },
  { title: "deja vu", artist: "Olivia Rodrigo" },
  { title: "vampire", artist: "Olivia Rodrigo" },

  // Taylor Swift
  { title: "All Too Well (Ten Minute Version)", artist: "Taylor Swift" },
  { title: "august", artist: "Taylor Swift" },
  { title: "Cruel Summer", artist: "Taylor Swift" },
  { title: "evermore", artist: "Taylor Swift" },
  { title: "cardigan", artist: "Taylor Swift" },

  // Phoebe Bridgers
  { title: "Funeral", artist: "Phoebe Bridgers" },
  { title: "Motion Sickness", artist: "Phoebe Bridgers" },
  { title: "Savior Complex", artist: "Phoebe Bridgers" },
  { title: "Garden Song", artist: "Phoebe Bridgers" },

  // SZA
  { title: "Kill Bill", artist: "SZA" },
  { title: "Good Days", artist: "SZA" },
  { title: "I Hate U", artist: "SZA" },
  { title: "Snooze", artist: "SZA" },

  // Mitski
  { title: "Nobody", artist: "Mitski" },
  { title: "Your Best American Girl", artist: "Mitski" },
  { title: "Washing Machine Heart", artist: "Mitski" },
  { title: "Geyser", artist: "Mitski" },

  // gracie abrams
  { title: "I Love You I'm Sorry", artist: "Gracie Abrams" },
  { title: "Block Me Out", artist: "Gracie Abrams" },

  // ── ENGLISH — CONFIDENCE / ENERGY ───────────────────────────────────────────

  // Charli XCX
  { title: "Speed Drive", artist: "Charli XCX" },
  { title: "Good Ones", artist: "Charli XCX" },
  { title: "Vroom Vroom", artist: "Charli XCX" },
  { title: "Von dutch", artist: "Charli XCX" },
  { title: "360", artist: "Charli XCX" },

  // Doja Cat
  { title: "Woman", artist: "Doja Cat" },
  { title: "Say So", artist: "Doja Cat" },
  { title: "Kiss Me More", artist: "Doja Cat" },
  { title: "Planet Her", artist: "Doja Cat" },

  // Rihanna
  { title: "Needed Me", artist: "Rihanna" },
  { title: "We Found Love", artist: "Rihanna" },
  { title: "Stay", artist: "Rihanna" },

  // Beyoncé
  { title: "Crazy in Love", artist: "Beyoncé" },
  { title: "Texas Hold 'Em", artist: "Beyoncé" },
  { title: "Cuff It", artist: "Beyoncé" },

  // Caroline Polachek
  { title: "Bunny Is a Rider", artist: "Caroline Polachek" },
  { title: "So Hot You're Hurting My Feelings", artist: "Caroline Polachek" },
  { title: "Pang", artist: "Caroline Polachek" },
  { title: "Welcome to My Island", artist: "Caroline Polachek" },

  // ── ENGLISH — INDIE / BEDROOM POP ───────────────────────────────────────────

  // Clairo
  { title: "Pretty Girl", artist: "Clairo" },
  { title: "Sofia", artist: "Clairo" },
  { title: "Bags", artist: "Clairo" },
  { title: "Amoeba", artist: "Clairo" },

  // Snail Mail
  { title: "Pristine", artist: "Snail Mail" },
  { title: "Glory", artist: "Snail Mail" },
  { title: "Valentine", artist: "Snail Mail" },

  // girl in red
  { title: "i wanna be your girlfriend", artist: "girl in red" },
  { title: "we fell in love in october", artist: "girl in red" },
  { title: "serotonin", artist: "girl in red" },

  // beabadoobee
  { title: "Care", artist: "beabadoobee" },
  { title: "Last Day on Earth", artist: "beabadoobee" },
  { title: "Cologne", artist: "beabadoobee" },

  // Wet Leg
  { title: "Chaise Longue", artist: "Wet Leg" },
  { title: "Ur Mum", artist: "Wet Leg" },
  { title: "Angelica", artist: "Wet Leg" },

  // Soccer Mommy
  { title: "Circle the Drain", artist: "Soccer Mommy" },
  { title: "Shotgun", artist: "Soccer Mommy" },
  { title: "Cool", artist: "Soccer Mommy" },

  // ── ENGLISH — CHILL / ACOUSTIC ──────────────────────────────────────────────

  // Rex Orange County
  { title: "Loving is Easy", artist: "Rex Orange County" },
  { title: "Happiness", artist: "Rex Orange County" },
  { title: "10/10", artist: "Rex Orange County" },

  // Mac DeMarco
  { title: "My Kind of Woman", artist: "Mac DeMarco" },
  { title: "Chamber of Reflection", artist: "Mac DeMarco" },
  { title: "Salad Days", artist: "Mac DeMarco" },

  // Steve Lacy
  { title: "Bad Habit", artist: "Steve Lacy" },
  { title: "Dark Red", artist: "Steve Lacy" },
  { title: "Some", artist: "Steve Lacy" },

  // Novo Amor
  { title: "Anchor", artist: "Novo Amor" },
  { title: "from Gold", artist: "Novo Amor" },
  { title: "Faux", artist: "Novo Amor" },

  // Daughter
  { title: "Youth", artist: "Daughter" },
  { title: "Medicine", artist: "Daughter" },
  { title: "Landfill", artist: "Daughter" },

  // Japanese Breakfast
  { title: "Boyish", artist: "Japanese Breakfast" },
  { title: "Posing in Bondage", artist: "Japanese Breakfast" },

  // ── ENGLISH — ELECTRONIC / UNDERGROUND ─────────────────────────────────────

  // Grimes
  { title: "Oblivion", artist: "Grimes" },
  { title: "Genesis", artist: "Grimes" },
  { title: "Kill V. Maim", artist: "Grimes" },
  { title: "Violence", artist: "Grimes" },

  // Crystal Castles
  { title: "Courtship Dating", artist: "Crystal Castles" },
  { title: "Crimewave", artist: "Crystal Castles" },
  { title: "Not in Love", artist: "Crystal Castles" },

  // Fever Ray
  { title: "If I Had a Heart", artist: "Fever Ray" },
  { title: "When I Grow Up", artist: "Fever Ray" },

  // MUNA
  { title: "Silk Chiffon", artist: "MUNA" },
  { title: "Anything But Me", artist: "MUNA" },
  { title: "Promise", artist: "MUNA" },

  // Remi Wolf
  { title: "Woo!", artist: "Remi Wolf" },
  { title: "Photo ID", artist: "Remi Wolf" },
  { title: "Liquor Store", artist: "Remi Wolf" },

  // ═══════════════════════════════════════════════════════════════════════════
  // ── GENRE EXPANSION ─────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  // ── LATIN / REGGAETON / LATIN POP ───────────────────────────────────────────
  { title: "Tití Me Preguntó", artist: "Bad Bunny" },
  { title: "Callaíta", artist: "Bad Bunny" },
  { title: "Monaco", artist: "Bad Bunny" },
  { title: "Mi Gente", artist: "J Balvin" },
  { title: "Ginza", artist: "J Balvin" },
  { title: "Provenza", artist: "Karol G" },
  { title: "TQG", artist: "Karol G, Shakira" },
  { title: "Malamente", artist: "Rosalía" },
  { title: "Con Altura", artist: "Rosalía" },
  { title: "Despechá", artist: "Rosalía" },
  { title: "Hips Don't Lie", artist: "Shakira" },
  { title: "Waka Waka (This Time for Africa)", artist: "Shakira" },
  { title: "Me Gustas Tu", artist: "Manu Chao" },
  { title: "Clandestino", artist: "Manu Chao" },
  { title: "Todo de Ti", artist: "Rauw Alejandro" },
  { title: "Classy 101", artist: "Feid, Nicky Jam" },
  { title: "Ella Baila Sola", artist: "Peso Pluma, Eslabon Armado" },
  { title: "Gasolina", artist: "Daddy Yankee" },
  { title: "Despacito", artist: "Luis Fonsi, Daddy Yankee" },

  // ── K-POP ────────────────────────────────────────────────────────────────
  { title: "Dynamite", artist: "BTS" },
  { title: "Butter", artist: "BTS" },
  { title: "Spring Day", artist: "BTS" },
  { title: "How You Like That", artist: "BLACKPINK" },
  { title: "Pink Venom", artist: "BLACKPINK" },
  { title: "Kill This Love", artist: "BLACKPINK" },
  { title: "Super Shy", artist: "NewJeans" },
  { title: "Hype Boy", artist: "NewJeans" },
  { title: "Ditto", artist: "NewJeans" },
  { title: "I AM", artist: "IVE" },
  { title: "After LIKE", artist: "IVE" },
  { title: "S-Class", artist: "Stray Kids" },
  { title: "God's Menu", artist: "Stray Kids" },
  { title: "Fancy", artist: "TWICE" },
  { title: "Feel Special", artist: "TWICE" },
  { title: "Next Level", artist: "aespa" },
  { title: "ANTIFRAGILE", artist: "LE SSERAFIM" },
  { title: "Like Crazy", artist: "Jimin" },

  // ── AFROBEATS ────────────────────────────────────────────────────────────
  { title: "Last Last", artist: "Burna Boy" },
  { title: "On the Low", artist: "Burna Boy" },
  { title: "Essence", artist: "Wizkid, Tems" },
  { title: "Calm Down", artist: "Rema" },
  { title: "Bounce", artist: "Rema" },
  { title: "Free Mind", artist: "Tems" },
  { title: "Unavailable", artist: "Davido" },
  { title: "Fall", artist: "Davido" },
  { title: "Rush", artist: "Ayra Starr" },
  { title: "Lonely at the Top", artist: "Asake" },
  { title: "Love Nwantiti", artist: "CKay" },

  // ── EDM / HOUSE / TECHNO / DANCE ─────────────────────────────────────────
  { title: "One More Time", artist: "Daft Punk" },
  { title: "Get Lucky", artist: "Daft Punk" },
  { title: "Wake Me Up", artist: "Avicii" },
  { title: "Levels", artist: "Avicii" },
  { title: "Summer", artist: "Calvin Harris" },
  { title: "Feel So Close", artist: "Calvin Harris" },
  { title: "Latch", artist: "Disclosure" },
  { title: "You & Me", artist: "Disclosure" },
  { title: "Say My Name", artist: "ODESZA" },
  { title: "A Moment Apart", artist: "ODESZA" },
  { title: "Losing It", artist: "Fisher" },
  { title: "Delilah (pull me out of this)", artist: "Fred again.." },
  { title: "Places to Be", artist: "Fred again.." },
  { title: "Don't You Worry Child", artist: "Swedish House Mafia" },
  { title: "Animals", artist: "Martin Garrix" },
  { title: "Firestone", artist: "Kygo" },
  { title: "Never Be Like You", artist: "Flume" },

  // ── COUNTRY ──────────────────────────────────────────────────────────────
  { title: "Last Night", artist: "Morgan Wallen" },
  { title: "Whiskey Glasses", artist: "Morgan Wallen" },
  { title: "Slow Burn", artist: "Kacey Musgraves" },
  { title: "Golden Hour", artist: "Kacey Musgraves" },
  { title: "Tennessee Whiskey", artist: "Chris Stapleton" },
  { title: "Something in the Orange", artist: "Zach Bryan" },
  { title: "I Remember Everything", artist: "Zach Bryan, Kacey Musgraves" },
  { title: "Jolene", artist: "Dolly Parton" },
  { title: "Man! I Feel Like a Woman!", artist: "Shania Twain" },
  { title: "Fast Car", artist: "Luke Combs" },

  // ── METAL / HARD ROCK / PUNK ─────────────────────────────────────────────
  { title: "Enter Sandman", artist: "Metallica" },
  { title: "Nothing Else Matters", artist: "Metallica" },
  { title: "Du Hast", artist: "Rammstein" },
  { title: "Sonne", artist: "Rammstein" },
  { title: "Toxicity", artist: "System of a Down" },
  { title: "Chop Suey!", artist: "System of a Down" },
  { title: "All the Small Things", artist: "blink-182" },
  { title: "Welcome to the Black Parade", artist: "My Chemical Romance" },
  { title: "Helena", artist: "My Chemical Romance" },
  { title: "The Summoning", artist: "Sleep Token" },
  { title: "Chokehold", artist: "Sleep Token" },
  { title: "Can You Feel My Heart", artist: "Bring Me the Horizon" },
  { title: "In the End", artist: "Linkin Park" },
  { title: "Numb", artist: "Linkin Park" },
  { title: "Misery Business", artist: "Paramore" },
  { title: "Boulevard of Broken Dreams", artist: "Green Day" },

  // ── CLASSIC JAZZ / SOUL ──────────────────────────────────────────────────
  { title: "Feeling Good", artist: "Nina Simone" },
  { title: "Sinnerman", artist: "Nina Simone" },
  { title: "Summertime", artist: "Ella Fitzgerald" },
  { title: "So What", artist: "Miles Davis" },
  { title: "Fly Me to the Moon", artist: "Frank Sinatra" },
  { title: "At Last", artist: "Etta James" },
  { title: "What a Wonderful World", artist: "Louis Armstrong" },
  { title: "Strange Fruit", artist: "Billie Holiday" },

  // ── REGGAE / DANCEHALL ───────────────────────────────────────────────────
  { title: "Three Little Birds", artist: "Bob Marley" },
  { title: "No Woman, No Cry", artist: "Bob Marley" },
  { title: "Redemption Song", artist: "Bob Marley" },
  { title: "Temperature", artist: "Sean Paul" },
  { title: "Get Busy", artist: "Sean Paul" },
  { title: "Welcome to Jamrock", artist: "Damian Marley" },
  { title: "Fever", artist: "Vybz Kartel" },

  // ── CINEMATIC / CLASSICAL / NEOCLASSICAL ─────────────────────────────────
  { title: "Nuvole Bianche", artist: "Ludovico Einaudi" },
  { title: "Experience", artist: "Ludovico Einaudi" },
  { title: "On the Nature of Daylight", artist: "Max Richter" },
  { title: "Near Light", artist: "Ólafur Arnalds" },
  { title: "Comptine d'un autre été", artist: "Yann Tiersen" },
  { title: "Time", artist: "Hans Zimmer" },
  { title: "Says", artist: "Nils Frahm" },

  // ── J-POP / ANIME ────────────────────────────────────────────────────────
  { title: "Idol", artist: "YOASOBI" },
  { title: "Racing Into the Night", artist: "YOASOBI" },
  { title: "Lemon", artist: "Kenshi Yonezu" },
  { title: "KICK BACK", artist: "Kenshi Yonezu" },
  { title: "Zenzenzense", artist: "RADWIMPS" },
  { title: "Mixed Nuts", artist: "Official HIGE DANdism" },
  { title: "Gurenge", artist: "LiSA" },

  // ── DISCO / FUNK CLASSICS ────────────────────────────────────────────────
  { title: "September", artist: "Earth, Wind & Fire" },
  { title: "Le Freak", artist: "Chic" },
  { title: "I Feel Love", artist: "Donna Summer" },
  { title: "Don't Stop 'Til You Get Enough", artist: "Michael Jackson" },
  { title: "Billie Jean", artist: "Michael Jackson" },
  { title: "Celebration", artist: "Kool & the Gang" },

  // ── 80s / 90s POP ICONS ──────────────────────────────────────────────────
  { title: "I Wanna Dance with Somebody", artist: "Whitney Houston" },
  { title: "Like a Prayer", artist: "Madonna" },
  { title: "Freedom! '90", artist: "George Michael" },
  { title: "Purple Rain", artist: "Prince" },
  { title: "Dancing Queen", artist: "ABBA" },
  { title: "Take On Me", artist: "a-ha" },
  { title: "Girls Just Want to Have Fun", artist: "Cyndi Lauper" },

  // ── RUSSIAN — MORE GENRES (rap, pop, rock) ──────────────────────────────
  { title: "Город под подошвой", artist: "Oxxxymiron" },
  { title: "Минорка", artist: "Miyagi & Andy Panda" },
  { title: "Мокрые кроссы", artist: "Клава Кока, Тима Белорусских" },
  { title: "Life", artist: "Zivert" },
  { title: "Что такое осень", artist: "ДДТ" },
  { title: "Ты не такой как я", artist: "Ляпис Трубецкой" },
  { title: "На заре", artist: "Альянс" },
  { title: "Лето", artist: "Найк Борзов" },
  { title: "Сансара", artist: "Баста" },
  { title: "Холостяк", artist: "Егор Крид" },

  // ── FRENCH POP / CHANSON ─────────────────────────────────────────────────
  { title: "Alors on danse", artist: "Stromae" },
  { title: "Papaoutai", artist: "Stromae" },
  { title: "Balance ton quoi", artist: "Angèle" },
  { title: "Tilted", artist: "Christine and the Queens" },
  { title: "Non, je ne regrette rien", artist: "Édith Piaf" },
  { title: "La Vie en Rose", artist: "Édith Piaf" },

  // ── DRUM & BASS / DUBSTEP / UK GARAGE ────────────────────────────────────
  { title: "Bangarang", artist: "Skrillex" },
  { title: "Scary Monsters and Nice Sprites", artist: "Skrillex" },
  { title: "Turn Back Time", artist: "Sub Focus" },
  { title: "Blind Faith", artist: "Chase & Status" },
  { title: "Watercolour", artist: "Pendulum" },

  // ── BRAZILIAN ────────────────────────────────────────────────────────────
  { title: "Garota de Ipanema", artist: "Tom Jobim" },
  { title: "Envolver", artist: "Anitta" },
  { title: "Girl from Rio", artist: "Anitta" },

  // ── PUNJABI / DESI POP ───────────────────────────────────────────────────
  { title: "Brown Munde", artist: "AP Dhillon" },
  { title: "Lover", artist: "Diljit Dosanjh" },
];

// ─── RUNNER ───────────────────────────────────────────────────────────────────

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function addSong(song, index, total) {
  try {
    const res = await fetch(`${BASE_URL}/api/admin/songs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": ADMIN_SECRET,
      },
      body: JSON.stringify(song),
    });
    const data = await res.json();
    if (res.ok) {
      const s = data.song;
      console.log(
        `[${index}/${total}] ✓ ${s.artist} — ${s.title} | ${s.language} | tier ${s.popularity_tier} | tags: ${(s.story_intent_tags || []).slice(0, 2).join(", ")}`
      );
      return true;
    } else {
      console.error(`[${index}/${total}] ✗ ${song.artist} — ${song.title}: ${data.error}`);
      return false;
    }
  } catch (err) {
    console.error(`[${index}/${total}] ✗ ${song.artist} — ${song.title}: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log(`\nVibeSong Catalog Seeder`);
  console.log(`Adding ${SONGS.length} songs to http://localhost:3000`);
  console.log(`Each song is tagged via iTunes + Last.fm + GPT-4o (~2s per song)`);
  console.log(`Estimated time: ~${Math.ceil((SONGS.length * 2.5) / 60)} minutes\n`);

  // Check the server is up
  try {
    const ping = await fetch(`${BASE_URL}/api/admin/songs`, {
      headers: { "x-admin-secret": ADMIN_SECRET },
    });
    if (!ping.ok) throw new Error(`Admin API returned ${ping.status}`);
    const existing = await ping.json();
    console.log(`✓ Server reachable. Existing songs in catalog: ${existing.songs?.length ?? 0}\n`);
  } catch (err) {
    console.error(`✗ Cannot reach dev server at ${BASE_URL}: ${err.message}`);
    console.error(`  Make sure you ran: npm run dev\n`);
    process.exit(1);
  }

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < SONGS.length; i++) {
    const song = SONGS[i];
    const before = Date.now();
    const success = await addSong(song, i + 1, SONGS.length);
    if (success) ok++; else fail++;
    const elapsed = Date.now() - before;
    // Wait at least 2s between calls (GPT + iTunes rate limits)
    const wait = Math.max(0, 2000 - elapsed);
    if (wait > 0) await sleep(wait);
  }

  console.log(`\n✓ Done. ${ok} added, ${fail} failed.`);
  console.log(`Check your catalog at ${BASE_URL}/admin`);
}

main().catch(console.error);
