const { createApp, ref, computed, onMounted } = Vue;

createApp({
  setup() {
    const el = document.getElementById('app');
    const merchantTradeNo = el.dataset.tradeNo || '';

    const status = ref('loading'); // loading | paid | pending | failed | error
    const orderId = ref('');
    const errorMsg = ref('查詢失敗，請至訂單列表查看。');

    const orderUrl = computed(() => orderId.value ? '/orders/' + orderId.value : '/orders');

    async function verify() {
      if (!orderId.value) return;
      status.value = 'loading';
      try {
        const res = await apiFetch('/api/orders/' + orderId.value + '/verify', { method: 'POST' });
        const s = res.data.status;
        status.value = s === 'paid' ? 'paid' : s === 'failed' ? 'failed' : 'pending';
      } catch (e) {
        status.value = 'error';
        errorMsg.value = '查詢付款狀態失敗，請至訂單列表查看。';
      }
    }

    onMounted(async function () {
      if (!Auth.isLoggedIn()) {
        window.location.href = '/login?redirect=/orders';
        return;
      }

      if (!merchantTradeNo) {
        status.value = 'error';
        errorMsg.value = '缺少交易資訊，請至訂單列表查看付款狀態。';
        return;
      }

      try {
        // Find order by MerchantTradeNo
        const lookupRes = await apiFetch('/api/orders/by-trade-no/' + merchantTradeNo);
        orderId.value = lookupRes.data.id;
        // Then verify payment status
        await verify();
      } catch (e) {
        status.value = 'error';
        errorMsg.value = '找不到對應訂單，請至訂單列表查看。';
      }
    });

    return { status, orderUrl, errorMsg, verify };
  }
}).mount('#app');
