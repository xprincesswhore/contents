document.addEventListener("DOMContentLoaded", () => {
  // --- CONFIGURAÇÕES GLOBAIS ---
  const SLIDE_DURATION = 5000; // 5 segundos por slide
  const TRANSITION_MS = 700;

  // Configurações da API
  const apiToken = "wsxiP0Dydmf2TWqjOn1iZk9CfqwxdZBg8w5eQVaTLDWHnTjyvuGAqPBkAiGU";
  const endpoint = "https://api.invictuspay.app.br/api";

  // Lista manual de arquivos (imagens e vídeos) na pasta /assets
  const mediaFiles = [
    "1.mp4",
    "2.mp4",
    "3.mp4",
    "4.mp4",
    "5.mp4",
    "6.mp4",
    "7.mp4",
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
  const loadingOverlay = document.getElementById('loadingOverlay');

  // Modais e formulários
  const buyBtn = document.getElementById('buyBtn');
  const modalBack = document.getElementById('modalBack');
  const closeModal = document.getElementById('closeModal'); 
  const cancelModal = document.getElementById('cancelModal');
  const previewBtn = document.getElementById('previewBtn');
  const previewBack = document.getElementById('previewBack');
  const closePreview = document.getElementById('closePreview');
  const closePreviewBtn = document.getElementById('closePreviewBtn');
  const previewArea = document.getElementById('previewArea');

  // Formulário PIX
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

  // Campos do formulário de endereço
  const customerZipCode = document.getElementById('customerZipCode');
  const customerState = document.getElementById('customerState');
  const customerStreet = document.getElementById('customerStreet');
  const customerNeighborhood = document.getElementById('customerNeighborhood');
  const customerCity = document.getElementById('customerCity');
  const customerNumber = document.getElementById('customerNumber');
  const customerComplement = document.getElementById('customerComplement');

  // --- ESTADO DO CARROSSEL ---
  let slides = [];
  let dots = [];
  let idx = 0;
  let timer = null;
  let playing = true;
  let mediaLoaded = 0;
  let loadingTimeout = null;

  // --- FUNÇÕES DE UTILIDADE ---

  /**
   * Seleciona aleatoriamente um arquivo da lista de mídias.
   * @returns {{file: string, isVideo: boolean, src: string}} Objeto com detalhes da mídia.
   */
  function getRandomMedia() {
    const randomIndex = Math.floor(Math.random() * mediaFiles.length);
    const file = mediaFiles[randomIndex];
    const isVideo = file.endsWith('.mp4');
    const src = file.startsWith('http') ? file : `assets/${file}`;
    return { file, isVideo, src };
  }

  /**
   * Atualiza o contador de slides e o tipo de mídia
   */
  function updateSlideInfo() {
    if (currentSlideEl) currentSlideEl.textContent = idx + 1;
    if (totalSlidesEl) totalSlidesEl.textContent = slides.length;
    
    // Atualiza o tipo de mídia
    if (slides[idx]) {
      const isVideo = slides[idx].dataset.type === 'video';
      if (mediaTypeTag) mediaTypeTag.textContent = isVideo ? 'Vídeo' : 'Imagem';
    }
  }

  /**
   * Esconde a tela de carregamento quando todo o conteúdo estiver pronto
   */
  function hideLoadingScreen() {
    console.log('Escondendo loading screen, mídias carregadas:', mediaLoaded);
    
    // Limpa o timeout de fallback
    if (loadingTimeout) {
      clearTimeout(loadingTimeout);
    }
    
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
      setTimeout(() => {
        loadingOverlay.style.display = 'none';
        console.log('Loading screen completamente escondido');
      }, 500);
    }
  }

  /**
   * Força o fechamento do loading após timeout
   */
  function forceHideLoading() {
    console.log('Forçando fechamento do loading screen');
    if (loadingOverlay && loadingOverlay.style.display !== 'none') {
      hideLoadingScreen();
    }
  }

  /**
   * Busca endereço via API de CEP
   */
  async function buscarEnderecoPorCEP(cep) {
    // Remove caracteres não numéricos
    cep = cep.replace(/\D/g, '');
    
    // Verifica se CEP tem 8 dígitos
    if (cep.length !== 8) {
      return null;
    }
    
    try {
      // Tenta a API ViaCEP primeiro
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      
      if (!response.ok) {
        throw new Error('CEP não encontrado');
      }
      
      const data = await response.json();
      
      if (data.erro) {
        throw new Error('CEP não encontrado');
      }
      
      return {
        logradouro: data.logradouro,
        bairro: data.bairro,
        cidade: data.localidade,
        estado: data.uf
      };
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      
      // Fallback para outra API (BrasilAPI)
      try {
        const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`);
        
        if (!response.ok) {
          throw new Error('CEP não encontrado');
        }
        
        const data = await response.json();
        
        return {
          logradouro: data.street,
          bairro: data.neighborhood,
          cidade: data.city,
          estado: data.state
        };
      } catch (error2) {
        console.error('Erro ao buscar CEP na BrasilAPI:', error2);
        return null;
      }
    }
  }

  /**
   * Formata CEP enquanto o usuário digita
   */
  function formatarCEP(cep) {
    // Remove tudo que não é número
    cep = cep.replace(/\D/g, '');
    
    // Aplica a máscara: 00000-000
    if (cep.length > 5) {
      cep = cep.replace(/^(\d{5})(\d)/, '$1-$2');
    }
    
    return cep.substring(0, 9); // Limita a 8 dígitos + hífen
  }

  /**
   * Mostra loading no campo CEP
   */
  function mostrarLoadingCEP() {
    if (customerZipCode) {
      customerZipCode.style.backgroundImage = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%238b5cf6\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M21 12a9 9 0 11-6.219-8.56\'%3E%3C/path%3E%3C/svg%3E")';
      customerZipCode.style.backgroundRepeat = 'no-repeat';
      customerZipCode.style.backgroundPosition = 'right 12px center';
      customerZipCode.style.backgroundSize = '16px';
      customerZipCode.disabled = true;
    }
  }

  /**
   * Remove loading do campo CEP
   */
  function removerLoadingCEP() {
    if (customerZipCode) {
      customerZipCode.style.backgroundImage = '';
      customerZipCode.disabled = false;
    }
  }

  // --- FUNÇÕES DO CARROSSEL ---

  /**
   * Constrói a estrutura do carrossel no DOM
   */
  function buildCarousel() {
    console.log('Iniciando construção do carrossel...');
    slidesEl.innerHTML = '';
    indicatorsEl.innerHTML = '';
    mediaLoaded = 0;

    // Se não há arquivos de mídia, esconde o loading imediatamente
    if (mediaFiles.length === 0) {
      console.log('Nenhum arquivo de mídia encontrado');
      hideLoadingScreen();
      return;
    }

    mediaFiles.forEach((file, i) => {
      const isVideo = file.endsWith('.mp4');
      const slide = document.createElement('div');
      slide.className = 'slide';
      slide.dataset.index = i;
      slide.dataset.type = isVideo ? 'video' : 'image';

      const src = file.startsWith('http') ? file : `assets/${file}`;

      if (isVideo) {
        // Usa a tag <video> com autoplay/muted para prévia
        slide.innerHTML = `<video muted playsinline preload="metadata" loop>
          <source src="${src}" type="video/mp4">
          Seu navegador não suporta vídeo.
        </video>
        <div class="caption">Vídeo ${i + 1}</div>`;
        
        // Adiciona evento de carregamento
        const video = slide.querySelector('video');
        const handleVideoLoad = () => {
          console.log(`Vídeo ${i + 1} carregado: ${file}`);
          handleMediaLoad();
          // Remove os event listeners após o carregamento
          video.removeEventListener('loadeddata', handleVideoLoad);
          video.removeEventListener('error', handleVideoLoad);
        };
        
        video.addEventListener('loadeddata', handleVideoLoad);
        video.addEventListener('error', handleVideoLoad);

        // Força o carregamento do vídeo
        video.load();

      } else {
        // Usa a tag <img>
        slide.innerHTML = `<img src="${src}" alt="Slide ${i + 1}">
        <div class="caption">Imagem ${i + 1}</div>`;
        
        // Adiciona evento de carregamento
        const img = slide.querySelector('img');
        const handleImageLoad = () => {
          console.log(`Imagem ${i + 1} carregada: ${file}`);
          handleMediaLoad();
          // Remove os event listeners após o carregamento
          img.removeEventListener('load', handleImageLoad);
          img.removeEventListener('error', handleImageLoad);
        };
        
        img.addEventListener('load', handleImageLoad);
        img.addEventListener('error', handleImageLoad);
      }

      slidesEl.appendChild(slide);

      // Constrói o indicador (dot)
      const dot = document.createElement('button');
      dot.className = 'dot' + (i === 0 ? ' active' : '');
      dot.dataset.index = i;
      dot.setAttribute('aria-label', `Ir para slide ${i + 1}`);
      indicatorsEl.appendChild(dot);
    });

    // Atualiza as NodeLists
    slides = Array.from(document.querySelectorAll('#slides .slide'));
    dots = Array.from(document.querySelectorAll('#indicators .dot'));

    // Define a variável CSS para o efeito Ken-Burns
    slidesEl.style.setProperty('--slide-duration', (SLIDE_DURATION / 1000).toFixed(2) + 's');
    
    // Atualiza informações do slide
    updateSlideInfo();

    console.log('Carrossel construído com', slides.length, 'slides');
  }

  /**
   * Manipula o carregamento de mídia
   */
  function handleMediaLoad() {
    mediaLoaded++;
    console.log(`Mídia ${mediaLoaded}/${mediaFiles.length} carregada`);
    
    // Se todas as mídias estiverem carregadas, esconde a tela de loading
    if (mediaLoaded >= mediaFiles.length) {
      console.log('Todas as mídias foram carregadas');
      hideLoadingScreen();
    }
  }

  /**
   * Inicializa o comportamento dinâmico do carrossel (timers, eventos)
   */
  function initCarousel() {
    if (slides.length === 0) {
      console.log('Nenhum slide encontrado para inicializar');
      return;
    }

    if (timer) clearInterval(timer);
    idx = 0;
    showSlide(idx);
    
    // Inicia o timer apenas se houver mais de um slide
    if (slides.length > 1) {
      timer = setInterval(() => { goTo(idx + 1); }, SLIDE_DURATION);
    }

    // Controles de Navegação
    nextBtn.onclick = () => { goTo(idx + 1); resetTimer(); };
    prevBtn.onclick = () => { goTo(idx - 1); resetTimer(); };
    dots.forEach(d => d.onclick = () => { goTo(+d.dataset.index); resetTimer(); });

    // Pausar/Retomar ao passar o mouse
    carouselRoot.addEventListener('mouseenter', () => { pause(); });
    carouselRoot.addEventListener('mouseleave', () => { resume(); });
    
    // Navegação por teclado
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        goTo(idx - 1);
        resetTimer();
      } else if (e.key === 'ArrowRight') {
        goTo(idx + 1);
        resetTimer();
      }
    });

    console.log('Carrossel inicializado com', slides.length, 'slides');
  }

  /**
   * Exibe um slide específico e controla a mídia.
   * @param {number} i - Índice do slide.
   */
  function showSlide(i) {
    const n = slides.length;
    if (n === 0) return;
    idx = ((i % n) + n) % n;

    slidesEl.style.transition = `transform ${TRANSITION_MS}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
    slidesEl.style.transform = `translateX(-${idx * 100}%)`;

    slides.forEach((s, si) => {
      s.classList.toggle('active', si === idx);
      const v = s.querySelector('video');
      if (v) {
        // PAUSA e RESETA todos os vídeos inativos
        try { v.pause(); v.currentTime = 0; } catch (e) { /* ignore */ }
      }
    });

    const current = slides[idx];
    if (!current) return;
    const currentVideo = current.querySelector('video');
    
    if (currentVideo) {
      currentVideo.muted = true;
      currentVideo.onloadedmetadata = () => {
        console.log('Tentando reproduzir vídeo atual');
        currentVideo.play().catch((e) => { 
          console.log('Autoplay bloqueado:', e); 
        });
      };
      // Não chame load() aqui para evitar recarregar o vídeo
    }
    
    dots.forEach(d => d.classList.remove('active'));
    if (dots[idx]) dots[idx].classList.add('active');
    
    // Atualiza informações do slide
    updateSlideInfo();
  }

  function goTo(i) {
    showSlide(i);
  }

  function resetTimer() {
    if (timer) clearInterval(timer);
    if(playing && slides.length > 1) {
      timer = setInterval(() => { goTo(idx + 1); }, SLIDE_DURATION);
    }
  }

  function pause() { 
    playing = false; 
    if (timer) clearInterval(timer); 
    const currentVideo = document.querySelector('.slide.active video');
    if (currentVideo) {
        try { currentVideo.pause(); } catch (e) { /* ignore */ }
    }
  }
  
  function resume() { 
    if (!playing) playing = true;
    resetTimer(); 
    const currentVideo = document.querySelector('.slide.active video');
    if (currentVideo) {
        try { currentVideo.play().catch(() => { /* autoplay bloqueado, ignora */ }); } catch (e) { /* ignore */ }
    }
  }

  // --- LÓGICA DE CHECKOUT E PIX ---

  /**
   * Abre o modal de checkout
   */
  function openCheckoutModal() {
    modalBack.style.display = 'flex';
    modalBack.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  /**
   * Fecha o modal de checkout
   */
  function closeCheckoutModal() {
    modalBack.style.display = 'none';
    modalBack.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  /**
   * Abre o modal PIX
   */
  function openPixModal() {
    pixModal.style.display = 'flex';
    pixModal.setAttribute('aria-hidden', 'false');
  }

  /**
   * Fecha o modal PIX
   */
  function closePixModal() {
    pixModal.style.display = 'none';
    pixModal.setAttribute('aria-hidden', 'true');
  }

  /**
   * Exibe os dados do PIX no modal
   */
  function showPixModal(data) {
    const amountBRL = (data.amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const pixCode = data.pix.pix_qr_code;
    const qrBase64 = data.pix.qr_code_base64;

    modalAmount.textContent = amountBRL;
    modalHash.textContent = `ID Transação: ${data.hash}`;
    pixCodeTextarea.value = pixCode;

    // Reset do botão de cópia
    copyButtonText.textContent = "COPIAR CÓDIGO";
    copyPixButton.classList.remove('success');

    if (qrBase64) {
      qrCodeImage.src = `data:image/png;base64,${qrBase64}`;
      qrCodeContainer.style.display = 'block';
    } else {
      qrCodeImage.src = '';
      qrCodeContainer.style.display = 'none';
    }

    closeCheckoutModal();
    openPixModal();
  }

  /**
   * Copia o código PIX para a área de transferência
   */
  async function copyPixCode() {
    pixCodeTextarea.select();
    pixCodeTextarea.setSelectionRange(0, 99999); 

    try {
      await navigator.clipboard.writeText(pixCodeTextarea.value);

      // Feedback Visual
      copyButtonText.textContent = "Copiado! ✅";
      copyPixButton.classList.add('success');

      setTimeout(() => {
        copyButtonText.textContent = "COPIAR CÓDIGO";
        copyPixButton.classList.remove('success');
      }, 2500);

    } catch (err) {
      document.execCommand('copy'); // Fallback
      copyButtonText.textContent = "Copiado (Fallback)";
    }
  }

  /**
   * Executa chamada para a API
   */
  async function executeApiCall(method, path, payload = null, button, spinner) {
    button.disabled = true;
    if(spinner) spinner.classList.add('active');

    const apiUrl = `${endpoint}${path}?api_token=${apiToken}`;
    let response = null;

    try {
      const config = {
        method: method,
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: payload ? JSON.stringify(payload) : null
      };

      response = await fetch(apiUrl, config);

      if (!response) throw new Error("Sem resposta do servidor.");

      const data = await response.json();

      if (response.ok) {
        if (path.includes('/transactions') && data.payment_method === 'pix' && data.pix?.pix_qr_code) {
          showPixModal(data); 
        }
      } else {
        alert(`Erro: ${response.status} - ${JSON.stringify(data)}`);
      }

    } catch (error) {
      alert(`ERRO: ${error.message}`);
    } finally {
      if(spinner) spinner.classList.remove('active');
      button.disabled = false;
    }
  }

  // --- EVENT LISTENERS ---

  // Modal de Compra
  if (buyBtn) buyBtn.addEventListener('click', openCheckoutModal);
  if (closeModal) closeModal.addEventListener('click', closeCheckoutModal);
  if (cancelModal) cancelModal.addEventListener('click', closeCheckoutModal);
  if (modalBack) modalBack.addEventListener('click', (e) => { 
    if (e.target === modalBack) closeCheckoutModal();
  });

  // Modal PIX
  if (closePixModal) closePixModal.addEventListener('click', closePixModal);
  if (copyPixButton) copyPixButton.addEventListener('click', copyPixCode);
  if (pixModal) pixModal.addEventListener('click', (e) => {
    if (e.target === pixModal) closePixModal();
  });

  // Integração com API de CEP
  if (customerZipCode) {
    // Formata o CEP enquanto digita
    customerZipCode.addEventListener('input', (e) => {
      e.target.value = formatarCEP(e.target.value);
    });
    
    // Busca endereço quando o CEP estiver completo
    customerZipCode.addEventListener('blur', async (e) => {
      const cep = e.target.value.replace(/\D/g, '');
      
      if (cep.length === 8) {
        mostrarLoadingCEP();
        
        const endereco = await buscarEnderecoPorCEP(cep);
        
        removerLoadingCEP();
        
        if (endereco) {
          // Preenche os campos automaticamente
          if (customerStreet) customerStreet.value = endereco.logradouro || '';
          if (customerNeighborhood) customerNeighborhood.value = endereco.bairro || '';
          if (customerCity) customerCity.value = endereco.cidade || '';
          if (customerState) customerState.value = endereco.estado || '';
          
          // Foca no campo número após preencher o endereço
          if (customerNumber) {
            customerNumber.focus();
          }
        } else {
          alert('CEP não encontrado. Por favor, verifique o CEP digitado.');
        }
      }
    });
  }

  // Formulário PIX
  if (pixCheckoutForm) {
    pixCheckoutForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const offerHash = document.getElementById('offerHashInput').value.trim();
      if (!offerHash) return;

      const formData = new FormData(pixCheckoutForm);
      const customerData = {};
      for (const [key, value] of formData.entries()) {
        if (key !== 'offer_hash') customerData[key] = value;
      }

      const pixPayload = {
        "amount": 2000,
        "offer_hash": offerHash, 
        "payment_method": "pix", 
        "customer": customerData,
        "cart": [{
          "product_hash": offerHash,
          "title": "Pacote de Conteúdo Exclusivo - xprincesswhore",
          "price": 2000,
          "quantity": 1,
          "operation_type": 1, 
          "tangible": false
        }],
        "installments": 1,
        "expire_in_days": 1,
        "transaction_origin": "api"
      };

      executeApiCall('POST', '/public/v1/transactions', pixPayload, confirmPay, loadingSpinnerPix);
    });
  }

  // Preview Rápida
  if (previewBtn) previewBtn.addEventListener('click', () => {
    const media = getRandomMedia();
    previewArea.innerHTML = '';

    if (media.isVideo) {
      const vid = document.createElement('video');
      vid.controls = true;
      vid.autoplay = true;
      vid.muted = false;
      vid.style.width = '100%';
      vid.style.height = '100%';
      vid.style.objectFit = 'contain';
      
      const s = document.createElement('source');
      s.src = media.src;
      s.type = 'video/mp4';
      vid.appendChild(s);
      
      previewArea.appendChild(vid);
      vid.play().catch(() => { /* ignore */ });

    } else {
      const img = document.createElement('img');
      img.src = media.src;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'contain';
      img.alt = 'Prévia do conteúdo';
      previewArea.appendChild(img);
    }

    previewBack.style.display = 'flex';
    previewBack.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  });

  const closePreviewFunc = () => { 
    const videoInPreview = previewArea.querySelector('video');
    if (videoInPreview) {
      try { videoInPreview.pause(); videoInPreview.currentTime = 0; } catch (e) { /* ignore */ }
    }

    previewBack.style.display = 'none'; 
    previewBack.setAttribute('aria-hidden', 'true'); 
    previewArea.innerHTML = ''; 
    document.body.style.overflow = ''; 
  };

  if (closePreview) closePreview.addEventListener('click', closePreviewFunc);
  if (closePreviewBtn) closePreviewBtn.addEventListener('click', closePreviewFunc);
  if (previewBack) previewBack.addEventListener('click', (e) => { 
    if (e.target === previewBack) closePreviewFunc();
  });

  // Fecha modais com a tecla ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (modalBack.style.display === 'flex') closeCheckoutModal();
      if (pixModal.style.display === 'flex') closePixModal();
      if (previewBack.style.display === 'flex') closePreviewFunc();
    }
  });

  // --- INICIALIZAÇÃO ---
  console.log('Iniciando aplicação...');
  
  // Configura timeout de fallback para o loading
  loadingTimeout = setTimeout(() => {
    console.log('Timeout do loading atingido, forçando fechamento');
    forceHideLoading();
  }, 8000); // 8 segundos

  buildCarousel();
  initCarousel();
  
  // Fallback adicional - força fechamento após 10 segundos
  setTimeout(() => {
    if (loadingOverlay && loadingOverlay.style.display !== 'none') {
      console.log('Fallback final: forçando fechamento do loading');
      forceHideLoading();
    }
  }, 10000);
});