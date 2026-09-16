
    // ==========================================
    // AUDIO ENGINE (MASTER-SWITCH CONTROL)
    // ==========================================
    let audioCtx = null;
    let isMasterSoundOn = false;
    let musicInterval = null;
    let musicStep = 0;

    function initAudio() {
        try {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
        } catch(e) {}
    }

    const melodyNotes = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63, 261.63, 392.00, 220.00, 261.63, 329.63, 440.00, 329.63, 261.63, 220.00, 329.63];
    const bassNotes = [130.81, 130.81, 110.00, 110.00, 87.31, 87.31, 98.00, 98.00];

    function playNote(freq, type, duration, vol) {
        if (!audioCtx || !isMasterSoundOn) return;
        try {
            let osc = audioCtx.createOscillator();
            let gain = audioCtx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
            gain.gain.setValueAtTime(vol, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + duration);
        } catch (e) {}
    }

    function toggleMasterSound() {
        initAudio();
        isMasterSoundOn = !isMasterSoundOn;
        let btn = document.getElementById('btn-sound-toggle');
        if (isMasterSoundOn) {
            btn.innerText = t('sound_on');
            btn.classList.add('active');
            musicStep = 0;
            musicInterval = setInterval(() => {
                if (!isMasterSoundOn) return;
                playNote(melodyNotes[musicStep % melodyNotes.length], 'square', 0.18, 0.03);
                if (musicStep % 4 === 0) {
                    let bIndex = Math.floor((musicStep % 16) / 2);
                    playNote(bassNotes[bIndex % bassNotes.length], 'triangle', 0.3, 0.06);
                }
                musicStep++;
            }, 180);
        } else {
            btn.innerText = t('sound_off');
            btn.classList.remove('active');
            if (musicInterval) clearInterval(musicInterval);
        }
    }

    function playSound(type) {
        if (!isMasterSoundOn) return;
        initAudio();
        if (!audioCtx) return;
        try {
            let osc = audioCtx.createOscillator();
            let gain = audioCtx.createGain();
            osc.type = type === 'goal' ? 'sawtooth' : (type === 'whistle' ? 'triangle' : 'sine');
            let now = audioCtx.currentTime;
            osc.frequency.setValueAtTime(type === 'whistle' ? 1800 : (type === 'goal' ? 220 : 600), now);
            if (type === 'whistle') osc.frequency.setValueAtTime(2200, now + 0.1);
            if (type === 'goal') osc.frequency.exponentialRampToValueAtTime(660, now + 0.4);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + (type === 'goal' ? 0.6 : 0.2));
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(now + (type === 'goal' ? 0.6 : 0.2));
        } catch (e) { }
    }

    window.addEventListener('touchstart', () => initAudio(), { once: true, passive: true });
    window.addEventListener('click', () => initAudio(), { once: true });

