package kr.pureun.hanabridge;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/* 알림의 「명함 보내기」·「안 보내기」 단추 (2026-11-16).
   ⚠ exported=false — 다른 앱이 이 단추를 흉내 내지 못한다.
   ⚠ 인텐트에는 «번호표»만 있다. 받는 번호는 이 앱 안에서 번호표로 찾는다(CardSms.answer) —
     번호를 인텐트에 실으면 문자 중계기가 된다. */
public final class CardActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        try {
            if (intent == null) return;
            int id = intent.getIntExtra(CardSms.EXTRA_ASK, -1);
            if (id < 0) return;
            if (CardSms.ACTION_SEND.equals(intent.getAction())) CardSms.answer(context, id, true);
            else if (CardSms.ACTION_SKIP.equals(intent.getAction())) CardSms.answer(context, id, false);
        } catch (Exception ignored) {
            /* 단추를 눌렀는데 앱이 죽으면 안 된다 */
        }
    }
}
