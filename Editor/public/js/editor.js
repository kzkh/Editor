document.addEventListener('DOMContentLoaded', () => {
  const entryInput = document.getElementById('entry-upload');
  if (!entryInput) return;

  entryInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;

    // 1) Убираем стартовый оверлей
    const overlay = document.getElementById('entryOverlay');
    if (overlay) overlay.remove();

    // 2) Копируем файл в главный скрытый инпут
    const mainInput = document.getElementById('upload');
    const dt = new DataTransfer();
    dt.items.add(file);
    mainInput.files = dt.files;

    // 3) Запускаем его change → дальше пойдёт ваш существующий код
    mainInput.dispatchEvent(new Event('change'));

    document.getElementById('video-container').classList.remove('d-none');
  document.getElementById('timeline').classList.remove('d-none');
  });
});

// === Spinner внутри preview-wrapper ===
function showPreviewSpinner() {
  const wrapper = document.getElementById('preview-wrapper');
  if (!wrapper || wrapper.querySelector('.preview-spinner')) return;
  const spinner = document.createElement('div');
  spinner.className = 'preview-spinner';
  spinner.innerHTML = '<div class="spinner-border text-light"role="status"><span class="visually-hidden">Загрузка…</span></div>';
  wrapper.appendChild(spinner);
}

function hidePreviewSpinner() {
  const wrapper = document.getElementById('preview-wrapper');
  const sp = wrapper && wrapper.querySelector('.preview-spinner');
  if (sp) sp.remove();
}


// === Loading-overlay с Bootstrap-спиннером ===
function showLoading() {
  if (document.getElementById('loadingOverlay')) return;
  // Создаём фон
  const ov = document.createElement('div');
  ov.id = 'loadingOverlay';
  Object.assign(ov.style, {
    position:      'fixed',
    top:           '0',
    left:          '0',
    width:         '100vw',
    height:        '100vh',
    background:    'rgba(0,0,0,0.5)',
    display:       'flex',
    alignItems:    'center',
    justifyContent:'center',
    zIndex:        '9999',
    pointerEvents: 'none'
  });

  // Создаём спиннер
  const spinner = document.createElement('div');
  spinner.className = 'spinner-border text-light';
  spinner.setAttribute('role', 'status');
  // Для доступности внутри
  spinner.innerHTML = `<span class="visually-hidden">Загрузка…</span>`;

  // Вставляем спиннер в оверлей
  ov.appendChild(spinner);
  document.body.appendChild(ov);
}

function hideLoading() {
  const ov = document.getElementById('loadingOverlay');
  if (ov) ov.remove();
}

// === Загрузка видео + инициализация таймлайна ===
document.getElementById('upload').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return alert('Выберите файл');

  // 1) Убираем стартовый оверлей из HTML
  const entryOv = document.getElementById('entryOverlay');
  if (entryOv) entryOv.remove();

  // 2) Обновляем название проекта
  document.getElementById('project-name').textContent = 'ПРОЕКТ | ' + file.name;

  // 3) Само видео-превью
  const video = document.getElementById('video');
  video.src = URL.createObjectURL(file);
  video.load();
  video.onloadedmetadata = () => {
    const t = document.getElementById('timeline');
    if (t.noUiSlider) t.noUiSlider.destroy();
    noUiSlider.create(t, {
      start:    [0, video.duration],
      connect:  true,
      range:    { min:0, max:video.duration },
      tooltips: [true, true],
      step:     1,
      format:   { to: v=>Math.floor(v), from: v=>+v }
    });
  };
});

// === Обновление CSS-фильтров + эффекты на превью-видео ===
function updateFilters() {
  const v   = document.getElementById('video');
  const hue = +document.getElementById('hue-slider').value;
  const sat = +document.getElementById('saturation-slider').value;
  const con = +document.getElementById('contrast-slider').value;
  const bri = +document.getElementById('brightness-slider').value;

  const filters = [
    `hue-rotate(${hue}deg)`,
    `saturate(${sat})`,
    `contrast(${con})`,
    `brightness(${bri})`
  ];

  const blurVal = +document.getElementById('effect-blur').value;
  if (blurVal > 0)            filters.push(`blur(${blurVal}px)`);
  if (document.getElementById('effect-grayscale').checked) filters.push('grayscale(1)');
  if (document.getElementById('effect-invert').checked)    filters.push('invert(1)');

  v.style.filter = filters.join(' ');
  updateTextOverlay();
}

document.getElementById('text-size').addEventListener('input', e => {
  let value = parseInt(e.target.value, 10);
  if (isNaN(value) || value < 1) value = 1;
  if (value > 360) value = 360;
  e.target.value = value;
  updateTextOverlay();
});

// === Обновление текстового оверлея на превью-видео ===
function updateTextOverlay() {
  const o = document.getElementById('overlay-text');
  o.textContent   = document.getElementById('text-input').value;
  o.style.fontSize   = document.getElementById('text-size').value + 'px';
  o.style.color      = document.getElementById('text-color').value;
  o.style.fontFamily = document.getElementById('font-select').value;
  const x = document.getElementById('text-position-x').value;
  const y = document.getElementById('text-position-y').value;
  o.style.left      = x + '%';
  o.style.top       = y + '%';
  o.style.transform = `translate(-${x}%, -${y}%)`;
}

