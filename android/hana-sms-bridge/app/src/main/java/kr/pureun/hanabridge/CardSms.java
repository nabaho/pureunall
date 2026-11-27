package kr.pureun.hanabridge;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.provider.CallLog;
import android.provider.ContactsContract;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.Iterator;
import java.util.Locale;
import java.util.regex.Pattern;

/* 통화가 끝나면 «명함 문자»를 보낸다 (2026-11-16, 대표 지시 「전화통화 후 자동으로 명함 문자로
   보내는 기능. 이미 저장된 이름은 보낼지 선택하게 하고, 연락처에 없으면 자동 보내기」).

   ■ 흐름
     CardCallReceiver 가 «통화 끝(IDLE)»을 알아채면 CardCallWorker 가 4초 뒤 통화기록(CallLog)의
     «가장 최근 한 줄»을 읽어 이 클래스(processLastCall)로 넘긴다.
       · 연락처에 «있는» 번호 → 설정대로(기본: 알림으로 «보낼까요?» 물음 → 사람이 누르면 발송)
       · 연락처에 «없는» 번호 → 설정대로(기본: 바로 발송)
     모든 길은 이 폰 안에서 끝난다 — 서버·남의 서비스로 번호나 이름이 나가지 않는다.

   ★ 안전 규칙 (어기면 안 되는 것)
     1) 연락처를 «못 읽으면» 저장된 번호로 취급한다(= 물어본다). 못 읽는데 자동 발송하면
        연락처에 있는 사람에게 묻지도 않고 보내게 된다.
     2) 보내기 «직전에» 이 번호를 처리했다고 적는다. 보내고 죽어도 두 번 나가지 않는다.
     3) 같은 번호는 30일에 한 번만(보냈든·안 보내기를 눌렀든·못 본 척했든).
     4) 부재중·거절·몇 초짜리 통화·휴대폰이 아닌 번호(유선·1588·번호 숨김)는 보내지 않는다.
     5) 알림 단추는 «번호를 들고 다니지 않는다» — 번호는 이 앱 안에만 있고 단추는 요청 번호표만
        든다(CardActionReceiver 는 exported=false). 다른 앱이 번호를 실어 문자를 쏘게 못 한다.
     6) 결과는 «마지막 처리 한 줄»로 화면에 남긴다 — 조용히 안 보내면 사람은 이유를 모른다.
        번호는 가려서(010-****-1234) 적는다. */
final class CardSms {
    static final String PREFS = "card_sms";
    static final int OFF = 0;     // 보내지 않는다
    static final int ASK = 1;     // 알림으로 물어보고, 눌러야 보낸다
    static final int AUTO = 2;    // 바로 보낸다
    static final int MAX_TEXT = 400;
    static final String ACTION_SEND = "kr.pureun.hanabridge.CARD_SEND";
    static final String ACTION_SKIP = "kr.pureun.hanabridge.CARD_SKIP";
    static final String EXTRA_ASK = "askId";

    private static final String K_ON = "on";
    private static final String K_SAVED = "saved_mode";
    private static final String K_UNKNOWN = "unknown_mode";
    private static final String K_TEXT = "text";
    private static final String K_DONE = "done";      // { 번호: 처리한 시각 }
    private static final String K_ASK = "ask";        // { 번호표: {n: 번호, t: 시각} }
    private static final String K_ROW = "last_row";   // 마지막으로 본 통화기록 줄
    private static final String K_NOTE = "note";
    private static final String K_STATE = "phone_state";
    private static final String K_SEQ = "ask_seq";
    private static final String CH_ASK = "card_ask";
    private static final String CH_INFO = "card_info";
    private static final long COOLDOWN_MS = 30L * 24 * 3600 * 1000;
    private static final long ASK_TTL_MS = 12L * 3600 * 1000;
    private static final long FRESH_MS = 5L * 60 * 1000;
    private static final int MIN_SECONDS = 3;
    private static final Pattern MOBILE = Pattern.compile("^01[016789]\\d{7,8}$");

    private CardSms() {}

    /* ───────── 설정 ───────── */

