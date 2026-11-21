// 마이크 입력 처리와 바람 판정. 진단 화면과 나홀로나무 화면에서 공유한다.
(() => {
  const SAMPLE_MS = 50;
  const CALIBRATION_MS = 2000;
  const WIND_MS = 250;

  function signalFeatures(samples, spectrum, sampleRate) {
    const stride = Math.max(1, Math.round(sampleRate / 6000));
    let mean = 0;
    for (const x of samples) mean += x;
    mean /= samples.length;
    let energy = 0;
    for (const x of samples) energy += (x - mean) ** 2;
    const level = 10 * Math.log10(Math.max(energy / samples.length, 1e-10));
    if (level < -70) return { level, lowShare: 0, periodicity: 0 };

    // 목소리의 반복성은 간격을 두고 샘플을 비교해서 가늠한다.
    let periodicity = 0, previous = 1, beforePrevious = 1;
    const rate = sampleRate / stride;
    for (let lag = Math.round(rate / 430); lag <= Math.round(rate / 75); lag++) {
      const offset = lag * stride;
      let product = 0, first = 0, second = 0;
      for (let i = offset; i < samples.length; i += stride) {
        const x = samples[i] - mean, y = samples[i - offset] - mean;
        product += x * y;
        first += x * x;
        second += y * y;
      }
      const similarity = product / Math.sqrt(first * second || 1);
      if (previous > beforePrevious && previous >= similarity) {
        periodicity = Math.max(periodicity, previous);
      }
      beforePrevious = previous;
      previous = similarity;
    }

    let low = 0, total = 0;
    const hzPerBin = sampleRate / samples.length;
    for (let i = 1; i < spectrum.length && i * hzPerBin <= 6000; i++) {
      const power = 10 ** (spectrum[i] / 10);
      total += power;
      if (i * hzPerBin <= 700) low += power;
    }
    return { level, lowShare: total > 0 ? low / total : 0, periodicity };
  }

  function classify(state, features, now, elapsed) {
    const { level, lowShare, periodicity } = features;
    const loud = level > Math.max(state.floor + 9, -52);
    if (loud && periodicity >= .68) state.lastVoice = now;
    if (!loud) {
      state.windMs = 0;
      return 'quiet';
    }
    if (now - state.lastVoice < 400) {
      state.windMs = 0;
      return 'voice';
    }
    // 바람처럼 낮은 대역의 불규칙한 소리가 이어질 때만 바람으로 표시한다.
    if (lowShare >= .46 && periodicity <= .53) {
      state.windMs += elapsed;
      return state.windMs >= WIND_MS ? 'wind' : 'waiting';
    }
    state.windMs = 0;
    return 'unclear';
  }

  function playRustle(context, duration, strength = 1) {
    const noise = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const samples = noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = 2 * Math.random() - 1;

    const source = context.createBufferSource();
    source.buffer = noise;
    const soften = context.createBiquadFilter();
    soften.type = 'lowpass';
    soften.frequency.value = 2500 + Math.random() * 1700;
    const filter = context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 520 + Math.random() * 620;
    const volume = context.createGain();
    const startAt = context.currentTime;
    // 말의 길이와 관계없이 답할 때마다 잎이 스치는 횟수와 간격을 바꾼다.
    const pulses = Math.max(1, Math.round(duration * (2.6 + Math.random() * 2.1)));
    const beat = duration / pulses;
    volume.gain.setValueAtTime(0, startAt);
    for (let i = 0; i < pulses; i++) {
      const offset = i * beat;
      const peak = offset + beat * (.16 + Math.random() * .28);
      const fall = offset + beat * (.73 + Math.random() * .21);
      const gain = strength * (.12 + Math.random() * .12) * (1 - i / (pulses + 1));
      volume.gain.linearRampToValueAtTime(gain, startAt + peak);
      volume.gain.linearRampToValueAtTime(0, startAt + fall);
    }
    source.connect(soften).connect(filter).connect(volume).connect(context.destination);
    source.addEventListener('ended', () => {
      source.disconnect();
      soften.disconnect();
      filter.disconnect();
      volume.disconnect();
    }, { once: true });

    source.start(startAt);
  }

  function createWindRustle(context) {
    const duration = 2;
    const buffer = context.createBuffer(1, context.sampleRate * duration, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) {
      const phase = 2 * Math.PI * i / samples.length;
      const flutter = .60 + .23 * Math.sin(phase * 7) + .12 * Math.sin(phase * 11 + 1.4);
      samples[i] = (Math.random() * 2 - 1) * flutter;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const high = context.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = 1750;
    const low = context.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 4200;
    const volume = context.createGain();
    volume.gain.value = 0;
    source.connect(high).connect(low).connect(volume).connect(context.destination);
    source.start();
    return {
      setStrength(strength) {
        const now = context.currentTime;
        volume.gain.setTargetAtTime(strength > 0 ? .022 + .065 * strength : 0,
          now, strength > 0 ? .045 : .065);
      },
      stop() {
        this.setStrength(0);
        source.stop(context.currentTime + .22);
      },
    };
  }

  function createLonetreeMic({ onState, onSample, reuseCalibration = false, windSound = false }) {
    let session = null, savedFloor = null;
    let tailContext = null, tailTimer;
    let touchContext = null;

    function closeTail() {
      clearTimeout(tailTimer);
      if (tailContext) tailContext.close().catch(() => {});
      tailContext = null;
    }

    function calibrate() {
      if (!session?.analyser) return;
      session.windRustle?.setStrength(0);
      Object.assign(session, {
        baseline: [], calibrationMs: 0, floor: null, windMs: 0, lastVoice: -Infinity,
      });
      onState('calibrating');
    }

    function sample(now, active) {
      if (session !== active) return;
      active.frame = requestAnimationFrame(time => sample(time, active));
      if (active.context.state !== 'running' || now - active.lastSample < SAMPLE_MS) return;
      const elapsed = Math.min(now - active.lastSample, SAMPLE_MS * 2);
      active.lastSample = now;
      if (now < active.ignoreUntil) {
        active.windRustle?.setStrength(0);
        return;
      }
      active.analyser.getFloatTimeDomainData(active.samples);
      active.analyser.getFloatFrequencyData(active.spectrum);
      const features = signalFeatures(active.samples, active.spectrum, active.context.sampleRate);
      let kind = 'calibration';
      if (active.floor === null) {
        active.baseline.push(features.level);
        active.calibrationMs += elapsed;
        if (active.calibrationMs >= CALIBRATION_MS) {
          active.baseline.sort((a, b) => a - b);
          active.floor = active.baseline[Math.floor(active.baseline.length * .75)];
          if (reuseCalibration) savedFloor = active.floor;
          onState('listening');
        }
      } else {
        kind = classify(active, features, now, elapsed);
      }
      const threshold = active.floor === null ? null : Math.max(active.floor + 9, -52);
      // 작은 숨이 판정선을 넘는 순간부터 강한 숨까지 폭을 넓혀 쓴다.
      const range = Math.max(24, -12 - threshold);
      const intensity = Math.max(0, Math.min(1, (features.level - threshold) / range));
      const strength = kind === 'wind' ? .08 + .92 * intensity ** 1.65 : 0;
      if (windSound && strength > 0 && !active.windRustle) {
        active.windRustle = createWindRustle(active.context);
      }
      active.windRustle?.setStrength(strength);
      onSample({
        time: now, level: features.level, kind, floor: active.floor, threshold, strength,
        calibrationRemaining: active.floor === null ? CALIBRATION_MS - active.calibrationMs : 0,
      });
    }

    function stop(state = 'off', error, letReplyFinish = false) {
      const active = session;
      session = null;
      if (active) {
        cancelAnimationFrame(active.frame);
        active.windRustle?.stop();
        active.stream?.getTracks().forEach(track => track.stop());
        const replyRemaining = (active.replyEndsAt || 0) - performance.now();
        if (letReplyFinish && replyRemaining > 0) {
          tailContext = active.context;
          tailTimer = setTimeout(closeTail, replyRemaining + 40);
        } else if (active.context.state !== 'closed') {
          active.context.close().catch(() => {});
        }
      }
      onState(state, error);
    }

    async function start() {
      if (session) return;
      closeTail();
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!navigator.mediaDevices?.getUserMedia || !Audio) {
        onState('unavailable');
        return;
      }
      let active;
      try {
        active = { context: new Audio() };
        session = active;
        onState('starting');
        const resuming = active.context.resume().catch(error => error);
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });
        if (session !== active) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        active.stream = stream;
        const resumeError = await resuming;
        if (session !== active) return;
        if (resumeError) throw resumeError;
        const analyser = active.context.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0;
        active.context.createMediaStreamSource(stream).connect(analyser);
        Object.assign(active, {
          analyser, samples: new Float32Array(analyser.fftSize),
          spectrum: new Float32Array(analyser.frequencyBinCount),
          lastSample: performance.now(),
        });
        stream.getAudioTracks().forEach(track => track.addEventListener('ended', () => {
          if (session === active) stop('ended');
        }, { once: true }));
        if (savedFloor === null) {
          calibrate();
        } else {
          Object.assign(active, { floor: savedFloor, windMs: 0, lastVoice: -Infinity });
          onState('listening');
        }
        active.frame = requestAnimationFrame(time => sample(time, active));
      } catch (error) {
        if (!active || session === active) stop('error', error);
      }
    }

    function rustle() {
      if (!session?.analyser || session.context.state !== 'running' || performance.now() < session.ignoreUntil) return 0;
      const context = session.context;
      const duration = .18 + (Math.random() ** 2.6) * 2.82;
      playRustle(context, duration);

      // 스피커에서 나온 바스락 소리와 잔향에는 마이크가 반응하지 않는다.
      session.replyEndsAt = performance.now() + 1000 * duration;
      session.ignoreUntil = session.replyEndsAt + 180;
      session.windMs = 0;
      session.lastVoice = -Infinity;
      return 1000 * duration;
    }

    async function touchRustle() {
      const AudioClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioClass) return;
      const duration = .20 + Math.random() * .16;
      try {
        touchContext ??= new AudioClass();
        const context = touchContext;
        if (context.state !== 'running') await context.resume();
        if (touchContext !== context) return;
        if (session) session.ignoreUntil = Math.max(session.ignoreUntil, performance.now() + duration * 1000 + 180);
        playRustle(context, duration, .82);
      } catch {
        // 소리를 재생할 수 없는 기기에서도 터치 모션은 작동한다.
      }
    }

    function release(shouldReply = false) {
      if (!session) return 0;
      if (shouldReply) rustle();
      const remaining = Math.max(0, (session.replyEndsAt || 0) - performance.now());
      stop('off', undefined, true);
      return remaining;
    }

    addEventListener('pagehide', () => {
      if (session) stop();
      closeTail();
      if (touchContext) touchContext.close().catch(() => {});
      touchContext = null;
    });
    return {
      start,
      release,
      calibrate,
      rustle,
      touchRustle,
      toggle() { return session ? stop() : start(); },
    };
  }

  window.createLonetreeMic = createLonetreeMic;
})();
