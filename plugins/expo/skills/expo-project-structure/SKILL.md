<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>القرآن الكريم - قراءة مستمرة دون توقف</title>
    <link href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #f4f6f8;
            --card-bg: #ffffff;
            --primary-color: #0f5132;
            --accent-color: #d4af37;
            --text-color: #2b2b2b;
            --border-color: #e0e0e0;
            --highlight-bg: #fff3cd;
            --highlight-border: #d4af37;
            --font-quran: 'Amiri', serif;
            --font-ui: 'Tajawal', sans-serif;
        }

        [data-theme="dark"] {
            --bg-color: #12181b;
            --card-bg: #1e262c;
            --primary-color: #198754;
            --accent-color: #f1c40f;
            --text-color: #e4e6eb;
            --border-color: #2d3748;
            --highlight-bg: #3e3812;
            --highlight-border: #f1c40f;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: var(--font-ui);
        }

        body {
            background-color: var(--bg-color);
            color: var(--text-color);
            transition: all 0.3s ease;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }

        header {
            background-color: var(--primary-color);
            color: white;
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 4px 10px rgba(0,0,0,0.15);
            position: sticky;
            top: 0;
            z-index: 100;
        }

        header h1 {
            font-family: var(--font-quran);
            color: var(--accent-color);
            font-size: 1.8rem;
        }

        .controls {
            display: flex;
            gap: 0.8rem;
            align-items: center;
            flex-wrap: wrap;
        }

        select, button {
            padding: 0.5rem 0.8rem;
            border-radius: 8px;
            border: 1px solid var(--border-color);
            outline: none;
            font-size: 0.9rem;
        }

        button {
            background-color: var(--accent-color);
            color: #000;
            font-weight: bold;
            cursor: pointer;
            transition: 0.2s;
            border: none;
        }

        button:hover {
            opacity: 0.9;
        }

        .container {
            display: flex;
            flex: 1;
            overflow: hidden;
            height: calc(100vh - 140px);
        }

        .sidebar {
            width: 320px;
            background-color: var(--card-bg);
            border-left: 1px solid var(--border-color);
            display: flex;
            flex-direction: column;
        }

        .search-box {
            padding: 1rem;
            border-bottom: 1px solid var(--border-color);
        }

        .search-box input {
            width: 100%;
            padding: 0.5rem;
            border-radius: 6px;
            border: 1px solid var(--border-color);
        }

        .surah-list {
            overflow-y: auto;
            flex: 1;
        }

        .surah-item {
            padding: 1rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--border-color);
            cursor: pointer;
            transition: 0.2s;
        }

        .surah-item:hover, .surah-item.active {
            background-color: rgba(15, 81, 50, 0.1);
            border-right: 4px solid var(--primary-color);
        }

        .surah-number {
            background-color: var(--primary-color);
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.8rem;
        }

        .reader-area {
            flex: 1;
            padding: 2rem;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            align-items: center;
            scroll-behavior: smooth;
        }

        .bismillah {
            font-family: var(--font-quran);
            font-size: 2rem;
            color: var(--accent-color);
            margin-bottom: 1.5rem;
            text-align: center;
        }

        .quran-container {
            max-width: 900px;
            width: 100%;
            background-color: var(--card-bg);
            padding: 2.5rem;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.05);
            border: 1px solid var(--border-color);
            line-height: 2.6;
        }

        .ayah-span {
            font-family: var(--font-quran);
            font-size: 1.9rem;
            padding: 4px 8px;
            border-radius: 8px;
            transition: background-color 0.3s, color 0.3s;
            cursor: pointer;
            display: inline;
        }

        .ayah-span:hover {
            background-color: rgba(212, 175, 55, 0.2);
        }

        .ayah-span.active-ayah {
            background-color: var(--highlight-bg);
            border: 1px dashed var(--highlight-border);
            color: var(--accent-color);
            font-weight: bold;
        }

        .ayah-number {
            color: var(--accent-color);
            font-size: 1.4rem;
            margin: 0 0.4rem;
            display: inline-block;
        }

        .audio-player-bar {
            background-color: var(--card-bg);
            border-top: 1px solid var(--border-color);
            padding: 0.8rem 2rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
        }

        .play-controls {
            display: flex;
            align-items: center;
            gap: 1rem;
        }

        .play-btn {
            background-color: var(--primary-color);
            color: white;
            padding: 0.6rem 1.5rem;
            font-size: 1.1rem;
            border-radius: 25px;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        @media (max-width: 768px) {
            .container { flex-direction: column; height: auto; }
            .sidebar { width: 100%; height: 200px; }
            .audio-player-bar { flex-direction: column; text-align: center; }
        }
    </style>
</head>
<body>

    <header>
        <h1>القرآن الكريم - قراءة مستمرة دون توقف</h1>
        <div class="controls">
            <select id="reciterSelect">
                <option value="ar.alafasy">مشاري العفاسي</option>
                <option value="ar.abdulbasitmurattal">عبد الباسط عبد الصمد (مرتل)</option>
                <option value="ar.minshawi">محمد صديق المنشاوي</option>
                <option value="ar.husrimeshari">محمود خليل الحصري</option>
                <option value="ar.mahermuaiqly">ماهر المعيقلي</option>
                <option value="ar.shaatree">أبو بكر الشاطري</option>
            </select>
            <button id="themeToggle">الوضع الليلي 🌙</button>
        </div>
    </header>

    <div class="container">
        <div class="sidebar">
            <div class="search-box">
                <input type="text" id="searchInput" placeholder="ابحث عن اسم السورة...">
            </div>
            <div class="surah-list" id="surahContainer">
                <div style="padding:1rem; text-align:center;">جاري تحميل القائمة...</div>
            </div>
        </div>

        <div class="reader-area" id="readerArea">
            <div class="bismillah" id="bismillah">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</div>
            <div class="quran-container" id="quranContainer">
                اختر سورة للبدء بالقراءة والمتابعة.
            </div>
        </div>
    </div>

    <div class="audio-player-bar">
        <div class="play-controls">
            <button id="mainPlayBtn" class="play-btn">
                <span id="playIcon">▶</span> <span id="playText">تشغيل التلاوة</span>
            </button>
            <div id="currentAudioTitle">السورة الحالية: اختر سورة</div>
        </div>
        <audio id="audioPlayer" preload="auto"></audio>
        <audio id="nextAudioPreloader" preload="auto" style="display:none;"></audio>
    </div>

    <script>
        const surahContainer = document.getElementById('surahContainer');
        const quranContainer = document.getElementById('quranContainer');
        const bismillah = document.getElementById('bismillah');
        const audioPlayer = document.getElementById('audioPlayer');
        const nextAudioPreloader = document.getElementById('nextAudioPreloader');
        const currentAudioTitle = document.getElementById('currentAudioTitle');
        const searchInput = document.getElementById('searchInput');
        const reciterSelect = document.getElementById('reciterSelect');
        const themeToggle = document.getElementById('themeToggle');
        const mainPlayBtn = document.getElementById('mainPlayBtn');
        const playIcon = document.getElementById('playIcon');
        const playText = document.getElementById('playText');

        let allSurahs = [];
        let currentSurahAyahs = [];
        let currentSurahNumber = 1;
        let currentAyahIndex = 0;
        let isPlaying = false;
        let wakeLock = null;

        // 1. Keep Screen & System Awake (Screen Wake Lock API)
        async function requestWakeLock() {
            try {
                if ('wakeLock' in navigator) {
                    wakeLock = await navigator.wakeLock.request('screen');
                }
            } catch (err) {
                console.log('Wake Lock Error:', err);
            }
        }

        // Re-acquire wake lock if tab regains focus
        document.addEventListener('visibilitychange', async () => {
            if (wakeLock !== null && document.visibilityState === 'visible') {
                await requestWakeLock();
            }
        });

        // 2. Register Media Session API for background OS control
        function updateMediaSession(surahName, ayahNumber) {
            if ('mediaSession' in navigator) {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: `سورة ${surahName} - آية ${ayahNumber}`,
                    artist: reciterSelect.options[reciterSelect.selectedIndex].text,
                    album: 'القرآن الكريم'
                });

                navigator.mediaSession.setActionHandler('play', () => audioPlayer.play());
                navigator.mediaSession.setActionHandler('pause', () => audioPlayer.pause());
                navigator.mediaSession.setActionHandler('nexttrack', () => playAyah(currentAyahIndex + 1));
                navigator.mediaSession.setActionHandler('previoustrack', () => playAyah(Math.max(0, currentAyahIndex - 1)));
            }
        }

        // 3. Fetch Surah List
        async function fetchSurahs() {
            try {
                const response = await fetch('https://api.alquran.cloud/v1/surah');
                const data = await response.json();
                allSurahs = data.data;
                renderSurahs(allSurahs);
                loadSurah(1, false);
            } catch (error) {
                surahContainer.innerHTML = '<div style="padding:1rem; color:red;">خطأ في تحميل السور.</div>';
            }
        }

        // 4. Render Sidebar
        function renderSurahs(surahs) {
            surahContainer.innerHTML = '';
            surahs.forEach(surah => {
                const item = document.createElement('div');
                item.className = `surah-item ${surah.number === currentSurahNumber ? 'active' : ''}`;
                item.innerHTML = `
                    <div>
                        <strong>${surah.name}</strong>
                        <div style="font-size:0.8rem; color:#777;">آياتها ${surah.numberOfAyahs}</div>
                    </div>
                    <div class="surah-number">${surah.number}</div>
                `;
                item.onclick = () => {
                    requestWakeLock();
                    updateActiveSidebar(surah.number);
                    loadSurah(surah.number, true);
                };
                surahContainer.appendChild(item);
            });
        }

        function updateActiveSidebar(surahNumber) {
            document.querySelectorAll('.surah-item').forEach((el, index) => {
                if (allSurahs[index] && allSurahs[index].number === surahNumber) {
                    el.classList.add('active');
                    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                } else {
                    el.classList.remove('active');
                }
            });
        }

        // 5. Load Surah Data
        async function loadSurah(surahNumber, autoPlay = false) {
            currentSurahNumber = surahNumber;
            currentAyahIndex = 0;
            const reciter = reciterSelect.value;
            quranContainer.innerHTML = 'جاري تحميل السورة...';

            try {
                const response = await fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}/${reciter}`);
                const data = await response.json();
                currentSurahAyahs = data.data.ayahs;

                bismillah.style.display = (surahNumber === 9) ? 'none' : 'block';

                quranContainer.innerHTML = '';
                currentSurahAyahs.forEach((ayah, index) => {
                    let text = ayah.text;
                    if (ayah.numberInSurah === 1 && surahNumber !== 1 && surahNumber !== 9) {
                        text = text.replace('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ', '');
                    }

                    const ayahSpan = document.createElement('span');
                    ayahSpan.className = 'ayah-span';
                    ayahSpan.id = `ayah-${index}`;
                    ayahSpan.innerHTML = `${text} <span class="ayah-number">﴿${toArabicNumerals(ayah.numberInSurah)}﴾</span> `;
                    
                    ayahSpan.onclick = () => {
                        requestWakeLock();
                        playAyah(index);
                    };

                    quranContainer.appendChild(ayahSpan);
                });

                currentAudioTitle.innerText = `السورة: ${data.data.name} | القارئ: ${reciterSelect.options[reciterSelect.selectedIndex].text}`;
                updateActiveSidebar(surahNumber);

                if (autoPlay) {
                    playAyah(0);
                }

            } catch (error) {
                quranContainer.innerHTML = 'حدث خطأ في جلب البيانات. جاري إعادة المحاولة تلقائياً...';
                setTimeout(() => loadSurah(surahNumber, autoPlay), 2000);
            }
        }

        // 6. Non-stop Ayah Player
        function playAyah(index) {
            // Infinite loop transition between Surahs
            if (index >= currentSurahAyahs.length) {
                let nextSurah = currentSurahNumber + 1;
                if (nextSurah > 114) {
                    nextSurah = 1; // Seamless return to Al-Fatiha
                }
                loadSurah(nextSurah, true);
                return;
            }

            currentAyahIndex = index;
            const ayah = currentSurahAyahs[index];
            const currentSurahObj = allSurahs.find(s => s.number === currentSurahNumber);

            // Active verse scroll & glow
            document.querySelectorAll('.ayah-span').forEach(el => el.classList.remove('active-ayah'));
            const currentElement = document.getElementById(`ayah-${index}`);
            if (currentElement) {
                currentElement.classList.add('active-ayah');
                currentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }

            // Preload next audio file
            if (index + 1 < currentSurahAyahs.length) {
                nextAudioPreloader.src = currentSurahAyahs[index + 1].audio;
            }

            // Update lock screen metadata
            if (currentSurahObj) {
                updateMediaSession(currentSurahObj.name, ayah.numberInSurah);
            }

            // Continuous execution
            audioPlayer.src = ayah.audio;
            const playPromise = audioPlayer.play();

            if (playPromise !== undefined) {
                playPromise.then(() => {
                    isPlaying = true;
                    updateBtnUI(true);
                }).catch(() => {
                    // Immediate auto-retry on background throttling
                    setTimeout(() => audioPlayer.play(), 250);
                });
            }
        }

        // Auto transition to next verse
        audioPlayer.onended = () => {
            playAyah(currentAyahIndex + 1);
        };

        // Self-healing error handler: skip broken audio tracks without stopping
        audioPlayer.onerror = () => {
            setTimeout(() => playAyah(currentAyahIndex + 1), 500);
        };

        function toggleAudio() {
            requestWakeLock();
            if (isPlaying) {
                audioPlayer.pause();
                isPlaying = false;
                updateBtnUI(false);
            } else {
                playAyah(currentAyahIndex);
            }
        }

        function updateBtnUI(playing) {
            if (playing) {
                playIcon.innerText = '⏸';
                playText.innerText = 'إيقاف مؤقت';
                mainPlayBtn.style.backgroundColor = '#dc3545';
            } else {
                playIcon.innerText = '▶';
                playText.innerText = 'تشغيل التلاوة';
                mainPlayBtn.style.backgroundColor = 'var(--primary-color)';
            }
        }

        mainPlayBtn.onclick = toggleAudio;

        function toArabicNumerals(num) {
            return num.toString().replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
        }

        searchInput.oninput = (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = allSurahs.filter(s => s.name.includes(query) || s.number.toString() === query);
            renderSurahs(filtered);
        };

        reciterSelect.onchange = () => {
            loadSurah(currentSurahNumber, isPlaying);
        };

        themeToggle.onclick = () => {
            const isDark = document.body.getAttribute('data-theme') === 'dark';
            if (isDark) {
                document.body.removeAttribute('data-theme');
                themeToggle.innerText = 'الوضع الليلي 🌙';
            } else {
                document.body.setAttribute('data-theme', 'dark');
                themeToggle.innerText = 'الوضع النهاري ☀️';
            }
        };

        fetchSurahs();
    </script>
</body>
</html>
