package kr.pureun.hanabridge;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.BackoffPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import java.util.concurrent.TimeUnit;

/* 통화가 끝난 4초 뒤에 통화기록의 «가장 최근 한 줄»을 본다 (2026-11-16).
   끊긴 직후에는 통화기록이 아직 안 적혀 있을 수 있어 바로 읽지 않는다.
   그래도 안 적혔으면 두 번까지 다시 한다(CardSms.processLastCall 이 «새 줄인가»를 가린다). */
public final class CardCallWorker extends Worker {
    private static final String UNIQUE = "card_call_after";
    private static final int LAST_TRY = 2;

    public CardCallWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        boolean done = CardSms.processLastCall(getApplicationContext(), getRunAttemptCount() >= LAST_TRY);
        return done ? Result.success() : Result.retry();
    }

    static void enqueue(Context context) {
        OneTimeWorkRequest work = new OneTimeWorkRequest.Builder(CardCallWorker.class)
                .setInitialDelay(4, TimeUnit.SECONDS)
                .setBackoffCriteria(BackoffPolicy.LINEAR, 10, TimeUnit.SECONDS)
                .build();
        WorkManager.getInstance(context).enqueueUniqueWork(UNIQUE, ExistingWorkPolicy.REPLACE, work);
    }
}
