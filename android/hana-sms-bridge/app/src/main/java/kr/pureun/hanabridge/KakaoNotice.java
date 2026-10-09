package kr.pureun.hanabridge;

import android.app.Notification;
import android.os.Bundle;
import android.os.Parcelable;
import android.service.notification.StatusBarNotification;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/* 카톡 알림 한 장을 «방 이름 + 글 몇 줄»로 푼다 (2026-10-09).

   ■ 카톡 알림의 생김새 (안드로이드 «대화형» 알림)
     · 방 이름   — android.conversationTitle (단톡방). 옛 판은 android.subText / summaryText 에 둔다.
     · 글 여러 줄 — android.messages : 줄마다 text · time · sender 가 든 묶음.
       카톡은 새 글이 올 때마다 «앞의 글을 덧쌓아» 알림을 다시 띄운다 — 그래서 같은 글이 여러 번 온다.
       서버가 (방·보낸 사람·시각·글)로 열쇠를 지어 중복을 막는다.
     · 묶음 요약(「새 메시지 3개」)은 건너뛴다 — 알맹이가 없다.
   ⚠ 내가 보낸 글은 알림이 «안 뜬다» — 그래서 대표님 글은 여기로 못 온다(주 1회 내보내기로 채운다).
   ⚠ 사진·파일은 「사진을 보냈습니다」 글만 온다. 알맹이는 알림에 없다.

   ★ 가리개는 js/pu-kakao-work.js 와 «같은 식»이다 — tests/kakao-work.test.js 가 글자를 견준다. */
final class KakaoNotice {
    static final int TEXT_MAX = 2000;
    static final int ITEMS_MAX = 30;

    /* ⚠ 아래 넷은 js/pu-kakao-work.js 의 RRN_RE·CARD_RE·ACCOUNT_RE·PHONE_RE 와 같아야 한다. */
    static final String RRN = "\\d{6}\\s*-\\s*[1-8]\\d{6}";
    static final String CARD = "\\d{4}[- ]\\d{4}[- ]\\d{4}[- ]\\d{4}";
    static final String ACCOUNT = "\\d{2,6}-\\d{2,6}-\\d{2,8}(?:-\\d{1,6})?";
    static final String PHONE = "^0\\d{1,2}-\\d{3,4}-\\d{4}$";

    private static final Pattern RRN_P = Pattern.compile(RRN);
    private static final Pattern CARD_P = Pattern.compile(CARD);
    private static final Pattern ACCOUNT_P = Pattern.compile(ACCOUNT);
    private static final Pattern PHONE_P = Pattern.compile(PHONE);

    static final class Item {
        final String sender;
        final String text;
        final long time;
        Item(String sender, String text, long time) {
            this.sender = sender;
            this.text = text;
            this.time = time;
        }
    }

    static final class Parsed {
        final String room;
        final List<Item> items;
        Parsed(String room, List<Item> items) {
            this.room = room;
            this.items = items;
        }
    }

    private KakaoNotice() {}

    static String normRoom(String name) {
        return name == null ? "" : name.replaceAll("\\s+", " ").trim();
    }

    static String mask(String text) {
        if (text == null) return "";
        String s = RRN_P.matcher(text).replaceAll("●●●●●●-●●●●●●●");
        s = CARD_P.matcher(s).replaceAll("●●●●-●●●●-●●●●-●●●●");
        Matcher m = ACCOUNT_P.matcher(s);
        StringBuffer out = new StringBuffer();
        while (m.find()) {
            String hit = m.group();
            String digits = hit.replaceAll("\\D", "");
            String put = (PHONE_P.matcher(hit).matches() || digits.length() < 10) ? hit : "●●●-계좌-●●●";
            m.appendReplacement(out, Matcher.quoteReplacement(put));
        }
        m.appendTail(out);
        return out.toString();
    }

    /* 못 풀면 null — 방 이름을 모르면 목록과 견줄 수가 없으니 보내지 않는다. */
    static Parsed parse(StatusBarNotification sbn) {
        Notification n = sbn.getNotification();
        if (n == null) return null;
        if ((n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return null;
        Bundle extras = n.extras;
        if (extras == null) return null;

        boolean group = extras.getBoolean(Notification.EXTRA_IS_GROUP_CONVERSATION, false);
        String room = chars(extras.getCharSequence(Notification.EXTRA_CONVERSATION_TITLE));
        if (room.isEmpty()) room = chars(extras.getCharSequence(Notification.EXTRA_SUB_TEXT));
        if (room.isEmpty()) room = chars(extras.getCharSequence(Notification.EXTRA_SUMMARY_TEXT));
        /* 1:1 방은 방 이름 자리가 비고 제목이 곧 상대 이름이다. */
        if (room.isEmpty() && !group) room = chars(extras.getCharSequence(Notification.EXTRA_TITLE));
        room = normRoom(room);
        if (room.isEmpty()) return null;

        List<Item> items = new ArrayList<>();
        Parcelable[] messages = extras.getParcelableArray(Notification.EXTRA_MESSAGES);
        if (messages != null) {
            int from = Math.max(0, messages.length - ITEMS_MAX);
            for (int i = from; i < messages.length; i++) {
                if (!(messages[i] instanceof Bundle)) continue;
                Bundle b = (Bundle) messages[i];
                String text = chars(b.getCharSequence("text"));
                if (text.isEmpty()) continue;
                String sender = chars(b.getCharSequence("sender"));
                /* Person 은 안드로이드 9(API 28)부터 있다 — 그 아래 폰에서 부르면 앱이 죽는다. */
                if (sender.isEmpty() && android.os.Build.VERSION.SDK_INT >= 28 && b.containsKey("sender_person")) {
                    Object person = b.get("sender_person");
                    if (person instanceof android.app.Person) {
                        sender = chars(((android.app.Person) person).getName());
                    }
                }
                long time = b.getLong("time", sbn.getPostTime());
                items.add(new Item(limit(sender, 60), limit(mask(text), TEXT_MAX), time));
            }
        }
        if (items.isEmpty()) {
            /* 대화형이 아닌 옛 꼴 — 제목이 보낸 사람, 본문이 글. */
            String text = chars(extras.getCharSequence(Notification.EXTRA_BIG_TEXT));
            if (text.isEmpty()) text = chars(extras.getCharSequence(Notification.EXTRA_TEXT));
            if (text.isEmpty()) return null;
            String sender = chars(extras.getCharSequence(Notification.EXTRA_TITLE));
            if (sender.equals(room)) sender = "";
            items.add(new Item(limit(sender, 60), limit(mask(text), TEXT_MAX), sbn.getPostTime()));
        }
        return new Parsed(room, items);
    }

    private static String chars(CharSequence value) {
        return value == null ? "" : value.toString().trim();
    }

    private static String limit(String value, int max) {
        return value.length() > max ? value.substring(0, max) : value;
    }
}
