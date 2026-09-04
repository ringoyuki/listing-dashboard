document.addEventListener('DOMContentLoaded', () => {
  const currentPriceInput = document.getElementById('currentPrice');
  const discountSelect = document.getElementById('discountSelect');
  const nextPriceDisplay = document.getElementById('nextPriceDisplay');
  const warningMessage = document.getElementById('warningMessage');
  const copyBtn = document.getElementById('copyBtn');
  const toastMessage = document.getElementById('toastMessage');

  const addDiscountBtn = document.getElementById('addDiscountBtn');
  const addCustomDiv = document.getElementById('addCustomDiv');
  const customDiscountInput = document.getElementById('customDiscountInput');
  const saveCustomBtn = document.getElementById('saveCustomBtn');
  const cancelCustomBtn = document.getElementById('cancelCustomBtn');

  let customDiscounts = [];

  // 初期化：保存されたデータがあれば読み込み、なければデフォルトを設定
  chrome.storage.local.get(['discounts'], (result) => {
    if (result.discounts && result.discounts.length > 0) {
      customDiscounts = result.discounts;
    } else {
      customDiscounts = [1, 500, 1000];
    }
    renderSelectOptions();
  });

  function renderSelectOptions() {
    // 既存のオプションをクリア
    discountSelect.innerHTML = '';
    
    // 数値を降順（または元の順序）で追加
    customDiscounts.sort((a, b) => a - b).forEach(val => {
      const option = document.createElement('option');
      option.value = val;
      option.textContent = `${val} 円`;
      discountSelect.appendChild(option);
    });

    calculate();
  }

  function saveDiscounts() {
    chrome.storage.local.set({ discounts: customDiscounts });
  }

  function calculate() {
    const currentPrice = parseInt(currentPriceInput.value, 10);
    const discount = parseInt(discountSelect.value, 10);

    if (isNaN(currentPrice) || isNaN(discount)) {
      nextPriceDisplay.textContent = '-';
      warningMessage.classList.add('hidden');
      return;
    }

    const nextPrice = currentPrice - discount;
    nextPriceDisplay.textContent = nextPrice;

    // 半額以下チェック
    if (nextPrice <= currentPrice / 2) {
      warningMessage.classList.remove('hidden');
    } else {
      warningMessage.classList.add('hidden');
    }
  }

  // イベントリスナー
  currentPriceInput.addEventListener('input', calculate);
  discountSelect.addEventListener('change', calculate);

  // コピー処理
  copyBtn.addEventListener('click', () => {
    const nextPrice = nextPriceDisplay.textContent;
    if (nextPrice === '-' || isNaN(nextPrice)) return;

    navigator.clipboard.writeText(nextPrice).then(() => {
      toastMessage.classList.remove('hidden');
      toastMessage.classList.add('show');
      setTimeout(() => {
        toastMessage.classList.remove('show');
      }, 2000);
    });
  });

  // カスタム値下げ幅の追加UIトグル
  addDiscountBtn.addEventListener('click', () => {
    addCustomDiv.classList.remove('hidden');
    customDiscountInput.focus();
  });

  cancelCustomBtn.addEventListener('click', () => {
    addCustomDiv.classList.add('hidden');
    customDiscountInput.value = '';
  });

  saveCustomBtn.addEventListener('click', () => {
    const newVal = parseInt(customDiscountInput.value, 10);
    if (!isNaN(newVal) && newVal > 0) {
      if (!customDiscounts.includes(newVal)) {
        customDiscounts.push(newVal);
        saveDiscounts();
        renderSelectOptions();
        
        // 追加したものを選択状態にする
        discountSelect.value = newVal;
        calculate();
      }
    }
    addCustomDiv.classList.add('hidden');
    customDiscountInput.value = '';
  });

  // Enterキーでの保存
  customDiscountInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveCustomBtn.click();
    }
  });
});
