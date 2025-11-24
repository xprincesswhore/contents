document.addEventListener("DOMContentLoaded", async () => {
  // --- CONFIGURAÇÕES GLOBAIS ---
  const SLIDE_DURATION = 5000;
  const TRANSITION_MS = 700;
  // MUDANÇA: Tempo fixo de 2 segundos para remoção do splash.
  const SPLASH_TIME_MS = 2000; 

  // Configurações da API
  const apiToken = "wsxiP0Dydmf2TWqjOn1iZk9CfqwxdZBg8w5eQVaTLDWHnTjyvuGAqPBkAiGU";
  const endpoint = "https://api.invictuspay.app.br/api";

  // Lista de arquivos
  const mediaFiles = [
    "1.mp4", "2.mp4", "3.mp4", "4.mp4", "5.mp4", "6.mp4", "7.mp4"
  ];

  // --- COMPONENTES DOM ---
  const carouselRoot = document.getElementById('carouselRoot');
  const slidesEl = document.getElementById('slides');
  const indicatorsEl = document.getElementById('indicators');
  const nextBtn = document.getElementById('next');
  const prevBtn = document.getElementById('prev');
  const currentSlideEl = document.getElementById('currentSlide');
  const totalSlidesEl = document.getElementById('totalSlides');
  const mediaTypeTag = document.getElementById('mediaTypeTag');
  // Referência ao elemento de loading

  // Modais
  const buyBtn = document.getElementById('buyBtn');
  const modalBack = document.getElementById('modalBack');
  const closeModal = document.getElementById('closeModal');
  const cancelModal = document.getElementById('cancelModal');
  const previewBtn = document.getElementById('previewBtn');
  const previewBack = document.getElementById('previewBack');
  const closePreview = document.getElementById('closePreview');
  const closePreviewBtn = document.getElementById('closePreviewBtn');
  const previewArea = document.getElementById('previewArea');

  // PIX Form
  const pixCheckoutForm = document.getElementById('pixCheckoutForm');
  const confirmPay = document.getElementById('confirmPay');
  const loadingSpinnerPix = document.getElementById('loadingSpinnerPix');

  // Modal PIX
  const pixModal = document.getElementById('pixModal');
  const closePixModal = document.getElementById('closePixModal');
  const copyPixButton = document.getElementById('copyPixButton');
  const copyButtonText = document.getElementById('copyButtonText');
  const modalAmount = document.getElementById('modalAmount');
  const modalHash = document.getElementById('modalHash');
  const pixCodeTextarea = document.getElementById('pixCodeTextarea');
  const qrCodeImage = document.getElementById('qrCodeImage');
  const qrCodeContainer = document.getElementById('qrCodeContainer');

  // Campos de Endereço
  const customerZipCode = document.getElementById('customerZipCode');
  const customerState = document.getElementById('customerState');
  const customerStreet = document.getElementById('customerStreet');
  const customerNeighborhood = document.getElementById('customerNeighborhood');
  const customerCity = document.getElementById('customerCity');
  const customerNumber = document.getElementById('customerNumber');

  // --- ESTADO ---
  let slides = [];
  let dots = [];
  let idx = 0;
  let timer = null;
  let playing = true;

  // --- FUNÇÕES DE UTILIDADE ---
  function getRandomMedia() {
    const randomIndex = Math.floor(Math.random() * mediaFiles.length);
    const file = mediaFiles[randomIndex];
    const isVideo = file.endsWith('.mp4');
    const src = file.startsWith('http') ? file : `assets/${file}`;
    return { file, isVideo, src };
  }

  function updateSlideInfo() {
    if (currentSlideEl) currentSlideEl.textContent = idx + 1;
    if (totalSlidesEl) totalSlidesEl.textContent = slides.length;
    if (slides[idx]) {
      const isVideo = slides[idx].dataset.type === 'video';
      if (mediaTypeTag) mediaTypeTag.textContent = isVideo ? 'Vídeo' : 'Imagem';
    }
  }

  /**
   * Remove o elemento de loading do DOM após o tempo definido (2000ms).
   * Função refatorada para a lógica solicitada.
   */

  // --- API CEP ---
  async function buscarEnderecoPorCEP(cep) {
    cep = cep.replace(/\D/g, '');
    if (cep.length !== 8) return null;
    
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (!response.ok) throw new Error('Erro ViaCEP');
      const data = await response.json();
      if (data.erro) throw new Error('CEP Inexistente');
      return { logradouro: data.logradouro, bairro: data.bairro, cidade: data.localidade, estado: data.uf };
    } catch (error) {
      try { // Fallback
        const res2 = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`);
        if (!res2.ok) throw new Error('Erro BrasilAPI');
        const data2 = await res2.json();
        return { logradouro: data2.street, bairro: data2.neighborhood, cidade: data2.city, estado: data2.state };
      } catch (e) {
        return null;
      }
    }
  }

  function formatarCEP(cep) {
    cep = cep.replace(/\D/g, '');
    if (cep.length > 5) cep = cep.replace(/^(\d{5})(\d)/, '$1-$2');
    return cep.substring(0, 9);
  }

  function toggleCEPLoading(isLoading) {
    if (!customerZipCode) return;
    if (isLoading) {
      // SVG base64 simplificado
      customerZipCode.style.backgroundImage = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%238b5cf6\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M21 12a9 9 0 11-6.219-8.56\'%3E%3C/path%3E%3C/svg%3E")';
      customerZipCode.style.backgroundRepeat = 'no-repeat';
      customerZipCode.style.backgroundPosition = 'right 12px center';
      customerZipCode.style.backgroundSize = '16px';
      customerZipCode.disabled = true;
    } else {
      customerZipCode.style.backgroundImage = '';
      customerZipCode.disabled = false;
    }
  }

  // --- CARROSSEL ---
  function buildCarousel() {
    slidesEl.innerHTML = '';
    indicatorsEl.innerHTML = '';

    if (mediaFiles.length === 0) return;

    mediaFiles.forEach((file, i) => {
      const isVideo = file.endsWith('.mp4');
      const slide = document.createElement('div');
      slide.className = 'slide';
      slide.dataset.index = i;
      slide.dataset.type = isVideo ? 'video' : 'image';

      const src = file.startsWith('http') ? file : `assets/${file}`;
      // Lazy loading: carrega metadata só do primeiro
      const preloadStrategy = i === 0 ? 'metadata' : 'none';
      const loadingAttr = i === 0 ? 'eager' : 'lazy';

      if (isVideo) {
        slide.innerHTML = `
          <div class="media-wrapper">
            <video muted playsinline preload="${preloadStrategy}" loop poster="">
              <source src="${src}" type="video/mp4">
            </video>
            <div class="loader-placeholder"><div class="spinner"></div></div>
          </div>
          <div class="caption">Vídeo ${i + 1}</div>`;
      } else {
        slide.innerHTML = `
          <div class="media-wrapper">
            <img src="${src}" alt="Slide ${i + 1}" loading="${loadingAttr}">
            <div class="loader-placeholder"><div class="spinner"></div></div>
          </div>
          <div class="caption">Imagem ${i + 1}</div>`;
      }

      // Remove spinner local quando mídia carregar
      const mediaEl = slide.querySelector(isVideo ? 'video' : 'img');
      const removePlaceholder = () => {
        const placeholder = slide.querySelector('.loader-placeholder');
        if (placeholder) placeholder.style.display = 'none';
      };

      if (isVideo) {
        mediaEl.addEventListener('loadeddata', removePlaceholder);
        mediaEl.addEventListener('error', () => {
            slide.querySelector('.media-wrapper').innerHTML = '<div class="error-msg"><i class="fas fa-exclamation-circle"></i> Erro no vídeo</div>';
        });
      } else {
        mediaEl.addEventListener('load', removePlaceholder);
        mediaEl.addEventListener('error', removePlaceholder);
      }

      slidesEl.appendChild(slide);

      const dot = document.createElement('button');
      dot.className = 'dot' + (i === 0 ? ' active' : '');
      dot.dataset.index = i;
      dot.setAttribute('aria-label', `Slide ${i + 1}`);
      indicatorsEl.appendChild(dot);
    });

    slides = Array.from(document.querySelectorAll('#slides .slide'));
    dots = Array.from(document.querySelectorAll('#indicators .dot'));
    
    slidesEl.style.setProperty('--slide-duration', (SLIDE_DURATION / 1000).toFixed(2) + 's');
    updateSlideInfo();
  }

  function initCarousel() {
    if (slides.length === 0) return;
    idx = 0;
    showSlide(idx);
    if (slides.length > 1) {
      timer = setInterval(() => { goTo(idx + 1); }, SLIDE_DURATION);
    }
    
    // Controles
    nextBtn.onclick = () => { goTo(idx + 1); resetTimer(); };
    prevBtn.onclick = () => { goTo(idx - 1); resetTimer(); };
    dots.forEach(d => d.onclick = () => { goTo(+d.dataset.index); resetTimer(); });

    carouselRoot.addEventListener('mouseenter', pause);
    carouselRoot.addEventListener('mouseleave', resume);
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { goTo(idx - 1); resetTimer(); }
      if (e.key === 'ArrowRight') { goTo(idx + 1); resetTimer(); }
    });
  }

  function showSlide(i) {
    const n = slides.length;
    if (n === 0) return;
    idx = ((i % n) + n) % n;

    slidesEl.style.transform = `translateX(-${idx * 100}%)`;

    slides.forEach((s, si) => {
      const isActive = si === idx;
      s.classList.toggle('active', isActive);
      const v = s.querySelector('video');
      if (v) {
        if (!isActive) {
          v.pause(); v.currentTime = 0;
        } else {
          v.muted = true;
          v.play().catch(() => {});
        }
      }
    });

    dots.forEach(d => d.classList.remove('active'));
    if (dots[idx]) dots[idx].classList.add('active');
    updateSlideInfo();
  }

  function goTo(i) { showSlide(i); }

  function resetTimer() {
    if (timer) clearInterval(timer);
    if(playing && slides.length > 1) timer = setInterval(() => { goTo(idx + 1); }, SLIDE_DURATION);
  }

  function pause() { 
    playing = false; 
    if (timer) clearInterval(timer); 
    const v = document.querySelector('.slide.active video');
    if (v) v.pause();
  }
  
  function resume() { 
    if (!playing) playing = true;
    resetTimer(); 
    const v = document.querySelector('.slide.active video');
    if (v) v.play().catch(() => {});
  }

  // --- MODAIS / API ---
  function openCheckoutModal() {
    pause();
    modalBack.style.display = 'flex';
    modalBack.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeCheckoutModal() {
    resume();
    modalBack.style.display = 'none';
    modalBack.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function openPixModal() {
    pause();
    pixModal.style.display = 'flex';
    pixModal.setAttribute('aria-hidden', 'false');
  }

  function closePixModal() {
    resume();
    pixModal.style.display = 'none';
    pixModal.setAttribute('aria-hidden', 'true');
  }

  function showPixModal(data) {
    const amountBRL = (data.amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    modalAmount.textContent = amountBRL;
    modalHash.textContent = `ID: ${data.hash}`;
    pixCodeTextarea.value = data.pix.pix_qr_code;
    copyButtonText.textContent = "COPIAR CÓDIGO";
    copyPixButton.classList.remove('success');

    if (data.pix.qr_code_base64) {
      qrCodeImage.src = `data:image/png;base64,${data.pix.qr_code_base64}`;
      qrCodeContainer.style.display = 'block';
    } else {
      qrCodeContainer.style.display = 'none';
    }
    closeCheckoutModal();
    openPixModal();
  }

  async function copyPixCode() {
    pixCodeTextarea.select();
    pixCodeTextarea.setSelectionRange(0, 99999);
    try {
      await navigator.clipboard.writeText(pixCodeTextarea.value);
      copyButtonText.textContent = "Copiado! ✅";
      copyPixButton.classList.add('success');
      setTimeout(() => { copyButtonText.textContent = "COPIAR CÓDIGO"; copyPixButton.classList.remove('success'); }, 2500);
    } catch (err) {
      document.execCommand('copy');
    }
  }

  async function executeApiCall(method, path, payload, button, spinner) {
    button.disabled = true;
    if(spinner) spinner.classList.add('active');
    
    try {
      const res = await fetch(`${endpoint}${path}?api_token=${apiToken}`, {
        method,
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: payload ? JSON.stringify(payload) : null
      });

      const data = await res.json();
      if (res.ok && path.includes('/transactions')) {
        if (data.payment_method === 'pix') showPixModal(data);
      } else {
        alert(`Erro: ${data.message || 'Falha na transação'}`);
      }
    } catch (error) {
      alert('Erro de conexão. Verifique sua internet.');
    } finally {
      if(spinner) spinner.classList.remove('active');
      button.disabled = false;
    }
  }

  // --- EVENT LISTENERS ---
  if (buyBtn) buyBtn.addEventListener('click', openCheckoutModal);
  if (closeModal) closeModal.addEventListener('click', closeCheckoutModal);
  if (cancelModal) cancelModal.addEventListener('click', closeCheckoutModal);
  if (modalBack) modalBack.addEventListener('click', (e) => { if(e.target === modalBack) closeCheckoutModal(); });
  
  if (closePixModal) closePixModal.addEventListener('click', closePixModal);
  if (copyPixButton) copyPixButton.addEventListener('click', copyPixCode);
  if (pixModal) pixModal.addEventListener('click', (e) => { if(e.target === pixModal) closePixModal(); });

  if (customerZipCode) {
    customerZipCode.addEventListener('input', (e) => e.target.value = formatarCEP(e.target.value));
    customerZipCode.addEventListener('blur', async (e) => {
      if (e.target.value.replace(/\D/g, '').length === 8) {
        toggleCEPLoading(true);
        const end = await buscarEnderecoPorCEP(e.target.value);
        toggleCEPLoading(false);
        if (end) {
          if(customerStreet) customerStreet.value = end.logradouro || '';
          if(customerNeighborhood) customerNeighborhood.value = end.bairro || '';
          if(customerCity) customerCity.value = end.cidade || '';
          if(customerState) customerState.value = end.estado || '';
          if(customerNumber) customerNumber.focus();
        } else {
          alert('CEP não encontrado.');
        }
      }
    });
  }

  if (pixCheckoutForm) {
    pixCheckoutForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const offerHash = document.getElementById('offerHashInput').value.trim();
      const formData = new FormData(pixCheckoutForm);
      const customerData = {};
      formData.forEach((value, key) => { if (key !== 'offer_hash') customerData[key] = value; });

      const payload = {
        amount: 2000,
        offer_hash: offerHash,
        payment_method: "pix",
        customer: customerData,
        cart: [{ product_hash: offerHash, title: "Pacote Exclusivo", price: 2000, quantity: 1, operation_type: 1, tangible: false }],
        installments: 1,
        transaction_origin: "api"
      };
      executeApiCall('POST', '/public/v1/transactions', payload, confirmPay, loadingSpinnerPix);
    });
  }

  if (previewBtn) previewBtn.addEventListener('click', () => {
    pause();
    const media = getRandomMedia();
    previewArea.innerHTML = '';
    
    if (media.isVideo) {
      const vid = document.createElement('video');
      vid.controls = true; vid.autoplay = true; vid.style.width = '100%'; vid.style.height = '100%';
      vid.innerHTML = `<source src="${media.src}" type="video/mp4">`;
      previewArea.appendChild(vid);
    } else {
      const img = document.createElement('img');
      img.src = media.src; img.style.width = '100%'; img.style.height = '100%'; img.style.objectFit = 'contain';
      previewArea.appendChild(img);
    }
    previewBack.style.display = 'flex';
  });

  const closePreviewFunc = () => {
    previewArea.innerHTML = '';
    previewBack.style.display = 'none';
    resume();
  };

  if(closePreview) closePreview.addEventListener('click', closePreviewFunc);
  if(closePreviewBtn) closePreviewBtn.addEventListener('click', closePreviewFunc);
  if(previewBack) previewBack.addEventListener('click', (e) => { if(e.target === previewBack) closePreviewFunc(); });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (modalBack.style.display === 'flex') closeCheckoutModal();
      if (pixModal.style.display === 'flex') closePixModal();
      if (previewBack.style.display === 'flex') closePreviewFunc();
    }
  });

  // --- EXECUÇÃO INICIAL ---
  console.log('Inicializando aplicação...');
  
  // 1. Constrói o DOM (Carrossel)
  buildCarousel();
  initCarousel();

  // 2. Remove o Loading Overlay após o tempo definido (2s)
  removeLoadingScreen();
});
