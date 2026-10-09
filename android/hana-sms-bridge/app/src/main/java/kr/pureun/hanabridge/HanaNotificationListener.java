package kr.pureun.hanabridge;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import androidx.work.BackoffPolicy;
import androidx.work.Data;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;

import java.util.concurrent.TimeUnit;

public final class HanaNotificationListener extends NotificationListenerService {
    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null || !SecureStore.connected(this)) return;
        String packageName = sbn.getPackageName();
        /* ★ 카톡 업무방 (2026-10-09) — 하나 거래 그물과 «따로» 간다.
           ⚠ 아래 하나 그물(isTransaction)에 카톡 글을 흘려보내지 않는다 — 단톡방에 「하나 … 입금 … 원」이
             적히면 거래로 잡힌다. 카톡 꾸러미는 여기서 끝낸다.
           ⚠ 정해 둔 방이 아니면 그 자리에서 버린다 — 서버로 아무것도 안 간다. */
        if (BridgeConfig.KAKAO_PACKAGE.equals(packageName)) {
            onKakao(sbn);
            return;
        }
        if (!HanaMessageFilter.supportedPackage(packageName)) return;
        Bundle extras = sbn.getNotification().extras;
        String title = chars(extras.getCharSequence(Notification.EXTRA_TITLE));
        String text = bestText(extras);
        if (!HanaMessageFilter.isTransaction(title, text)) return;

        Data data = new Data.Builder()
                .putString("packageName", packageName)
                .putString("title", limit(title, 200))
                .putString("text", limit(text, 1200))
                .build();
        OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(HanaUploadWorker.class)
                .setInputData(data)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build();
        WorkManager.getInstance(this).enqueue(request);
    }

    /* 같은 글을 거듭 보내지 않게 최근 열쇠를 쥐고 있는다 — 카톡은 새 글마다 앞 글을 덧쌓아 다시 띄운다.
       ⚠ 놓쳐도 괜찮다(서비스가 다시 뜨면 비워진다) — 서버가 열쇠로 한 번 더 막는다. */
    private final java.util.LinkedHashSet<String> kakaoSent = new java.util.LinkedHashSet<>();

    private void onKakao(StatusBarNotification sbn) {
        KakaoNotice.Parsed parsed = KakaoNotice.parse(sbn);
        if (parsed == null || !KakaoRooms.allowed(this, parsed.room)) return;
        java.util.List<KakaoNotice.Item> fresh = new java.util.ArrayList<>();
        for (KakaoNotice.Item item : parsed.items) {
            String key = parsed.room + "" + item.sender + "" + item.time + "" + item.text.hashCode();
            if (kakaoSent.add(key)) fresh.add(item);
        }
        while (kakaoSent.size() > 300) kakaoSent.remove(kakaoSent.iterator().next());
        if (fresh.isEmpty()) return;
        KakaoUploadWorker.enqueue(this, new KakaoNotice.Parsed(parsed.room, fresh));
    }

    private static String bestText(Bundle extras) {
        String big = chars(extras.getCharSequence(Notification.EXTRA_BIG_TEXT));
        if (!big.isEmpty()) return big;
        CharSequence[] lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
        if (lines != null && lines.length > 0) {
            StringBuilder value = new StringBuilder();
            for (CharSequence line : lines) {
                if (value.length() > 0) value.append('\n');
                value.append(chars(line));
            }
            if (value.length() > 0) return value.toString();
        }
        return chars(extras.getCharSequence(Notification.EXTRA_TEXT));
    }

    private static String chars(CharSequence value) {
        return value == null ? "" : value.toString();
    }

    private static String limit(String value, int max) {
        return value.length() > max ? value.substring(0, max) : value;
    }
}
