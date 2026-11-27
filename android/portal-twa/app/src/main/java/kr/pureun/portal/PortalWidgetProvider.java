package kr.pureun.portal;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

/**
 * 푸른포털 안드로이드 홈 화면 빠른 실행 위젯.
 *
 * 모든 바로가기 버튼은 외부 임의 URI 대신 명시적 PortalLauncherActivity 를 통해
 * https://erp.pureunlabor.co.kr 출처의 검증된 경로만 TWA 로 연다.
 * 추가 시스템 권한을 요구하지 않으며 Android 12+(API 31+) FLAG_IMMUTABLE 정책을 준수한다.
 */
public class PortalWidgetProvider extends AppWidgetProvider {

    private static final int[][] BUTTON_ROUTES = new int[][]{
        { R.id.widget_header,     R.string.widget_url_portal,  100 },
        { R.id.widget_btn_erp,    R.string.widget_url_erp,     101 },
        { R.id.widget_btn_cal,    R.string.widget_url_cal,     102 },
        { R.id.widget_btn_cards,  R.string.widget_url_cards,   103 },
        { R.id.widget_btn_mail,   R.string.widget_url_mail,    104 },
        { R.id.widget_btn_photos, R.string.widget_url_photos,  105 },
        { R.id.widget_btn_work,   R.string.widget_url_work,    106 },
    };

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        if (appWidgetIds == null) return;
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void updateWidget(Context context, AppWidgetManager manager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_portal_quick);
        for (int[] route : BUTTON_ROUTES) {
            int viewId = route[0];
            String targetUrl = context.getString(route[1]);
            int requestCode = appWidgetId * 16 + route[2];
            views.setOnClickPendingIntent(viewId, buildPortalPendingIntent(context, targetUrl, requestCode));
        }
        manager.updateAppWidget(appWidgetId, views);
    }

    private static PendingIntent buildPortalPendingIntent(Context context, String url, int requestCode) {
        Intent intent = new Intent(context, PortalLauncherActivity.class);
        intent.setAction(Intent.ACTION_VIEW);
        intent.setData(Uri.parse(url));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }
}
