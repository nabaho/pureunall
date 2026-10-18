package kr.pureun.hanabridge;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.telephony.SmsManager;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.regex.Pattern;

/* 방문 사업장 «사전 안내 문자»를 이 폰이 대신 보낸다 (2026-10-15, 대표 지시
   「돈 안 내고 자동으로 내 폰에서」).

   ■ 흐름
     15분 훑기(HanaSweepWorker)가 서버에 안부(sweepPing)를 물으면, 서버가 «오늘 보낼 일»
     (visitSmsJobs: 열쇠·받는 번호·문구)을 답에 실어 보낸다. 이 클래스가 그것을 폰의 문자
     기능으로 보내고, 결과를 visitSmsResult 로 서버에 알린다.

   ★ 두 번 보내지 않는다 (가장 중요한 규칙)
     · 보내기 «직전에» 열쇠를 폰 안에 적는다(SENT). 이미 적힌 열쇠는 서버가 또 줘도 안 보낸다.
     · 결과를 서버에 못 알렸어도(통신 끊김) 폰이 PENDING 에 담아 두었다가 다음 안부 때 다시 알린다.
     · 서버도 «받아 간 줄»을 다시 주지 않는다 — 그래서 어느 한쪽이 놓쳐도 중복으로 나가지 않는다.

   ⚠ 서버를 «믿되 맹신하지 않는다» — 받은 열쇠·번호·문구를 폰에서 한 번 더 따진다.
     휴대폰 번호(01x) 모양이 아니거나 열쇠 모양이 다르면 보내지 않고 «실패»로 알린다.
     (서버가 뚫려도 이 폰이 아무 번호로나 문자를 쏘는 기계가 되지 않게.)
   ⚠ 한 번에 20건까지만. 문구는 400자까지만. 그 밖은 버린다.
   ⚠ 문자 원문은 «결과 알림에 싣지 않는다» — 열쇠와 성공 여부, 짧은 사유만 보낸다.
   ⚠ SEND_SMS 권한이 없으면 아무것도 안 한다. 서버도 «보낼 수 있다»고 말한 폰에만 일을 준다
     (sweepPing 의 canSendSms). */
final class VisitSmsSender {
    private static final String PREFS = "visit_sms";
    private static final String SENT = "sent";         // { 열쇠: 보낸 시각 }
    private static final String PENDING = "pending";   // 아직 서버에 못 알린 결과 [{key,ok,error}]
    private static final long KEEP_MS = 3L * 24 * 3600 * 1000;
    private static final int MAX_JOBS = 20;
    private static final int MAX_TEXT = 400;
    private static final Pattern KEY = Pattern.compile("^\\d{4}-\\d{2}-\\d{2}_[A-Za-z0-9_-]{1,40}$");
    private static final Pattern MOBILE = Pattern.compile("^01[016789]\\d{7,8}$");

    private VisitSmsSender() {}

    static boolean canSend(Context context) {
        return context.checkSelfPermission(Manifest.permission.SEND_SMS)
                == PackageManager.PERMISSION_GRANTED;
    }

