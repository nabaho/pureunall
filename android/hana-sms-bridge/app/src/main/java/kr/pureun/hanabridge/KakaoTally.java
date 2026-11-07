package kr.pureun.hanabridge;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

import java.util.List;

/* 카톡 알림을 «센 숫자»로만 남긴다 — 업무방 알림이 왜 0건인지 화면이 말할 수 있게 (2026-11-07).

   대표 지시 2026-11-07 「카톡 자료를 자동으로 가져오게, 가져와도 문제가 안 되게」.
   실측(11/07): 받을 방을 10/9 에 정했는데 카톡이 한 건도 안 들어왔다. 폰 앱은 살아 있었다(문자는 들어옴).
   그런데 HanaNotificationListener.onKakao 는 «방 이름을 못 읽음»·«목록과 글자가 다름»이면 아무 흔적 없이 버려서
   「폰에 카톡 알림이 아예 안 떴나(PC 카톡을 켜 두면 폰 알림이 안 간다)」와
   「떴는데 방 이름 모양이 달라 버렸나」를 가를 길이 없었다.

   ★ 세는 것: 본 카톡 알림 수 · 업무방과 «정확히» 맞은 수 · 업무방과 «비슷하지만 달라» 버린 수 · 방 이름을 못 읽은 수.
   ⚠★ 방 이름은 «어디에도» 적지 않고 보내지도 않는다 — 개인 대화방 이름이 서버로 가면 안 된다.
     비슷했을 때 «어떻게 달랐나»만 정해진 낱말 둘(extra·spacing)로 남긴다. 업무방 이름은 서버가 이미 안다.
   ⚠ 숫자는 앱을 다시 깔기 전까지 쌓인다(폰을 껐다 켜도 남는다) — 화면은 «지금까지 몇 번»으로 읽는다. */
final class KakaoTally {
    private static final String PREF = "pureun_kakao_tally";

    private KakaoTally() {}

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREF, Context.MODE_PRIVATE);
    }

    /* 카톡 알림 한 장. room 은 KakaoNotice.parse 가 읽은 방 이름 — 못 읽었으면 null. */
    static void record(Context context, String room) {
        if (context == null) return;
        SharedPreferences p = prefs(context);
        SharedPreferences.Editor e = p.edit();
        e.putInt("seen", p.getInt("seen", 0) + 1);
        e.putLong("seenAt", System.currentTimeMillis());
        if (room == null || room.isEmpty()) {
            e.putInt("noRoom", p.getInt("noRoom", 0) + 1);
        } else if (KakaoRooms.allowed(context, room)) {
            e.putInt("listed", p.getInt("listed", 0) + 1);
        } else {
            String kind = nearKind(room, KakaoRooms.list(context));
            if (kind != null) {
                e.putInt("near", p.getInt("near", 0) + 1);
                e.putString("nearKind", kind);
            }
        }
        e.apply();
    }

    /* 업무방 이름과 «비슷한가» — 띄어쓰기·기호만 다르면 spacing, 앞뒤에 글자가 더 붙었으면 extra, 아니면 null.
       (예: 알림이 방 이름 뒤에 사람 수를 붙여 보내는 판이면 extra 로 잡힌다) */
    static String nearKind(String room, List<String> rooms) {
        String r = squash(room);
        if (r.isEmpty()) return null;
        for (String name : rooms) {
            String n = squash(name);
            if (n.isEmpty()) continue;
            if (r.equals(n)) return "spacing";
            if (r.contains(n) || n.contains(r)) return "extra";
        }
        return null;
    }

    private static String squash(String s) {
        return s == null ? "" : s.replaceAll("[^\\p{L}\\p{N}]", "");
    }

    /* 15분 안부(sweepPing)에 싣는다 — 숫자들과 «어떻게 달랐나» 하나뿐이다. */
    static void put(Context context, JSONObject ping) {
        if (context == null || ping == null) return;
        SharedPreferences p = prefs(context);
        try {
            ping.put("kakaoSeen", p.getInt("seen", 0));
            ping.put("kakaoListed", p.getInt("listed", 0));
            ping.put("kakaoNear", p.getInt("near", 0));
            ping.put("kakaoNoRoom", p.getInt("noRoom", 0));
            ping.put("kakaoSeenAt", p.getLong("seenAt", 0L));
            ping.put("kakaoNearKind", p.getString("nearKind", ""));
        } catch (Exception ignored) {
            /* 못 실어도 안부는 그대로 간다 — 점검 숫자 때문에 문자 훑기가 멈추면 안 된다 */
        }
    }
}
