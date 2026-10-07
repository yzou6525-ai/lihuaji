import {$,esc,money,state,api,modal,toast,safe} from './core.js';

export async function reconcilePayment(id) {
  return api('/orders/'+encodeURIComponent(id)+'/payment-status',{method:'POST',quiet:true});
}

export async function paymentReturn(order) {
  const url=new URL(location.href);
  if(!url.searchParams.has('payment_return'))return order;
  url.searchParams.delete('payment_return');history.replaceState(null,'',url);
  if(order.owner_id!==state.user?.id||order.state!=='pending_payment'||!order.options?._payment_provider||state.config.payment_mode!=='live')return order;
  try{return await reconcilePayment(order.id)}catch(error){if(error.name==='AbortError')throw error;toast('到账结果暂未核对，请在订单中点击“核对付款结果”。');return order}
}

export function openPayment(order,onComplete) {
  modal(`<h2>选择支付方式</h2><p>${esc(order.number)} · ${money(order.amount_fen)}</p><div class="row"><button id="wxpay">微信扫码支付</button><button id="alipay">支付宝网页支付</button></div><div id="payment-result"></div><p id="payment-status" role="status" aria-live="polite">请选择支付方式，金额以订单为准。</p><button id="check-payment">核对付款结果</button>`);
  const dialog=$('#modal'),result=$('#payment-result'),status=$('#payment-status'),check=$('#check-payment');
  const epoch=state.epoch,buttons={wechat:$('#wxpay'),alipay:$('#alipay')};
  let provider=order.options?._payment_provider||'',timer=null,busy=false,attempts=0,finished=false;
  const active=()=>!finished&&dialog.open&&status.isConnected&&epoch===state.epoch;
  function stop(){finished=true;clearTimeout(timer);dialog.removeEventListener('close',stop)}
  dialog.addEventListener('close',stop,{once:true});
  const previousCleanup=state.cleanup;state.cleanup=()=>{stop();previousCleanup()};
  function controls(){for(const [name,button]of Object.entries(buttons))button.disabled=busy||!!provider&&name!==provider;check.disabled=busy||!provider}
  async function verify(){
    if(!active()||busy||!provider)return;
    busy=true;controls();status.textContent='正在向支付平台核对，请稍候…';
    try{
      const latest=await reconcilePayment(order.id);
      if(!active())return;
      if(latest.state!=='pending_payment'){
        stop();dialog.close();toast(latest.payment?'已核实付款到账。':'订单已由支付平台关闭。');await onComplete();return;
      }
      status.textContent=latest.notice||'尚未确认到账，请勿重复付款。';
    }catch(error){if(active()&&error.name!=='AbortError')status.textContent=error.message+'。这不代表付款失败，请稍后核对，勿重复付款。'}
    finally{busy=false;if(active())controls()}
  }
  function schedule(){clearTimeout(timer);if(active()&&provider&&attempts<12)timer=setTimeout(async()=>{attempts++;await verify();schedule()},10000)}
  check.onclick=safe(verify);
  for(const [name,button]of Object.entries(buttons))button.onclick=safe(async()=>{
    if(!active()||busy)return;
    busy=true;controls();status.textContent='正在准备收银台…';
    try{
      const pay=await api('/orders/'+encodeURIComponent(order.id)+'/prepay',{method:'POST',body:{provider:name,mobile:/Android|iPhone|iPad/i.test(navigator.userAgent)},quiet:true});
      if(!active())return;
      provider=name;
      if(pay.cashier_url){stop();location.assign(pay.cashier_url);return}
      if(pay.qr_data){
        const img=document.createElement('img');img.className='qr';img.alt='此订单的微信付款码';img.src=pay.qr_data;result.replaceChildren(img);
        status.textContent='请用另一台设备的微信扫描此订单付款码。付款后会自动核对，亦可点击下方按钮。';
      }else status.textContent='收银台信息尚未返回，请核对原订单后重试。';
      schedule();
    }catch(error){
      if(active()&&error.name!=='AbortError'){
        status.textContent=error.message;
        // A timed-out prepay may already exist at the channel. Keep its provider.
        try{const latest=await api('/orders/'+encodeURIComponent(order.id),{quiet:true});if(active())provider=latest.options?._payment_provider||''}catch{}
        if(active()&&provider){status.textContent+='。请先核对付款结果，再重试原支付方式。';schedule()}
      }
    }finally{busy=false;if(active())controls()}
  });
  controls();
  if(provider){status.textContent='本订单已选择'+(provider==='wechat'?'微信':'支付宝')+'，付款后可核对到账结果。';schedule()}
}