    /* 서버 답(pong)에 일이 실려 있으면 보내고 결과를 알린다. 예외는 밖으로 안 낸다 —
       문자 일이 하나 틀어졌다고 하나 거래문자 훑기까지 멈추면 안 된다. */
    static void handle(Context context, JSONObject pong, String uid, String token) {
        try {
            if (!canSend(context)) return;
            SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);

            /* ① 지난번에 못 알린 결과부터 다시 알린다 */
            flushPending(context, prefs, uid, token);

            /* ② 새 일 */
            JSONArray jobs = pong == null ? null : pong.optJSONArray("visitSmsJobs");
            if (jobs == null || jobs.length() == 0) return;
            JSONObject sent = readObject(prefs, SENT);
            prune(sent, System.currentTimeMillis());

            JSONArray results = pendingList(prefs);
            int n = Math.min(jobs.length(), MAX_JOBS);
            for (int i = 0; i < n; i++) {
                JSONObject job = jobs.optJSONObject(i);
                if (job == null) continue;
                String key = job.optString("key", "");
                String to = job.optString("to", "").replaceAll("\\D", "");
                String text = job.optString("text", "");
                JSONObject result = new JSONObject();
                result.put("key", key);

                if (!KEY.matcher(key).matches()) continue;          // 열쇠가 이상하면 서버에 말할 수도 없다
                if (sent.has(key)) {
                    /* 이미 보냈다 — 서버가 또 줬다. 보내지 않고 «보냈다»고만 다시 알린다. */
                    result.put("ok", true);
                    results.put(result);
                    continue;
                }
                String why = invalid(to, text);
                if (why != null) {
                    result.put("ok", false);
                    result.put("error", why);
                    results.put(result);
                    continue;
                }
                /* ★ 보내기 «직전에» 적는다. 보낸 뒤에 적으면, 보내고 죽었을 때 또 보낸다. */
                sent.put(key, System.currentTimeMillis());
                prefs.edit().putString(SENT, sent.toString()).apply();
                try {
                    sendOne(context, to, text);
                    result.put("ok", true);
                } catch (Exception failed) {
                    /* 보내지 못한 것이 «확실하면» 적어 둔 열쇠를 지워 다시 시도할 수 있게 한다.
                       (서버는 실패 줄을 사람이 다시 승인해야만 또 준다.) */
                    sent.remove(key);
                    prefs.edit().putString(SENT, sent.toString()).apply();
                    result.put("ok", false);
                    result.put("error", shortReason(failed));
                }
                results.put(result);
            }
            prefs.edit().putString(PENDING, results.toString()).apply();
            flushPending(context, prefs, uid, token);
        } catch (Exception ignored) {
            /* 다음 안부(15분 뒤)에 다시 온다 */
        }
    }

    /* 보내도 되는 모양인가 — null 이면 괜찮다, 아니면 사유 */
    static String invalid(String to, String text) {
        if (!MOBILE.matcher(to).matches()) return "받는 번호가 휴대폰 형식이 아님";
        if (text == null || text.trim().isEmpty()) return "문구가 비어 있음";
        if (text.length() > MAX_TEXT) return "문구가 너무 김";
        return null;
    }

    private static void sendOne(Context context, String to, String text) {
        SmsManager manager = Build.VERSION.SDK_INT >= 31
                ? context.getSystemService(SmsManager.class)
                : SmsManager.getDefault();
        if (manager == null) throw new IllegalStateException("문자 기능을 열지 못함");
        ArrayList<String> parts = manager.divideMessage(text);
        if (parts.size() > 1) {
            manager.sendMultipartTextMessage(to, null, parts, null, null);
        } else {
            manager.sendTextMessage(to, null, text, null, null);
        }
    }

    private static void flushPending(Context context, SharedPreferences prefs, String uid, String token) {
        JSONArray results = pendingList(prefs);
        if (results.length() == 0) return;
        try {
            JSONObject body = new JSONObject();
            body.put("action", "visitSmsResult");
            body.put("uid", uid);
            body.put("deviceId", SecureStore.deviceId(context));
            body.put("results", results);
            HanaUploadWorker.post(body, token);
            prefs.edit().remove(PENDING).apply();        // 알렸다 — 이제 비운다
        } catch (Exception offline) {
            /* 못 알렸다 — 담아 둔 채 다음 안부 때 다시 알린다(그 사이 같은 문자를 또 보내지는 않는다) */
        }
    }

    private static JSONArray pendingList(SharedPreferences prefs) {
        try { return new JSONArray(prefs.getString(PENDING, "[]")); }
        catch (Exception broken) { return new JSONArray(); }
    }

    private static JSONObject readObject(SharedPreferences prefs, String name) {
        try { return new JSONObject(prefs.getString(name, "{}")); }
        catch (Exception broken) { return new JSONObject(); }
    }

    /* 사흘 지난 «보낸 열쇠»는 비운다 — 열쇠에 날짜가 들어 있어 오늘 열쇠와 겹칠 일이 없다 */
    private static void prune(JSONObject sent, long now) {
        Iterator<String> it = sent.keys();
        ArrayList<String> old = new ArrayList<>();
        while (it.hasNext()) {
            String k = it.next();
            if (now - sent.optLong(k, 0L) > KEEP_MS) old.add(k);
        }
        for (String k : old) sent.remove(k);
    }

    private static String shortReason(Exception e) {
        String m = e.getMessage();
        if (m == null || m.isEmpty()) m = e.getClass().getSimpleName();
        return m.length() > 80 ? m.substring(0, 80) : m;
    }
}