    private static SharedPreferences p(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static boolean isOn(Context c) { return p(c).getBoolean(K_ON, false); }

    /* 저장된 번호 기본 = 물어본다 */
    static int savedMode(Context c) { return clamp(p(c).getInt(K_SAVED, ASK), ASK); }

    /* 연락처에 없는 번호 기본 = 바로 보낸다 */
    static int unknownMode(Context c) { return clamp(p(c).getInt(K_UNKNOWN, AUTO), AUTO); }

    private static int clamp(int v, int dflt) { return v < OFF || v > AUTO ? dflt : v; }

    static String text(Context c) {
        String t = p(c).getString(K_TEXT, "");
        return t == null || t.trim().isEmpty() ? defaultText() : t;
    }

    /* ★ 명함은 «사진 링크»로 보낸다 (대표 결정 2026-11-23 — 글자 명함은 「명함이 아니다」).
         사진 파일은 사이트에 있다(img/namecard.jpg). 문자 한 통에 사진을 직접 붙이는 MMS 는
         안드로이드가 앱의 자동 발송을 막거나 통신사 설정에 따라 실패해 쓰지 않는다.
       ⚠ 주소의 사진이 사이트에서 사라지면 받은 사람이 죽은 링크를 받는다 — tests/card-sms-after-call 이 지킨다. */
    static String defaultText() {
        return "[푸른노무법인] 대표노무사 권형하입니다. 통화 감사합니다.\n"
                + "명함 사진: https://erp.pureunlabor.co.kr/img/namecard.jpg\n"
                + "휴대폰 010-2802-4601";
    }

    static void save(Context c, boolean on, int saved, int unknown, String text) {
        String body = text == null ? "" : text.trim();
        p(c).edit()
                .putBoolean(K_ON, on)
                .putInt(K_SAVED, clamp(saved, ASK))
                .putInt(K_UNKNOWN, clamp(unknown, AUTO))
                .putString(K_TEXT, body.equals(defaultText()) ? "" : body)
                .apply();
    }

    static String lastNote(Context c) { return p(c).getString(K_NOTE, ""); }

    static boolean granted(Context c, String perm) {
        return c.checkSelfPermission(perm) == PackageManager.PERMISSION_GRANTED;
    }

    /* 이 기능에 필요한데 아직 허용되지 않은 권한들 */
    static String[] missingPermissions(Context c) {
        ArrayList<String> need = new ArrayList<>();
        String[] all = {
                Manifest.permission.READ_PHONE_STATE,
                Manifest.permission.READ_CALL_LOG,
                Manifest.permission.READ_CONTACTS,
                Manifest.permission.SEND_SMS,
        };
        for (String perm : all) if (!granted(c, perm)) need.add(perm);
        if (android.os.Build.VERSION.SDK_INT >= 33
                && !granted(c, Manifest.permission.POST_NOTIFICATIONS)) {
            need.add(Manifest.permission.POST_NOTIFICATIONS);
        }
        return need.toArray(new String[0]);
    }

    /* 허용 안 된 권한을 «사람 말»로 — 「5개 있습니다」만으로는 무엇을 켜야 할지 모른다 (2026-11-23) */
    static String missingNames(Context c) {
        StringBuilder sb = new StringBuilder();
        String[][] all = {
                {Manifest.permission.READ_PHONE_STATE, "통화 상태"},
                {Manifest.permission.READ_CALL_LOG, "통화기록"},
                {Manifest.permission.READ_CONTACTS, "연락처"},
                {Manifest.permission.SEND_SMS, "문자 보내기"},
        };
        for (String[] p : all) if (!granted(c, p[0])) sb.append(sb.length() > 0 ? " · " : "").append(p[1]);
        if (android.os.Build.VERSION.SDK_INT >= 33 && !granted(c, Manifest.permission.POST_NOTIFICATIONS)) {
            sb.append(sb.length() > 0 ? " · " : "").append("알림");
        }
        return sb.toString();
    }

    /* ───────── 통화 상태 (받는 쪽이 매번 새로 만들어져서 폰 안에 적어 둔다) ───────── */

    /* 0 = 끊김(IDLE) · 1 = 울림 · 2 = 통화 중. 이전 상태를 돌려준다. */
    static int swapState(Context c, int now) {
        int prev = p(c).getInt(K_STATE, 0);
        p(c).edit().putInt(K_STATE, now).apply();
        return prev;
    }

    /* ───────── 통화가 끝난 뒤 ───────── */

    /* true = 끝났다 · false = 통화기록에 아직 안 적혔다(조금 뒤 다시) — lastAttempt 면 더 미루지 않는다 */
    static boolean processLastCall(Context c, boolean lastAttempt) {
        try {
            return process(c, lastAttempt);
        } catch (Exception failed) {
            note(c, "오류로 건너뜀 — " + shortReason(failed));
            return true;
        }
    }

    private static boolean process(Context c, boolean lastAttempt) {
        if (!isOn(c)) return true;
        if (!granted(c, Manifest.permission.READ_CALL_LOG) || !granted(c, Manifest.permission.SEND_SMS)) {
            note(c, "권한이 없어 건너뜀 — 「통화 후 명함 문자」 화면에서 허용해 주세요");
            return true;
        }
        long id; long date; long seconds; int type; String raw;
        try (Cursor cur = latestCall(c)) {
            if (cur == null || !cur.moveToFirst()) return lastAttempt;
            id = cur.getLong(0);
            raw = cur.getString(1);
            type = cur.getInt(2);
            date = cur.getLong(3);
            seconds = cur.getLong(4);
        }
        long now = System.currentTimeMillis();
        long lastRow = p(c).getLong(K_ROW, -1L);
        /* 통화기록이 아직 안 적혔으면 «지난 통화»가 맨 위에 있다 — 새 것이 아니면 기다린다 */
        if (id == lastRow || now - (date + seconds * 1000L) > FRESH_MS) return lastAttempt;
        p(c).edit().putLong(K_ROW, id).apply();

        if (type != CallLog.Calls.INCOMING_TYPE && type != CallLog.Calls.OUTGOING_TYPE) {
            note(c, "부재중·거절 통화라 보내지 않음");
            return true;
        }
        if (seconds < MIN_SECONDS) {
            note(c, "통화가 너무 짧아 보내지 않음");
            return true;
        }
        String number = normalize(raw);
        if (number.isEmpty()) {
            note(c, "번호가 숨겨져 있어 보내지 않음");
            return true;
        }
        if (!MOBILE.matcher(number).matches()) {
            note(c, "휴대폰 번호가 아니라 보내지 않음 · " + mask(number));
            return true;
        }
        JSONObject done = readObject(c, K_DONE);
        prune(done, now, COOLDOWN_MS);
        if (done.has(number)) {
            note(c, "30일 안에 이미 처리한 번호라 건너뜀 · " + mask(number));
            return true;
        }
        String name = contactName(c, number);            // null = 연락처에 없음 · "" = 있는데 이름을 못 읽음
        boolean saved = name != null;
        int mode = saved ? savedMode(c) : unknownMode(c);
        String who = (saved && !name.isEmpty() ? name + " " : "") + mask(number);
        if (mode == OFF) {
            note(c, (saved ? "저장된 번호" : "저장 안 된 번호") + " — 보내지 않기로 설정됨 · " + mask(number));
        } else if (mode == ASK) {
            ask(c, number, who);
        } else {
            deliver(c, number, saved ? "저장된 번호에 자동" : "저장 안 된 번호에 자동");
        }
        return true;
    }

    private static Cursor latestCall(Context c) {
        Bundle args = new Bundle();
        args.putStringArray(ContentResolver.QUERY_ARG_SORT_COLUMNS, new String[]{CallLog.Calls.DATE});
        args.putInt(ContentResolver.QUERY_ARG_SORT_DIRECTION, ContentResolver.QUERY_SORT_DIRECTION_DESCENDING);
        args.putInt(ContentResolver.QUERY_ARG_LIMIT, 1);
        return c.getContentResolver().query(CallLog.Calls.CONTENT_URI,
                new String[]{CallLog.Calls._ID, CallLog.Calls.NUMBER, CallLog.Calls.TYPE,
                        CallLog.Calls.DATE, CallLog.Calls.DURATION},
                args, null);
    }

    /* 숫자만 남기고, +82·0082 는 0 으로 바꾼다 */
    static String normalize(String raw) {
        if (raw == null) return "";
        String d = raw.replaceAll("\\D", "");
        if (d.startsWith("0082")) d = "0" + d.substring(4);
        else if (d.startsWith("82") && d.length() >= 11) d = "0" + d.substring(2);
        return d;
    }

    /* null = 연락처에 없음 · "" = 연락처에 있는데 이름을 못 읽음(또는 연락처를 아예 못 읽음).
       ★ 연락처를 «못 읽는» 경우는 저장된 번호로 취급한다 — 안전한 쪽(물어본다). */
    static String contactName(Context c, String number) {
        if (!granted(c, Manifest.permission.READ_CONTACTS)) return "";
        Uri uri = Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(number));
        try (Cursor cur = c.getContentResolver().query(uri,
                new String[]{ContactsContract.PhoneLookup.DISPLAY_NAME}, null, null, null)) {
            if (cur != null && cur.moveToFirst()) {
                String n = cur.getString(0);
                return n == null ? "" : n;
            }
        } catch (Exception unreadable) {
            return "";
        }
        return null;
    }