// === Навешиваем слушатели на слайдеры эффектов и фильтров ===
['hue-slider','saturation-slider','contrast-slider','brightness-slider','effect-blur']
  .forEach(id => document.getElementById(id).addEventListener('input', updateFilters));
['effect-grayscale','effect-invert']
  .forEach(id => document.getElementById(id).addEventListener('change', updateFilters));

// === Навешиваем слушатели на контролы текста ===
['text-input','text-size','text-color','font-select','text-position-x','text-position-y']
  .forEach(id => document.getElementById(id).addEventListener('input', updateTextOverlay));

// === Громкость браузерного preview-видео ===
document.getElementById('volume-slider').addEventListener('input', e => {
  const pv = document.getElementById('processed-video');
  pv.volume = parseFloat(e.target.value);
});

// === Preview / Download ===
async function applyChanges(preview = true) {
  const downloadBtn = document.getElementById('download');
  const downloadLabel = downloadBtn.querySelector('span');
  const file = document.getElementById('upload').files[0];
  if (!file) return alert('Выберите файл');

  const fd = new FormData();
  fd.append('video', file);
  ['hue','saturation','contrast','brightness']
    .forEach(n => fd.append(n, document.getElementById(n+'-slider').value));
  const [s,e] = document.getElementById('timeline').noUiSlider.get();
  fd.append('startSecond', s);
  fd.append('endSecond',   e);

  // текст
  fd.append('text', document.getElementById('text-input').value);
  fd.append('textSize', document.getElementById('text-size').value);
  fd.append('textColor', document.getElementById('text-color').value.replace('#',''));
  fd.append('textPositionX', document.getElementById('text-position-x').value);
  fd.append('textPositionY', document.getElementById('text-position-y').value);
  fd.append('font', document.getElementById('font-select').value);

  // эффекты
  fd.append('effectBlur',      document.getElementById('effect-blur').value);
  fd.append('effectGrayscale', document.getElementById('effect-grayscale').checked ? '1' : '0');
  fd.append('effectInvert',    document.getElementById('effect-invert').checked ? '1' : '0');

  // громкость
  fd.append('volume', document.getElementById('volume-slider').value);

  if (preview) showPreviewSpinner();

  // только при сохранении
  if (!preview) {
    fd.append('format',     document.getElementById('render-format').value);
    fd.append('resolution', document.getElementById('render-resolution').value);
        // запустили «анимацию» на кнопке
        downloadBtn.disabled = true;
        downloadBtn.classList.add('loading');
        downloadLabel.textContent = 'Скачивается…';
  }

  try {
    const res = await fetch('/upload', { method:'POST', body: fd });
    if (!res.ok) throw new Error(res.statusText);
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);

    if (preview) {
      const pvElm = document.getElementById('processed-video');
      pvElm.addEventListener('loadeddata', hidePreviewSpinner, { once: true });
      pvElm.src = url;
      pvElm.load();
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = `output.${document.getElementById('render-format').value}`;
      a.click();
      URL.revokeObjectURL(url);
      hideLoading();
    }
  } catch (err) {
    console.error(err);
    alert('Ошибка при обработке');
    hideLoading();
    if (preview) hidePreviewSpinner();
  } finally {
    if (!preview) {
      // остановить анимацию и вернуть кнопку в исходное состояние
      downloadBtn.classList.remove('loading');
      downloadBtn.disabled = false;
      downloadLabel.textContent = 'Скачать';
    }
  }
}
document.getElementById('apply').addEventListener('click', () => applyChanges(true));
document.getElementById('download').addEventListener('click', () => applyChanges(false));

// === Custom preview-controls logic (Play/Pause, Seek, Vol/Mute) ===
const pv   = document.getElementById('processed-video');
const btnPlay    = document.getElementById('btn-play');
const btnBack    = document.getElementById('btn-back');
const btnForward = document.getElementById('btn-forward');
const seek       = document.getElementById('preview-seek');
const volSlider  = document.getElementById('preview-volume');
const btnMute    = document.getElementById('btn-mute');

// Play / Pause
btnPlay.addEventListener('click', () => pv.paused ? pv.play() : pv.pause());
pv.addEventListener('play',  () => btnPlay.innerHTML = '<i class="bi bi-pause-fill"></i>');
pv.addEventListener('pause', () => btnPlay.innerHTML = '<i class="bi bi-play-fill"></i>');

// Назад / Вперёд 5 секунд
btnBack.addEventListener('click',    () => pv.currentTime = Math.max(0, pv.currentTime - 5));
btnForward.addEventListener('click', () => pv.currentTime = Math.min(pv.duration, pv.currentTime + 5));

// Seek-ползунок
pv.addEventListener('loadedmetadata', () => seek.max = pv.duration);
pv.addEventListener('timeupdate',     () => seek.value = pv.currentTime);
seek.addEventListener('input',        () => pv.currentTime = +seek.value);

// Громкость и Mute
volSlider.addEventListener('input', () => pv.volume = +volSlider.value);
btnMute.addEventListener('click', () => {
  pv.muted = !pv.muted;
  btnMute.innerHTML = pv.muted
    ? '<i class="bi bi-volume-mute-fill"></i>'
    : '<i class="bi bi-volume-up-fill"></i>';
});
