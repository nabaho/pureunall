package kr.pureun.hanabridge;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/* 카톡 «업무방» 목록 — 이 목록에 정확히 있는 방의 알림만 보낸다 (2026-10-09).

   ★ 목록은 서버가 정한다(업무관리 → 💬 카톡정리 → 받을 방). 폰은 서버의 답을 받아 적어 둘 뿐이다.
     폰에서 고치는 화면을 두지 않는다 — 폰을 바꾸면 사라지고, 두 곳에서 고치면 어긋난다.
   ⚠★ 목록이 «비어 있으면 아무것도 안 보낸다». 목록 없이 켜면 가족·친구 대화가 통째로 간다.
   ⚠ 서버가 목록을 «못 읽은» 답(kakaoRooms 가 아예 없음)이면 가진 목록을 그대로 둔다 —
     빈 목록으로 덮으면 서버가 한 번 삐끗할 때마다 받기가 멎는다. */
final class KakaoRooms {
    private static final String PREF = "pureun_kakao_rooms";
    private static final String KEY = "rooms";

    private KakaoRooms() {}

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREF, Context.MODE_PRIVATE);
    }

    /* 서버 답에 kakaoRooms 가 있으면 받아 적는다. */
    static void absorb(Context context, JSONObject response) {
        if (context == null || response == null || !response.has("kakaoRooms")) return;
        JSONArray list = response.optJSONArray("kakaoRooms");
        if (list == null) return;
        JSONArray clean = new JSONArray();
        for (int i = 0; i < list.length() && i < 20; i++) {
            String name = KakaoNotice.normRoom(list.optString(i, ""));
            if (!name.isEmpty()) clean.put(name);
        }
        prefs(context).edit().putString(KEY, clean.toString()).apply();
    }

    static List<String> list(Context context) {
        List<String> out = new ArrayList<>();
        try {
            JSONArray list = new JSONArray(prefs(context).getString(KEY, "[]"));
            for (int i = 0; i < list.length(); i++) out.add(list.optString(i, ""));
        } catch (Exception broken) {
            /* 깨졌으면 빈 목록 — 아무것도 안 보낸다(안전한 쪽) */
        }
        return out;
    }

    /* 방 이름이 «정확히» 같을 때만 — 「천성」과 「천성가축약품」은 다른 곳이다. */
    static boolean allowed(Context context, String room) {
        String r = KakaoNotice.normRoom(room);
        if (r.isEmpty()) return false;
        for (String name : list(context)) {
            if (r.equals(KakaoNotice.normRoom(name))) return true;
        }
        return false;
    }

    static void clear(Context context) {
        prefs(context).edit().remove(KEY).apply();
    }
}