    /* ───────── 물어보기 ───────── */

    private static void ask(Context c, String number, String who) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null || !nm.areNotificationsEnabled()) {
            note(c, "알림이 꺼져 있어 물어보지 못하고 보내지 않음 · " + mask(number));
            return;
        }
        ensureChannels(nm);
        int id = nextSeq(c);
        JSONObject asks = readObject(c, K_ASK);
        prune(asks, System.currentTimeMillis(), ASK_TTL_MS, "t");
        try {
            asks.put(String.valueOf(id), new JSONObject().put("n", number).put("t", System.currentTimeMillis()));
        } catch (Exception ignored) { return; }
        p(c).edit().putString(K_ASK, asks.toString()).apply();
        mark(c, number, true);            // 못 본 척해도 같은 번호를 매 통화마다 또 묻지 않는다

        Notification.Builder b = new Notification.Builder(c, CH_ASK)
                .setSmallIcon(android.R.drawable.stat_notify_chat)
                .setContentTitle("명함 문자를 보낼까요?")
                .setContentText(who + " 와 통화했습니다")
                .setStyle(new Notification.BigTextStyle().bigText(who + " 와 통화했습니다.\n눌러야만 보냅니다."))
                .setVisibility(Notification.VISIBILITY_PRIVATE)
                .setAutoCancel(true)
                .setTimeoutAfter(ASK_TTL_MS)
                .addAction(0, "명함 보내기", action(c, ACTION_SEND, id))
                .addAction(0, "안 보내기", action(c, ACTION_SKIP, id));
        nm.notify(id, b.build());
        note(c, "보낼지 물어봄 · " + mask(number));
    }

    private static PendingIntent action(Context c, String action, int id) {
        Intent i = new Intent(c, CardActionReceiver.class).setAction(action).putExtra(EXTRA_ASK, id);
        return PendingIntent.getBroadcast(c, id * 2 + (ACTION_SEND.equals(action) ? 0 : 1), i,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /* 알림의 단추를 눌렀다. 번호는 단추가 아니라 이 앱 안에서 번호표로 찾는다. */
    static void answer(Context c, int askId, boolean send) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm != null) nm.cancel(askId);
        JSONObject asks = readObject(c, K_ASK);
        JSONObject entry = asks.optJSONObject(String.valueOf(askId));
        if (entry == null) {
            note(c, "이미 처리됐거나 시간이 지난 요청");
            return;
        }
        asks.remove(String.valueOf(askId));
        p(c).edit().putString(K_ASK, asks.toString()).apply();
        String number = entry.optString("n", "");
        if (System.currentTimeMillis() - entry.optLong("t", 0L) > ASK_TTL_MS) {
            mark(c, number, false);
            note(c, "시간이 지나 보내지 않음 · " + mask(number));
            return;
        }
        if (!send) {
            note(c, "안 보내기를 눌렀음 · " + mask(number));
            return;
        }
        deliver(c, number, "확인 후");
    }

    /* ───────── 보내기 ───────── */

    static boolean deliver(Context c, String number, String label) {
        String body = text(c);
        String why = VisitSmsSender.invalid(number, body);
        if (why != null) {
            note(c, "보내지 못함 — " + why);
            return false;
        }
        if (!granted(c, Manifest.permission.SEND_SMS)) {
            note(c, "문자 보내기 권한이 없어 보내지 못함");
            return false;
        }
        mark(c, number, true);            // ★ 보내기 «직전에» 적는다 — 보내고 죽으면 또 보낸다
        try {
            VisitSmsSender.sendOne(c, number, body);
            note(c, label + " 명함 문자를 보냈음 · " + mask(number));
            info(c, "명함 문자를 보냈습니다", mask(number));
            return true;
        } catch (Exception failed) {
            mark(c, number, false);       // 보내지 못한 것이 확실하면 다음 통화 때 다시 시도할 수 있게
            note(c, "보내지 못함 — " + shortReason(failed) + " · " + mask(number));
            return false;
        }
    }

    private static void info(Context c, String title, String text) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null || !nm.areNotificationsEnabled()) return;
        ensureChannels(nm);
        Notification.Builder b = new Notification.Builder(c, CH_INFO)
                .setSmallIcon(android.R.drawable.stat_notify_chat)
                .setContentTitle(title)
                .setContentText(text)
                .setVisibility(Notification.VISIBILITY_PRIVATE)
                .setAutoCancel(true)
                .setTimeoutAfter(60L * 60 * 1000);
        nm.notify(nextSeq(c), b.build());
    }

    private static void ensureChannels(NotificationManager nm) {
        nm.createNotificationChannel(new NotificationChannel(CH_ASK, "명함 문자 — 보낼지 묻기",
                NotificationManager.IMPORTANCE_HIGH));
        nm.createNotificationChannel(new NotificationChannel(CH_INFO, "명함 문자 — 보냈다는 알림",
                NotificationManager.IMPORTANCE_LOW));
    }

    private static int nextSeq(Context c) {
        int n = (p(c).getInt(K_SEQ, 1000) + 1) % 1000000;
        if (n < 1000) n = 1000;
        p(c).edit().putInt(K_SEQ, n).apply();
        return n;
    }

    /* ───────── 작은 도구 ───────── */

    private static void mark(Context c, String number, boolean on) {
        JSONObject done = readObject(c, K_DONE);
        try {
            if (on) done.put(number, System.currentTimeMillis());
            else done.remove(number);
        } catch (Exception ignored) { return; }
        p(c).edit().putString(K_DONE, done.toString()).apply();
    }

    private static JSONObject readObject(Context c, String key) {
        try { return new JSONObject(p(c).getString(key, "{}")); }
        catch (Exception broken) { return new JSONObject(); }
    }

    private static void prune(JSONObject map, long now, long keepMs) {
        prune(map, now, keepMs, null);
    }

    /* field 가 null 이면 값이 시각, 아니면 값 안의 field 가 시각 */
    private static void prune(JSONObject map, long now, long keepMs, String field) {
        ArrayList<String> old = new ArrayList<>();
        Iterator<String> it = map.keys();
        while (it.hasNext()) {
            String k = it.next();
            long t = field == null ? map.optLong(k, 0L)
                    : (map.optJSONObject(k) == null ? 0L : map.optJSONObject(k).optLong(field, 0L));
            if (now - t > keepMs) old.add(k);
        }
        for (String k : old) map.remove(k);
    }

    /* 010-****-1234 — 화면·알림·기록에는 번호를 가려서 적는다 */
    static String mask(String number) {
        String d = number == null ? "" : number.replaceAll("\\D", "");
        if (d.length() < 8) return "****";
        return d.substring(0, 3) + "-****-" + d.substring(d.length() - 4);
    }

    private static void note(Context c, String what) {
        String when = new SimpleDateFormat("M/d HH:mm", Locale.KOREA).format(new Date());
        p(c).edit().putString(K_NOTE, when + " · " + what).apply();
    }

    private static String shortReason(Exception e) {
        String m = e.getMessage();
        if (m == null || m.isEmpty()) m = e.getClass().getSimpleName();
        return m.length() > 80 ? m.substring(0, 80) : m;
    }
}
