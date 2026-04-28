const { createApp, ref, onMounted } = Vue;

createApp({
  setup() {
    if (!Auth.requireAuth()) return {};

    const el = document.getElementById('app');
    const orderId = el.dataset.orderId;
    const paymentResult = ref(el.dataset.paymentResult || null);

    const order = ref(null);
    const loading = ref(true);
    const paying = ref(false);
    const verifying = ref(false);

    const statusMap = {
      pending: { label: '待付款', cls: 'bg-apricot/20 text-apricot' },
      paid: { label: '已付款', cls: 'bg-sage/20 text-sage' },
      failed: { label: '付款失敗', cls: 'bg-red-100 text-red-600' },
    };

    const paymentMessages = {
      success: { text: '付款成功！感謝您的購買。', cls: 'bg-sage/10 text-sage border border-sage/20' },
      failed: { text: '付款失敗，請重試。', cls: 'bg-red-50 text-red-600 border border-red-100' },
      cancel: { text: '付款已取消。', cls: 'bg-apricot/10 text-apricot border border-apricot/20' },
    };

    async function goToPayment() {
      if (!order.value || paying.value) return;
      paying.value = true;
      try {
        const res = await apiFetch('/payment/ecpay/' + order.value.id + '/params', { method: 'POST' });
        const { paymentUrl, params } = res.data;

        // Dynamically create and submit a form to ECPay (JWT-auth done via API call above)
        const form = document.createElement('form');
        form.method = 'post';
        form.action = paymentUrl;
        form.style.display = 'none';
        for (const [key, value] of Object.entries(params)) {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = value;
          form.appendChild(input);
        }
        document.body.appendChild(form);
        form.submit();
      } catch (e) {
        Notification.show('無法取得付款資訊，請稍後再試', 'error');
        paying.value = false;
      }
    }

    async function verifyPayment() {
      if (!order.value || verifying.value) return;
      verifying.value = true;
      try {
        const res = await apiFetch('/api/orders/' + order.value.id + '/verify', { method: 'POST' });
        order.value = res.data;
        if (res.data.status === 'paid') {
          paymentResult.value = 'success';
        } else if (res.data.status === 'failed') {
          paymentResult.value = 'failed';
        } else {
          Notification.show('尚未付款，請完成付款後再查詢', 'warning');
        }
      } catch (e) {
        Notification.show('查詢付款狀態失敗', 'error');
      } finally {
        verifying.value = false;
      }
    }

    onMounted(async function () {
      try {
        const res = await apiFetch('/api/orders/' + orderId);
        order.value = res.data;
      } catch (e) {
        Notification.show('載入訂單失敗', 'error');
      } finally {
        loading.value = false;
      }
    });

    return { order, loading, paying, verifying, paymentResult, statusMap, paymentMessages, goToPayment, verifyPayment };
  }
}).mount('#app');
