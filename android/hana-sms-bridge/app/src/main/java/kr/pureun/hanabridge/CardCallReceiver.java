package kr.pureun.hanabridge;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.telephony.TelephonyManager;

/* 통화가 «끝났을 때»만 알아챈다 (2026-11-16 통화 후 명함 문자).
   울림→통화→끊김, 통화→끊김, 울림→끊김(부재중) 모두 «끊김으로 바뀌는 순간» 한 번 일을 맡긴다.
   무슨 통화였는지·누구인지는 여기서 보지 않는다 — CardSms 가 통화기록을 읽고 따진다.
   스위치가 꺼져 있으면 아무것도 하지 않는다. */
public final class CardCallReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        try {
            if (intent == null || !TelephonyManager.ACTION_PHONE_STATE_CHANGED.equals(intent.getAction())) return;
            if (!CardSms.isOn(context)) return;
            String state = intent.getStringExtra(TelephonyManager.EXTRA_STATE);
            int now = TelephonyManager.EXTRA_STATE_RINGING.equals(state) ? 1
                    : TelephonyManager.EXTRA_STATE_OFFHOOK.equals(state) ? 2 : 0;
            int prev = CardSms.swapState(context, now);
            if (now == 0 && prev != 0) CardCallWorker.enqueue(context);
        } catch (Exception ignored) {
            /* 통화 알림 때문에 앱이 죽으면 안 된다 */
        }
    }
}
