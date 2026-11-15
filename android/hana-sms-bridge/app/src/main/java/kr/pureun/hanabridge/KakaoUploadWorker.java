package kr.pureun.hanabridge;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.BackoffPolicy;
import androidx.work.Data;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/* 카톡 업무방 알림 한 장을 서버로 보낸다 (2026-10-09).

   ⚠ 글을 WorkManager 의 Data 에 바로 싣지 않는다 — Data 는 10KB 한도라 긴 글 몇 줄이면 넘친다.
     앱 전용 캐시 폴더에 잠깐 적어 두고 «파일 이름»만 넘긴다. 보낸 뒤(또는 포기할 때) 지운다.
   ⚠ 캐시 폴더는 이 앱만 읽는다. 그래도 오래 두지 않는다 — 원문을 폰에 남기지 않는 것이 이 앱의 약속이다. */
public final class KakaoUploadWorker extends Worker {
    private static final String KEY_FILE = "file";
    private static final String DIR = "kakao-out";

    public KakaoUploadWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    static void enqueue(Context context, KakaoNotice.Parsed parsed) {
        try {
            JSONArray items = new JSONArray();
            for (KakaoNotice.Item item : parsed.items) {
                JSONObject one = new JSONObject();
                one.put("sender", item.sender);
                one.put("text", item.text);
                one.put("time", item.time);
                items.put(one);
            }
            JSONObject payload = new JSONObject();
            payload.put("room", parsed.room);
            payload.put("items", items);
            File dir = new File(context.getCacheDir(), DIR);
            if (!dir.exists() && !dir.mkdirs()) return;
            File file = new File(dir, UUID.randomUUID().toString() + ".json");
            try (FileOutputStream out = new FileOutputStream(file)) {
                out.write(payload.toString().getBytes(StandardCharsets.UTF_8));
            }
            Data data = new Data.Builder().putString(KEY_FILE, file.getName()).build();
            OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(KakaoUploadWorker.class)
                    .setInputData(data)
                    .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                    .build();
            WorkManager.getInstance(context).enqueue(request);
        } catch (Exception ignored) {
            /* 한 장 못 적었다고 알림 듣기를 멈추지 않는다 — 카톡은 다음 알림에 앞 글을 또 싣는다 */
        }
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();
        String name = getInputData().getString(KEY_FILE);
        if (name == null || !name.matches("^[A-Za-z0-9._-]{1,80}\\.json$")) return Result.failure();
        File file = new File(new File(context.getCacheDir(), DIR), name);
        if (!file.exists()) return Result.failure();
        String uid = SecureStore.uid(context);
        String token = SecureStore.token(context);
        if (uid.isEmpty() || token.isEmpty()) {
            file.delete();
            return Result.failure();
        }
        /* 하루 넘게 못 보낸 것은 버린다 — 다음 알림에 덧쌓여 또 온다. */
        if (getRunAttemptCount() > 12) {
            file.delete();
            return Result.failure();
        }
        try {
            JSONObject payload = new JSONObject(new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8));
            JSONObject body = new JSONObject();
            body.put("action", "kakaoIngest");
            body.put("uid", uid);
            body.put("deviceId", SecureStore.deviceId(context));
            body.put("room", payload.optString("room", ""));
            body.put("items", payload.optJSONArray("items"));
            JSONObject response = HanaUploadWorker.post(body, token);
            KakaoRooms.absorb(context, response);
            file.delete();
            return Result.success();
        } catch (HanaUploadWorker.UnauthorizedException unauthorized) {
            file.delete();
            SecureStore.clearAll(context);
            SecureStore.setLastStatus(context, "연결이 해제되었습니다. ERP에서 다시 연결해 주세요.");
            return Result.failure();
        } catch (Exception retryable) {
            return Result.retry();
        }
    }

    static void clearPending(Context context) {
        File dir = new File(context.getCacheDir(), DIR);
        File[] files = dir.listFiles();
        if (files == null) return;
        for (File f : files) {
            try { f.delete(); } catch (Exception ignored) {}
        }
    }
}
